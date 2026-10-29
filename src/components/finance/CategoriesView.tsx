"use client";

import React, { useState, useMemo } from "react";
import { CategoryDonutChart, CategoryDonutItem } from "@/components/charts/CategoryDonutChart";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";

interface TransactionLike {
  id: string;
  amount: number | string;
  type?: string | null;
  operation_type?: string | null;
  category?: string | null;
  category_pt?: string | null;
  category_original?: string | null;
  clean_description?: string | null;
  description?: string;
  is_internal_transfer?: boolean;
  is_refund?: boolean;
  date?: string;
  executed_at?: string;
}

interface CategoriesViewProps {
  transactions: TransactionLike[];
  formatCurrency: (val: number) => string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Compras: "#EC4899", // Pink
  "Saúde e bem-estar": "#F43F5E", // Rose
  "Serviços digitais": "#A855F7", // Purple
  Alimentação: "#F97316", // Orange
  Moradia: "#06B6D4", // Cyan
  Transporte: "#EAB308", // Yellow
  Educação: "#3B82F6", // Blue
  Lazer: "#10B981", // Emerald
  "Transferências e Pix": "#6366F1", // Indigo
  Outros: "#94A3B8", // Slate
};

const CATEGORY_ICONS: Record<string, string> = {
  Compras: "shopping_bag",
  "Saúde e bem-estar": "medical_services",
  "Serviços digitais": "devices",
  Alimentação: "restaurant",
  Moradia: "home",
  Transporte: "directions_car",
  Educação: "school",
  Lazer: "sports_esports",
  "Transferências e Pix": "send_money",
  Outros: "category",
};

