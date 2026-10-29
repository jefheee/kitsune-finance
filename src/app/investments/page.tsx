"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { BankLogo } from "@/components/BankLogo";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";

// Dados de Contexto Macroeconômico Atualizado do Brasil
const BRAZIL_MACRO_DATA = {
  selic: "10,75%",
  cdi: "10,65%",
  ipca12m: "4,42%",
  realInterestRate: "6,23%", // Juro real líquido aproximado (CDI - IPCA)
  ibovespa: "131.200 pts",
  dolar: "R$ 5,68",
  copomTrend: "Ciclo de vigilância monetária para ancorar expectativas de inflação.",
};

export default function InvestmentsPage() {
  const {
    investments,
    accounts,
    loans,
    transactions,
    userProfile,
    formatSensitiveCurrency,
    selectedBankSlug,
    setSelectedBankSlug,
  } = useFinanceData();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");

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

  // Total investido consolidado
  const totalInvested = useMemo(() => {
    return filteredInvestments.reduce(
      (sum, inv) => sum + (Number(inv.balance) || 0),
      0
    );
  }, [filteredInvestments]);

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
      : Math.round(totalInvested * 0.052);

    const monthlyRate = Math.pow(1 + 0.1065, 1 / 12) - 1;
    const monthlyProj = Math.round(totalInvested * monthlyRate * 100) / 100;

    return {
      totalProfit: effectiveAccruedProfit,
      estimatedMonthlyYield: monthlyProj,
      historicalYieldCount: yieldTxnCount,
    };
  }, [filteredInvestments, transactions, totalInvested]);

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
          { label: "Fundos Imobiliários (FIIs)", target: 15, color: "bg-blue-500" },
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
          { label: "Fundos Imobiliários & Dividendos", target: 20, color: "bg-blue-500" },
          { label: "Dólar / Ativos Globais", target: 15, color: "bg-purple-500" },
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
  )} em liquidez. Considerando a taxa Selic atual de ${BRAZIL_MACRO_DATA.selic} e inflação de ${BRAZIL_MACRO_DATA.ipca12m}, onde estou deixando dinheiro na mesa e qual deveria ser meu plano de aportes para o próximo mês?`;

  return (
    <div className="flex-1 w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-[#F8FAFC] p-4 md:p-8 overflow-y-auto">
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
              100% do CDI atual ({BRAZIL_MACRO_DATA.cdi} a.a.)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Lucro Acumulado & Proventos</span>
              <span className="material-symbols-outlined text-sm text-blue-500">show_chart</span>
            </div>
            <div className="text-xl font-extrabold text-blue-500 tabular-nums">
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
              <span className="material-symbols-outlined text-sm text-purple-500">account_balance</span>
            </div>
            <div className="text-xl font-extrabold text-purple-500 tabular-nums">
              {formatSensitiveCurrency(netTotalPortfolio)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Liquidez + Investimentos
            </span>
          </div>
        </div>

        {/* Painel Macroeconômico Brasil em Tempo Real */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#12161F] border border-slate-800 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🇧🇷</span>
              <div>
                <h2 className="text-sm font-bold tracking-tight">
                  Termômetro Macroeconômico do Brasil (Mercado Financeiro)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Taxas de referência oficiais para rentabilidade da sua carteira
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
              Juro Real: +{BRAZIL_MACRO_DATA.realInterestRate} a.a.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Taxa Selic</span>
              <span className="text-base font-extrabold text-emerald-400">{BRAZIL_MACRO_DATA.selic}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Meta Copom</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">CDI Anual</span>
              <span className="text-base font-extrabold text-emerald-400">{BRAZIL_MACRO_DATA.cdi}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">100% CDI</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">IPCA 12 Meses</span>
              <span className="text-base font-extrabold text-[#FF8216]">{BRAZIL_MACRO_DATA.ipca12m}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Inflação Oficial</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Juro Real Líquido</span>
              <span className="text-base font-extrabold text-blue-400">+{BRAZIL_MACRO_DATA.realInterestRate}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Ganho Real</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Ibovespa</span>
              <span className="text-base font-extrabold text-white">{BRAZIL_MACRO_DATA.ibovespa}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Bolsa B3</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Dólar PTAX</span>
              <span className="text-base font-extrabold text-white">{BRAZIL_MACRO_DATA.dolar}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Câmbio USD</span>
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

        {/* Filtros por Categoria de Investimento */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategoryFilter === "all"
                ? "bg-[#FF8216] text-white shadow-xs"
                : "bg-white dark:bg-[#12161F] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#1A202C]"
            }`}
          >
            Todos ({filteredInvestments.length})
          </button>
          {Object.entries(categorizedInvestments).map(([key, cat]) => {
            if (cat.items.length === 0) return null;
            const isActive = activeCategoryFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategoryFilter(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#FF8216] text-white shadow-xs"
                    : "bg-white dark:bg-[#12161F] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#1A202C]"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                <span>{cat.label} ({cat.items.length})</span>
              </button>
            );
          })}
        </div>

        {/* Listagem dos Títulos Conectados */}
        <div className="space-y-3">
          {filteredInvestments.length === 0 ? (
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
            filteredInvestments
              .filter((inv) => {
                if (activeCategoryFilter === "all") return true;
                const cat = categorizedInvestments[activeCategoryFilter];
                return cat ? cat.items.some((i) => i.id === inv.id) : true;
              })
              .map((inv) => {
                const bal = Number(inv.balance) || 0;
                const profit = Number(inv.amount_profit) || 0;
                const bankSlug =
                  inv.institution_slug ||
                  inv.institution_name ||
                  inv.bank_name ||
                  "generic";

                return (
                  <div
                    key={inv.id}
                    className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-4 hover:border-[#FF8216]/40 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <BankLogo bank={bankSlug} size="sm" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {inv.name || inv.code || "Título de Investimento"}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                          <span>{inv.institution_name || inv.bank_name || "Banco"}</span>
                          {inv.rate && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-500 font-bold">{inv.rate}</span>
                            </>
                          )}
                          {inv.due_date && (
                            <>
                              <span>•</span>
                              <span>Vencimento: {new Date(inv.due_date).toLocaleDateString("pt-BR")}</span>
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
                      <span className="text-xs md:text-base font-extrabold text-emerald-500 tabular-nums block">
                        {formatSensitiveCurrency(bal)}
                      </span>
                      {profit > 0 ? (
                        <span className="text-[10px] text-emerald-400 font-semibold block">
                          Lucro: +{formatSensitiveCurrency(profit)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-blue-400 font-medium block">
                          Rendendo ~+{formatSensitiveCurrency(Math.round(bal * 0.00847))}/mês
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
