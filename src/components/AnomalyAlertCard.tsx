"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AnomalyItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: "danger" | "warning" | "info";
  amount?: number;
}

export function AnomalyAlertCard() {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function checkAnomalies() {
      try {
        const res = await fetch("/api/ai/anomalies");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.anomalies) {
          setAnomalies(data.anomalies);
        }
      } catch (err) {
        console.warn("Could not check anomalies", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    checkAnomalies();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeAnomalies = anomalies.filter((a) => !dismissed.includes(a.id));

  if (isLoading || activeAnomalies.length === 0) {
    return null;
  }

  const current = activeAnomalies[0];
  const isDanger = current.severity === "danger";

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition-all duration-700 ease-out animate-in fade-in slide-in-from-top-2 shadow-xs ${
        isDanger
          ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
          : "bg-[#FF8216]/10 border-[#FF8216]/30 text-amber-950 dark:text-orange-100"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isDanger ? "bg-rose-500 text-white" : "bg-[#FF8216] text-white"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {isDanger ? "warning" : "shield"}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isDanger
                  ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  : "bg-[#FF8216]/20 text-[#FF8216]"
              }`}
            >
              Sentinela Kitsune • Alerta Preventivo
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {current.title}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            {current.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
        <Link
          href={`/kitsune?prompt=${encodeURIComponent(
            `Kitsune AI, o Sentinela Kitsune detectou um alerta preventivo: "${current.title} - ${current.description}". Por favor, faça uma auditoria aprofundada desse lançamento com base nos meus dados bancários. É uma cobrança duplicada ou parcelamento legítimo? Qual recomendação prática você me dá?`
          )}`}
          className="flex-1 sm:flex-initial h-8 px-3 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Auditar com IA</span>
        </Link>
        <button
          onClick={() => setDismissed((prev) => [...prev, current.id])}
          className="h-8 px-2.5 rounded-lg bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          Dispensar
        </button>
      </div>
    </div>
  );
}