function categorizeTransaction(tx: any): { parent: string; sub: string } {
  const text = `${tx.clean_description || ""} ${tx.description || ""} ${tx.category_pt || ""} ${tx.category || ""}`.toLowerCase();

  if (
    text.includes("supermercado") ||
    text.includes("padaria") ||
    text.includes("panificadora") ||
    text.includes("delivery") ||
    text.includes("ifood") ||
    text.includes("restaurante") ||
    text.includes("alimenta") ||
    text.includes("lanchonete") ||
    text.includes("açougue") ||
    text.includes("hortifruti") ||
    text.includes("carrefour") ||
    text.includes("pão de açúcar") ||
    text.includes("assai") ||
    text.includes("café") ||
    text.includes("bar ") ||
    text.includes("burger") ||
    text.includes("mcdonald")
  ) {
    let sub = "Restaurantes e Bares";
    if (text.includes("supermercado") || text.includes("carrefour") || text.includes("assai")) sub = "Supermercado";
    else if (text.includes("padaria") || text.includes("panificadora")) sub = "Padaria e Confeitaria";
    else if (text.includes("delivery") || text.includes("ifood")) sub = "Delivery de Refeições";
    return { parent: "Alimentação", sub };
  }

  if (
    text.includes("farmácia") ||
    text.includes("droga") ||
    text.includes("medicamento") ||
    text.includes("saúde") ||
    text.includes("hospital") ||
    text.includes("médic") ||
    text.includes("dentist") ||
    text.includes("academia") ||
    text.includes("wellhub") ||
    text.includes("smartfit") ||
    text.includes("psicolog")
  ) {
    let sub = "Farmácia e Medicamentos";
    if (text.includes("academia") || text.includes("smartfit") || text.includes("wellhub")) sub = "Academia e Bem-Estar";
    else if (text.includes("médic") || text.includes("hospital") || text.includes("consulta")) sub = "Consultas e Exames";
    return { parent: "Saúde e bem-estar", sub };
  }

  if (
    text.includes("uber") ||
    text.includes("99") ||
    text.includes("combustível") ||
    text.includes("posto") ||
    text.includes("gasolina") ||
    text.includes("ipiranga") ||
    text.includes("shell") ||
    text.includes("estacionamento") ||
    text.includes("sem parar") ||
    text.includes("pedágio") ||
    text.includes("transporte") ||
    text.includes("oficina") ||
    text.includes("mecânic")
  ) {
    let sub = "Mobilidade Urbana";
    if (text.includes("posto") || text.includes("combustível") || text.includes("gasolina") || text.includes("shell") || text.includes("ipiranga")) sub = "Combustível";
    else if (text.includes("estacionamento") || text.includes("pedágio")) sub = "Pedágio e Estacionamento";
    return { parent: "Transporte", sub };
  }

  if (
    text.includes("netflix") ||
    text.includes("spotify") ||
    text.includes("google") ||
    text.includes("apple") ||
    text.includes("chatgpt") ||
    text.includes("openai") ||
    text.includes("amazon prime") ||
    text.includes("disney") ||
    text.includes("youtube") ||
    text.includes("software") ||
    text.includes("streaming") ||
    text.includes("serviços digitais") ||
    text.includes("nuvem")
  ) {
    return { parent: "Serviços digitais", sub: "Streaming e Assinaturas" };
  }

  if (
    text.includes("luz") ||
    text.includes("energia") ||
    text.includes("enel") ||
    text.includes("cpfl") ||
    text.includes("água") ||
    text.includes("sabesp") ||
    text.includes("sanepar") ||
    text.includes("aluguel") ||
    text.includes("condomínio") ||
    text.includes("claro") ||
    text.includes("vivo") ||
    text.includes("tim") ||
    text.includes("internet") ||
    text.includes("telecom") ||
    text.includes("gás") ||
    text.includes("moradia")
  ) {
    let sub = "Despesas Residenciais";
    if (text.includes("claro") || text.includes("vivo") || text.includes("tim") || text.includes("internet")) sub = "Internet e Telefonia";
    else if (text.includes("luz") || text.includes("enel") || text.includes("energia") || text.includes("água")) sub = "Contas de Consumo";
    return { parent: "Moradia", sub };
  }

  if (
    text.includes("amazon") ||
    text.includes("mercado livre") ||
    text.includes("shopee") ||
    text.includes("magalu") ||
    text.includes("loja") ||
    text.includes("vestuário") ||
    text.includes("roupa") ||
    text.includes("calçado") ||
    text.includes("tinta") ||
    text.includes("material") ||
    text.includes("leroy") ||
    text.includes("eletrôn") ||
    text.includes("shopping") ||
    text.includes("varejo") ||
    text.includes("compra")
  ) {
    let sub = "Varejo e Compras Gerais";
    if (text.includes("tinta") || text.includes("material") || text.includes("leroy")) sub = "Casa e Construção";
    else if (text.includes("amazon") || text.includes("mercado livre") || text.includes("shopee")) sub = "E-Commerce / Online";
    return { parent: "Compras", sub };
  }

  if (
    text.includes("cinema") ||
    text.includes("show") ||
    text.includes("teatro") ||
    text.includes("ingresso") ||
    text.includes("viagem") ||
    text.includes("hotel") ||
    text.includes("airbnb") ||
    text.includes("lazer") ||
    text.includes("jogos") ||
    text.includes("steam")
  ) {
    return { parent: "Lazer", sub: "Entretenimento e Lazer" };
  }

  if (
    text.includes("pix para") ||
    text.includes("transferência") ||
    text.includes("ted") ||
    text.includes("doc")
  ) {
    return { parent: "Transferências e Pix", sub: "Pix Enviado a Terceiros" };
  }

  return { parent: "Outros", sub: tx.category_pt || tx.category || "Outras Despesas" };
}

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
      const isExpense = amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
      if (!isExpense) return; // apenas despesas!
      const absAmt = Math.abs(amt);
      if (absAmt === 0) return;

      total += absAmt;
      const { parent, sub } = categorizeTransaction(tx);

      if (!parentMap.has(parent)) {
        parentMap.set(parent, {
          name: parent,
          total: 0,
          count: 0,
          subcategories: new Map(),
        });
      }

      const pEntry = parentMap.get(parent)!;
      pEntry.total += absAmt;
      pEntry.count += 1;

      if (!pEntry.subcategories.has(sub)) {
        pEntry.subcategories.set(sub, { name: sub, total: 0, count: 0 });
      }
      const sEntry = pEntry.subcategories.get(sub)!;
      sEntry.total += absAmt;
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
