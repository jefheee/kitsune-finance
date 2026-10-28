"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StreamingMarkdown from "@/components/StreamingMarkdown";
import Spinner from "@/components/Spinner";
import { useFinanceData } from "@/context/FinanceDataContext";
import { KITSUNE_AI_MODELS } from "@/utils/ai/gemini";

const CONTEXT_ATTACHMENTS = [
  {
    id: "raio-x-mes",
    icon: "analytics",
    label: "Raio-X do Mês",
    description: "Injeta entradas, saídas, saldo livre e ritmo de gastos",
    prompt:
      "Faça um Raio-X completo do meu mês atual: compare receitas e despesas, analise o saldo líquido e aponte desvios.",
  },
  {
    id: "auditar-cartao",
    icon: "credit_card",
    label: "Auditar Cartão de Crédito",
    description: "Compara fatura aberta vs liquidez disponível em conta",
    prompt:
      "Audite minha exposição atual no cartão de crédito em relação ao saldo em conta corrente e dias para o fechamento.",
  },
  {
    id: "cortar-gastos",
    icon: "content_cut",
    label: "Análise de Cortar Gastos",
    description: "Identifica assinaturas e despesas supérfluas",
    prompt:
      "Analise minhas transações recentes e liste 3 pontos práticos onde posso cortar gastos imediatamente.",
  },
  {
    id: "extrato-7-dias",
    icon: "calendar_view_week",
    label: "Extrato dos Últimos 7 Dias",
    description: "Auditoria detalhada da última semana",
    prompt:
      "Audite detalhadamente minhas transações dos últimos 7 dias e destaque qualquer gasto fora do padrão.",
  },
];

