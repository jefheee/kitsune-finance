"use client";

import React, { useMemo, useState } from "react";

interface SpendingCurveChartProps {
  currentMonthDays: number[]; // acumulado dia a dia (índice 0 = dia 1)
  previousMonthDays: number[]; // acumulado dia a dia do mês anterior
  currentDay: number;
  totalCurrentMonth: number;
  totalPreviousMonth: number;
  hideValues?: boolean;
}

export function SpendingCurveChart({
  currentMonthDays,
  previousMonthDays,
  currentDay,
  totalCurrentMonth,
  totalPreviousMonth,
  hideValues = false,
}: SpendingCurveChartProps) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    const curMax = Math.max(...currentMonthDays.slice(0, currentDay), 0);
    const prevMax = Math.max(...previousMonthDays, 0);
    const m = Math.max(curMax, prevMax, 500);
    return Math.ceil(m / 200) * 200; // arredonda para cima
  }, [currentMonthDays, previousMonthDays, currentDay]);

  // Dimensões do SVG
  const width = 500;
  const height = 180;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const getX = (day: number) => paddingLeft + ((day - 1) / 30) * chartW;
  const getY = (val: number) => paddingTop + chartH - (val / (maxVal || 1)) * chartH;

  // Path Mês Passado (tracejado)
  const prevPath = useMemo(() => {
    if (previousMonthDays.length === 0) return "";
    return previousMonthDays
      .map((val, idx) => {
        const x = getX(idx + 1);
        const y = getY(val);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [previousMonthDays, maxVal]);

  // Path Mês Atual (linha sólida contínua com gradiente)
  const curPoints = useMemo(() => {
    return currentMonthDays.slice(0, currentDay).map((val, idx) => ({
      day: idx + 1,
      val,
      x: getX(idx + 1),
      y: getY(val),
    }));
  }, [currentMonthDays, currentDay, maxVal]);

  const curPath = useMemo(() => {
    if (curPoints.length === 0) return "";
    return curPoints
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }, [curPoints]);

  const lastCurPoint = curPoints[curPoints.length - 1];

  const diffAmount = totalCurrentMonth - totalPreviousMonth;
  const isBelow = diffAmount <= 0;
  const diffPercent =
    totalPreviousMonth > 0
      ? Math.abs(Math.round((diffAmount / totalPreviousMonth) * 100))
      : 0;

  return (
    <div className="w-full flex flex-col select-none">
      {/* Top Header com Métricas Determinísticas */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
            Ritmo de Gastos
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {hideValues ? (
                "R$ ••••••"
              ) : (
                `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
                  Math.abs(diffAmount)
                )}`
              )}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isBelow
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              }`}
            >
              {isBelow ? `-${diffPercent}%` : `+${diffPercent}%`}{" "}
              <span className="text-[11px] opacity-80">
                vs {hideValues ? "R$ ••••••" : `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0 }).format(totalPreviousMonth)}`}{" "}
                mês anterior
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id="curGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid horizontal lines e labels */}
          {[1, 0.66, 0.33, 0].map((ratio) => {
            const y = paddingTop + chartH * (1 - ratio);
            const val = Math.round(maxVal * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 dark:fill-[#64748B] font-mono tabular-nums"
                >
                  {hideValues ? "••••" : (val >= 1000 ? `R$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : `R$${val}`)}
                </text>
              </g>
            );
          })}

          {/* Grid vertical / Eixo X (Dias 1, 15, 25, 31) */}
          {[1, 15, 25, 31].map((day) => {
            const x = getX(day);
            return (
              <text
                key={day}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="text-[10px] fill-slate-400 dark:fill-[#64748B] font-mono"
              >
                {day}
              </text>
            );
          })}

          {/* Curva Mês Passado (Tracejada cinza) */}
          {prevPath && (
            <path
              d={prevPath}
              fill="none"
              stroke="#64748B"
              strokeWidth="1.8"
              strokeDasharray="4 4"
              strokeOpacity="0.6"
            />
          )}

          {/* Curva Mês Atual (Verde sólido) */}
          {curPath && (
            <path
              d={curPath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Ponto final do Mês Atual com pulso */}
          {lastCurPoint && (
            <g>
              <circle
                cx={lastCurPoint.x}
                cy={lastCurPoint.y}
                r="6"
                fill="#10B981"
                fillOpacity="0.3"
                className="animate-ping"
              />
              <circle
                cx={lastCurPoint.x}
                cy={lastCurPoint.y}
                r="4.5"
                fill="#10B981"
                stroke="#121214"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Linhas de interação invisíveis para capturar hover */}
          {curPoints.map((p) => (
            <circle
              key={p.day}
              cx={p.x}
              cy={p.y}
              r="12"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredDay(p.day)}
              onMouseLeave={() => setHoveredDay(null)}
            />
          ))}

          {/* Tooltip no Hover */}
          {hoveredDay && curPoints[hoveredDay - 1] && (
            <g>
              <line
                x1={curPoints[hoveredDay - 1].x}
                y1={paddingTop}
                x2={curPoints[hoveredDay - 1].x}
                y2={paddingTop + chartH}
                stroke="#10B981"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={curPoints[hoveredDay - 1].x}
                cy={curPoints[hoveredDay - 1].y}
                r="4"
                fill="#10B981"
              />
              <rect
                x={Math.min(Math.max(curPoints[hoveredDay - 1].x - 45, 10), width - 100)}
                y={curPoints[hoveredDay - 1].y - 32}
                width="90"
                height="24"
                rx="6"
                className="fill-slate-900 dark:fill-[#18181B] stroke-slate-700/50"
                strokeWidth="1"
              />
              <text
                x={Math.min(Math.max(curPoints[hoveredDay - 1].x, 55), width - 55)}
                y={curPoints[hoveredDay - 1].y - 16}
                textAnchor="middle"
                className="text-[10px] fill-white font-mono font-bold"
              >
                {hideValues ? `Dia ${hoveredDay}: R$ ••••••` : `Dia ${hoveredDay}: R$ ${curPoints[hoveredDay - 1].val.toFixed(0)}`}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legenda Inferior */}
      <div className="flex items-center gap-5 mt-2 text-[11px] text-slate-500 dark:text-[#94A3B8]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" />
          <span>Este mês</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-slate-500 dark:border-[#64748B] inline-block" />
          <span>Mês passado</span>
        </div>
      </div>
    </div>
  );
}
