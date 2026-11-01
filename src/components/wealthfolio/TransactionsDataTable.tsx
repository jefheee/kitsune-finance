"use client";

import React, { useState, useMemo } from "react";
import { MerchantLogo } from "@/components/MerchantLogo";
import { BankLogo } from "@/components/BankLogo";
import { VirtualizedTransactionsList } from "@/components/finance/VirtualizedTransactionsList";
import { TransactionDetailModal } from "@/components/finance/TransactionDetailModal";
import { parseLocalDate } from "@/utils/finance/reconciler";
import { useFinanceData } from "@/context/FinanceDataContext";
import { WfIcons } from "./WealthfolioIcons";

export interface TransactionRowInput {
  id: string;
  description?: string;
  clean_description?: string | null;
  raw_description?: string | null;
  amount: number | string;
  category?: string | null;
  category_pt?: string | null;
  type?: string;
  operation_type?: string | null;
  is_internal_transfer?: boolean;
  is_refund?: boolean;
  is_subscription?: boolean;
  installment_number?: number | null;
  total_installments?: number | null;
  date?: string;
  executed_at?: string;
  account_id?: string;
  bank_accounts?: {
    bank_name?: string;
    institution_name?: string;
    institution_slug?: string;
    product_name?: string;
  };
}

interface TransactionsDataTableProps {
  transactions: TransactionRowInput[];
  accounts?: any[];
  formatCurrency: (val: number) => string;
  formatDate: (val?: string | null) => string;
}

type TxSortField = "date" | "description" | "category" | "amount";
type TxSortDir = "asc" | "desc";

