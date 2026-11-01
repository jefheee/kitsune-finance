"use client";

import React, { useMemo } from "react";
import { useFinanceData } from "@/context/FinanceDataContext";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { BankLogo } from "@/components/BankLogo";
import { TransactionsDataTable } from "@/components/wealthfolio/TransactionsDataTable";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

export default function TransactionsPage() {
  const {
    transactions,
    accounts,
    connections,
    selectedBankSlug,
    setSelectedBankSlug,
    formatSensitiveCurrency,
    revalidate,
    isRevalidating,
  } = useFinanceData();

  const connectedBanks = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>();
    accounts.forEach((acc) => {
      const entry = getBankCatalogBySlugOrName(
        acc.institution_slug || acc.institution_name || acc.bank_name
      );
      const prev = map.get(entry.slug);
      if (prev) prev.count += 1;
      else map.set(entry.slug, { slug: entry.slug, name: entry.shortName, count: 1 });
    });
    connections.forEach((c) => {
      const entry = getBankCatalogBySlugOrName(c.institution_slug || c.institution_name);
      if (entry.slug !== "generic" && !map.has(entry.slug)) {
        map.set(entry.slug, { slug: entry.slug, name: entry.shortName, count: 0 });
      }
    });
    return Array.from(map.values());
  }, [accounts, connections]);

  const filteredAccounts = useMemo(() => {
    if (!selectedBankSlug || selectedBankSlug === "all") return accounts;
    return accounts.filter((a) => {
      const slug = getBankCatalogBySlugOrName(
        a.institution_slug || a.institution_name || a.bank_name
      ).slug;
      return slug === selectedBankSlug;
    });
  }, [accounts, selectedBankSlug]);

  const filteredAccountIds = useMemo(
    () => new Set(filteredAccounts.map((a) => a.id)),
    [filteredAccounts]
  );

  const filteredTransactions = useMemo(() => {
    if (!selectedBankSlug || selectedBankSlug === "all") return transactions;
    return transactions.filter((t) => {
      if (filteredAccountIds.has(t.account_id)) return true;
      const slug = getBankCatalogBySlugOrName(
        t.bank_accounts?.institution_slug ||
          t.bank_accounts?.institution_name ||
          t.bank_accounts?.bank_name
      ).slug;
      return slug === selectedBankSlug;
    });
  }, [transactions, selectedBankSlug, filteredAccountIds]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    const clean = dateString.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <WfIcons.Transactions className="w-5 h-5 text-[#E11D48]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Transações & Atividades Conciliadas
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Extrato multi-banco auditado sem inflação de transferências próprias, com ordenação tabular e busca instantânea.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => revalidate(true)}
            className="h-9 px-3.5 rounded-xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <WfIcons.RefreshCw
              className={`w-3.5 h-3.5 text-emerald-500 ${isRevalidating ? "animate-spin" : ""}`}
            />
            <span>Sincronizar</span>
          </button>

          <a
            href="/api/export/spreadsheet"
            download
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <WfIcons.Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </a>
        </div>
      </header>

      {connectedBanks.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedBankSlug("all")}
            className={`h-8 px-3 rounded-full text-xs font-medium shrink-0 border transition-colors cursor-pointer ${
              selectedBankSlug === "all"
                ? "bg-[#E11D48]/15 border-[#E11D48]/40 text-[#E11D48]"
                : "bg-white dark:bg-[#121214] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Todas ({connectedBanks.length})
          </button>
          {connectedBanks.map((bank) => {
            const active = selectedBankSlug === bank.slug;
            return (
              <button
                key={bank.slug}
                type="button"
                onClick={() => setSelectedBankSlug(active ? "all" : bank.slug)}
                className={`h-8 pl-2 pr-3 rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#E11D48]/15 border-[#E11D48]/40 text-[#E11D48]"
                    : "bg-white dark:bg-[#121214] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <BankLogo bank={bank.slug} size="xs" />
                <span>{bank.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <TransactionsDataTable
        transactions={filteredTransactions}
        accounts={filteredAccounts}
        formatCurrency={formatSensitiveCurrency}
        formatDate={formatDate}
      />
    </div>
  );
}
