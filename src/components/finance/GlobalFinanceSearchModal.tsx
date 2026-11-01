"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MerchantLogo } from "@/components/MerchantLogo";
import { BankLogo } from "@/components/BankLogo";
import { resolveMerchant } from "@/utils/finance/merchant-resolver";
import { useFinanceData } from "@/context/FinanceDataContext";
import Link from "next/link";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  clean_description?: string | null;
  raw_description?: string | null;
  category?: string | null;
  category_pt?: string | null;
  date: string;
  type?: string | null;
  operation_type?: string | null;
  is_internal_transfer?: boolean;
  is_refund?: boolean;
  installment_number?: number | null;
  total_installments?: number | null;
  bank_account_id?: string;
  bank_accounts?: {
    name?: string;
    institution_name?: string;
    institution_slug?: string;
  };
}

interface GlobalFinanceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  formatCurrency?: (value: number) => string;
  formatDate?: (date?: string) => string;
}

const SYSTEM_PAGES = [
  {
    title: "Visão Geral",
    path: "/dashboard",
    icon: "dashboard",
    category: "Página",
    keywords: ["home", "início", "dashboard", "saldo", "patrimônio", "geral"],
  },
  {
    title: "Holdings & Contas",
    path: "/holdings",
    icon: "account_balance",
    category: "Página",
    keywords: ["bancos", "contas", "investimentos", "custódia", "poupança", "cdb"],
  },
  {
    title: "Patrimônio & Ativos Imobilizados",
    path: "/assets",
    icon: "home_work",
    category: "Página",
    keywords: ["veículos", "fipe", "imóveis", "terrenos", "fgts", "físicos", "carros"],
  },
  {
    title: "Insights, Risco & Alocação",
    path: "/insights",
    icon: "analytics",
    category: "Página",
    keywords: ["alocação", "treemap", "fgc", "risco", "insights", "classes", "gráfico"],
  },
  {
    title: "Transações & Extrato",
    path: "/transactions",
    icon: "receipt_long",
    category: "Página",
    keywords: ["extrato", "gastos", "compras", "histórico", "entradas", "saídas"],
  },
  {
    title: "Metas & Reserva de Emergência",
    path: "/goals",
    icon: "flag",
    category: "Página",
    keywords: ["objetivos", "reserva", "metas", "poupar", "sonhos", "planejamento"],
  },
  {
    title: "Cartões de Crédito & Passivos",
    path: "/cards",
    icon: "credit_card",
    category: "Página",
    keywords: ["fatura", "cartão", "crédito", "parcelas", "limite", "vencimento"],
  },
  {
    title: "Conexões Open Finance",
    path: "/connections",
    icon: "sync_alt",
    category: "Página",
    keywords: ["bancos", "pluggy", "conectar", "sincronizar", "instituições"],
  },
  {
    title: "Espaço Compartilhado",
    path: "/shared",
    icon: "group",
    category: "Página",
    keywords: ["família", "membros", "conjunto", "divisão", "casal", "compartilhado"],
  },
  {
    title: "Kitsune AI (Consultoria)",
    path: "/kitsune",
    icon: "smart_toy",
    category: "Inteligência Artificial",
    keywords: ["chat", "ia", "perguntar", "consultoria", "planejador", "dúvida"],
  },
  {
    title: "Configurações & Biometria",
    path: "/settings",
    icon: "settings",
    category: "Sistema",
    keywords: ["biometria", "face id", "touch id", "pin", "segurança", "perfil", "tema"],
  },
];

