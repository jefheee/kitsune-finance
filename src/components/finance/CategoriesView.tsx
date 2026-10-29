"use client";

import React, { useState, useMemo } from "react";
import { CategoryDonutChart, CategoryDonutItem } from "@/components/charts/CategoryDonutChart";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";

interface TransactionLike {
  id: string;
  amount: number | string;
  category?: string | null;
  category_pt?: string | null;
  category_original?: string | null;
  clean_description?: string | null;
  description?: string;
  is_internal_transfer?: boolean;
  is_refund?: boolean;
  date?: string;
}

interface CategoriesViewProps {
  transactions: TransactionLike[];
  formatCurrency: (val: number) => string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Compras: "#EC4899", // Pink
  "Saúde e bem-estar": "#F43F5E", // Rose
  "Serviços digitais": "#A855F7", // Purple
  Outros: "#94A3B8", // Slate
  Alimentação: "#F97316", // Orange
  Moradia: "#06B6D4", // Cyan
  Transporte: "#EAB308", // Yellow
  Educação: "#3B82F6", // Blue
  Lazer: "#10B981", // Emerald
};

const CATEGORY_ICONS: Record<string, string> = {
  Compras: "shopping_bag",
  "Saúde e bem-estar": "medical_services",
  "Serviços digitais": "devices",
  Outros: "category",
  Alimentação: "restaurant",
  Moradia: "home",
  Transporte: "directions_car",
  Educação: "school",
  Lazer: "sports_esports",
};

