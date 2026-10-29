"use client";

import { useMemo } from "react";

interface TransactionLike {
  id: string;
  description?: string;
  amount: number | string;
  category?: string | null;
  type?: string;
  date?: string;
  executed_at?: string;
  value_date?: string;
}

interface SpendingHeatmapProps {
  transactions: TransactionLike[];
  formatCurrency: (val: number) => string;
}

export function SpendingHeatmap({ transactions, formatCurrency }: SpendingHeatmapProps) {
  const { daysData, totalMonthSpend, dailyAverage, maxDaySpend, maxDayNumber } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const spendPerDay: Record<number, number> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      spendPerDay[i] = 0;
    }

    let total = 0;
    transactions.forEach((t) => {
      const rawDate = t.executed_at || t.date || t.value_date;
      if (!rawDate) return;
      const tDate = new Date(rawDate);
      if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
        const amt = Number(t.amount) || 0;
        const isDebit = t.type === "DEBIT" || t.type === "OUTFLOW" || amt < 0;
        if (isDebit) {
          const absAmt = Math.abs(amt);
          const day = tDate.getDate();
          spendPerDay[day] = (spendPerDay[day] || 0) + absAmt;
          total += absAmt;
        }
      }
    });

    let maxSpend = 0;
    let maxDay = 1;
    Object.entries(spendPerDay).forEach(([day, val]) => {
      if (val > maxSpend) {
        maxSpend = val;
        maxDay = Number(day);
      }
    });

    const activeDaysCount = Math.max(1, now.getDate());
    const avg = total / activeDaysCount;

    return {
      daysData: spendPerDay,
      totalMonthSpend: total,
      dailyAverage: avg,
      maxDaySpend: maxSpend,
      maxDayNumber: maxDay,
    };
  }, [transactions]);

  const getIntensityClass = (amount: number) => {
    if (amount === 0) return "bg-slate-100 dark:bg-[#18181B] text-slate-400";
    if (amount < dailyAverage * 0.5) return "bg-[#FF8216]/20 text-[#FF8216] dark:text-[#FF8216]";
    if (amount <= dailyAverage * 1.2) return "bg-[#FF8216]/40 text-white font-semibold";
    if (amount <= dailyAverage * 2) return "bg-[#FF8216]/70 text-white font-bold";
    return "bg-[#FF8216] text-white font-black shadow-xs";
  };

  const daysList = Object.keys(daysData).map(Number);
  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mapa de Calor de Gastos
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(totalMonthSpend)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Média diária: <strong className="text-slate-700 dark:text-slate-300">{formatCurrency(dailyAverage)}</strong>
            </span>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
          {new Date().toLocaleDateString("pt-BR", { month: "long" })}
        </span>
      </div>

      {/* Grid de Dias */}
      <div>
        <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
          {weekdays.map((w, idx) => (
            <span key={idx} className="text-[10px] font-bold text-slate-400">
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {daysList.map((day) => {
            const amount = daysData[day] || 0;
            return (
              <div
                key={day}
                title={`Dia ${day}: ${formatCurrency(amount)}`}
                className={`h-8 rounded-lg flex items-center justify-center text-[11px] transition-transform hover:scale-105 cursor-pointer select-none ${getIntensityClass(
                  amount
                )}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda & Maior Gasto */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>Menos</span>
          <span className="w-2.5 h-2.5 rounded bg-slate-100 dark:bg-[#18181B]" />
          <span className="w-2.5 h-2.5 rounded bg-[#FF8216]/30" />
          <span className="w-2.5 h-2.5 rounded bg-[#FF8216]/70" />
          <span className="w-2.5 h-2.5 rounded bg-[#FF8216]" />
          <span>Mais</span>
        </div>

        {maxDaySpend > 0 && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Maior gasto: <strong className="text-[#FF8216]">{formatCurrency(maxDaySpend)}</strong> dia {maxDayNumber}
          </span>
        )}
      </div>
    </div>
  );
}
