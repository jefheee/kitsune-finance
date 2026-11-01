"use client";

import React, { useState } from "react";

export interface SemicircularGaugeItem {
  id: string;
  title: string;
  subtitle: string;
  /** 0 to 100 */
  percent: number;
  displayValue: string;
  badgeText: string;
  tone: "orange" | "emerald" | "amber" | "rose";
  footerLeft: string;
  footerRight: string;
}

export interface AllocationSlice {
  id: string;
  name: string;
  value: number;
  color: string;
}

interface AllocationGaugesProps {
  gauges: SemicircularGaugeItem[];
  slices?: AllocationSlice[];
  formatCurrency: (val: number) => string;
  hideValues: boolean;
}

const TONE_COLOR_MAP: Record<SemicircularGaugeItem["tone"], string> = {
  orange: "#E11D48",
  emerald: "#10B981",
  amber: "#F59E0B",
  rose: "#EF4444",
};

const TONE_BADGE_MAP: Record<SemicircularGaugeItem["tone"], string> = {
  orange: "bg-[#E11D48]/12 text-[#E11D48] border-[#E11D48]/25",
  emerald: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  amber: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  rose: "bg-rose-500/12 text-rose-400 border-rose-500/25",
};

/**
 * Converte ângulo polar em coordenadas cartesianas no arco superior (180° esquerda -> 0° direita).
 */
