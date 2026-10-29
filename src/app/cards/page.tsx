"use client";

import React from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { WalletCards, getCardInvoiceAmount } from "@/components/finance/WalletCards";

export default function CardsPage() {
  const { accounts, transactions, formatSensitiveCurrency, isPrivacyMode } = useFinanceData();

  // Consolidação de métricas rápidas para cabeçalho
  const creditCards = accounts.filter(
    (acc) =>
      acc.type === "CREDIT" ||
      acc.subtype === "CREDIT_CARD" ||
      Number(acc.credit_limit) > 0 ||
      acc.card_brand ||
      (acc.product_name && acc.product_name.toLowerCase().includes("cartão"))
  );

  const totalLimit = creditCards.reduce((sum, c) => sum + (Number(c.credit_limit) || 0), 0);
  const totalInvoice = creditCards.reduce((sum, c) => sum + getCardInvoiceAmount(c, transactions), 0);

  const auditPrompt = `Audite detalhadamente todos os meus cartões de crédito. Tenho ${creditCards.length} cartões conectados, com limite total de ${formatSensitiveCurrency(
    totalLimit
  )} e fatura consolidada atual de ${formatSensitiveCurrency(
    totalInvoice
  )}. Analise se há risco de atraso, se estou pagando alguma tarifa ou anuidade indevida e como otimizar minhas datas de fechamento.`;

  return (
    <div className="flex-1 w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-[#F8FAFC] p-4 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#27272A]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                <span className="material-symbols-outlined text-lg leading-none">wallet</span>
              </span>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Carteira de Cartões de Crédito
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8]">
              Visão consolidada estilo Wallet: faturas reais, limites concedidos e auditoria de tarifas de todos os seus bancos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/kitsune?prompt=${encodeURIComponent(auditPrompt)}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>Auditar Cartões com Kitsune AI</span>
            </Link>
          </div>
        </div>

        {/* Componente Central da Carteira */}
        <WalletCards
          accounts={accounts}
          transactions={transactions}
          formatCurrency={formatSensitiveCurrency}
        />

        {/* Guia Rápido de Otimização de Cartões */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center gap-2 text-[#FF8216] font-bold text-xs mb-2">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>Melhor Dia de Compra</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#94A3B8] leading-relaxed">
              Faça compras prioritárias logo após o dia do fechamento da fatura para ganhar até 40 dias de prazo sem juros até o vencimento.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs mb-2">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>Isenção de Anuidade</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#94A3B8] leading-relaxed">
              O Kitsune monitora lançamentos suspeitos de anuidade. Se notar qualquer cobrança não estornada, a Kitsune AI gera uma petição pronta para o seu banco.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs mb-2">
              <span className="material-symbols-outlined text-sm">speed</span>
              <span>Score de Crédito</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#94A3B8] leading-relaxed">
              Manter o comprometimento de limite abaixo de 30% da soma total de seus cartões eleva seu score no Serasa e previne recusa de novos limites.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
