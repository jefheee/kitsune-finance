"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useFinanceData } from "@/context/FinanceDataContext";
import Spinner from "@/components/Spinner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const {
    user,
    userProfile,
    accounts,
    transactions,
    selectedAiModel,
    setSelectedAiModel,
    reasoningLevel,
    setReasoningLevel,
    setChatMessages,
  } = useFinanceData();

  const [isExporting, setIsExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleExportData = () => {
    setIsExporting(true);
    try {
      const exportPayload = {
        exportDate: new Date().toISOString(),
        user: {
          id: user?.id,
          email: user?.email,
          displayName: userProfile?.display_name,
          monthlyIncome: userProfile?.monthly_income,
          financialGoal: userProfile?.financial_goal,
        },
        accountsSummary: accounts.map((a) => ({
          institutionName: a.institution_name || a.bank_name,
          institutionSlug: a.institution_slug,
          productName: a.product_name,
          type: a.type,
          subtype: a.subtype,
          balance: a.balance,
          creditLimit: a.credit_limit,
          availableCreditLimit: a.available_credit_limit,
          accountNumber: a.account_number,
          currency: a.currency,
        })),
        transactions: transactions.map((t) => ({
          description: t.clean_description || t.description,
          rawDescription: t.raw_description,
          amount: t.amount,
          type: t.type,
          operationType: t.operation_type,
          categoryPt: t.category_pt || t.category,
          isInternalTransfer: t.is_internal_transfer,
          isRefund: t.is_refund,
          isSubscription: t.is_subscription,
          installmentNumber: t.installment_number,
          totalInstallments: t.total_installments,
          date: t.executed_at || t.date,
        })),
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kitsune-finance-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage("Backup JSON com dados Open Finance baixado com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert("Erro ao exportar dados: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearChatHistory = async () => {
    const confirmed = window.confirm(
      "Deseja realmente limpar o histórico de conversas com a Kitsune AI (local e no servidor)?"
    );
    if (!confirmed) return;

    try {
      await fetch('/api/chat', { method: 'DELETE' });
    } catch (err) {
      console.warn("Falha ao limpar histórico no servidor:", err);
    }

    if (typeof window !== "undefined" && user?.id) {
      window.localStorage.removeItem(`kitsune_${user.id}_saved_sessions_v2`);
      window.localStorage.removeItem(`kitsune_${user.id}_chat_sessions`);
    }
    setChatMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content:
          "Histórico reiniciado. Como posso te auxiliar no seu planejamento patrimonial hoje?",
        timestamp: new Date().toISOString(),
        modelUsed: selectedAiModel,
      },
    ]);
    setSuccessMessage("Histórico de conversas reiniciado.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-4xl mx-auto w-full font-sans">
      {/* Header */}
      <header className="flex flex-col gap-1 pb-4 border-b border-slate-200 dark:border-[#262E3D]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FF8216]">settings</span>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
            Configurações & Preferências
          </h1>
        </div>
        <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8]">
          Personalize sua experiência visual, parâmetros do assistente de inteligência e segurança.
        </p>
      </header>

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Seção 1: Tema & Aparência */}
      <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#FF8216]">palette</span>
            Tema Visual & Interface
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Alterne entre o tema escuro e o tema claro com contraste e legibilidade balanceados.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
              theme === "dark"
                ? "border-[#FF8216] bg-[#FF8216]/10 text-slate-900 dark:text-white font-bold ring-1 ring-[#FF8216]"
                : "border-slate-200 dark:border-[#262E3D] hover:bg-slate-50 dark:hover:bg-[#161B26] text-slate-600 dark:text-[#94A3B8]"
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-[#FF8216]">dark_mode</span>
            <span className="text-xs">Modo Escuro</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
              theme === "light"
                ? "border-[#FF8216] bg-[#FF8216]/10 text-slate-900 font-bold ring-1 ring-[#FF8216]"
                : "border-slate-200 dark:border-[#262E3D] hover:bg-slate-50 dark:hover:bg-[#161B26] text-slate-600 dark:text-[#94A3B8]"
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-[#FF8216]">light_mode</span>
            <span className="text-xs">Modo Claro</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              theme === "system"
                ? "border-[#FF8216] bg-[#FF8216]/10 text-slate-900 dark:text-white font-bold ring-1 ring-[#FF8216]"
                : "border-slate-200 dark:border-[#262E3D] hover:bg-slate-50 dark:hover:bg-[#161B26] text-slate-600 dark:text-[#94A3B8]"
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-slate-400">devices</span>
            <span className="text-xs">Sistema</span>
          </button>
        </div>
      </section>

      {/* Seção 2: Preferências da Kitsune AI */}
      <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#FF8216]">auto_awesome</span>
            Inteligência Artificial & Consultoria
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Defina o comportamento analítico padrão para suas sessões com a Kitsune AI.
          </p>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          {/* Seletor de Modelo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Modelo Padrão de Raciocínio
            </label>
            <select
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value)}
              className="p-3 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value="auto">✨ Automático (Roteamento Dinâmico por Complexidade)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Equilíbrio & Velocidade)</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Ultra Rápido & Baixo Consumo)</option>
              <option value="gemini-4-argon">Gemini 4 Argon (Raciocínio Profundo & Cenários)</option>
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Groq LPU)</option>
            </select>
          </div>

          {/* Nível de Raciocínio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Profundidade das Respostas
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["fast", "standard", "deep"] as const).map((level) => {
                const isSelected = reasoningLevel === level;
                const labels = {
                  fast: "Rápido",
                  standard: "Padrão",
                  deep: "Profundo",
                };
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setReasoningLevel(level)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#FF8216] bg-[#FF8216]/10 text-[#FF8216] font-bold"
                        : "border-slate-200 dark:border-[#262E3D] text-slate-600 dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#161B26]"
                    }`}
                  >
                    {labels[level]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Seção 3: Dados, Privacidade & Backup */}
      <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#FF8216]">shield</span>
            Privacidade & Gestão de Dados
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Baixe seus lançamentos estruturados ou limpe históricos locais do navegador.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A202C] dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-slate-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isExporting ? (
              <Spinner size={14} className="text-[#FF8216]" />
            ) : (
              <span className="material-symbols-outlined text-[18px] text-[#FF8216]">download</span>
            )}
            <span>Exportar Dados em JSON</span>
          </button>

          <button
            type="button"
            onClick={handleClearChatHistory}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A202C] dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-slate-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-500">delete_sweep</span>
            <span>Limpar Histórico do Chat</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-[#262E3D] flex items-center justify-between text-xs text-slate-500 dark:text-[#94A3B8]">
          <span>Conexões Bancárias Open Finance</span>
          <Link
            href="/agents"
            className="text-[#FF8216] font-bold hover:underline flex items-center gap-1"
          >
            Gerenciar Instituições
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Seção 4: Conta & Sessão */}
      <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500 dark:text-[#94A3B8]">Conectado como</span>
          <span className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
            {user?.email || "Usuário Autenticado"}
          </span>
          <span className="text-[11px] text-slate-400">
            Kitsune Finance v0.2.0 • Código Aberto sob Licença MIT
          </span>
        </div>

        <button
          onClick={handleLogout}
          type="button"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          <span>Encerrar Sessão</span>
        </button>
      </section>
    </div>
  );
}
