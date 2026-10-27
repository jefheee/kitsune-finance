"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Spinner from "@/components/Spinner";
import { useFinanceData } from "@/context/FinanceDataContext";
import { KITSUNE_AI_MODELS } from "@/utils/ai/gemini";

const CONTEXT_ATTACHMENTS = [
  {
    id: "raio-x-mes",
    icon: "analytics",
    label: "Anexar Raio-X do Mês",
    description: "Injeta resumo de entradas, saídas e saldo líquido",
    prompt:
      "Faça um Raio-X completo do meu mês atual: compare minhas receitas e despesas, destaque o saldo líquido e aponte os principais desvios de orçamento.",
  },
  {
    id: "auditar-cartao",
    icon: "credit_card",
    label: "Auditar Cartão de Crédito",
    description: "Compara faturas abertas vs liquidez em conta",
    prompt:
      "Audite minha exposição atual no cartão de crédito comparada ao meu saldo disponível em conta corrente. Quais cuidados devo tomar antes do fechamento da fatura?",
  },
  {
    id: "cortar-gastos",
    icon: "content_cut",
    label: "Análise de Cortar Gastos",
    description: "Identifica gastos supérfluos e recorrentes",
    prompt:
      "Analise minhas transações e categorias recentes e liste os 3 principais pontos onde posso cortar gastos imediatamente, mostrando a economia mensal estimada.",
  },
  {
    id: "extrato-7-dias",
    icon: "calendar_view_week",
    label: "Extrato dos Últimos 7 Dias",
    description: "Auditoria detalhada da última semana",
    prompt:
      "Apresente uma tabela ou resumo estruturado com os lançamentos dos meus últimos 7 dias e destaque qualquer gasto fora do padrão.",
  },
];

const REASONING_LEVELS: {
  id: "fast" | "standard" | "deep";
  label: string;
  desc: string;
}[] = [
  { id: "fast", label: "Rápido", desc: "Direto ao ponto" },
  { id: "standard", label: "Padrão", desc: "Equilibrado" },
  { id: "deep", label: "Profundo", desc: "Análise exaustiva" },
];

