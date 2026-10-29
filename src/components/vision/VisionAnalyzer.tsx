"use client";

import React, { useState, useRef, useEffect } from "react";
import Spinner from "@/components/Spinner";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { ShinyText } from "@/components/react-bits/ShinyText";
import StreamingMarkdown from "@/components/StreamingMarkdown";
import { useFinanceData } from "@/context/FinanceDataContext";

type AnalysisMode = "menu" | "product" | "big_purchase" | "receipt" | "custom";

const SCENARIOS: {
  id: AnalysisMode;
  label: string;
  icon: string;
  desc: string;
  badge: string;
  example: string;
}[] = [
  {
    id: "menu",
    label: "Cardápio de Restaurante",
    icon: "restaurant_menu",
    desc: "Lê pratos e preços, compara com o orçamento de alimentação e sugere opções no orçamento",
    badge: "Alimentação Inteligente",
    example: "Foto da página de pratos principais ou bebidas",
  },
  {
    id: "product",
    label: "Produto ou Etiqueta",
    icon: "shopping_bag",
    desc: "Calcula quantas horas de trabalho custa e se cabe no saldo livre do mês",
    badge: "Anti-Impulso",
    example: "Foto de eletrônico, roupa, calçado ou vitrine",
  },
  {
    id: "big_purchase",
    label: "Simulação Casa ou Carro",
    icon: "home_app_logo",
    desc: "Audita financiamentos, taxa de juros, regra dos 30% e juros totais pagos",
    badge: "Alto Patrimônio",
    example: "Proposta de financiamento imobiliário ou veicular",
  },
  {
    id: "receipt",
    label: "Nota Fiscal ou Comprovante",
    icon: "receipt_long",
    desc: "Audita itens, taxas de serviço ocultas e verifica despesas recorrentes",
    badge: "Auditoria",
    example: "Cupom fiscal de supermercado, farmácia ou posto",
  },
  {
    id: "custom",
    label: "Análise Livre",
    icon: "psychology",
    desc: "Envie qualquer foto financeira e faça perguntas personalizadas",
    badge: "Multimodal",
    example: "Extrato impresso, proposta bancária ou boleto",
  },
];

