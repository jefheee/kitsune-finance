"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { LandingQrCode } from "@/components/landing/LandingQrCode";
import { BankLogo } from "@/components/BankLogo";

const FAQ_ITEMS = [
  {
    q: "A Kitsune Finance é segura?",
    a: "Sim, 100% segura. Operamos com criptografia bancária de ponta a ponta (AES-256 e TLS 1.3) em estrita conformidade com a LGPD e as normas de Open Finance do Banco Central do Brasil. Todo acesso é exclusivamente para leitura e consulta de extratos.",
  },
  {
    q: "Como funciona a conexão com os meus bancos?",
    a: "A integração é realizada através do protocolo oficial de Open Finance do Banco Central em parceria com a Pluggy. Você autoriza a conexão autenticando-se diretamente no app oficial da sua instituição via token biométrico ou OAuth. A Kitsune nunca tem acesso ou armazena suas senhas bancárias.",
  },
  {
    q: "A Kitsune pode movimentar meu dinheiro ou fazer transações?",
    a: "Absolutamente não. Nossos agentes autônomos e a plataforma possuem apenas permissão de leitura (Read-Only). Nem os modelos de IA nem nossa equipe têm capacidade técnica ou autorização para realizar transferências, pagamentos Pix ou investimentos pelo seu banco.",
  },
  {
    q: "O que é a arquitetura de IA (MSLR) e por que ela não erra contas?",
    a: "O Multi-Step Logical Reasoning (MSLR) desacopla a linguagem natural da matemática. Os modelos de linguagem atuam identificando intenções e estruturando consultas contextuais. Todas as operações aritméticas, somas de faturas e saldos são processadas deterministicamente por código relacional. O resultado é zero alucinação numérica.",
  },
  {
    q: "Quais instituições financeiras e bancos são suportados?",
    a: "Mais de 100 instituições em todo o Brasil, incluindo Itaú, Nubank, Bradesco, Banco do Brasil, Santander, Inter, C6 Bank, BTG Pactual, XP Investimentos, Mercado Pago e as principais cooperativas de crédito (Sicredi, Sicoob). Novas conexões são adicionadas automaticamente.",
  },
  {
    q: "Meus dados financeiros podem ser usados para treinar IAs públicas?",
    a: "Nunca. Seus registros são blindados por Row Level Security (RLS) no banco de dados e criptografados em repouso. Possuímos acordos contratuais de Zero Data Retention; nenhum dado confidencial ou transação pessoal é compartilhado ou utilizado no treinamento de modelos públicos.",
  },
];