export function CategoriesView({ transactions, formatCurrency }: CategoriesViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("Outubro de 2026");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Compras: true,
    Alimentação: true,
  });

  const toggleExpand = (catName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const { totalSpend, categoriesList, donutItems } = useMemo(() => {
    let total = 0;
    const parentMap = new Map<
      string,
      {
        name: string;
        total: number;
        count: number;
        subcategories: Map<string, { name: string; total: number; count: number }>;
      }
    >();

    transactions.forEach((tx) => {
      if (tx.is_internal_transfer || tx.is_refund) return;
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return; // apenas despesas

      total += amt;
      const rawCat = tx.category_pt || tx.category || "Outros";

      // Normaliza para categorias pai
      let parent = "Outros";
      let sub = rawCat;

      const lower = rawCat.toLowerCase();
      if (lower.includes("supermercado") || lower.includes("delivery") || lower.includes("restaurante") || lower.includes("alimenta")) {
        parent = "Alimentação";
        sub = lower.includes("supermercado") ? "Supermercado" : lower.includes("delivery") ? "Delivery de alimentos" : "Restaurantes";
      } else if (lower.includes("compra") || lower.includes("loja") || lower.includes("vestuário") || lower.includes("eletrôn") || lower.includes("shopping")) {
        parent = "Compras";
        sub = lower.includes("online") || lower.includes("amazon") || lower.includes("mercado livre") ? "Compras online" : "Compras no varejo";
      } else if (lower.includes("saúde") || lower.includes("academia") || lower.includes("farmácia") || lower.includes("médic")) {
        parent = "Saúde e bem-estar";
        sub = lower.includes("academia") || lower.includes("wellhub") ? "Academia e centros de lazer" : "Farmácia e cuidados";
      } else if (lower.includes("streaming") || lower.includes("serviços digitais") || lower.includes("software") || lower.includes("google") || lower.includes("spotify")) {
        parent = "Serviços digitais";
        sub = "Serviços digitais e assinaturas";
      } else if (lower.includes("telecom") || lower.includes("moradia") || lower.includes("luz") || lower.includes("água") || lower.includes("aluguel") || lower.includes("condomínio")) {
        parent = "Moradia";
        sub = lower.includes("telecom") ? "Telecomunicação e internet" : "Despesas residenciais";
      } else if (lower.includes("transporte") || lower.includes("uber") || lower.includes("combustível") || lower.includes("posto")) {
        parent = "Transporte";
        sub = lower.includes("uber") ? "Mobilidade urbana" : "Combustível e manutenção";
      }

      if (!parentMap.has(parent)) {
        parentMap.set(parent, {
          name: parent,
          total: 0,
          count: 0,
          subcategories: new Map(),
        });
      }

      const pEntry = parentMap.get(parent)!;
      pEntry.total += amt;
      pEntry.count += 1;

      if (!pEntry.subcategories.has(sub)) {
        pEntry.subcategories.set(sub, { name: sub, total: 0, count: 0 });
      }
      const sEntry = pEntry.subcategories.get(sub)!;
      sEntry.total += amt;
      sEntry.count += 1;
    });

    const list = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);

    const donuts: CategoryDonutItem[] = list.map((c) => ({
      id: c.name,
      name: c.name,
      amount: c.total,
      color: CATEGORY_COLORS[c.name] || "#94A3B8",
    }));

    return { totalSpend: total, categoriesList: list, donutItems: donuts };
  }, [transactions]);

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* Top Header Card com Donut Chart (Fiel ao Pierre Screenshot 015) */}
      <SpotlightCard className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Total Gasto no Mês */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
            {formatCurrency(totalSpend)}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1 font-medium">
            gasto em {selectedMonth}
          </p>
        </div>

        {/* Donut Chart Central Interativo */}
        <div className="flex items-center justify-center">
          <CategoryDonutChart
            categories={donutItems}
            totalAmount={totalSpend}
            periodLabel="total gasto"
            size={180}
          />
        </div>

        {/* Seletor de Mês */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white bg-slate-100 dark:bg-[#161B26] p-1.5 rounded-xl border border-slate-200 dark:border-[#262E3D]">
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#202736] cursor-pointer text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <span className="px-2">{selectedMonth}</span>
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#202736] cursor-pointer text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </SpotlightCard>

      {/* Accordion de Categorias (Fiel ao Pierre Screenshot 015) */}
      <SpotlightCard className="p-4 md:p-6">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4 px-2">
          Categorias
        </div>

        <div className="flex flex-col divide-y divide-slate-100 dark:divide-[#1F2633]">
          {categoriesList.map((cat) => {
            const isExpanded = Boolean(expandedCategories[cat.name]);
            const color = CATEGORY_COLORS[cat.name] || "#94A3B8";
            const icon = CATEGORY_ICONS[cat.name] || "category";
            const percent = totalSpend > 0 ? (cat.total / totalSpend) * 100 : 0;
            const subList = Array.from(cat.subcategories.values());

            return (
              <div key={cat.name} className="py-3">
                {/* Linha Pai */}
                <div
                  onClick={() => toggleExpand(cat.name)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-[#161B26] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      expand_more
                    </span>

                    <span
                      className="w-6 h-6 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {cat.count}
                    </span>

                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {cat.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(cat.total)}
                    </span>

                    {/* Mini Barra de Progresso com a Cor da Categoria */}
                    <div className="w-24 md:w-36 h-2 rounded-full bg-slate-100 dark:bg-[#1E2533] overflow-hidden hidden sm:block">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(percent, 4)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Subcategorias Expandidas */}
                {isExpanded && subList.length > 0 && (
                  <div className="mt-2 pl-12 pr-2 flex flex-col gap-2">
                    {subList.map((sub) => {
                      const subPercent = cat.total > 0 ? (sub.total / cat.total) * 100 : 0;
                      return (
                        <div
                          key={sub.name}
                          className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50/60 dark:bg-[#0E121A]/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">
                              {icon}
                            </span>
                            <span className="text-slate-700 dark:text-[#CBD5E1] font-medium">
                              {sub.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                              {formatCurrency(sub.total)}
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-[#1E2533] overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full opacity-70"
                                style={{
                                  width: `${Math.max(subPercent, 4)}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SpotlightCard>
    </div>
  );
}
