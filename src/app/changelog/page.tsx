"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const RELEASES = [
  {
    version: "v3.3",
    date: "01 de Novembro de 2026",
    title: "Governança Master, Allowlist Estrita, Lançamentos Manuais com Visão OCR e Novo Domínio",
    badge: "Última Versão",
    accent: "#E11D48",
    items: [
      "Perímetro Fechado (Allowlist): Proteção por banco de dados onde qualquer visitante desconhecido é expurgado do Supabase no mesmo instante em que tenta logar.",
      "Painel de Governança (/admin): Painel soberano para concessão, suspensão e revogação de membros em tempo real, com telemetria e teste de conectividade de APIs.",
      "Lançamento Manual com Visão OCR: Scanner inteligente via IA multimodal que extrai dados de cupons fiscais, notas eletrônicas e comprovantes Pix com 0 digitação.",
      "Compras Parceladas Manuais: Suporte a parcelamentos de 1x a 48x com projeção mensal matemática.",
      "Autenticação de Segurança Contextualizada: Adaptação inteligente para Windows Hello / Chave no Desktop e Biometria no Mobile.",
      "Migração de Domínio Oficial: Atualização da infraestrutura de produção para mykitsune.vercel.app com cookies seguros e redirects resilientes.",
    ],
  },
  {
    version: "v3.2",
    date: "01 de Novembro de 2026",
    title: "Glow Refinado, Widgets Neutros Sob Demanda, Scroll Restoration & Logo Horizontal",
    badge: "Design & UX",
    accent: "#FFFFFF",
    items: [
      "Landing Page: Halo translúcido carmesim e branco substituindo o antigo brilho laranja.",
      "Dashboard: Widgets de Módulos & Visão Executiva padronizados em cinza neutro Warm Obsidian (#121214 e #27272A), iniciando recolhidos para escolha do usuário.",
      "Scroll Restoration: Retorno fluido à posição exata em botões Voltar no navegador e no app PWA mobile.",
      "Nova Logo Horizontal Transparente: Integrada no topo, telas de autenticação e no repositório GitHub.",
    ],
  },
  {
    version: "v3.1",
    date: "01 de Novembro de 2026",
    title: "Expurgo de Histórico Git e Identidade Minimalista Monocromática",
    badge: "Identidade",
    accent: "#10B981",
    items: [
      "Higienização de Repositório: Expurgadas pastas temporárias de referência com reescrita completa do histórico Git.",
      "Aposentadoria do Kitsune Orange: Adoção de estados ativos monocromáticos de alto contraste (#FAFAFA / #FFFFFF) e marca cirúrgica em Kitsune Crimson (#E11D48).",
      "Curva Patrimonial Branca: Traço limpo em spline cúbica branca com preenchimento em gradiente suave.",
      "Manifesto PWA & Ícones em Alta Fidelidade: Ícones PNG transparentes 192px e 512px com suporte a maskable icon.",
    ],
  },
  {
    version: "v3.0",
    date: "31 de Outubro de 2026",
    title: "Unificação da Kitsune AI na Navegação, Hierarquia Visual e Abas Estilo Widgets",
    badge: "Plataforma",
    accent: "#3B82F6",
    items: [
      "Navegação Unificada: Consolidação da presença de IA sob a entrada oficial única Kitsune AI (/kitsune).",
      "Segmented Tabs Neutras: Conversão visual das abas de visão geral para a estética consistente dos widgets bancários.",
      "Prioridade Estratégica: Falar com Kitsune AI posicionado no topo para acesso instantâneo ao copiloto financeiro.",
      "Compilação TypeScript estrita validada com 0 erros de tipagem.",
    ],
  },
  {
    version: "v2.9",
    date: "30 de Outubro de 2026",
    title: "Busca FIPE Resiliente com Fallback Automático e Radar Imobiliário",
    badge: "Motores MSLR",
    accent: "#F59E0B",
    items: [
      "Motor FIPE Tolerante: Busca fuzzy por tokens, seleção antecipada de ano e fallback transparente da Parallelum contra falhas da BrasilAPI.",
      "Identificação Veicular por Placa: Endpoint /api/assets/vehicle-plate com estimativa de UF e suporte a gateways comerciais.",
      "Radar Imobiliário Enriquecido: Avaliação por m² da região do CEP com listagem de pontos de interesse no raio de 2km via OpenStreetMap Overpass.",
    ],
  },
];

export default function ChangelogPage() {
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
            <span className="font-extrabold text-sm tracking-tight text-white">Kitsune Changelog</span>
          </Link>
          <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-mono font-bold">
            Histórico Oficial
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link href="/docs" className="text-zinc-400 hover:text-white transition-colors">
            Documentação
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

      {/* Linha do Tempo de Releases */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 space-y-10">
        <div className="space-y-2 border-b border-[#27272A] pb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Histórico de Atualizações & Releases
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Registro incremental de cada entrega, melhoria de arquitetura, patches de segurança e design.
          </p>
        </div>

        <div className="space-y-8 relative before:absolute before:inset-0 before:left-4 md:before:left-6 before:w-0.5 before:bg-[#27272A]">
          {RELEASES.map((rel) => (
            <div key={rel.version} className="relative pl-10 md:pl-14 space-y-3">
              {/* Marcador na linha */}
              <div
                className="absolute left-2.5 md:left-4.5 top-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-4 border-[#0A0A0A]"
                style={{ backgroundColor: rel.accent }}
              />

              <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono font-bold text-xs">
                      {rel.version}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">{rel.date}</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase font-mono"
                    style={{
                      backgroundColor: `${rel.accent}20`,
                      color: rel.accent === "#FFFFFF" ? "#FAFAFA" : rel.accent,
                    }}
                  >
                    {rel.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight">
                  {rel.title}
                </h3>

                <ul className="space-y-2 text-xs text-zinc-300">
                  {rel.items.map((it, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mt-1.5 shrink-0" />
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

