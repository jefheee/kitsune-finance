"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { compareTaxExemptVsTaxable } from "@/utils/finance/engine";
import {
  fetchLiveMacroRates,
  formatPercentPtBr,
  getCachedOrFallbackMacroRates,
  type LiveMacroRatesSnapshot,
} from "@/utils/finance/macro-rates";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { BankLogo } from "@/components/BankLogo";
import { HoldingsDataTable } from "@/components/wealthfolio/HoldingsDataTable";
import { AllocationTreemap } from "@/components/wealthfolio/AllocationTreemap";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

export default function InvestmentsPage() {
  const {
    investments,
    accounts,
    transactions,
    connections,
    isPrivacyMode,
    formatSensitiveCurrency,
    selectedBankSlug,
    setSelectedBankSlug,
  } = useFinanceData();

  const [macroSnapshot, setMacroSnapshot] = useState<LiveMacroRatesSnapshot>(() =>
    getCachedOrFallbackMacroRates()
  );
  const [taxCompDays, setTaxCompDays] = useState<number>(360);
  const [cdbRateInput, setCdbRateInput] = useState<number>(100);
  const [lciRateInput, setLciRateInput] = useState<number>(85);

  useEffect(() => {
    let active = true;
    fetchLiveMacroRates().then((live) => {
      if (active) setMacroSnapshot(live);
    });
    return () => {
      active = false;
    };
  }, []);

  const selicFormatted = formatPercentPtBr(macroSnapshot.annualSelicPct);
  const cdiFormatted = formatPercentPtBr(macroSnapshot.annualCDIPct);
  const ipcaFormatted = formatPercentPtBr(macroSnapshot.annualIPCAPct);
  const realInterestFormatted = formatPercentPtBr(macroSnapshot.realInterestAnnualPct);

  const connectedBanks = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; total: number }>();
    accounts.forEach((acc) => {
      const entry = getBankCatalogBySlugOrName(
        acc.institution_slug || acc.institution_name || acc.bank_name
      );
      const bal = acc.type === "CREDIT" || acc.subtype === "CREDIT_CARD" ? 0 : Number(acc.balance) || 0;
      const prev = map.get(entry.slug);
      if (prev) prev.total += bal;
      else map.set(entry.slug, { slug: entry.slug, name: entry.shortName, total: bal });
    });
    investments.forEach((inv) => {
      const entry = getBankCatalogBySlugOrName(inv.institution_name);
      const bal = Number(inv.balance) || 0;
      const prev = map.get(entry.slug);
      if (prev) prev.total += bal;
      else if (entry.slug !== "generic") {
        map.set(entry.slug, { slug: entry.slug, name: entry.shortName, total: bal });
      }
    });
    connections.forEach((c) => {
      const entry = getBankCatalogBySlugOrName(c.institution_slug || c.institution_name);
      if (entry.slug !== "generic" && !map.has(entry.slug)) {
        map.set(entry.slug, { slug: entry.slug, name: entry.shortName, total: 0 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [accounts, investments, connections]);

  const filteredInvestments = useMemo(() => {
    if (!selectedBankSlug || selectedBankSlug === "all") return investments;
    return investments.filter((inv) => {
      const entry = getBankCatalogBySlugOrName(
        inv.institution_slug || inv.institution_name || inv.bank_name
      );
      return entry.slug === selectedBankSlug;
    });
  }, [investments, selectedBankSlug]);

  const filteredAccounts = useMemo(() => {
    if (!selectedBankSlug || selectedBankSlug === "all") return accounts;
    return accounts.filter((acc) => {
      const entry = getBankCatalogBySlugOrName(
        acc.institution_slug || acc.institution_name || acc.bank_name
      );
      return entry.slug === selectedBankSlug;
    });
  }, [accounts, selectedBankSlug]);

  const activeInvestments = useMemo(() => {
    return filteredInvestments.filter(
      (inv) => (Number(inv.balance) || 0) > 0 && inv.status !== "TOTAL_WITHDRAWAL"
    );
  }, [filteredInvestments]);

  const totalInvested = useMemo(() => {
    return activeInvestments.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
  }, [activeInvestments]);

  const liquidCash = useMemo(() => {
    return filteredAccounts
      .filter((a) => a.type !== "CREDIT" && a.subtype !== "CREDIT_CARD")
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [filteredAccounts]);

  const grossPortfolio = liquidCash + totalInvested;

  const { totalProfit, estimatedMonthlyYield } = useMemo(() => {
    let profit = 0;
    let hasBankProfit = false;

    filteredInvestments.forEach((inv) => {
      const p = Number(inv.amount_profit);
      if (!isNaN(p) && p > 0) {
        profit += p;
        hasBankProfit = true;
      } else if (inv.amount_original && Number(inv.amount_original) > 0) {
        const bal = Number(inv.balance) || 0;
        const diff = bal - Number(inv.amount_original);
        if (diff > 0) {
          profit += diff;
          hasBankProfit = true;
        }
      }
    });

    let txnYieldTotal = 0;
    transactions.forEach((t) => {
      const desc = (t.clean_description || t.description || "").toLowerCase();
      const cat = (t.category_pt || t.category || "").toLowerCase();
      if (
        desc.includes("rend") ||
        desc.includes("dividendo") ||
        desc.includes("juros sobre capital") ||
        cat.includes("rendimento") ||
        cat.includes("dividendo")
      ) {
        txnYieldTotal += Math.abs(Number(t.amount) || 0);
      }
    });

    const effectiveAccruedProfit = hasBankProfit
      ? profit
      : txnYieldTotal > 0
      ? txnYieldTotal
      : Math.round(totalInvested * (macroSnapshot.annualCDIPct / 100) * 0.5);

    const monthlyProj =
      Math.round(totalInvested * macroSnapshot.monthlyCDICompoundFactor * 100) / 100;

    return {
      totalProfit: effectiveAccruedProfit,
      estimatedMonthlyYield: monthlyProj,
    };
  }, [filteredInvestments, transactions, totalInvested, macroSnapshot]);

  // Auditoria de Garantia FGC por Conglomerado Emissor (R$ 250k)
  const fgcAnalysis = useMemo(() => {
    const map = new Map<
      string,
      { issuerName: string; totalBalance: number; count: number }
    >();

    activeInvestments.forEach((inv) => {
      const type = (inv.type || "").toUpperCase();
      const nameLower = (inv.name || "").toLowerCase();
      const isFgcEligible =
        ["CDB", "LCI", "LCA", "RDB", "POUPANCA"].includes(type) ||
        nameLower.includes("cdb") ||
        nameLower.includes("lci") ||
        nameLower.includes("lca") ||
        nameLower.includes("rdb");

      if (!isFgcEligible) return;

      const issuer =
        inv.issuer && String(inv.issuer).trim().length > 1
          ? String(inv.issuer).trim()
          : String(inv.institution_name || inv.bank_name || "Instituição Emissora").trim();

      const bal = Number(inv.balance) || 0;
      const existing = map.get(issuer) || {
        issuerName: issuer,
        totalBalance: 0,
        count: 0,
      };
      existing.totalBalance += bal;
      existing.count += 1;
      map.set(issuer, existing);
    });

    const FGC_CEILING = 250000;
    const issuers = Array.from(map.values()).sort((a, b) => b.totalBalance - a.totalBalance);
    const totalEligible = issuers.reduce((s, i) => s + i.totalBalance, 0);
    const totalExposed = issuers.reduce(
      (s, i) => s + Math.max(0, i.totalBalance - FGC_CEILING),
      0
    );

    return {
      issuers,
      totalEligible,
      totalProtected: totalEligible - totalExposed,
      totalExposed,
      isFullyProtected: totalExposed === 0,
      FGC_CEILING,
    };
  }, [activeInvestments]);

  const taxCompResult = useMemo(() => {
    return compareTaxExemptVsTaxable({
      cdbPercentCDI: cdbRateInput,
      lciPercentCDI: lciRateInput,
      calendarDays: taxCompDays,
    });
  }, [cdbRateInput, lciRateInput, taxCompDays]);

  const auditPrompt = `Faça uma análise estratégica completa da minha carteira de investimentos. Tenho ${formatSensitiveCurrency(
    totalInvested
  )} investidos em ${activeInvestments.length} títulos ativos, além de ${formatSensitiveCurrency(
    liquidCash
  )} em liquidez. Considerando Selic ${selicFormatted} (CDI ${cdiFormatted}) e IPCA ${ipcaFormatted}, onde posso otimizar alocação e eficiência tributária?`;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      {/* Header Estilo Wealthfolio */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <WfIcons.Holdings className="w-5 h-5 text-[#FF8216]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Holdings & Custódia Consolidada
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Posições conciliadas de Renda Fixa, Tesouro, Fundos, Ações e Liquidez com auditoria FGC e equivalência tributária RFB.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/insights"
            className="h-9 px-3.5 rounded-xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors"
          >
            <WfIcons.Insights className="w-3.5 h-3.5 text-[#FF8216]" />
            <span>Insights & Gauges</span>
          </Link>

          <Link
            href={`/kitsune?prompt=${encodeURIComponent(auditPrompt)}`}
            className="h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FF9438] text-black text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <WfIcons.Agents className="w-3.5 h-3.5" />
            <span>Auditar com Agente Daiko</span>
          </Link>
        </div>
      </header>

      {/* Filtro Linear por Instituição */}
      {connectedBanks.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedBankSlug("all")}
            className={`h-8 px-3 rounded-full text-xs font-medium shrink-0 border transition-colors cursor-pointer ${
              selectedBankSlug === "all"
                ? "bg-[#FF8216]/15 border-[#FF8216]/40 text-[#FF8216]"
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
                    ? "bg-[#FF8216]/15 border-[#FF8216]/40 text-[#FF8216]"
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

      {/* ValueStrip 5 Células Estilo Wealthfolio */}
      <section className="grid grid-cols-2 lg:grid-cols-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-[#27272A] overflow-hidden">
        <div className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 block">
            Patrimônio Bruto
          </span>
          <span className="text-lg md:text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-[#F4F4F5] mt-1 block">
            {formatSensitiveCurrency(grossPortfolio)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Custódia + Liquidez
          </span>
        </div>

        <div className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 block">
            Total Investido
          </span>
          <span className="text-lg md:text-xl font-bold font-mono tabular-nums text-[#FF8216] mt-1 block">
            {formatSensitiveCurrency(totalInvested)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            {activeInvestments.length} posições ativas
          </span>
        </div>

        <div className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 block">
            Liquidez em Conta
          </span>
          <span className="text-lg md:text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-[#F4F4F5] mt-1 block">
            {formatSensitiveCurrency(liquidCash)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Disponível D+0
          </span>
        </div>

        <div className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 block">
            Renda Passiva / Mês
          </span>
          <span className="text-lg md:text-xl font-bold font-mono tabular-nums text-emerald-500 mt-1 block">
            +{formatSensitiveCurrency(estimatedMonthlyYield)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            100% CDI ({cdiFormatted} a.a.)
          </span>
        </div>

        <div className="p-4 col-span-2 lg:col-span-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 block">
            Lucro Acumulado
          </span>
          <span className="text-lg md:text-xl font-bold font-mono tabular-nums text-emerald-500 mt-1 block">
            +{formatSensitiveCurrency(totalProfit)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Proventos & valorização
          </span>
        </div>
      </section>

      {/* Tabela Densa de Holdings (Desktop Table + Mobile Stacked List) */}
      <HoldingsDataTable
        investments={filteredInvestments}
        accounts={filteredAccounts}
        includeCashAccounts={true}
        formatCurrency={formatSensitiveCurrency}
        hideValues={isPrivacyMode}
        annualCDIPct={macroSnapshot.annualCDIPct}
      />

      {/* Treemap Determinístico de Alocação (Classes & Instituições) */}
      <AllocationTreemap
        investments={filteredInvestments}
        accounts={filteredAccounts}
        formatCurrency={formatSensitiveCurrency}
        hideValues={isPrivacyMode}
      />

      {/* Termômetro Macroeconômico BCB Ao Vivo */}
      <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-[#27272A]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
                Termômetro Macroeconômico BCB Ao Vivo
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
                {macroSnapshot.source === "brasilapi_live" || macroSnapshot.source === "cache"
                  ? "BrasilAPI • BCB Sync"
                  : "Referência BCB"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Indicadores oficiais do Banco Central alimentando o motor DU/252 e a Equação de Fisher.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-1 rounded-full bg-[#FF8216]/12 text-[#FF8216] border border-[#FF8216]/25">
            Juro Real Fisher: +{realInterestFormatted} a.a.
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
              Taxa Selic
            </span>
            <span className="text-base font-bold font-mono tabular-nums text-emerald-500 mt-0.5 block">
              {selicFormatted}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Meta Copom BCB</span>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
              CDI Anual
            </span>
            <span className="text-base font-bold font-mono tabular-nums text-emerald-500 mt-0.5 block">
              {cdiFormatted}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Benchmark DI/CETIP</span>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
              IPCA 12m
            </span>
            <span className="text-base font-bold font-mono tabular-nums text-[#FF8216] mt-0.5 block">
              {ipcaFormatted}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Inflação Oficial IBGE</span>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
              Ganho Real (Fisher)
            </span>
            <span className="text-base font-bold font-mono tabular-nums text-emerald-500 mt-0.5 block">
              +{realInterestFormatted}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Acima da inflação</span>
          </div>
        </div>
      </section>

      {/* Monitor FGC + Simulador de Equivalência Tributária CDB vs LCI/LCA */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monitor FGC */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-[#27272A]">
            <div>
              <div className="flex items-center gap-2">
                <WfIcons.ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
                  Monitor de Garantia FGC (R$ 250k / Emissor)
                </h2>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Segregação por conglomerado emissor real (Resolução CMN nº 4.222).
              </p>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                fgcAnalysis.isFullyProtected
                  ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25"
                  : "bg-rose-500/12 text-rose-400 border-rose-500/25"
              }`}
            >
              {fgcAnalysis.isFullyProtected ? "100% Coberto" : "Teto Excedido"}
            </span>
          </div>

          {fgcAnalysis.issuers.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">
              Nenhum título elegível ao FGC (CDB, LCI, LCA, RDB) na carteira ativa.
            </p>
          ) : (
            <div className="space-y-3">
              {fgcAnalysis.issuers.map((item) => {
                const pct = Math.min(
                  100,
                  Math.round((item.totalBalance / fgcAnalysis.FGC_CEILING) * 100)
                );
                const isExceeded = item.totalBalance > fgcAnalysis.FGC_CEILING;
                const isCaution = item.totalBalance >= 220000 && !isExceeded;

                return (
                  <div
                    key={item.issuerName}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                        {item.issuerName}
                      </span>
                      <span className="font-mono tabular-nums font-semibold shrink-0">
                        <span
                          className={
                            isExceeded
                              ? "text-rose-500"
                              : isCaution
                              ? "text-[#FF8216]"
                              : "text-emerald-500"
                          }
                        >
                          {formatSensitiveCurrency(item.totalBalance)}
                        </span>
                        <span className="text-zinc-500 text-[10px]"> / R$ 250k</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-[#27272A] overflow-hidden">
                      <div
                        style={{ width: `${isPrivacyMode ? 35 : pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          isExceeded
                            ? "bg-rose-500"
                            : isCaution
                            ? "bg-[#FF8216]"
                            : "bg-emerald-500"
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{item.count} título(s)</span>
                      <span className="font-mono tabular-nums">
                        {isPrivacyMode
                          ? "••% utilizado"
                          : isExceeded
                          ? `Excede ${formatSensitiveCurrency(
                              item.totalBalance - fgcAnalysis.FGC_CEILING
                            )}`
                          : `${pct}% do teto`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Simulador CDB vs LCI/LCA */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-[#27272A]">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
                Equivalência Tributária (CDB vs. LCI/LCA)
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Comparação líquida exata com tabela regressiva de IR (22,5% a 15%).
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
              {[
                { days: 180, label: "180d" },
                { days: 360, label: "360d" },
                { days: 720, label: "720d" },
                { days: 1080, label: ">720d" },
              ].map((b) => (
                <button
                  key={b.days}
                  type="button"
                  onClick={() => setTaxCompDays(b.days)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono tabular-nums font-medium cursor-pointer transition-colors ${
                    taxCompDays === b.days
                      ? "bg-[#FF8216] text-black font-semibold"
                      : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
                Taxa CDB (Tributado IR)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={220}
                  value={cdbRateInput}
                  onChange={(e) => setCdbRateInput(Number(e.target.value) || 100)}
                  className="w-20 px-2.5 py-1 rounded-lg bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] text-sm font-mono tabular-nums font-bold text-zinc-900 dark:text-[#F4F4F5] focus:outline-none focus:border-[#FF8216]"
                />
                <span className="text-xs text-zinc-500 font-medium">% do CDI</span>
              </div>
              <span className="text-[11px] text-zinc-500 block font-mono tabular-nums">
                Líquido equiv.: <strong>{taxCompResult.equivalentLCIRateForCDB}% CDI</strong>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
                Taxa LCI / LCA (Isento IR)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={220}
                  value={lciRateInput}
                  onChange={(e) => setLciRateInput(Number(e.target.value) || 85)}
                  className="w-20 px-2.5 py-1 rounded-lg bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] text-sm font-mono tabular-nums font-bold text-zinc-900 dark:text-[#F4F4F5] focus:outline-none focus:border-[#FF8216]"
                />
                <span className="text-xs text-zinc-500 font-medium">% do CDI</span>
              </div>
              <span className="text-[11px] text-zinc-500 block font-mono tabular-nums">
                Bruto equiv.: <strong>{taxCompResult.equivalentCDBRateForLCI}% CDI</strong>
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    taxCompResult.winner === "CDB"
                      ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25"
                      : taxCompResult.winner === "LCI_LCA"
                      ? "bg-[#FF8216]/12 text-[#FF8216] border-[#FF8216]/25"
                      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/25"
                  }`}
                >
                  {taxCompResult.winner === "CDB"
                    ? "CDB Mais Rentável"
                    : taxCompResult.winner === "LCI_LCA"
                    ? "LCI/LCA Mais Rentável"
                    : "Empate Técnico"}
                </span>
                <span className="text-xs font-mono tabular-nums font-semibold text-zinc-900 dark:text-[#F4F4F5]">
                  +{taxCompResult.spreadAdvantagePctCDI}% CDI líquido
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {taxCompResult.explanationPtBr}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
