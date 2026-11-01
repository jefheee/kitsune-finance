"use client";

import { useMemo } from "react";
import { parseLocalDate } from "@/utils/finance/reconciler";

interface TransactionLike {
  id: string;
  description?: string;
  amount: number | string;
  category?: string | null;
  type?: string;
  operation_type?: string | null;
  is_internal_transfer?: boolean;
  is_refund?: boolean;
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
      if (t.is_internal_transfer || t.is_refund) return;
      const rawDate = t.executed_at || t.date || t.value_date;
      if (!rawDate) return;
      const tDate = parseLocalDate(rawDate);
      if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
        const amt = Number(t.amount) || 0;
        const isDebit =
          t.type === "DEBIT" ||
          t.type === "OUTFLOW" ||
          t.operation_type === "CREDIT_CARD" ||
          amt < 0;
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
    if (amount === 0) return "bg-zinc-100 dark:bg-[#18181B] text-zinc-400 dark:text-zinc-500";
    if (amount < dailyAverage * 0.5)
      return "bg-[#E11D48]/20 text-[#E11D48] border border-[#E11D48]/25";
    if (amount <= dailyAverage * 1.2) return "bg-[#E11D48]/45 text-white font-semibold";
    if (amount <= dailyAverage * 2) return "bg-[#E11D48]/75 text-white font-bold";
    return "bg-white text-black font-bold";
  };

  const daysList = Object.keys(daysData).map(Number);
  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Mapa de Calor de Gastos
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
              {formatCurrency(totalMonthSpend)}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
              Média/dia: <strong className="text-zinc-700 dark:text-zinc-300">{formatCurrency(dailyAverage)}</strong>
            </span>
          </div>
        </div>
        <span className="text-[10px] font-semibold capitalize text-emerald-500 bg-emerald-500/12 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
          {new Date().toLocaleDateString("pt-BR", { month: "long" })}
        </span>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
          {weekdays.map((w, idx) => (
            <span key={idx} className="text-[10px] font-semibold text-zinc-500">
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
                className={`h-8 rounded-lg flex items-center justify-center text-[11px] font-mono tabular-nums transition-transform hover:scale-105 select-none ${getIntensityClass(
                  amount
                )}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-2.5 border-t border-zinc-100 dark:border-[#27272A] flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span>Menos</span>
          <span className="w-2.5 h-2.5 rounded bg-zinc-100 dark:bg-[#18181B]" />
          <span className="w-2.5 h-2.5 rounded bg-[#E11D48]/30" />
          <span className="w-2.5 h-2.5 rounded bg-[#E11D48]/70" />
          <span className="w-2.5 h-2.5 rounded bg-[#E11D48]" />
          <span>Mais</span>
        </div>

        {maxDaySpend > 0 && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            Pico: <strong className="text-[#E11D48]">{formatCurrency(maxDaySpend)}</strong> (dia {maxDayNumber})
          </span>
        )}
      </div>
    </div>
  );
}
