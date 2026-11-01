"use client";

import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BankLogo } from "@/components/BankLogo";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
  allTransactions?: any[];
  formatCurrency: (val: number) => string;
  isPrivacyMode?: boolean;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  allTransactions = [],
  formatCurrency,
  isPrivacyMode = false,
}: TransactionDetailModalProps) {
  if (!isOpen || !transaction) return null;

  const rawAmount = Number(transaction.amount) || 0;
  const isCredit =
    rawAmount > 0 &&
    transaction.type !== "DEBIT" &&
    transaction.operation_type !== "CREDIT_CARD";

  const absAmount = Math.abs(rawAmount);
  const formattedAmount = isPrivacyMode
    ? "R$ ••••••"
    : `${isCredit ? "+" : "-"} ${formatCurrency(absAmount)}`;

  const title =
    transaction.clean_description ||
    transaction.description ||
    transaction.merchant_name ||
    "Lançamento";

  const bankName =
    transaction.bank_accounts?.bank_name ||
    transaction.bank_accounts?.institution_name ||
    transaction.institution_name ||
    "Conta Bancária";

  const accountName =
    transaction.bank_accounts?.product_name ||
    transaction.bank_accounts?.name ||
    "Conta Principal";

  const bankSlug =
    transaction.bank_accounts?.institution_slug ||
    transaction.institution_slug ||
    "generic";

  const category =
    transaction.category_pt ||
    transaction.category ||
    "Despesa Geral";

  const rawDate = transaction.executed_at || transaction.date || "";
  const dateFormatted = rawDate
    ? new Date(rawDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Data não informada";

  // Identificação do Método de Pagamento
  const isCard =
    transaction.bank_accounts?.type === "CREDIT" ||
    transaction.bank_accounts?.subtype === "CREDIT_CARD" ||
    transaction.operation_type === "CREDIT_CARD";

  const paymentMethod = isCard
    ? "Cartão de Crédito"
    : transaction.description?.toLowerCase().includes("pix")
    ? "Transferência Pix"
    : "Débito em Conta";

  // Identificação de Parcelamento
  const currentInst = Number(transaction.installment_number) || 1;
  const totalInst = Number(transaction.total_installments) || 1;
  const isInstallment = totalInst > 1;

  // Histórico com este mesmo estabelecimento
  const merchantHistory = useMemo(() => {
    if (!title || allTransactions.length === 0) return [];
    const baseKey = title
      .toLowerCase()
      .replace(/\s*\d{1,2}\s*\/\s*\d{1,2}\b/gi, "")
      .replace(/\d{1,2}\s*\/\s*\d{1,2}\b/gi, "")
      .trim();

    return allTransactions
      .filter((t) => {
        if (t.id === transaction.id) return false;
        const otherTitle = (t.clean_description || t.description || "")
          .toLowerCase()
          .replace(/\s*\d{1,2}\s*\/\s*\d{1,2}\b/gi, "")
          .replace(/\d{1,2}\s*\/\s*\d{1,2}\b/gi, "")
          .trim();
        return otherTitle.length > 2 && (otherTitle.includes(baseKey) || baseKey.includes(otherTitle));
      })
      .slice(0, 4);
  }, [title, allTransactions, transaction.id]);

  const totalSpentWithMerchant = useMemo(() => {
    let sum = absAmount;
    merchantHistory.forEach((t) => {
      sum += Math.abs(Number(t.amount) || 0);
    });
    return sum;
  }, [absAmount, merchantHistory]);

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#121214] border border-[#27272A] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* Header estilo Apple Wallet */}
        <div className="p-4 md:p-5 flex items-center justify-between border-b border-[#27272A] bg-[#18181B]/50">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <WfIcons.Close size={16} />
          </button>

          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Detalhes da Atividade
          </span>

          <div className="w-8 h-8 rounded-full bg-[#18181B] border border-[#27272A] flex items-center justify-center">
            <BankLogo bank={bankSlug} size="xs" />
          </div>
        </div>

        {/* Conteúdo com scroll suave nativo */}
        <div className="p-5 md:p-6 space-y-6 overflow-y-auto overscroll-contain">
          {/* Topo do Estabelecimento (Ícone com cor vibrante + Categoria + Nome) */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E11D48]/20 to-[#E11D48]/5 border border-[#E11D48]/30 flex items-center justify-center text-3xl shadow-inner">
              <span className="material-symbols-outlined text-[#E11D48] text-3xl">
                {isCard ? "credit_card" : isCredit ? "savings" : "storefront"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-zinc-500">
                {category}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
                {title}
              </h2>
            </div>
          </div>

          {/* Destaque do Valor e Status da Transação */}
          <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] text-center space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">
              {dateFormatted}
            </span>
            <div
              className={`text-2xl md:text-3xl font-black font-mono tracking-tight tabular-nums ${
                isCredit ? "text-emerald-400" : "text-white"
              }`}
            >
              {formattedAmount}
            </div>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Conciliado via Open Finance</span>
            </div>
          </div>

          {/* Metadados e Informações do Meio de Pagamento */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Forma de Liquidação
            </h4>
            <div className="divide-y divide-[#27272A] rounded-2xl bg-[#18181B] border border-[#27272A] text-xs">
              <div className="p-3.5 flex items-center justify-between">
                <span className="text-zinc-400">Instituição & Conta</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <BankLogo bank={bankSlug} size="xs" />
                  <span>{bankName}</span>
                </span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="text-zinc-400">Produto / Conta</span>
                <span className="font-semibold text-zinc-200 truncate max-w-[200px]">
                  {accountName}
                </span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="text-zinc-400">Tipo de Operação</span>
                <span className="font-semibold text-zinc-200">{paymentMethod}</span>
              </div>
              {isInstallment && (
                <div className="p-3.5 flex items-center justify-between bg-[#E11D48]/5">
                  <span className="text-[#E11D48] font-semibold">Parcelamento Ativo</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    Parcela {currentInst} de {totalInst}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Histórico com o Estabelecimento (Transaction History estilo Apple Wallet) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Histórico com este Estabelecimento
              </h4>
              <span className="text-[10px] font-mono text-zinc-500">
                {merchantHistory.length + 1} lançamentos
              </span>
            </div>

            {merchantHistory.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] text-center text-xs text-zinc-500">
                Primeira atividade registrada com este estabelecimento.
              </div>
            ) : (
              <div className="divide-y divide-[#27272A] rounded-2xl bg-[#18181B] border border-[#27272A] overflow-hidden text-xs">
                {merchantHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#27272A]/40 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-white truncate">
                        {item.clean_description || item.description}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "-"}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-zinc-200 shrink-0 tabular-nums">
                      {isPrivacyMode ? "R$ •••" : formatCurrency(Math.abs(Number(item.amount) || 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Pílula de Resumo Acumulado */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-[#27272A] flex items-center justify-between text-xs font-medium">
              <span className="text-zinc-400">Total acumulado:</span>
              <span className="font-mono font-bold text-[#E11D48] tabular-nums">
                {isPrivacyMode ? "R$ ••••••" : formatCurrency(totalSpentWithMerchant)}
              </span>
            </div>
          </div>

          {/* Ação Consultiva com Kitsune AI */}
          <div className="pt-2">
            <Link
              href={`/kitsune?prompt=${encodeURIComponent(
                `Kitsune AI, gostaria de analisar este lançamento de ${formatCurrency(
                  absAmount
                )} em "${title}" (${dateFormatted}). Como esse gasto impacta meu orçamento e o que você recomenda?`
              )}`}
              onClick={onClose}
              className="w-full h-11 rounded-2xl bg-[#18181B] hover:bg-[#E11D48] text-white hover:text-black border border-[#27272A] hover:border-[#E11D48] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              <span>Analisar este gasto com Kitsune AI</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
