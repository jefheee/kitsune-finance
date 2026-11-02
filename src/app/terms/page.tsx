"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function TermsPage() {
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
            <span className="font-extrabold text-sm tracking-tight text-white">Kitsune Finance</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link href="/docs" className="text-zinc-400 hover:text-white transition-colors">
            Docs
          </Link>
          <Link href="/changelog" className="text-zinc-400 hover:text-white transition-colors">
            Changelog
          </Link>
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-extrabold transition-all"
          >
            Acessar
          </Link>
        </div>
      </header>

      {/* Conteúdo dos Termos */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 space-y-8">
        <div className="space-y-2 border-b border-[#27272A] pb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Termos de Uso & Soberania de Dados
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Última revisão: 01 de Novembro de 2026 • Versão 3.3
          </p>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Princípio da Soberania & Permissão Estrita de Leitura (Read-Only)</h2>
            <p>
              O Kitsune Finance opera exclusivamente com permissões de consulta e leitura de extratos bancários e posições de investimentos através dos protocolos oficiais de Open Finance do Banco Central do Brasil. A plataforma e seus agentes autônomos <strong>não possuem e jamais solicitarão autorização para movimentar fundos</strong>, realizar transações Pix, efetuar pagamentos ou realizar transferências em nome do usuário.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Privacidade & Conformidade com a LGPD</h2>
            <p>
              Em estrito cumprimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018), todo dado financeiro trafegado é criptografado em trânsito (TLS 1.3) e em repouso (AES-256). A base de dados PostgreSQL no Supabase impõe políticas mandatórias de <strong>Row Level Security (FORCE RLS)</strong>, garantindo isolamento total onde apenas o proprietário autenticado possui visibilidade sobre seus próprios ativos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Zero Treinamento de Modelos Públicos</h2>
            <p>
              Suas consultas e movimentações financeiras <strong>nunca são utilizadas para treinar modelos de inteligência artificial de terceiros</strong>. Os endpoints de inferência (Google AI Studio e Groq) operam sob acordos estritos de <em>Zero Data Retention</em> para processamento efêmero em memória.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">4. Desconexão & Exclusão Soberana</h2>
            <p>
              Você detém poder absoluto sobre suas informações. A revogação de qualquer instituição bancária ou exclusão de conta pode ser realizada a qualquer momento com um único clique nas configurações da plataforma, acarretando a eliminação imediata e definitiva dos dados de conexões e histórico.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

