"use client";

import React, { useState, useMemo } from "react";
import { MerchantLogo } from "@/components/MerchantLogo";
import { BankLogo } from "@/components/BankLogo";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";

interface TransactionLike {
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
  bank_accounts?: {
    bank_name?: string;
    institution_name?: string;
    institution_slug?: string;
    product_name?: string;
  };
}

interface PaginatedTransactionsViewProps {
  transactions: TransactionLike[];
  accounts: any[];
  formatCurrency: (val: number) => string;
  formatDate: (val?: string | null) => string;
}

export function PaginatedTransactionsView({
  transactions,
  accounts,
  formatCurrency,
  formatDate,
}: PaginatedTransactionsViewProps) {
  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"this_month" | "last_month" | "all">("this_month");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "expenses" | "incomes">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "amount_desc" | "amount_asc">("date_desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(false);

  // Estados de Paginação ("1, 2, 3...")
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal de Nova Transação
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [newTxDesc, setNewTxDesc] = useState("");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [newTxCategory, setNewTxCategory] = useState("Compras");
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [localManualTxns, setLocalManualTxns] = useState<any[]>([]);

  const handleAddManualTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmount.replace(",", "."));
    if (!newTxDesc || isNaN(amt) || amt <= 0) return;

    const newTx = {
      id: `manual_${Date.now()}`,
      clean_description: newTxDesc,
      description: newTxDesc,
      amount: newTxType === "DEBIT" ? amt : -amt,
      type: newTxType,
      category_pt: newTxCategory,
      date: newTxDate,
      bank_accounts: {
        bank_name: "Carteira Kitsune",
        institution_name: "Carteira Kitsune",
        institution_slug: "generic",
        product_name: "Manual",
      },
    };

    setLocalManualTxns((prev) => [newTx, ...prev]);
    setIsNewTxModalOpen(false);
    setNewTxDesc("");
    setNewTxAmount("");
  };

  const allTxns = useMemo(() => {
    return [...localManualTxns, ...transactions];
  }, [localManualTxns, transactions]);

  // Lista única de categorias para o dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    allTxns.forEach((t) => {
      const c = t.category_pt || t.category;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [allTxns]);

  // Filtragem
  const filteredList = useMemo(() => {
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

    return allTxns
      .filter((tx) => {
        if (!showHidden && tx.is_internal_transfer) return false;

        // Filtro de Busca
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const desc = (tx.clean_description || tx.description || "").toLowerCase();
          const cat = (tx.category_pt || tx.category || "").toLowerCase();
          if (!desc.includes(q) && !cat.includes(q)) return false;
        }

        // Filtro de Período
        const txDate = tx.date || tx.executed_at || "";
        if (periodFilter === "this_month" && !txDate.startsWith(curMonthStr)) return false;
        if (periodFilter === "last_month" && !txDate.startsWith(lastMonthStr)) return false;

        // Filtro de Tipo
        const amt = Number(tx.amount) || 0;
        const isExpense = amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
        const isIncome = !isExpense && (amt > 0 || tx.type === "CREDIT");
        if (typeFilter === "expenses" && !isExpense) return false;
        if (typeFilter === "incomes" && !isIncome) return false;

        // Filtro de Categoria
        if (categoryFilter !== "all") {
          const c = tx.category_pt || tx.category || "";
          if (c !== categoryFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "amount_desc") {
          return Math.abs(Number(b.amount) || 0) - Math.abs(Number(a.amount) || 0);
        }
        if (sortBy === "amount_asc") {
          return Math.abs(Number(a.amount) || 0) - Math.abs(Number(b.amount) || 0);
        }
        // date_desc
        const dateA = a.date || a.executed_at || "";
        const dateB = b.date || b.executed_at || "";
        return dateB.localeCompare(dateA);
      });
  }, [
    allTxns,
    searchTerm,
    periodFilter,
    typeFilter,
    categoryFilter,
    sortBy,
    showHidden,
  ]);

  // Cálculos dos 4 Cards de Métricas
  const { totalCount, totalExpenses, totalIncomes, netBalance } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    filteredList.forEach((t) => {
      if (t.is_internal_transfer) return;
      const amt = Number(t.amount) || 0;
      const isExp = amt < 0 || t.type === "DEBIT" || t.operation_type === "CREDIT_CARD";
      const isInc = !isExp && (amt > 0 || t.type === "CREDIT");
      if (isInc) {
        inc += Math.abs(amt);
      } else if (isExp) {
        exp += Math.abs(amt);
      }
    });

    return {
      totalCount: filteredList.length,
      totalExpenses: exp,
      totalIncomes: inc,
      netBalance: inc - exp,
    };
  }, [filteredList]);

  // Paginação ("1, 2, 3...")
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (validPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, validPage, itemsPerPage]);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
  };

  return (
    <div className="flex flex-col gap-5 select-none w-full">
      {/* 4 Cards de Métricas (Fiel ao Pierre Screenshot 014) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <span className="material-symbols-outlined text-[15px]">tag</span>
            <span>Total</span>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
            {totalCount}
          </div>
        </div>

        {/* Despesas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <span className="material-symbols-outlined text-[15px] text-rose-500">
              arrow_downward
            </span>
            <span>Despesas</span>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-rose-500 tabular-nums mt-1">
            {formatCurrency(totalExpenses)}
          </div>
        </div>

        {/* Receitas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <span className="material-symbols-outlined text-[15px] text-emerald-500">
              arrow_upward
            </span>
            <span>Receitas</span>
          </div>
          <div className="text-xl md:text-2xl font-extrabold text-emerald-500 tabular-nums mt-1">
            {formatCurrency(totalIncomes)}
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <span className="material-symbols-outlined text-[15px] text-[#FF8216]">
              sync_alt
            </span>
            <span>Saldo Líquido</span>
          </div>
          <div
            className={`text-xl md:text-2xl font-extrabold tabular-nums mt-1 ${
              netBalance >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {formatCurrency(netBalance)}
          </div>
        </div>
      </div>

      {/* Barra de Filtros (Fiel ao Pierre Screenshot 014) */}
      <SpotlightCard className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Período */}
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value="this_month">📅 Este mês</option>
              <option value="last_month">📅 Mês anterior</option>
              <option value="all">📅 Todos os períodos</option>
            </select>

            {/* Tipo */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value="all">Todas Transações</option>
              <option value="expenses">Apenas Despesas</option>
              <option value="incomes">Apenas Receitas</option>
            </select>

            {/* Ordenação */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value="date_desc">Data (mais recentes)</option>
              <option value="amount_desc">Maior valor</option>
              <option value="amount_asc">Menor valor</option>
            </select>

            {/* Categorias */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Switch Mostrar Ocultos */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-[#94A3B8] font-medium">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded border-slate-300 dark:border-[#262E3D] text-[#FF8216] focus:ring-0 cursor-pointer"
            />
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            <span>Mostrar ocultos / transferências</span>
          </label>
        </div>

        {/* Linha de Busca & Ação + Nova Transação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#1E2533]">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar transações..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#FF8216]"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-slate-400">
              search
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsNewTxModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer shrink-0 w-full sm:w-auto justify-center"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Nova Transação</span>
          </button>
        </div>
      </SpotlightCard>

      {/* Tabela de Transações */}
      <SpotlightCard className="overflow-hidden">
        {paginatedItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 dark:text-slate-600">
              receipt_long
            </span>
            <span>Nenhuma transação encontrada com os filtros selecionados.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#1F2633] text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-[#0B0E14]/50">
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Conta</th>
                  <th className="py-3 px-3">Data</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F2633]">
                {paginatedItems.map((tx) => {
                  const amt = Number(tx.amount) || 0;
                  const isExpense = amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
                  const isIncome = !isExpense && (amt > 0 || tx.type === "CREDIT");
                  const absAmt = Math.abs(amt);
                  const cleanDesc = tx.clean_description || tx.description || "Transação";
                  const cat = tx.category_pt || tx.category || "Outros";
                  const bankName =
                    tx.bank_accounts?.institution_name ||
                    tx.bank_accounts?.bank_name ||
                    "Conta";
                  const bankSlug = tx.bank_accounts?.institution_slug || bankName;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#161B26]/60 transition-colors"
                    >
                      {/* Descrição */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <MerchantLogo
                            cleanName={cleanDesc}
                            category={cat}
                            size="sm"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {cleanDesc}
                            </span>
                            {tx.total_installments && tx.total_installments > 1 && (
                              <span className="text-[10px] text-amber-500 font-bold">
                                Parcela {tx.installment_number || 1}/{tx.total_installments}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#1E2533] text-slate-700 dark:text-[#CBD5E1]">
                          {cat}
                        </span>
                      </td>

                      {/* Conta */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <BankLogo bank={bankSlug || bankName} size="xs" />
                          <span className="text-slate-600 dark:text-[#94A3B8] text-[11px] font-medium truncate max-w-[120px]">
                            {bankName}
                          </span>
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-3 text-[11px] text-slate-500 dark:text-[#64748B] font-mono whitespace-nowrap">
                        {formatDate(tx.date || tx.executed_at)}
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-extrabold tabular-nums text-xs ${
                            isIncome
                              ? "text-emerald-500"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {isIncome ? "+" : "-"} {formatCurrency(absAmt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé de Paginação ("1, 2, 3..." e "Por página: 10 / 25 / 50") */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-[#1F2633] text-xs text-slate-500 dark:text-[#94A3B8]">
          {/* Seletor Por página */}
          <div className="flex items-center gap-2">
            <span>Por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 px-2 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-[11px] text-slate-400 ml-2">
              Mostrando {(validPage - 1) * itemsPerPage + 1} a{" "}
              {Math.min(validPage * itemsPerPage, filteredList.length)} de{" "}
              {filteredList.length}
            </span>
          </div>

          {/* Botões de Página ("< 1 2 3 ... >") */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => handlePageChange(validPage - 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#1E2533] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
              const p = idx + 1;
              const isCurrent = p === validPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#FF8216] text-white shadow-xs"
                      : "border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#1E2533] text-slate-700 dark:text-[#CBD5E1]"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-slate-400">...</span>
                <button
                  type="button"
                  onClick={() => handlePageChange(totalPages)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#1E2533] text-slate-700 dark:text-[#CBD5E1] cursor-pointer`}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => handlePageChange(validPage + 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#1E2533] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* Modal de Nova Transação */}
      {isNewTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-3xl p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsNewTxModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1A202C] text-slate-400 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF8216]">add_circle</span>
              <span>Registrar Nova Transação</span>
            </h3>

            <form onSubmit={handleAddManualTx} className="flex flex-col gap-4 text-xs">
              {/* Tipo: Despesa ou Receita */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTxType("DEBIT")}
                  className={`py-2 rounded-xl font-bold cursor-pointer transition-all ${
                    newTxType === "DEBIT"
                      ? "bg-rose-500 text-white shadow-md"
                      : "bg-slate-100 dark:bg-[#1A202C] text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Despesa (-)
                </button>
                <button
                  type="button"
                  onClick={() => setNewTxType("CREDIT")}
                  className={`py-2 rounded-xl font-bold cursor-pointer transition-all ${
                    newTxType === "CREDIT"
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 dark:bg-[#1A202C] text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Receita (+)
                </button>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Padaria, Salário, Uber..."
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-slate-900 dark:text-white focus:outline-none focus:border-[#FF8216]"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Valor (R$)</label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-slate-900 dark:text-white tabular-nums font-bold focus:outline-none focus:border-[#FF8216]"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Categoria</label>
                <select
                  value={newTxCategory}
                  onChange={(e) => setNewTxCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-slate-900 dark:text-white focus:outline-none focus:border-[#FF8216] cursor-pointer"
                >
                  <option value="Alimentação">Alimentação</option>
                  <option value="Compras">Compras</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Saúde e bem-estar">Saúde e bem-estar</option>
                  <option value="Serviços digitais">Serviços digitais</option>
                  <option value="Lazer">Lazer</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Data</label>
                <input
                  type="date"
                  value={newTxDate}
                  onChange={(e) => setNewTxDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-slate-900 dark:text-white focus:outline-none focus:border-[#FF8216]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-2 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white font-bold text-xs shadow-lg shadow-[#FF8216]/20 transition-all cursor-pointer"
              >
                Salvar Transação
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
