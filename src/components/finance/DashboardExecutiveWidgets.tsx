"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import { GroupedAccountsList } from "@/components/wealthfolio/GroupedAccountsList";
import { MerchantLogo } from "@/components/MerchantLogo";
import { BankLogo } from "@/components/BankLogo";
import type { CustomAsset } from "@/types/finance";

export type ExecutiveWidgetType = "accounts" | "recent_tx" | "goals" | "holdings";

interface DashboardExecutiveWidgetsProps {
  accounts: any[];
  investments: any[];
  loans: any[];
  customAssets: CustomAsset[];
  recentTransactions: any[];
  monthlyIncome: number;
  monthlyExpense: number;
  totalBalance: number;
  liquidBalance: number;
  creditCardBalance: number;
  formatCurrency: (val: number) => string;
  formatDate: (date?: string) => string;
  isPrivacyMode: boolean;
  onConnectBank: () => void;
  onAddAsset: () => void;
  onEditAsset: (asset: CustomAsset) => void;
  onSelectTxForDetail: (tx: any) => void;
  goalsSummary: {
    goalLabel: string;
    primaryProgress: number;
    emergencyTarget: number;
    emergencyPct: number;
    emergencyMonths: number;
    projectedMonthlyYield: number;
    fireCoveragePct: number;
    monthlyCost: number;
  };
  topHoldings: Array<{
    id: string;
    name: string;
    institution: string;
    slug: string;
    balance: number;
    weightPct: number;
  }>;
  monthlyCDIFactor: number;
}