export function GlobalFinanceSearchModal({
  isOpen,
  onClose,
  transactions: propTransactions,
  formatCurrency: propFormatCurrency,
  formatDate: propFormatDate,
}: GlobalFinanceSearchModalProps) {
  const router = useRouter();
  const {
    accounts,
    investments,
    customAssets,
    transactions: contextTransactions,
    isPrivacyMode,
  } = useFinanceData();

  const [searchTerm, setSearchTerm] = useState("");

  const transactions = propTransactions || contextTransactions || [];

  const formatCurrency =
    propFormatCurrency ||
    ((v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v));

  const formatDate =
    propFormatDate ||
    ((d?: string) =>
      d
        ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
        : "");

  // Fecha com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Termos populares sugeridos
  const quickTerms = [
    "Itaú",
    "Nubank",
    "Caixa",
    "iFood",
    "Uber",
    "Cartões",
    "Investimentos",
    "Metas",
    "Kitsune AI",
  ];

  // 1. Busca em Páginas e Rotas
  const matchedPages = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return SYSTEM_PAGES.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.keywords.some((k) => k.toLowerCase().includes(query))
    );
  }, [searchTerm]);

  // 2. Busca em Contas Bancárias & Cartões
  const matchedAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return accounts.filter((acc) => {
      const name = (acc.name || "").toLowerCase();
      const inst = (acc.institution_name || acc.bank_name || "").toLowerCase();
      const subtype = (acc.subtype || acc.type || "").toLowerCase();
      return name.includes(query) || inst.includes(query) || subtype.includes(query);
    });
  }, [searchTerm, accounts]);

  // 3. Busca em Investimentos
  const matchedInvestments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return investments.filter((inv) => {
      const name = (inv.name || "").toLowerCase();
      const inst = (inv.institution_name || "").toLowerCase();
      const type = (inv.type || inv.subtype || "").toLowerCase();
      return name.includes(query) || inst.includes(query) || type.includes(query);
    });
  }, [searchTerm, investments]);

  // 4. Busca em Ativos Físicos (Veículos, Terrenos, FGTS)
  const matchedCustomAssets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return customAssets.filter((asset) => {
      const name = (asset.name || "").toLowerCase();
      const cat = (asset.category || "").toLowerCase();
      return name.includes(query) || cat.includes(query);
    });
  }, [searchTerm, customAssets]);

  // 5. Análise de Transações & Dossiê
  const searchAnalytics = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return null;

    const filtered = transactions.filter((tx) => {
      if (tx.is_internal_transfer) return false;
      const desc = (tx.clean_description || tx.description || "").toLowerCase();
      const raw = (tx.raw_description || "").toLowerCase();
      const cat = (tx.category_pt || tx.category || "").toLowerCase();
      return desc.includes(query) || raw.includes(query) || cat.includes(query);
    });

    if (filtered.length === 0) {
      return {
        matchedTransactions: [],
        totalSpent: 0,
        currentMonthSpent: 0,
        lastMonthSpent: 0,
        avgTicket: 0,
        count: 0,
        preferredPayment: "Nenhum",
        peakDay: "N/D",
        resolvedBrand: resolveMerchant(searchTerm),
      };
    }

    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

    let total = 0;
    let curMonth = 0;
    let lastMonth = 0;
    const bankCounts: Record<string, number> = {};
    const dayCounts: Record<string, number> = {
      Domingo: 0,
      Segunda: 0,
      Terça: 0,
      Quarta: 0,
      Quinta: 0,
      Sexta: 0,
      Sábado: 0,
    };
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    filtered.forEach((tx) => {
      const amt = Math.abs(Number(tx.amount) || 0);
      total += amt;

      const txMonth = (tx.date || "").slice(0, 7);
      if (txMonth === curMonthStr) curMonth += amt;
      if (txMonth === lastMonthStr) lastMonth += amt;

      const bankName =
        tx.bank_accounts?.institution_name || tx.bank_accounts?.name || "Cartão/Conta";
      bankCounts[bankName] = (bankCounts[bankName] || 0) + 1;

      if (tx.date) {
        const parts = tx.date.split("T")[0].split("-");
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const dayName = dayNames[d.getDay()];
          if (dayName) dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        }
      }
    });

    const preferredPayment =
      Object.entries(bankCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Cartão";
    const peakDay =
      Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Fim de Semana";
    const resolvedBrand = resolveMerchant(searchTerm, filtered[0]?.category_pt);

    return {
      matchedTransactions: filtered,
      totalSpent: total,
      currentMonthSpent: curMonth,
      lastMonthSpent: lastMonth,
      avgTicket: total / filtered.length,
      count: filtered.length,
      preferredPayment,
      peakDay,
      resolvedBrand,
    };
  }, [searchTerm, transactions]);

  const hasAnyResults =
    matchedPages.length > 0 ||
    matchedAccounts.length > 0 ||
    matchedInvestments.length > 0 ||
    matchedCustomAssets.length > 0 ||
    (searchAnalytics && searchAnalytics.count > 0);

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-8 md:pt-14 px-3 sm:px-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#121214] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header de Pesquisa */}
        <div className="p-4 md:p-5 border-b border-[#27272A] flex items-center gap-3 bg-[#18181B]/60">
          <div className="w-9 h-9 rounded-xl bg-[#E11D48]/10 border border-[#E11D48]/20 flex items-center justify-center text-[#E11D48] shrink-0">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar páginas, contas, cartões, investimentos ou lojas..."
            className="flex-1 bg-transparent border-none text-sm md:text-base text-[#F4F4F5] placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-[11px] font-mono text-zinc-400 bg-[#18181B] border border-[#27272A] rounded-md hover:text-white transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 scrollbar-thin">
          {/* Tags Rápidas se busca vazia */}
          {!searchTerm && (
            <div className="space-y-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Atalhos Rápidos & Mais Acessados
              </p>
              <div className="flex flex-wrap gap-2">
                {quickTerms.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSearchTerm(term)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px] text-[#E11D48]">
                      arrow_forward
                    </span>
                    <span>{term}</span>
                  </button>
                ))}
              </div>

              {/* Seções Recomendadas */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SYSTEM_PAGES.slice(0, 6).map((page) => (
                  <button
                    key={page.path}
                    type="button"
                    onClick={() => handleNavigate(page.path)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#18181B]/50 hover:bg-[#18181B] border border-[#27272A] text-left transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#27272A] text-zinc-300 group-hover:text-[#E11D48] flex items-center justify-center shrink-0 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">
                        {page.icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-[#E11D48] transition-colors truncate">
                        {page.title}
                      </p>
                      <p className="text-[10px] text-zinc-400">{page.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. SEÇÃO DE PÁGINAS DO SISTEMA ENCONTRADAS */}
          {matchedPages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#E11D48]">
                  navigation
                </span>
                Páginas & Navegação ({matchedPages.length})
              </h4>
              <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/60 border border-[#27272A] overflow-hidden">
                {matchedPages.map((page) => (
                  <button
                    key={page.path}
                    type="button"
                    onClick={() => handleNavigate(page.path)}
                    className="w-full p-3 flex items-center justify-between hover:bg-[#27272A]/50 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#27272A] text-[#E11D48] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          {page.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">{page.title}</p>
                        <p className="text-[10px] text-zinc-400">Ir para {page.path}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#E11D48] flex items-center gap-0.5">
                      Acessar
                      <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. SEÇÃO DE CONTAS & CARTÕES ENCONTRADOS */}
          {matchedAccounts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#E11D48]">
                  account_balance
                </span>
                Contas Bancárias & Cartões ({matchedAccounts.length})
              </h4>
              <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/60 border border-[#27272A] overflow-hidden">
                {matchedAccounts.map((acc) => {
                  const isCard = acc.type === "CREDIT" || acc.subtype === "CREDIT_CARD";
                  const targetRoute = isCard ? "/cards" : "/holdings";
                  const bal = Number(acc.balance) || 0;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleNavigate(targetRoute)}
                      className="w-full p-3 flex items-center justify-between hover:bg-[#27272A]/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <BankLogo
                          bank={acc.institution_slug || acc.institution_name || acc.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {acc.name || acc.institution_name}
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            {acc.institution_name || "Banco"} •{" "}
                            {isCard ? "Cartão de Crédito" : "Conta Corrente"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-bold text-white">
                          {isPrivacyMode ? "R$ ••••••" : formatCurrency(bal)}
                        </p>
                        <p className="text-[10px] text-[#E11D48]">Ver detalhes →</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. SEÇÃO DE INVESTIMENTOS ENCONTRADOS */}
          {matchedInvestments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">
                  trending_up
                </span>
                Investimentos & Custódia ({matchedInvestments.length})
              </h4>
              <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/60 border border-[#27272A] overflow-hidden">
                {matchedInvestments.map((inv) => {
                  const bal = Number(inv.balance) || 0;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handleNavigate("/holdings")}
                      className="w-full p-3 flex items-center justify-between hover:bg-[#27272A]/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[16px]">
                            show_chart
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{inv.name}</p>
                          <p className="text-[10px] text-zinc-400">
                            {inv.institution_name || "Investimento"} •{" "}
                            {inv.subtype || inv.type || "Renda Fixa"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-bold text-emerald-400">
                          {isPrivacyMode ? "R$ ••••••" : formatCurrency(bal)}
                        </p>
                        <p className="text-[10px] text-zinc-400">Custódia →</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. SEÇÃO DE ATIVOS IMOBILIZADOS & FÍSICOS */}
          {matchedCustomAssets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-amber-400">
                  home_work
                </span>
                Ativos Físicos & Imobilizados ({matchedCustomAssets.length})
              </h4>
              <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/60 border border-[#27272A] overflow-hidden">
                {matchedCustomAssets.map((asset) => {
                  const val = Number(asset.current_value) || 0;
                  const catLabel =
                    asset.category === "vehicle"
                      ? "Veículo (FIPE)"
                      : asset.category === "real_estate"
                      ? "Imóvel"
                      : asset.category === "land"
                      ? "Terreno"
                      : asset.category === "fgts"
                      ? "FGTS Caixa"
                      : "Ativo Físico";
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleNavigate("/assets")}
                      className="w-full p-3 flex items-center justify-between hover:bg-[#27272A]/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[16px]">
                            directions_car
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{asset.name}</p>
                          <p className="text-[10px] text-zinc-400">{catLabel}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-bold text-amber-400">
                          {isPrivacyMode ? "R$ ••••••" : formatCurrency(val)}
                        </p>
                        <p className="text-[10px] text-zinc-400">Patrimônio →</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. DOSSIÊ INTELIGENTE DE TRANSAÇÕES */}
          {searchAnalytics && searchAnalytics.count > 0 && (
            <div className="space-y-4 pt-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#E11D48]">
                  receipt_long
                </span>
                Extrato & Dossiê de Consumo ({searchAnalytics.count})
              </h4>

              {/* Card Resumo do Estabelecimento */}
              <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-b from-[#18181B] to-[#121215] border border-white/10 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <MerchantLogo
                      cleanName={searchAnalytics.resolvedBrand.cleanName}
                      category={searchAnalytics.resolvedBrand.category}
                      size="lg"
                    />
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                        {searchAnalytics.resolvedBrand.cleanName}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        {searchAnalytics.resolvedBrand.category} • {searchAnalytics.count} compras
                        encontradas
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/kitsune?prompt=${encodeURIComponent(
                      `Faça uma análise profunda dos meus gastos com ${searchAnalytics.resolvedBrand.cleanName}. Me diga se estou gastando demais e sugira como otimizar.`
                    )}`}
                    onClick={onClose}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-[#E11D48]/90 transition-transform active:scale-95 shadow-md"
                  >
                    <span>✨ Analisar com IA</span>
                  </Link>
                </div>

                {/* Grade de Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/5">
                  <div className="p-2.5 rounded-xl bg-white/[0.03]">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Total Gasto</span>
                    <span className="text-xs md:text-sm font-bold text-white">
                      {isPrivacyMode ? "R$ ••••••" : formatCurrency(searchAnalytics.totalSpent)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03]">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Ticket Médio</span>
                    <span className="text-xs md:text-sm font-bold text-emerald-400">
                      {isPrivacyMode ? "R$ ••••••" : formatCurrency(searchAnalytics.avgTicket)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03]">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Mês Atual</span>
                    <span className="text-xs md:text-sm font-bold text-[#E11D48]">
                      {isPrivacyMode
                        ? "R$ ••••••"
                        : formatCurrency(searchAnalytics.currentMonthSpent)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03]">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Pico de Consumo</span>
                    <span className="text-xs md:text-sm font-bold text-zinc-200">
                      {searchAnalytics.peakDay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Transações Encontradas */}
              <div className="space-y-1.5">
                <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/60 border border-[#27272A] overflow-hidden">
                  {searchAnalytics.matchedTransactions.slice(0, 30).map((tx) => {
                    const amt = Math.abs(Number(tx.amount) || 0);
                    const isIncome =
                      Number(tx.amount) > 0 &&
                      tx.type === "CREDIT" &&
                      tx.operation_type !== "CREDIT_CARD";
                    return (
                      <div
                        key={tx.id}
                        className="p-3 flex items-center justify-between hover:bg-[#27272A]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          <MerchantLogo
                            cleanName={tx.clean_description || tx.description}
                            rawDescription={tx.raw_description}
                            category={tx.category_pt}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {tx.clean_description || tx.description}
                            </p>
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                              <span>{formatDate(tx.date)}</span>
                              {tx.bank_accounts?.institution_name && (
                                <>
                                  <span>•</span>
                                  <span>{tx.bank_accounts.institution_name}</span>
                                </>
                              )}
                              {tx.total_installments && tx.total_installments > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400">
                                    {tx.installment_number || 1}/{tx.total_installments}x
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-mono font-semibold shrink-0 ${
                            isIncome ? "text-emerald-400" : "text-zinc-200"
                          }`}
                        >
                          {isPrivacyMode
                            ? "R$ ••••••"
                            : `${isIncome ? "+" : "-"} ${formatCurrency(amt)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Vazio se buscou e não encontrou absolutamente nada */}
          {searchTerm && !hasAnyResults && (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-2xl">
                🔍
              </div>
              <h4 className="text-base font-semibold text-white">Nenhum resultado encontrado</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Não encontramos páginas, contas, cartões, investimentos ou compras correspondentes a
                &quot;{searchTerm}&quot;.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}