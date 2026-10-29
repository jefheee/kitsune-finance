"use client";

import { useState } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";

interface AiDiagnosticPanelProps {
  aiInsight: { text: string; updatedAt: string } | null;
  isGenerating: boolean;
  onRefresh: () => void;
  totalBalance: number;
  liquidBalance: number;
  creditCardBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  kitsuneScore: { score: number; label: string; color: string };
  formatCurrency: (val: number) => string;
}

interface ParsedDiagnostic {
  headline: string;
  summary: string;
  score: number;
  scoreLabel: string;
  cards: Array<{
    title: string;
    value: string;
    badge: string;
    status: "positive" | "warning" | "danger" | "neutral";
    desc: string;
  }>;
  actionPoints: Array<{
    icon: string;
    title: string;
    desc: string;
  }>;
  fullReport: string;
}

export function AiDiagnosticPanel({
  aiInsight,
  isGenerating,
  onRefresh,
  totalBalance,
  liquidBalance,
  creditCardBalance,
  monthlyIncome,
  monthlyExpense,
  kitsuneScore,
  formatCurrency,
}: AiDiagnosticPanelProps) {
  const [showFullReport, setShowFullReport] = useState(false);

  // Cálculos determinísticos da camada MSLR (Zero alucinação em métricas)
  const margin = monthlyIncome - monthlyExpense;
  const isLiquidOk = liquidBalance >= creditCardBalance;
  const liquidRatio =
    creditCardBalance > 0
      ? (liquidBalance / creditCardBalance).toFixed(1) + "x"
      : "Folga Total";

  const deterministicCards: ParsedDiagnostic["cards"] = [
    {
      title: "Cobertura de Liquidez",
      value: formatCurrency(liquidBalance),
      badge: isLiquidOk
        ? creditCardBalance === 0
          ? "Sem Passivos"
          : "Faturas Cobertas"
        : "Atenção de Caixa",
      status: isLiquidOk ? "positive" : "warning",
      desc:
        creditCardBalance > 0
          ? `Patrimônio líquido disponível cobre ${liquidRatio} das faturas abertas.`
          : "Patrimônio líquido equivalente ao saldo disponível, sem faturas pendentes.",
    },
    {
      title: "Gastos Operacionais",
      value: formatCurrency(monthlyExpense),
      badge: monthlyExpense > 0 ? "Despesas Reais" : "Sem Saídas",
      status: monthlyExpense > 0 ? "neutral" : "positive",
      desc: "Total de saídas reais conciliadas (excluídas transferências próprias).",
    },
    {
      title: "Margem Operacional",
      value: formatCurrency(Math.abs(margin)),
      badge: margin >= 0 ? "Superávit" : "Déficit",
      status: margin >= 0 ? "positive" : "danger",
      desc:
        margin >= 0
          ? `Receitas de ${formatCurrency(monthlyIncome)} superam as despesas no período.`
          : `Despesas superaram as receitas em ${formatCurrency(Math.abs(margin))} no mês.`,
    },
  ];

  // Parser com reconciliação matemática (qualitativo por IA, números estritos por código)
  const parsedData: ParsedDiagnostic = (() => {
    let headline = margin >= 0
      ? "Superávit operacional sólido com liquidez integral mantida."
      : "Atenção: Margem operacional pressionada pelas saídas do ciclo.";
    let summary = margin >= 0
      ? `O mês registra receitas de ${formatCurrency(monthlyIncome)} e despesas operacionais de ${formatCurrency(monthlyExpense)}, gerando margem líquida de ${formatCurrency(margin)}. A liquidez total é de ${formatCurrency(liquidBalance)}.`
      : `O mês registra despesas de ${formatCurrency(monthlyExpense)} frente a receitas de ${formatCurrency(monthlyIncome)}. O saldo disponível é de ${formatCurrency(liquidBalance)}.`;
    let actionPoints: ParsedDiagnostic["actionPoints"] = [
      {
        icon: "shield",
        title: "Blindagem de Caixa",
        desc: creditCardBalance > 0
          ? `Monitore o fechamento da fatura de ${formatCurrency(creditCardBalance)} para garantir alocação eficiente.`
          : "Faturas zeradas. Excelente disciplina operacional mantida.",
      },
      {
        icon: "trending_up",
        title: "Alocação Estratégica",
        desc: margin > 0
          ? `Direcionar a margem operacional de ${formatCurrency(margin)} para instrumentos de renda fixa e reserva.`
          : "Ajuste os desembolsos não essenciais para restabelecer o superávit operacional.",
      },
    ];
    let fullReport = "";

    if (aiInsight?.text) {
      try {
        const json = JSON.parse(aiInsight.text);
        if (json.headline && typeof json.headline === "string") {
          headline = json.headline;
        }

        // Se o resumo da IA for coerente e não contiver números alucinados de transferências próprias, aproveita
        if (
          json.summary &&
          typeof json.summary === "string" &&
          !json.summary.includes("Transferência Própria") &&
          !json.summary.includes("11064")
        ) {
          summary = json.summary;
        }

        if (Array.isArray(json.actionPoints) && json.actionPoints.length > 0) {
          actionPoints = json.actionPoints.filter(
            (p: any) => p && typeof p.title === "string" && !p.title.includes("Transferência Própria")
          );
        }

        if (json.fullReport && typeof json.fullReport === "string") {
          fullReport = json.fullReport;
        }
      } catch {
        // Fallback para texto plano
        const clean = aiInsight.text.replace(/\*\*/g, "").replace(/#{1,6}\s?/g, "");
        const parts = clean.split("\n\n").filter(Boolean);
        if (parts.length > 0) fullReport = clean;
      }
    }

    return {
      headline,
      summary,
      score: kitsuneScore.score,
      scoreLabel: kitsuneScore.label,
      cards: deterministicCards,
      actionPoints,
      fullReport: fullReport || summary,
    };
  })();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "positive":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "danger":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-[#94A3B8] border-slate-200 dark:border-white/10";
    }
  };

  return (
    <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] rounded-2xl p-5 md:p-6 shadow-xs flex flex-col gap-5 transition-all duration-700 ease-out animate-in fade-in">
      {/* Top Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#27272A] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-[#FF8216]">
              psychology
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
                Diagnóstico & Parecer da Kitsune AI
              </h2>
              <span className={`text-[11px] font-extrabold ${kitsuneScore.color}`}>
                Score: {parsedData.score} • {parsedData.scoreLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#94A3B8]">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auditoria via Open Finance
              </span>
              {aiInsight?.updatedAt && (
                <>
                  <span>•</span>
                  <span>
                    Atualizado às{" "}
                    {new Date(aiInsight.updatedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Botões Superiores */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Link
            href={`/kitsune?prompt=${encodeURIComponent(
              `Kitsune AI, gostaria de aprofundar meu diagnóstico financeiro do período. Minhas receitas são de ${formatCurrency(
                monthlyIncome
              )}, despesas de ${formatCurrency(
                monthlyExpense
              )} e faturas abertas de ${formatCurrency(
                creditCardBalance
              )}. Quais são as recomendações mais estratégicas para mim hoje?`
            )}`}
            className="h-8 px-3 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">chat</span>
            <span>Conversar</span>
          </Link>

          <button
            onClick={onRefresh}
            disabled={isGenerating}
            title="Recalcular diagnóstico agora"
            className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-[#18181B] hover:bg-slate-200 dark:hover:bg-[#27272A] text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-[#27272A] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[15px] ${
                isGenerating ? "animate-spin text-[#FF8216]" : ""
              }`}
            >
              sync
            </span>
            <span>{isGenerating ? "Auditando..." : "Atualizar"}</span>
          </button>
        </div>
      </div>

      {/* Resumo Executivo com transição suave */}
      <div className="flex flex-col gap-2 transition-opacity duration-500 ease-out">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#F8FAFC]">
          {parsedData.headline}
        </h3>
        <p className="text-xs md:text-sm text-slate-600 dark:text-[#94A3B8] leading-relaxed">
          {parsedData.summary}
        </p>
      </div>

      {/* 3 Metric Cards Determinísticos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {parsedData.cards.map((card, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-1.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-[#94A3B8] font-medium truncate">
                {card.title}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(
                  card.status
                )}`}
              >
                {card.badge}
              </span>
            </div>
            <div className="text-base md:text-lg font-black text-slate-900 dark:text-[#F8FAFC] tabular-nums">
              {card.value}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] leading-tight line-clamp-2">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Ações Imediatas Recomendadas com animação fluida */}
      {parsedData.actionPoints.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-[#27272A]/70">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Ações Recomendadas pela Kitsune
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {parsedData.actionPoints.map((act, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#18181B] border border-slate-200/80 dark:border-[#27272A] flex items-start gap-2.5 transition-all duration-500 hover:border-[#FF8216]/40"
              >
                <div className="w-6 h-6 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[14px]">
                    {act.icon}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {act.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-tight">
                    {act.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parecer Expansível */}
      <div className="pt-1">
        <button
          onClick={() => setShowFullReport(!showFullReport)}
          className="text-xs font-bold text-[#FF8216] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>{showFullReport ? "Ocultar Parecer" : "Ver Análise Detalhada"}</span>
          <span className="material-symbols-outlined text-sm">
            {showFullReport ? "expand_less" : "expand_more"}
          </span>
        </button>

        {showFullReport && (
          <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 whitespace-pre-line animate-in fade-in duration-500">
            {parsedData.fullReport}
          </div>
        )}
      </div>
    </div>
  );
}