export function DashboardExecutiveWidgets({
  accounts,
  investments,
  loans,
  customAssets,
  recentTransactions,
  monthlyIncome,
  monthlyExpense,
  totalBalance,
  liquidBalance,
  creditCardBalance,
  formatCurrency,
  formatDate,
  isPrivacyMode,
  onConnectBank,
  onAddAsset,
  onEditAsset,
  onSelectTxForDetail,
  goalsSummary,
  topHoldings,
  monthlyCDIFactor,
}: DashboardExecutiveWidgetsProps) {
  // Estado do widget atualmente expandido (por padrão null / recolhido para o usuário escolher o que quer ver)
  const [activeWidget, setActiveWidget] = useState<ExecutiveWidgetType | null>(null);

  const toggleWidget = (type: ExecutiveWidgetType) => {
    setActiveWidget((prev) => (prev === type ? null : type));
  };

  const topHolding = topHoldings[0];

  return (
    <div className="space-y-4">
      {/* Título de Seção dos Widgets */}
      <div className="flex items-center justify-between text-xs font-semibold px-0.5">
        <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
          Módulos & Visão Executiva
        </span>
        <span className="text-[11px] text-zinc-500">
          Toque para expandir ou alternar
        </span>
      </div>

      {/* Grade de 4 Cards de Widgets Estilo Cards de Banco (2x2 no mobile, 4 em linha no PC) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* WIDGET 1: Contas, Custódia & Patrimônio Total */}
        <button
          type="button"
          onClick={() => toggleWidget("accounts")}
          className={`p-3.5 rounded-2xl bg-[#121214] border transition-all text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden group ${
            activeWidget === "accounts"
              ? "border-white ring-1 ring-white/30 shadow-lg shadow-black/40"
              : "border-[#27272A] hover:border-zinc-700 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#18181B] text-zinc-300 border border-[#27272A] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">account_balance</span>
              </div>
              <span className="text-xs font-bold text-white truncate">
                Contas & Custódia
              </span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                activeWidget === "accounts" ? "bg-white" : "bg-zinc-600"
              }`}
            />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-zinc-400 block">
              Patrimônio Total
            </span>
            <span className="text-sm md:text-base font-extrabold font-mono text-white tracking-tight tabular-nums block">
              {isPrivacyMode ? "R$ •••" : formatCurrency(totalBalance)}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-zinc-400 truncate">
              {accounts.length} contas • {investments.length} ativos
            </span>
            <span className={`font-semibold shrink-0 ${activeWidget === "accounts" ? "text-white" : "text-zinc-400"}`}>
              {activeWidget === "accounts" ? "Aberto ▾" : "Expandir →"}
            </span>
          </div>
        </button>

        {/* WIDGET 2: Atividades Recentes Conciliadas */}
        <button
          type="button"
          onClick={() => toggleWidget("recent_tx")}
          className={`p-3.5 rounded-2xl bg-[#121214] border transition-all text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden group ${
            activeWidget === "recent_tx"
              ? "border-white ring-1 ring-white/30 shadow-lg shadow-black/40"
              : "border-[#27272A] hover:border-zinc-700 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#18181B] text-zinc-300 border border-[#27272A] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              </div>
              <span className="text-xs font-bold text-white truncate">
                Atividades Recentes
              </span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                activeWidget === "recent_tx" ? "bg-white" : "bg-zinc-600"
              }`}
            />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-zinc-400 block">
              Despesas no Mês
            </span>
            <span className="text-sm md:text-base font-extrabold font-mono text-white tracking-tight tabular-nums block">
              {isPrivacyMode ? "R$ •••" : formatCurrency(monthlyExpense)}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-zinc-400 truncate">
              Entradas: {isPrivacyMode ? "R$ •••" : formatCurrency(monthlyIncome)}
            </span>
            <span className={`font-semibold shrink-0 ${activeWidget === "recent_tx" ? "text-white" : "text-zinc-400"}`}>
              {activeWidget === "recent_tx" ? "Aberto ▾" : "Expandir →"}
            </span>
          </div>
        </button>

        {/* WIDGET 3: Metas & Reserva */}
        <button
          type="button"
          onClick={() => toggleWidget("goals")}
          className={`p-3.5 rounded-2xl bg-[#121214] border transition-all text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden group ${
            activeWidget === "goals"
              ? "border-white ring-1 ring-white/30 shadow-lg shadow-black/40"
              : "border-[#27272A] hover:border-zinc-700 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#18181B] text-zinc-300 border border-[#27272A] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">flag</span>
              </div>
              <span className="text-xs font-bold text-white truncate">
                Metas & Reserva
              </span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                activeWidget === "goals" ? "bg-white" : "bg-zinc-600"
              }`}
            />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-zinc-400 block">
              Reserva de Emergência
            </span>
            <span className="text-sm md:text-base font-extrabold font-mono text-white tracking-tight tabular-nums block">
              {isPrivacyMode ? "••%" : `${goalsSummary.emergencyPct}% da Meta`}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-zinc-400 truncate">
              {goalsSummary.emergencyMonths} meses de custo
            </span>
            <span className={`font-semibold shrink-0 ${activeWidget === "goals" ? "text-white" : "text-zinc-400"}`}>
              {activeWidget === "goals" ? "Aberto ▾" : "Expandir →"}
            </span>
          </div>
        </button>

        {/* WIDGET 4: Maiores Posições */}
        <button
          type="button"
          onClick={() => toggleWidget("holdings")}
          className={`p-3.5 rounded-2xl bg-[#121214] border transition-all text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden group ${
            activeWidget === "holdings"
              ? "border-white ring-1 ring-white/30 shadow-lg shadow-black/40"
              : "border-[#27272A] hover:border-zinc-700 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#18181B] text-zinc-300 border border-[#27272A] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">pie_chart</span>
              </div>
              <span className="text-xs font-bold text-white truncate">
                Maiores Posições
              </span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                activeWidget === "holdings" ? "bg-white" : "bg-zinc-600"
              }`}
            />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-zinc-400 block">
              Maior Alocação
            </span>
            <span className="text-sm md:text-base font-extrabold font-mono text-white tracking-tight tabular-nums block truncate">
              {topHolding ? `${topHolding.weightPct.toFixed(0)}% • ${topHolding.name}` : "100% Líquido"}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-zinc-400 truncate">
              {topHoldings.length} posições em custódia
            </span>
            <span className={`font-semibold shrink-0 ${activeWidget === "holdings" ? "text-white" : "text-zinc-400"}`}>
              {activeWidget === "holdings" ? "Aberto ▾" : "Expandir →"}
            </span>
          </div>
        </button>
      </div>

      {/* ÁREA EXPANDIDA DO WIDGET SELECIONADO */}
      <AnimatePresence mode="wait">
        {activeWidget && (
          <motion.div
            key={activeWidget}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-[#121214] border border-[#27272A] overflow-hidden shadow-xl"
          >
            {/* Header da Gaveta Expandida */}
            <div className="px-4 md:px-6 py-3.5 border-b border-[#27272A] flex items-center justify-between bg-[#18181B]/60">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {activeWidget === "accounts" && "Contas, Custódia & Patrimônio Total"}
                  {activeWidget === "recent_tx" && "Atividades Recentes Conciliadas"}
                  {activeWidget === "goals" && "Metas & Reserva de Emergência"}
                  {activeWidget === "holdings" && "Maiores Posições da Carteira"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                className="h-7 px-2.5 rounded-lg border border-[#27272A] bg-[#121214] text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Recolher ✕
              </button>
            </div>

            {/* Conteúdo Específico do Widget Selecionado */}
            <div className="p-4 md:p-6">
              {/* 1. CONTAS & CUSTÓDIA */}
              {activeWidget === "accounts" && (
                <GroupedAccountsList
                  accounts={accounts}
                  investments={investments}
                  loans={loans}
                  customAssets={customAssets}
                  formatCurrency={formatCurrency}
                  hideValues={isPrivacyMode}
                  onConnectBank={onConnectBank}
                  onAddAsset={onAddAsset}
                  onEditAsset={onEditAsset}
                  monthlyCDIFactor={monthlyCDIFactor}
                />
              )}

              {/* 2. ATIVIDADES RECENTES CONCILIADAS */}
              {activeWidget === "recent_tx" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">
                      Entradas: <span className="text-emerald-400 font-mono font-bold">{formatCurrency(monthlyIncome)}</span> • Saídas: <span className="text-zinc-200 font-mono font-bold">{formatCurrency(monthlyExpense)}</span>
                    </p>
                    <Link
                      href="/transactions"
                      className="text-xs font-semibold text-[#E11D48] hover:underline flex items-center gap-1"
                    >
                      <span>Ver extrato completo</span>
                      <WfIcons.ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {recentTransactions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      Nenhuma movimentação recente encontrada.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/50 border border-[#27272A] overflow-hidden">
                      {recentTransactions.map((tx: any) => {
                        const amt = Number(tx.amount) || 0;
                        const isCreditCard =
                          tx.bank_accounts?.type === "CREDIT" ||
                          tx.bank_accounts?.subtype === "CREDIT_CARD" ||
                          tx.operation_type === "CREDIT_CARD";
                        const isExpense = amt < 0 || tx.type === "DEBIT" || isCreditCard;
                        const absAmt = Math.abs(amt);
                        const title = tx.clean_description || tx.description || "Movimentação";
                        const category = tx.category_pt || tx.category || "Geral";
                        const bankName =
                          tx.bank_accounts?.institution_name ||
                          tx.bank_accounts?.bank_name ||
                          "Conta";

                        return (
                          <div
                            key={tx.id}
                            onClick={() => onSelectTxForDetail(tx)}
                            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#27272A]/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <MerchantLogo
                                cleanName={tx.clean_description}
                                rawDescription={tx.description}
                                category={category}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">
                                  {title}
                                </p>
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {category} • {bankName} • {formatDate(tx.executed_at || tx.date)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-xs font-mono font-semibold tabular-nums ${
                                  tx.is_refund || !isExpense ? "text-emerald-400" : "text-white"
                                }`}
                              >
                                {isPrivacyMode
                                  ? "R$ ••••••"
                                  : `${tx.is_refund || !isExpense ? "+" : "-"}${formatCurrency(absAmt)}`}
                              </span>
                              {tx.total_installments && Number(tx.total_installments) > 1 && (
                                <span className="block text-[10px] font-mono tabular-nums text-[#E11D48]">
                                  {tx.installment_number || 1}/{tx.total_installments}x
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. METAS & RESERVA */}
              {activeWidget === "goals" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">
                      Metas patrimoniais calculadas com base em despesas reais
                    </p>
                    <Link href="/goals" className="text-xs font-semibold text-[#E11D48] hover:underline">
                      Gerenciar Metas →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Meta 1: Reserva de Liquidez */}
                    <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">Reserva de Emergência (6 meses)</span>
                        <span className="font-mono tabular-nums font-bold text-[#E11D48]">
                          {isPrivacyMode ? "••%" : `${goalsSummary.emergencyPct}%`}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#E11D48] transition-all duration-500"
                          style={{ width: `${goalsSummary.emergencyPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums">
                        <span>{isPrivacyMode ? "•• meses" : `${goalsSummary.emergencyMonths} meses cobertos`}</span>
                        <span>Alvo: {formatCurrency(goalsSummary.emergencyTarget)}</span>
                      </div>
                    </div>

                    {/* Meta 2: Cobertura FIRE CDI */}
                    <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">Cobertura Passiva CDI (FIRE)</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-400">
                          {isPrivacyMode ? "••%" : `${goalsSummary.fireCoveragePct}%`}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${goalsSummary.fireCoveragePct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums">
                        <span>+{formatCurrency(goalsSummary.projectedMonthlyYield)}/mês passivo</span>
                        <span>Custo mensal: {formatCurrency(goalsSummary.monthlyCost)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. MAIORES POSIÇÕES */}
              {activeWidget === "holdings" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">
                      Distribuição de capital por título e instituição de custódia
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <Link href="/insights" className="text-zinc-400 hover:text-white">
                        Alocação & Treemap
                      </Link>
                      <Link href="/investments" className="font-semibold text-[#E11D48] hover:underline">
                        Custódia Completa →
                      </Link>
                    </div>
                  </div>

                  {topHoldings.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">
                      Nenhum investimento sincronizado ainda.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#27272A] rounded-xl bg-[#18181B]/50 border border-[#27272A] overflow-hidden">
                      {topHoldings.map((item) => (
                        <div
                          key={item.id}
                          className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BankLogo bank={item.slug} size="sm" />
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">{item.name}</p>
                              <p className="text-[11px] text-zinc-400 truncate">{item.institution}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono tabular-nums">
                            <p className="font-bold text-white">
                              {isPrivacyMode ? "R$ ••••••" : formatCurrency(item.balance)}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {isPrivacyMode ? "••%" : `${item.weightPct.toFixed(1)}% do total`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}