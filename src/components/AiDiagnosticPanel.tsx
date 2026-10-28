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

  // Parser robusto: lida com JSON estruturado ou converte texto legado sem quebrar
  const parsedData: ParsedDiagnostic = (() => {
    if (!aiInsight?.text) {
      const margin = Math.max(0, monthlyIncome - monthlyExpense);
      const isLiquidOk = liquidBalance >= creditCardBalance;
      return {
        headline: "Diagnóstico Dinâmico do Seu Patrimônio",
        summary: `Patrimônio consolidado em ${formatCurrency(totalBalance)} com ${formatCurrency(liquidBalance)} em conta e ${formatCurrency(creditCardBalance)} em faturas em aberto.`,
        score: kitsuneScore.score,
        scoreLabel: kitsuneScore.label,
        cards: [
          {
            title: "Cobertura de Liquidez",
            value: formatCurrency(liquidBalance),
            badge: isLiquidOk ? "Faturas Cobertas" : "Atenção de Caixa",
            status: isLiquidOk ? "positive" : "warning",
            desc: isLiquidOk ? "Saldo líquido cobre 100% das faturas atuais." : "Saldo menor que as faturas atuais.",
          },
          {
            title: "Faturas do Período",
            value: formatCurrency(creditCardBalance),
            badge: "Cartão de Crédito",
            status: creditCardBalance > 0 ? "warning" : "positive",
            desc: "Compromissos pendentes até o fechamento da fatura.",
          },
          {
            title: "Margem Operacional",
            value: formatCurrency(margin),
            badge: monthlyIncome >= monthlyExpense ? "Superávit" : "Déficit",
            status: monthlyIncome >= monthlyExpense ? "positive" : "danger",
            desc: "Diferença líquida entre entradas e saídas confirmadas.",
          },
        ],
        actionPoints: [
          {
            icon: "shield",
            title: "Blindagem de Caixa",
            desc: `Garanta a liquidação de ${formatCurrency(creditCardBalance)} para blindar seu saldo operacional.`,
          },
        ],
        fullReport: "Clique no botão Atualizar para gerar um parecer patrimonial completo com a Kitsune IA.",
      };
    }

    try {
      // Tenta parsear JSON
      const json = JSON.parse(aiInsight.text);
      if (json.summary && Array.isArray(json.cards)) {
        return json as ParsedDiagnostic;
      }
    } catch {
      // Formato não é JSON puro (texto legado com asteriscos)
    }

    // Fallback limpo para texto legado: limpa markdown e monta cards reais
    const cleanText = aiInsight.text.replace(/\*\*/g, "").replace(/#{1,6}\s?/g, "");
    const paragraphs = cleanText.split("\n\n").filter(Boolean);
    const summary = paragraphs[0]?.replace(/^Olá.*?:\s*/i, "").trim() || "Análise patrimonial consolidada.";
    const fullReport = paragraphs.slice(1).join("\n\n") || cleanText;

    const margin = Math.max(0, monthlyIncome - monthlyExpense);
    const isLiquidOk = liquidBalance >= creditCardBalance;

    return {
      headline: "Resumo Executivo do Patrimônio",
      summary: summary.slice(0, 220) + (summary.length > 220 ? "..." : ""),
      score: kitsuneScore.score,
      scoreLabel: kitsuneScore.label,
      cards: [
        {
          title: "Cobertura de Liquidez",
          value: formatCurrency(liquidBalance),
          badge: isLiquidOk ? "Faturas Cobertas" : "Atenção",
          status: isLiquidOk ? "positive" : "warning",
          desc: `${creditCardBalance > 0 ? (liquidBalance / creditCardBalance).toFixed(1) + "x" : "100% de folga sobre"} o volume de faturas abertas.`,
        },
        {
          title: "Faturas Pendentes",
          value: formatCurrency(creditCardBalance),
          badge: "Cartão",
          status: "warning",
          desc: "Volume de compromissos abertos no ciclo atual.",
        },
        {
          title: "Margem Operacional",
          value: formatCurrency(margin),
          badge: monthlyIncome >= monthlyExpense ? "Superávit" : "Déficit",
          status: monthlyIncome >= monthlyExpense ? "positive" : "danger",
          desc: "Diferença entre receitas e despesas registradas.",
        },
      ],
      actionPoints: [
        {
          icon: "savings",
          title: "Otimização de Caixa",
          desc: "Direcione o superávit para expansão da reserva de emergência.",
        },
      ],
      fullReport,
    };
  })();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "positive":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "warning":
        return "bg-[#FF8216]/10 text-[#FF8216] border-[#FF8216]/25";
      case "danger":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-100 dark:bg-[#1E2533] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10";
    }
  };

  return (
    <section className="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col gap-5 transition-all">
      {/* Top Header: Título, Score, Horário e Botões de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/25 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">psychology</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
                Diagnóstico & Parecer da Kitsune IA
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${kitsuneScore.color}`}>
                Score: {parsedData.score || kitsuneScore.score} • {parsedData.scoreLabel || kitsuneScore.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-500">verified</span>
                Auditoria via Open Finance
              </span>
              {aiInsight && (
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

        {/* Botões de Ação Rápidos */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Link
            href="/kitsune"
            className="flex-1 sm:flex-initial h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
            <span>Conversar</span>
          </Link>

          <button
            onClick={onRefresh}
            disabled={isGenerating}
            title="Atualizar análise por IA"
            className="flex-1 sm:flex-initial h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A202C] dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] text-[#FF8216] ${isGenerating ? "animate-spin" : ""}`}>
              sync
            </span>
            <span>{isGenerating ? "Analisando..." : "Atualizar"}</span>
          </button>
        </div>
      </div>

      {/* Resumo Executivo Dinâmico */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {parsedData.headline}
        </h3>
        <p className="text-xs md:text-sm text-slate-600 dark:text-[#94A3B8] leading-relaxed">
          {parsedData.summary}
        </p>
      </div>

      {/* Cards de Métricas Visuais (3 Cards Gerados Dinamicamente) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {parsedData.cards.map((card, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200/80 dark:border-[#262E3D]/80 flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {card.title}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(card.status)}`}>
                {card.badge}
              </span>
            </div>
            <div>
              <span className="text-base md:text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                {card.value}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                {card.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recomendações Acionáveis */}
      {parsedData.actionPoints && parsedData.actionPoints.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Ações Recomendadas Pela Kitsune
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {parsedData.actionPoints.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#141A24] border border-slate-200/60 dark:border-[#262E3D]/60"
              >
                <div className="w-6 h-6 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[15px]">{action.icon || "bolt"}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {action.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">
                    {action.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accordion para Parecer Completo */}
      {parsedData.fullReport && (
        <div className="pt-2 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={() => setShowFullReport(!showFullReport)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#FF8216] hover:text-[#FFA047] transition-colors cursor-pointer"
          >
            <span>{showFullReport ? "Ocultar Análise Detalhada" : "Ver Análise Detalhada"}</span>
            <span className={`material-symbols-outlined text-sm transition-transform ${showFullReport ? "rotate-180" : ""}`}>
              expand_more
            </span>
          </button>

          {showFullReport && (
            <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#262E3D] text-xs text-slate-600 dark:text-[#94A3B8] leading-relaxed whitespace-pre-line">
              {parsedData.fullReport}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
