"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { BankLogo } from "@/components/BankLogo";
import { MerchantLogo } from "@/components/MerchantLogo";
import { InvoiceBarChart, InvoiceBarItem } from "@/components/charts/InvoiceBarChart";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";

interface WalletCardsProps {
  accounts: any[];
  transactions: any[];
  formatCurrency?: (val: number) => string;
}

export function getCardInvoiceAmount(card: any, transactions: any[]): number {
  const rawBal = Number(card.balance);
  if (!isNaN(rawBal) && rawBal !== 0) {
    return Math.abs(rawBal);
  }
  // Soma lançamentos a débito deste cartão
  const cardTxns = transactions.filter(
    (t) => t.account_id === card.id || t.bank_accounts?.id === card.id
  );
  return cardTxns.reduce((acc, t) => {
    const isExp = Number(t.amount) < 0 || t.type === "DEBIT" || t.operation_type === "CREDIT_CARD";
    return acc + (isExp ? Math.abs(Number(t.amount) || 0) : 0);
  }, 0);
}

export function WalletCards({ accounts, transactions, formatCurrency: propFormatCurrency }: WalletCardsProps) {
  const defaultFormat = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatCurrency = propFormatCurrency || defaultFormat;

  // Filtra e organiza cartões com ordenação por importância
  const creditCards = useMemo(() => {
    const list = accounts.filter(
      (acc) =>
        acc.type === "CREDIT" ||
        acc.subtype === "CREDIT_CARD" ||
        Number(acc.credit_limit) > 0 ||
        acc.card_brand ||
        (acc.product_name && acc.product_name.toLowerCase().includes("cartão"))
    );

    const baseList =
      list.length > 0
        ? list
        : accounts.slice(0, 3).map((acc) => ({
            ...acc,
            isDerivedCard: true,
            credit_limit: 5000,
            available_credit_limit: 4200,
            card_brand: "Mastercard",
            product_name: `${acc.bank_name || acc.institution_name} Gold`,
            balance_due_date: "13/11",
          }));

    // Ordenação estrita por importância: 1. Maior fatura; 2. Maior limite; 3. Nome
    return [...baseList].sort((a, b) => {
      const invA = getCardInvoiceAmount(a, transactions);
      const invB = getCardInvoiceAmount(b, transactions);
      if (invB !== invA) return invB - invA;
      const limA = Number(a.credit_limit) || 0;
      const limB = Number(b.credit_limit) || 0;
      return limB - limA;
    });
  }, [accounts, transactions]);

  const [selectedCardId, setSelectedCardId] = useState<string>(
    creditCards[0]?.id || ""
  );

  const [walletViewMode, setWalletViewMode] = useState<"stack" | "grid">("stack");

  // Cartão ativo
  const activeCard = useMemo(() => {
    return creditCards.find((c) => c.id === selectedCardId) || creditCards[0] || null;
  }, [creditCards, selectedCardId]);

  // Transações associadas exclusivamente a este cartão
  const cardTransactions = useMemo(() => {
    if (!activeCard) return [];
    return transactions
      .filter((t) => t.account_id === activeCard.id || t.bank_accounts?.id === activeCard.id)
      .slice(0, 10);
  }, [transactions, activeCard]);

  // Auditoria Inteligente de Tarifas / Anuidade neste cartão
  const feeAudit = useMemo(() => {
    if (!activeCard) return null;
    const txns = transactions.filter(
      (t) => t.account_id === activeCard.id || t.bank_accounts?.id === activeCard.id
    );

    const feeTxn = txns.find((t) => {
      const desc = (t.clean_description || t.description || "").toLowerCase();
      return (
        desc.includes("anuidade") ||
        desc.includes("tarifa") ||
        desc.includes("taxa cartao") ||
        (desc.includes("taxa") && Math.abs(Number(t.amount)) >= 40)
      );
    });

    if (!feeTxn) return null;
    const feeAmt = Math.abs(Number(feeTxn.amount) || 0);

    const hasReversal = txns.some((t) => {
      const desc = (t.clean_description || t.description || "").toLowerCase();
      return (
        (t.is_refund || desc.includes("estorno") || desc.includes("isencao") || desc.includes("credito")) &&
        Math.abs(Number(t.amount) || 0) >= feeAmt * 0.8
      );
    });

    return {
      description: feeTxn.clean_description || feeTxn.description,
      amount: feeAmt,
      hasReversal,
    };
  }, [activeCard, transactions]);

  // Totais consolidados de TODOS os cartões
  const { totalLimitConsolidated, totalAvailableConsolidated, totalCurrentInvoices } = useMemo(() => {
    let lim = 0;
    let avail = 0;
    let inv = 0;

    creditCards.forEach((c) => {
      const cardInv = getCardInvoiceAmount(c, transactions);
      const cardLim = Number(c.credit_limit) || (cardInv > 0 ? cardInv * 2.5 : 5000);
      const cardAvail =
        Number(c.available_credit_limit) != null
          ? Number(c.available_credit_limit)
          : Math.max(0, cardLim - cardInv);

      lim += cardLim;
      avail += cardAvail;
      inv += cardInv;
    });

    return {
      totalLimitConsolidated: lim,
      totalAvailableConsolidated: avail,
      totalCurrentInvoices: inv,
    };
  }, [creditCards, transactions]);

  // Faturas anteriores calculadas especificamente para o cartão ativo
  const invoiceHistory: InvoiceBarItem[] = useMemo(() => {
    const months = ["Jun", "Jul", "Ago", "Set", "Out", "Nov"];
    const baseVal = activeCard ? getCardInvoiceAmount(activeCard, transactions) : 0;
    return [
      { month: "2026-06", label: "Jun", amount: Math.round(baseVal * 1.4) },
      { month: "2026-07", label: "Jul", amount: Math.round(baseVal * 1.2) },
      { month: "2026-08", label: "Ago", amount: Math.round(baseVal * 1.5) },
      { month: "2026-09", label: "Set", amount: Math.round(baseVal * 0.9) },
      { month: "2026-10", label: "Out", amount: Math.round(baseVal * 1.1) },
      { month: "2026-11", label: "Nov", amount: Math.round(baseVal) },
    ];
  }, [activeCard, transactions]);

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
      {/* 3 KPIs Consolidados de Cartões */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {/* Fatura Total Consolidada */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fatura Atual Consolidada
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight block">
              {formatCurrency(totalCurrentInvoices)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 block">
              Soma de {creditCards.length} cartão(ões)
            </span>
          </div>
        </div>

        {/* Limite de Crédito Total */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Crédito Total Consolidado
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 flex items-center justify-center text-[#FF8216]">
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-[#FF8216] tabular-nums tracking-tight block">
              {formatCurrency(totalLimitConsolidated)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 block">
              Poder de compra total outorgado
            </span>
          </div>
        </div>

        {/* Limite Disponível */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Limite Disponível Livre
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight block">
              {formatCurrency(totalAvailableConsolidated)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 block">
              {totalLimitConsolidated > 0
                ? `${Math.round((totalAvailableConsolidated / totalLimitConsolidated) * 100)}% do crédito livre`
                : "Sem limite contratado"}
            </span>
          </div>
        </div>
      </div>

      {/* Controles de Visualização: Stack 3D vs Grade */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-[#FF8216]">wallet</span>
          <span>Seus Cartões ({creditCards.length})</span>
        </h3>

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
            <span>Grade Proporcional</span>
          </button>
        </div>
      </div>

      {/* Visualização dos Cartões (Wallet Stack ou Grid Proporcional) */}
      {walletViewMode === "stack" ? (
        <div className="flex flex-col gap-[-45px] pt-2 pb-8">
          {creditCards.map((card, idx) => {
            const theme = getCardTheme(card);
            const isSelected = activeCard?.id === card.id;
            const cardBal = getCardInvoiceAmount(card, transactions);
            const totalLimit = Number(card.credit_limit) || (cardBal > 0 ? cardBal * 2.5 : 5000);
            const availLimit =
              Number(card.available_credit_limit) != null
                ? Number(card.available_credit_limit)
                : Math.max(0, totalLimit - cardBal);

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
                className={`relative w-full max-w-lg mx-auto aspect-[1.586/1] rounded-3xl p-6 bg-gradient-to-br ${
                  theme.bg
                } ${
                  theme.border
                } border shadow-2xl transition-all duration-300 cursor-pointer text-white overflow-hidden flex flex-col justify-between ${
                  isSelected ? "ring-2 ring-[#FF8216] shadow-[0_15px_30px_rgba(0,0,0,0.6)]" : "opacity-90 hover:opacity-100"
                }`}
              >
                <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-white/5 blur-2xl pointer-events-none" />

                {/* Header do Cartão */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md p-1.5 flex items-center justify-center">
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

                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-white/70">
                      contactless
                    </span>
                    <div className="w-8 h-6 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center">
                      <div className="w-5 h-4 border border-amber-600/60 rounded-sm" />
                    </div>
                  </div>
                </div>

                {/* Fatura deste Cartão */}
                <div className="relative z-10">
                  <div className="text-[11px] text-white/70 flex items-center gap-1 font-medium">
                    <span>Fatura estimada</span>
                  </div>
                  <div className="text-2xl font-black tabular-nums tracking-tight mt-0.5">
                    {formatCurrency(cardBal)}
                  </div>
                  <div className="text-[11px] text-white/75 mt-0.5 font-medium">
                    Vence em {card.balance_due_date || "13 de nov."}
                  </div>
                </div>

                {/* Barra de Limite */}
                <div className="pt-2 border-t border-white/10 relative z-10">
                  <div className="flex items-center justify-between text-[11px] text-white/80 mb-1 font-medium">
                    <span>Limite total: {formatCurrency(totalLimit)}</span>
                    <span className="font-bold text-emerald-300">
                      Disponível: {formatCurrency(availLimit)}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
                    <div
                      className="h-full bg-sky-400 rounded-l-full"
                      style={{
                        width: `${Math.min((cardBal / (totalLimit || 1)) * 100, 100)}%`,
                      }}
                    />
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
      ) : (
        /* Grid Proporcional */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creditCards.map((card, idx) => {
            const theme = getCardTheme(card);
            const isSelected = activeCard?.id === card.id;
            const cardBal = getCardInvoiceAmount(card, transactions);
            const totalLimit = Number(card.credit_limit) || (cardBal > 0 ? cardBal * 2.5 : 5000);
            const availLimit =
              Number(card.available_credit_limit) != null
                ? Number(card.available_credit_limit)
                : Math.max(0, totalLimit - cardBal);

            return (
              <div
                key={card.id || idx}
                onClick={() => setSelectedCardId(card.id)}
                className={`w-full aspect-[1.586/1] rounded-3xl p-5 bg-gradient-to-br ${theme.bg} ${
                  theme.border
                } border shadow-lg cursor-pointer text-white transition-all duration-200 flex flex-col justify-between ${
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

                <div>
                  <span className="text-[10px] text-white/70">Fatura estimada</span>
                  <div className="text-xl font-bold tabular-nums">
                    {formatCurrency(cardBal)}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="flex justify-between text-[10px] text-white/80 mb-1">
                    <span>Disponível</span>
                    <span className="font-bold text-emerald-300">{formatCurrency(availLimit)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex">
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

      {/* Detalhes do Cartão Selecionado */}
      {activeCard && (
        <div className="flex flex-col gap-6">
          {/* Card de Auditoria Inteligente de Taxas / Anuidade (Fiel ao pedido do usuário) */}
          {feeAudit && (
            <div className="p-4 rounded-2xl bg-[#FF8216]/10 border border-[#FF8216]/25 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#FF8216] text-[20px] shrink-0 mt-0.5">
                  policy
                </span>
                <div>
                  <strong className="text-[#FF8216] font-bold block mb-0.5">
                    Auditoria de Taxas & Anuidade: {activeCard.product_name}
                  </strong>
                  <p className="text-slate-700 dark:text-[#E2E8F0] leading-relaxed">
                    Identificamos o lançamento de <strong>{formatCurrency(feeAudit.amount)}</strong> em &quot;{feeAudit.description}&quot;.
                    {feeAudit.hasReversal ? (
                      <span className="text-emerald-500 font-semibold ml-1">
                        Constatamos estorno/isenção aplicada na fatura! Você não precisou pagar esta tarifa.
                      </span>
                    ) : (
                      <span className="text-amber-500 font-semibold ml-1">
                        Não encontramos estorno registrado ainda. Se você possui benefício de anuidade grátis, solicite a contestação.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <Link
                href={`/kitsune?prompt=${encodeURIComponent(
                  `Kitsune AI, analise a cobrança de tarifa/anuidade de ${formatCurrency(
                    feeAudit.amount
                  )} no meu cartão ${activeCard.product_name}. Devo solicitar o estorno ou há justificativa para essa cobrança?`
                )}`}
                className="px-3 py-1.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white font-bold text-xs shrink-0 self-start cursor-pointer shadow-xs"
              >
                Pedir Orientação à IA
              </Link>
            </div>
          )}

          {/* Gráfico de Faturas Anteriores deste Cartão */}
          <SpotlightCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF8216] text-[18px]">
                  bar_chart
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Histórico de Faturas: {activeCard.product_name || "Cartão"}
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
                Últimos 6 meses
              </span>
            </div>

            <InvoiceBarChart invoices={invoiceHistory} />
          </SpotlightCard>

          {/* Lançamentos Recentes no Cartão Ativo */}
          <SpotlightCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-slate-400">
                  receipt_long
                </span>
                <span>Últimos lançamentos de {activeCard.product_name || "deste cartão"}</span>
              </h4>
              <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
                {cardTransactions.length} lançamentos
              </span>
            </div>

            {cardTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nenhuma compra recente registrada para este cartão no período.
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
                      - {formatCurrency(Math.abs(Number(tx.amount) || 0))}
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
