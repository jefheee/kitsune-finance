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
  payer_name?: string;
  receiver_name?: string;
  is_internal_transfer?: boolean;
  is_refund?: boolean;
  date?: string;
  executed_at?: string;
  bank_accounts?: any;
}

interface CategoriesViewProps {
  transactions: TransactionLike[];
  formatCurrency: (val: number) => string;
  timeGranularity?: "day" | "week" | "month" | "year";
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

export function categorizeTransaction(tx: any): { parent: string; sub: string } {
  const text = `${tx.clean_description || ""} ${tx.description || ""} ${tx.category_pt || ""} ${tx.category || ""} ${tx.receiver_name || ""}`.toLowerCase();

  // 1. Alimentação
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
    text.includes("mcdonald") ||
    text.includes("subway") ||
    text.includes("choperia")
  ) {
    let sub = "Restaurantes e Bares";
    if (text.includes("supermercado") || text.includes("carrefour") || text.includes("assai") || text.includes("hortifruti") || text.includes("açougue")) sub = "Supermercado";
    else if (text.includes("padaria") || text.includes("panificadora")) sub = "Padaria e Confeitaria";
    else if (text.includes("delivery") || text.includes("ifood")) sub = "Delivery de Refeições";
    return { parent: "Alimentação", sub };
  }

  // 2. Saúde e bem-estar
  if (
    text.includes("farmácia") ||
    text.includes("farmacia") ||
    text.includes("droga") ||
    text.includes("medicamento") ||
    text.includes("saúde") ||
    text.includes("hospital") ||
    text.includes("médic") ||
    text.includes("dentist") ||
    text.includes("academia") ||
    text.includes("wellhub") ||
    text.includes("smartfit") ||
    text.includes("psicolog") ||
    text.includes("laboratorio") ||
    text.includes("clinica")
  ) {
    let sub = "Farmácia e Medicamentos";
    if (text.includes("academia") || text.includes("smartfit") || text.includes("wellhub")) sub = "Academia e Bem-Estar";
    else if (text.includes("médic") || text.includes("hospital") || text.includes("consulta") || text.includes("laboratorio") || text.includes("clinica") || text.includes("dentist")) sub = "Consultas e Exames";
    return { parent: "Saúde e bem-estar", sub };
  }

  // 3. Transporte
  if (
    text.includes("uber") ||
    text.includes("99") ||
    text.includes("combustível") ||
    text.includes("combustivel") ||
    text.includes("posto") ||
    text.includes("gasolina") ||
    text.includes("ipiranga") ||
    text.includes("shell") ||
    text.includes("estacionamento") ||
    text.includes("sem parar") ||
    text.includes("pedágio") ||
    text.includes("pedagio") ||
    text.includes("transporte") ||
    text.includes("oficina") ||
    text.includes("mecânic") ||
    text.includes("auto posto")
  ) {
    let sub = "Mobilidade Urbana";
    if (text.includes("posto") || text.includes("combustível") || text.includes("combustivel") || text.includes("gasolina") || text.includes("shell") || text.includes("ipiranga")) sub = "Combustível";
    else if (text.includes("estacionamento") || text.includes("pedágio") || text.includes("pedagio") || text.includes("sem parar")) sub = "Pedágio e Estacionamento";
    else if (text.includes("oficina") || text.includes("mecânic")) sub = "Manutenção Veicular";
    return { parent: "Transporte", sub };
  }