const AGENTS = [
  {
    name: "Albert",
    role: "Auditor de Anomalias",
    tagline: "Detecta cobranças indevidas, fraudes e tarifas surpresa antes de você perceber.",
    icon: "shield",
    accent: "#FF8216",
    badge: "Antifraude Ativo",
  },
  {
    name: "Sherlock",
    role: "Rastreamento & Classificação",
    tagline: "Corrige suas categorias sem alucinar e aprende com o seu estilo de vida financeiro.",
    icon: "search",
    accent: "#10B981",
    badge: "Zero Alucinação",
  },
  {
    name: "Megamen",
    role: "Guardião do Orçamento",
    tagline: "Simula projeções de caixa e alerta no momento exato antes de ultrapassar o teto.",
    icon: "battery_charging_full",
    accent: "#3B82F6",
    badge: "Teto de Gastos",
  },
  {
    name: "Rita",
    role: "Estrategista de Metas",
    tagline: "Desenha planos de aportes e missões práticas para acelerar sua reserva de emergência.",
    icon: "flag",
    accent: "#EC4899",
    badge: "Metas Patrimoniais",
  },
  {
    name: "Julius",
    role: "Moderador de Impulsos",
    tagline: "Conselheiro financeiro linha-dura que alerta contra gastos desnecessários no dia a dia.",
    icon: "savings",
    accent: "#F59E0B",
    badge: "Controle Rigoroso",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#FF8216] selection:text-white font-sans overflow-x-hidden">
      {/* Floating Pill Navbar (Estilo Pierre / Stitch) */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl rounded-full bg-[#121214]/90 backdrop-blur-xl border border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-2xl transition-all">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover:border-[#FF8216]/50 transition-colors">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Kitsune"
              width={26}
              height={26}
              priority
              className="object-contain"
            />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white">
            Kitsune
          </span>
        </Link>

        {/* Center Links (Desktop) */}
        <nav className="hidden md:flex items-center justify-center gap-7 text-[13px] text-zinc-300 font-medium">
          <a href="#vantagens" className="hover:text-white transition-colors">
            Vantagens
          </a>
          <a href="#recursos" className="hover:text-white transition-colors">
            Recursos
          </a>
          <a href="#agentes" className="hover:text-white transition-colors">
            Agentes
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="text-xs sm:text-[13px] font-semibold text-zinc-300 hover:text-white px-3 py-1.5 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="text-xs sm:text-[13px] font-bold bg-[#FF8216] hover:bg-[#FFA047] active:scale-95 text-white px-4 sm:px-5 py-2 rounded-full transition-all shadow-sm"
          >
            Começar agora
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="vantagens"
        className="pt-32 sm:pt-40 pb-20 px-4 max-w-7xl mx-auto flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Glow de Fundo Sutil */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#FF8216]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#161618] border border-white/10 text-xs text-zinc-300 font-medium mb-6 shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216] animate-pulse" />
          <span>A Revolução do Open Finance Autônomo</span>
        </motion.div>

        {/* Headline H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-[68px] font-extrabold tracking-[-0.035em] text-white max-w-4xl leading-[1.08] mb-5"
        >
          Você vive. A Kitsune <br className="hidden sm:inline" />
          cuida do seu dinheiro.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm sm:text-base md:text-lg text-zinc-400 max-w-xl font-normal leading-relaxed mb-8 px-4"
        >
          Agentes autônomos que acompanham suas contas, faturas em tempo real, auditoria proativa de anomalias e inteligência financeira integrada.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-16 w-full sm:w-auto px-4"
        >
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#FF8216] hover:bg-[#FFA047] active:scale-95 text-white font-bold text-sm tracking-tight transition-transform shadow-lg shadow-[#FF8216]/20 cursor-pointer"
          >
            Começar gratuitamente
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-[#161618] hover:bg-[#202024] border border-white/10 text-zinc-300 hover:text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            Acessar Plataforma
          </Link>
        </motion.div>

        {/* Mockup Showcase: iPhone 16 Pro + Floating Cards (Fiel ao Stitch) */}
        <div className="relative w-full max-w-[960px] mx-auto mt-4 px-2">
          {/* Card Flutuante 1: Últimas Transações (Top-Left no Desktop) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="hidden lg:flex absolute top-12 left-4 z-20 flex-col gap-2.5 p-4 rounded-2xl bg-[#121214]/90 backdrop-blur-xl border border-white/10 shadow-2xl w-64 text-left"
          >
            <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-white/5 pb-2">
              <span className="font-bold uppercase tracking-wider">Últimas transações</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center text-xs font-bold">
                  iF
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">iFood Delivery</span>
                  <span className="text-[10px] text-zinc-500">Hoje, 20:14</span>
                </div>
              </div>
              <span className="text-xs font-bold text-white tabular-nums">-R$ 42,90</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">
                  AB
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">Airbnb Hospedagem</span>
                  <span className="text-[10px] text-zinc-500">Ontem</span>
                </div>
              </div>
              <span className="text-xs font-bold text-white tabular-nums">-R$ 380,00</span>
            </div>
          </motion.div>

          {/* Card Flutuante 2: Agente Albert • Anomalia Evitada (Top-Right no Desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="hidden lg:flex absolute top-20 right-4 z-20 flex-col gap-2 p-4 rounded-2xl bg-[#121214]/90 backdrop-blur-xl border border-[#FF8216]/30 shadow-2xl w-64 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF8216] animate-ping" />
              <span className="text-[11px] font-bold text-[#FF8216] uppercase tracking-wider">
                Agente Albert
              </span>
            </div>
            <span className="text-xs font-bold text-white">
              Cobrança duplicada evitada!
            </span>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Streaming de R$ 49,90 debitado duas vezes na mesma hora. Alerta disparado com sucesso.
            </p>
          </motion.div>

          {/* iPhone 16 Pro Mockup Frame */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="relative mx-auto w-[290px] sm:w-[320px] md:w-[340px] rounded-[48px] p-3 bg-gradient-to-b from-[#2D2D30] via-[#1A1A1C] to-[#121214] shadow-[0_0_60px_rgba(255,130,22,0.12)] border border-white/20"
          >
            {/* Bezel Interior */}
            <div className="rounded-[40px] bg-[#0E1015] p-4 flex flex-col h-[580px] sm:h-[620px] overflow-hidden border border-black relative">
              {/* Dynamic Island */}
              <div className="w-24 h-5 bg-black rounded-full mx-auto mb-4 flex items-center justify-between px-2 shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#18181B]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216]/60" />
              </div>

              {/* Chat Interface Inside Phone */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FF8216]/15 flex items-center justify-center p-1">
                    <Image
                      src="/assets/logo/logo_sem_fundo.png"
                      alt="Kitsune"
                      width={18}
                      height={18}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block leading-none">
                      Kitsune AI
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">Online</span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">13:42</span>
              </div>

              {/* Mensagens de Exemplo */}
              <div className="flex-1 flex flex-col justify-end gap-2.5 text-left text-xs overflow-hidden pb-2">
                <div className="self-end bg-[#FF8216] text-white px-3.5 py-2 rounded-2xl rounded-tr-sm max-w-[85%] font-medium shadow-sm">
                  Qual o impacto das minhas faturas no fechamento deste mês?
                </div>

                <div className="self-start bg-[#18181C] text-zinc-200 p-3 rounded-2xl rounded-tl-sm max-w-[90%] border border-white/5 space-y-2">
                  <p className="text-[11px] leading-relaxed text-zinc-300">
                    Seu saldo disponível é de <strong className="text-white">R$ 220,76</strong>. Com a fatura Nubank de <strong className="text-[#FF8216]">R$ 165,58</strong>, sua margem líquida é de <strong className="text-emerald-400">R$ 55,18</strong>.
                  </p>
                  <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">Status de Liquidez:</span>
                    <span className="text-emerald-400 font-bold">1.3x Coberto</span>
                  </div>
                </div>
              </div>

              {/* Input Mockup */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 shrink-0">
                <div className="flex-1 h-9 bg-[#18181C] rounded-full border border-white/10 px-3 flex items-center text-[11px] text-zinc-500">
                  Perguntar à Kitsune...
                </div>
                <div className="w-8 h-8 rounded-full bg-[#FF8216] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 3 Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20 pt-12 border-t border-white/10 w-full text-center">
          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              100+ Bancos
            </span>
            <span className="text-xs text-zinc-400 mt-1">
              Conexão Open Finance regulada pelo BACEN
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#FF8216] tracking-tight">
              AES-256
            </span>
            <span className="text-xs text-zinc-400 mt-1">
              Criptografia de ponta a ponta e RLS
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
              MSLR Engine
            </span>
            <span className="text-xs text-zinc-400 mt-1">
              Cálculos determinísticos sem alucinação
            </span>
          </div>
        </div>

        {/* Vitrine Oficial Open Finance Brasil com Rolagem Fluida Infinita (Marquee) */}
        <div className="mt-14 w-full flex flex-col items-center gap-4 overflow-hidden">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest text-center">
            Conexão Direta com Principais Instituições do Brasil
          </span>

          {/* Carrossel Infinito com Fade nas Pontas */}
          <div className="relative w-full max-w-5xl overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <div className="animate-marquee flex items-center gap-3">
              {[
                { slug: 'nubank', name: 'Nubank' },
                { slug: 'itau', name: 'Itaú' },
                { slug: 'santander', name: 'Santander' },
                { slug: 'inter', name: 'Banco Inter' },
                { slug: 'caixa', name: 'Caixa' },
                { slug: 'mercadopago', name: 'Mercado Pago' },
                { slug: 'bradesco', name: 'Bradesco' },
                { slug: 'bb', name: 'Banco do Brasil' },
                { slug: 'c6', name: 'C6 Bank' },
                { slug: 'btg', name: 'BTG Pactual' },
                { slug: 'safra', name: 'Banco Safra' },
                { slug: 'picpay', name: 'PicPay' },
                { slug: 'xp', name: 'XP Investimentos' },
                { slug: 'rico', name: 'Rico' },
                { slug: 'sicredi', name: 'Sicredi' },
                { slug: 'sicoob', name: 'Sicoob' },
                { slug: 'pagbank', name: 'PagBank' },
                { slug: 'neon', name: 'Neon' },
                { slug: 'banrisul', name: 'Banrisul' },
                { slug: 'daycoval', name: 'Daycoval' },
                // Duplicação para loop contínuo infinito
                { slug: 'nubank', name: 'Nubank' },
                { slug: 'itau', name: 'Itaú' },
                { slug: 'santander', name: 'Santander' },
                { slug: 'inter', name: 'Banco Inter' },
                { slug: 'caixa', name: 'Caixa' },
                { slug: 'mercadopago', name: 'Mercado Pago' },
                { slug: 'bradesco', name: 'Bradesco' },
                { slug: 'bb', name: 'Banco do Brasil' },
                { slug: 'c6', name: 'C6 Bank' },
                { slug: 'btg', name: 'BTG Pactual' },
                { slug: 'safra', name: 'Banco Safra' },
                { slug: 'picpay', name: 'PicPay' },
                { slug: 'xp', name: 'XP Investimentos' },
                { slug: 'rico', name: 'Rico' },
                { slug: 'sicredi', name: 'Sicredi' },
                { slug: 'sicoob', name: 'Sicoob' },
                { slug: 'pagbank', name: 'PagBank' },
                { slug: 'neon', name: 'Neon' },
                { slug: 'banrisul', name: 'Banrisul' },
                { slug: 'daycoval', name: 'Daycoval' },
              ].map((b, idx) => (
                <div
                  key={`${b.slug}-${idx}`}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#FF8216]/50 hover:bg-white/10 transition-all shadow-sm shrink-0"
                  title={b.name}
                >
                  <BankLogo bank={b.slug} size="xs" />
                  <span className="text-xs font-semibold text-zinc-200 whitespace-nowrap">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seção Exclusiva: Galeria de Agentes Inteligentes Inspirados no Pierre */}
      <section className="py-20 px-4 max-w-6xl mx-auto border-t border-white/10">
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
            Inteligência Financeira Autônoma
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Conheça seus Agentes Especialistas
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
            Uma equipe completa com papéis dinâmicos que trabalham em segundo plano para auditar, proteger e multiplicar seu patrimônio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              emoji: '😾',
              name: 'Julius',
              role: 'Fiscal Ranzinza',
              desc: 'Reclama quando você gastar de um jeito absurdo e calcula quanto você economiza se não comprar.',
              tag: 'Corta Supérfluos',
            },
            {
              emoji: '🎩',
              name: 'Tio Patinhas',
              role: 'Estrategista Patrimonial',
              desc: 'Audita saldos parados em conta corrente e indica rendimentos reais no CDI e Selic.',
              tag: 'Multiplica Caixa',
            },
            {
              emoji: '🕵️‍♂️',
              name: 'Inspetor Bugiganga',
              role: 'Caçador de Erros',
              desc: 'Encontra cobranças duplicadas na mesma data, tarifas ocultas e assinaturas esquecidas.',
              tag: 'Zero Taxas Indevidas',
            },
          ].map((ag, i) => (
            <div
              key={i}
              className="p-6 rounded-3xl bg-gradient-to-b from-[#18181B] to-[#121215] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                    {ag.emoji}
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                    {ag.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-[#FF8216] transition-colors">
                  {ag.name}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {ag.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-300 font-medium">
                <span>{ag.role}</span>
                <span className="text-emerald-400 font-mono text-[11px]">● 100% Dinâmico</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Recursos & Arquitetura */}
      <section id="recursos" className="py-24 px-4 max-w-6xl mx-auto border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Interactive Diagram Card */}
          <div className="lg:col-span-6 relative flex justify-center">
            <div className="relative w-full max-w-[460px] rounded-3xl bg-[#121214] border border-white/10 p-6 flex flex-col gap-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Pluggy Open Finance
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  AES-256 • Ativo
                </span>
              </div>

              {/* Event 1 */}
              <div className="p-3.5 rounded-xl bg-[#18181B] border border-white/5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-sm">shield</span>
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-xs font-bold text-white block">
                    Albert • Agente de Anomalias
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                    Cobrança duplicada detectada: R$ 89,90 em streaming. Sugestão preventiva gerada.
                  </p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="p-3.5 rounded-xl bg-[#18181B] border border-white/5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-xs font-bold text-white block">
                    Motor MSLR • Inferência ~140ms
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                    Categorização com validação determinística sem alucinação matemática.
                  </p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="p-3.5 rounded-xl bg-[#18181B] border border-white/5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-xs font-bold text-white block">
                    Previsibilidade de Faturas
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                    Dedução antecipada de faturas de cartão para manter seu saldo líquido protegido.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Copy & Bullets */}
          <div className="lg:col-span-6 text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18181B] border border-white/10 text-[11px] font-bold text-[#FF8216] uppercase tracking-wider">
              Tecnologia Patrimonial
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-white leading-tight">
              Inteligência para cuidar do seu patrimônio
            </h2>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Diferente de planilhas manuais ou apps tradicionais que apenas exibem gráficos estáticos, a Kitsune integra inteligência artificial ativa que prevê descompassos e otimiza suas decisões financeiras.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#FF8216] text-xl shrink-0 mt-0.5">
                  check_circle
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Conexão Oficial & Instantânea
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Autorização oficial via Open Finance BACEN em poucos segundos via biometria bancária.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#FF8216] text-xl shrink-0 mt-0.5">
                  check_circle
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Motor Analítico Determinístico
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Desacoplamento estrito entre raciocínio de linguagem e computação numérica.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#FF8216] text-xl shrink-0 mt-0.5">
                  check_circle
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Dedução Real de Faturas Futuras
                  </h3>
                  <p className="text-xs text-zinc-400">
                    O único app que abate faturas abertas do saldo líquido para mostrar seu dinheiro real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Seus Agentes Trabalhando Por Você */}
      <section id="agentes" className="py-24 px-4 max-w-7xl mx-auto border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
          <div className="text-left max-w-2xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-white mb-3">
              Seus agentes trabalhando por você
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Uma equipe de especialistas autônomos que monitoram condições, encontram padrões e alertam quando algo merece sua atenção imediata.
            </p>
          </div>

          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#FF8216] hover:bg-[#FFA047] text-white font-bold text-xs shrink-0 self-start shadow-sm"
          >
            Ativar Agentes
          </Link>
        </div>

        {/* Grid de Agentes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {AGENTS.map((agent) => (
            <div
              key={agent.name}
              className="p-5 rounded-3xl bg-[#121214] border border-white/10 hover:border-[#FF8216]/40 transition-colors flex flex-col justify-between gap-4 shadow-xl group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
                    style={{ backgroundColor: `${agent.accent}20`, color: agent.accent }}
                  >
                    <span className="material-symbols-outlined text-xl">{agent.icon}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${agent.accent}15`,
                      color: agent.accent,
                      borderColor: `${agent.accent}30`,
                    }}
                  >
                    {agent.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">
                  {agent.name}
                </h3>
                <span className="text-xs font-semibold text-zinc-400 block mb-2">
                  {agent.role}
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {agent.tagline}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Status Operacional</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Pronto
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Dúvidas Frequentes (FAQ) */}
      <section id="faq" className="py-24 px-4 max-w-4xl mx-auto border-t border-white/10">
        <div className="text-left mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18181B] border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216]" />
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              Suporte & Transparência
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-white">
            Dúvidas frequentes
          </h2>
          <p className="text-sm sm:text-base text-zinc-400">
            Tudo o que você precisa saber sobre segurança, inteligência artificial, conexão com bancos e funcionamento da Kitsune Finance.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-3 text-left">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-[#121214] rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-5 text-sm sm:text-base font-semibold text-white gap-4 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                    <span>{item.q}</span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-zinc-400 transition-transform shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/5 pt-3 pl-7">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer com QR Code Oficial Untitled UI */}
      <footer id="comecar" className="pt-20 pb-16 px-4 bg-[#0A0A0A] border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start pb-16 border-b border-white/10">
            {/* Left Column */}
            <div className="md:col-span-7 space-y-6 text-left">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/assets/logo/logo_sem_fundo.png"
                  alt="Kitsune"
                  width={32}
                  height={32}
                  className="object-contain"
                />
                <span className="text-xl font-bold tracking-tight text-white">
                  Kitsune
                </span>
              </div>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                Seu assistente de inteligência artificial para finanças pessoais e consolidação patrimonial via Open Finance.
              </p>

              {/* Institutional Links */}
              <div className="space-y-2 pt-2 text-[11px] font-semibold text-zinc-400 tracking-wider">
                <div>
                  <a href="#" className="hover:text-white transition-colors">
                    TERMOS DE USO
                  </a>
                </div>
                <div>
                  <a href="#" className="hover:text-white transition-colors">
                    POLÍTICA DE PRIVACIDADE (LGPD)
                  </a>
                </div>
                <div>
                  <a href="#" className="hover:text-white transition-colors">
                    SEGURANÇA & REGULAÇÃO BACEN
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column: Untitled UI QR Code */}
            <div className="md:col-span-5 flex flex-col items-start md:items-end gap-3">
              <LandingQrCode />
              <div className="text-left md:text-right">
                <span className="text-xs font-bold text-white block">
                  Acesse direto no seu celular
                </span>
                <span className="text-[11px] text-zinc-500">
                  Aponte a câmera para abrir o Web App
                </span>
              </div>
            </div>
          </div>

          {/* Legal and Support Text */}
          <div className="pt-8 text-left space-y-2 text-[11px] text-zinc-500 leading-relaxed">
            <p>
              Kitsune Finance • Ambiente 100% blindado com leitura somente-leitura regulada pelo Banco Central do Brasil.
            </p>
            <p>
              Nosso atendimento está disponível pelo chat no aplicativo ou pelo e-mail{" "}
              <a href="mailto:ajuda@kitsune.finance" className="underline text-zinc-400">
                ajuda@kitsune.finance
              </a>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
