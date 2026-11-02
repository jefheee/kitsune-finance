"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { LandingQrCode } from "@/components/landing/LandingQrCode";
import { BankLogo } from "@/components/BankLogo";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { ShinyText } from "@/components/react-bits/ShinyText";
import { CountUp } from "@/components/react-bits/CountUp";

const FAQ_ITEMS = [
  {
    q: "O Kitsune Finance é realmente gratuito e com custo zero?",
    a: "Sim. A arquitetura foi construída para operar com custo perpétuo de $0.00/mês, aproveitando os free tiers generosos da Vercel (Edge Functions), Supabase (PostgreSQL 17 com RLS), Google AI Studio (Gemini 3.8 Flash) e Groq Cloud (Llama 3.3).",
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

// Mock interativo para o Hero Showcase
const TIMEFRAME_DATA: Record<string, { value: number; change: string; points: string }> = {
  "1M": { value: 412850, change: "+2.4% este mês", points: "0,120 50,110 100,115 150,90 200,85 250,70 300,50 350,45 400,30" },
  "3M": { value: 412850, change: "+6.8% em 90 dias", points: "0,140 50,130 100,110 150,105 200,80 250,65 300,55 350,40 400,30" },
  "6M": { value: 412850, change: "+11.5% no semestre", points: "0,160 50,145 100,135 150,120 200,95 250,80 300,60 350,45 400,30" },
  "1Y": { value: 412850, change: "+18.9% no ano", points: "0,180 50,160 100,140 150,115 200,90 250,75 300,50 350,38 400,30" },
  "ALL": { value: 412850, change: "+34.2% acumulado", points: "0,190 50,175 100,150 150,130 200,100 250,70 300,45 350,35 400,30" },
};

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "scanner" | "allocation" | "reconciliation">("dashboard");
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("1Y");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("git clone https://github.com/jefheee/kitsune-finance.git");
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

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

        {/* Links Centrais */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-400 font-medium">
          <a href="#showcase" className="hover:text-white transition-colors">
            Showcase
          </a>
          <a href="#arquitetura" className="hover:text-white transition-colors">
            Motores MSLR
          </a>
          <a href="#agentes" className="hover:text-white transition-colors">
            Agentes IA
          </a>
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>
          <Link href="/changelog" className="hover:text-white transition-colors">
            Changelog
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
      <section className="relative pt-32 pb-20 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-7">
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

        {/* QUICKSTART TERMINAL ESTILO OPENCODE */}
        <div className="pt-4 max-w-md mx-auto">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#121214] border border-[#27272A] font-mono text-[11px] text-zinc-300 shadow-lg">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pr-2">
              <span className="text-[#E11D48] font-bold">$</span>
              <span className="truncate">git clone https://github.com/jefheee/kitsune-finance.git</span>
            </div>
            <button
              onClick={handleCopyCommand}
              className="px-2.5 py-1 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[10px] font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {copiedCmd ? "Copiado! ✓" : "Copiar"}
            </button>
          </div>
        </div>
      </section>

      {/* SHOWCASE INTERATIVO (DEMONSTRAÇÃO FUNCIONANDO COM DADOS MOCKADOS) */}
      <section id="showcase" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2 pb-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#E11D48]">
            Experiência Real da Plataforma
          </h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Veja as funções vitais em ação
          </p>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Interaja com as abas e seletores abaixo para conferir a precisão visual e o refinamento do Wealth OS.
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

        {/* Card Principal Interativo */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#121214] border border-[#27272A] shadow-2xl relative overflow-hidden">
          {/* ABA 1: CURVA PATRIMONIAL */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-medium">Patrimônio Líquido Consolidado</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                      R$ {TIMEFRAME_DATA[selectedTimeframe].value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {TIMEFRAME_DATA[selectedTimeframe].change}
                    </span>
                  </div>
                </div>

                {/* Alternador 1M / 3M / 6M / 1Y / ALL */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#18181B] border border-[#27272A] self-start sm:self-auto">
                  {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
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

              {/* Gráfico SVG em Spline Cúbica Branca */}
              <div className="h-44 sm:h-56 w-full relative pt-4">
                <svg viewBox="0 0 400 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="landingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Área com gradiente */}
                  <polygon
                    points={`0,200 ${TIMEFRAME_DATA[selectedTimeframe].points} 400,200`}
                    fill="url(#landingGradient)"
                  />
                  {/* Linha traçada branca pura */}
                  <polyline
                    points={TIMEFRAME_DATA[selectedTimeframe].points}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Indicadores Vitais do Dashboard */}
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
                    Demonstração de extração automática de dados a partir de um cupom fiscal ou nota Pix
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

      {/* SEÇÃO ARQUITETURA DETERMINÍSTICA (MSLR) */}
      <section id="arquitetura" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
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

      {/* FOOTER */}
      <footer className="border-t border-[#27272A] bg-[#0A0A0A] py-12 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/logo/logo-horizontal-transparent.png"
              alt="Kitsune Finance"
              width={140}
              height={32}
              className="h-7 w-auto object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400">
            <Link href="/docs" className="hover:text-white transition-colors">
              Documentação
            </Link>
            <Link href="/changelog" className="hover:text-white transition-colors">
              Changelog
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Termos & Privacidade
            </Link>
            <a
              href="https://github.com/jefheee/kitsune-finance"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
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
