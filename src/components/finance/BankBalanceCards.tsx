"use client";

import React, { useMemo } from "react";
import { BankLogo } from "@/components/BankLogo";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { getCardInvoiceAmount } from "@/components/finance/WalletCards";

interface BankBalanceCardsProps {
  accounts: any[];
  transactions: any[];
  formatCurrency: (val: number) => string;
  isPrivacyMode?: boolean;
  selectedBankSlug: string;
  onSelectBank: (slug: string) => void;
}

interface BankGroup {
  slug: string;
  name: string;
  colorBg: string;
  borderColor: string;
  textColor: string;
  liquidBalance: number;
  creditInvoice: number;
  accountsCount: number;
  hasCreditCard: boolean;
}

const BANK_THEMES: Record<string, { bg: string; border: string; text: string }> = {
  itau: {
    bg: "from-amber-600/15 to-[#121214]",
    border: "border-amber-500/30 hover:border-amber-500/60",
    text: "text-amber-400",
  },
  nubank: {
    bg: "from-purple-600/15 to-[#121214]",
    border: "border-purple-500/30 hover:border-purple-500/60",
    text: "text-purple-400",
  },
  inter: {
    bg: "from-orange-600/15 to-[#121214]",
    border: "border-orange-500/30 hover:border-orange-500/60",
    text: "text-orange-400",
  },
  caixa: {
    bg: "from-blue-600/15 to-[#121214]",
    border: "border-blue-500/30 hover:border-blue-500/60",
    text: "text-blue-400",
  },
  bradesco: {
    bg: "from-red-600/15 to-[#121214]",
    border: "border-red-500/30 hover:border-red-500/60",
    text: "text-red-400",
  },
  santander: {
    bg: "from-red-600/15 to-[#121214]",
    border: "border-red-500/30 hover:border-red-500/60",
    text: "text-red-400",
  },
  bb: {
    bg: "from-yellow-600/15 to-[#121214]",
    border: "border-yellow-500/30 hover:border-yellow-500/60",
    text: "text-yellow-400",
  },
  c6: {
    bg: "from-zinc-600/15 to-[#121214]",
    border: "border-zinc-500/30 hover:border-zinc-500/60",
    text: "text-zinc-300",
  },
  btg: {
    bg: "from-cyan-600/15 to-[#121214]",
    border: "border-cyan-500/30 hover:border-cyan-500/60",
    text: "text-cyan-400",
  },
  xp: {
    bg: "from-yellow-500/15 to-[#121214]",
    border: "border-yellow-500/30 hover:border-yellow-500/60",
    text: "text-yellow-400",
  },
};

export function BankBalanceCards({
  accounts,
  transactions,
  formatCurrency,
  isPrivacyMode = false,
  selectedBankSlug,
  onSelectBank,
}: BankBalanceCardsProps) {
  const bankGroups = useMemo<BankGroup[]>(() => {
    const map = new Map<string, BankGroup>();

    accounts.forEach((acc) => {
      const entry = getBankCatalogBySlugOrName(
        acc.institution_slug || acc.institution_name || acc.bank_name
      );
      const slug = entry.slug || "generic";
      const theme = BANK_THEMES[slug] || {
        bg: "from-zinc-700/10 to-[#121214]",
        border: "border-zinc-700/30 hover:border-zinc-500/50",
        text: "text-zinc-300",
      };

      const bal = Number(acc.balance) || 0;
      const isCredit =
        acc.type === "CREDIT" ||
        acc.subtype === "CREDIT_CARD" ||
        acc.product_name?.toLowerCase().includes("cartão");

      if (!map.has(slug)) {
        map.set(slug, {
          slug,
          name: entry.shortName || entry.name,
          colorBg: theme.bg,
          borderColor: theme.border,
          textColor: theme.text,
          liquidBalance: 0,
          creditInvoice: 0,
          accountsCount: 0,
          hasCreditCard: false,
        });
      }

      const item = map.get(slug)!;
      item.accountsCount += 1;

      if (isCredit) {
        item.hasCreditCard = true;
        item.creditInvoice += getCardInvoiceAmount(acc, transactions);
      } else {
        item.liquidBalance += bal;
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.liquidBalance + b.creditInvoice - (a.liquidBalance + a.creditInvoice)
    );
  }, [accounts, transactions]);

  if (bankGroups.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold px-0.5">
        <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
          Saldos & Faturas por Banco
        </span>
        {selectedBankSlug !== "all" && (
          <button
            type="button"
            onClick={() => onSelectBank("all")}
            className="text-[11px] text-[#E11D48] hover:underline cursor-pointer"
          >
            Ver Todos os Bancos
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {bankGroups.map((bank) => {
          const isSelected = selectedBankSlug === bank.slug;
          return (
            <button
              key={bank.slug}
              type="button"
              onClick={() => onSelectBank(isSelected ? "all" : bank.slug)}
              className={`p-3.5 rounded-2xl bg-gradient-to-br ${bank.colorBg} border transition-all text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? "border-[#E11D48] ring-1 ring-[#E11D48] shadow-lg shadow-[#E11D48]/10"
                  : `${bank.borderColor} hover:-translate-y-0.5`
              }`}
            >
              {/* Topo do Card com Logo e Indicador de Sincronia */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BankLogo bank={bank.slug} size="sm" />
                  <span className="text-xs font-bold text-white truncate">
                    {bank.name}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Sincronizado" />
              </div>

              {/* Saldo Disponível */}
              <div className="space-y-0.5">
                <span className="text-[10px] font-medium text-zinc-400 block">
                  Saldo Disponível
                </span>
                <span className="text-sm md:text-base font-extrabold font-mono text-white tracking-tight tabular-nums block">
                  {isPrivacyMode ? "R$ •••" : formatCurrency(bank.liquidBalance)}
                </span>
              </div>

              {/* Fatura Aberta do Cartão (se houver) */}
              {bank.hasCreditCard && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">Fatura Atual:</span>
                  <span className="font-mono font-bold text-zinc-200 tabular-nums">
                    {isPrivacyMode ? "R$ •••" : formatCurrency(bank.creditInvoice)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
