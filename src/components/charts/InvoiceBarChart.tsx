"use client";

import React, { useState } from "react";

export interface InvoiceBarItem {
  month: string;
  label: string;
  amount: number;
}

interface InvoiceBarChartProps {
  invoices: InvoiceBarItem[];
  selectedMonthIndex?: number;
  onSelectMonth?: (index: number) => void;
}

export function InvoiceBarChart({
  invoices,
  selectedMonthIndex = invoices.length - 1,
  onSelectMonth,
}: InvoiceBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(...invoices.map((i) => i.amount), 500);
  const roundedMax = Math.ceil(maxVal / 150) * 150;

  return (
    <div className="w-full flex flex-col select-none">
      <div className="flex items-end gap-3 h-44 w-full pt-6 pb-2 px-2">
        {/* Y Axis Marks */}
        <div className="flex flex-col justify-between h-full text-[10px] text-slate-400 dark:text-[#64748B] font-mono pr-2">
          <span>R${roundedMax}</span>
          <span>R${Math.round(roundedMax * 0.66)}</span>
          <span>R${Math.round(roundedMax * 0.33)}</span>
          <span>0</span>
        </div>

        {/* Bars Container */}
        <div className="flex-1 flex items-end justify-between h-full gap-2 border-b border-slate-200 dark:border-[#262E3D] pb-1">
          {invoices.map((inv, idx) => {
            const isSelected = selectedMonthIndex === idx;
            const isHovered = hoveredIdx === idx;
            const heightPercent = roundedMax > 0 ? (inv.amount / roundedMax) * 100 : 0;

            return (
              <div
                key={inv.month}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                onClick={() => onSelectMonth?.(idx)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating tooltip */}
                {(isHovered || isSelected) && (
                  <div className="absolute -top-7 px-2 py-0.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold font-mono whitespace-nowrap shadow-md pointer-events-none z-20">
                    R${" "}
                    {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0 }).format(
                      inv.amount
                    )}
                  </div>
                )}

                {/* The Bar */}
                <div
                  className={`w-full max-w-[48px] rounded-t-lg transition-all duration-300 ${
                    isSelected
                      ? "bg-white dark:bg-white shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                      : isHovered
                      ? "bg-slate-400 dark:bg-[#3D4759]"
                      : "bg-slate-200 dark:bg-[#1E2533]"
                  }`}
                  style={{
                    height: `${Math.max(heightPercent, 4)}%`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X Axis Labels */}
      <div className="flex items-center justify-between pl-10 pr-2 pt-2">
        {invoices.map((inv, idx) => {
          const isSelected = selectedMonthIndex === idx;
          return (
            <button
              key={inv.month}
              type="button"
              onClick={() => onSelectMonth?.(idx)}
              className={`flex-1 text-center text-xs font-medium cursor-pointer transition-colors ${
                isSelected
                  ? "text-slate-900 dark:text-white font-bold"
                  : "text-slate-400 dark:text-[#64748B] hover:text-slate-700 dark:hover:text-[#94A3B8]"
              }`}
            >
              {inv.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