  // 4. Serviços Digitais
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
    text.includes("nuvem") ||
    text.includes("github") ||
    text.includes("vercel") ||
    text.includes("adobe")
  ) {
    return { parent: "Serviços digitais", sub: "Streaming e Assinaturas" };
  }

  // 5. Moradia
  if (
    text.includes("luz") ||
    text.includes("energia") ||
    text.includes("enel") ||
    text.includes("cpfl") ||
    text.includes("água") ||
    text.includes("agua") ||
    text.includes("sabesp") ||
    text.includes("sanepar") ||
    text.includes("aluguel") ||
    text.includes("condomínio") ||
    text.includes("condominio") ||
    text.includes("claro") ||
    text.includes("vivo") ||
    text.includes("tim") ||
    text.includes("internet") ||
    text.includes("telecom") ||
    text.includes("gás") ||
    text.includes("gas") ||
    text.includes("moradia")
  ) {
    let sub = "Despesas Residenciais";
    if (text.includes("claro") || text.includes("vivo") || text.includes("tim") || text.includes("internet")) sub = "Internet e Telefonia";
    else if (text.includes("luz") || text.includes("enel") || text.includes("energia") || text.includes("água") || text.includes("agua") || text.includes("gás") || text.includes("gas")) sub = "Contas de Consumo";
    else if (text.includes("aluguel") || text.includes("condomínio") || text.includes("condominio")) sub = "Aluguel e Condomínio";
    return { parent: "Moradia", sub };
  }

  // 6. Compras
  if (
    text.includes("amazon") ||
    text.includes("mercado livre") ||
    text.includes("mercadolivre") ||
    text.includes("shopee") ||
    text.includes("magalu") ||
    text.includes("loja") ||
    text.includes("vestuário") ||
    text.includes("vestuario") ||
    text.includes("roupa") ||
    text.includes("calçado") ||
    text.includes("calcado") ||
    text.includes("tinta") ||
    text.includes("material") ||
    text.includes("leroy") ||
    text.includes("eletrôn") ||
    text.includes("shopping") ||
    text.includes("varejo") ||
    text.includes("compra") ||
    text.includes("zara") ||
    text.includes("renner") ||
    text.includes("riachuelo")
  ) {
    let sub = "Varejo e Compras Gerais";
    if (text.includes("tinta") || text.includes("material") || text.includes("leroy")) sub = "Casa e Construção";
    else if (text.includes("amazon") || text.includes("mercado livre") || text.includes("mercadolivre") || text.includes("shopee")) sub = "E-Commerce / Online";
    else if (text.includes("roupa") || text.includes("calçado") || text.includes("vestuário") || text.includes("zara") || text.includes("renner")) sub = "Vestuário e Moda";
    return { parent: "Compras", sub };
  }

  // 7. Lazer
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
    text.includes("steam") ||
    text.includes("playstation") ||
    text.includes("xbox")
  ) {
    let sub = "Entretenimento e Lazer";
    if (text.includes("viagem") || text.includes("hotel") || text.includes("airbnb")) sub = "Viagens e Hospedagem";
    else if (text.includes("steam") || text.includes("jogos") || text.includes("playstation")) sub = "Games e Jogos";
    return { parent: "Lazer", sub };
  }

  // 8. Educação
  if (
    text.includes("curso") ||
    text.includes("faculdade") ||
    text.includes("universidade") ||
    text.includes("escola") ||
    text.includes("livro") ||
    text.includes("livraria") ||
    text.includes("educação") ||
    text.includes("educacao") ||
    text.includes("udemy") ||
    text.includes("alura")
  ) {
    return { parent: "Educação", sub: "Cursos e Formação" };
  }

  // 9. Transferências e Pix a Terceiros
  if (
    text.includes("pix para") ||
    text.includes("transferência") ||
    text.includes("transferencia") ||
    text.includes("ted") ||
    text.includes("doc")
  ) {
    return { parent: "Transferências e Pix", sub: "Pix Enviado a Terceiros" };
  }

  return { parent: "Outros", sub: tx.category_pt || tx.category || "Outras Despesas" };
}

