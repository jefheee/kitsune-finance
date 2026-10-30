"use client";

import React, { useState } from "react";

export interface CategoryDonutItem {
  id: string;
  name: string;
  amount: number;
  color: string;
}

interface CategoryDonutChartProps {
  categories: CategoryDonutItem[];
  totalAmount: number;
  periodLabel?: string;
  size?: number;
  formatCurrency?: (val: number) => string;
  isPrivacyMode?: boolean;
}

export function CategoryDonutChart({
  categories,
  totalAmount,
  periodLabel = "gasto no período",
  size = 180,
  formatCurrency,
  isPrivacyMode = false,
}: CategoryDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayFormat = (val: number) => {
    if (isPrivacyMode) return "R$ ••••••";
    if (formatCurrency) return formatCurrency(val);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Calcula os arcos
  let accumulatedPercent = 0;
  const segments = categories.map((cat, idx) => {
    const percent = totalAmount > 0 ? cat.amount / totalAmount : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...cat,
      percent,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeCategory = hoveredIndex !== null ? categories[hoveredIndex] : null;

  return (
    <div className="flex items-center justify-center relative select-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Track de fundo */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          className="text-slate-100 dark:text-[#27272A]"
          strokeWidth={strokeWidth}
        />

        {/* Segmentos coloridos */}
        {segments.map((seg) => {
          const isHovered = hoveredIndex === seg.idx;
          return (
            <circle
              key={seg.id}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 cursor-pointer"
              onMouseEnter={() => setHoveredIndex(seg.idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
      </svg>

      {/* Centro Informativo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
        {activeCategory ? (
          <>
            <span
              className="text-[10px] font-bold uppercase tracking-wider line-clamp-1"
              style={{ color: activeCategory.color }}
            >
              {activeCategory.name}
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {displayFormat(activeCategory.amount)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#94A3B8] font-mono">
              {totalAmount > 0
                ? `${((activeCategory.amount / totalAmount) * 100).toFixed(1)}%`
                : "0%"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[10px] font-medium text-slate-500 dark:text-[#94A3B8]">
              {periodLabel}
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {displayFormat(totalAmount)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
