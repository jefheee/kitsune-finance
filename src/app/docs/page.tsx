"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const DOCS_SECTIONS = [
  {
    id: "overview",
    title: "1. Visão Geral & Arquitetura Soberana",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          O <strong>Kitsune Finance</strong> é um ecossistema de gestão patrimonial soberana de alta densidade projetado para operar com <strong>custo zero (\$0.00/mês)</strong> em infraestrutura serverless (Vercel) e banco de dados relacional distribuído (Supabase PostgreSQL).
        </p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Diferente de agregadores bancários convencionais, o Kitsune Finance adota o princípio de <strong>Soberania de Dados</strong>: opera em modelo estritamente <em>Read-Only</em>, isola os dados financeiros por usuário através de <strong>Row Level Security (RLS)</strong> no banco e elimina qualquer alucinação de modelos generativos através de motores matemáticos determinísticos (MSLR).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Custo Zero (\$0.00)</h4>
            <p className="text-xs text-zinc-400">Opera 100% sobre free tiers auditados da Vercel, Supabase, Google AI Studio e Groq.</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Blindagem MSLR</h4>
            <p className="text-xs text-zinc-400">Zero alucinação: todos os juros, saldos e projeções são calculados em TypeScript puro.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "stack",
    title: "2. Stack Tecnológica",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          A base de código foi concebida seguindo o padrão <strong>Docs-as-Code</strong> com TypeScript strict mode (0 erros de compilação):
        </p>
        <ul className="space-y-2 text-xs text-zinc-300 font-mono">
          <li className="p-2.5 rounded-xl bg-[#121214] border border-[#27272A] flex items-center justify-between">
            <span>Framework Full-Stack:</span>
            <strong className="text-white">Next.js 16 (App Router + React 19)</strong>
          </li>
          <li className="p-2.5 rounded-xl bg-[#121214] border border-[#27272A] flex items-center justify-between">
            <span>Estilização & Design System:</span>
            <strong className="text-white">Tailwind CSS v4 + Warm Obsidian Tokens</strong>
          </li>
          <li className="p-2.5 rounded-xl bg-[#121214] border border-[#27272A] flex items-center justify-between">
            <span>Banco de Dados & Auth:</span>
            <strong className="text-white">Supabase PostgreSQL 17 + FORCE RLS</strong>
          </li>
          <li className="p-2.5 rounded-xl bg-[#121214] border border-[#27272A] flex items-center justify-between">
            <span>Open Finance Brasil:</span>
            <strong className="text-white">Pluggy API SDK (140+ Instituições)</strong>
          </li>
          <li className="p-2.5 rounded-xl bg-[#121214] border border-[#27272A] flex items-center justify-between">
            <span>Inteligência Artificial:</span>
            <strong className="text-white">Google Gemini 3.8 Flash + Groq Llama 3.3</strong>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "hybrid",
    title: "3. Sistema Híbrido: Open Finance + Lançamentos Manuais com Visão OCR",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          O Kitsune Finance não depende exclusivamente de conexões bancárias automatizadas. A plataforma suporta um ecossistema <strong>híbrido unificado</strong>:
        </p>
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#E11D48]">document_scanner</span>
              <span>Leitura Inteligente de Documentos (Kitsune Vision)</span>
            </h4>
            <p className="text-xs text-zinc-400">
              Arraste fotos de cupons fiscais, notas eletrônicas (NF-e/NFC-e), recibos de maquininha ou comprovantes de Pix. A inteligência multimodal extrai instantaneamente o valor, estabelecimento, data e categoria com 0 digitação manual.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-emerald-400">payments</span>
              <span>Carteira Física & Compras Parceladas</span>
            </h4>
            <p className="text-xs text-zinc-400">
              Controle de dinheiro em espécie e compras divididas em até 48x. O sistema projeta os fluxos futuros mês a mês sem conflitar com lançamentos do Open Finance.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "agents",
    title: "4. Esquadrão de 7 Agentes Especialistas",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          A orquestração de IA do Kitsune utiliza um roteador semântico determinístico (Cascade Routing) que seleciona o agente mais adequado para cada consulta:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <span className="font-bold text-[#E11D48]">Sentinela Kitsune</span>
            <p className="text-zinc-400">Auditoria contínua de anomalias, tarifas indevidas e cobranças duplicadas.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <span className="font-bold text-emerald-400">Kenji</span>
            <p className="text-zinc-400">Classificação e enriquecimento de transações e histórico de hábitos.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <span className="font-bold text-blue-400">Ren</span>
            <p className="text-zinc-400">Guardião do teto de orçamento e fluxo de caixa seguro.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <span className="font-bold text-purple-400">Aiko</span>
            <p className="text-zinc-400">Estrategista de aportes, reserva de emergência e cálculo FIRE.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <span className="font-bold text-amber-400">Kuro</span>
            <p className="text-zinc-400">Moderador de compras por impulso e auditor rigoroso de custos.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A] space-y-1">
            <span className="font-bold text-cyan-400">Takeshi</span>
            <p className="text-zinc-400">Reconciliador familiar ("Pix de Acerto Único" no espaço compartilhado).</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "security",
    title: "5. Perímetro Fechado & Governança de Segurança",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          O projeto adota uma postura de segurança defensiva em profundidade (Defense-in-Depth):
        </p>
        <ul className="space-y-2 text-xs text-zinc-300">
          <li className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
            <strong className="text-white block mb-0.5">Allowlist de Acesso Estrita:</strong>
            Desconhecidos que autenticam com Google são imediatamente revogados e expurgados da tabela de usuários antes de tocar em dados do banco.
          </li>
          <li className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
            <strong className="text-white block mb-0.5">Rate Limiting em Borda (Token Bucket):</strong>
            Middleware restringe requisições para 40 req/min em rotas de IA e 15 req/min em rotas de login contra ataques de negação de serviço e Wallet-Draining.
          </li>
          <li className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
            <strong className="text-white block mb-0.5">Zero Leak de Chaves no Cliente:</strong>
            Chaves de IA, Open Finance e service_role rodam exclusivamente em Node.js server runtime, sem prefixo NEXT_PUBLIC_.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "quickstart",
    title: "6. Execução Local & Como Rodar",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          Para clonar e executar o Kitsune Finance em seu ambiente local:
        </p>
        <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] font-mono text-xs text-zinc-300 space-y-2 overflow-x-auto">
          <p className="text-zinc-500"># 1. Clone o repositório</p>
          <p className="text-white">git clone https://github.com/jefheee/kitsune-finance.git</p>
          <p className="text-white">cd kitsune-finance</p>
          <p className="text-zinc-500 pt-2"># 2. Instale as dependências</p>
          <p className="text-white">npm install</p>
          <p className="text-zinc-500 pt-2"># 3. Configure as variáveis em .env.local</p>
          <p className="text-white">cp .env.example .env.local</p>
          <p className="text-zinc-500 pt-2"># 4. Inicie o servidor de desenvolvimento</p>
          <p className="text-emerald-400 font-bold">npm run dev</p>
        </div>
      </div>
    ),
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#27272A] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/assets/logo/logo-transparent.png"
              alt="Kitsune"
              width={26}
              height={26}
              className="w-6 h-6 object-contain"
            />
            <span className="font-extrabold text-sm tracking-tight text-white">Kitsune Docs</span>
          </Link>
          <span className="px-2 py-0.5 rounded-md bg-[#E11D48]/15 text-[#E11D48] text-[10px] font-mono font-bold">
            v3.3
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link href="/changelog" className="text-zinc-400 hover:text-white transition-colors">
            Changelog
          </Link>
          <a
            href="https://github.com/jefheee/kitsune-finance"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-white font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">code</span>
            <span>GitHub</span>
          </a>
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-extrabold transition-all"
          >
            Acessar
          </Link>
        </div>
      </header>

      {/* Layout de Documentação em 2 Colunas */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar Esquerda de Navegação */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold mb-3 px-2">
            Sumário da Arquitetura
          </p>
          {DOCS_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                activeSection === sec.id
                  ? "bg-[#18181B] text-white border border-[#27272A]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#121214]"
              }`}
            >
              <span className="truncate">{sec.title}</span>
              {activeSection === sec.id && <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />}
            </button>
          ))}

          <div className="pt-6 px-2">
            <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#27272A] space-y-2">
              <p className="text-xs font-bold text-white">Código Aberto</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Contribua ou faça o deploy da sua própria instância soberana.
              </p>
              <a
                href="https://github.com/jefheee/kitsune-finance"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#E11D48] hover:underline font-semibold flex items-center gap-1"
              >
                <span>Ver no GitHub</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Conteúdo Principal da Documentação */}
        <main className="flex-1 space-y-8 min-w-0">
          {DOCS_SECTIONS.map((sec) => (
            <section
              key={sec.id}
              id={sec.id}
              className={`p-6 sm:p-8 rounded-3xl bg-[#121214]/60 border border-[#27272A] space-y-4 transition-all ${
                activeSection === sec.id ? "ring-1 ring-[#E11D48]/30 shadow-xl" : ""
              }`}
            >
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {sec.title}
              </h2>
              {sec.content}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