export function TransactionsDataTable({
  transactions,
  accounts = [],
  formatCurrency,
  formatDate,
}: TransactionsDataTableProps) {
  const { isPrivacyMode } = useFinanceData();

  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<
    "this_month" | "last_month" | "90d" | "all"
  >("this_month");
  const [typeFilter, setTypeFilter] = useState<"all" | "expenses" | "incomes">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(false);

  const [sortField, setSortField] = useState<TxSortField>("date");
  const [sortDir, setSortDir] = useState<TxSortDir>("desc");

  const [renderEngine, setRenderEngine] = useState<"table" | "virtualized">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<any | null>(null);

  // Modal de Nova Transação Manual
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [newTxDesc, setNewTxDesc] = useState("");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [newTxCategory, setNewTxCategory] = useState("Compras");
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [localManualTxns, setLocalManualTxns] = useState<TransactionRowInput[]>([]);

  const handleAddManualTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmount.replace(",", "."));
    if (!newTxDesc || isNaN(amt) || amt <= 0) return;

    const newTx: TransactionRowInput = {
      id: `manual_${Date.now()}`,
      clean_description: newTxDesc,
      description: newTxDesc,
      amount: newTxType === "DEBIT" ? -amt : amt,
      type: newTxType,
      category_pt: newTxCategory,
      date: newTxDate,
      bank_accounts: {
        bank_name: "Carteira Kitsune",
        institution_name: "Carteira Kitsune",
        institution_slug: "generic",
        product_name: "Lançamento Manual",
      },
    };

    setLocalManualTxns((prev) => [newTx, ...prev]);
    setIsNewTxModalOpen(false);
    setNewTxDesc("");
    setNewTxAmount("");
  };

  const allTxns = useMemo(
    () => [...localManualTxns, ...transactions],
    [localManualTxns, transactions]
  );

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    allTxns.forEach((t) => {
      const c = t.category_pt || t.category;
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allTxns]);

  const uniqueBanks = useMemo(() => {
    const set = new Set<string>();
    allTxns.forEach((t) => {
      const b = t.bank_accounts?.institution_name || t.bank_accounts?.bank_name;
      if (b) set.add(b);
    });
    accounts.forEach((a) => {
      const b = a.institution_name || a.bank_name;
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allTxns, accounts]);

  const handleSort = (field: TxSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir(field === "description" || field === "category" ? "asc" : "desc");
    }
    setCurrentPage(1);
  };

  const filteredList = useMemo(() => {
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(
      lastMonthDate.getMonth() + 1
    ).padStart(2, "0")}`;
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);

    return allTxns
      .filter((tx) => {
        if (!showHidden && tx.is_internal_transfer) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const desc = (
            tx.clean_description ||
            tx.description ||
            tx.raw_description ||
            ""
          ).toLowerCase();
          const cat = (tx.category_pt || tx.category || "").toLowerCase();
          if (!desc.includes(q) && !cat.includes(q)) return false;
        }

        const rawDate = tx.date || tx.executed_at || "";
        const dateKey = rawDate.split("T")[0];
        if (periodFilter === "this_month" && !dateKey.startsWith(curMonthStr)) return false;
        if (periodFilter === "last_month" && !dateKey.startsWith(lastMonthStr)) return false;
        if (periodFilter === "90d" && dateKey) {
          const parsed = parseLocalDate(dateKey);
          if (parsed < ninetyDaysAgo) return false;
        }

        const amt = Number(tx.amount) || 0;
        const isExpense =
          amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
        const isIncome = !isExpense && (amt > 0 || tx.type === "CREDIT");

        if (typeFilter === "expenses" && !isExpense) return false;
        if (typeFilter === "incomes" && !isIncome) return false;

        if (categoryFilter !== "all") {
          const c = tx.category_pt || tx.category || "";
          if (c !== categoryFilter) return false;
        }

        if (bankFilter !== "all") {
          const b =
            tx.bank_accounts?.institution_name || tx.bank_accounts?.bank_name || "";
          if (b !== bankFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "amount") {
          cmp = Math.abs(Number(a.amount) || 0) - Math.abs(Number(b.amount) || 0);
        } else if (sortField === "description") {
          const dA = a.clean_description || a.description || "";
          const dB = b.clean_description || b.description || "";
          cmp = dA.localeCompare(dB, "pt-BR");
        } else if (sortField === "category") {
          const cA = a.category_pt || a.category || "";
          const cB = b.category_pt || b.category || "";
          cmp = cA.localeCompare(cB, "pt-BR");
        } else {
          const dtA = (a.date || a.executed_at || "").split("T")[0];
          const dtB = (b.date || b.executed_at || "").split("T")[0];
          cmp = dtA.localeCompare(dtB);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [
    allTxns,
    searchTerm,
    periodFilter,
    typeFilter,
    categoryFilter,
    bankFilter,
    showHidden,
    sortField,
    sortDir,
  ]);

  // Métricas determinísticas do recorte filtrado
  const { totalCount, totalExpenses, totalIncomes, netBalance } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    filteredList.forEach((t) => {
      if (t.is_internal_transfer) return;
      const amt = Number(t.amount) || 0;
      const isExp = amt < 0 || t.type === "DEBIT" || t.operation_type === "CREDIT_CARD";
      const isInc = !isExp && (amt > 0 || t.type === "CREDIT");
      if (isInc) inc += Math.abs(amt);
      else if (isExp) exp += Math.abs(amt);
    });
    return {
      totalCount: filteredList.length,
      totalExpenses: exp,
      totalIncomes: inc,
      netBalance: inc - exp,
    };
  }, [filteredList]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (validPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, validPage, itemsPerPage]);

  // Agrupamento diário para visualização compacta Mobile estilo Wealthfolio ActivityTableMobile
  const mobileDayGroups = useMemo(() => {
    const groups = new Map<
      string,
      { dateKey: string; label: string; dayTotalExpense: number; items: TransactionRowInput[] }
    >();

    for (const tx of paginatedItems) {
      const rawDate = (tx.date || tx.executed_at || "").split("T")[0] || "sem-data";
      const amt = Math.abs(Number(tx.amount) || 0);
      const isExp =
        Number(tx.amount) < 0 ||
        tx.type === "DEBIT" ||
        tx.operation_type === "CREDIT_CARD";

      let group = groups.get(rawDate);
      if (!group) {
        const label =
          rawDate === "sem-data"
            ? "Sem Data"
            : parseLocalDate(rawDate).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
        group = { dateKey: rawDate, label, dayTotalExpense: 0, items: [] };
        groups.set(rawDate, group);
      }
      if (isExp && !tx.is_internal_transfer) {
        group.dayTotalExpense += amt;
      }
      group.items.push(tx);
    }

    return Array.from(groups.values());
  }, [paginatedItems]);

  const renderSortButton = (label: string, field: TxSortField, right = false) => {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer ${
          right ? "justify-end ml-auto" : "justify-start"
        } ${
          active
            ? "text-[#FF8216]"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
        }`}
      >
        <span>{label}</span>
        <WfIcons.ArrowUpDown size={12} className={active ? "opacity-100" : "opacity-45"} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full select-none">
      {/* 4 KPIs Densos Estilo Wealthfolio ValueStrip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="px-4 py-3.5 rounded-xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400 block">
            Atividades
          </span>
          <span className="text-lg md:text-xl font-bold text-zinc-900 dark:text-[#F4F4F5] tabular-nums mt-0.5 block">
            {totalCount}
          </span>
        </div>

        <div className="px-4 py-3.5 rounded-xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400 block">
            Entradas Reais
          </span>
          <span className="text-lg md:text-xl font-bold text-emerald-500 tabular-nums mt-0.5 block">
            {formatCurrency(totalIncomes)}
          </span>
        </div>

        <div className="px-4 py-3.5 rounded-xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400 block">
            Saídas Reais
          </span>
          <span className="text-lg md:text-xl font-bold text-rose-400 tabular-nums mt-0.5 block">
            -{formatCurrency(totalExpenses)}
          </span>
        </div>

        <div className="px-4 py-3.5 rounded-xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400 block">
            Resultado Líquido
          </span>
          <span
            className={`text-lg md:text-xl font-bold tabular-nums mt-0.5 block ${
              netBalance >= 0 ? "text-emerald-500" : "text-rose-400"
            }`}
          >
            {netBalance >= 0
              ? `+${formatCurrency(netBalance)}`
              : `-${formatCurrency(Math.abs(netBalance))}`}
          </span>
        </div>
      </div>

      {/* Container Principal de Filtros + Tabela */}
      <div className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden">
        {/* Barra Superior de Busca, Período e Ações */}
        <div className="p-4 md:px-5 border-b border-zinc-100 dark:border-[#27272A] flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full lg:w-80">
              <WfIcons.Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar estabelecimento, categoria ou descrição..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-[#F4F4F5] placeholder:text-zinc-500 focus:outline-none focus:border-[#FF8216]"
              />
            </div>

            {/* Right Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Period Segmented Pills */}
              <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] p-0.5">
                {(
                  [
                    { id: "this_month", label: "Mês Atual" },
                    { id: "last_month", label: "Anterior" },
                    { id: "90d", label: "90D" },
                    { id: "all", label: "Tudo" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPeriodFilter(p.id);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      periodFilter === p.id
                        ? "bg-[#FF8216] text-black"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsNewTxModalOpen(true)}
                className="h-8 px-3 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-black text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <WfIcons.Plus size={14} />
                <span>Nova</span>
              </button>
            </div>
          </div>

          {/* Segunda linha de filtros: Tipo, Categoria, Instituição, Ocultos, Motor 60FPS */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tipo */}
              <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] p-0.5 text-[11px]">
                {(
                  [
                    { id: "all", label: "Todos" },
                    { id: "expenses", label: "Saídas" },
                    { id: "incomes", label: "Entradas" },
                  ] as const
                ).map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => {
                      setTypeFilter(tp.id);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      typeFilter === tp.id
                        ? "bg-white dark:bg-[#27272A] text-zinc-900 dark:text-[#F4F4F5]"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
                    }`}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>

              {/* Categoria */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-[#FF8216] cursor-pointer"
              >
                <option value="all">Todas Categorias</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Instituição */}
              {uniqueBanks.length > 0 && (
                <select
                  value={bankFilter}
                  onChange={(e) => {
                    setBankFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-[#FF8216] cursor-pointer"
                >
                  <option value="all">Todas Contas</option>
                  {uniqueBanks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHidden((prev) => !prev)}
                className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                  showHidden
                    ? "bg-[#FF8216]/12 border-[#FF8216]/35 text-[#FF8216]"
                    : "bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {showHidden ? "Ocultar Internas" : "Ver Transferências"}
              </button>
            </div>
          </div>
        </div>

        {/* Corpo da Tabela */}
        {renderEngine === "virtualized" ? (
          <VirtualizedTransactionsList
            transactions={filteredList as any}
            isPrivacyMode={isPrivacyMode}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            viewportHeight={560}
          />
        ) : paginatedItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Nenhuma transação encontrada neste período ou filtro.
          </div>
        ) : (
          <>
            {/* ===============================================================
                DESKTOP TABLE (>= 768px) — Fiel ao Wealthfolio ActivityTable
               =============================================================== */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-[#27272A] bg-zinc-50/60 dark:bg-[#18181B]/45">
                    <th className="py-3 pl-5 pr-3">{renderSortButton("Data", "date")}</th>
                    <th className="py-3 px-3">
                      {renderSortButton("Estabelecimento / Descrição", "description")}
                    </th>
                    <th className="py-3 px-3">{renderSortButton("Categoria", "category")}</th>
                    <th className="py-3 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                      Conta
                    </th>
                    <th className="py-3 pl-3 pr-5 text-right">
                      {renderSortButton("Valor", "amount", true)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-[#27272A]">
                  {paginatedItems.map((tx) => {
                    const amt = Number(tx.amount) || 0;
                    const isExpense =
                      amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
                    const isIncome = !isExpense && (amt > 0 || tx.type === "CREDIT");
                    const absAmt = Math.abs(amt);
                    const cleanDesc =
                      tx.clean_description || tx.description || "Movimentação";
                    const cat = tx.category_pt || tx.category || "Outros";
                    const bankName =
                      tx.bank_accounts?.institution_name ||
                      tx.bank_accounts?.bank_name ||
                      "Conta";
                    const bankSlug = tx.bank_accounts?.institution_slug || bankName;

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTxForDetail(tx)}
                        className="hover:bg-zinc-50/80 dark:hover:bg-[#18181B]/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3 pl-5 pr-3 whitespace-nowrap font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {formatDate(tx.date || tx.executed_at)}
                        </td>

                        <td className="py-3 px-3 max-w-[290px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <MerchantLogo cleanName={cleanDesc} category={cat} size="sm" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] block truncate">
                                {cleanDesc}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {tx.total_installments && tx.total_installments > 1 && (
                                  <span className="text-[10px] font-semibold text-[#FF8216]">
                                    Parcela {tx.installment_number || 1}/{tx.total_installments}
                                  </span>
                                )}
                                {tx.is_internal_transfer && (
                                  <span className="text-[10px] text-zinc-500">
                                    Movimentação Interna
                                  </span>
                                )}
                                {tx.is_refund && (
                                  <span className="text-[10px] font-semibold text-emerald-500">
                                    Estorno
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300">
                            {cat}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <BankLogo bank={bankSlug} size="xs" />
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[130px]">
                              {bankName}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap tabular-nums">
                          <span
                            className={`text-xs font-bold ${
                              tx.is_refund || isIncome
                                ? "text-emerald-500"
                                : tx.is_internal_transfer
                                  ? "text-zinc-400"
                                  : "text-zinc-900 dark:text-[#F4F4F5]"
                            }`}
                          >
                            {tx.is_refund || isIncome ? "+" : "-"}
                            {formatCurrency(absAmt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===============================================================
                MOBILE GROUPED COMPACT LIST (< 768px) — Wealthfolio ActivityTableMobile
               =============================================================== */}
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-[#27272A]">
              {mobileDayGroups.map((group) => (
                <div key={group.dateKey}>
                  <div className="px-4 py-2 bg-zinc-50 dark:bg-[#18181B]/65 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                    <span>{group.label}</span>
                    {group.dayTotalExpense > 0 && (
                      <span className="tabular-nums">
                        Saídas: -{formatCurrency(group.dayTotalExpense)}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-[#27272A]/60">
                    {group.items.map((tx) => {
                      const amt = Number(tx.amount) || 0;
                      const isExpense =
                        amt < 0 ||
                        tx.type === "DEBIT" ||
                        tx.operation_type === "CREDIT_CARD";
                      const isIncome = !isExpense && (amt > 0 || tx.type === "CREDIT");
                      const absAmt = Math.abs(amt);
                      const cleanDesc =
                        tx.clean_description || tx.description || "Movimentação";
                      const cat = tx.category_pt || tx.category || "Outros";
                      const bankName =
                        tx.bank_accounts?.institution_name ||
                        tx.bank_accounts?.bank_name ||
                        "Conta";
                      const shareOfExpensesPct =
                        isExpense && totalExpenses > 0
                          ? (absAmt / totalExpenses) * 100
                          : 0;

                      return (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTxForDetail(tx)}
                          className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <MerchantLogo cleanName={cleanDesc} category={cat} size="sm" />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] block truncate">
                                {cleanDesc}
                              </span>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                                {bankName} • {cat}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0 tabular-nums">
                            <span
                              className={`text-xs font-bold ${
                                tx.is_refund || isIncome
                                  ? "text-emerald-500"
                                  : tx.is_internal_transfer
                                    ? "text-zinc-400"
                                    : "text-zinc-900 dark:text-[#F4F4F5]"
                              }`}
                            >
                              {tx.is_refund || isIncome ? "+" : "-"}
                              {formatCurrency(absAmt)}
                            </span>
                            {tx.total_installments && tx.total_installments > 1 ? (
                              <span className="mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FF8216]/12 text-[#FF8216]">
                                {tx.installment_number || 1}/{tx.total_installments}x
                              </span>
                            ) : isExpense && shareOfExpensesPct > 0 ? (
                              <span className="mt-0.5 text-[10px] text-zinc-500">
                                {isPrivacyMode
                                  ? "••%"
                                  : `${shareOfExpensesPct.toFixed(1).replace(".", ",")}% período`}
                              </span>
                            ) : (
                              <span className="mt-0.5 text-[10px] text-emerald-500/80">
                                Crédito
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Paginação Fluida */}
            <div className="px-4 md:px-5 py-3 border-t border-zinc-100 dark:border-[#27272A] bg-zinc-50/40 dark:bg-[#18181B]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span>Por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 px-2 rounded-md bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#FF8216] cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
                <span className="tabular-nums">
                  {(validPage - 1) * itemsPerPage + 1}–
                  {Math.min(validPage * itemsPerPage, filteredList.length)} de{" "}
                  {filteredList.length}
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={validPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 h-7 rounded-md border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer text-xs font-medium"
                  >
                    Ant
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                    const pNum =
                      totalPages <= 5
                        ? idx + 1
                        : Math.min(Math.max(1, validPage - 2) + idx, totalPages);
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setCurrentPage(pNum)}
                        className={`w-7 h-7 rounded-md text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                          pNum === validPage
                            ? "bg-[#FF8216] text-black"
                            : "border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={validPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 h-7 rounded-md border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer text-xs font-medium"
                  >
                    Próx
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de Nova Transação Manual */}
      {isNewTxModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setIsNewTxModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#121214] border border-[#27272A] rounded-2xl p-6 shadow-2xl relative text-[#F4F4F5]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsNewTxModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#18181B] text-zinc-400 hover:text-white cursor-pointer"
            >
              <WfIcons.Close size={16} />
            </button>

            <h3 className="text-sm font-bold mb-4">Registrar Transação Manual</h3>

            <form onSubmit={handleAddManualTx} className="flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTxType("DEBIT")}
                  className={`py-2 rounded-lg font-bold cursor-pointer transition-colors ${
                    newTxType === "DEBIT"
                      ? "bg-rose-500 text-white"
                      : "bg-[#18181B] border border-[#27272A] text-zinc-400"
                  }`}
                >
                  Saída (-)
                </button>
                <button
                  type="button"
                  onClick={() => setNewTxType("CREDIT")}
                  className={`py-2 rounded-lg font-bold cursor-pointer transition-colors ${
                    newTxType === "CREDIT"
                      ? "bg-emerald-500 text-black"
                      : "bg-[#18181B] border border-[#27272A] text-zinc-400"
                  }`}
                >
                  Entrada (+)
                </button>
              </div>

              <div>
                <label className="text-zinc-400 font-semibold block mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Supermercado, Dividendos, Aluguel..."
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-[#F4F4F5] focus:outline-none focus:border-[#FF8216]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-[#F4F4F5] tabular-nums font-bold focus:outline-none focus:border-[#FF8216]"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Data</label>
                  <input
                    type="date"
                    value={newTxDate}
                    onChange={(e) => setNewTxDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-[#F4F4F5] focus:outline-none focus:border-[#FF8216]"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-semibold block mb-1">Categoria</label>
                <select
                  value={newTxCategory}
                  onChange={(e) => setNewTxCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-[#F4F4F5] focus:outline-none focus:border-[#FF8216] cursor-pointer"
                >
                  <option value="Alimentação">Alimentação</option>
                  <option value="Compras">Compras</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Saúde e bem-estar">Saúde e bem-estar</option>
                  <option value="Serviços digitais">Serviços digitais</option>
                  <option value="Rendimentos">Rendimentos / Proventos</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-1 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-black font-bold text-xs cursor-pointer transition-colors"
              >
                Salvar Transação
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Transação Inspirado na Carteira da Apple */}
      <TransactionDetailModal
        isOpen={Boolean(selectedTxForDetail)}
        onClose={() => setSelectedTxForDetail(null)}
        transaction={selectedTxForDetail}
        allTransactions={allTxns}
        formatCurrency={formatCurrency}
        isPrivacyMode={isPrivacyMode}
      />
    </div>
  );
}
