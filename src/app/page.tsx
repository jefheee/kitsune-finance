"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { LandingQrCode } from "@/components/landing/LandingQrCode";
import { BankLogo } from "@/components/BankLogo";

const FAQ_ITEMS = [
  {
    q: "O Kitsune Finance é realmente gratuito e com custo zero?",
    a: "Sim. A arquitetura foi concebida para operar com custo perpétuo de $0.00/mês, aproveitando os free tiers generosos da Vercel (Edge Functions), Supabase (PostgreSQL 17 com RLS), Google AI Studio (Gemini 3.8 Flash) e Groq Cloud (Llama 3.3).",
  },
  {
    q: "Como funciona a conciliação híbrida de Open Finance com Lançamentos Manuais?",
    a: "O Kitsune unifica tudo em uma única linha do tempo contábil. Você pode conectar seus bancos via Open Finance oficial (140+ instituições) e, simultaneamente, lançar despesas em dinheiro físico ou compras avulsas. Nosso leitor inteligente (Kitsune Vision) lê a foto de notas fiscais e comprovantes Pix preenchendo valor, data e categoria com 0 digitação.",
  },
  {
    q: "A plataforma pode movimentar meu dinheiro ou realizar pagamentos?",
    a: "Absolutamente não. A integração com o Banco Central e instituições financeiras opera em modo estritamente Read-Only (Apenas Leitura). Nenhum agente, modelo de IA ou membro da equipe possui permissão técnica para movimentar fundos ou realizar transações.",
  },
  {
    q: "O que é a blindagem MSLR (Zero Alucinação Matemática)?",
    a: "Nenhum cálculo de juros, CDI, inflação, amortização ou saldo patrimonial é delegado a LLMs. Toda matemática reside em motores determinísticos puros em TypeScript (DU/252, Equação de Fisher, Tabela FIPE e Teto FGC R$ 250k), passando os valores prontos e auditados para a inteligência artificial.",
  },
  {
    q: "Meus dados financeiros podem ser usados para treinar IAs públicas?",
    a: "Nunca. Os dados são protegidos por Row Level Security (FORCE RLS) no banco PostgreSQL e processados sob acordos contratuais de Zero Data Retention. Suas contas nunca são compartilhadas ou usadas em treinamento de modelos.",
  },
];

const SPECIALIST_AGENTS = [
  {
    name: "Sentinela Kitsune",
    role: "Auditor Antifraude",
    desc: "Monitora cobranças duplicadas, tarifas bancárias ocultas e assinaturas esquecidas em tempo real.",
    accent: "#E11D48",
    icon: "shield",
  },
  {
    name: "Kenji",
    role: "Classificador Semântico",
    desc: "Corrige categorias com base no seu estilo de vida sem alucinar termos contábeis.",
    accent: "#10B981",
    icon: "filter_alt",
  },
  {
    name: "Ren",
    role: "Guardião do Orçamento",
    desc: "Simula o impacto de cada despesa no fechamento da fatura antes que o mês termine.",
    accent: "#3B82F6",
    icon: "account_balance_wallet",
  },
  {
    name: "Takeshi",
    role: "Reconciliador Familiar",
    desc: "Calcula o 'Pix de Acerto Único' proporcional à renda no Espaço Compartilhado familiar.",
    accent: "#06B6D4",
    icon: "diversity_3",
  },
  {
    name: "Aiko",
    role: "Estrategista de Metas",
    desc: "Projeta a reserva de emergência e liberdade financeira usando juros reais de Fisher.",
    accent: "#EC4899",
    icon: "flag",
  },
  {
    name: "Kuro",
    role: "Moderador de Impulsos",
    desc: "Linha-dura que traduz preços em horas reais de trabalho necessárias para pagar o bem.",
    accent: "#F59E0B",
    icon: "savings",
  },
];

// Dados com coordenadas reais para Tooltip Interativo no Hover do Gráfico
const TIMEFRAME_DETAILS: Record<
  string,
  {
    label: string;
    total: number;
    change: string;
    dataPoints: Array<{ x: number; y: number; date: string; value: number }>;
  }