function polarToSemiPoint(cx: number, cy: number, r: number, angleDegFromLeft: number) {
  const rad = Math.PI - (angleDegFromLeft * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

function describeSemiArc(
  cx: number,
  cy: number,
  r: number,
  startDegFromLeft: number,
  endDegFromLeft: number
): string {
  const clampedStart = Math.max(0, Math.min(180, startDegFromLeft));
  const clampedEnd = Math.max(0, Math.min(180, endDegFromLeft));
  if (Math.abs(clampedEnd - clampedStart) < 0.2) return "";

  const start = polarToSemiPoint(cx, cy, r, clampedStart);
  const end = polarToSemiPoint(cx, cy, r, clampedEnd);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function SingleSemicircularGauge({ item }: { item: SemicircularGaugeItem }) {
  const pct = Math.max(0, Math.min(100, item.percent));
  const strokeColor = TONE_COLOR_MAP[item.tone];
  const badgeCls = TONE_BADGE_MAP[item.tone];

  const cx = 110;
  const cy = 98;
  const r = 74;
  const endAngle = (pct / 100) * 180;
  const trackPath = describeSemiArc(cx, cy, r, 0, 180);
  const activePath = describeSemiArc(cx, cy, r, 0, Math.max(2, endAngle));
  const tipPoint = polarToSemiPoint(cx, cy, r, Math.max(2, endAngle));

  return (
    <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 truncate">
            {item.title}
          </h4>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
            {item.subtitle}
          </p>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeCls}`}
        >
          {item.badgeText}
        </span>
      </div>

      {/* Semicircular 180° Gauge SVG */}
      <div className="relative flex items-center justify-center pt-2 pb-1">
        <svg viewBox="0 0 220 112" className="w-full max-w-[215px] h-auto overflow-visible">
          {/* Ticks sutis de escala (0%, 25%, 50%, 75%, 100%) */}
          {[0, 45, 90, 135, 180].map((deg) => {
            const pOuter = polarToSemiPoint(cx, cy, r + 10, deg);
            const pInner = polarToSemiPoint(cx, cy, r + 5, deg);
            return (
              <line
                key={deg}
                x1={pInner.x}
                y1={pInner.y}
                x2={pOuter.x}
                y2={pOuter.y}
                stroke="currentColor"
                className="text-zinc-300 dark:text-[#27272A]"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Track de fundo */}
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            className="text-zinc-200 dark:text-[#18181B]"
            strokeWidth={13}
            strokeLinecap="round"
          />

          {/* Arco preenchido */}
          {pct > 0 && (
            <path
              d={activePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={13}
              strokeLinecap="round"
            />
          )}

          {/* Indicador de agulha circular na ponta */}
          {pct > 0 && (
            <circle
              cx={tipPoint.x}
              cy={tipPoint.y}
              r={5.5}
              fill="#0A0A0A"
              stroke={strokeColor}
              strokeWidth={3}
            />
          )}
        </svg>

        {/* Valor Central no Berço do Semicírculo */}
        <div className="absolute bottom-2 inset-x-0 flex flex-col items-center text-center pointer-events-none">
          <span className="text-xl md:text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-[#F4F4F5] leading-none">
            {item.displayValue}
          </span>
        </div>
      </div>

      {/* Footer determinístico */}
      <div className="pt-2.5 mt-1 border-t border-zinc-100 dark:border-[#27272A] flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
        <span className="truncate">{item.footerLeft}</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
          {item.footerRight}
        </span>
      </div>
    </div>
  );
}

export function AllocationGauges({
  gauges,
  slices = [],
  formatCurrency,
  hideValues,
}: AllocationGaugesProps) {
  const [hoveredSlice, setHoveredSlice] = useState<number>(0);

  const validSlices = slices.filter((s) => s.value > 0);
  const totalSliceValue = validSlices.reduce((sum, s) => sum + s.value, 0);
  const activeSlice =
    validSlices[Math.min(hoveredSlice, Math.max(0, validSlices.length - 1))];

  return (
    <div className="space-y-4">
      {/* Grid 4 Gauges Semicirculares de Exposição / Risco */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {gauges.map((g) => (
          <SingleSemicircularGauge key={g.id} item={g} />
        ))}
      </div>

      {/* Semi-Donut Multi-Segmento Interativo (Fiel ao DrillableDonutChart 180°->0° do Wealthfolio) */}
      {validSlices.length > 0 && totalSliceValue > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 flex flex-col items-center">
            <span className="self-start text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 mb-1">
              Arco de Exposição por Classe
            </span>

            <div className="relative w-full max-w-[260px] flex items-center justify-center">
              <svg viewBox="0 0 260 138" className="w-full h-auto overflow-visible">
                {(() => {
                  const cx = 130;
                  const cy = 122;
                  const r = 92;
                  const gapDeg = validSlices.length > 1 ? 2.6 : 0;
                  const totalGap = gapDeg * Math.max(0, validSlices.length - 1);
                  const availableDeg = Math.max(10, 180 - totalGap);

                  let cursor = 0;
                  return validSlices.map((slice, idx) => {
                    const span = (slice.value / totalSliceValue) * availableDeg;
                    const start = cursor;
                    const end = cursor + Math.max(1.5, span);
                    cursor = end + gapDeg;
                    const isSelected = idx === hoveredSlice;
                    const d = describeSemiArc(cx, cy, r, start, end);

                    return (
                      <path
                        key={slice.id}
                        d={d}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={isSelected ? 22 : 17}
                        strokeLinecap="butt"
                        onMouseEnter={() => setHoveredSlice(idx)}
                        onClick={() => setHoveredSlice(idx)}
                        className="transition-all duration-200 cursor-pointer"
                      />
                    );
                  });
                })()}
              </svg>

              {activeSlice && (
                <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block truncate px-6">
                    {activeSlice.name}
                  </span>
                  <span className="text-base font-bold text-zinc-900 dark:text-[#F4F4F5] tabular-nums block">
                    {formatCurrency(activeSlice.value)}
                  </span>
                  <span className="text-[11px] font-semibold text-[#E11D48] tabular-nums">
                    {hideValues
                      ? "••%"
                      : `${((activeSlice.value / totalSliceValue) * 100).toFixed(1).replace(".", ",")}%`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Lista Densa de Alocação à Direita */}
          <div className="lg:col-span-7 divide-y divide-zinc-100 dark:divide-[#27272A]">
            {validSlices.map((slice, idx) => {
              const weight = (slice.value / totalSliceValue) * 100;
              const isSelected = idx === hoveredSlice;
              return (
                <button
                  key={slice.id}
                  type="button"
                  onMouseEnter={() => setHoveredSlice(idx)}
                  onClick={() => setHoveredSlice(idx)}
                  className={`w-full py-2.5 px-3 rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected ? "bg-zinc-50 dark:bg-[#18181B]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                      {slice.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {hideValues ? "••%" : `${weight.toFixed(1).replace(".", ",")}%`}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-[#F4F4F5] min-w-[92px] text-right">
                      {formatCurrency(slice.value)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
