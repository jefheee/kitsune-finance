"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { runFinancialXRay } from "@/utils/finance/engine";
import { parseLocalDate } from "@/utils/finance/reconciler";
import {
  fetchLiveMacroRates,
  getCachedOrFallbackMacroRates,
  type LiveMacroRatesSnapshot,
} from "@/utils/finance/macro-rates";
import {
  AllocationGauges,
  type SemicircularGaugeItem,
  type AllocationSlice,
} from "@/components/wealthfolio/AllocationGauges";
import { AllocationTreemap } from "@/components/wealthfolio/AllocationTreemap";
import { IncomeHistoryCard } from "@/components/wealthfolio/IncomeHistoryCard";
import { SpendingHeatmap } from "@/components/finance/SpendingHeatmap";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

export default function InsightsPage() {
  const {
    accounts,
    investments,
    loans,
    transactions,
    customAssets,
    isPrivacyMode,
    formatSensitiveCurrency,
  } = useFinanceData();

  const [macroSnapshot, setMacroSnapshot] = useState<LiveMacroRatesSnapshot>(() =>
    getCachedOrFallbackMacroRates()
  );

  useEffect(() => {
    let mounted = true;
    fetchLiveMacroRates().then((live) => {
      if (mounted) setMacroSnapshot(live);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Métricas determinísticas para Gauges, Donut e X-Ray
  const {
    gauges,
    allocationSlices,
    strategyStage,
    strategyRails,
    kitsuneHealthScore,
  } = useMemo(() => {
    let liquid = 0;
    let creditUsed = 0;
    let creditLimitTotal = 0;

    accounts.forEach((a) => {
      const bal = Number(a.balance) || 0;
      const isCredit =
        a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
      if (isCredit) {
        creditUsed += Math.abs(bal);
        creditLimitTotal += Number(a.credit_limit) || 0;
      } else {
        liquid += Math.max(0, bal);
      }
    });

    const activeInvs = investments.filter(
      (i) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL"
    );
    const totalInvested = activeInvs.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    const loansTotal = loans.reduce(
      (s, l) => s + (Number(l.outstanding_balance) || 0),
      0
    );

    // Receitas e despesas operacionais do mês corrente
    const now = new Date();
    const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    transactions.forEach((tx) => {
      if (tx.is_internal_transfer || tx.is_refund) return;
      const raw = tx.executed_at || tx.date || "";
      if (!raw.startsWith(curMonthPrefix)) return;
      const d = parseLocalDate(raw);
      if (d.getTime() > now.getTime()) return;

      const amt = Number(tx.amount) || 0;
      const isCard =
        tx.bank_accounts?.type === "CREDIT" ||
        tx.bank_accounts?.subtype === "CREDIT_CARD" ||
        tx.operation_type === "CREDIT_CARD";
      const isExp = amt < 0 || tx.type === "DEBIT" || isCard;
      if (isExp) monthlyExpense += Math.abs(amt);
      else if (amt > 0) monthlyIncome += Math.abs(amt);
    });

    // Concentração máxima por emissor FGC
    const issuerMap = new Map<string, number>();
    activeInvs.forEach((inv) => {
      const issuer =
        inv.issuer && String(inv.issuer).trim().length > 1
          ? String(inv.issuer).trim()
          : String(inv.institution_name || "Instituição").trim();
      issuerMap.set(issuer, (issuerMap.get(issuer) || 0) + (Number(inv.balance) || 0));
    });
    let maxIssuerBalance = 0;
    let maxIssuerName = "Nenhum";
    for (const [name, val] of issuerMap.entries()) {
      if (val > maxIssuerBalance) {
        maxIssuerBalance = val;
        maxIssuerName = name;
      }
    }
    const fgcPct = Math.min(100, Math.round((maxIssuerBalance / 250000) * 100));

    // Cobertura de Reserva de Emergência (6 meses)
    const refExpense = monthlyExpense > 0 ? monthlyExpense : 2500;
    const emergencyMonths = liquid / refExpense;
    const emergencyPct = Math.min(100, Math.round((emergencyMonths / 6) * 100));

    // Utilização de Limite / Comprometimento
    const creditUtilPct =
      creditLimitTotal > 0
        ? Math.min(100, Math.round((creditUsed / creditLimitTotal) * 100))
        : monthlyIncome > 0
        ? Math.min(100, Math.round(((creditUsed + loansTotal) / monthlyIncome) * 100))
        : 0;

    // Eficiência Juro Real Fisher (meta de referência 8% a.a. real = 100% do gauge)
    const realPct = Math.max(0, macroSnapshot.realInterestAnnualPct);
    const fisherGaugePct = Math.min(100, Math.round((realPct / 8) * 100));

    // X-Ray Score oficial
    const xray = runFinancialXRay({
      accounts: accounts.map((a) => ({
        id: a.id,
        institutionName: a.institution_name || a.bank_name || "Banco",
        type: (
          a.type === "CREDIT" || a.subtype === "CREDIT_CARD"
            ? "CREDIT_CARD"
            : a.type === "SAVINGS"
            ? "SAVINGS"
            : "CHECKING"
        ) as any,
        balance: Number(a.balance) || 0,
        creditLimit: Number(a.credit_limit) || undefined,
      })),
      investments: activeInvs.map((inv) => ({
        id: inv.id,
        name: inv.name || "Título",
        institutionName: inv.institution_name || "Instituição",
        issuerName: inv.issuer || null,
        type: (inv.type || "CDB").toUpperCase(),
        balance: Number(inv.balance) || 0,
        isDailyLiquidity: true,
        isFGCGuaranteed: true,
      })),
      monthlyIncome,
      monthlyExpenses: monthlyExpense,
      macroRates: {
        annualCDIPct: macroSnapshot.annualCDIPct,
        annualIPCAPct: macroSnapshot.annualIPCAPct,
        annualSelicPct: macroSnapshot.annualSelicPct,
      },
    });

    const computedGauges: SemicircularGaugeItem[] = [
      {
        id: "xray-health",
        title: "Saúde Patrimonial",
        subtitle: "Diagnóstico consolidado de liquidez e risco",
        percent: xray.kitsuneScore,
        displayValue: isPrivacyMode ? "••/100" : `${xray.kitsuneScore}/100`,
        badgeText: xray.statusLabel,
        tone:
          xray.kitsuneScore >= 75
            ? "emerald"
            : xray.kitsuneScore >= 50
            ? "orange"
            : "rose",
        footerLeft: "0 Crítico",
        footerRight: "100 Excelente",
      },
      {
        id: "fgc-exposure",
        title: "Exposição Teto FGC",
        subtitle: `Maior emissor: ${maxIssuerName}`,
        percent: isPrivacyMode ? 35 : fgcPct,
        displayValue: isPrivacyMode ? "••%" : `${fgcPct}%`,
        badgeText: fgcPct > 100 ? "Acima R$250k" : fgcPct >= 85 ? "Atenção" : "Seguro",
        tone: fgcPct >= 100 ? "rose" : fgcPct >= 80 ? "amber" : "emerald",
        footerLeft: isPrivacyMode ? "R$ •••" : formatSensitiveCurrency(maxIssuerBalance),
        footerRight: "Teto R$ 250k",
      },
      {
        id: "emergency-reserve",
        title: "Colchão de Liquidez",
        subtitle: "Meta recomendada: 6 meses",
        percent: isPrivacyMode ? 65 : emergencyPct,
        displayValue: isPrivacyMode ? "•• m" : `${emergencyMonths.toFixed(1)}m`,
        badgeText: emergencyPct >= 100 ? "Completo" : `${emergencyPct}% da meta`,
        tone: emergencyPct >= 100 ? "emerald" : emergencyPct >= 50 ? "orange" : "amber",
        footerLeft: "0m",
        footerRight: "6,0 meses",
      },
      {
        id: "credit-risk",
        title: "Uso de Limite Crédito",
        subtitle: "Comprometimento em faturas no ciclo",
        percent: isPrivacyMode ? 22 : creditUtilPct,
        displayValue: isPrivacyMode ? "••%" : `${creditUtilPct}%`,
        badgeText: creditUtilPct <= 30 ? "Saudável (<30%)" : "Elevado",
        tone: creditUtilPct <= 30 ? "emerald" : creditUtilPct <= 60 ? "amber" : "rose",
        footerLeft: isPrivacyMode ? "R$ •••" : formatSensitiveCurrency(creditUsed),
        footerRight:
          creditLimitTotal > 0 && !isPrivacyMode
            ? formatSensitiveCurrency(creditLimitTotal)
            : "Controle de fatura",
      },
    ];

    // Slices para Donut Semicircular de Alocação
    let fixed = 0;
    let treasury = 0;
    let funds = 0;
    let equities = 0;

    activeInvs.forEach((inv) => {
      const name = String(inv.name || "").toLowerCase();
      const type = String(inv.type || "").toLowerCase();
      const bal = Number(inv.balance) || 0;
      if (name.includes("tesouro") || type.includes("treasury")) treasury += bal;
      else if (
        name.includes("fii") ||
        name.includes("ação") ||
        name.includes("acao") ||
        type.includes("equity")
      )
        equities += bal;
      else if (name.includes("fundo") || type.includes("fund")) funds += bal;
      else fixed += bal;
    });

    const slices: AllocationSlice[] = [
      { id: "fixed", name: "Renda Fixa & CDB/LCI", value: fixed, color: "#FF8216" },
      { id: "cash", name: "Liquidez em Conta", value: liquid, color: "#10B981" },
      { id: "treasury", name: "Tesouro Direto", value: treasury, color: "#F59E0B" },
      { id: "funds", name: "Fundos Multimercado/DI", value: funds, color: "#EA580C" },
      { id: "equities", name: "Renda Variável & FIIs", value: equities, color: "#71717A" },
    ].filter((s) => s.value > 0);

    const grossTotal = liquid + totalInvested;
    const stage =
      grossTotal < 50000
        ? "Fase 1 • Formação de Reserva & Liquidez"
        : grossTotal < 200000
        ? "Fase 2 • Aceleração & Travamento de Juro Real"
        : "Fase 3 • Multiplicação & Renda Passiva (FIRE)";

    const rails =
      grossTotal < 50000
        ? [
            { label: "Liquidez Diária (100%+ CDI / Selic)", target: 85, color: "#10B981" },
            { label: "Inflação Soberana (IPCA+)", target: 15, color: "#FF8216" },
          ]
        : grossTotal < 200000
        ? [
            { label: "Renda Fixa Pós-Fixada (CDI / LCI)", target: 55, color: "#FF8216" },
            { label: "Tesouro IPCA+ (Juro Real)", target: 30, color: "#10B981" },
            { label: "FIIs & Dividendos Isentos", target: 15, color: "#F59E0B" },
          ]
        : [
            { label: "Renda Fixa Pós & Crédito Isento", target: 45, color: "#FF8216" },
            { label: "Tesouro IPCA+ Longo Prazo", target: 25, color: "#10B981" },
            { label: "FIIs & Ações Pagadoras", target: 20, color: "#F59E0B" },
            { label: "Reserva Cambial / Global", target: 10, color: "#71717A" },
          ];

    return {
      gauges: computedGauges,
      allocationSlices: slices,
      strategyStage: stage,
      strategyRails: rails,
      kitsuneHealthScore: xray.kitsuneScore,
    };
  }, [accounts, investments, loans, transactions, macroSnapshot, isPrivacyMode, formatSensitiveCurrency]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <WfIcons.Insights className="w-5 h-5 text-[#FF8216]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Insights, Risco & Alocação Patrimonial
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Gauges semicirculares de exposição, Treemap por classe e instituição, histórico de proventos e mapa de calor.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/investments"
            className="h-9 px-3.5 rounded-xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors"
          >
            <WfIcons.Holdings className="w-3.5 h-3.5 text-[#FF8216]" />
            <span>Tabela de Holdings</span>
          </Link>
          <Link
            href="/kitsune?prompt=Execute%20um%20diagn%C3%B3stico%20completo%20de%20risco%2C%20aloca%C3%A7%C3%A3o%20e%20proventos%20da%20minha%20carteira."
            className="h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FF9438] text-black text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <WfIcons.Agents className="w-3.5 h-3.5" />
            <span>Consultar Kitsune AI</span>
          </Link>
        </div>
      </header>

      {/* Gauges Semicirculares 180° + Donut Semicircular Multi-Slice */}
      <AllocationGauges
        gauges={gauges}
        slices={allocationSlices}
        formatCurrency={formatSensitiveCurrency}
        hideValues={isPrivacyMode}
      />

      {/* Treemap Interativo por Classe de Ativos & Instituição Financeira */}
      <AllocationTreemap
        investments={investments}
        accounts={accounts}
        customAssets={customAssets}
        formatCurrency={formatSensitiveCurrency}
        hideValues={isPrivacyMode}
      />

      {/* Grid: Histórico de Proventos em Barras Finas + Mapa de Calor & Alocação Alvo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <IncomeHistoryCard
          investments={investments}
          transactions={transactions}
          formatCurrency={formatSensitiveCurrency}
          hideValues={isPrivacyMode}
          monthlyCDIFactor={macroSnapshot.monthlyCDICompoundFactor}
          annualCDIPct={macroSnapshot.annualCDIPct}
        />

        <div className="space-y-6">
          {/* Estratégia Recomendada determinística */}
          <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF8216] block">
                  Alocação Alvo Sugerida
                </span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] mt-0.5">
                  {strategyStage}
                </h3>
              </div>
              <Link
                href="/goals"
                className="text-xs font-medium text-[#FF8216] hover:underline shrink-0"
              >
                Ver Metas →
              </Link>
            </div>

            <div className="space-y-3">
              {strategyRails.map((rail) => (
                <div key={rail.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {rail.label}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-[#F4F4F5]">
                      {rail.target}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-[#18181B] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${rail.target}%`, backgroundColor: rail.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mapa de Calor de Despesas Mensais */}
          <SpendingHeatmap
            transactions={transactions}
            formatCurrency={formatSensitiveCurrency}
          />
        </div>
      </div>
    </div>
  );
}
