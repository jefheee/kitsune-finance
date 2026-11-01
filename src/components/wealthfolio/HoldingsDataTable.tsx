"use client";

import React, { useMemo, useState } from "react";
import { BankLogo } from "@/components/BankLogo";
import { parseLocalDate } from "@/utils/finance/reconciler";
import { WfIcons } from "./WealthfolioIcons";

export type AssetClassKey =
  | "all"
  | "fixed_income"
  | "treasury"
  | "funds"
  | "equities"
  | "cash";

type SortColumn = "name" | "institution" | "cost" | "profit" | "balance" | "weight";
type SortDirection = "asc" | "desc";

export interface NormalizedHoldingRow {
  id: string;
  name: string;
  institutionName: string;
  institutionSlug: string;
  issuerName: string | null;
  assetClass: Exclude<AssetClassKey, "all">;
  assetClassLabel: string;
  rateLabel: string;
  dueDateLabel: string | null;
  principal: number;
  profit: number;
  profitPct: number;
  balance: number;
  weightPct: number;
  isRedeemed: boolean;
}

interface HoldingsDataTableProps {
  investments: any[];
  accounts?: any[];
  includeCashAccounts?: boolean;
  formatCurrency: (val: number) => string;
  hideValues: boolean;
  annualCDIPct?: number;
}

function classifyAsset(inv: any): {
  key: Exclude<AssetClassKey, "all">;
  label: string;
} {
  const name = String(inv.name || "").toLowerCase();
  const type = String(inv.type || "").toLowerCase();
  const subtype = String(inv.subtype || "").toLowerCase();

  if (name.includes("tesouro") || type.includes("treasury")) {
    return { key: "treasury", label: "Tesouro Direto" };
  }
  if (
    name.includes("fii") ||
    name.includes("ação") ||
    name.includes("acao") ||
    type.includes("equity") ||
    type.includes("stock") ||
    subtype.includes("real_estate")
  ) {
    return { key: "equities", label: "Renda Variável" };
  }
  if (name.includes("fundo") || type.includes("fund") || type.includes("mutual")) {
    return { key: "funds", label: "Fundos" };
  }
  return { key: "fixed_income", label: "Renda Fixa" };
}