export function VisionAnalyzer() {
  const { userProfile, accounts, transactions } = useFinanceData();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>("big_purchase");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Câmera ao vivo
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Iniciar Câmera
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Falha ao abrir webcam/câmera:", err);
      setIsCameraActive(false);
      // Fallback para input nativo com capture
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  // Parar Câmera
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Tirar foto do feed de vídeo
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setImagePreview(dataUrl);
    stopCamera();
  };

  // Compressão no cliente para economizar tokens e acelerar upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setImagePreview(compressed);
          setAnalysisResult(null);
          setError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Enviar para Análise com IA
  const handleAnalyze = async () => {
    if (!imagePreview) {
      setError("Envie ou tire uma foto primeiro.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const res = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          analysisType: selectedMode,
          customPrompt,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Falha ao analisar imagem com IA.");
      }

      setAnalysisResult(json.data);
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao processar a imagem.");
    } finally {
      setIsLoading(false);
    }
  };

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-12 select-none">
      {/* Header com Estética Pierre / Kitsune */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </span>
            <ShinyText
              text="Kitsune Vision"
              className="text-2xl md:text-3xl font-extrabold tracking-tight"
            />
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8] mt-1 max-w-xl">
            Inteligência multimodal treinada com suas contas e patrimônio. Tire fotos na hora ou envie da galeria para cardápios, compras, recibos e simulações complexas de bens.
          </p>
        </div>

        {/* Input Oculto de Arquivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Grid de Seleção de Cenários */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SCENARIOS.map((sc) => {
          const isSelected = selectedMode === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => setSelectedMode(sc.id)}
              className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-[#FF8216]/10 border-[#FF8216] text-[#FF8216] ring-1 ring-[#FF8216]"
                  : "bg-white/60 dark:bg-[#121214]/80 border-slate-200 dark:border-[#27272A] text-slate-700 dark:text-[#94A3B8] hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="material-symbols-outlined text-[22px]">{sc.icon}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
                  {sc.badge}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                {sc.label}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-[#64748B] mt-1 line-clamp-2">
                {sc.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Área de Captura & Preview */}
      <SpotlightCard className="p-6 md:p-8 flex flex-col items-center justify-center">
        {isCameraActive ? (
          /* Câmera Ao Vivo */
          <div className="relative w-full max-w-lg aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-[#FF8216]/40 shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 z-20">
              <button
                type="button"
                onClick={captureSnapshot}
                className="w-14 h-14 rounded-full bg-white border-4 border-[#FF8216] shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="Tirar Foto"
              >
                <div className="w-8 h-8 rounded-full bg-[#FF8216]" />
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-bold hover:bg-black/80 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : imagePreview ? (
          /* Preview da Imagem Selecionada */
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="relative w-full max-w-md max-h-[380px] rounded-2xl overflow-hidden border border-slate-200 dark:border-[#27272A] shadow-lg group">
              <img
                src={imagePreview}
                alt="Foto para Análise"
                className="w-full h-auto max-h-[380px] object-contain bg-slate-950"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setAnalysisResult(null);
                }}
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/70 backdrop-blur-md text-white hover:bg-rose-600 transition-colors cursor-pointer"
                title="Remover Imagem"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Input para pergunta adicional */}
            <div className="w-full max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Instrução adicional (opcional, ex: 'Posso dar R$ 20k de entrada?')"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#FF8216]"
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-[18px] text-slate-400">
                  edit_note
                </span>
              </div>
            </div>

            {/* Botão de Análise */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white font-bold text-sm shadow-lg shadow-[#FF8216]/25 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  <span>Analisando com Kitsune Vision...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    auto_awesome
                  </span>
                  <span>Executar Análise Inteligente</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Empty State com botões de Ação */
          <div className="flex flex-col items-center text-center p-6 max-w-md">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-3xl">add_a_photo</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Capture ou envie uma imagem
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1 mb-6">
              Tire uma foto na hora com sua câmera ou selecione da galeria do seu dispositivo.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                <span>Tirar Foto Agora</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18181B] hover:bg-slate-200 dark:hover:bg-[#27272A] text-slate-800 dark:text-white font-bold text-xs border border-slate-200 dark:border-[#27272A] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">collections</span>
                <span>Escolher da Galeria</span>
              </button>
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* Alerta de Erro */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Resultado da Análise da IA */}
      {analysisResult && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          {/* Card de Veredito Executivo */}
          <SpotlightCard className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#27272A] pb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      analysisResult.verdict === "APROVADO"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : analysisResult.verdict === "ATENÇÃO"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : analysisResult.verdict === "DESACONSELHADO"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                    }`}
                  >
                    {analysisResult.verdict}
                  </span>
                  <span className="text-xs text-slate-400">· Veredito Kitsune</span>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {analysisResult.title || "Resultado da Avaliação"}
                </h3>
              </div>

              {/* Impacto Financeiro Principal */}
              {analysisResult.financialImpact && (
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-[#18181B] p-3.5 rounded-2xl border border-slate-200 dark:border-[#27272A]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Valor Total
                    </span>
                    <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                      R${" "}
                      {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
                        analysisResult.financialImpact.totalAmount || 0
                      )}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-[#27272A]" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Horas de Trabalho
                    </span>
                    <div className="text-lg font-black text-[#FF8216] tabular-nums">
                      {analysisResult.financialImpact.workHoursRequired
                        ? `${analysisResult.financialImpact.workHoursRequired.toFixed(1)}h`
                        : "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Resumo */}
            <p className="text-sm text-slate-700 dark:text-[#E2E8F0] mt-4 leading-relaxed font-medium">
              {analysisResult.summary}
            </p>

            {/* Recomendações em Cards */}
            {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#27272A]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Recomendações Práticas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {analysisResult.recommendations.map((rec: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/60 dark:border-[#27272A]/60 text-xs text-slate-800 dark:text-[#CBD5E1]"
                    >
                      <span className="material-symbols-outlined text-[#FF8216] text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estratégia Alternativa */}
            {analysisResult.alternativeStrategy && (
              <div className="mt-4 p-4 rounded-2xl bg-[#FF8216]/10 border border-[#FF8216]/25 text-xs text-slate-800 dark:text-[#F8FAFC] flex items-start gap-3">
                <span className="material-symbols-outlined text-[#FF8216] text-[20px] shrink-0 mt-0.5">
                  lightbulb
                </span>
                <div>
                  <strong className="text-[#FF8216] font-bold block mb-0.5">
                    Estratégia Mais Inteligente:
                  </strong>
                  <span>{analysisResult.alternativeStrategy}</span>
                </div>
              </div>
            )}

            {/* Análise Aprofundada / Cálculos */}
            {analysisResult.deepAnalysis && (
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-[#27272A]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Detalhamento e Cálculos Financeiros
                </h4>
                <div className="text-xs text-slate-700 dark:text-[#CBD5E1] leading-relaxed">
                  <StreamingMarkdown content={analysisResult.deepAnalysis} />
                </div>
              </div>
            )}
          </SpotlightCard>
        </div>
      )}
    </div>
  );
}