export function CategoriesView({
  transactions,
  formatCurrency,
  timeGranularity = "month",
}: CategoriesViewProps) {
  // Estado de navegação temporal baseado em Date
  const [targetDate, setTargetDate] = useState<Date>(new Date());
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

  const handlePrevPeriod = () => {
    setTargetDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  };

  const handleNextPeriod = () => {
    setTargetDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  // Rótulo do Período Selecionado
  const periodLabel = useMemo(() => {
    if (timeGranularity === "day") {
      return "Últimos 7 Dias";
    }
    if (timeGranularity === "week") {
      return "Últimas 2 Semanas";
    }
    if (timeGranularity === "year") {
      return `Ano de ${targetDate.getFullYear()}`;
    }
    return targetDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [timeGranularity, targetDate]);

  // Filtra as transações genuínas correspondentes ao período ativo
  const periodTransactions = useMemo(() => {
    const targetMonthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const now = new Date();

    return transactions.filter((tx) => {
      // Ignora transferências internas e estornos
      if (tx.is_internal_transfer || tx.is_refund) return false;

      // Ignora movimentações puras de investimentos (CDB, aplicações, resgates)
      const catLower = (tx.category_pt || tx.category || "").toLowerCase();
      const descLower = (tx.clean_description || tx.description || "").toLowerCase();
      if (
        catLower.includes("investimento") ||
        catLower.includes("renda fixa") ||
        descLower.includes("resgate cdb") ||
        descLower.includes("aplic cdb") ||
        descLower.includes("aplicacao aut") ||
        descLower.includes("rend pago")
      ) {
        return false;
      }

      // Valida se é realmente uma despesa (valor negativo ou tipo débito/crédito)
      const amt = Number(tx.amount) || 0;
      const isExpense = amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
      if (!isExpense) return false;

      const rawDate = tx.executed_at || tx.date;
      if (!rawDate) return false;
      const dStr = rawDate.split("T")[0];

      if (timeGranularity === "day") {
        const txDate = new Date(rawDate);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return txDate >= sevenDaysAgo && txDate <= now;
      }

      if (timeGranularity === "week") {
        const txDate = new Date(rawDate);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        return txDate >= fourteenDaysAgo && txDate <= now;
      }

      if (timeGranularity === "year") {
        return dStr.startsWith(`${targetDate.getFullYear()}`);
      }

      // Padrão Mensal: corresponde estritamente ao mês selecionado
      return dStr.startsWith(targetMonthStr);
    });
  }, [transactions, targetDate, timeGranularity]);

  // Agregação Matemática por Categoria
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

    periodTransactions.forEach((tx) => {
      const amt = Math.abs(Number(tx.amount) || 0);
      if (amt === 0) return;

      total += amt;
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
  }, [periodTransactions]);

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* Top Header Card com Donut Chart */}
      <SpotlightCard className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Total Gasto no Período */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216]">
            Despesas Reais Conciliadas
          </span>
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
            {formatCurrency(totalSpend)}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1 font-medium capitalize">
            gasto em {periodLabel} • {periodTransactions.length} lançamentos
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

        {/* Seletor de Período / Mês */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-white bg-slate-100 dark:bg-[#161618] p-1.5 rounded-xl border border-slate-200 dark:border-[#27272A]">
          <button
            type="button"
            onClick={handlePrevPeriod}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#202024] cursor-pointer text-slate-500 dark:text-slate-400 transition-colors"
            title="Mês anterior"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <span className="px-2 capitalize">{periodLabel}</span>
          <button
            type="button"
            onClick={handleNextPeriod}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#202024] cursor-pointer text-slate-500 dark:text-slate-400 transition-colors"
            title="Próximo mês"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </SpotlightCard>

      {/* Accordion de Categorias */}
      <SpotlightCard className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Detalhamento por Categorias ({categoriesList.length})
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {periodTransactions.length} transações analisadas
          </span>
        </div>

        {categoriesList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhuma despesa registrada neste período.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-[#27272A]">
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
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-[#161618] cursor-pointer transition-colors"
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
                      <div className="w-24 md:w-36 h-2 rounded-full bg-slate-100 dark:bg-[#18181B] overflow-hidden hidden sm:block">
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
                            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50/60 dark:bg-[#121214]/60 text-xs"
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
                              <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-[#18181B] overflow-hidden hidden sm:block">
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
        )}
      </SpotlightCard>
    </div>
  );
}