const SUGGESTED_QUICK_PROMPTS = [
  { label: "Vou conseguir pagar o cartão sem aperto?", query: "Vou conseguir pagar minha fatura do cartão sem aperto com o saldo atual?" },
  { label: "Quanto já gastei esse mês?", query: "Quanto já gastei no mês atual e qual é meu saldo livre estimado?" },
  { label: "Onde posso economizar no dia a dia?", query: "Onde posso cortar pequenos gastos este mês sem mudar meu padrão de vida?" },
  { label: "Como começar minha reserva de emergência?", query: "Como posso começar a montar minha reserva de emergência guardando pouco por semana?" },
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

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: any[];
}

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

  // Anexos de Contexto selecionados
  const [attachedContexts, setAttachedContexts] = useState<string[]>([]);

  // Estados dos Popovers na Barra Inferior
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isReasoningSubmenuOpen, setIsReasoningSubmenuOpen] = useState(false);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Microfone (Entrada de Voz)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Sessões de Chat (Histórico Persistente)
  const [savedSessions, setSavedSessions] = useState<ChatSession[]>([]);
  const currentSessionIdRef = useRef<string>(`session-${Date.now()}`);

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const isAtBottomRef = useRef<boolean>(true);

  const attachRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega histórico de conversas do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kitsune_saved_sessions_v2");
      if (stored) {
        setSavedSessions(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Não foi possível carregar sessões anteriores:", e);
    }
  }, []);

  // Salva a conversa atual no histórico quando as mensagens mudam
  useEffect(() => {
    if (chatMessages.length <= 1) return;

    try {
      const firstUserMsg = chatMessages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? "..." : "")
        : "Conversa com Kitsune IA";

      const currentSession: ChatSession = {
        id: currentSessionIdRef.current,
        title,
        createdAt: new Date().toISOString(),
        messages: chatMessages,
      };

      setSavedSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== currentSession.id);
        const updated = [currentSession, ...filtered].slice(0, 20);
        localStorage.setItem("kitsune_saved_sessions_v2", JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.warn("Erro ao salvar sessão:", e);
    }
  }, [chatMessages]);

  // Monitora se o usuário está ou não no limite inferior do chat
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 70;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= threshold;
  }, []);

  const scrollToBottomSmooth = useCallback((force = false) => {
    if (force || isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottomSmooth(true);
  }, [chatMessages.length, isLoading, scrollToBottomSmooth]);

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

  // Microfone: Web Speech API
  const toggleVoiceRecognition = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz direto. Experimente usar o Google Chrome ou Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Erro ao iniciar microfone:", err);
      setIsListening(false);
    }
  };

  const sendMessage = async (customPrompt?: string) => {
    const rawText = typeof customPrompt === "string" ? customPrompt : input;
    const trimmed = rawText.trim();
    const currentAttachments = [...attachedContexts];

    // Se o usuário não digitou texto e não tem anexo, não envia
    if (!trimmed && currentAttachments.length === 0) return;
    if (isLoading) return;

    // Constrói o texto visível da mensagem do usuário
    let displayMessage = trimmed;
    if (!displayMessage && currentAttachments.length > 0) {
      displayMessage = currentAttachments
        .map((id) => CONTEXT_ATTACHMENTS.find((c) => c.id === id)?.label)
        .filter(Boolean)
        .join(" + ");
    }

    const userMsgObj = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: displayMessage,
      timestamp: new Date().toISOString(),
    };

    const previousHistory = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setChatMessages((prev) => [...prev, userMsgObj]);
    setInput("");
    setAttachedContexts([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          attachedContexts: currentAttachments,
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

      const newAiId = `ai-${Date.now()}`;
      setStreamingMessageId(newAiId);
      setChatMessages((prev) => [
        ...prev,
        {
          id: newAiId,
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
          content: "Falha de conexão ao comunicar com a consultora Kitsune AI.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStartNewChat = () => {
    currentSessionIdRef.current = `session-${Date.now()}`;
    setAttachedContexts([]);
    setInput("");
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `Olá, **${
          userProfile?.display_name || userProfile?.full_name || "Investidor"
        }**! Sou sua consultora financeira dedicada. Suas contas e cartões estão sincronizados com segurança bancária. Como posso te orientar hoje?`,
        timestamp: new Date().toISOString(),
        modelUsed: selectedAiModel,
      },
    ]);
  };

  const handleLoadSession = (session: ChatSession) => {
    currentSessionIdRef.current = session.id;
    setChatMessages(session.messages);
    setIsHistoryOpen(false);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSessions.filter((s) => s.id !== sessionId);
    setSavedSessions(updated);
    localStorage.setItem("kitsune_saved_sessions_v2", JSON.stringify(updated));
  };

  // Exportar conversa para arquivo Markdown
  const handleExportConversation = () => {
    const title = `Relatorio_Kitsune_Finance_${new Date().toISOString().slice(0, 10)}.md`;
    let content = `# Relatório de Consultoria Financeira - Kitsune IA\n`;
    content += `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n`;
    content += `Usuário: ${userProfile?.full_name || user?.email || "Titular"}\n`;
    content += `Patrimônio Líquido: ${formatCurrency(metrics.netWorth)} | Em Conta: ${formatCurrency(metrics.liquid)} | Cartões: ${formatCurrency(metrics.credit)}\n\n`;
    content += `---\n\n`;

    chatMessages.forEach((m) => {
      const sender = m.role === "assistant" ? "Kitsune IA" : "Você";
      content += `### ${sender} (${new Date(m.timestamp).toLocaleTimeString("pt-BR")})\n\n${m.content}\n\n`;
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = title;
    link.click();
    URL.revokeObjectURL(url);
  };

  const userDisplayName =
    userProfile?.display_name ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Investidor";

  const scopeBadgeLabel = useMemo(() => {
    if (selectedScope === "personal") return "Meu Patrimônio";
    if (selectedScope === "all") return "Familiar / Compartilhado";
    const found = familyMembers.find((m) => m.id === selectedScope);
    return found ? found.name : "Meu Patrimônio";
  }, [selectedScope, familyMembers]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0F141C] text-[#F8FAFC]">
      {/* Header Human-Centric com Warm Obsidian Intelligence */}
      <header className="flex flex-col gap-3 px-4 md:px-8 py-3.5 border-b border-[#263042] bg-[#0F141C]/95 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00] shadow-[0_0_20px_-4px_rgba(255,107,0,0.3)]">
              <span className="material-symbols-outlined text-[22px]">
                auto_awesome
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold text-[#F8FAFC] tracking-tight">
                  Kitsune IA
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Open Finance Conectado
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Consultora de {userDisplayName} • {metrics.accCount} conta(s) • Criptografia Bancária Ativa
              </p>
            </div>
          </div>

          {/* Ações Rápidas do Topo: Histórico de Chats, Exportar Relatório e Nova Conversa */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              title="Ver conversas anteriores"
              className="px-3 py-1.5 rounded-xl bg-[#141A24] hover:bg-[#1C2331] border border-[#263042] text-xs font-medium text-[#F8FAFC] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-[#94A3B8]">
                history
              </span>
              <span className="hidden sm:inline">Histórico</span>
            </button>

            <button
              onClick={handleExportConversation}
              title="Baixar resumo da consultoria"
              className="px-3 py-1.5 rounded-xl bg-[#141A24] hover:bg-[#1C2331] border border-[#263042] text-xs font-medium text-[#F8FAFC] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-[#FF6B00]">
                download
              </span>
              <span className="hidden sm:inline">Relatório</span>
            </button>

            <button
              onClick={handleStartNewChat}
              title="Iniciar nova conversa do zero"
              className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7D1A] active:bg-[#E05E00] text-white font-bold text-xs transition-all shadow-[0_2px_12px_rgba(255,107,0,0.3)] cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">
                add_comment
              </span>
              <span>Nova Conversa</span>
            </button>
          </div>
        </div>

        {/* Resumo Financeiro Compacto (Tabular Numeral) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-5xl mx-auto w-full">
          <div className="px-3 py-1.5 rounded-xl bg-[#141A24] border border-[#263042] flex items-center justify-between">
            <span className="text-[11px] text-[#94A3B8]">Patrimônio Líquido</span>
            <span className="text-xs font-bold text-[#F8FAFC] tabular-nums">
              {formatCurrency(metrics.netWorth)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#141A24] border border-[#263042] flex items-center justify-between">
            <span className="text-[11px] text-[#94A3B8]">Livre em Conta</span>
            <span className="text-xs font-bold text-[#10B981] tabular-nums">
              {formatCurrency(metrics.liquid)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#141A24] border border-[#263042] flex items-center justify-between">
            <span className="text-[11px] text-[#94A3B8]">Saídas no Mês</span>
            <span className="text-xs font-bold text-[#EF4444] tabular-nums">
              {formatCurrency(metrics.monthOut)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#141A24] border border-[#263042] flex items-center justify-between">
            <span className="text-[11px] text-[#94A3B8]">Fatura de Cartão</span>
            <span className="text-xs font-bold text-[#FF6B00] tabular-nums">
              {formatCurrency(metrics.credit)}
            </span>
          </div>
        </div>
      </header>

      {/* Área de Mensagens com Renderização Markdown e Scroll Suave */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto w-full px-4 md:px-8 py-6 flex flex-col gap-5 max-w-4xl mx-auto scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-start gap-3.5 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-9 h-9 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <span className="material-symbols-outlined text-[#FF6B00] text-[18px]">
                    auto_awesome
                  </span>
                </div>
              )}

              <div
                className={`border rounded-3xl px-4 py-3.5 md:px-5 md:py-4 max-w-[90%] md:max-w-[84%] shadow-lg flex flex-col gap-2 transition-shadow ${
                  msg.role === "user"
                    ? "bg-[#FF6B00] text-white border-[#FF6B00] rounded-tr-sm"
                    : "bg-[#141A24] border-[#263042] rounded-tl-sm text-[#F8FAFC] backdrop-blur-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <StreamingMarkdown
                    content={msg.content}
                    isNew={msg.id === streamingMessageId}
                    onUpdate={() => scrollToBottomSmooth(false)}
                    onComplete={() => {
                      if (msg.id === streamingMessageId) {
                        setStreamingMessageId(null);
                        scrollToBottomSmooth(false);
                      }
                    }}
                  />
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-line font-medium">
                    {msg.content}
                  </div>
                )}

                {msg.role === "assistant" && msg.modelUsed && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#263042] text-[11px] text-[#94A3B8]">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[13px] text-[#FF6B00]">
                        memory
                      </span>
                      {msg.modelUsed === "gemini-3.5-flash-lite"
                        ? "⚡ 3.5 Flash Lite (Resposta Rápida)"
                        : msg.modelUsed === "gemini-3.8-flash"
                        ? "✨ 3.8 Flash (Análise Estruturada)"
                        : msg.modelUsed === "gemini-4-argon"
                        ? "🧠 4 Argon (Raciocínio Profundo)"
                        : msg.modelUsed}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]/70">
                      {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3.5"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#FF6B00] text-[18px]">
                auto_awesome
              </span>
            </div>
            <div className="p-4 rounded-3xl rounded-tl-sm bg-[#141A24] border border-[#263042] text-xs text-[#94A3B8] flex items-center gap-2.5 shadow-sm">
              <Spinner size="sm" />
              <span>Consultando seu patrimônio e formulando recomendações...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} className="h-2 shrink-0" />
      </div>

      {/* Pílulas de Perguntas Sugeridas (Estilo Stitch) */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto w-full pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] text-[#94A3B8] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#FF6B00]">
              lightbulb
            </span>
            Sugestões:
          </span>
          {SUGGESTED_QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => sendMessage(item.query)}
              className="px-3.5 py-1.5 rounded-full bg-[#141A24] hover:bg-[#1C2331] hover:border-[#FF6B00]/40 border border-[#263042] text-[#F8FAFC] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer active:scale-95"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Caixa de Entrada Inferior com Anexos Visuais, Microfone e Seletor */}
      <div className="p-3 md:p-4 bg-[#0F141C] border-t border-[#263042] z-20 shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto bg-[#141A24] border border-[#263042] focus-within:border-[#FF6B00]/60 rounded-3xl p-2.5 md:p-3 shadow-2xl backdrop-blur-xl flex flex-col gap-2 transition-colors"
        >
          {/* Badges dos Blocos de Contexto Anexados */}
          {attachedContexts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-1 pt-1">
              <span className="text-[10px] uppercase font-bold text-[#FF6B00] tracking-wider pl-1">
                Contexto Anexado:
              </span>
              {attachedContexts.map((ctxId) => {
                const item = CONTEXT_ATTACHMENTS.find((c) => c.id === ctxId);
                if (!item) return null;
                return (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-xs text-[#FF6B00] font-semibold animate-in fade-in"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedContexts((prev) =>
                          prev.filter((id) => id !== ctxId)
                        )
                      }
                      className="hover:text-white transition-colors cursor-pointer ml-1"
                      title="Remover anexo"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        close
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Campo de Texto Auto-Resize */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              isListening
                ? "Ouvindo sua dúvida... (pode falar)"
                : attachedContexts.length > 0
                ? "Digite sua pergunta com esse contexto (ou aperte Enter para enviar)..."
                : "Pergunte à Kitsune IA sobre seu saldo, faturas, gastos ou investimentos..."
            }
            className="w-full px-2.5 py-1.5 bg-transparent border-none outline-none resize-none text-[#F8FAFC] text-sm placeholder:text-[#94A3B8]/60 max-h-36 overflow-y-auto"
          />

          {/* Linha Inferior da Caixa: [+] Anexar Contexto | Escopo | Microfone | Seletor de Modelo | Enviar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#263042]/50">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 1. Botão + (Menu de Anexar Contexto) */}
              <div ref={attachRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachOpen((prev) => !prev);
                    setIsModelOpen(false);
                    setIsScopeOpen(false);
                  }}
                  title="Anexar bloco de contexto financeiro"
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                    isAttachOpen || attachedContexts.length > 0
                      ? "bg-[#FF6B00]/20 border-[#FF6B00]/50 text-[#FF6B00]"
                      : "bg-[#1C2331] hover:bg-[#252A33] border-[#263042] text-[#94A3B8]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                </button>

                {isAttachOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-72 bg-[#141A24] border border-[#263042] rounded-2xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Anexar Bloco de Contexto
                    </div>
                    {CONTEXT_ATTACHMENTS.map((item) => {
                      const isAttached = attachedContexts.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setAttachedContexts((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id]
                            );
                            setIsAttachOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                            isAttached
                              ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                              : "hover:bg-[#1C2331] text-[#F8FAFC]"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isAttached
                                ? "bg-[#FF6B00] text-white"
                                : "bg-[#FF6B00]/15 text-[#FF6B00]"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {item.icon}
                            </span>
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className="text-xs font-semibold">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-[#94A3B8] leading-tight mt-0.5">
                              {item.description}
                            </span>
                          </div>
                          {isAttached && (
                            <span className="material-symbols-outlined text-[16px] text-[#FF6B00]">
                              check
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Seletor de Escopo (Meu Patrimônio vs Familiar) */}
              <div ref={scopeRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsScopeOpen((prev) => !prev);
                    setIsAttachOpen(false);
                    setIsModelOpen(false);
                  }}
                  className="h-8 px-3 rounded-full bg-[#1C2331] hover:bg-[#252A33] border border-[#263042] text-xs font-medium text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#FF6B00]">
                    {selectedScope === "personal" ? "person" : "groups"}
                  </span>
                  <span className="max-w-[130px] truncate">
                    {scopeBadgeLabel}
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-[#94A3B8]">
                    expand_more
                  </span>
                </button>

                {isScopeOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-60 bg-[#141A24] border border-[#263042] rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Escopo da Análise
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScope("personal");
                        setIsScopeOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedScope === "personal"
                          ? "bg-[#FF6B00]/15 text-[#FF6B00] font-semibold"
                          : "text-[#F8FAFC] hover:bg-[#1C2331]"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs">Meu Patrimônio</span>
                        <span className="text-[11px] text-[#94A3B8] font-normal">
                          Visão individual isolada
                        </span>
                      </div>
                      {selectedScope === "personal" && (
                        <span className="material-symbols-outlined text-[16px] text-[#FF6B00]">
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
                      className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedScope === "all"
                          ? "bg-[#FF6B00]/15 text-[#FF6B00] font-semibold"
                          : "text-[#F8FAFC] hover:bg-[#1C2331]"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs">Familiar / Compartilhado</span>
                        <span className="text-[11px] text-[#94A3B8] font-normal">
                          Consolidado de todos os membros
                        </span>
                      </div>
                      {selectedScope === "all" && (
                        <span className="material-symbols-outlined text-[16px] text-[#FF6B00]">
                          check
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Microfone + Seletor de Modelo + Botão de Envio */}
            <div className="flex items-center gap-2">
              {/* 3. Botão de Microfone (Transcrição por Voz) */}
              <button
                type="button"
                onClick={toggleVoiceRecognition}
                title={isListening ? "Parar de ouvir" : "Falar por voz"}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? "bg-[#FF6B00] text-white animate-pulse shadow-[0_0_16px_rgba(255,107,0,0.6)]"
                    : "bg-[#1C2331] hover:bg-[#252A33] border border-[#263042] text-[#94A3B8] hover:text-[#FF6B00]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isListening ? "graphic_eq" : "mic"}
                </span>
              </button>

              {/* 4. Seletor de Modelo de IA (Incluindo Automático) */}
              <div ref={modelRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelOpen((prev) => !prev);
                    setIsAttachOpen(false);
                    setIsScopeOpen(false);
                  }}
                  className="h-8 px-3 rounded-full bg-[#1C2331] hover:bg-[#252A33] border border-[#263042] text-xs font-semibold text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{currentModelInfo.shortTitle}</span>
                  <span className="material-symbols-outlined text-[15px] text-[#94A3B8]">
                    expand_more
                  </span>
                </button>

                {isModelOpen && (
                  <div className="absolute bottom-full right-0 mb-2.5 w-68 bg-[#141A24] border border-[#263042] rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Modelo Inteligente
                    </div>
                    {KITSUNE_AI_MODELS.map((model) => {
                      const isSelected = selectedAiModel === model.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedAiModel(model.id);
                            setIsModelOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#FF6B00]/15 text-[#FF6B00] font-semibold"
                              : "text-[#F8FAFC] hover:bg-[#1C2331]"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs">{model.shortTitle}</span>
                            <span className="text-[10px] text-[#94A3B8] leading-tight">
                              {model.subtitle}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[16px] text-[#FF6B00]">
                              check
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <div className="h-px bg-[#263042] w-full my-1" />

                    {/* Nível de Raciocínio */}
                    <div className="px-3 py-1 flex items-center justify-between text-xs text-[#94A3B8]">
                      <span>Raciocínio:</span>
                      <div className="flex items-center gap-1">
                        {REASONING_LEVELS.map((lvl) => (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setReasoningLevel(lvl.id)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              reasoningLevel === lvl.id
                                ? "bg-[#FF6B00] text-white"
                                : "bg-[#1C2331] text-[#94A3B8] hover:text-[#F8FAFC]"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Botão de Envio Proeminente */}
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && attachedContexts.length === 0)}
                className="w-8 h-8 rounded-full bg-[#FF6B00] hover:bg-[#FF7D1A] active:bg-[#E05E00] text-white flex items-center justify-center transition-all shadow-[0_2px_10px_rgba(255,107,0,0.35)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Enviar mensagem"
              >
                <span className="material-symbols-outlined text-[18px]">
                  arrow_upward
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Drawer Lateral: Histórico de Conversas Salvas */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-sm h-full bg-[#141A24] border-l border-[#263042] p-5 flex flex-col justify-between shadow-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#263042] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF6B00] text-xl">
                    history
                  </span>
                  <h3 className="font-bold text-sm text-[#F8FAFC]">
                    Histórico de Conversas
                  </h3>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1C2331]"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <button
                onClick={() => {
                  handleStartNewChat();
                  setIsHistoryOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FF6B00] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6B00]/25"
              >
                <span className="material-symbols-outlined text-[16px]">
                  add
                </span>
                Nova Conversa
              </button>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[70vh] pt-2">
                {savedSessions.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-8">
                    Nenhuma conversa anterior salva neste navegador.
                  </p>
                ) : (
                  savedSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleLoadSession(session)}
                      className="p-3 rounded-xl bg-[#0F141C] border border-[#263042] hover:border-[#FF6B00]/40 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                          {session.title}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(session.createdAt).toLocaleDateString("pt-BR")}{" "}
                          • {session.messages.length} mensagens
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        title="Excluir conversa"
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#94A3B8] hover:text-[#EF4444] transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          delete
                        </span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#263042]">
              <p className="text-[11px] text-[#94A3B8] text-center">
                Conversas salvas localmente com criptografia de sessão.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
