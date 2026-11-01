"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  calculateReverseHistoricalBalances,
  parseLocalDate,
  type HistoricalBalancePoint,
} from "@/utils/finance/reconciler";
import { WfIcons } from "./WealthfolioIcons";

export type WealthfolioPeriod = "1M" | "3M" | "6M" | "1Y" | "ALL";
type DisplayUnit = "BRL" | "USD_EST" | "CDI_MONTH";

interface NetWorthHeroChartProps {
  netWorth: number;
  liquidBalance: number;
  investmentsBalance: number;
  liabilitiesBalance: number;
  vehiclesBalance?: number;
  realEstateBalance?: number;
  fgtsBalance?: number;
  transactions: Array<{
    date?: string;
    executed_at?: string;
    amount: number | string;
    type?: string;
    operation_type?: string | null;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
  }>;
  hideValues: boolean;
  onTogglePrivacy: () => void;
  scopeLabel?: string;
  annualCDIPct?: number;
}


const PERIOD_DAYS_MAP: Record<WealthfolioPeriod, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: 540,
};

const PERIOD_LABELS_PT: Record<WealthfolioPeriod, string> = {
  "1M": "último mês",
  "3M": "últimos 3 meses",
  "6M": "últimos 6 meses",
  "1Y": "último ano",
  ALL: "histórico completo",
};

const PTAX_USD_REFERENCE = 5.75; // Referência determinística PTAX p/ visualização opcional em USD

/**
 * Gera uma curva SVG suave (Monotone Cubic Hermite Spline) sem overshoot artificial.
 */
function buildMonotonePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const n = points.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].x - points[i].x;
    const deltaY = points[i + 1].y - points[i].y;
    dx.push(deltaX);
    dy.push(deltaY);
    m.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const tangents: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents.push(0);
    } else {
      tangents.push((m[i - 1] + m[i]) / 2);
    }
  }
  tangents.push(m[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / m[i];
      const beta = tangents[i + 1] / m[i];
      const sq = alpha * alpha + beta * beta;
      if (sq > 9) {
        const tau = 3 / Math.sqrt(sq);
        tangents[i] = tau * alpha * m[i];
        tangents[i + 1] = tau * beta * m[i];
      }
    }
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segDx = dx[i];
    const cp1x = p0.x + segDx / 3;
    const cp1y = p0.y + (tangents[i] * segDx) / 3;
    const cp2x = p1.x - segDx / 3;
    const cp2y = p1.y - (tangents[i + 1] * segDx) / 3;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  return d;
}

