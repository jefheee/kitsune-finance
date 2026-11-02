"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

const QUICK_PROMPTS = [
  "Qual meu saldo disponível hoje?",
  "Quanto gastei no cartão este mês?",
  "Como está minha reserva de emergência?",
  "Onde posso economizar?",
];

interface CompactKitsuneChatProps {
  onOpenFullChat?: (initPrompt?: string) => void;
}

export function CompactKitsuneChat({ onOpenFullChat }: CompactKitsuneChatProps = {}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text) return;
    if (onOpenFullChat) {
      onOpenFullChat(text);
    } else {
      router.push(`/kitsune?prompt=${encodeURIComponent(text)}`);
    }
  };

  return (
    // Exibido EXCLUSIVAMENTE em celulares/mobile (< 768px), ocultado em tablets e PC
    <div className="md:hidden rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] p-4 shadow-xs space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#E11D48]/10 text-[#E11D48] border border-[#E11D48]/25 flex items-center justify-center">
            <WfIcons.Agents className="w-3.5 h-3.5 text-[#E11D48]" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-[#F4F4F5]">
              Falar com Kitsune AI
            </h3>
          </div>
        </div>

        <Link
          href="/kitsune"
          className="text-[11px] font-semibold text-[#E11D48] hover:text-[#F43F5E] flex items-center gap-1 transition-colors"
        >
          <span>Chat Completo</span>
          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
        </Link>
      </div>

      {/* Sugestões Rápidas de 1 Toque */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSend(q)}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#27272A] border border-zinc-200/80 dark:border-[#27272A] text-[11px] text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Barra de Entrada Rápida */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Pergunte sobre saldo, fatura, gastos..."
            className="w-full h-9 pl-3 pr-8 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-[#E11D48] transition-colors"
          />
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <WfIcons.Close size={13} />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim()}
          className="h-9 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
        >
          <span>Perguntar</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </form>
    </div>
  );
}
