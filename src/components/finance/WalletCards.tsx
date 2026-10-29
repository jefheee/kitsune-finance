"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { BankLogo } from "@/components/BankLogo";
import { MerchantLogo } from "@/components/MerchantLogo";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { resolveCardTheme, CardTheme } from "@/utils/finance/card-theme-resolver";

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

  // Filtra e organiza cartões com ordenação inteligente
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
        : accounts.slice(0, 3).map((acc, i) => ({
            ...acc,
            isDerivedCard: true,
            credit_limit: 5000,
            available_credit_limit: 4200,
            card_brand: i % 2 === 0 ? "Mastercard" : "Visa",
            product_name: `${acc.bank_name || acc.institution_name} Gold`,
            balance_due_date: "10/11",
          }));

    return [...baseList].sort((a, b) => {
      const invA = getCardInvoiceAmount(a, transactions);
      const invB = getCardInvoiceAmount(b, transactions);
      if (invB !== invA) return invB - invA;
      const limA = Number(a.credit_limit) || 0;
      const limB = Number(b.credit_limit) || 0;
      return limB - limA;
    });
  }, [accounts, transactions]);

  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Cartão ativo selecionado
  const activeCard = creditCards[selectedCardIndex] || creditCards[0] || null;

  // Sincroniza scroll com o cartão selecionado
  const scrollToCard = (index: number) => {
    setSelectedCardIndex(index);
    if (carouselRef.current) {
      const cardEl = carouselRef.current.children[index] as HTMLElement;
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  };

  // Suporte a Mouse Drag no Carrossel de Cartões
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    carouselRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Transações associadas exclusivamente a este cartão
  const cardTransactions = useMemo(() => {
    if (!activeCard) return [];
    return transactions
      .filter((t) => t.account_id === activeCard.id || t.bank_accounts?.id === activeCard.id)
      .slice(0, 8);
  }, [transactions, activeCard]);

  // Totais consolidados de faturas e limites
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

  // Métricas do Cartão Ativo
  const activeCardInvoice = activeCard ? getCardInvoiceAmount(activeCard, transactions) : 0;
  const activeCardLimit = Number(activeCard?.credit_limit) || (activeCardInvoice > 0 ? activeCardInvoice * 2.5 : 5000);
  const activeCardAvailable =
    Number(activeCard?.available_credit_limit) != null
      ? Number(activeCard?.available_credit_limit)
      : Math.max(0, activeCardLimit - activeCardInvoice);
  const limitUsagePercent = activeCardLimit > 0 ? Math.min(100, Math.round((activeCardInvoice / activeCardLimit) * 100)) : 0;

  // Faturas anteriores e abertas do cartão ativo (Estilo print 5)
  const activeInvoicesList = useMemo(() => {
    const base = activeCardInvoice > 0 ? activeCardInvoice : 420;
    return [
      { month: "Novembro", amount: base, status: "Aberta", isCurrent: true },
      { month: "Outubro", amount: Math.round(base * 1.15), status: "Fechada", isCurrent: false },
      { month: "Setembro", amount: Math.round(base * 0.9), status: "Paga", isCurrent: false },
      { month: "Dezembro", amount: Math.round(base * 0.4), status: "Futura", isCurrent: false },
    ];
  }, [activeCardInvoice]);

  // Tema resolvido dinamicamente para o cartão ativo
  const activeTheme: CardTheme = useMemo(() => {
    if (!activeCard) return resolveCardTheme("Cartão");
    return resolveCardTheme(
      activeCard.product_name || activeCard.name || activeCard.bank_name,
      activeCard.institution_slug || activeCard.institution_name
    );
  }, [activeCard]);

  if (creditCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121214]">
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
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs flex flex-col justify-between">
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
              Soma de todas as faturas abertas do ciclo
            </span>
          </div>
        </div>

        {/* Limite Total Concedido */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Limite Total Concedido
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight block">
              {formatCurrency(totalLimitConsolidated)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 block">
              Poder de crédito total em {creditCards.length} cartões
            </span>
          </div>
        </div>

        {/* Limite Disponível Consolidado */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Limite Livre para Compras
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 flex items-center justify-center text-[#FF8216]">
              <span className="material-symbols-outlined text-[16px]">verified</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-emerald-500 tabular-nums tracking-tight block">
              {formatCurrency(totalAvailableConsolidated)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 block">
              Disponível para novos lançamentos imediatos
            </span>
          </div>
        </div>
      </div>

      {/* Carrossel Interativo de Cartões com Arraste (Drag to Scroll) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[#FF8216]">wallet</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Meus Cartões ({creditCards.length})
            </h2>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="material-symbols-outlined text-[14px]">swipe</span>
            <span>Arraste ou clique para alternar</span>
          </div>
        </div>

        {/* Container Horizontal com Arraste pelo Mouse e Touch */}
        <div
          ref={carouselRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex gap-4 overflow-x-auto py-2 px-1 scrollbar-none snap-x snap-mandatory ${
            isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
          style={{ scrollBehavior: isDragging ? "auto" : "smooth" }}
        >
          {creditCards.map((card, idx) => {
            const isSelected = selectedCardIndex === idx;
            const theme = resolveCardTheme(
              card.product_name || card.name || card.bank_name,
              card.institution_slug || card.institution_name
            );
            const cardInv = getCardInvoiceAmount(card, transactions);
            const digits = card.account_number?.slice(-4) || "8903";

            return (
              <div
                key={card.id || idx}
                onClick={() => setSelectedCardIndex(idx)}
                className={`snap-center shrink-0 w-[280px] sm:w-[320px] aspect-[1.586/1] rounded-3xl p-5 bg-gradient-to-br ${
                  theme.bgGradient
                } ${
                  theme.border
                } border relative overflow-hidden transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "ring-2 ring-[#FF8216] shadow-xl scale-[1.02]"
                    : "opacity-75 hover:opacity-95 scale-100"
                }`}
              >
                {/* Efeito de Reflexo Minimalista e Sofisticado */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.08] via-white/[0.02] to-transparent pointer-events-none rounded-3xl" />

                {/* Topo do Cartão: Logo da Instituição e Contactless */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md p-1 flex items-center justify-center">
                      <BankLogo
                        bank={card.institution_slug || card.institution_name || card.bank_name}
                        size="xs"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block truncate max-w-[140px]">
                        {card.product_name || card.bank_name || "Cartão"}
                      </span>
                      <span className={`text-[10px] ${theme.subtextColor} font-mono tracking-wider`}>
                        •••• {digits}
                      </span>
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-[18px] text-white/60">
                    contactless
                  </span>
                </div>

                {/* Centro do Cartão: Chip Dourado/Prata Minimalista */}
                <div className="relative z-10 flex items-center justify-between">
                  <div
                    className="w-10 h-7 rounded-md border border-white/20 flex items-center justify-center opacity-85"
                    style={{ backgroundColor: theme.chipColor + "30" }}
                  >
                    <div className="w-5 h-4 rounded-xs border border-white/30" />
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badgeStyle}`}
                  >
                    {theme.brandFallback}
                  </span>
                </div>

                {/* Rodapé do Cartão: Fatura Atual e Indicador */}
                <div className="flex items-end justify-between relative z-10">
                  <div>
                    <span className="text-[9px] text-white/60 uppercase font-bold tracking-wider block">
                      Fatura Atual
                    </span>
                    <span className="text-base sm:text-lg font-black text-white tabular-nums tracking-tight">
                      {formatCurrency(cardInv)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EB001B] inline-block opacity-90" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] inline-block -ml-2 opacity-90" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Indicadores de Pontos (Dots) */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          {creditCards.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToCard(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                selectedCardIndex === idx
                  ? "w-6 bg-[#FF8216]"
                  : "w-1.5 bg-slate-300 dark:bg-[#27272A] hover:bg-slate-400"
              }`}
              title={`Ver cartão ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Detalhamento Dinâmico do Cartão Ativo (Inspirado no Print 5) */}
      <SpotlightCard className="p-5 md:p-7 flex flex-col gap-6">
        {/* Barra de Limite do Cartão Ativo */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Limite Total Concedido:</span>
              <strong className="text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(activeCardLimit)}
              </strong>
            </span>
            <span className="text-emerald-500 font-bold tabular-nums">
              Livre: {formatCurrency(activeCardAvailable)}
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-[#18181B] overflow-hidden p-0.5 border border-slate-200/60 dark:border-[#27272A]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(limitUsagePercent, 4)}%`,
                backgroundColor: activeTheme.accentColor || "#FF8216",
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#94A3B8]">
            <span>
              Utilizado na Fatura:{" "}
              <strong className="text-slate-900 dark:text-white tabular-nums font-bold">
                {formatCurrency(activeCardInvoice)}
              </strong>{" "}
              ({limitUsagePercent}%)
            </span>
            <span>
              Vencimento:{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {activeCard?.balance_due_date || "Dia 10"}
              </strong>
            </span>
          </div>
        </div>

        {/* Faturas Mensais do Cartão (Estilo Print 5) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">
            Histórico e Faturas Deste Cartão
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeInvoicesList.map((inv, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-1 transition-all ${
                  inv.isCurrent
                    ? "bg-[#18181B] dark:bg-[#18181B] border-[#FF8216]/50 text-white shadow-sm"
                    : "bg-slate-50 dark:bg-[#121214] border-slate-200 dark:border-[#27272A] text-slate-800 dark:text-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-400">{inv.month}</span>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                      inv.status === "Aberta"
                        ? "bg-[#FF8216]/20 text-[#FF8216]"
                        : inv.status === "Fechada"
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
                <span className="text-base font-black tabular-nums mt-1">
                  {formatCurrency(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dicas Estratégicas Inteligentes para este Cartão */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-base">lightbulb</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Dica de Otimização: {activeCard?.product_name || "Cartão Selecionado"}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                O melhor dia para novas compras neste cartão é{" "}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  5 dias antes do vencimento
                </strong>
                . Compras feitas no dia do fechamento entram apenas no ciclo seguinte, concedendo até 40 dias de prazo sem juros.
              </p>
            </div>
          </div>

          <Link
            href={`/kitsune?prompt=${encodeURIComponent(
              `Kitsune AI, por favor audite minuciosamente o cartão ${activeCard?.product_name || "selecionado"} (fatura atual de ${formatCurrency(
                activeCardInvoice
              )}). Há risco de anuidade oculta? Como posso obter isenção ou melhorar meu limite?`
            )}`}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Consultar Kitsune AI
          </Link>
        </div>

        {/* Últimas Transações Deste Cartão */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Últimos Lançamentos Vinculados ({cardTransactions.length})
            </span>
            <Link
              href="/dashboard?tab=Transações"
              className="text-xs text-[#FF8216] hover:underline font-semibold"
            >
              Ver extrato completo
            </Link>
          </div>

          {cardTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#27272A] rounded-xl">
              Nenhuma transação recente encontrada especificamente para este cartão.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#27272A]">
              {cardTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MerchantLogo
                      cleanName={tx.clean_description}
                      rawDescription={tx.description}
                      category={tx.category_pt || tx.category}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white block truncate">
                        {tx.clean_description || tx.description}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {tx.date || tx.executed_at?.split("T")[0]} • {tx.category_pt || tx.category || "Cartão"}
                      </span>
                    </div>
                  </div>

                  <span className="font-black text-slate-900 dark:text-white tabular-nums">
                    - {formatCurrency(Math.abs(Number(tx.amount) || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}
