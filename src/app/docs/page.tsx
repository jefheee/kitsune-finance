"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Spinner from "@/components/Spinner";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  affectedFiles?: string;
  items: string[];
}

interface DocSection {
  id: string;
  title: string;
  content: string;
}

const ITEMS_PER_PAGE = 6;

function RenderDocContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2.5 text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Checkbox completed: - [x]
        if (trimmed.startsWith("- [x]") || trimmed.startsWith("* [x]")) {
          const text = trimmed.replace(/^[-*]\s*\[x\]\s*/i, "");
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#18181B] border border-[#27272A]/80 shadow-xs"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                ✓
              </span>
              <span className="text-zinc-200">{text}</span>
            </div>
          );
        }

        // Subheading: ###
        if (trimmed.startsWith("###")) {
          return (
            <h3
              key={idx}
              className="text-sm font-bold text-white pt-4 pb-1.5 border-b border-[#27272A]/60 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
              <span>{trimmed.replace(/^###\s*/, "")}</span>
            </h3>
          );
        }

        // Subheading: ####
        if (trimmed.startsWith("####")) {
          return (
            <h4 key={idx} className="text-xs font-bold text-zinc-200 pt-2 text-zinc-100">
              {trimmed.replace(/^####\s*/, "")}
            </h4>
          );
        }

        // Standard bullet: - or *
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const text = trimmed.replace(/^[-*]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mt-2 shrink-0" />
              <span className="text-zinc-300">{text}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-zinc-300">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function DocsHubContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "docs";

  const [activeTab, setActiveTab] = useState<"docs" | "changelog" | "terms">("docs");
  const [activeSection, setActiveSection] = useState<string>("overview");

  // Dados carregados dos arquivos reais
  const [changelogData, setChangelogData] = useState<ChangelogEntry[]>([]);
  const [docSections, setDocSections] = useState<DocSection[]>([]);
  const [loading, setLoading] = useState(true);

  // Paginação do Changelog
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (initialTab === "changelog" || initialTab === "terms" || initialTab === "docs") {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/docs/content");
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.changelog)) setChangelogData(data.changelog);
          if (Array.isArray(data.projectState) && data.projectState.length > 0) {
            setDocSections(data.projectState);
            setActiveSection(data.projectState[0].id);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar conteúdo de documentação:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 90;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Paginação do Changelog
  const totalPages = Math.ceil(changelogData.length / ITEMS_PER_PAGE);
  const currentChangelog = changelogData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-[#E11D48] selection:text-white">
      {/* Top Navbar Unificada */}
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-[#27272A] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center">
              <Image
                src="/assets/logo/logo-transparent.png"
                alt="Kitsune"
                width={24}
                height={24}
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white group-hover:text-zinc-200">
              Kitsune Hub
            </span>
          </Link>
          <span className="px-2 py-0.5 rounded-md bg-[#E11D48]/15 text-[#E11D48] text-[10px] font-mono font-bold">
            Docs & Engenharia
          </span>
        </div>

        {/* SELETOR DE ABAS UNIFICADAS NO TOPO */}
        <div className="flex items-center p-1 rounded-xl bg-[#121214] border border-[#27272A] text-xs font-semibold">
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "docs"
                ? "bg-white text-black shadow-xs font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">menu_book</span>
            <span>Documentação</span>
          </button>

          <button
            onClick={() => setActiveTab("changelog")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "changelog"
                ? "bg-white text-black shadow-xs font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">history</span>
            <span>Changelog ({changelogData.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("terms")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "terms"
                ? "bg-white text-black shadow-xs font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">verified_user</span>
            <span>Termos & Privacidade</span>
          </button>
        </div>

        {/* Ações Direitas */}
        <div className="flex items-center gap-3 text-xs">
          <a
            href="https://github.com/jefheee/kitsune-finance"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-white font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">code</span>
            <span>GitHub</span>
          </a>
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-extrabold transition-all"
          >
            Acessar
          </Link>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL COM TRANSIÇÃO ENTRE ABAS */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Spinner size={24} className="mx-auto text-zinc-400" />
            <p className="text-xs text-zinc-500 font-mono">Carregando documentação viva...</p>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* ABA 1: DOCUMENTAÇÃO & ARQUITETURA (Consome PROJECT_STATE.md) */}
            {/* ======================================================== */}
            {activeTab === "docs" && (
              <div className="flex flex-col md:flex-row gap-8 animate-in fade-in duration-200">
                {/* Sumário Esquerdo Fixo */}
                <aside className="w-full md:w-64 shrink-0 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold mb-3 px-2">
                    Sumário da Arquitetura
                  </p>
                  <div className="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
                    {docSections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => scrollToSection(sec.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                          activeSection === sec.id
                            ? "bg-[#18181B] text-white border border-[#27272A] shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-[#121214]"
                        }`}
                      >
                        <span className="truncate">{sec.title}</span>
                        {activeSection === sec.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-6 px-2">
                    <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#27272A] space-y-2">
                      <p className="text-xs font-bold text-white">Código Aberto</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Clone o projeto ou acompanhe a evolução no GitHub.
                      </p>
                      <a
                        href="https://github.com/jefheee/kitsune-finance"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#E11D48] hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>Repositório GitHub</span>
                        <span>→</span>
                      </a>
                    </div>
                  </div>
                </aside>

                {/* Conteúdo Principal de Documentação */}
                <main className="flex-1 space-y-8 min-w-0">
                  {docSections.map((sec) => (
                    <section
                      key={sec.id}
                      id={sec.id}
                      className="p-6 sm:p-8 rounded-3xl bg-[#121214] border border-[#27272A] space-y-4 shadow-xl scroll-mt-24"
                    >
                      <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight border-b border-[#27272A] pb-3">
                        {sec.title}
                      </h2>
                      <RenderDocContent content={sec.content} />
                    </section>
                  ))}
                </main>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 2: CHANGELOG COMPLETO & PAGINADO (Consome CHANGELOG.md) */}
            {/* ======================================================== */}
            {activeTab === "changelog" && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
                <div className="space-y-1 border-b border-[#27272A] pb-4">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Histórico Oficial de Releases & Atualizações
                  </h1>
                  <p className="text-xs text-zinc-400">
                    Sincronizado diretamente do arquivo oficial de changelog do projeto ({changelogData.length} entregas catalogadas).
                  </p>
                </div>

                <div className="space-y-6 relative before:absolute before:inset-0 before:left-4 md:before:left-6 before:w-0.5 before:bg-[#27272A]">
                  {currentChangelog.map((rel, idx) => (
                    <div key={`${rel.version}-${idx}`} className="relative pl-10 md:pl-14 space-y-2">
                      <div className="absolute left-2.5 md:left-4.5 top-2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#E11D48] border-4 border-[#0A0A0A]" />

                      <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-3 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#27272A]">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-mono font-bold text-xs">
                              {rel.date || rel.version}
                            </span>
                            {idx === 0 && currentPage === 1 && (
                              <span className="px-2 py-0.5 rounded-md bg-[#E11D48]/20 text-[#E11D48] font-mono text-[10px] font-bold uppercase">
                                Versão Atual
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                          {rel.title}
                        </h3>

                        {rel.affectedFiles && (
                          <p className="text-[11px] font-mono text-zinc-500 truncate">
                            Arquivos: {rel.affectedFiles}
                          </p>
                        )}

                        <ul className="space-y-1.5 text-xs text-zinc-300">
                          {rel.items.map((it, itemIdx) => (
                            <li key={itemIdx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{it}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CONTROLES DE PAGINAÇÃO */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-6 border-t border-[#27272A]">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      ← Anterior
                    </button>

                    <div className="flex items-center gap-1 font-mono text-xs">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          onClick={() => setCurrentPage(pg)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            currentPage === pg
                              ? "bg-white text-black"
                              : "bg-[#18181B] text-zinc-400 hover:text-white"
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 3: TERMOS DE USO & PRIVACIDADE */}
            {/* ======================================================== */}
            {activeTab === "terms" && (
              <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1 border-b border-[#27272A] pb-4">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Termos de Uso & Soberania de Dados
                  </h1>
                  <p className="text-xs text-zinc-400 font-mono">
                    Conformidade com a LGPD e Princípio de Leitura Estrita (Read-Only)
                  </p>
                </div>

                <div className="p-8 rounded-3xl bg-[#121214] border border-[#27272A] space-y-6 text-sm text-zinc-300 leading-relaxed shadow-xl">
                  <section className="space-y-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#E11D48]">visibility</span>
                      <span>1. Modelo Estritamente Read-Only</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      O Kitsune Finance opera exclusivamente com permissão de leitura de extratos bancários e posições de investimentos. Nenhum modelo de IA ou membro da equipe possui autorização técnica para movimentar fundos, efetuar transferências Pix ou pagamentos.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-emerald-400">shield</span>
                      <span>2. Criptografia & LGPD</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Todos os dados são criptografados com TLS 1.3 em trânsito e AES-256 em repouso. O banco PostgreSQL no Supabase aplica Row Level Security (FORCE RLS) em todas as tabelas públicas, isolando seus registros de forma intransponível por usuário.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-400">lock</span>
                      <span>3. Zero Treinamento de IAs Públicas</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Suas transações e patrimônio pessoal nunca são compartilhados ou utilizados para treinar modelos de inteligência artificial de terceiros (Zero Data Retention).
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-purple-400">delete_forever</span>
                      <span>4. Desconexão e Exclusão Instantânea</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      A revogação de acessos de bancos ou exclusão total de registros pode ser realizada a qualquer momento com um único clique nas configurações do sistema.
                    </p>
                  </section>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DocsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <Spinner size={24} className="text-white" />
        </div>
      }
    >
      <DocsHubContent />
    </Suspense>
  );
}
