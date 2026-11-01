"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { BankLogo } from "@/components/BankLogo";
import { parseLocalDate } from "@/utils/finance/reconciler";
import {
  runFinancialXRay,
  compareTaxExemptVsTaxable,
  calculateRealInterestRate,
} from "@/utils/finance/engine";
import {
  fetchLiveMacroRates,
  formatPercentPtBr,
  getCachedOrFallbackMacroRates,
  type LiveMacroRatesSnapshot,
} from "@/utils/finance/macro-rates";

export default function InvestmentsPage() {
  const {
    investments,
    accounts,
    transactions,
    formatSensitiveCurrency,
    selectedBankSlug,
  } = useFinanceData();

  const [macroSnapshot, setMacroSnapshot] = useState<LiveMacroRatesSnapshot>(() =>
    getCachedOrFallbackMacroRates()
  );
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showRedeemed, setShowRedeemed] = useState<boolean>(false);
  const [taxCompDays, setTaxCompDays] = useState<number>(360);
  const [cdbRateInput, setCdbRateInput] = useState<number>(100);
  const [lciRateInput, setLciRateInput] = useState<number>(85);
  const PAGE_SIZE = 6;

  useEffect(() => {
    let active = true;
    fetchLiveMacroRates().then((live) => {
      if (active) {
        setMacroSnapshot(live);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const selicFormatted = formatPercentPtBr(macroSnapshot.annualSelicPct);
  const cdiFormatted = formatPercentPtBr(macroSnapshot.annualCDIPct);
  const ipcaFormatted = formatPercentPtBr(macroSnapshot.annualIPCAPct);
  const realInterestFormatted = formatPercentPtBr(macroSnapshot.realInterestAnnualPct);

  // Filtro por instituição bancária
  const filteredInvestments = useMemo(() => {
    if (!selectedBankSlug || selectedBankSlug === "all") {
      return investments;
    }
    return investments.filter((inv) => {
      const slug = (
        inv.institution_slug ||
        inv.institution_name ||
        inv.bank_name ||
        ""
      ).toLowerCase();
      return slug.includes(selectedBankSlug.toLowerCase());
    });
  }, [investments, selectedBankSlug]);

  // Separação estrita de posições ativas vs resgatadas/zeradas
  const activeInvestments = useMemo(() => {
    return filteredInvestments.filter(
      (inv) => Number(inv.balance) > 0 && inv.status !== "TOTAL_WITHDRAWAL"
    );
  }, [filteredInvestments]);

  const redeemedInvestments = useMemo(() => {
    return filteredInvestments.filter(
      (inv) => Number(inv.balance) <= 0 || inv.status === "TOTAL_WITHDRAWAL"
    );
  }, [filteredInvestments]);

  // Análise de Garantia e Concentração do FGC por Emissor Real
  const fgcAnalysis = useMemo(() => {
    const map = new Map<
      string,
      { issuerName: string; totalBalance: number; count: number; items: typeof activeInvestments }
    >();

    activeInvestments.forEach((inv) => {
      const type = (inv.type || "").toUpperCase();
      const isFgcEligible =
        ["CDB", "LCI", "LCA", "RDB", "POUPANCA"].includes(type) ||
        (inv.name || "").toLowerCase().includes("cdb") ||
        (inv.name || "").toLowerCase().includes("lci") ||
        (inv.name || "").toLowerCase().includes("lca") ||
        (inv.name || "").toLowerCase().includes("rdb");

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
        items: [],
      };
      existing.totalBalance += bal;
      existing.count += 1;
      existing.items.push(inv);
      map.set(issuer, existing);
    });

    const FGC_CEILING = 250000;
    const issuers = Array.from(map.values()).sort((a, b) => b.totalBalance - a.totalBalance);
    const totalEligible = issuers.reduce((s, i) => s + i.totalBalance, 0);
    const totalExposed = issuers.reduce(
      (s, i) => s + Math.max(0, i.totalBalance - FGC_CEILING),
      0
    );
    const totalProtected = totalEligible - totalExposed;

    return {
      issuers,
      totalEligible,
      totalProtected,
      totalExposed,
      isFullyProtected: totalExposed === 0,
      FGC_CEILING,
    };
  }, [activeInvestments]);

  // Simulador de Equivalência Tributária (CDB vs. LCI/LCA)
  const taxCompResult = useMemo(() => {
    return compareTaxExemptVsTaxable({
      cdbPercentCDI: cdbRateInput,
      lciPercentCDI: lciRateInput,
      calendarDays: taxCompDays,
    });
  }, [cdbRateInput, lciRateInput, taxCompDays]);

  // Auditoria transparente de composição: grandes posições vs menores aportes
  const portfolioAudit = useMemo(() => {
    const major = activeInvestments.filter((i) => (Number(i.balance) || 0) >= 5000);
    const minor = activeInvestments.filter((i) => (Number(i.balance) || 0) < 5000);
    const majorTotal = major.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    const minorTotal = minor.reduce((s, i) => s + (Number(i.balance) || 0), 0);

    // Resgates recentes identificados nos extratos bancários
    const recentRedemptions = transactions
      .filter((t) => {
        const desc = (t.clean_description || t.description || "").toLowerCase();
        return desc.includes("resgate cdb") || desc.includes("resgate rdb");
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    return {
      majorPositions: major,
      minorPositions: minor,
      majorTotal,
      minorTotal,
      recentRedemptions,
    };
  }, [activeInvestments, transactions]);

  // Total investido consolidado (apenas posições ativas com saldo > 0)
  const totalInvested = useMemo(() => {
    return activeInvestments.reduce(
      (sum, inv) => sum + (Number(inv.balance) || 0),
      0
    );
  }, [activeInvestments]);

  // Rendimento Acumulado e Rendimento Estimado em Tempo Real
  const { totalProfit, estimatedMonthlyYield, historicalYieldCount } = useMemo(() => {
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
    let yieldTxnCount = 0;
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
        const amt = Math.abs(Number(t.amount) || 0);
        txnYieldTotal += amt;
        yieldTxnCount++;
      }
    });

    const effectiveAccruedProfit = hasBankProfit
      ? profit
      : txnYieldTotal > 0
      ? txnYieldTotal
      : Math.round(totalInvested * (macroSnapshot.annualCDIPct / 100) * 0.5);

    const monthlyRate = macroSnapshot.monthlyCDICompoundFactor;
    const monthlyProj = Math.round(totalInvested * monthlyRate * 100) / 100;

    return {
      totalProfit: effectiveAccruedProfit,
      estimatedMonthlyYield: monthlyProj,
      historicalYieldCount: yieldTxnCount,
    };
  }, [filteredInvestments, transactions, totalInvested, macroSnapshot]);

  // Saldo líquido em contas correntes e poupança
  const liquidCash = useMemo(() => {
    return accounts
      .filter((a) => a.type !== "CREDIT" && a.subtype !== "CREDIT_CARD")
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const netTotalPortfolio = liquidCash + totalInvested;

  // Categorização inteligente das posições
  const categorizedInvestments = useMemo(() => {
    const categories: Record<
      string,
      { label: string; icon: string; items: any[]; total: number }
    > = {
      fixed_income: {
        label: "Renda Fixa & CDBs",
        icon: "account_balance",
        items: [],
        total: 0,
      },
      treasury: {
        label: "Tesouro Direto",
        icon: "flag",
        items: [],
        total: 0,
      },
      funds: {
        label: "Fundos de Investimento",
        icon: "pie_chart",
        items: [],
        total: 0,
      },
      equities: {
        label: "Renda Variável & FIIs",
        icon: "trending_up",
        items: [],
        total: 0,
      },
      other: {
        label: "Outros Títulos",
        icon: "savings",
        items: [],
        total: 0,
      },
    };

    filteredInvestments.forEach((inv) => {
      const name = (inv.name || "").toLowerCase();
      const type = (inv.type || "").toLowerCase();
      const subtype = (inv.subtype || "").toLowerCase();
      const bal = Number(inv.balance) || 0;

      if (name.includes("tesouro") || type.includes("treasury")) {
        categories.treasury.items.push(inv);
        categories.treasury.total += bal;
      } else if (
        name.includes("cdb") ||
        name.includes("lci") ||
        name.includes("lca") ||
        name.includes("di") ||
        type.includes("fixed") ||
        subtype.includes("fixed")
      ) {
        categories.fixed_income.items.push(inv);
        categories.fixed_income.total += bal;
      } else if (name.includes("fundo") || type.includes("fund")) {
        categories.funds.items.push(inv);
        categories.funds.total += bal;
      } else if (
        name.includes("fii") ||
        name.includes("ação") ||
        name.includes("stock") ||
        type.includes("equity")
      ) {
        categories.equities.items.push(inv);
        categories.equities.total += bal;
      } else {
        categories.other.items.push(inv);
        categories.other.total += bal;
      }
    });

    return categories;
  }, [filteredInvestments]);

  // Estratégia de Alocação Recomendada conforme Patrimônio
  const recommendedStrategy = useMemo(() => {
    if (netTotalPortfolio < 50000) {
      return {
        stage: "Fase 1: Blindagem & Reserva de Emergência",
        badgeColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        summary:
          "Seu patrimônio está na etapa de formação do colchão de segurança. Priorize 85% a 90% em liquidez diária (CDI 100%+ ou Tesouro Selic) até cobrir 6 meses do seu custo de vida.",
        allocation: [
          { label: "Pós-Fixado (Liquidez Diária)", target: 85, color: "bg-emerald-500" },
          { label: "Inflação (Tesouro IPCA+)", target: 15, color: "bg-[#FF8216]" },
        ],
        action:
          "Garanta que seu dinheiro de reserva não esteja na poupança, mas sim em CDB de liquidez diária ou Tesouro Selic.",
      };
    } else if (netTotalPortfolio < 200000) {
      return {
        stage: "Fase 2: Aceleração & Juro Real",
        badgeColor: "text-[#FF8216] bg-[#FF8216]/10 border-[#FF8216]/20",
        summary:
          "Com a reserva montada, aproveite o ciclo de juros altos do Brasil para travar taxas de inflação (IPCA + 6%) e iniciar exposição em Fundos Imobiliários para fluxo mensal isento.",
        allocation: [
          { label: "Renda Fixa CDI", target: 55, color: "bg-emerald-500" },
          { label: "Tesouro IPCA+ (Médio/Longo Prazo)", target: 30, color: "bg-[#FF8216]" },
          { label: "Fundos Imobiliários (FIIs)", target: 15, color: "bg-amber-500" },
        ],
        action:
          "Alavanque os aportes em títulos IPCA+ para proteger o poder de compra contra a inflação de longo prazo.",
      };
    } else {
      return {
        stage: "Fase 3: Multiplicação & Liberdade Financeira (FIRE)",
        badgeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        summary:
          "Patrimônio consolidado. Foco em geração de renda passiva consistente e preservação global de capital.",
        allocation: [
          { label: "Renda Fixa Pós/Pré", target: 40, color: "bg-emerald-500" },
          { label: "Tesouro IPCA+ Aposentadoria", target: 25, color: "bg-[#FF8216]" },
          { label: "Fundos Imobiliários & Dividendos", target: 20, color: "bg-amber-500" },
          { label: "Dólar / Ativos Globais", target: 15, color: "bg-zinc-400" },
        ],
        action:
          "Reinvista 100% dos dividendos recebidos para potencializar o efeito bola de neve dos juros compostos.",
      };
    }
  }, [netTotalPortfolio]);

  const auditPrompt = `Faça uma análise estratégica completa da minha carteira de investimentos. Tenho ${formatSensitiveCurrency(
    totalInvested
  )} investidos distribuídos em ${filteredInvestments.length} títulos, além de ${formatSensitiveCurrency(
    liquidCash
  )} em liquidez. Considerando a taxa Selic oficial vigente de ${selicFormatted} (CDI ${cdiFormatted}) e inflação IPCA de ${ipcaFormatted}, onde estou deixando dinheiro na mesa e qual deveria ser meu plano de aportes para o próximo mês?`;

  return (
    <div className="flex-1 w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-[#F8FAFC] p-4 md:p-8 pt-6 md:pt-8 pb-28 md:pb-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#27272A]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="material-symbols-outlined text-lg leading-none">trending_up</span>
              </span>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Investimentos & Carteira Consolidada
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8]">
              Visão unificada de CDBs, Tesouro Direto e Fundos de todos os seus bancos com análise macroeconômica brasileira.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/kitsune?prompt=${encodeURIComponent(auditPrompt)}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>Auditar Carteira com Kitsune AI</span>
            </Link>
          </div>
        </div>

        {/* 4 KPIs de Patrimônio & Investimentos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Investido</span>
              <span className="material-symbols-outlined text-sm text-emerald-500">savings</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-500 tabular-nums">
              {formatSensitiveCurrency(totalInvested)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {filteredInvestments.length} posições ativas
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Rendimento Mensal Estimado</span>
              <span className="material-symbols-outlined text-sm text-emerald-500">trending_up</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-500 tabular-nums">
              + {formatSensitiveCurrency(estimatedMonthlyYield)}
              <span className="text-xs font-semibold text-slate-400">/mês</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              100% do CDI vigente ({cdiFormatted} a.a.)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Lucro Acumulado & Proventos</span>
              <span className="material-symbols-outlined text-sm text-[#FF8216]">show_chart</span>
            </div>
            <div className="text-xl font-extrabold text-[#FF8216] tabular-nums">
              + {formatSensitiveCurrency(totalProfit)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Ganhos de capital & dividendos reportados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Liquidez Livre em Conta</span>
              <span className="material-symbols-outlined text-sm text-[#FF8216]">account_balance_wallet</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {formatSensitiveCurrency(liquidCash)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Disponível para novos aportes
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Patrimônio Bruto Total</span>
              <span className="material-symbols-outlined text-sm text-amber-500">account_balance</span>
            </div>
            <div className="text-xl font-extrabold text-amber-500 tabular-nums">
              {formatSensitiveCurrency(netTotalPortfolio)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Liquidez + Investimentos
            </span>
          </div>
        </div>

        {/* Painel Macroeconômico Brasil em Tempo Real */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-slate-900 dark:text-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#27272A]">
            <div className="flex items-center gap-2">
              <span className="text-lg">🇧🇷</span>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Termômetro Macroeconômico BCB Ao Vivo</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {macroSnapshot.source === "brasilapi_live" || macroSnapshot.source === "cache"
                      ? "BrasilAPI • BCB Sync"
                      : "Referência BCB"}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  Taxas oficiais do Banco Central (cache 12h) alimentando rentabilidade real, IR regressivo e Fisher
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 tabular-nums">
              Juro Real Fisher: +{realInterestFormatted} a.a.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Taxa Selic</span>
              <span className="text-base font-extrabold text-emerald-500 tabular-nums">{selicFormatted}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Meta Copom BCB</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">CDI Anual</span>
              <span className="text-base font-extrabold text-emerald-500 tabular-nums">{cdiFormatted}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Benchmark Renda Fixa</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">IPCA Acumulado</span>
              <span className="text-base font-extrabold text-[#FF8216] tabular-nums">{ipcaFormatted}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Inflação Oficial IBGE</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Juro Real (Fisher)</span>
              <span className="text-base font-extrabold text-emerald-500 tabular-nums">+{realInterestFormatted}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Ganho Acima da Inflação</span>
            </div>
          </div>
        </div>

        {/* Monitor de Garantia FGC por Conglomerado Emissor (R$ 250k por Emissor) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="material-symbols-outlined text-lg">verified_user</span>
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Monitor de Garantia FGC por Conglomerado Emissor</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      fgcAnalysis.isFullyProtected
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    }`}
                  >
                    {fgcAnalysis.isFullyProtected ? "100% Protegido pelo FGC" : "Atenção: Limite Excedido"}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  Auditoria de teto máximo de R$ 250.000,00 por instituição financeira emissora (Resolução CMN nº 4.222)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Total Elegível:</span>
              <span className="font-extrabold text-emerald-500 tabular-nums">
                {formatSensitiveCurrency(fgcAnalysis.totalProtected)}
              </span>
              {fgcAnalysis.totalExposed > 0 && (
                <span className="font-extrabold text-rose-500 tabular-nums">
                  ({formatSensitiveCurrency(fgcAnalysis.totalExposed)} expostos)
                </span>
              )}
            </div>
          </div>

          {/* Grid de Conglomerados Emissores */}
          {fgcAnalysis.issuers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Nenhum título elegível ao FGC (CDB, LCI, LCA, RDB) encontrado na carteira ativa.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {fgcAnalysis.issuers.map((item) => {
                const pct = Math.min(100, Math.round((item.totalBalance / fgcAnalysis.FGC_CEILING) * 100));
                const isExceeded = item.totalBalance > fgcAnalysis.FGC_CEILING;
                const isCaution = item.totalBalance >= 220000 && !isExceeded;

                return (
                  <div
                    key={item.issuerName}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={item.issuerName}>
                        {item.issuerName}
                      </span>
                      <div className="text-right tabular-nums">
                        <span
                          className={`font-extrabold ${
                            isExceeded ? "text-rose-500" : isCaution ? "text-[#FF8216]" : "text-emerald-500"
                          }`}
                        >
                          {formatSensitiveCurrency(item.totalBalance)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">/ R$ 250k</span>
                      </div>
                    </div>

                    {/* Barra de Utilização do Teto */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full transition-all ${
                          isExceeded ? "bg-rose-500" : isCaution ? "bg-[#FF8216]" : "bg-emerald-500"
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{item.count} título(s) vinculados</span>
                      <span
                        className={`font-semibold ${
                          isExceeded ? "text-rose-400" : isCaution ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {isExceeded
                          ? `Excede em ${formatSensitiveCurrency(item.totalBalance - fgcAnalysis.FGC_CEILING)}`
                          : `${pct}% do teto utilizado`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simulador de Equivalência Tributária & Juro Real Fisher */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                <span className="material-symbols-outlined text-lg">calculate</span>
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Simulador de Equivalência Tributária (CDB vs. LCI/LCA)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  Compare títulos tributados vs. isentos de IR considerando a tabela regressiva da Receita Federal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { days: 180, label: "Até 180d (IR 22,5%)" },
                { days: 360, label: "360d (IR 20,0%)" },
                { days: 720, label: "720d (IR 17,5%)" },
                { days: 1080, label: "> 720d (IR 15,0%)" },
              ].map((btn) => (
                <button
                  key={btn.days}
                  type="button"
                  onClick={() => setTaxCompDays(btn.days)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    taxCompDays === btn.days
                      ? "bg-[#FF8216] text-white border-[#FF8216]"
                      : "bg-slate-50 dark:bg-[#18181B] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-[#27272A] hover:text-white"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Input CDB */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Taxa CDB (% do CDI)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={200}
                  value={cdbRateInput}
                  onChange={(e) => setCdbRateInput(Number(e.target.value) || 100)}
                  className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-slate-900 dark:text-white font-extrabold text-sm focus:outline-none focus:border-[#FF8216]"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">% CDI</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Equivale a LCI/LCA de <strong>{taxCompResult.equivalentLCIRateForCDB}% CDI</strong>
              </span>
            </div>

            {/* Input LCI */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Taxa LCI / LCA (% do CDI)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={200}
                  value={lciRateInput}
                  onChange={(e) => setLciRateInput(Number(e.target.value) || 85)}
                  className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-slate-900 dark:text-white font-extrabold text-sm focus:outline-none focus:border-[#FF8216]"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">% CDI (Isento)</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Equivale a CDB de <strong>{taxCompResult.equivalentCDBRateForLCI}% CDI</strong>
              </span>
            </div>

            {/* Veredito */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Veredito Matemático</span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black border ${
                    taxCompResult.winner === "CDB"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : taxCompResult.winner === "LCI_LCA"
                      ? "bg-[#FF8216]/10 text-[#FF8216] border-[#FF8216]/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}
                >
                  {taxCompResult.winner === "CDB"
                    ? "🏆 CDB Vence"
                    : taxCompResult.winner === "LCI_LCA"
                    ? "🏆 LCI/LCA Vence"
                    : "⚖️ Empate Técnico"}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                  +{taxCompResult.spreadAdvantagePctCDI}% spread
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 mt-1">
                {taxCompResult.explanationPtBr}
              </p>
            </div>
          </div>
        </div>

        {/* Recomendação de Alocação de Acordo com o Perfil e Patrimônio do Usuário */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF8216]">psychology</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Recomendação de Alocação Inteligente (Kitsune Strategy)
              </h2>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${recommendedStrategy.badgeColor}`}
            >
              {recommendedStrategy.stage}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-[#94A3B8] leading-relaxed">
            {recommendedStrategy.summary}
          </p>

          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Distribuição Alvo Recomendada
            </span>
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/5 flex overflow-hidden">
              {recommendedStrategy.allocation.map((item, idx) => (
                <div
                  key={idx}
                  style={{ width: `${item.target}%` }}
                  className={`${item.color} h-full transition-all`}
                  title={`${item.label}: ${item.target}%`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              {recommendedStrategy.allocation.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">({item.target}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Painel de Auditoria & Transparência da Carteira (R$ 80-90k vs R$ 106k) */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                <span className="material-symbols-outlined text-lg">insights</span>
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Auditoria de Composição da Carteira
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  Entenda o detalhamento entre seus grandes títulos e aportes complementares
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRedeemed((prev) => !prev);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  showRedeemed
                    ? "bg-[#FF8216]/15 border-[#FF8216]/50 text-[#FF8216]"
                    : "bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-slate-300 hover:text-white"
                }`}
              >
                {showRedeemed ? "Ocultar Resgatados" : `Ver Resgatados (${redeemedInvestments.length})`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/60 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Núcleo Principal ({portfolioAudit.majorPositions.length} CDBs &gt; R$ 5k)
              </span>
              <span className="text-base font-black text-emerald-500 tabular-nums block mt-0.5">
                {formatSensitiveCurrency(portfolioAudit.majorTotal)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ~{totalInvested > 0 ? Math.round((portfolioAudit.majorTotal / totalInvested) * 100) : 0}% da sua carteira ativa
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/60 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Aportes Complementares ({portfolioAudit.minorPositions.length} posições &lt; R$ 5k)
              </span>
              <span className="text-base font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
                {formatSensitiveCurrency(portfolioAudit.minorTotal)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Pequenas aplicações e sobras de caixa
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/60 dark:border-[#27272A]">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Resgates Recentes Identificados
              </span>
              <span className="text-base font-black text-amber-500 tabular-nums block mt-0.5">
                {formatSensitiveCurrency(portfolioAudit.recentRedemptions)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Valores já liquidados para conta corrente
              </span>
            </div>
          </div>
        </div>

        {/* Filtros por Categoria de Investimento */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setActiveCategoryFilter("all");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategoryFilter === "all"
                ? "bg-[#FF8216] text-white shadow-xs"
                : "bg-white dark:bg-[#121214] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-[#18181B]"
            }`}
          >
            {showRedeemed
              ? `Todos (${filteredInvestments.length})`
              : `Ativos (${activeInvestments.length})`}
          </button>
          {Object.entries(categorizedInvestments).map(([key, cat]) => {
            if (cat.items.length === 0) return null;
            const isActive = activeCategoryFilter === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveCategoryFilter(key);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#FF8216] text-white shadow-xs"
                    : "bg-white dark:bg-[#121214] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-[#18181B]"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                <span>{cat.label} ({cat.items.length})</span>
              </button>
            );
          })}
        </div>

        {/* Listagem dos Títulos Conectados com Paginação */}
        {(() => {
          const sourceList = showRedeemed ? filteredInvestments : activeInvestments;
          const displayItems = sourceList.filter((inv) => {
            if (activeCategoryFilter === "all") return true;
            const cat = categorizedInvestments[activeCategoryFilter];
            return cat ? cat.items.some((i) => i.id === inv.id) : true;
          });

          const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
          const safePage = Math.min(currentPage, totalPages);
          const startIndex = (safePage - 1) * PAGE_SIZE;
          const pagedItems = displayItems.slice(startIndex, startIndex + PAGE_SIZE);

          return (
            <div className="space-y-3">
              {displayItems.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] rounded-2xl flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-3xl text-slate-400">savings</span>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Nenhum título de investimento retornado para este filtro. Conecte sua corretora ou banco pelo Open Finance para acompanhar sua carteira.
                  </p>
                  <Link
                    href="/agents"
                    className="px-4 py-2 rounded-xl bg-[#FF8216] text-white text-xs font-bold shadow-xs hover:bg-[#FFA047]"
                  >
                    Conectar Instituição no Open Finance
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      Exibindo <strong>{startIndex + 1}</strong> a{" "}
                      <strong>{Math.min(startIndex + PAGE_SIZE, displayItems.length)}</strong> de{" "}
                      <strong>{displayItems.length}</strong> títulos
                    </span>
                    <span>Página {safePage} de {totalPages}</span>
                  </div>

                  <div className="space-y-2.5">
                    {pagedItems.map((inv) => {
                      const bal = Number(inv.balance) || 0;
                      const profit = Number(inv.amount_profit) || 0;
                      const isZero = bal <= 0 || inv.status === "TOTAL_WITHDRAWAL";
                      const bankSlug =
                        inv.institution_slug ||
                        inv.institution_name ||
                        inv.bank_name ||
                        "generic";

                      return (
                        <div
                          key={inv.id}
                          className={`p-4 rounded-2xl bg-white dark:bg-[#121214] border transition-all shadow-xs flex items-center justify-between gap-4 ${
                            isZero
                              ? "border-dashed border-slate-200 dark:border-[#27272A] opacity-60"
                              : "border-slate-200 dark:border-[#27272A] hover:border-[#FF8216]/40"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <BankLogo bank={bankSlug} size="sm" />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {inv.name || inv.code || "Título de Investimento"}
                                </span>
                                {isZero && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-white/10 text-slate-400">
                                    Resgatado / Zerado
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                                <span>{inv.institution_name || inv.bank_name || "Banco"}</span>
                                {inv.issuer &&
                                  String(inv.issuer).trim().toLowerCase() !==
                                    String(inv.institution_name || inv.bank_name || "").trim().toLowerCase() && (
                                    <>
                                      <span>•</span>
                                      <span className="text-zinc-300 font-semibold">
                                        Emissor FGC: {inv.issuer}
                                      </span>
                                    </>
                                  )}
                                {inv.rate && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-500 font-bold">{inv.rate}% CDI</span>
                                  </>
                                )}
                                {inv.due_date && (
                                  <>
                                    <span>•</span>
                                    <span>Vencimento: {parseLocalDate(inv.due_date).toLocaleDateString("pt-BR")}</span>
                                  </>
                                )}
                                {inv.type && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-[10px] text-slate-400 uppercase font-semibold">
                                    {inv.type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-xs md:text-base font-extrabold tabular-nums block ${
                              isZero ? "text-slate-400" : "text-emerald-500"
                            }`}>
                              {formatSensitiveCurrency(bal)}
                            </span>
                            {profit > 0 ? (
                              <span className="text-[10px] text-emerald-400 font-semibold block">
                                Lucro: +{formatSensitiveCurrency(profit)}
                              </span>
                            ) : isZero ? (
                              <span className="text-[10px] text-slate-400 font-medium block">
                                Posição liquidada
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#FF8216] font-medium block">
                                Rendendo ~+{formatSensitiveCurrency(Math.round(bal * macroSnapshot.monthlyCDICompoundFactor))}/mês
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Controles de Paginação (1, 2, 3...) */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1.5 pt-4">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121214] text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-[#18181B] transition-colors cursor-pointer"
                      >
                        Anterior
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            safePage === pageNum
                              ? "bg-[#FF8216] text-white shadow-xs"
                              : "bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-[#18181B]"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121214] text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-[#18181B] transition-colors cursor-pointer"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
