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

  // Microfone (Entrada de Voz - Suporte universal para Chrome, Edge, Zen e Firefox)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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

  // Dados financeiros resumidos para injeção rápida
  const financialSummary = useMemo(() => {
    const effectiveAccounts =
      selectedScope === "all"
        ? accounts
        : selectedScope === "personal"
        ? accounts.filter((a) => !a.family_member_id)
        : accounts.filter((a) => a.family_member_id === selectedScope);

    let liquid = 0;
    let credit = 0;
    effectiveAccounts.forEach((acc) => {
      const val = Number(acc.balance) || 0;
      if (acc.type === "CREDIT" || acc.type === "CREDIT_CARD") {
        credit += val;
      } else {
        liquid += val;
      }
    });

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const scopedTx =
      selectedScope === "all"
        ? transactions
        : selectedScope === "personal"
        ? transactions.filter((t) => !t.family_member_id)
        : transactions.filter((t) => t.family_member_id === selectedScope);

    let monthOut = 0;
    scopedTx.forEach((tx) => {
      const d = tx.executed_at || tx.date ? new Date(tx.executed_at || tx.date) : null;
      const amt = Number(tx.amount) || 0;
      if (d && d >= currentMonthStart && amt < 0) {
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

  // Microfone Universal: Suporta Chrome/Edge (Web Speech) e Zen/Firefox (MediaRecorder + Whisper)
  const toggleVoiceRecognition = async () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // Cenário 1: Navegadores com Web Speech nativo (Chrome, Edge, Safari recente)
    if (SpeechRecognition) {
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
        return;
      } catch (err) {
        console.error("Erro no reconhecimento de voz:", err);
        setIsListening(false);
      }
    }

    // Cenário 2: Zen Browser, Firefox e outros que não possuem Web Speech API nativa
    if (isListening) {
      // Parar gravação e transcrever
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert("Seu navegador bloqueou o acesso ao microfone.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        if (audioBlob.size < 1000) {
          return; // Áudio muito curto
        }

        setIsTranscribingAudio(true);
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.webm");

          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (res.ok && data.text) {
            setInput((prev) => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${data.text}` : data.text;
            });
          }
        } catch (transcribeErr) {
          console.error("Erro ao transcrever via Whisper:", transcribeErr);
        } finally {
          setIsTranscribingAudio(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (micErr: any) {
      console.error("Permissão de microfone negada:", micErr);
      alert("Por favor, permita o acesso ao microfone no seu navegador.");
      setIsListening(false);
    }
  };

  // Sugestões de Perguntas: Injeta no campo do usuário sem disparar sozinho
  const handleSelectSuggestedPrompt = (query: string) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return query;
      return `${trimmed}\n\n${query}`;
    });
    textareaRef.current?.focus();
  };

  const sendMessage = async (customPrompt?: string) => {
    const rawText = typeof customPrompt === "string" ? customPrompt : input;
    const trimmed = rawText.trim();
    const currentAttachments = [...attachedContexts];

    if (!trimmed && currentAttachments.length === 0) return;
    if (isLoading) return;

    let displayMessage = trimmed;
    if (!displayMessage && currentAttachments.length > 0) {
      displayMessage = currentAttachments
        .map((id) => CONTEXT_ATTACHMENTS.find((c) => c.id === id)?.label)
        .filter(Boolean)
        .join(" + ");
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: displayMessage,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedContexts([]);
    setIsLoading(true);

    try {
      const historyPayload = chatMessages.slice(-8).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          attachedContexts: currentAttachments,
          model: selectedAiModel,
          reasoningLevel,
          familyMemberId: selectedScope,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro na resposta da Kitsune AI");
      }

      const assistantMsgId = `assistant-${Date.now()}`;
      setStreamingMessageId(assistantMsgId);

      const assistantMsg = {
        id: assistantMsgId,
        role: "assistant" as const,
        content: data.message,
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: "assistant" as const,
        content: `Desculpe, ocorreu uma instabilidade: ${err.message}. Por favor, tente novamente.`,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
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

  const handleNewConversation = () => {
    currentSessionIdRef.current = `session-${Date.now()}`;
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          "Olá! Como posso ajudar você a otimizar seus gastos, auditar contas ou simular metas hoje?",
        timestamp: new Date().toISOString(),
        modelUsed: selectedAiModel,
      },
    ]);
    setAttachedContexts([]);
    setInput("");
  };

  const handleExportMarkdown = () => {
    const lines = [
      `# Relatório de Consultoria Financeira - Kitsune IA`,
      `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
      `Usuário: ${userProfile?.display_name || user?.email || "Titular"}`,
      `Patrimônio Líquido: ${formatCurrency(financialSummary.netWorth)}`,
      `Fatura Cartões: ${formatCurrency(financialSummary.credit)}`,
      `\n---\n`,
      ...chatMessages.map(
        (m) =>
          `### ${m.role === "assistant" ? "Kitsune IA" : "Você"} (${new Date(m.timestamp).toLocaleTimeString("pt-BR")}):\n${m.content}\n`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kitsune-consultoria-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentModelObj =
    KITSUNE_AI_MODELS.find((m) => m.id === selectedAiModel) ||
    KITSUNE_AI_MODELS.find((m) => m.id === "auto") ||
    KITSUNE_AI_MODELS[0];

  const scopeBadgeLabel =
    selectedScope === "personal"
      ? "Meu Patrimônio"
      : selectedScope === "all"
      ? "Consolidado Familiar"
      : familyMembers.find((m) => m.id === selectedScope)?.name || "Membro";

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-dvh w-full max-w-full overflow-hidden bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-[#F8FAFC] font-sans">
      {/* Top Header */}
      <header className="px-3 md:px-8 py-2.5 md:py-3.5 border-b border-slate-200 dark:border-[#262E3D] bg-white/95 dark:bg-[#0E121A]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/25 flex items-center justify-center text-[#FF8216] shrink-0">
            <span className="material-symbols-outlined text-lg md:text-xl">auto_awesome</span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Kitsune IA
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Open Finance Conectado
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] truncate hidden sm:block">
              Consultoria Patrimonial Pessoal • Dados criptografados e somente-leitura
            </p>
          </div>
        </div>

        {/* Ações Superiores */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#161B26] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Ver sessões anteriores"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span className="hidden sm:inline">Histórico</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#161B26] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar conversa em Markdown"
          >
            <span className="material-symbols-outlined text-[16px] text-[#FF8216]">download</span>
            <span className="hidden sm:inline">Relatório</span>
          </button>

          <button
            onClick={handleNewConversation}
            className="h-8 px-3 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span className="hidden sm:inline">Nova Conversa</span>
          </button>
        </div>
      </header>

      {/* Histórico Drawer Lateral */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xs md:max-w-sm h-full bg-white dark:bg-[#12161F] border-l border-slate-200 dark:border-[#262E3D] p-5 flex flex-col gap-4 z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#262E3D] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF8216]">history</span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Histórico de Conversas
                  </h3>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {savedSessions.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 text-center">
                    Nenhuma conversa anterior salva neste navegador.
                  </p>
                ) : (
                  savedSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        currentSessionIdRef.current = session.id;
                        setChatMessages(session.messages);
                        setIsHistoryOpen(false);
                      }}
                      className="p-3 rounded-xl border border-slate-200 dark:border-[#262E3D] hover:border-[#FF8216]/50 bg-slate-50 dark:bg-[#0E121A] text-left flex flex-col gap-1 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {session.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(session.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Área Central de Mensagens */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 md:px-8 md:py-6 flex flex-col gap-4 max-w-4xl mx-auto w-full"
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2.5 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/25 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <span className="material-symbols-outlined text-[#FF8216] text-[18px]">
                    auto_awesome
                  </span>
                </div>
              )}

              <div
                className={`border rounded-2xl px-4 py-3 md:px-5 md:py-3.5 max-w-[92%] sm:max-w-[85%] shadow-sm flex flex-col gap-2 ${
                  msg.role === "user"
                    ? "bg-[#FF8216] text-white border-[#FF8216] rounded-tr-sm"
                    : "bg-white dark:bg-[#12161F] border-slate-200 dark:border-[#262E3D] rounded-tl-sm text-slate-900 dark:text-[#F8FAFC]"
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
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-400 dark:text-[#94A3B8]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-[#FF8216]">
                        bolt
                      </span>
                      {msg.modelUsed === "gemini-3.5-flash-lite"
                        ? "3.5 Flash Lite"
                        : msg.modelUsed === "gemini-3.8-flash"
                        ? "3.8 Flash"
                        : msg.modelUsed === "gemini-4-argon"
                        ? "4 Argon"
                        : msg.modelUsed}
                    </span>
                    <span className="text-[10px]">
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

        {/* Indicador de Digitação Elegante (Zero Ícones Gigantes) */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 max-w-[85%]"
          >
            <div className="w-8 h-8 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#FF8216] text-[18px]">
                auto_awesome
              </span>
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] text-xs text-slate-600 dark:text-[#94A3B8] flex items-center gap-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Kitsune IA está analisando seu patrimônio...
              </span>
            </div>
          </motion.div>
        )}

        {isTranscribingAudio && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/25 text-xs text-[#FF8216] font-semibold self-center">
            <Spinner size={14} className="text-[#FF8216]" />
            <span>Processando áudio com Whisper...</span>
          </div>
        )}

        <div ref={messagesEndRef} className="h-2 shrink-0" />
      </div>

      {/* Pílulas de Perguntas Sugeridas (Injetam no Input sem Enviar Direto) */}
      <div className="px-3 md:px-8 max-w-4xl mx-auto w-full pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#FF8216]">
              lightbulb
            </span>
            Sugestões:
          </span>
          {SUGGESTED_QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectSuggestedPrompt(item.query)}
              className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#12161F] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] hover:border-[#FF8216]/50 text-slate-700 dark:text-[#F8FAFC] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer active:scale-95 shadow-xs"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Caixa de Entrada Inferior */}
      <div className="p-3 md:p-4 bg-white dark:bg-[#0B0E14] border-t border-slate-200 dark:border-[#262E3D] z-20 shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto bg-slate-50 dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] focus-within:border-[#FF8216] rounded-2xl p-2.5 md:p-3 shadow-md flex flex-col gap-2 transition-colors"
        >
          {/* Badges de Contexto Anexados */}
          {attachedContexts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-1 pt-0.5">
              <span className="text-[10px] uppercase font-bold text-[#FF8216] tracking-wider pl-1">
                Contexto:
              </span>
              {attachedContexts.map((ctxId) => {
                const item = CONTEXT_ATTACHMENTS.find((c) => c.id === ctxId);
                if (!item) return null;
                return (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF8216]/12 border border-[#FF8216]/30 text-xs text-[#FF8216] font-semibold"
                  >
                    <span className="material-symbols-outlined text-[14px]">
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
                      className="hover:opacity-75 transition-opacity cursor-pointer ml-1"
                      title="Remover anexo"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        close
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Campo de Texto */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              isListening
                ? "Gravando sua dúvida... Fale e clique no microfone para enviar"
                : attachedContexts.length > 0
                ? "Digite sua pergunta com esse contexto anexado..."
                : "Pergunte à Kitsune IA sobre seu saldo, faturas ou despesas..."
            }
            className="w-full px-2 py-1 bg-transparent border-none outline-none resize-none text-slate-900 dark:text-[#F8FAFC] text-sm placeholder:text-slate-400 dark:placeholder:text-[#94A3B8]/60 max-h-32 overflow-y-auto"
          />

          {/* Barra de Ações: [+] Anexar | Escopo | Microfone | Modelo | Enviar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-[#262E3D]/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Botão [+] Anexar Contexto */}
              <div ref={attachRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachOpen((prev) => !prev);
                    setIsModelOpen(false);
                    setIsScopeOpen(false);
                  }}
                  title="Anexar bloco de contexto financeiro"
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isAttachOpen || attachedContexts.length > 0
                      ? "bg-[#FF8216]/20 border-[#FF8216]/50 text-[#FF8216]"
                      : "bg-white dark:bg-[#1A202C] hover:bg-slate-100 dark:hover:bg-[#222A3A] border-slate-200 dark:border-[#262E3D] text-slate-600 dark:text-[#94A3B8]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                </button>

                {isAttachOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-72 bg-white dark:bg-[#141A24] border border-slate-200 dark:border-[#262E3D] rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-50">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Anexar ao Prompt
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
                          className={`w-full px-3 py-2 rounded-xl text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                            isAttached
                              ? "bg-[#FF8216]/15 text-[#FF8216]"
                              : "hover:bg-slate-100 dark:hover:bg-[#1C2331] text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isAttached
                                ? "bg-[#FF8216] text-white"
                                : "bg-[#FF8216]/15 text-[#FF8216]"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {item.icon}
                            </span>
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-semibold truncate">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-tight">
                              {item.description}
                            </span>
                          </div>
                          {isAttached && (
                            <span className="material-symbols-outlined text-[16px] text-[#FF8216]">
                              check
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seletor de Escopo */}
              <div ref={scopeRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsScopeOpen((prev) => !prev);
                    setIsAttachOpen(false);
                    setIsModelOpen(false);
                  }}
                  className="h-8 px-2.5 rounded-xl bg-white dark:bg-[#1A202C] hover:bg-slate-100 dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-xs font-medium text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#FF8216]">
                    {selectedScope === "personal" ? "person" : "groups"}
                  </span>
                  <span className="max-w-[110px] truncate text-[11px]">
                    {scopeBadgeLabel}
                  </span>
                </button>

                {isScopeOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-56 bg-white dark:bg-[#141A24] border border-slate-200 dark:border-[#262E3D] rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScope("personal");
                        setIsScopeOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs cursor-pointer ${
                        selectedScope === "personal"
                          ? "bg-[#FF8216]/15 text-[#FF8216] font-semibold"
                          : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2331]"
                      }`}
                    >
                      Meu Patrimônio Pessoal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScope("all");
                        setIsScopeOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs cursor-pointer ${
                        selectedScope === "all"
                          ? "bg-[#FF8216]/15 text-[#FF8216] font-semibold"
                          : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2331]"
                      }`}
                    >
                      Consolidado Familiar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Microfone + Seletor de Modelo + Enviar */}
            <div className="flex items-center gap-1.5">
              {/* Microfone */}
              <button
                type="button"
                onClick={toggleVoiceRecognition}
                title={isListening ? "Parar gravação" : "Falar mensagem por voz"}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-white dark:bg-[#1A202C] hover:bg-slate-100 dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-slate-600 dark:text-[#94A3B8] hover:text-[#FF8216]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isListening ? "mic_off" : "mic"}
                </span>
              </button>

              {/* Seletor de Modelo */}
              <div ref={modelRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelOpen((prev) => !prev);
                    setIsAttachOpen(false);
                    setIsScopeOpen(false);
                  }}
                  className="h-8 px-2.5 rounded-xl bg-white dark:bg-[#1A202C] hover:bg-slate-100 dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-xs font-medium text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-semibold text-[#FF8216] truncate max-w-[90px] sm:max-w-none">
                    {currentModelObj.name}
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-slate-400">
                    expand_more
                  </span>
                </button>

                {isModelOpen && (
                  <div className="absolute bottom-full right-0 mb-2.5 w-64 bg-white dark:bg-[#141A24] border border-slate-200 dark:border-[#262E3D] rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-50">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Modelo do Assistente
                    </div>
                    {KITSUNE_AI_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedAiModel(m.id);
                          setIsModelOpen(false);
                        }}
                        className={`w-full p-2 rounded-xl text-left flex items-start justify-between cursor-pointer ${
                          selectedAiModel === m.id
                            ? "bg-[#FF8216]/15 text-[#FF8216] font-semibold"
                            : "hover:bg-slate-100 dark:hover:bg-[#1C2331] text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs">{m.name}</span>
                          <span className="text-[10px] text-slate-400">{m.subtitle}</span>
                        </div>
                        {selectedAiModel === m.id && (
                          <span className="material-symbols-outlined text-[15px] text-[#FF8216]">
                            check
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && attachedContexts.length === 0)}
                className="w-8 h-8 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">
                  arrow_upward
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