export function HoldingsDataTable({
  investments,
  accounts = [],
  includeCashAccounts = true,
  formatCurrency,
  hideValues,
  annualCDIPct = 10.65,
}: HoldingsDataTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState<AssetClassKey>("all");
  const [showRedeemed, setShowRedeemed] = useState(false);
  const [sortCol, setSortCol] = useState<SortColumn>("balance");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" || col === "institution" ? "asc" : "desc");
    }
    setPage(1);
  };

  // Normaliza títulos + contas correntes/poupança (opcional) em linhas homogêneas de alta densidade
  const allRows = useMemo<NormalizedHoldingRow[]>(() => {
    const rawItems: Omit<NormalizedHoldingRow, "weightPct">[] = [];

    for (const inv of investments) {
      const bal = Number(inv.balance) || 0;
      const isRedeemed = bal <= 0.05 || inv.status === "TOTAL_WITHDRAWAL";
      const cls = classifyAsset(inv);
      const instName = inv.institution_name || inv.bank_name || "Custódia";
      const slug = inv.institution_slug || instName;
      const issuer =
        inv.issuer &&
        String(inv.issuer).trim().length > 1 &&
        String(inv.issuer).trim().toLowerCase() !== instName.trim().toLowerCase()
          ? String(inv.issuer).trim()
          : null;

      const orig = Number(inv.amount_original) || 0;
      const explicitProfit = Number(inv.amount_profit) || 0;

      let profit = explicitProfit;
      let principal = orig > 0 ? orig : Math.max(0, bal - explicitProfit);

      if (profit === 0 && orig > 0 && bal > orig) {
        profit = bal - orig;
      } else if (profit === 0 && !isRedeemed && bal > 0) {
        // Estimativa conservadora de rendimento pro-rata semestral caso o banco não reporte amount_profit
        const estRate = (annualCDIPct / 100) * 0.5;
        principal = bal / (1 + estRate);
        profit = bal - principal;
      }

      const profitPct = principal > 0.01 ? (profit / principal) * 100 : 0;

      const rateLabel = inv.rate
        ? `${inv.rate}% ${inv.rate_type || "CDI"}`
        : inv.annual_rate
          ? `${inv.annual_rate}% a.a.`
          : cls.key === "treasury"
            ? "Selic / IPCA+"
            : "100% CDI ref.";

      const dueDateLabel = inv.due_date
        ? parseLocalDate(inv.due_date).toLocaleDateString("pt-BR")
        : null;

      rawItems.push({
        id: `inv-${inv.id}`,
        name: inv.name || inv.code || "Título Financeiro",
        institutionName: instName,
        institutionSlug: slug,
        issuerName: issuer,
        assetClass: cls.key,
        assetClassLabel: cls.label,
        rateLabel,
        dueDateLabel,
        principal,
        profit,
        profitPct,
        balance: bal,
        isRedeemed,
      });
    }

    if (includeCashAccounts) {
      for (const acc of accounts) {
        const isCredit =
          acc.type === "CREDIT" ||
          acc.type === "CREDIT_CARD" ||
          acc.subtype === "CREDIT_CARD";
        if (isCredit) continue;

        const bal = Number(acc.balance) || 0;
        if (bal <= 0.01 && !showRedeemed) continue;

        const instName = acc.institution_name || acc.bank_name || "Banco";
        const slug = acc.institution_slug || instName;
        const isSavings = acc.subtype === "SAVINGS_ACCOUNT" || acc.type === "SAVINGS";

        rawItems.push({
          id: `cash-${acc.id}`,
          name: acc.product_name || (isSavings ? "Conta Poupança" : "Saldo em Conta"),
          institutionName: instName,
          institutionSlug: slug,
          issuerName: null,
          assetClass: "cash",
          assetClassLabel: "Liquidez",
          rateLabel: isSavings ? "TR + 0,5% a.m." : "Liquidez Imediata",
          dueDateLabel: null,
          principal: bal,
          profit: 0,
          profitPct: 0,
          balance: bal,
          isRedeemed: bal <= 0.01,
        });
      }
    }

    const totalActiveValue = rawItems
      .filter((r) => !r.isRedeemed && r.balance > 0)
      .reduce((s, r) => s + r.balance, 0);

    return rawItems.map((r) => ({
      ...r,
      weightPct:
        !r.isRedeemed && totalActiveValue > 0 ? (r.balance / totalActiveValue) * 100 : 0,
    }));
  }, [investments, accounts, includeCashAccounts, showRedeemed, annualCDIPct]);

  const redeemedCount = useMemo(
    () => allRows.filter((r) => r.isRedeemed).length,
    [allRows]
  );

  // Filtro + Ordenação
  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = allRows.filter((row) => {
      if (!showRedeemed && row.isRedeemed) return false;
      if (classFilter !== "all" && row.assetClass !== classFilter) return false;
      if (q) {
        const hay = `${row.name} ${row.institutionName} ${row.issuerName || ""} ${row.assetClassLabel} ${row.rateLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name, "pt-BR");
      else if (sortCol === "institution")
        cmp = a.institutionName.localeCompare(b.institutionName, "pt-BR");
      else if (sortCol === "cost") cmp = a.principal - b.principal;
      else if (sortCol === "profit") cmp = a.profit - b.profit;
      else if (sortCol === "weight") cmp = a.weightPct - b.weightPct;
      else cmp = a.balance - b.balance;

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allRows, searchQuery, classFilter, showRedeemed, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const classTabs: Array<{ id: AssetClassKey; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "fixed_income", label: "Renda Fixa" },
    { id: "treasury", label: "Tesouro" },
    { id: "funds", label: "Fundos" },
    { id: "equities", label: "Ações & FIIs" },
    ...(includeCashAccounts ? [{ id: "cash" as const, label: "Liquidez" }] : []),
  ];

  const renderSortHeader = (label: string, col: SortColumn, alignRight = false) => {
    const isActive = sortCol === col;
    return (
      <button
        type="button"
        onClick={() => handleSort(col)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.1em] text-[10px] transition-colors cursor-pointer ${
          alignRight ? "justify-end ml-auto" : "justify-start"
        } ${
          isActive
            ? "text-[#FF8216]"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
        }`}
      >
        <span>{label}</span>
        <WfIcons.ArrowUpDown size={12} className={isActive ? "opacity-100" : "opacity-45"} />
      </button>
    );
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden">
      {/* Toolbar: Search + Class Filter Pills + Redeemed Toggle */}
      <div className="p-4 md:px-5 border-b border-zinc-100 dark:border-[#27272A] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <WfIcons.Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrar ativo, emissor ou banco..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-[#F4F4F5] placeholder:text-zinc-500 focus:outline-none focus:border-[#FF8216]"
            />
          </div>

          {/* Actions Right */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {redeemedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowRedeemed((prev) => !prev);
                  setPage(1);
                }}
                className={`h-8 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  showRedeemed
                    ? "bg-[#FF8216]/12 border-[#FF8216]/35 text-[#FF8216]"
                    : "bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {showRedeemed
                  ? "Ocultar Resgatados"
                  : `Resgatados (${redeemedCount})`}
              </button>
            )}

            <a
              href="/api/export/spreadsheet"
              download
              title="Exportar planilha consolidada"
              className="h-8 px-3 rounded-lg bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] hover:border-[#FF8216]/40 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors"
            >
              <WfIcons.Download size={13} className="text-[#FF8216]" />
              <span className="hidden sm:inline">CSV</span>
            </a>
          </div>
        </div>

        {/* Asset Class Segmented Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {classTabs.map((tab) => {
            const active = classFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setClassFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-[#FF8216] text-black"
                    : "bg-zinc-100 dark:bg-[#18181B] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {pagedRows.length === 0 ? (
        <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Nenhuma posição encontrada para os filtros selecionados.
        </div>
      ) : (
        <>
          {/* =================================================================
              DESKTOP DATA TABLE (>= 768px) — Fiel ao Wealthfolio HoldingsTable
             ================================================================= */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-[#27272A] bg-zinc-50/60 dark:bg-[#18181B]/45">
                  <th className="py-3 pl-5 pr-3">{renderSortHeader("Ativo / Emissor", "name")}</th>
                  <th className="py-3 px-3">{renderSortHeader("Custódia", "institution")}</th>
                  <th className="py-3 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                    Indexador
                  </th>
                  <th className="py-3 px-3 text-right">
                    {renderSortHeader("Principal", "cost", true)}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {renderSortHeader("Rendimento", "profit", true)}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {renderSortHeader("Valor Atual", "balance", true)}
                  </th>
                  <th className="py-3 pl-3 pr-5 text-right">
                    {renderSortHeader("Peso %", "weight", true)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#27272A]">
                {pagedRows.map((row) => {
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-zinc-50/80 dark:hover:bg-[#18181B]/60 ${
                        row.isRedeemed ? "opacity-55" : ""
                      }`}
                    >
                      {/* Ativo */}
                      <td className="py-3 pl-5 pr-3 max-w-[260px]">
                        <div className="flex items-center gap-3 min-w-0">
                          <BankLogo bank={row.institutionSlug} size="xs" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                                {row.name}
                              </span>
                              {row.isRedeemed && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-200 dark:bg-[#27272A] text-zinc-500">
                                  Liquidado
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                              {row.assetClassLabel}
                              {row.issuerName ? ` • Emissor: ${row.issuerName}` : ""}
                              {row.dueDateLabel ? ` • Venc. ${row.dueDateLabel}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Custódia */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                          {row.institutionName}
                        </span>
                      </td>

                      {/* Indexador */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300">
                          {row.rateLabel}
                        </span>
                      </td>

                      {/* Principal */}
                      <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums text-xs text-zinc-600 dark:text-zinc-400">
                        {formatCurrency(row.principal)}
                      </td>

                      {/* Rendimento */}
                      <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">
                        {row.assetClass === "cash" || row.isRedeemed ? (
                          <span className="text-xs text-zinc-500">—</span>
                        ) : (
                          <div className="inline-flex flex-col items-end">
                            <span
                              className={`text-xs font-semibold ${
                                row.profit >= 0 ? "text-emerald-500" : "text-rose-400"
                              }`}
                            >
                              {row.profit >= 0 ? "+" : "-"}
                              {formatCurrency(Math.abs(row.profit))}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                row.profitPct >= 0 ? "text-emerald-500/80" : "text-rose-400/80"
                              }`}
                            >
                              {hideValues
                                ? "••%"
                                : `${row.profitPct >= 0 ? "+" : ""}${row.profitPct.toFixed(2).replace(".", ",")}%`}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Valor Atual */}
                      <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">
                        <span className="text-xs font-bold text-zinc-900 dark:text-[#F4F4F5]">
                          {formatCurrency(row.balance)}
                        </span>
                      </td>

                      {/* Peso % */}
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap tabular-nums">
                        <div className="inline-flex items-center justify-end gap-2 min-w-[78px]">
                          <div className="w-10 h-1.5 rounded-full bg-zinc-200 dark:bg-[#27272A] overflow-hidden hidden lg:block">
                            <div
                              style={{ width: `${Math.min(100, row.weightPct)}%` }}
                              className="h-full bg-[#FF8216]"
                            />
                          </div>
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {hideValues
                              ? "••%"
                              : `${row.weightPct.toFixed(1).replace(".", ",")}%`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* =================================================================
              MOBILE COMPACT STACKED LIST (< 768px) — Fiel ao Wealthfolio Mobile
              Valor principal em cima e variação percentual empilhada abaixo
             ================================================================= */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-[#27272A]">
            {pagedRows.map((row) => (
              <div
                key={row.id}
                className={`px-4 py-3.5 flex items-center justify-between gap-3 ${
                  row.isRedeemed ? "opacity-55" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <BankLogo bank={row.institutionSlug} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] block truncate">
                      {row.name}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                      {row.institutionName} • {row.rateLabel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 tabular-nums">
                  <span className="text-xs font-bold text-zinc-900 dark:text-[#F4F4F5]">
                    {formatCurrency(row.balance)}
                  </span>
                  {row.assetClass === "cash" ? (
                    <span className="mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-[#18181B] text-zinc-400">
                      {hideValues
                        ? "••%"
                        : `${row.weightPct.toFixed(1).replace(".", ",")}% carteira`}
                    </span>
                  ) : (
                    <span
                      className={`mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        row.profitPct >= 0
                          ? "bg-emerald-500/12 text-emerald-400"
                          : "bg-rose-500/12 text-rose-400"
                      }`}
                    >
                      {hideValues
                        ? "•••%"
                        : `${row.profitPct >= 0 ? "+" : ""}${row.profitPct.toFixed(2).replace(".", ",")}%`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Fluid Pagination Footer */}
          <div className="px-4 md:px-5 py-3 border-t border-zinc-100 dark:border-[#27272A] bg-zinc-50/40 dark:bg-[#18181B]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span>Linhas:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-2 rounded-md bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#FF8216] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="tabular-nums">
                {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredAndSorted.length)} de{" "}
                {filteredAndSorted.length}
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 h-7 rounded-md border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-xs font-medium"
                >
                  Ant
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                  const pNum =
                    totalPages <= 5
                      ? idx + 1
                      : Math.min(
                          Math.max(1, safePage - 2) + idx,
                          totalPages
                        );
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded-md text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        pNum === safePage
                          ? "bg-[#FF8216] text-black"
                          : "border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] text-zinc-600 dark:text-zinc-300 hover:border-[#FF8216]/40"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 h-7 rounded-md border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-xs font-medium"
                >
                  Próx
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