export default function KitsuneAIPage() {
  const {
    user,
    userProfile,
    accounts,
    transactions,
    familyMembers,
    chatMessages,
    setChatMessages,
    selectedAiModel,
    setSelectedAiModel,
    reasoningLevel,
    setReasoningLevel,
  } = useFinanceData();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScope, setSelectedScope] = useState<string>("personal");

  // Estados dos Popovers na Barra Inferior
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isReasoningSubmenuOpen, setIsReasoningSubmenuOpen] = useState(false);
  const [isScopeOpen, setIsScopeOpen] = useState(false);

  const attachRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isLoading]);

  // Auto-resize do textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Fechar popovers ao clicar fora
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (attachRef.current && !attachRef.current.contains(target)) {
        setIsAttachOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(target)) {
        setIsModelOpen(false);
        setIsReasoningSubmenuOpen(false);
      }
      if (scopeRef.current && !scopeRef.current.contains(target)) {
        setIsScopeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const currentModelInfo = useMemo(
    () =>
      KITSUNE_AI_MODELS.find((m) => m.id === selectedAiModel) ||
      KITSUNE_AI_MODELS[0],
    [selectedAiModel]
  );

  // Métricas em tempo real do contexto do usuário logado
  const metrics = useMemo(() => {
    const scopedAccounts =
      selectedScope === "personal"
        ? accounts.filter((a) => !a.family_member_id)
        : selectedScope === "all"
        ? accounts
        : accounts.filter((a) => a.family_member_id === selectedScope);

    const effectiveAccounts =
      scopedAccounts.length > 0 ? scopedAccounts : accounts;

    const scopedTx =
      selectedScope === "personal" || selectedScope === "all"
        ? transactions
        : transactions.filter((t) => t.family_member_id === selectedScope);

    let liquid = 0;
    let credit = 0;
    effectiveAccounts.forEach((a) => {
      const bal = Number(a.balance) || 0;
      if (a.type === "CREDIT" || a.type === "CREDIT_CARD") credit += bal;
      else liquid += bal;
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthOut = 0;

    scopedTx.forEach((tx) => {
      const d = new Date(tx.executed_at || tx.date || now);
      const amt = Number(tx.amount) || 0;
      const isCredit = tx.type === "CREDIT" || amt > 0;
      if (d >= monthStart && !isCredit) {
        monthOut += Math.abs(amt);
      }
    });

    return {
      netWorth: liquid - credit,
      liquid,
      credit,
      monthOut,
      txCount: scopedTx.length,
      accCount: effectiveAccounts.length,
    };
  }, [accounts, transactions, selectedScope]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

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
          reasoningLevel,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
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
    userProfile?.display_name ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Investidor";

  const scopeBadgeLabel = useMemo(() => {
    if (selectedScope === "personal") return "Meu Patrimônio";
    if (selectedScope === "all") return "Familiar/Compartilhado";
    const found = familyMembers.find((m) => m.id === selectedScope);
    return found ? found.name : "Meu Patrimônio";
  }, [selectedScope, familyMembers]);

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b]">
      {/* Header Limpo (Sem selects nativos) */}
      <header className="flex flex-col gap-3 px-4 md:px-8 py-3.5 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-kitsune/12 border border-kitsune/20 flex items-center justify-center text-kitsune">
              <span className="material-symbols-outlined text-[20px]">
                auto_awesome
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold font-sans text-white tracking-tight">
                  Kitsune AI
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Pool Gemini + Groq Ativo
                </span>
              </div>
              <p className="text-[11px] font-sans text-zinc-400">
                Consultora de {userDisplayName} • {metrics.accCount} conta(s) •{" "}
                {metrics.txCount} lançamentos
              </p>
            </div>
          </div>

          <button
            onClick={handleClearChat}
            title="Iniciar nova conversa"
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-sans font-medium text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">
              restart_alt
            </span>
            <span>Nova Conversa</span>
          </button>
        </div>

        {/* Resumo Financeiro Compacto */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-5xl mx-auto w-full">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] font-sans text-zinc-400">
              Patrimônio
            </span>
            <span className="text-xs font-mono font-bold text-zinc-100">
              {formatCurrency(metrics.netWorth)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] font-sans text-zinc-400">
              Em Conta
            </span>
            <span className="text-xs font-mono font-bold text-zinc-100">
              {formatCurrency(metrics.liquid)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] font-sans text-zinc-400">
              Saídas (Mês)
            </span>
            <span className="text-xs font-mono font-bold text-red-400">
              {formatCurrency(metrics.monthOut)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] font-sans text-zinc-400">
              Cartões
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {formatCurrency(metrics.credit)}
            </span>
          </div>
        </div>
      </header>

      {/* Área de Mensagens com Renderização Markdown Rica */}
      <div className="flex-1 overflow-y-auto w-full px-4 md:px-8 py-6 flex flex-col gap-5 max-w-4xl mx-auto">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3.5 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-2xl bg-kitsune/12 border border-kitsune/25 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-kitsune text-[17px]">
                  auto_awesome
                </span>
              </div>
            )}

            <div
              className={`border rounded-3xl px-4 py-3.5 md:px-5 md:py-4 max-w-[90%] md:max-w-[82%] shadow-sm flex flex-col gap-2 ${
                msg.role === "user"
                  ? "bg-kitsune text-white border-kitsune rounded-tr-sm"
                  : "bg-zinc-900/90 border-zinc-800/90 rounded-tl-sm text-zinc-100"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="kitsune-markdown prose prose-invert max-w-none text-sm font-sans leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="font-sans text-sm leading-relaxed whitespace-pre-line">
                  {msg.content}
                </div>
              )}

              {msg.role === "assistant" && msg.modelUsed && (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[10px] font-sans text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-amber-400">
                      memory
                    </span>
                    {msg.modelUsed}
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
            <div className="w-8 h-8 rounded-2xl bg-kitsune/12 border border-kitsune/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-kitsune text-[17px] animate-pulse">
                auto_awesome
              </span>
            </div>
            <div className="border rounded-3xl px-4 py-3.5 bg-zinc-900/90 border-zinc-800 rounded-tl-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-kitsune animate-bounce" />
              <div
                className="w-2 h-2 rounded-full bg-kitsune animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 rounded-full bg-kitsune animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span className="text-xs font-sans text-zinc-400 ml-1.5">
                Kitsune está analisando ({currentModelInfo.shortTitle})...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada Unificada no Rodapé (Estilo Gemini/Claude) */}
      <div className="w-full shrink-0 px-3 md:px-6 pb-3 pt-2 bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent sticky bottom-0 z-30">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto bg-zinc-900/95 border border-zinc-800 focus-within:border-zinc-700 rounded-3xl p-2.5 md:p-3 shadow-2xl backdrop-blur-xl flex flex-col gap-2"
        >
          {/* Campo de Texto Auto-Resize */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Pergunte à Kitsune AI sobre seu patrimônio, faturas ou investimentos..."
            className="w-full px-2.5 py-1 bg-transparent border-none outline-none resize-none text-zinc-100 font-sans text-sm placeholder:text-zinc-500 max-h-36 overflow-y-auto"
          />

          {/* Linha Inferior da Caixa: [+] Anexar | Escopo | Seletor de Modelo (Estilo Print) | Enviar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 1. Botão + (Anexar Contexto) */}
              <div ref={attachRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachOpen((prev) => !prev);
                    setIsModelOpen(false);
                    setIsScopeOpen(false);
                  }}
                  title="Anexar contexto financeiro rápido"
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                    isAttachOpen
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/70 text-zinc-300"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                </button>

                {isAttachOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-72 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400">
                      Anexar Bloco de Contexto
                    </div>
                    {CONTEXT_ATTACHMENTS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsAttachOpen(false);
                          sendMessage(item.prompt);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 text-left transition-colors flex items-start gap-2.5 cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500/20">
                          <span className="material-symbols-outlined text-[16px]">
                            {item.icon}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-sans font-semibold text-zinc-100">
                            {item.label}
                          </span>
                          <span className="text-[11px] font-sans text-zinc-400 leading-tight mt-0.5">
                            {item.description}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Seletor de Escopo (Meu Patrimônio vs Familiar/Compartilhado) */}
              <div ref={scopeRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsScopeOpen((prev) => !prev);
                    setIsAttachOpen(false);
                    setIsModelOpen(false);
                  }}
                  className="h-8 px-3 rounded-full bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-sans font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-400">
                    {selectedScope === "personal" ? "person" : "groups"}
                  </span>
                  <span className="max-w-[130px] truncate">
                    {scopeBadgeLabel}
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-zinc-400">
                    expand_more
                  </span>
                </button>

                {isScopeOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-60 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400">
                      Escopo da Análise
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScope("personal");
                        setIsScopeOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left font-sans flex items-center justify-between cursor-pointer transition-colors ${
                        selectedScope === "personal"
                          ? "bg-amber-500/15 text-amber-400 font-semibold"
                          : "text-zinc-200 hover:bg-zinc-800/80"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs">Meu Patrimônio</span>
                        <span className="text-[11px] text-zinc-400 font-normal">
                          Visão individual isolada
                        </span>
                      </div>
                      {selectedScope === "personal" && (
                        <span className="material-symbols-outlined text-[16px] text-amber-400">
                          check
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScope("all");
                        setIsScopeOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left font-sans flex items-center justify-between cursor-pointer transition-colors ${
                        selectedScope === "all"
                          ? "bg-amber-500/15 text-amber-400 font-semibold"
                          : "text-zinc-200 hover:bg-zinc-800/80"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs">Familiar/Compartilhado</span>
                        <span className="text-[11px] text-zinc-400 font-normal">
                          Consolidado do workspace
                        </span>
                      </div>
                      {selectedScope === "all" && (
                        <span className="material-symbols-outlined text-[16px] text-amber-400">
                          check
                        </span>
                      )}
                    </button>

                    {familyMembers.length > 0 && (
                      <>
                        <div className="h-px bg-zinc-800 my-1" />
                        {familyMembers.map((m) => {
                          const active = selectedScope === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedScope(m.id);
                                setIsScopeOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left font-sans flex items-center justify-between cursor-pointer transition-colors ${
                                active
                                  ? "bg-amber-500/15 text-amber-400 font-semibold"
                                  : "text-zinc-200 hover:bg-zinc-800/80"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="text-xs">{m.name}</span>
                                <span className="text-[11px] text-zinc-400 font-normal">
                                  {m.role || "Membro"}
                                </span>
                              </div>
                              {active && (
                                <span className="material-symbols-outlined text-[16px] text-amber-400">
                                  check
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Seletor de Modelo Estilo Print Gemini + Botão de Envio */}
            <div className="flex items-center gap-2">
              {/* 3. Pílula Clicável do Seletor de Modelo (Estilo Print) */}
              <div ref={modelRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelOpen((prev) => !prev);
                    setIsAttachOpen(false);
                    setIsScopeOpen(false);
                  }}
                  className="h-8 px-3 rounded-full bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/70 text-xs font-sans font-semibold text-zinc-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{currentModelInfo.shortTitle}</span>
                  <span
                    className={`material-symbols-outlined text-[15px] text-zinc-400 transition-transform duration-200 ${
                      isModelOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {/* Popover Moderno Fiel à Print Enviada */}
                {isModelOpen && (
                  <div className="absolute bottom-full right-0 mb-2.5 w-64 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl py-2 px-1.5 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {KITSUNE_AI_MODELS.map((model) => {
                      const isSelected = model.id === selectedAiModel;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedAiModel(model.id);
                            setIsModelOpen(false);
                            setIsReasoningSubmenuOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl text-left font-sans transition-colors flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? "bg-amber-500/12 text-amber-400"
                              : "text-zinc-100 hover:bg-zinc-800/80"
                          }`}
                        >
                          <div className="w-4 flex items-center justify-center shrink-0">
                            {isSelected && (
                              <span className="material-symbols-outlined text-[17px] text-amber-400 font-bold">
                                check
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold leading-tight text-zinc-100">
                              {model.shortTitle}
                            </span>
                            <span className="text-xs text-zinc-400 font-normal mt-0.5">
                              {model.subtitle}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    <div className="h-px bg-zinc-800 my-1.5 mx-2" />

                    {/* Item "Nível de raciocínio ▸" igual ao da print */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsReasoningSubmenuOpen((prev) => !prev)
                        }
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl text-left font-sans text-xs font-medium text-zinc-200 hover:bg-zinc-800/80 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>Nível de raciocínio</span>
                        <div className="flex items-center gap-1 text-zinc-400">
                          <span className="text-[11px] text-amber-400 font-semibold">
                            {
                              REASONING_LEVELS.find(
                                (r) => r.id === reasoningLevel
                              )?.label
                            }
                          </span>
                          <span className="material-symbols-outlined text-[16px]">
                             arrow_right
                          </span>
                        </div>
                      </button>

                      {isReasoningSubmenuOpen && (
                        <div className="mt-1 mx-2 p-1.5 rounded-xl bg-zinc-950/90 border border-zinc-800 flex flex-col gap-0.5">
                          {REASONING_LEVELS.map((lvl) => {
                            const active = reasoningLevel === lvl.id;
                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onClick={() => {
                                  setReasoningLevel(lvl.id);
                                  setIsReasoningSubmenuOpen(false);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg text-left font-sans flex items-center justify-between cursor-pointer ${
                                  active
                                    ? "bg-amber-500/15 text-amber-400 font-semibold"
                                    : "text-zinc-300 hover:bg-zinc-800"
                                }`}
                              >
                                <span className="text-xs">{lvl.label}</span>
                                <span className="text-[10px] text-zinc-400">
                                  {lvl.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Botão de Envio */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-kitsune text-white flex items-center justify-center hover:bg-kitsune/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-kitsune/20 shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <Spinner size={16} className="text-white" />
                ) : (
                  <span
                    className="material-symbols-outlined text-[19px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    arrow_upward
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
