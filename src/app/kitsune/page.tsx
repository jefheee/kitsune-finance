"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Spinner from "@/components/Spinner";
import { useFinanceData } from "@/context/FinanceDataContext";
import { KITSUNE_GEMINI_MODELS } from "@/utils/ai/gemini";

const QUICK_PROMPTS = [
  {
    icon: "Analytics",
    label: "Raio-X do Mês",
    prompt:
      "Faça um raio-x completo das minhas receitas e despesas deste mês e aponte para onde está indo a maior parte do meu dinheiro.",
  },
  {
    icon: "credit_card",
    label: "Auditoria de Cartão",
    prompt:
      "Analise minha exposição atual em cartão de crédito comparada ao meu saldo em conta corrente e recomende uma estratégia.",
  },
  {
    icon: "category",
    label: "Cortar Gastos",
    prompt:
      "Com base nas minhas transações e categorias recentes, quais são os 3 principais pontos onde posso economizar imediatamente?",
  },
  {
    icon: "savings",
    label: "Plano de Alocação",
    prompt:
      "Considerando meu patrimônio líquido atual e meu fluxo de caixa, sugira um plano prático de reserva de emergência e investimentos.",
  },
];

export default function KitsuneAIPage() {
  const {
    user,
    accounts,
    transactions,
    familyMembers,
    isFamilyModeEnabled,
    chatMessages,
    setChatMessages,
    selectedAiModel,
    setSelectedAiModel,
  } = useFinanceData();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScope, setSelectedScope] = useState<string>("personal");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isLoading]);

  // Métricas em tempo real do contexto do usuário logado
  const metrics = useMemo(() => {
    const scopedAccounts =
      selectedScope === "personal" || selectedScope === "all"
        ? accounts
        : accounts.filter((a) => a.family_member_id === selectedScope);

    const scopedTx =
      selectedScope === "personal" || selectedScope === "all"
        ? transactions
        : transactions.filter((t) => t.family_member_id === selectedScope);

    let liquid = 0;
    let credit = 0;
    scopedAccounts.forEach((a) => {
      const bal = Number(a.balance) || 0;
      if (a.type === "CREDIT" || a.type === "CREDIT_CARD") credit += bal;
      else liquid += bal;
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthIn = 0;
    let monthOut = 0;

    scopedTx.forEach((tx) => {
      const d = new Date(tx.executed_at || tx.date || now);
      const amt = Number(tx.amount) || 0;
      const isCredit = tx.type === "CREDIT" || amt > 0;
      if (d >= monthStart) {
        if (isCredit) monthIn += Math.abs(amt);
        else monthOut += Math.abs(amt);
      }
    });

    return {
      netWorth: liquid - credit,
      liquid,
      credit,
      monthIn,
      monthOut,
      txCount: scopedTx.length,
      accCount: scopedAccounts.length,
    };
  }, [accounts, transactions, selectedScope]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMsgObj = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const previousHistory = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setChatMessages((prev) => [...prev, userMsgObj]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          model: selectedAiModel,
          familyMemberId: selectedScope,
          history: previousHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorText =
          response.status === 401
            ? "Sua sessão expirou. Faça login novamente para consultar a Kitsune AI."
            : data.error || "Não foi possível processar a resposta no momento.";

        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: errorText,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
          modelUsed: data.modelUsed || selectedAiModel,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Falha de conexão ao comunicar com o motor Kitsune AI.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          "Conversa reiniciada! Estou pronta para analisar seu patrimônio, transações e metas com base nos seus dados sincronizados.",
        timestamp: new Date().toISOString(),
        modelUsed: selectedAiModel,
      },
    ]);
  };

  const userDisplayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Investidor";

  return (
    <div className="flex flex-col h-dvh w-full bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Top Header & Controls */}
      <header className="flex flex-col gap-3 px-6 py-4 border-b border-gray-200 dark:border-white/5 bg-white/90 dark:bg-[#121212]/90 backdrop-blur-md z-10 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-kitsune/10 flex items-center justify-center text-kitsune shadow-sm">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold font-sans text-gray-900 dark:text-white">
                  Kitsune AI
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                  Key Pool Anti-Limite Ativo
                </span>
              </div>
              <p className="text-xs font-sans text-gray-500 dark:text-white/50">
                Private Wealth Advisor de {userDisplayName} • {metrics.accCount} conta(s) e{" "}
                {metrics.txCount} lançamentos no contexto
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Escopo (Pessoal vs Familiar Opcional) */}
            {(isFamilyModeEnabled || familyMembers.length > 0) && (
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                aria-label="Escopo patrimonial"
                className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-sans font-semibold text-gray-800 dark:text-white focus:outline-none focus:border-kitsune"
              >
                <option value="personal" className="dark:bg-[#161616]">
                  Escopo: Meu Patrimônio
                </option>
                {familyMembers.map((m) => (
                  <option key={m.id} value={m.id} className="dark:bg-[#161616]">
                    Membro: {m.name} ({m.role})
                  </option>
                ))}
              </select>
            )}

            {/* Seletor de Modelo Gemini 4 / Gemini 3 */}
            <select
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value)}
              aria-label="Selecionar modelo Gemini"
              className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-sans font-semibold text-gray-800 dark:text-white focus:outline-none focus:border-kitsune cursor-pointer"
            >
              {KITSUNE_GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="dark:bg-[#161616]">
                  {m.name} — {m.badge}
                </option>
              ))}
            </select>

            <button
              onClick={handleClearChat}
              title="Limpar conversa"
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-sans font-semibold text-gray-600 dark:text-white/70 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span className="hidden sm:inline">Nova Conversa</span>
            </button>
          </div>
        </div>

        {/* Barra de Contexto Financeiro Instantâneo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-sans text-gray-500 dark:text-white/50">
              Patrimônio Líquido
            </span>
            <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
              {formatCurrency(metrics.netWorth)}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-sans text-gray-500 dark:text-white/50">
              Saldo Conta
            </span>
            <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
              {formatCurrency(metrics.liquid)}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-sans text-gray-500 dark:text-white/50">
              Despesas (Mês)
            </span>
            <span className="text-xs font-mono font-bold text-red-500">
              {formatCurrency(metrics.monthOut)}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-sans text-gray-500 dark:text-white/50">
              Fatura Cartões
            </span>
            <span className="text-xs font-mono font-bold text-orange-500">
              {formatCurrency(metrics.credit)}
            </span>
          </div>
        </div>
      </header>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto w-full px-4 md:px-8 py-6 flex flex-col gap-5 max-w-5xl mx-auto">
        {/* Sugestões Rápidas Inteligentes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => sendMessage(item.prompt)}
              disabled={isLoading}
              className="p-3.5 text-left rounded-2xl bg-white dark:bg-[#121212] border border-gray-200/80 dark:border-white/5 hover:border-kitsune/40 transition-all flex flex-col gap-1 shadow-xs disabled:opacity-50 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-bold text-gray-900 dark:text-white group-hover:text-kitsune transition-colors">
                  {item.label}
                </span>
                <span className="material-symbols-outlined text-kitsune text-[16px]">
                  {item.icon}
                </span>
              </div>
              <span className="text-[11px] font-sans text-gray-500 dark:text-white/50 line-clamp-2">
                {item.prompt}
              </span>
            </button>
          ))}
        </div>

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3.5 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-9 h-9 rounded-2xl bg-kitsune/10 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <span className="material-symbols-outlined text-kitsune text-[18px]">
                  auto_awesome
                </span>
              </div>
            )}

            <div
              className={`border rounded-3xl p-4 md:p-5 max-w-[88%] md:max-w-[78%] shadow-xs flex flex-col gap-2 ${
                msg.role === "user"
                  ? "bg-kitsune text-white border-kitsune rounded-tr-sm"
                  : "bg-white dark:bg-[#121212] border-gray-100 dark:border-white/5 rounded-tl-sm text-gray-900 dark:text-white/90"
              }`}
            >
              <div className="font-sans text-sm leading-relaxed whitespace-pre-line">
                {msg.content}
              </div>

              {msg.role === "assistant" && msg.modelUsed && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5 text-[10px] font-sans text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-kitsune">
                      memory
                    </span>
                    Modelo: {msg.modelUsed}
                  </span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-kitsune/10 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-kitsune text-[18px] animate-pulse">
                auto_awesome
              </span>
            </div>
            <div className="border rounded-3xl p-4 bg-white dark:bg-[#121212] border-gray-100 dark:border-white/5 rounded-tl-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-kitsune/60 animate-bounce" />
              <div
                className="w-2 h-2 rounded-full bg-kitsune/60 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 rounded-full bg-kitsune/60 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span className="text-xs font-sans text-gray-500 dark:text-white/50 ml-1.5">
                Analisando dados com {selectedAiModel}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="w-full shrink-0 border-t border-gray-200 dark:border-white/5 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur pb-safe sticky bottom-0 z-20 p-4">
        <form
          onSubmit={handleSubmit}
          className={`max-w-5xl mx-auto flex items-center gap-2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-full p-2 pl-5 transition-colors shadow-sm ${
            isLoading ? "opacity-70" : "focus-within:border-kitsune/60"
          }`}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Pergunte sobre suas transações, faturas de cartão, categorias ou planejamento..."
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white font-sans text-sm placeholder:text-gray-400 dark:placeholder:text-white/30 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-kitsune text-white flex items-center justify-center hover:bg-kitsune/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <Spinner size={18} className="text-white" />
            ) : (
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                arrow_upward
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
