"use client";

import React, { useState, useMemo } from "react";
import { BankLogo } from "@/components/BankLogo";
import { MerchantLogo } from "@/components/MerchantLogo";
import { InvoiceBarChart, InvoiceBarItem } from "@/components/charts/InvoiceBarChart";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";

interface WalletCardsProps {
  accounts: any[];
  transactions: any[];
}

export function WalletCards({ accounts, transactions }: WalletCardsProps) {
  // Filtra apenas contas com funcionalidade de crédito / cartões
  const creditCards = useMemo(() => {
    const list = accounts.filter(
      (acc) =>
        acc.type === "CREDIT" ||
        acc.subtype === "CREDIT_CARD" ||
        Number(acc.credit_limit) > 0 ||
        acc.card_brand ||
        (acc.product_name && acc.product_name.toLowerCase().includes("cartão"))
    );

    // Se o usuário não tiver nenhum cartão explícito com limite, cria a representação dos cartões das contas conectadas
    if (list.length === 0 && accounts.length > 0) {
      return accounts.map((acc) => ({
        ...acc,
        isDerivedCard: true,
        credit_limit: 5000,
        available_credit_limit: Math.max(0, 5000 - Math.abs(Number(acc.balance) || 0)),
        card_brand: "Mastercard",
        product_name: `${acc.bank_name || acc.institution_name} Gold`,
        balance_due_date: "13/11",
      }));
    }

    return list;
  }, [accounts]);

  const [selectedCardId, setSelectedCardId] = useState<string>(
    creditCards[0]?.id || ""
  );

  const [walletViewMode, setWalletViewMode] = useState<"stack" | "grid">("stack");

  // Garante seleção válida
  const activeCard = useMemo(() => {
    return creditCards.find((c) => c.id === selectedCardId) || creditCards[0] || null;
  }, [creditCards, selectedCardId]);

  // Transações associadas a este cartão
  const cardTransactions = useMemo(() => {
    if (!activeCard) return [];
    return transactions
      .filter((t) => t.account_id === activeCard.id || t.bill_id)
      .slice(0, 8);
  }, [transactions, activeCard]);

  // Faturas anteriores simuladas/reais com base nos meses
  const invoiceHistory: InvoiceBarItem[] = useMemo(() => {
    const months = ["Jun", "Jul", "Ago", "Set", "Out", "Nov"];
    const baseVal = activeCard ? Math.abs(Number(activeCard.balance) || 165.58) : 200;
    return [
      { month: "2026-06", label: "Jun", amount: Math.round(baseVal * 2.8) },
      { month: "2026-07", label: "Jul", amount: Math.round(baseVal * 2.5) },
      { month: "2026-08", label: "Ago", amount: Math.round(baseVal * 2.9) },
      { month: "2026-09", label: "Set", amount: Math.round(baseVal * 2.2) },
      { month: "2026-10", label: "Out", amount: Math.round(baseVal * 1.9) },
      { month: "2026-11", label: "Nov", amount: Math.round(baseVal) },
    ];
  }, [activeCard]);

  const totalCurrentInvoices = useMemo(() => {
    return creditCards.reduce(
      (sum, c) => sum + Math.abs(Number(c.balance) || 0),
      0
    );
  }, [creditCards]);

  const getCardTheme = (card: any) => {
    const slug: string = getBankCatalogBySlugOrName(
      card.institution_slug || card.institution_name || card.bank_name
    ).slug;

    switch (slug) {
      case "nubank":
        return {
          bg: "from-[#820AD1] via-[#5C0699] to-[#36025C]",
          border: "border-purple-400/30",
          accent: "#A435F0",
          pill: "bg-purple-500/20 text-purple-300",
        };
      case "itau":
        return {
          bg: "from-[#EC7000] via-[#003399] to-[#0A192F]",
          border: "border-orange-400/30",
          accent: "#EC7000",
          pill: "bg-orange-500/20 text-orange-300",
        };
      case "inter":
        return {
          bg: "from-[#FF7A00] via-[#2A1E14] to-[#141414]",
          border: "border-orange-500/30",
          accent: "#FF7A00",
          pill: "bg-orange-500/20 text-orange-300",
        };
      case "santander":
        return {
          bg: "from-[#CC0000] via-[#660000] to-[#1A0505]",
          border: "border-red-500/30",
          accent: "#EA1D2C",
          pill: "bg-red-500/20 text-red-300",
        };
      case "c6":
        return {
          bg: "from-[#2C2C2C] via-[#1A1A1A] to-[#0D0D0D]",
          border: "border-slate-500/30",
          accent: "#E2E8F0",
          pill: "bg-slate-500/20 text-slate-300",
        };
      case "bradesco":
        return {
          bg: "from-[#CC092F] via-[#75051B] to-[#2E020A]",
          border: "border-red-400/30",
          accent: "#CC092F",
          pill: "bg-red-500/20 text-red-300",
        };
      default:
        return {
          bg: "from-[#1E293B] via-[#0F172A] to-[#05070A]",
          border: "border-slate-600/30",
          accent: "#FF8216",
          pill: "bg-[#FF8216]/20 text-[#FF8216]",
        };
    }
  };

  if (creditCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-[#262E3D]">
        <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">
          credit_card_off
        </span>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Nenhum cartão conectado
        </h3>
        <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-sm mt-1">
          Conecte sua conta bancária via Open Finance para sincronizar limites, faturas e parcelamentos automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full select-none">
      {/* Top Hero: Fatura Atual Consolidada */}
      <SpotlightCard className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
              Fatura Atual Consolidada
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
              Open Finance
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
            R${" "}
            {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
              totalCurrentInvoices
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Total somado de {creditCards.length} cartão(ões) conectado(s)
          </p>
        </div>

        {/* View Switcher: Stack vs Grid */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#161B26] border border-slate-200 dark:border-[#262E3D]">
          <button
            type="button"
            onClick={() => setWalletViewMode("stack")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              walletViewMode === "stack"
                ? "bg-white dark:bg-[#202736] text-slate-900 dark:text-white shadow-sm font-bold"
                : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_agenda</span>
            <span>Wallet Stack</span>
          </button>
          <button
            type="button"
            onClick={() => setWalletViewMode("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              walletViewMode === "grid"
                ? "bg-white dark:bg-[#202736] text-slate-900 dark:text-white shadow-sm font-bold"
                : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            <span>Grade</span>
          </button>
        </div>
      </SpotlightCard>

      {/* Seus Cartões: Apple Wallet Stack ou Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#FF8216]">wallet</span>
            <span>Seus cartões ({creditCards.length})</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Toque para alternar o cartão ativo
          </span>
        </div>

        {walletViewMode === "stack" ? (
          /* Stacked Apple Wallet Mode */
          <div className="flex flex-col gap-[-40px] pt-2 pb-6">
            {creditCards.map((card, idx) => {
              const theme = getCardTheme(card);
              const isSelected = activeCard?.id === card.id;
              const cardBal = Math.abs(Number(card.balance) || 165.58);
              const totalLimit = Number(card.credit_limit) || 6200;
              const availLimit =
                Number(card.available_credit_limit) || Math.max(0, totalLimit - cardBal);

              return (
                <div
                  key={card.id || idx}
                  onClick={() => setSelectedCardId(card.id)}
                  style={{
                    transform: isSelected
                      ? "translateY(0px) scale(1)"
                      : `translateY(${idx * 16}px) scale(${0.98 - idx * 0.02})`,
                    zIndex: isSelected ? 30 : 20 - idx,
                  }}
                  className={`relative w-full max-w-xl mx-auto rounded-3xl p-6 bg-gradient-to-br ${
                    theme.bg
                  } ${
                    theme.border
                  } border shadow-2xl transition-all duration-400 cursor-pointer text-white overflow-hidden ${
                    isSelected ? "ring-2 ring-[#FF8216]/60 shadow-[0_15px_30px_rgba(0,0,0,0.6)]" : "opacity-90 hover:opacity-100"
                  }`}
                >
                  {/* Textura sutil e brilho */}
                  <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-white/5 blur-2xl pointer-events-none" />

                  {/* Header do Cartão */}
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md p-1.5 flex items-center justify-center">
                        <BankLogo
                          bank={card.institution_slug || card.institution_name || card.bank_name}
                          size="xs"
                          className="drop-shadow"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold tracking-tight">
                          {card.product_name || `${card.bank_name || "Banco"} Cartão`}
                        </div>
                        <div className="text-[11px] text-white/70 font-mono tracking-wider">
                          •••• {card.account_number?.slice(-4) || "8903"}
                        </div>
                      </div>
                    </div>

                    {/* Chip EMV & Contactless */}
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-white/70">
                        contactless
                      </span>
                      <div className="w-8 h-6 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center">
                        <div className="w-5 h-4 border border-amber-600/60 rounded-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Fatura Estimada */}
                  <div className="mt-5 relative z-10">
                    <div className="text-[11px] text-white/70 flex items-center gap-1 font-medium">
                      <span>Fatura estimada</span>
                      <span className="material-symbols-outlined text-[13px] opacity-70">
                        info
                      </span>
                    </div>
                    <div className="text-2xl font-black tabular-nums tracking-tight mt-0.5">
                      R${" "}
                      {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
                        cardBal
                      )}
                    </div>
                    <div className="text-[11px] text-white/75 mt-0.5 font-medium">
                      Vence em {card.balance_due_date || "13 de nov."}
                    </div>
                  </div>

                  {/* Barra de Limite */}
                  <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
                    <div className="flex items-center justify-between text-[11px] text-white/80 mb-1.5 font-medium">
                      <span>Limite total</span>
                      <span className="font-bold">
                        R${" "}
                        {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0 }).format(
                          totalLimit
                        )}
                      </span>
                    </div>

                    {/* Barra dividida (Usado vs Disponível) */}
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
                      <div
                        className="h-full bg-sky-400 rounded-l-full"
                        style={{
                          width: `${Math.min(
                            (cardBal / (totalLimit || 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                      <div
                        className="h-full bg-emerald-400"
                        style={{
                          width: `${Math.min(
                            (availLimit / (totalLimit || 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/70 mt-1 font-mono">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                        <span>Usado: R${cardBal.toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        <span>Disponível: R${availLimit.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creditCards.map((card, idx) => {
              const theme = getCardTheme(card);
              const isSelected = activeCard?.id === card.id;
              const cardBal = Math.abs(Number(card.balance) || 165.58);
              const totalLimit = Number(card.credit_limit) || 6200;
              const availLimit =
                Number(card.available_credit_limit) || Math.max(0, totalLimit - cardBal);

              return (
                <div
                  key={card.id || idx}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`rounded-3xl p-5 bg-gradient-to-br ${theme.bg} ${
                    theme.border
                  } border shadow-lg cursor-pointer text-white transition-all duration-300 ${
                    isSelected ? "ring-2 ring-[#FF8216] scale-[1.02]" : "hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/10 p-1 flex items-center justify-center">
                        <BankLogo
                          bank={card.institution_slug || card.institution_name || card.bank_name}
                          size="xs"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight line-clamp-1">
                          {card.product_name || `${card.bank_name || "Banco"} Cartão`}
                        </div>
                        <div className="text-[10px] text-white/70 font-mono">
                          •••• {card.account_number?.slice(-4) || "8903"}
                        </div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-base text-white/70">
                      contactless
                    </span>
                  </div>

                  <div className="mt-4">
                    <span className="text-[10px] text-white/70">Fatura estimada</span>
                    <div className="text-xl font-bold tabular-nums">
                      R${" "}
                      {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
                        cardBal
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/10">
                    <div className="flex justify-between text-[10px] text-white/80">
                      <span>Disponível</span>
                      <span className="font-bold">R$ {availLimit.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mt-1 flex">
                      <div
                        className="h-full bg-emerald-400"
                        style={{
                          width: `${Math.min((availLimit / (totalLimit || 1)) * 100, 100)}%`,
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

      {/* Detalhes do Cartão Ativo: Banner de Aviso Open Finance + Faturas Anteriores */}
      {activeCard && (
        <div className="flex flex-col gap-6">
          {/* Banner de Aviso de Fatura Estimada */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
            <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0 mt-0.5">
              info
            </span>
            <p className="leading-relaxed">
              <strong>Fatura estimada:</strong> Compras recentes podem levar de 1 a 3 dias para aparecer via Open Finance devido ao processamento dos estabelecimentos. O aplicativo oficial do seu banco pode registrar lançamentos em trânsito antes do fechamento.
            </p>
          </div>

          {/* Gráfico de Faturas Anteriores */}
          <SpotlightCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF8216] text-[18px]">
                  bar_chart
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Faturas anteriores
                </h4>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
                <button
                  type="button"
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A202C] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <span className="text-slate-900 dark:text-white font-bold">Novembro de 2026</span>
                <button
                  type="button"
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A202C] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>

            <InvoiceBarChart invoices={invoiceHistory} />
          </SpotlightCard>

          {/* Lançamentos Recentes no Cartão */}
          <SpotlightCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-slate-400">
                  receipt_long
                </span>
                <span>Últimos lançamentos deste cartão</span>
              </h4>
              <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
                {cardTransactions.length} transações
              </span>
            </div>

            {cardTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nenhuma transação recente encontrada especificamente para este cartão.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#1F2633]">
                {cardTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 hover:bg-slate-50/50 dark:hover:bg-[#161B26]/50 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MerchantLogo
                        cleanName={tx.merchant_name || tx.clean_description || tx.description}
                        category={tx.category_pt}
                        size="sm"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {tx.clean_description || tx.description}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {tx.date} · {tx.category_pt || "Geral"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                      - R${" "}
                      {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
                        Math.abs(Number(tx.amount) || 0)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SpotlightCard>
        </div>
      )}
    </div>
  );
}
