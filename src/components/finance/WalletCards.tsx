"use client";

import React, { useState, useMemo, useRef } from "react";
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
  if (!card) return 0;
  const rawBal = Number(card.balance);
  if (!isNaN(rawBal) && rawBal > 0) {
    return Math.abs(rawBal);
  }

  // Se o saldo for 0 ou nulo, busca APENAS compras do ciclo/mês corrente (sem inflar com histórico antigo)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const currentMonthTxns = transactions.filter((t) => {
    if (t.is_internal_transfer || t.is_refund || t.operation_type === "BILL_PAYMENT") return false;
    const isThisCard = t.account_id === card.id || t.bank_accounts?.id === card.id;
    if (!isThisCard) return false;
    const dStr = (t.date || t.executed_at || "").split("T")[0];
    return dStr.startsWith(currentMonthStr);
  });

  return currentMonthTxns.reduce((acc, t) => {
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

    // Ordena de modo que os cartões mais relevantes fiquem posicionados corretamente
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
  const [isStackExpanded, setIsStackExpanded] = useState<boolean>(true);

  // Saldo Líquido Consolidado em Contas (para o widget Pierre Finance)
  const totalLiquidBalance = useMemo(() => {
    return accounts
      .filter((a) => a.type !== "CREDIT" && a.subtype !== "CREDIT_CARD")
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  // Cartão ativo selecionado
  const activeCard = creditCards[selectedCardIndex] || creditCards[0] || null;

  // Tema dinâmico do cartão selecionado
  const activeTheme: CardTheme = useMemo(() => {
    if (!activeCard) {
      return resolveCardTheme("Cartão Neutro", "generic");
    }
    return resolveCardTheme(
      activeCard.product_name || activeCard.name || activeCard.bank_name,
      activeCard.institution_slug || activeCard.institution_name
    );
  }, [activeCard]);

  // Transações específicas do cartão selecionado
  const cardTransactions = useMemo(() => {
    if (!activeCard) return [];
    return transactions
      .filter(
        (t) =>
          t.account_id === activeCard.id ||
          t.bank_accounts?.id === activeCard.id ||
          (t.operation_type === "CREDIT_CARD" &&
            (t.bank_accounts?.institution_slug === activeCard.institution_slug ||
              t.bank_accounts?.bank_name === activeCard.bank_name))
      )
      .slice(0, 5);
  }, [activeCard, transactions]);

  // Cálculos consolidados de limite
  const activeCardLimit = Number(activeCard?.credit_limit) || 5000;
  const activeCardInvoice = getCardInvoiceAmount(activeCard, transactions);
  const activeCardAvailable = Math.max(
    0,
    Number(activeCard?.available_credit_limit) || activeCardLimit - activeCardInvoice
  );
  const limitUsagePercent = Math.min(
    100,
    Math.round((activeCardInvoice / (activeCardLimit || 1)) * 100)
  );

  const totalCurrentInvoices = useMemo(() => {
    return creditCards.reduce((acc, card) => acc + getCardInvoiceAmount(card, transactions), 0);
  }, [creditCards, transactions]);

  const totalLimitConsolidated = useMemo(() => {
    return creditCards.reduce((acc, card) => acc + (Number(card.credit_limit) || 5000), 0);
  }, [creditCards]);

  const totalAvailableConsolidated = Math.max(0, totalLimitConsolidated - totalCurrentInvoices);

  // Faturas e Parcelamentos Reais do Cartão Ativo (sem números arbitrários)
  const cardInstallmentsData = useMemo(() => {
    if (!activeCard) return { items: [], totalCommitted: 0, monthlySum: 0, futureMonths: [] };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filtra compras parceladas vinculadas a este cartão
    const installmentTxns = transactions.filter((t) => {
      if (t.is_internal_transfer || t.is_refund) return false;
      const isThisCard = t.account_id === activeCard.id || t.bank_accounts?.id === activeCard.id;
      return isThisCard && Number(t.total_installments) > 1;
    });

    const grouped = new Map<
      string,
      {
        description: string;
        totalAmount: number;
        monthlyAmount: number;
        currentInstallment: number;
        totalInstallments: number;
        remainingInstallments: number;
        remainingAmount: number;
      }
    >();

    installmentTxns.forEach((t) => {
      const rawLabel = t.clean_description || t.description || "Compra Parcelada";
      const baseKey = rawLabel.replace(/\b\d{1,2}\/\d{1,2}\b/g, "").trim().toLowerCase();
      const inst = Number(t.installment_number) || 1;
      const totalInst = Number(t.total_installments) || 2;
      const amt = Math.abs(Number(t.amount) || 0);
      const totalPurchase =
        Number(t.total_purchase_amount) > 0 ? Number(t.total_purchase_amount) : amt * totalInst;

      const existing = grouped.get(baseKey);
      if (!existing || inst > existing.currentInstallment) {
        const remaining = Math.max(0, totalInst - inst);
        grouped.set(baseKey, {
          description: rawLabel,
          totalAmount: totalPurchase,
          monthlyAmount: amt,
          currentInstallment: inst,
          totalInstallments: totalInst,
          remainingInstallments: remaining,
          remainingAmount: remaining * amt,
        });
      }
    });

    const items = Array.from(grouped.values());
    const totalCommitted = items.reduce((s, i) => s + i.remainingAmount, 0);
    const monthlySum = items.reduce(
      (s, i) => s + (i.remainingInstallments > 0 ? i.monthlyAmount : 0),
      0
    );

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const futureMonths = [0, 1, 2, 3].map((offset) => {
      const targetDate = new Date(currentYear, currentMonth + offset, 1);
      const mName = monthNames[targetDate.getMonth()];
      const isCurrent = offset === 0;

      let amt = 0;
      if (isCurrent) {
        amt = activeCardInvoice;
      } else {
        // Soma real das parcelas que vencerão no mês `offset`
        amt = items.reduce((sum, item) => {
          return item.remainingInstallments >= offset ? sum + item.monthlyAmount : sum;
        }, 0);
      }

      return {
        month: `${mName}${offset > 0 ? `/${targetDate.getFullYear()}` : ""}`,
        amount: amt,
        isCurrent,
        status: isCurrent ? (amt > 0 ? "Aberta" : "Sem Fatura") : (amt > 0 ? "Prevista" : "Zerada"),
      };
    });

    return { items, totalCommitted, monthlySum, futureMonths };
  }, [activeCard, transactions, activeCardInvoice]);

  // Cálculo dinâmico do deslocamento vertical para caber exatamente em uma tela inteira
  const stackOffset = useMemo(() => {
    const count = Math.max(1, creditCards.length);
    if (!isStackExpanded) {
      // Quando fechado: empilhado compacto, exibindo uma fatia do cabeçalho
      return Math.max(48, Math.min(65, Math.floor(220 / count)));
    }
    // Quando expandido: espaçamento agradável com respiro
    return Math.max(65, Math.min(85, Math.floor(320 / count)));
  }, [creditCards.length, isStackExpanded]);

  // Manipulador de clique nos cartões: 2 toques (1º abre a prévia, 2º seleciona)
  const handleCardClick = (idx: number) => {
    if (!isStackExpanded) {
      setIsStackExpanded(true);
      setSelectedCardIndex(idx);
    } else {
      setSelectedCardIndex(idx);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in font-sans">
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

      {/* Visualização Mobile Estilo Pierre Finance (Clean & Minimalista) */}
      <div className="flex md:hidden flex-col gap-3.5">
        <div className="rounded-3xl bg-[#18181B] border border-[#27272A] overflow-hidden p-5 flex flex-col justify-between shadow-lg">
          {/* Topo Temático com Logo do Banco e Dígitos */}
          <div className={`-mx-5 -mt-5 p-4 bg-gradient-to-r ${activeTheme.bgGradient} flex items-center justify-between border-b ${activeTheme.border}`}>
            <div className="flex items-center gap-2">
              <BankLogo
                bank={activeCard?.institution_slug || activeCard?.institution_name || activeCard?.bank_name}
                size="xs"
              />
              <span className="text-xs font-bold text-white">
                {activeCard?.product_name || activeCard?.bank_name || "Cartão"}
              </span>
            </div>
            <span className="text-xs font-mono text-white/70">
              •••• {activeCard?.account_number?.slice(-4) || "8903"}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-1">
            <span className="text-xs text-slate-400 font-medium">Total em faturas</span>
            <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {formatCurrency(activeCardInvoice)}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Próximo vencimento: {activeCard?.balance_due_date || "13 de Novembro"}
            </span>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {creditCards.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedCardIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  selectedCardIndex === idx ? "w-5 bg-white" : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Saldo em Contas Pill */}
        <Link
          href="/dashboard"
          className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
              <span>Saldo em contas</span>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </div>
            <span className="text-lg font-bold text-white tabular-nums">
              {formatCurrency(totalLiquidBalance)}
            </span>
          </div>
        </Link>
      </div>

      {/* Visualização Desktop: Master-Detail Fluido (Cartões na Esquerda e Detalhes na Direita) */}
      <div className="hidden md:flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Coluna Esquerda: Carteira de Cartões Empilhados na Vertical */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-[#FF8216]">wallet</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Carteira ({creditCards.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsStackExpanded(!isStackExpanded)}
              className="text-xs text-slate-500 hover:text-[#FF8216] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{isStackExpanded ? "Modo Compacto" : "Expandir Prévia"}</span>
              <span className="material-symbols-outlined text-[14px]">
                {isStackExpanded ? "unfold_less" : "unfold_more"}
              </span>
            </button>
          </div>

          {/* Pilha de Cartões (O cartão ativo/selecionado fica por cima, na frente com z-index alto) */}
          <div
            className="w-full relative py-2 select-none"
            style={{
              minHeight: `${220 + (creditCards.length - 1) * stackOffset}px`,
            }}
          >
            {creditCards.map((card, idx) => {
              const isSelected = selectedCardIndex === idx;
              const theme = resolveCardTheme(
                card.product_name || card.name || card.bank_name,
                card.institution_slug || card.institution_name
              );
              const cardInv = getCardInvoiceAmount(card, transactions);
              const digits = card.account_number?.slice(-4) || "8903";

              // Ordem invertida: o selecionado fica com o z-index máximo (35), e a ordem natural empilha elegantemente
              const zIndex = isSelected ? 35 : creditCards.length - idx;

              return (
                <div
                  key={card.id || idx}
                  onClick={() => handleCardClick(idx)}
                  className={`w-full aspect-[1.586/1] rounded-3xl p-5 bg-gradient-to-br ${
                    theme.bgGradient
                  } ${
                    theme.border
                  } border absolute top-0 left-0 right-0 overflow-hidden transition-all duration-500 ease-out cursor-pointer shadow-xl ${
                    isSelected
                      ? "ring-2 ring-[#FF8216] shadow-2xl -translate-y-1 scale-[1.01]"
                      : "hover:-translate-y-2 hover:shadow-2xl opacity-95 hover:opacity-100"
                  }`}
                  style={{
                    transform: `translateY(${idx * stackOffset}px)`,
                    zIndex,
                  }}
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
                        <span className="text-xs font-bold text-white block truncate max-w-[160px]">
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
                  <div className="relative z-10 flex items-center justify-between mt-3">
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

                  {/* Rodapé do Cartão: Fatura Atual */}
                  <div className="flex items-end justify-between relative z-10 mt-auto pt-2">
                    <div>
                      <span className="text-[9px] text-white/60 uppercase font-bold tracking-wider block">
                        Fatura Atual
                      </span>
                      <span className="text-base font-black text-white tabular-nums tracking-tight">
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
        </div>

        {/* Coluna Direita: Detalhamento Completo do Cartão Ativo */}
        <div className="flex-1 min-w-0">
          <SpotlightCard className="p-5 md:p-7 flex flex-col gap-6">
            {/* Barra de Limite do Cartão Ativo */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Limite Concedido:</span>
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

            {/* Faturas Mensais e Previsão dos Próximos Meses */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Faturas e Projeções Futuras Reais
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Calculado por parcelas contratadas
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cardInstallmentsData.futureMonths.map((inv, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-1 transition-all ${
                      inv.isCurrent
                        ? "bg-[#18181B] border-[#FF8216]/50 text-white shadow-sm ring-1 ring-[#FF8216]/20"
                        : "bg-slate-50 dark:bg-[#121214] border-slate-200 dark:border-[#27272A] text-slate-800 dark:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400">{inv.month}</span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                          inv.status === "Aberta"
                            ? "bg-[#FF8216]/20 text-[#FF8216]"
                            : inv.status === "Prevista"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-slate-500/20 text-slate-400"
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

            {/* Detalhamento de Parcelamentos do Cartão (Total Parcelado vs Valor por Mês) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Parcelamentos Ativos no Cartão ({cardInstallmentsData.items.length})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Total em parcelas a vencer: <strong>{formatCurrency(cardInstallmentsData.totalCommitted)}</strong> • Impacto mensal: <strong>{formatCurrency(cardInstallmentsData.monthlySum)}/mês</strong>
                  </span>
                </div>
              </div>

              {cardInstallmentsData.items.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1">
                  Nenhum parcelamento ativo registrado para este cartão. Compras recentes foram realizadas à vista (1x).
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  {cardInstallmentsData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-[#18181B] border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900 dark:text-white block truncate">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="text-amber-500 font-bold">
                            Parcela {item.currentInstallment}/{item.totalInstallments}x
                          </span>
                          <span>•</span>
                          <span>{item.remainingInstallments} restantes</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          {formatCurrency(item.monthlyAmount)}
                          <span className="text-[10px] font-normal text-slate-400">/mês</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Total: {formatCurrency(item.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
      </div>
    </div>
  );
}