> = {
  "1M": {
    label: "Últimos 30 Dias",
    total: 412850,
    change: "+2.4% este mês",
    dataPoints: [
      { x: 0, y: 130, date: "01 Out", value: 403200 },
      { x: 50, y: 120, date: "06 Out", value: 405100 },
      { x: 100, y: 125, date: "11 Out", value: 404800 },
      { x: 150, y: 100, date: "16 Out", value: 407500 },
      { x: 200, y: 90, date: "21 Out", value: 408900 },
      { x: 250, y: 75, date: "26 Out", value: 410600 },
      { x: 300, y: 55, date: "28 Out", value: 411800 },
      { x: 350, y: 45, date: "30 Out", value: 412200 },
      { x: 400, y: 30, date: "01 Nov", value: 412850 },
    ],
  },
  "3M": {
    label: "Último Trimestre",
    total: 412850,
    change: "+6.8% em 90 dias",
    dataPoints: [
      { x: 0, y: 145, date: "Ago", value: 386500 },
      { x: 50, y: 135, date: "Ago", value: 389200 },
      { x: 100, y: 120, date: "Set", value: 395100 },
      { x: 150, y: 110, date: "Set", value: 398400 },
      { x: 200, y: 90, date: "Out", value: 404000 },
      { x: 250, y: 70, date: "Out", value: 408200 },
      { x: 300, y: 55, date: "Out", value: 410500 },
      { x: 350, y: 40, date: "Nov", value: 412000 },
      { x: 400, y: 30, date: "Hoje", value: 412850 },
    ],
  },
  "6M": {
    label: "Último Semestre",
    total: 412850,
    change: "+11.5% no semestre",
    dataPoints: [
      { x: 0, y: 165, date: "Mai", value: 370200 },
      { x: 50, y: 150, date: "Jun", value: 376400 },
      { x: 100, y: 135, date: "Jul", value: 384000 },
      { x: 150, y: 115, date: "Ago", value: 391500 },
      { x: 200, y: 95, date: "Set", value: 399800 },
      { x: 250, y: 75, date: "Out", value: 406500 },
      { x: 300, y: 55, date: "Out", value: 410200 },
      { x: 350, y: 40, date: "Nov", value: 412100 },
      { x: 400, y: 30, date: "Hoje", value: 412850 },
    ],
  },
  "1Y": {
    label: "Ano Corrente",
    total: 412850,
    change: "+18.9% no ano",
    dataPoints: [
      { x: 0, y: 180, date: "Nov/25", value: 347200 },
      { x: 50, y: 165, date: "Jan", value: 356000 },
      { x: 100, y: 145, date: "Mar", value: 368400 },
      { x: 150, y: 120, date: "Mai", value: 380100 },
      { x: 200, y: 95, date: "Jul", value: 392500 },
      { x: 250, y: 75, date: "Set", value: 403200 },
      { x: 300, y: 55, date: "Out", value: 409800 },
      { x: 350, y: 40, date: "Nov", value: 412000 },
      { x: 400, y: 30, date: "Hoje", value: 412850 },
    ],
  },
  "ALL": {
    label: "Histórico Total",
    total: 412850,
    change: "+34.2% acumulado",
    dataPoints: [
      { x: 0, y: 190, date: "2024", value: 307500 },
      { x: 50, y: 175, date: "2024", value: 320000 },
      { x: 100, y: 155, date: "2025", value: 342000 },
      { x: 150, y: 130, date: "2025", value: 365000 },
      { x: 200, y: 105, date: "2025", value: 385000 },
      { x: 250, y: 80, date: "2026", value: 401000 },
      { x: 300, y: 55, date: "2026", value: 409500 },
      { x: 350, y: 40, date: "2026", value: 411800 },
      { x: 400, y: 30, date: "Hoje", value: 412850 },
    ],
  },
};

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "scanner" | "allocation" | "reconciliation">("dashboard");
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("1Y");
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; value: number } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("git clone https://github.com/jefheee/kitsune-finance.git");
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const currentTfData = TIMEFRAME_DETAILS[selectedTimeframe];
  const pointsString = currentTfData.dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#E11D48] selection:text-white font-sans overflow-x-hidden">
      {/* HEADER / FLOATING PILL NAVBAR */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl rounded-full bg-[#121214]/90 backdrop-blur-xl border border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-2xl transition-all">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-colors">
            <Image
              src="/assets/logo/logo-transparent.png"
              alt="Kitsune"
              width={26}
              height={26}
              className="w-5 h-5 object-contain"
              priority
            />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white group-hover:text-zinc-200 transition-colors">
            Kitsune
          </span>
        </Link>

        {/* NAVEGAÇÃO: SEPARAÇÃO VISUAL CLARA ENTRE ÂNCORAS DA PÁGINA E LINKS EXTERNOS */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-medium">
          {/* Âncoras da Landing Page */}
          <div className="flex items-center gap-4 text-zinc-400">
            <a href="#showcase" className="hover:text-white transition-colors">
              Showcase
            </a>
            <a href="#mobile-preview" className="hover:text-white transition-colors">
              App Mobile
            </a>
            <a href="#motores" className="hover:text-white transition-colors">
              Motores MSLR
            </a>
            <a href="#agentes" className="hover:text-white transition-colors">
              Agentes IA
            </a>
          </div>

          <div className="h-3.5 w-px bg-zinc-700/60" />

          {/* Hub Técnico Unificado (Docs, Changelog, Termos) */}
          <Link
            href="/docs"
            className="flex items-center gap-1 text-zinc-300 hover:text-white font-semibold transition-colors"
          >
            <span>Hub Técnico & Docs</span>
            <span className="material-symbols-outlined text-[13px] text-zinc-400">arrow_outward</span>
          </Link>
        </nav>

        {/* Ações Direitas */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://github.com/jefheee/kitsune-finance"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-[15px]">code</span>
            <span>GitHub</span>
          </a>

          <Link
            href="/login"
            className="h-8 px-4 rounded-full bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black text-xs font-extrabold flex items-center justify-center transition-all shadow-sm"
          >
            Acessar
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-36 sm:pt-44 pb-16 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-7">
        {/* Badges de Destaque */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121214] border border-[#27272A] shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono font-bold text-zinc-300 tracking-wider uppercase">
            Perímetro Soberano • Custo Zero ($0.00/mês)
          </span>
          <span className="text-[11px] text-zinc-500">•</span>
          <Link href="/docs" className="text-[11px] font-bold text-[#E11D48] hover:underline">
            Ver Arquitetura →
          </Link>
        </div>

        {/* Headline Principal */}
        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.08] max-w-4xl mx-auto">
          O Wealth OS Soberano com{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
            Inteligência Multimodal
          </span>{" "}
          e Blindagem Matemática.
        </h1>

        {/* Subtítulo Executivo */}
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Open Finance com 140+ bancos, lançamentos manuais com leitura de comprovantes por IA,
          auditoria contínua de anomalias e motores determinísticos em TypeScript puro.
        </p>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="w-full sm:w-auto h-12 px-7 rounded-2xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xl"
          >
            <span>Acessar Plataforma</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>

          <Link
            href="/docs"
            className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-[#121214] hover:bg-[#18181B] border border-[#27272A] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>Documentação Técnica</span>
          </Link>
        </div>

        {/* QUICKSTART TERMINAL COMPLETO SEM CORTE DE TEXTO */}
        <div className="pt-4 max-w-xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-[#121214] border border-[#27272A] font-mono text-xs text-zinc-300 shadow-lg text-left">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              <span className="text-[#E11D48] font-bold select-none">$</span>
              <span className="whitespace-nowrap select-all text-zinc-200">
                git clone https://github.com/jefheee/kitsune-finance.git
              </span>
            </div>
            <button
              onClick={handleCopyCommand}
              className="px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[11px] font-bold text-white transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
            >
              {copiedCmd ? "Copiado! ✓" : "Copiar"}
            </button>
          </div>
        </div>
      </section>

      {/* SHOWCASE INTERATIVO (COM TOOLTIP INTERATIVO NO HOVER DO GRÁFICO) */}
      <section id="showcase" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2 pb-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#E11D48]">
            Showcase Interativo
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Funções vitais operando em tempo real
          </p>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Passe o mouse sobre os pontos do gráfico de patrimônio líquido para auditar datas e valores históricos.
          </p>
        </div>

        {/* Abas Superiores do Showcase */}
        <div className="flex items-center justify-center gap-1.5 p-1 rounded-2xl bg-[#121214] border border-[#27272A] max-w-lg mx-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-white text-black shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Curva Patrimonial
          </button>
          <button
            onClick={() => setActiveTab("scanner")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "scanner"
                ? "bg-white text-black shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Leitura de Comprovantes
          </button>
          <button
            onClick={() => setActiveTab("allocation")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "allocation"
                ? "bg-white text-black shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Alocação de Ativos
          </button>
          <button
            onClick={() => setActiveTab("reconciliation")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "reconciliation"
                ? "bg-white text-black shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Antifraude Sentinela
          </button>
        </div>

        {/* Card Principal do Showcase */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#121214] border border-[#27272A] shadow-2xl relative overflow-hidden">
          {/* ABA 1: CURVA PATRIMONIAL COM HOVER INTERATIVO */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-medium">Patrimônio Líquido Consolidado</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                      R$ {hoveredPoint
                        ? hoveredPoint.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                        : currentTfData.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {hoveredPoint ? `(${hoveredPoint.date})` : currentTfData.change}
                    </span>
                  </div>
                </div>

                {/* Alternador 1M / 3M / 6M / 1Y / ALL */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#18181B] border border-[#27272A] self-start sm:self-auto">
                  {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setSelectedTimeframe(tf);
                        setHoveredPoint(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                        selectedTimeframe === tf
                          ? "bg-white text-black"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gráfico SVG com Suporte a Hover Interativo */}
              <div
                className="h-44 sm:h-56 w-full relative pt-4 cursor-crosshair"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <svg viewBox="0 0 400 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="landingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Área preenchida */}
                  <polygon
                    points={`0,200 ${pointsString} 400,200`}
                    fill="url(#landingGradient)"
                  />

                  {/* Linha traçada branca */}
                  <polyline
                    points={pointsString}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Linha guia vertical quando houver hover */}
                  {hoveredPoint && (
                    <line
                      x1={hoveredPoint.x}
                      y1={0}
                      x2={hoveredPoint.x}
                      y2={200}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Círculos interativos em cada ponto para captura de hover */}
                  {currentTfData.dataPoints.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredPoint?.x === pt.x ? 6 : 4}
                      fill={hoveredPoint?.x === pt.x ? "#E11D48" : "#FFFFFF"}
                      stroke="#0A0A0A"
                      strokeWidth="2"
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(pt)}
                    />
                  ))}
                </svg>

                {/* Tooltip Flutuante */}
                {hoveredPoint && (
                  <div
                    className="absolute -top-3 pointer-events-none p-2 rounded-xl bg-[#0A0A0A] border border-[#27272A] shadow-2xl text-[11px] font-mono space-y-0.5 -translate-x-1/2"
                    style={{ left: `${(hoveredPoint.x / 400) * 100}%` }}
                  >
                    <p className="text-zinc-400 text-[10px]">{hoveredPoint.date}</p>
                    <p className="font-bold text-white">
                      R$ {hoveredPoint.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>

              {/* Indicadores Vitais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#27272A]">
                <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A]">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">Liquidez Livre</span>
                  <span className="text-sm font-black text-white font-mono">R$ 28.450,00</span>
                </div>
                <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A]">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">Monitor FGC</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">100% Protegido</span>
                </div>
                <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A]">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">Reserva 6 Meses</span>
                  <span className="text-sm font-black text-white font-mono">Coberta (8.2m)</span>
                </div>
                <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A]">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">Yield Médio CDI</span>
                  <span className="text-sm font-black text-white font-mono">108.5% CDI</span>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: SCANNER DE COMPROVANTES */}
          {activeTab === "scanner" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E11D48]/10 text-[#E11D48] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">document_scanner</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Leitura Inteligente por IA (Kitsune Vision)</h3>
                  <p className="text-xs text-zinc-400">
                    Extração automática de cupons fiscais, recibos e notas Pix com 0 digitação
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400 pb-2 border-b border-[#27272A]">
                    <span>DOCUMENTO DIGITALIZADO</span>
                    <span className="text-emerald-400 font-bold">✓ ANALISADO</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#27272A] space-y-1 text-zinc-300">
                    <p className="font-bold text-white">NFC-e Nº 004829 - Supermercado Pão de Açúcar</p>
                    <p className="text-[11px] text-zinc-400">Data: 01/11/2026 • 18:42 • 14 Itens</p>
                    <p className="text-[11px] text-zinc-400">Pagamento: Cartão Mastercard Final 8821</p>
                    <p className="text-emerald-400 font-bold pt-1">Total Detectado: R$ 342,80</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] space-y-2 text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                    Preenchimento Automático do Lançamento:
                  </span>
                  <div className="space-y-1.5 font-mono">
                    <div className="p-2 rounded-lg bg-[#0A0A0A] flex justify-between">
                      <span className="text-zinc-400">Estabelecimento:</span>
                      <strong className="text-white">Pão de Açúcar</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[#0A0A0A] flex justify-between">
                      <span className="text-zinc-400">Valor:</span>
                      <strong className="text-rose-400">-R$ 342,80</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[#0A0A0A] flex justify-between">
                      <span className="text-zinc-400">Categoria Sugerida:</span>
                      <strong className="text-emerald-400">Supermercado</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[#0A0A0A] flex justify-between">
                      <span className="text-zinc-400">Origem:</span>
                      <strong className="text-white">Cartão de Crédito</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: ALOCAÇÃO DE ATIVOS */}
          {activeTab === "allocation" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Alocação Patrimonial Determinística</h3>
                  <p className="text-xs text-zinc-400">Divisão balanceada entre ativos financeiros e bens físicos</p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">X-Ray Score: 94/100</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-[#18181B] border border-l-4 border-l-emerald-500 border-[#27272A] space-y-1">
                  <span className="text-xs font-bold text-white">Renda Fixa & CDI</span>
                  <p className="text-lg font-black text-white font-mono">48%</p>
                  <p className="text-[10px] text-zinc-400">R$ 198.168,00</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#18181B] border border-l-4 border-l-blue-500 border-[#27272A] space-y-1">
                  <span className="text-xs font-bold text-white">Ações & FIIs</span>
                  <p className="text-lg font-black text-white font-mono">22%</p>
                  <p className="text-[10px] text-zinc-400">R$ 90.827,00</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#18181B] border border-l-4 border-l-purple-500 border-[#27272A] space-y-1">
                  <span className="text-xs font-bold text-white">Imóveis & Terrenos</span>
                  <p className="text-lg font-black text-white font-mono">18%</p>
                  <p className="text-[10px] text-zinc-400">R$ 74.313,00</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#18181B] border border-l-4 border-l-amber-500 border-[#27272A] space-y-1">
                  <span className="text-xs font-bold text-white">Veículos (FIPE)</span>
                  <p className="text-lg font-black text-white font-mono">12%</p>
                  <p className="text-[10px] text-zinc-400">R$ 49.542,00</p>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: ANTIFRAUDE SENTINELA */}
          {activeTab === "reconciliation" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 rounded-2xl bg-[#E11D48]/10 border border-[#E11D48]/30 flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#E11D48] mt-0.5">verified</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Alerta Sentinela Kitsune • Duplicidade Evitada
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Identificamos duas cobranças idênticas de <strong>R$ 49,90</strong> no serviço <em>Streaming HBO</em> no mesmo minuto. Alerta disparado e conciliação ativada.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="font-medium text-white">HBO Max Brasil (Cobrança Original)</span>
                  </div>
                  <span className="font-mono text-zinc-300 font-bold">-R$ 49,90</span>
                </div>
                <div className="p-3 rounded-xl bg-[#18181B] border border-amber-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-medium text-amber-300">HBO Max Brasil (Cobrança Duplicada Detectada)</span>
                  </div>
                  <span className="font-mono text-amber-400 font-bold">-R$ 49,90 (Sob Auditoria)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO MOBILE APP / IPHONE COM HALO REFINADO */}
      <section id="mobile-preview" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#E11D48]">
            PWA Mobile & Biometria Nativa
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Experiência Nativa no seu Smartphone
          </p>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            Instale diretamente pelo navegador sem lojas de apps. Protegido com Face ID / Impressão Digital sob a tela e bloqueio instantâneo em multitarefa.
          </p>
        </div>

        {/* MOCKUP DO IPHONE 16 PRO COM HALO TRANSLÚCIDO REFINADO E CARDS FLUTUANTES NO DESKTOP */}
        <div className="relative flex items-center justify-center py-6">
          {/* Halo Translúcido Sofisticado (Carmesim Suave + Branco Puro) */}
          <div className="absolute w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#E11D48]/10 blur-[100px] pointer-events-none" />
          <div className="absolute w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-white/5 blur-[80px] pointer-events-none" />

          {/* Card Flutuante Esquerdo (Últimas Transações - Exclusivo Desktop) */}
          <div className="hidden lg:flex flex-col gap-2 p-4 rounded-2xl bg-[#121214]/90 backdrop-blur-md border border-[#27272A] w-64 shadow-2xl absolute -left-16 xl:-left-24 top-1/3 -translate-y-1/2 z-20 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                Últimas Transações
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-400 font-bold text-[10px] flex items-center justify-center">
                    IF
                  </div>
                  <div>
                    <p className="font-semibold text-white text-[11px]">iFood Delivery</p>
                    <p className="text-[10px] text-zinc-500">Hoje, 20:14</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-300 text-xs">-R$ 42,90</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-[10px] flex items-center justify-center">
                    AB
                  </div>
                  <div>
                    <p className="font-semibold text-white text-[11px]">Airbnb Hospedagem</p>
                    <p className="text-[10px] text-zinc-500">Ontem</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-300 text-xs">-R$ 380,00</span>
              </div>
            </div>
          </div>

          {/* Card Flutuante Direito (Sentinela Kitsune - Exclusivo Desktop) */}
          <div className="hidden lg:flex flex-col gap-2 p-4 rounded-2xl bg-[#121214]/90 backdrop-blur-md border border-[#27272A] w-72 shadow-2xl absolute -right-16 xl:-right-24 top-1/2 -translate-y-1/2 z-20 animate-in fade-in slide-in-from-right-4 duration-300 text-left">
            <div className="flex items-center gap-2 pb-1 text-[#E11D48] text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#E11D48] animate-pulse" />
              <span>Sentinela Kitsune</span>
            </div>
            <h4 className="text-xs font-bold text-white">Cobrança duplicada evitada!</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Streaming de R$ 49,90 debitado duas vezes na mesma hora. Alerta disparado e conciliação ativada com sucesso.
            </p>
          </div>

          {/* Moldura do iPhone 16 Pro */}
          <div className="relative w-[280px] sm:w-[320px] rounded-[48px] p-3 bg-gradient-to-b from-zinc-700 via-zinc-900 to-black border-4 border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.9)] z-10">
            {/* Tela Interna */}
            <div className="rounded-[38px] bg-[#0A0A0A] border border-white/10 overflow-hidden p-4 space-y-4">
              {/* Dynamic Island */}
              <div className="w-24 h-5 rounded-full bg-black mx-auto flex items-center justify-center gap-1.5 px-2">
                <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
                <span className="text-[9px] font-mono text-zinc-400">Kitsune AI</span>
              </div>

              {/* Conteúdo Simulado do App Mobile */}
              <div className="space-y-3 pt-2 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-mono">PATRIMÔNIO</span>
                    <span className="text-base font-black text-white font-mono">R$ 412.850,00</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                    +18.9%
                  </span>
                </div>

                {/* Balão de Mensagem Kitsune AI */}
                <div className="p-3 rounded-2xl bg-[#18181B] border border-[#27272A] space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#E11D48] font-bold">
                    <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                    <span>Sentinela Kitsune</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed text-[11px]">
                    Sua fatura fecha em 4 dias. Com o saldo disponível de R$ 28,4k, você tem cobertura total sem comprometer a reserva.
                  </p>
                </div>

                {/* Transações Recentes Compactas */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                    Últimas Entradas / Saídas
                  </span>
                  <div className="p-2 rounded-xl bg-[#121214] flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300">Proventos CDB BTG</span>
                    <span className="text-emerald-400 font-bold font-mono">+R$ 842,10</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#121214] flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300">Supermercado Pão de Açúcar</span>
                    <span className="text-zinc-400 font-bold font-mono">-R$ 342,80</span>
                  </div>
                </div>
              </div>

              {/* Botão de Ação Rápida */}
              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Experimentar App</span>
                  <span className="material-symbols-outlined text-[13px]">touch_app</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO ARQUITETURA DETERMINÍSTICA (MSLR) */}
      <section id="motores" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#E11D48]">
            Engenharia Matemática Soberana
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Por que o Kitsune nunca usa LLM para calcular números
          </p>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto">
            Modelos generativos sofrem de alucinação numérica. Por isso, toda a matemática financeira
            do Kitsune reside em funções puras de precisão contábil.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-3">
            <span className="material-symbols-outlined text-[24px] text-[#E11D48]">calculate</span>
            <h3 className="text-sm font-bold text-white">CDI DU/252 & ANBIMA</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Cálculo de juros compostos em dias úteis oficiais da B3, descontando feriados bancários nacionais para projeção exata de rendimentos de renda fixa.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-3">
            <span className="material-symbols-outlined text-[24px] text-emerald-400">trending_up</span>
            <h3 className="text-sm font-bold text-white">Equação Real de Fisher</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Desconto real da inflação (IPCA) sobre aportes e patrimônio para apurar ganho real verdadeiro de poder de compra na aposentadoria e metas FIRE.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-3">
            <span className="material-symbols-outlined text-[24px] text-blue-400">directions_car</span>
            <h3 className="text-sm font-bold text-white">FIPE com Fallback Duplo</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Consulta de veículos com busca fuzzy tolerante, cotação instantânea pela BrasilAPI e failover automático da Parallelum contra falhas de rate limit.
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO ESQUADRÃO DE AGENTES */}
      <section id="agentes" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#E11D48]">
            Especialistas Autônomos
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sete Agentes Especialistas ao Seu Serviço
          </p>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto">
            Roteamento semântico dinâmico que direciona sua dúvida para o agente especialista no assunto.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SPECIALIST_AGENTS.map((ag) => (
            <div
              key={ag.name}
              className="p-5 rounded-3xl bg-[#121214] border border-[#27272A] space-y-3 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${ag.accent}15`, color: ag.accent }}
                >
                  <span className="material-symbols-outlined text-[18px]">{ag.icon}</span>
                </div>
                <span
                  className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: `${ag.accent}15`, color: ag.accent }}
                >
                  {ag.role}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{ag.name}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed mt-1">{ag.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-16 px-4 sm:px-6 max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2 pb-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#E11D48]">
            Perguntas Frequentes
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Transparência sem meias-palavras
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-[#121214] border border-[#27272A] overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-white">{item.q}</span>
                <span className="material-symbols-outlined text-zinc-400 text-sm">
                  {openFaq === idx ? "remove" : "add"}
                </span>
              </button>
              {openFaq === idx && (
                <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-[#27272A]/50 pt-3 animate-in fade-in duration-200">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER COM LOGO EM TAMANHO ADEQUADO */}
      <footer className="border-t border-[#27272A] bg-[#0A0A0A] py-14 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/logo/logo-horizontal-transparent.png"
              alt="Kitsune Finance"
              width={200}
              height={48}
              className="h-10 sm:h-11 w-auto object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400">
            <Link href="/docs" className="hover:text-white transition-colors">
              Documentação
            </Link>
            <Link href="/docs?tab=changelog" className="hover:text-white transition-colors">
              Changelog
            </Link>
            <Link href="/docs?tab=terms" className="hover:text-white transition-colors">
              Termos & Privacidade
            </Link>
            <a
              href="https://github.com/jefheee/kitsune-finance"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1 font-semibold"
            >
              <span>GitHub</span>
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
          </div>

          <p className="text-[11px] font-mono text-zinc-600 text-center md:text-right">
            © 2026 Kitsune Finance. Soberania Patrimonial.
          </p>
        </div>
      </footer>
    </div>
  );
}
