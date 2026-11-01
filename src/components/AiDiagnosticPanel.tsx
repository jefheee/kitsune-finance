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

function sanitizeUnformattedNumbers(text: string): string {
  if (!text) return "";
  return text
    .replace(/R\$\s*(\d+)\.(\d{2})\b/g, (_m, intPart, decPart) => {
      const formattedInt = Number(intPart).toLocaleString("pt-BR");
      return `R$ ${formattedInt},${decPart}`;
    })
    .replace(/\b(\d{4,})\.(\d{2})\b/g, (_m, intPart, decPart) => {
      const formattedInt = Number(intPart).toLocaleString("pt-BR");
      return `${formattedInt},${decPart}`;
    });
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
          ? `Disponível em conta cobre ${liquidRatio} do total de faturas abertas.`
          : "Patrimônio líquido disponível sem faturas abertas ou passivos pendentes.",
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

  // Parser com reconciliação matemática e higienização estrita
  const parsedData: ParsedDiagnostic = (() => {
    let headline =
      margin >= 0
        ? "Superávit operacional sólido com liquidez integral mantida."
        : "Atenção: Margem operacional pressionada pelas saídas do ciclo.";
    let summary =
      margin >= 0
        ? `O mês registra receitas de ${formatCurrency(monthlyIncome)} e despesas operacionais de ${formatCurrency(monthlyExpense)}, gerando margem líquida de ${formatCurrency(margin)}. A liquidez em conta é de ${formatCurrency(liquidBalance)}.`
        : `O mês registra despesas de ${formatCurrency(monthlyExpense)} frente a receitas de ${formatCurrency(monthlyIncome)}. A liquidez disponível é de ${formatCurrency(liquidBalance)}.`;
    let actionPoints: ParsedDiagnostic["actionPoints"] = [
      {
        icon: "shield",
        title: "Blindagem de Caixa",
        desc:
          creditCardBalance > 0
            ? `Monitore o fechamento da fatura de ${formatCurrency(creditCardBalance)} para manter a alocação protegida.`
            : "Faturas zeradas. Excelente disciplina operacional e previsibilidade mantida.",
      },
      {
        icon: "trending_up",
        title: "Alocação Estratégica",
        desc:
          margin > 0
            ? `Direcionar a margem operacional de ${formatCurrency(margin)} para instrumentos de renda fixa e reserva.`
            : "Ajuste os desembolsos não essenciais para restabelecer o superávit operacional.",
      },
    ];
    let fullReport = "";

    if (aiInsight?.text) {
      try {
        const json = JSON.parse(aiInsight.text);
        if (json.headline && typeof json.headline === "string") {
          headline = sanitizeUnformattedNumbers(json.headline);
        }

        if (
          json.summary &&
          typeof json.summary === "string" &&
          !json.summary.includes("Transferência Própria")
        ) {
          summary = sanitizeUnformattedNumbers(json.summary);
        }

        if (Array.isArray(json.actionPoints) && json.actionPoints.length > 0) {
          actionPoints = json.actionPoints
            .filter((p: any) => p && typeof p.title === "string")
            .map((p: any) => ({
              icon: p.icon || "check_circle",
              title: sanitizeUnformattedNumbers(p.title),
              desc: sanitizeUnformattedNumbers(p.desc),
            }));
        }

        if (json.fullReport && typeof json.fullReport === "string") {
          fullReport = sanitizeUnformattedNumbers(json.fullReport);
        }
      } catch {
        const clean = sanitizeUnformattedNumbers(
          aiInsight.text.replace(/\*\*/g, "").replace(/#{1,6}\s?/g, "")
        );
        fullReport = clean;
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
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
      case "warning":
        return "bg-amber-500/10 text-amber-400 border-amber-500/25";
      case "danger":
        return "bg-rose-500/10 text-rose-400 border-rose-500/25";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <div className="w-full bg-[#121214] border border-[#27272A] rounded-2xl p-5 md:p-6 shadow-sm flex flex-col gap-5 transition-all duration-300">
      {/* Top Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-b border-[#27272A] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/25 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-[#FF8216]">
              psychology
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-bold text-white">
                Diagnóstico & Parecer da Kitsune AI
              </h2>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#18181B] border border-[#27272A] ${kitsuneScore.color}`}
              >
                Score {parsedData.score}/100 • {parsedData.scoreLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
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
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
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
            className="h-8 px-3 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">chat</span>
            <span>Conversar</span>
          </Link>

          <button
            onClick={onRefresh}
            disabled={isGenerating}
            type="button"
            title="Recalcular diagnóstico agora"
            className="h-8 px-3 rounded-lg bg-[#18181B] hover:bg-[#27272A] text-zinc-200 border border-[#27272A] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
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

      {/* Resumo Executivo */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm md:text-base font-bold text-white">
          {parsedData.headline}
        </h3>
        <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
          {parsedData.summary}
        </p>
      </div>

      {/* 3 Metric Cards Determinísticos (com espaçamento perfeito e sem quebras de texto) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {parsedData.cards.map((card, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] flex flex-col justify-between gap-2.5 transition-all duration-200 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                {card.title}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getStatusBadge(
                  card.status
                )}`}
              >
                {card.badge}
              </span>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono text-white tabular-nums">
              {card.value}
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Ações Imediatas Recomendadas */}
      {parsedData.actionPoints.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-[#27272A]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Ações Recomendadas pela Kitsune
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {parsedData.actionPoints.map((act, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] flex items-start gap-3 transition-colors hover:border-[#FF8216]/40"
              >
                <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[15px]">
                    {act.icon}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-bold text-white">
                    {act.title}
                  </span>
                  <span className="text-[11px] text-zinc-400 leading-relaxed">
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
          type="button"
          className="text-xs font-bold text-[#FF8216] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>{showFullReport ? "Ocultar Parecer" : "Ver Análise Detalhada"}</span>
          <span className="material-symbols-outlined text-sm">
            {showFullReport ? "expand_less" : "expand_more"}
          </span>
        </button>

        {showFullReport && (
          <div className="mt-3 p-4 rounded-xl bg-[#18181B] border border-[#27272A] text-xs text-zinc-300 leading-relaxed space-y-2 whitespace-pre-line animate-in fade-in duration-300">
            {parsedData.fullReport}
          </div>
        )}
      </div>
    </div>
  );
}