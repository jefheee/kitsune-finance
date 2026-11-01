"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { createClient } from "@/utils/supabase/client";
import { parseLocalDate } from "@/utils/finance/reconciler";
import {
  fetchLiveMacroRates,
  getCachedOrFallbackMacroRates,
  type LiveMacroRatesSnapshot,
} from "@/utils/finance/macro-rates";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

const GOAL_OPTIONS = [
  {
    id: "emergency_fund",
    title: "Reserva de Emergência (6 Meses)",
    desc: "Blindar de 3 a 6 meses do custo operacional em liquidez diária D+0 (100%+ CDI).",
  },
  {
    id: "fire_investing",
    title: "Independência Financeira (FIRE)",
    desc: "Cobrir 100% das despesas mensais exclusivamente com rendimentos passivos reais.",
  },
  {
    id: "asset_growth",
    title: "Multiplicação & Alocação Estratégica",
    desc: "Maximizar juro composto líquido combinando CDI, Tesouro IPCA+ e ativos geradores.",
  },
  {
    id: "debt_freedom",
    title: "Zerar Passivos & Cartões",
    desc: "Manter cobertura integral de faturas à vista e eliminar qualquer CET rotativo.",
  },
];

export default function GoalsPage() {
  const {
    user,
    userProfile,
    accounts,
    investments,
    loans,
    transactions,
    isPrivacyMode,
    formatSensitiveCurrency,
    updateUserProfileLocal,
  } = useFinanceData();

  const [macroSnapshot, setMacroSnapshot] = useState<LiveMacroRatesSnapshot>(() =>
    getCachedOrFallbackMacroRates()
  );
  const [selectedGoal, setSelectedGoal] = useState<string>(
    userProfile?.financial_goal || "emergency_fund"
  );
  const [customTargetPatrimony, setCustomTargetPatrimony] = useState<number>(500000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(1500);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (userProfile?.financial_goal) {
      setSelectedGoal(userProfile.financial_goal);
    }
  }, [userProfile?.financial_goal]);

  useEffect(() => {
    let mounted = true;
    fetchLiveMacroRates().then((live) => {
      if (mounted) setMacroSnapshot(live);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    let liquid = 0;
    let credit = 0;
    accounts.forEach((a) => {
      const bal = Number(a.balance) || 0;
      if (a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD") {
        credit += Math.abs(bal);
      } else {
        liquid += Math.max(0, bal);
      }
    });

    const invested = investments
      .filter((i) => (Number(i.balance) || 0) > 0 && i.status !== "TOTAL_WITHDRAWAL")
      .reduce((s, i) => s + (Number(i.balance) || 0), 0);

    const loansTotal = loans.reduce(
      (s, l) => s + (Number(l.outstanding_balance) || 0),
      0
    );

    const netWorth = liquid + invested - credit - loansTotal;

    const now = new Date();
    const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
      if (amt < 0 || tx.type === "DEBIT" || isCard) {
        monthlyExpense += Math.abs(amt);
      }
    });

    const refMonthlyCost = monthlyExpense > 0 ? monthlyExpense : 3000;
    const emergencyTarget = refMonthlyCost * 6;
    const emergencyPct = Math.min(100, Math.round((liquid / emergencyTarget) * 100));
    const emergencyMonths = liquid / refMonthlyCost;

    // Patrimônio FIRE p/ cobrir custo mensal com Juro Real de Fisher
    const realAnnualRate = Math.max(0.03, macroSnapshot.realInterestAnnualPct / 100);
    const realMonthlyRate = Math.pow(1 + realAnnualRate, 1 / 12) - 1;
    const fireRequiredCapital = Math.round(refMonthlyCost / realMonthlyRate);
    const firePct = Math.min(
      100,
      Math.max(0, Math.round((Math.max(0, netWorth) / fireRequiredCapital) * 100))
    );

    const monthlyPassiveNominal =
      Math.round(invested * macroSnapshot.monthlyCDICompoundFactor * 100) / 100;

    // Cobertura de passivos imediatos
    const totalLiabilities = credit + loansTotal;
    const debtFreePct =
      totalLiabilities <= 0
        ? 100
        : Math.min(100, Math.round((liquid / totalLiabilities) * 100));

    // Simulação determinística de meses até o alvo customizado (juro real composto)
    let simBalance = Math.max(0, netWorth);
    let monthsToCustomTarget = 0;
    if (simBalance < customTargetPatrimony && monthlyContribution > 0) {
      while (simBalance < customTargetPatrimony && monthsToCustomTarget < 600) {
        simBalance = simBalance * (1 + realMonthlyRate) + monthlyContribution;
        monthsToCustomTarget += 1;
      }
    }

    const customProgressPct = Math.min(
      100,
      Math.max(0, Math.round((Math.max(0, netWorth) / Math.max(1, customTargetPatrimony)) * 100))
    );

    return {
      liquid,
      invested,
      netWorth,
      totalLiabilities,
      refMonthlyCost,
      emergencyTarget,
      emergencyPct,
      emergencyMonths,
      fireRequiredCapital,
      firePct,
      monthlyPassiveNominal,
      debtFreePct,
      monthsToCustomTarget,
      customProgressPct,
    };
  }, [
    accounts,
    investments,
    loans,
    transactions,
    macroSnapshot,
    customTargetPatrimony,
    monthlyContribution,
  ]);

  const handleSavePrimaryGoal = async (goalId: string) => {
    setSelectedGoal(goalId);
    if (!user) return;
    setIsSavingGoal(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("users_profile").upsert(
        {
          id: user.id,
          financial_goal: goalId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (!error) {
        updateUserProfileLocal({ financial_goal: goalId });
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2500);
      }
    } finally {
      setIsSavingGoal(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <WfIcons.Goals className="w-5 h-5 text-[#FF8216]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Metas Patrimoniais & Independência (FIRE)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Acompanhamento determinístico de Reserva de Emergência, Liberdade Financeira pela Equação de Fisher e projeção de aportes.
          </p>
        </div>

        <Link
          href="/kitsune?prompt=Com%20base%20no%20meu%20patrim%C3%B4nio%20atual%20e%20no%20juro%20real%20de%20Fisher%2C%20monte%20um%20plano%20de%20aportes%20com%20o%20Agente%20Ren."
          className="h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FF9438] text-black text-xs font-semibold inline-flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <WfIcons.Agents className="w-3.5 h-3.5" />
          <span>Planejar com Agente Ren</span>
        </Link>
      </header>

      {/* 3 Trilhos Determinísticos Principais Estilo Wealthfolio SavingGoals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Reserva de Emergência */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 block">
                Colchão de Segurança
              </span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] mt-0.5">
                Reserva de Emergência (6 Meses)
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-semibold bg-[#FF8216]/12 text-[#FF8216] border border-[#FF8216]/25">
              {isPrivacyMode ? "••%" : `${metrics.emergencyPct}%`}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-lg font-bold text-zinc-900 dark:text-[#F4F4F5]">
                {formatSensitiveCurrency(metrics.liquid)}
              </span>
              <span className="text-xs text-zinc-500">
                de {formatSensitiveCurrency(metrics.emergencyTarget)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-[#18181B] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FF8216] transition-all duration-500"
                style={{ width: `${isPrivacyMode ? 60 : metrics.emergencyPct}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Cobertura atual:{" "}
              <strong className="text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
                {isPrivacyMode ? "••" : metrics.emergencyMonths.toFixed(1)} meses
              </strong>{" "}
              do custo mensal ({formatSensitiveCurrency(metrics.refMonthlyCost)}).
            </p>
          </div>
        </section>

        {/* Card 2: Independência Financeira FIRE */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 block">
                Liberdade Patrimonial
              </span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] mt-0.5">
                Número FIRE (Juro Real Fisher)
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
              {isPrivacyMode ? "••%" : `${metrics.firePct}%`}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-lg font-bold text-emerald-500">
                {formatSensitiveCurrency(metrics.netWorth)}
              </span>
              <span className="text-xs text-zinc-500">
                alvo {formatSensitiveCurrency(metrics.fireRequiredCapital)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-[#18181B] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${isPrivacyMode ? 35 : metrics.firePct}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Renda passiva CDI atual:{" "}
              <strong className="text-emerald-500 font-mono tabular-nums">
                +{formatSensitiveCurrency(metrics.monthlyPassiveNominal)}/mês
              </strong>
              .
            </p>
          </div>
        </section>

        {/* Card 3: Cobertura de Passivos */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 block">
                Solvência Imediata
              </span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] mt-0.5">
                Cobertura de Cartões & Passivos
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
              {isPrivacyMode ? "••%" : `${metrics.debtFreePct}%`}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-lg font-bold text-zinc-900 dark:text-[#F4F4F5]">
                {formatSensitiveCurrency(metrics.totalLiabilities)}
              </span>
              <span className="text-xs text-zinc-500">em aberto</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-[#18181B] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${isPrivacyMode ? 90 : metrics.debtFreePct}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Liquidez imediata cobre{" "}
              <strong className="text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
                {metrics.totalLiabilities === 0
                  ? "100% (Sem dívidas)"
                  : isPrivacyMode
                  ? "••x"
                  : `${(metrics.liquid / metrics.totalLiabilities).toFixed(1)}x`}
              </strong>{" "}
              das faturas atuais.
            </p>
          </div>
        </section>
      </div>

      {/* Grid Inferior: Simulador de Alvo Patrimonial + Foco Principal do Perfil */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Simulador Determinístico de Alvo Patrimonial */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
              Simulador de Meta Patrimonial (Poder de Compra Real)
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Cálculo determinístico descontando IPCA via Equação de Fisher (+
              {macroSnapshot.realInterestAnnualPct.toFixed(2)}% a.a. real).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
                Meta de Patrimônio (R$)
              </label>
              <input
                type="number"
                step={10000}
                min={10000}
                value={customTargetPatrimony}
                onChange={(e) => setCustomTargetPatrimony(Math.max(1000, Number(e.target.value) || 0))}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] text-sm font-mono tabular-nums font-bold text-zinc-900 dark:text-[#F4F4F5] focus:outline-none focus:border-[#FF8216]"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
                Aporte Mensal Planejado (R$)
              </label>
              <input
                type="number"
                step={100}
                min={0}
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] text-sm font-mono tabular-nums font-bold text-zinc-900 dark:text-[#F4F4F5] focus:outline-none focus:border-[#FF8216]"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Progresso Atual até a Meta</span>
              <span className="font-mono tabular-nums font-bold text-[#FF8216]">
                {isPrivacyMode ? "••%" : `${metrics.customProgressPct}%`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-[#27272A] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FF8216] transition-all duration-500"
                style={{ width: `${isPrivacyMode ? 45 : metrics.customProgressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-zinc-500">Prazo Estimado em Juro Real:</span>
              <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-[#F4F4F5]">
                {isPrivacyMode
                  ? "•• anos"
                  : metrics.netWorth >= customTargetPatrimony
                  ? "Meta já atingida!"
                  : `${(metrics.monthsToCustomTarget / 12).toFixed(1)} anos (${metrics.monthsToCustomTarget} meses)`}
              </span>
            </div>
          </div>
        </section>

        {/* Seletor de Diretriz Estratégica do Perfil */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
                Diretriz Principal da Conta
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Calibra os diagnósticos dos 7 Agentes IA e do painel Visão Geral.
              </p>
            </div>
            {savedFeedback && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
                Salvo!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {GOAL_OPTIONS.map((g) => {
              const active = selectedGoal === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={isSavingGoal}
                  onClick={() => handleSavePrimaryGoal(g.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? "bg-[#FF8216]/10 border-[#FF8216] text-zinc-900 dark:text-[#F4F4F5]"
                      : "bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-zinc-900 dark:text-[#F4F4F5]">
                      {g.title}
                    </span>
                    {active && (
                      <span className="w-2 h-2 rounded-full bg-[#FF8216] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {g.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
