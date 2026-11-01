"use client";

import React, { useState } from "react";
import Link from "next/link";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import Spinner from "@/components/Spinner";

interface CompactKitsuneChatProps {
  onOpenFullChat?: (initialPrompt?: string) => void;
}

const QUICK_PROMPTS = [
  "Qual meu saldo disponível hoje?",
  "Quanto já gastei no cartão este mês?",
  "Tenho alguma oportunidade de economia?",
  "Como está minha reserva de emergência?",
];

export function CompactKitsuneChat({ onOpenFullChat }: CompactKitsuneChatProps) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: "auto",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar Kitsune AI");
      }

      setResponse(data.reply || data.text || "Consulta processada.");
    } catch (err: any) {
      setError(err.message || "Não foi possível obter resposta.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] p-4 md:p-5 shadow-xs space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#E11D48]/10 text-[#E11D48] border border-[#E11D48]/25 flex items-center justify-center">
            <WfIcons.Agents className="w-4 h-4 text-[#E11D48]" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-[#F4F4F5]">
              Falar com Kitsune AI
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Consultoria patrimonial instantânea em linguagem natural
            </p>
          </div>
        </div>

        <Link
          href={`/kitsune${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ""}`}
          className="text-xs font-semibold text-[#E11D48] hover:text-[#F43F5E] flex items-center gap-1 transition-colors"
        >
          <span>Abrir Chat Completo</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>

      {/* Sugestões Rápidas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setPrompt(q);
              handleSend(q);
            }}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#27272A] border border-zinc-200/80 dark:border-[#27272A] text-[11px] text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Caixa de Entrada e Envio */}
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
            placeholder="Pergunte sobre saldos, faturas, gastos ou investimentos..."
            disabled={isLoading}
            className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-[#E11D48] transition-colors"
          />
          {prompt && (
            <button
              type="button"
              onClick={() => {
                setPrompt("");
                setResponse(null);
                setError(null);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <WfIcons.Close size={14} />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
        >
          {isLoading ? (
            <Spinner size={14} className="text-black" />
          ) : (
            <>
              <span>Enviar</span>
              <span className="material-symbols-outlined text-[15px]">send</span>
            </>
          )}
        </button>
      </form>

      {/* Resposta Rápida Inline */}
      {response && (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#E11D48]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] animate-pulse" />
              Parecer da Kitsune
            </span>
            <Link
              href={`/kitsune?prompt=${encodeURIComponent(prompt)}`}
              className="hover:underline text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              Continuar no Chat →
            </Link>
          </div>
          <p className="whitespace-pre-line">{response}</p>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