export function NetWorthHeroChart({
  netWorth,
  liquidBalance,
  investmentsBalance,
  liabilitiesBalance,
  vehiclesBalance = 0,
  realEstateBalance = 0,
  fgtsBalance = 0,
  transactions,
  hideValues,
  onTogglePrivacy,
  scopeLabel = "Consolidado",
  annualCDIPct = 10.65,
}: NetWorthHeroChartProps) {
  const [period, setPeriod] = useState<WealthfolioPeriod>("3M");
  const [unit, setUnit] = useState<DisplayUnit>("BRL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Normaliza transações com sinal assinado real para o motor determinístico reverso
  const normalizedTxns = useMemo(() => {
    let earliestDateStr: string | null = null;
    const mapped: Array<{
      date: string;
      amount: number;
      is_internal_transfer?: boolean;
    }> = [];

    for (const tx of transactions) {
      const rawDate = tx.date || tx.executed_at;
      if (!rawDate) continue;
      const dateOnly = String(rawDate).split("T")[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) continue;

      if (!earliestDateStr || dateOnly < earliestDateStr) {
        earliestDateStr = dateOnly;
      }

      const rawAmt = Number(tx.amount) || 0;
      if (rawAmt === 0) continue;

      const isExpense =
        rawAmt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
      const signedAmount = isExpense ? -Math.abs(rawAmt) : Math.abs(rawAmt);

      mapped.push({
        date: dateOnly,
        amount: signedAmount,
        is_internal_transfer: Boolean(tx.is_internal_transfer),
      });
    }

    return { mapped, earliestDateStr };
  }, [transactions]);

  // Série histórica reversa determinística (Maybe Finance ReverseCalculator portado em reconciler.ts)
  const series = useMemo<HistoricalBalancePoint[]>(() => {
    let daysBack = PERIOD_DAYS_MAP[period];
    if (period === "ALL" && normalizedTxns.earliestDateStr) {
      const earliest = parseLocalDate(normalizedTxns.earliestDateStr);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - earliest.getTime()) / 86_400_000);
      daysBack = Math.min(730, Math.max(60, diffDays + 7));
    }

    const fullSeries = calculateReverseHistoricalBalances(
      netWorth,
      normalizedTxns.mapped,
      daysBack
    );

    // Amostragem limpa para manter renderização SVG leve e suave em períodos longos (1Y / ALL)
    const maxPoints = 96;
    if (fullSeries.length <= maxPoints) return fullSeries;

    const stride = (fullSeries.length - 1) / (maxPoints - 1);
    const sampled: HistoricalBalancePoint[] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      sampled.push(fullSeries[Math.round(i * stride)]);
    }
    sampled.push(fullSeries[fullSeries.length - 1]);
    return sampled;
  }, [netWorth, normalizedTxns, period]);

  const convertUnit = useCallback(
    (brlAmount: number): number => {
      if (unit === "USD_EST") return brlAmount / PTAX_USD_REFERENCE;
      if (unit === "CDI_MONTH") {
        const monthlyFactor = Math.pow(1 + annualCDIPct / 100, 1 / 12) - 1;
        return brlAmount * monthlyFactor;
      }
      return brlAmount;
    },
    [unit, annualCDIPct]
  );

  const formatAmount = useCallback(
    (brlValue: number, showSign = false): string => {
      if (hideValues) {
        return unit === "USD_EST" ? "US$ ••••••" : "R$ ••••••";
      }
      const converted = convertUnit(brlValue);
      const absVal = Math.abs(converted);
      const formatted = new Intl.NumberFormat(unit === "USD_EST" ? "en-US" : "pt-BR", {
        style: "currency",
        currency: unit === "USD_EST" ? "USD" : "BRL",
        maximumFractionDigits: 2,
      }).format(absVal);

      if (showSign) {
        if (converted > 0.005) return `+${formatted}`;
        if (converted < -0.005) return `-${formatted}`;
      } else if (converted < -0.005) {
        return `-${formatted}`;
      }
      return formatted;
    },
    [hideValues, unit, convertUnit]
  );

  const activePoint =
    hoverIndex !== null && series[hoverIndex]
      ? series[hoverIndex]
      : series[series.length - 1] ?? { date: "", balance: netWorth, netFlow: 0 };

  const startPoint = series[0] ?? { date: "", balance: netWorth, netFlow: 0 };
  const periodDelta = activePoint.balance - startPoint.balance;
  const periodDeltaPct =
    Math.abs(startPoint.balance) > 0.01
      ? (periodDelta / Math.abs(startPoint.balance)) * 100
      : 0;

  // Geometria SVG
  const W = 900;
  const H = 250;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 16;

  const chartGeometry = useMemo(() => {
    if (series.length === 0) {
      return { linePath: "", areaPath: "", coords: [], baselineY: H / 2 };
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const pt of series) {
      if (pt.balance < minVal) minVal = pt.balance;
      if (pt.balance > maxVal) maxVal = pt.balance;
    }

    const span = maxVal - minVal;
    const padRange = span < 1 ? Math.max(Math.abs(maxVal) * 0.05, 100) : span * 0.14;
    const domainMin = minVal - padRange;
    const domainMax = maxVal + padRange;
    const domainSpan = Math.max(1, domainMax - domainMin);

    const usableH = H - PAD_TOP - PAD_BOTTOM;

    const coords = series.map((pt, idx) => {
      const x = series.length === 1 ? W / 2 : (idx / (series.length - 1)) * W;
      const ratio = (pt.balance - domainMin) / domainSpan;
      const y = PAD_TOP + usableH * (1 - ratio);
      return { x, y, pt };
    });

    const linePath = buildMonotonePath(coords);
    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const areaPath = `${linePath} L ${lastX.toFixed(2)} ${H} L ${firstX.toFixed(2)} ${H} Z`;

    const startRatio = (startPoint.balance - domainMin) / domainSpan;
    const baselineY = PAD_TOP + usableH * (1 - startRatio);

    return { linePath, areaPath, coords, baselineY };
  }, [series, startPoint.balance]);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      const el = svgContainerRef.current;
      if (!el || series.length === 0) return;
      const rect = el.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const idx = Math.round(relX * (series.length - 1));
      setHoverIndex(idx);
    },
    [series.length]
  );

  const hoveredCoord =
    hoverIndex !== null && chartGeometry.coords[hoverIndex]
      ? chartGeometry.coords[hoverIndex]
      : null;

  const formatShortDate = (isoDate: string) => {
    if (!isoDate) return "";
    return parseLocalDate(isoDate).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isPositive = periodDelta >= -0.005;

  return (
    <section
      className="relative rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(to top, rgba(255, 130, 22, 0.045) 0%, rgba(18, 18, 20, 0) 55%)",
      }}
    >
      {/* Top Bar: Label, Scope & Currency Selector */}
      <div className="px-5 md:px-7 pt-5 md:pt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {unit === "CDI_MONTH"
              ? "Renda Passiva Estimada / Mês"
              : "Patrimônio Líquido"}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-300">
            {scopeLabel}
          </span>
        </div>

        {/* Seletor de Moeda / Indexador + Botão de Privacidade */}
        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label="Unidade monetária"
            className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] p-0.5 text-[11px]"
          >
            {(
              [
                { id: "BRL", label: "Real (R$)" },
                { id: "USD_EST", label: "Dólar (USD)" },
                { id: "CDI_MONTH", label: "CDI Mensal" },
              ] as const
            ).map((opt) => {
              const active = unit === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUnit(opt.id)}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-white dark:bg-[#27272A] text-zinc-900 dark:text-[#F4F4F5] shadow-2xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero Balance + Wealthfolio Gain | Gain% | Period Row */}
      <div className="px-5 md:px-7 pt-2 pb-1 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2
              style={{ fontSize: "var(--text-display)" }}
              className="font-semibold tracking-tight leading-none tabular-nums text-zinc-900 dark:text-[#F4F4F5]"
            >
              {formatAmount(activePoint.balance)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
            <span
              className={`font-semibold tabular-nums ${
                hideValues
                  ? "text-zinc-400"
                  : isPositive
                    ? "text-emerald-500"
                    : "text-rose-500"
              }`}
            >
              {hideValues ? "••••" : formatAmount(periodDelta, true)}
            </span>

            <span className="w-px h-3 bg-zinc-300 dark:bg-[#27272A]" />

            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${
                hideValues
                  ? "bg-zinc-100 dark:bg-[#18181B] text-zinc-400"
                  : isPositive
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {hideValues
                ? "•••%"
                : `${periodDeltaPct >= 0 ? "+" : ""}${periodDeltaPct.toFixed(2).replace(".", ",")}%`}
            </span>

            <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
              {hoverIndex !== null
                ? formatShortDate(activePoint.date)
                : PERIOD_LABELS_PT[period]}
            </span>
          </div>
        </div>

        {/* Sub-strip: Caixa & Contas, Investimentos, Veículos (FIPE), Imóveis & Terrenos, FGTS e Passivos */}
        <div className="flex flex-wrap items-center gap-3 md:gap-5 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-[#27272A]">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              Caixa & Contas
            </span>
            <span className="text-xs md:text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
              {formatAmount(liquidBalance)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              Investimentos Líquidos
            </span>
            <span className="text-xs md:text-sm font-semibold tabular-nums text-emerald-500">
              {formatAmount(investmentsBalance)}
            </span>
          </div>
          {vehiclesBalance > 0 && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#FF8216] block">
                Veículos (FIPE)
              </span>
              <span className="text-xs md:text-sm font-semibold tabular-nums text-zinc-100">
                {formatAmount(vehiclesBalance)}
              </span>
            </div>
          )}
          {realEstateBalance > 0 && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#FF8216] block">
                Imóveis & Terrenos
              </span>
              <span className="text-xs md:text-sm font-semibold tabular-nums text-zinc-100">
                {formatAmount(realEstateBalance)}
              </span>
            </div>
          )}
          {fgtsBalance > 0 && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#FF8216] block">
                FGTS Caixa
              </span>
              <span className="text-xs md:text-sm font-semibold tabular-nums text-zinc-100">
                {formatAmount(fgtsBalance)}
              </span>
            </div>
          )}
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              Passivos
            </span>
            <span className="text-xs md:text-sm font-semibold tabular-nums text-rose-400">
              {liabilitiesBalance > 0 ? `-${formatAmount(liabilitiesBalance)}` : formatAmount(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Área do Gráfico Limpo Estilo Wealthfolio */}
      <div
        ref={svgContainerRef}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={() => setHoverIndex(null)}
        onTouchStart={(e) => {
          if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
        }}
        onTouchEnd={() => setHoverIndex(null)}
        className="relative w-full h-[210px] sm:h-[248px] mt-2 select-none touch-pan-y cursor-crosshair"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="wfNetWorthOrangeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8216" stopOpacity={0.25} />
              <stop offset="52%" stopColor="#FF8216" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#FF8216" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Linha base pontilhada (Abertura do período) */}
          <line
            x1={0}
            x2={W}
            y1={chartGeometry.baselineY}
            y2={chartGeometry.baselineY}
            stroke="currentColor"
            className="text-zinc-300 dark:text-[#27272A]"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Preenchimento em gradiente suave Kitsune Orange */}
          {chartGeometry.areaPath && (
            <path d={chartGeometry.areaPath} fill="url(#wfNetWorthOrangeGrad)" />
          )}

          {/* Traço principal da curva patrimonial */}
          {chartGeometry.linePath && (
            <path
              d={chartGeometry.linePath}
              fill="none"
              stroke="#FF8216"
              strokeWidth={2.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Crosshair vertical no hover/scrub */}
          {hoveredCoord && (
            <line
              x1={hoveredCoord.x}
              x2={hoveredCoord.x}
              y1={PAD_TOP / 2}
              y2={H}
              stroke="#FF8216"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Ponto ativo & Tooltip flutuante */}
        {hoveredCoord && (
          <>
            <div
              className="pointer-events-none absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[#FF8216] ring-4 ring-[#0A0A0A] shadow-[0_0_12px_rgba(255,130,22,0.8)]"
              style={{
                left: `${(hoveredCoord.x / W) * 100}%`,
                top: `${(hoveredCoord.y / H) * 100}%`,
              }}
            />

            <div
              className="pointer-events-none absolute top-2 z-20 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md border border-zinc-200 dark:border-[#27272A] shadow-lg text-[11px]"
              style={{
                left: `clamp(12px, calc(${(hoveredCoord.x / W) * 100}% - 68px), calc(100% - 156px))`,
              }}
            >
              <div className="text-zinc-400 font-medium">
                {formatShortDate(hoveredCoord.pt.date)}
              </div>
              <div className="font-bold text-zinc-900 dark:text-[#F4F4F5] tabular-nums">
                {formatAmount(hoveredCoord.pt.balance)}
              </div>
              {Math.abs(hoveredCoord.pt.netFlow) > 0.01 && (
                <div
                  className={`text-[10px] font-semibold tabular-nums ${
                    hoveredCoord.pt.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  Fluxo dia: {formatAmount(hoveredCoord.pt.netFlow, true)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Seletor de Período Linear e Minimalista (1M, 3M, 6M, 1Y, ALL) — Fiel ao Wealthfolio IntervalSelector */}
      <div className="px-4 py-3 border-t border-zinc-100 dark:border-[#27272A]/80 flex items-center justify-center">
        <div
          role="tablist"
          aria-label="Selecionar período do gráfico"
          className="inline-flex items-center gap-1 p-1 rounded-full bg-zinc-100/80 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A]"
        >
          {(
            [
              { code: "1M", label: "1 Mês" },
              { code: "3M", label: "3 Meses" },
              { code: "6M", label: "6 Meses" },
              { code: "1Y", label: "1 Ano" },
              { code: "ALL", label: "Tudo" },
            ] as const
          ).map(({ code, label }) => {
            const active = period === code;
            return (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(code)}
                className={`relative px-3 sm:px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                  active
                    ? "text-black dark:text-black font-bold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="wf-interval-active-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-[#FF8216]"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
