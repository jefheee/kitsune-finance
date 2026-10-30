"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
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
    investments,
    loans,
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
  const [thinkingStep, setThinkingStep] = useState<number>(0);

  // Etapas de raciocínio da Kitsune AI progressivas e lineares (sem repetição de loop falso)
  const THINKING_STEPS = [
    { id: 1, icon: "search", title: "Inspecionando Contexto & Contas", detail: "Carregando saldos e instituições Open Finance conectadas..." },
    { id: 2, icon: "account_balance", title: "Cruzando Faturas & Transações", detail: "Conciliando lançamentos recentes, parcelas e fluxo de caixa..." },
    { id: 3, icon: "security", title: "Auditando Indicadores & Riscos", detail: "Verificando limites de cartão, liquidez e métricas macroeconômicas..." },
    { id: 4, icon: "auto_awesome", title: "Sintetizando Estratégia Patrimonial", detail: "Formulando recomendações práticas com inteligência financeira..." },
  ];

  useEffect(() => {
    if (!isLoading) {
      setThinkingStep(0);
      return;
    }
    const t1 = setTimeout(() => setThinkingStep(1), 1200);
    const t2 = setTimeout(() => setThinkingStep(2), 2600);
    const t3 = setTimeout(() => setThinkingStep(3), 4200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isLoading]);

  // Mouse-Drag fluido para a barra de sugestões
  const isDraggingSuggestions = useRef(false);
  const startXSuggestions = useRef(0);
  const scrollLeftSuggestions = useRef(0);
  const hasMovedSuggestions = useRef(false);

  const handleSuggestionsMouseDown = (e: React.MouseEvent) => {
    if (!suggestionsScrollRef.current) return;
    isDraggingSuggestions.current = true;
    hasMovedSuggestions.current = false;
    startXSuggestions.current = e.pageX - suggestionsScrollRef.current.offsetLeft;
    scrollLeftSuggestions.current = suggestionsScrollRef.current.scrollLeft;
  };

  const handleSuggestionsMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingSuggestions.current || !suggestionsScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - suggestionsScrollRef.current.offsetLeft;
    const walk = (x - startXSuggestions.current) * 1.6;
    if (Math.abs(walk) > 4) {
      hasMovedSuggestions.current = true;
    }
    suggestionsScrollRef.current.scrollLeft = scrollLeftSuggestions.current - walk;
  };

  const handleSuggestionsMouseUpOrLeave = () => {
    isDraggingSuggestions.current = false;
  };

  // Imagem anexada para Kitsune Vision integrada
  const [attachedImage, setAttachedImage] = useState<{
    mimeType: string;
    data: string;
    previewUrl: string;
    name?: string;
  } | null>(null);

  // Estados de Câmera WebRTC ao vivo
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Anexos de Contexto selecionados
  const [attachedContexts, setAttachedContexts] = useState<string[]>([]);

  // Estados dos Popovers na Barra Inferior
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isReasoningSubmenuOpen, setIsReasoningSubmenuOpen] = useState(false);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Microfone (Entrada de Voz com Análise Responsiva e Visualizador de Ondas Sonoras)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([0.2, 0.4, 0.7, 0.4, 0.3]);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Sessões de Chat (Histórico Persistente)
  const [savedSessions, setSavedSessions] = useState<ChatSession[]>([]);
  const currentSessionIdRef = useRef<string>(`session-${Date.now()}`);

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const isAtBottomRef = useRef<boolean>(true);

  const attachRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const suggestionsScrollRef = useRef<HTMLDivElement>(null);

  const scrollSuggestions = (direction: "left" | "right") => {
    if (suggestionsScrollRef.current) {
      const offset = direction === "left" ? -280 : 280;
      suggestionsScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };
  const scopeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega histórico de conversas isolado por usuário
  const loadSessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          const formatted: ChatSession[] = data.sessions.map((s: any) => ({
            id: s.id,
            title: s.title || "Conversa com Kitsune AI",
            createdAt: s.created_at,
            messages: [],
          }));
          setSavedSessions(formatted);
          localStorage.setItem(`kitsune_${user.id}_saved_sessions_v2`, JSON.stringify(formatted));
          return;
        }
      }
    } catch (e) {
      console.warn("Não foi possível carregar sessões da API:", e);
    }

    try {
      const stored = localStorage.getItem(`kitsune_${user.id}_saved_sessions_v2`);
      if (stored) {
        setSavedSessions(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Não foi possível carregar sessões anteriores locais:", e);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Salva a conversa atual no histórico quando as mensagens mudam
  useEffect(() => {
    if (!user?.id || chatMessages.length <= 1) return;

    try {
      const firstUserMsg = chatMessages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? "..." : "")
        : "Conversa com Kitsune AI";

      const currentSession: ChatSession = {
        id: currentSessionIdRef.current,
        title,
        createdAt: new Date().toISOString(),
        messages: chatMessages,
      };

      setSavedSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== currentSession.id);
        const updated = [currentSession, ...filtered].slice(0, 20);
        localStorage.setItem(`kitsune_${user.id}_saved_sessions_v2`, JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.warn("Erro ao salvar sessão local:", e);
    }
  }, [chatMessages, user?.id]);

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

  // Compressão de imagem client-side (Canvas 1280px máx, JPEG 0.85)
  const compressAndSetImage = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDim = 1280;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64Data = dataUrl.split(",")[1];
          setAttachedImage({
            mimeType: "image/jpeg",
            data: base64Data,
            previewUrl: dataUrl,
            name: file.name || "Imagem da Galeria",
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn("Falha ao processar imagem:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressAndSetImage(file);
    }
  };

  // Câmera WebRTC ao vivo
  const startCamera = async (facing: "environment" | "user" = "environment") => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn("Não foi possível acessar a câmera:", err);
      alert("Acesso à câmera não disponível ou bloqueado. Por favor, escolha da galeria.");
      setIsCameraOpen(false);
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64Data = dataUrl.split(",")[1];

    setAttachedImage({
      mimeType: "image/jpeg",
      data: base64Data,
      previewUrl: dataUrl,
      name: "Foto da Câmera (Kitsune Vision)",
    });
    stopCamera();
  };

  // Captura parâmetros de URL (?prompt=... ou ?action=vision)
  const isHandledParamRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || isHandledParamRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const promptParam = params.get("prompt");
    const actionParam = params.get("action");

    if (promptParam) {
      isHandledParamRef.current = true;
      setInput(promptParam);
      const timer = setTimeout(() => {
        sendMessage(promptParam);
      }, 500);
      return () => clearTimeout(timer);
    }

    if (actionParam === "vision") {
      isHandledParamRef.current = true;
      startCamera("environment");
    }
  }, []);

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

  // Sugestões Dinâmicas de Alto Valor Agregado geradas com base no perfil financeiro real do usuário
  const dynamicSuggestions = useMemo(() => {
    const list: Array<{ id: string; category: string; icon: string; label: string; query: string }> = [];

    const creditAccs = accounts.filter((a) => a.type === "CREDIT" || a.subtype === "CREDIT_CARD");
    const totalCredit = creditAccs.reduce((sum, a) => sum + Math.abs(Number(a.balance) || 0), 0);
    const liquidAccs = accounts.filter((a) => a.type !== "CREDIT" && a.subtype !== "CREDIT_CARD");
    const totalLiquid = liquidAccs.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    // 1. Agente Kuro (Supérfluos e Compras por Impulso)
    list.push({
      id: "agent_kuro",
      category: "Kuro 😾",
      icon: "warning",
      label: "Kuro: Vale a pena o que gastei com delivery e supérfluos?",
      query: "Kuro, analise minhas compras com delivery, lazer e supérfluos deste mês. Seja sincero: o que eu deveria cortar imediatamente?",
    });

    // 2. Agente Daiko (Rendimento & Dinheiro Parado)
    if (totalLiquid > 500) {
      list.push({
        id: "agent_daiko",
        category: "Daiko 🎩",
        icon: "savings",
        label: `Daiko: Quanto meus ${formatCurrency(totalLiquid)} parados renderiam?`,
        query: `Daiko, tenho ${formatCurrency(totalLiquid)} parados em conta corrente. Quanto estou perdendo por não investir no CDI/Selic e qual melhor alocação para hoje?`,
      });
    }

    // 3. Agente Kenji (Detetive de Extrato & Estabelecimentos Estranhos)
    list.push({
      id: "agent_kenji",
      category: "Kenji 🐱‍👓",
      icon: "search",
      label: "Kenji: Audite meu extrato recente e aponte anomalias",
      query: "Kenji, examine minhas últimas transações e aponte compras estranhas, horários fora do comum ou estabelecimentos com nomes misteriosos.",
    });

    // 4. Agente Kage (Cobranças Duplicadas e Tarifas Ocultas)
    list.push({
      id: "agent_kage",
      category: "Kage 🕵️‍♂️",
      icon: "find_in_page",
      label: "Kage: Rastreie cobranças duplicadas ou tarifas bancárias",
      query: "Kage, varra meu extrato e identifique se fui cobrado em duplicidade na mesma data ou se há tarifas bancárias abusivas para estornar.",
    });

    // 5. Agente Ren (Ritmo Diário & Burn Rate)
    list.push({
      id: "agent_ren",
      category: "Ren ⚡",
      icon: "speed",
      label: "Ren: Qual meu ritmo de gastos diário até o fim do mês?",
      query: "Ren, calcule minha velocidade diária de gastos (burn rate) e me diga se meu saldo vai aguentar com folga até o último dia do mês.",
    });

    // 6. Faturas de Cartão e Folga de Caixa
    if (totalCredit > 0) {
      const topCard = creditAccs[0];
      const cardBank = topCard?.institution_name || topCard?.bank_name || "cartão";
      list.push({
        id: "cartao_folga",
        category: "Cartão 💳",
        icon: "credit_card",
        label: `Como quitar fatura de ${formatCurrency(totalCredit)} no ${cardBank}?`,
        query: `Tenho uma fatura atual de ${formatCurrency(totalCredit)} no ${cardBank} e saldo de ${formatCurrency(totalLiquid)} em conta. Como fica minha margem líquida após pagar?`,
      });
    }

    // 7. Assinaturas e Recorrências
    const subs = transactions.filter((t) => t.is_subscription);
    if (subs.length > 0) {
      const subNames = Array.from(new Set(subs.map((s) => s.clean_description || s.description))).slice(0, 3).join(", ");
      list.push({
        id: "subs_corte",
        category: "Assinaturas 🔄",
        icon: "sync",
        label: `Auditar ${subs.length} assinaturas (${subNames})`,
        query: `Detectei ${subs.length} cobranças recorrentes ativas (${subNames}). Qual o impacto anual dessas assinaturas e onde posso economizar?`,
      });
    }

    // 8. Compras Parceladas
    const installments = transactions.filter((t) => t.total_installments && t.total_installments > 1);
    if (installments.length > 0) {
      list.push({
        id: "parcelas_futuras",
        category: "Parcelas 📅",
        icon: "date_range",
        label: `Quando termino de pagar minhas ${installments.length} compras parceladas?`,
        query: `Audite minhas ${installments.length} compras parceladas ativas. Quanto ainda tenho que pagar nos próximos meses até quitar tudo?`,
      });
    }

    // 9. Meta Patrimonial Cadastrada
    if (userProfile?.financial_goal) {
      list.push({
        id: "meta_estrategia",
        category: "Meta 🎯",
        icon: "flag",
        label: `Plano prático para: "${userProfile.financial_goal}"`,
        query: `Meu principal objetivo patrimonial cadastrado é "${userProfile.financial_goal}". Desenhe um plano prático com missões mensais para eu alcançar essa meta mais rápido.`,
      });
    }

    // 10. Raio-X Patrimonial 360°
    list.push({
      id: "raio_x_completo",
      category: "Raio-X 📊",
      icon: "analytics",
      label: `Raio-X 360° da minha saúde financeira`,
      query: `Faça uma auditoria completa e sem rodeios de todos os meus bancos, faturas e investimentos. O que estou fazendo certo e qual meu maior risco financeiro hoje?`,
    });

    return list;
  }, [accounts, transactions, investments, userProfile?.financial_goal, formatCurrency]);

  // Visualizador de Ondas Sonoras em Tempo Real (Web Audio API)
  const startAudioVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderFrame = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Amostra 5 faixas espectrais com bounce suave
        const l1 = Math.max(0.2, (dataArray[1] || 0) / 255);
        const l2 = Math.max(0.35, (dataArray[3] || 0) / 255);
        const l3 = Math.max(0.5, (dataArray[5] || 0) / 255);
        const l4 = Math.max(0.35, (dataArray[7] || 0) / 255);
        const l5 = Math.max(0.2, (dataArray[9] || 0) / 255);

        setAudioLevels([l1, l2, l3, l4, l5]);
        animFrameRef.current = requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (e) {
      console.warn("Visualizador de áudio não inicializado", e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    setAudioLevels([0.2, 0.4, 0.7, 0.4, 0.3]);
  };

  // Microfone Universal: Suporta Chrome/Edge (Web Speech) e Zen/Firefox (MediaRecorder + Whisper)
  const toggleVoiceRecognition = async () => {
    if (typeof window === "undefined") return;

    if (isListening) {
      // Parar qualquer gravação ativa
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopAudioVisualizer();
      setIsListening(false);
      return;
    }

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert("Seu navegador bloqueou o acesso ao microfone.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      startAudioVisualizer(stream);

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      // Cenário 1: Navegadores com Web Speech nativo
      if (SpeechRecognition) {
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
          stopAudioVisualizer();
          setIsListening(false);
        };

        recognition.onend = () => {
          stopAudioVisualizer();
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        return;
      }

      // Cenário 2: Zen Browser, Firefox e outros (Grava e envia pro Whisper)
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopAudioVisualizer();
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
      stopAudioVisualizer();
      setIsListening(false);
    }
  };

  // Sugestões de Perguntas: Dispara automaticamente para a IA se o campo estiver vazio,
  // ou anexa ao texto caso o usuário já esteja digitando algo na caixa de texto.
  const handleSelectSuggestedPrompt = (query: string) => {
    const currentInputTrimmed = input.trim();
    if (currentInputTrimmed.length === 0) {
      // Caixa vazia: envia imediatamente para a IA
      sendMessage(query);
    } else {
      // Já contém texto: anexa ao conteúdo sem enviar automaticamente
      setInput((prev) => `${prev.trim()}\n\n${query}`);
      textareaRef.current?.focus();
    }
  };

  const sendMessage = async (customPrompt?: string) => {
    const rawText = typeof customPrompt === "string" ? customPrompt : input;
    const trimmed = rawText.trim();
    const currentAttachments = [...attachedContexts];
    const imageToSend = attachedImage;

    if (!trimmed && currentAttachments.length === 0 && !imageToSend) return;
    if (isLoading) return;

    let displayMessage = trimmed;
    if (!displayMessage && currentAttachments.length > 0) {
      displayMessage = currentAttachments
        .map((id) => CONTEXT_ATTACHMENTS.find((c) => c.id === id)?.label)
        .filter(Boolean)
        .join(" + ");
    }
    if (!displayMessage && imageToSend) {
      displayMessage = "📷 [Imagem Anexada] Analisar no contexto do meu patrimônio e histórico financeiro";
    }

    const userMsg: any = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: displayMessage,
      timestamp: new Date().toISOString(),
      imagePreview: imageToSend?.previewUrl,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedContexts([]);
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const historyPayload = chatMessages.slice(-8).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content,
      }));

      const isBackendSession = currentSessionIdRef.current && !currentSessionIdRef.current.startsWith("session-");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: isBackendSession ? currentSessionIdRef.current : undefined,
          message: trimmed || displayMessage,
          attachedContexts: currentAttachments,
          model: selectedAiModel,
          reasoningLevel,
          familyMemberId: selectedScope,
          history: historyPayload,
          images: imageToSend ? [{ mimeType: imageToSend.mimeType, data: imageToSend.data }] : [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro na resposta da Kitsune AI");
      }

      if (data.sessionId) {
        currentSessionIdRef.current = data.sessionId;
      }

      const fullText = data.message || "";
      const assistantMsgId = `assistant-${Date.now()}`;
      setStreamingMessageId(assistantMsgId);
      setIsLoading(false);

      // Inicia a resposta vazia e preenche suavemente (Efeito Typewriter Fluido)
      setChatMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant" as const,
          content: "",
          timestamp: new Date().toISOString(),
          modelUsed: data.modelUsed,
        },
      ]);

      const words = fullText.split(" ");
      let currentIdx = 0;
      let buffer = "";

      const streamTimer = setInterval(() => {
        if (currentIdx >= words.length) {
          clearInterval(streamTimer);
          setStreamingMessageId(null);
          return;
        }
        const chunk = words.slice(currentIdx, currentIdx + 3).join(" ") + (currentIdx + 3 < words.length ? " " : "");
        buffer += (buffer.length > 0 && !buffer.endsWith(" ") ? " " : "") + chunk;
        currentIdx += 3;

        setChatMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: buffer } : m))
        );
      }, 30);
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
      `# Relatório de Consultoria Financeira - Kitsune AI`,
      `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
      `Usuário: ${userProfile?.display_name || user?.email || "Titular"}`,
      `Patrimônio Líquido: ${formatCurrency(financialSummary.netWorth)}`,
      `Fatura Cartões: ${formatCurrency(financialSummary.credit)}`,
      `\n---\n`,
      ...chatMessages.map(
        (m) =>
          `### ${m.role === "assistant" ? "Kitsune AI" : "Você"} (${new Date(m.timestamp).toLocaleTimeString("pt-BR")}):\n${m.content}\n`
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
      ? "Espaço Compartilhado"
      : familyMembers.find((m) => m.id === selectedScope)?.name || "Membro";

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-dvh w-full max-w-full overflow-hidden bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-[#F8FAFC] font-sans">
      {/* Top Header */}
      <header className="px-3 md:px-8 py-2.5 md:py-3.5 border-b border-slate-200 dark:border-[#27272A] bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/25 flex items-center justify-center text-[#FF8216] shrink-0">
            <span className="material-symbols-outlined text-lg md:text-xl">auto_awesome</span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Kitsune AI
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] truncate hidden sm:block">
              Consultoria Patrimonial Pessoal & Estratégia de Ativos
            </p>
          </div>
        </div>

        {/* Ações Superiores */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-[#18181B] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Ver sessões anteriores"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span className="hidden sm:inline">Histórico</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-[#18181B] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
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
              className="relative w-full max-w-xs md:max-w-sm h-full bg-white dark:bg-[#121214] border-l border-slate-200 dark:border-[#27272A] p-5 flex flex-col gap-4 z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#27272A] pb-3">
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
                    Nenhuma conversa anterior salva.
                  </p>
                ) : (
                  savedSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={async () => {
                        currentSessionIdRef.current = session.id;
                        try {
                          const res = await fetch(`/api/chat?sessionId=${session.id}`);
                          if (res.ok) {
                            const data = await res.json();
                            if (Array.isArray(data.messages) && data.messages.length > 0) {
                              setChatMessages(
                                data.messages.map((m: any) => ({
                                  id: m.id,
                                  role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
                                  content: m.content,
                                  timestamp: m.created_at || new Date().toISOString(),
                                }))
                              );
                              setIsHistoryOpen(false);
                              return;
                            }
                          }
                        } catch (e) {
                          console.warn("Erro ao buscar mensagens do servidor:", e);
                        }
                        if (session.messages && session.messages.length > 0) {
                          setChatMessages(session.messages);
                        }
                        setIsHistoryOpen(false);
                      }}
                      className="group p-3 rounded-xl border border-slate-200 dark:border-[#27272A] hover:border-[#FF8216]/50 bg-slate-50 dark:bg-[#18181B] text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
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
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await fetch(`/api/chat?sessionId=${session.id}`, { method: 'DELETE' });
                            setSavedSessions((prev) => {
                              const updated = prev.filter((s) => s.id !== session.id);
                              if (user?.id) {
                                localStorage.setItem(`kitsune_${user.id}_saved_sessions_v2`, JSON.stringify(updated));
                              }
                              return updated;
                            });
                            if (currentSessionIdRef.current === session.id) {
                              handleNewConversation();
                            }
                          } catch (err) {
                            console.error("Erro ao deletar sessão:", err);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        title="Excluir conversa"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
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
                    : "bg-white dark:bg-[#121214] border-slate-200 dark:border-[#27272A] rounded-tl-sm text-slate-900 dark:text-[#F8FAFC]"
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
                  <div className="flex flex-col gap-2">
                    {(msg as any).imagePreview && (
                      <div className="rounded-xl overflow-hidden border border-white/20 max-w-[260px] shadow-sm">
                        <img
                          src={(msg as any).imagePreview}
                          alt="Imagem anexada"
                          className="w-full h-auto max-h-56 object-cover"
                        />
                      </div>
                    )}
                    <div className="text-sm leading-relaxed whitespace-pre-line font-medium">
                      {msg.content}
                    </div>
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

        {/* Indicador de Raciocínio em Tempo Real com Etapas Transparentes e Lineares */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2 max-w-xl self-start w-full"
          >
            <div className="p-3.5 md:p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-md flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#27272A]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[15px] animate-spin" style={{ animationDuration: "3s" }}>
                      psychology
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Kitsune AI • Processando Diagnóstico Financeiro
                  </span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#FF8216]/15 text-[#FF8216]">
                  Etapa {thinkingStep + 1} de 4
                </span>
              </div>

              {/* Grid das 4 Etapas Progressivas */}
              <div className="flex flex-col gap-1.5">
                {THINKING_STEPS.map((step, idx) => {
                  const isDone = thinkingStep > idx;
                  const isCurrent = thinkingStep === idx;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2 text-xs transition-colors py-0.5 ${
                        isDone
                          ? "text-emerald-500 font-medium"
                          : isCurrent
                          ? "text-[#FF8216] font-bold"
                          : "text-slate-400 dark:text-zinc-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0">
                        {isDone ? "check_circle" : isCurrent ? "radio_button_checked" : "radio_button_unchecked"}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="truncate">{step.title}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] font-normal truncate hidden sm:inline">
                            — {step.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* Carrossel Dinâmico de Sugestões de Alto Valor Agregado com Navegação por Setas e Mouse-Drag */}
      <div className="px-3 md:px-8 max-w-4xl mx-auto w-full pb-2">
        <div className="relative flex items-center gap-1.5">
          {/* Botão Seta Esquerda (Desktop) */}
          <button
            type="button"
            onClick={() => scrollSuggestions("left")}
            className="hidden md:flex w-7 h-7 rounded-full bg-white dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#18181B] border border-slate-200 dark:border-[#27272A] hover:border-[#FF8216] text-slate-400 hover:text-[#FF8216] items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer active:scale-95 z-10"
            title="Rolar sugestões para a esquerda"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          {/* Container com scroll suave e suporte a Mouse Drag nativo */}
          <div
            ref={suggestionsScrollRef}
            onMouseDown={handleSuggestionsMouseDown}
            onMouseMove={handleSuggestionsMouseMove}
            onMouseUp={handleSuggestionsMouseUpOrLeave}
            onMouseLeave={handleSuggestionsMouseUpOrLeave}
            className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none scroll-smooth flex-1 cursor-grab active:cursor-grabbing select-none"
          >
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 pl-1">
              <span className="material-symbols-outlined text-sm text-[#FF8216]">
                auto_awesome
              </span>
              Sugestões:
            </span>
            {dynamicSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  if (hasMovedSuggestions.current) return;
                  handleSelectSuggestedPrompt(item.query);
                }}
                title="Clique para perguntar diretamente à IA"
                className="group px-3 py-1.5 rounded-full bg-white dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#18181B] border border-slate-200 dark:border-[#27272A] hover:border-[#FF8216]/50 text-slate-700 dark:text-[#F8FAFC] text-xs font-medium transition-all whitespace-nowrap cursor-pointer active:scale-95 shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FF8216]/10 text-[#FF8216] group-hover:bg-[#FF8216] group-hover:text-white transition-colors">
                  {item.category}
                </span>
                <span>{item.label}</span>
                <span className="material-symbols-outlined text-[13px] text-slate-400 group-hover:text-[#FF8216] transition-colors">
                  arrow_forward
                </span>
              </button>
            ))}
          </div>

          {/* Botão Seta Direita (Desktop) */}
          <button
            type="button"
            onClick={() => scrollSuggestions("right")}
            className="hidden md:flex w-7 h-7 rounded-full bg-white dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#18181B] border border-slate-200 dark:border-[#27272A] hover:border-[#FF8216] text-slate-400 hover:text-[#FF8216] items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer active:scale-95 z-10"
            title="Rolar sugestões para a direita"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Caixa de Entrada Inferior */}
      <div className="p-3 md:p-4 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#27272A] z-20 shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] focus-within:border-[#FF8216] rounded-2xl p-2.5 md:p-3 shadow-md flex flex-col gap-2 transition-colors"
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

          {/* Banner de Feedback em Tempo Real da Gravação de Voz */}
          {isListening && (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2 mb-2 rounded-xl bg-[#FF8216]/10 border border-[#FF8216]/30 text-[#FF8216] transition-all">
              <div className="flex items-center gap-2.5">
                {/* 5 Barras de Equalizador Dinâmico com Web Audio API */}
                <div className="flex items-end gap-1 h-5 px-0.5">
                  {audioLevels.map((lvl, idx) => (
                    <span
                      key={idx}
                      style={{ height: `${Math.max(4, Math.round(lvl * 20))}px` }}
                      className="w-1 bg-[#FF8216] rounded-full transition-all duration-75"
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold">
                  Ouvindo... Fale normalmente sua dúvida
                </span>
              </div>
              <button
                type="button"
                onClick={toggleVoiceRecognition}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-white shadow-xs transition-colors cursor-pointer"
              >
                Parar
              </button>
            </div>
          )}

          {isTranscribingAudio && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-slate-700 dark:text-slate-300 text-xs">
              <Spinner size={13} className="text-[#FF8216]" />
              <span>Transcrevendo áudio com IA Whisper...</span>
            </div>
          )}

          {/* Preview da Imagem Anexada (Kitsune Vision) */}
          {attachedImage && (
            <div className="flex items-center gap-2.5 p-2 bg-[#FF8216]/10 border border-[#FF8216]/30 rounded-xl mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage.previewUrl}
                alt="Preview"
                className="w-12 h-12 rounded-lg object-cover border border-[#FF8216]/40 shrink-0"
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-bold text-[#FF8216] truncate">
                  {attachedImage.name || "Imagem Anexada (Kitsune Vision)"}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                  Foto pronta para análise multimodal com IA
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Remover imagem"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
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
                ? "Ouvindo sua voz... Fale agora."
                : attachedImage
                ? "Digite instruções para a análise da foto (ex: horas de trabalho, juros, cardápio)..."
                : attachedContexts.length > 0
                ? "Digite sua pergunta com esse contexto anexado..."
                : "Pergunte à Kitsune AI sobre seu saldo, faturas ou envie fotos de compras/cardápios..."
            }
            className="w-full px-2 py-1 bg-transparent border-none outline-none resize-none text-slate-900 dark:text-[#F8FAFC] text-sm placeholder:text-slate-400 dark:placeholder:text-[#94A3B8]/60 max-h-32 overflow-y-auto"
          />

          {/* Barra de Ações: [+] Anexar | Escopo | Microfone | Modelo | Enviar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-[#27272A]/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Botão [+] Anexar Contexto ou Imagem */}
              <div ref={attachRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachOpen((prev) => !prev);
                    setIsModelOpen(false);
                    setIsScopeOpen(false);
                  }}
                  title="Anexar foto da câmera, galeria ou bloco de contexto financeiro"
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isAttachOpen || attachedContexts.length > 0 || attachedImage
                      ? "bg-[#FF8216]/20 border-[#FF8216]/50 text-[#FF8216]"
                      : "bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#27272A] border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-[#94A3B8]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                </button>

                {isAttachOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-80 max-h-96 overflow-y-auto bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-2xl p-2.5 flex flex-col gap-1.5 z-50">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FF8216]">
                      Kitsune Vision • Multimodal
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachOpen(false);
                          startCamera("environment");
                        }}
                        className="p-2.5 rounded-xl bg-[#FF8216]/10 hover:bg-[#FF8216]/20 text-[#FF8216] border border-[#FF8216]/25 flex flex-col items-center gap-1 text-center transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xl">photo_camera</span>
                        <span className="text-[11px] font-bold">Tirar Foto Agora</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#27272A] hover:bg-slate-200 dark:hover:bg-[#323238] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 flex flex-col items-center gap-1 text-center transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xl">photo_library</span>
                        <span className="text-[11px] font-bold">Escolher da Galeria</span>
                      </button>
                    </div>

                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Modos Rápidos com Imagem
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachOpen(false);
                        setInput("Estou enviando a foto deste cardápio. Analise os pratos com melhor custo-benefício e compare com minha média de gastos com alimentação.");
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#27272A] text-slate-800 dark:text-slate-100"
                    >
                      <span className="p-1.5 rounded-lg bg-[#FF8216]/10 text-[#FF8216] material-symbols-outlined text-sm">restaurant_menu</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold">Cardápio de Restaurante</span>
                        <span className="text-[10px] text-slate-400">Compara preços e indica opções inteligentes</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachOpen(false);
                        setInput("Estou considerando comprar este produto. Calcule com precisão quantas horas de trabalho minhas ele custa com base na minha renda mensal e me diga se cabe no meu saldo livre.");
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#27272A] text-slate-800 dark:text-slate-100"
                    >
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 material-symbols-outlined text-sm">schedule</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold">Produto ou Etiqueta (Horas de Trabalho)</span>
                        <span className="text-[10px] text-slate-400">Calcula esforço de trabalho e anti-impulso</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachOpen(false);
                        setInput("Audite esta proposta de financiamento de imóvel ou carro: taxa de juros CET real, custo total dos juros e se a parcela compromete mais de 30% da minha renda mensal.");
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#27272A] text-slate-800 dark:text-slate-100"
                    >
                      <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 material-symbols-outlined text-sm">home</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold">Simulação de Casa ou Carro</span>
                        <span className="text-[10px] text-slate-400">Auditoria CET, SAC vs Price e regra dos 30%</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachOpen(false);
                        setInput("Audite esta nota fiscal / comprovante de pagamento: verifique valores, tributos e taxas embutidas.");
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left transition-colors flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#27272A] text-slate-800 dark:text-slate-100"
                    >
                      <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 material-symbols-outlined text-sm">receipt</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold">Nota Fiscal ou Comprovante</span>
                        <span className="text-[10px] text-slate-400">Verifica taxas e conciliação bancária</span>
                      </div>
                    </button>

                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                      Blocos de Contexto Financeiro
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
                              : "hover:bg-slate-100 dark:hover:bg-[#27272A] text-slate-800 dark:text-slate-100"
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
                  className="h-8 px-2.5 rounded-xl bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#27272A] border border-slate-200 dark:border-[#27272A] text-xs font-medium text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#FF8216]">
                    {selectedScope === "personal" ? "person" : "groups"}
                  </span>
                  <span className="max-w-[110px] truncate text-[11px]">
                    {scopeBadgeLabel}
                  </span>
                </button>

                {isScopeOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-56 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScope("personal");
                        setIsScopeOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs cursor-pointer ${
                        selectedScope === "personal"
                          ? "bg-[#FF8216]/15 text-[#FF8216] font-semibold"
                          : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#27272A]"
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
                          : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#27272A]"
                      }`}
                    >
                      Espaço Compartilhado
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
                    ? "bg-[#FF8216] text-white shadow-sm ring-2 ring-[#FF8216]/40 scale-105"
                    : "bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#27272A] border border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-[#94A3B8] hover:text-[#FF8216]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isListening ? "graphic_eq" : "mic"}
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
                  className="h-8 px-2.5 rounded-xl bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#27272A] border border-slate-200 dark:border-[#27272A] text-xs font-medium text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-semibold text-[#FF8216] truncate max-w-[90px] sm:max-w-none">
                    {currentModelObj.name}
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-slate-400">
                    expand_more
                  </span>
                </button>

                {isModelOpen && (
                  <div className="absolute bottom-full right-0 mb-2.5 w-64 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-50">
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
                            : "hover:bg-slate-100 dark:hover:bg-[#27272A] text-slate-800 dark:text-slate-200"
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
                disabled={isLoading || (!input.trim() && attachedContexts.length === 0 && !attachedImage)}
                className="w-8 h-8 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">
                  arrow_upward
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Input invisível para seleção de arquivo da galeria */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal Câmera WebRTC ao Vivo (Kitsune Vision) */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-lg flex items-center justify-between text-white pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF8216]">photo_camera</span>
                <span className="text-sm font-bold">Kitsune Vision • Captura ao Vivo</span>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="relative w-full max-w-lg flex-1 my-3 bg-black rounded-3xl overflow-hidden flex items-center justify-center border border-white/20 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            <div className="w-full max-w-lg flex items-center justify-around pb-2">
              <button
                type="button"
                onClick={() => {
                  const nextFacing = cameraFacing === "environment" ? "user" : "environment";
                  setCameraFacing(nextFacing);
                  startCamera(nextFacing);
                }}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Alternar Câmera"
              >
                <span className="material-symbols-outlined text-xl">flip_camera_ios</span>
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-[#FF8216] hover:bg-[#FFA047] active:scale-95 border-4 border-white flex items-center justify-center text-white shadow-lg transition-transform cursor-pointer"
                title="Capturar Foto"
              >
                <span className="material-symbols-outlined text-2xl">camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  fileInputRef.current?.click();
                }}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Escolher da Galeria"
              >
                <span className="material-symbols-outlined text-xl">photo_library</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
