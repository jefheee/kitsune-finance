"use client";

import React from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { WalletCards, getCardInvoiceAmount } from "@/components/finance/WalletCards";
import { DebtAndAdvanceSimulator } from "@/components/finance/DebtAndAdvanceSimulator";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

export default function CardsPage() {
  const { accounts, loans, transactions, formatSensitiveCurrency, isPrivacyMode } =
    useFinanceData();

  const creditCards = accounts.filter(
    (acc) =>
      acc.type === "CREDIT" ||
      acc.subtype === "CREDIT_CARD" ||
      Number(acc.credit_limit) > 0 ||
      acc.card_brand ||
      (acc.product_name && acc.product_name.toLowerCase().includes("cartão"))
  );

  const totalLimit = creditCards.reduce((sum, c) => sum + (Number(c.credit_limit) || 0), 0);
  const totalInvoice = creditCards.reduce(
    (sum, c) => sum + getCardInvoiceAmount(c, transactions),
    0
  );

  const auditPrompt = `Audite detalhadamente todos os meus cartões de crédito. Tenho ${creditCards.length} cartões conectados, com limite total de ${formatSensitiveCurrency(
    totalLimit
  )} e fatura consolidada atual de ${formatSensitiveCurrency(
    totalInvoice
  )}. Analise se há risco de atraso, se estou pagando alguma tarifa ou anuidade indevida e como otimizar minhas datas de fechamento.`;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <WfIcons.Cards className="w-5 h-5 text-[#FF8216]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Carteira de Cartões & Passivos
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Faturas conciliadas, limites concedidos, simulador Avalanche vs. Bola de Neve e desconto de antecipação via Newton-Raphson.
          </p>
        </div>

        <Link
          href={`/kitsune?prompt=${encodeURIComponent(auditPrompt)}`}
          className="h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FF9438] text-black text-xs font-semibold inline-flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <WfIcons.Agents className="w-3.5 h-3.5" />
          <span>Auditar com Agente Kenji</span>
        </Link>
      </header>

      <WalletCards
        accounts={accounts}
        transactions={transactions}
        formatCurrency={formatSensitiveCurrency}
      />

      <DebtAndAdvanceSimulator
        accounts={accounts}
        loans={loans}
        transactions={transactions}
        formatCurrency={formatSensitiveCurrency}
        isPrivacyMode={isPrivacyMode}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-xs font-bold text-[#FF8216] block mb-1.5">
            Melhor Dia de Compra
          </span>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Priorize compras logo após o fechamento da fatura para obter até 40 dias de fluxo de caixa rendendo no CDI sem juros.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-xs font-bold text-emerald-500 block mb-1.5">
            Auditoria de Anuidade
          </span>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Tarifas recorrentes são detectadas automaticamente. Acione o Agente Kuro ou Kenji para argumentação de isenção junto ao banco.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
          <span className="text-xs font-bold text-amber-500 block mb-1.5">
            Saúde de Limite (&lt; 30%)
          </span>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Manter o uso consolidado abaixo de 30% do limite total protege seu score de crédito e reduz exposição de curto prazo.
          </p>
        </div>
      </div>
    </div>
  );
}
