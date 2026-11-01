"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useFinanceData } from "@/context/FinanceDataContext";
import {
  isBiometricsAvailable,
  getBiometricSettings,
  saveBiometricSettings,
  registerBiometricCredential,
  verifyBiometricCredential,
  type BiometricSettings,
} from "@/utils/security/biometrics";
import Spinner from "@/components/Spinner";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de Biometria PWA (WebAuthn W3C)
  const [hasBiometricHardware, setHasBiometricHardware] = useState<boolean>(false);
  const [biometricConfig, setBiometricConfig] = useState<BiometricSettings | null>(null);
  const [isProcessingBiometrics, setIsProcessingBiometrics] = useState<boolean>(false);

  useEffect(() => {
    isBiometricsAvailable().then((supported) => setHasBiometricHardware(supported));
  }, []);

  useEffect(() => {
    if (user?.id) {
      setBiometricConfig(getBiometricSettings(user.id));
    }
  }, [user?.id]);

  const handleRegisterBiometrics = async () => {
    if (!user?.id || !user?.email) return;
    setIsProcessingBiometrics(true);
    setErrorMessage(null);
    try {
      const res = await registerBiometricCredential(user.id, user.email);
      if (res.success) {
        setBiometricConfig(getBiometricSettings(user.id));
        setSuccessMessage("Autenticação biométrica ativada com sucesso neste dispositivo!");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Falha ao registrar credencial biométrica.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado.");
    } finally {
      setIsProcessingBiometrics(false);
    }
  };

  const handleDisableBiometrics = () => {
    if (!user?.id) return;
    saveBiometricSettings(user.id, { enabled: false });
    setBiometricConfig(getBiometricSettings(user.id));
    setSuccessMessage("Bloqueio biométrico desativado.");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleChangeTimeout = (seconds: number) => {
    if (!user?.id) return;
    saveBiometricSettings(user.id, { lockTimeoutSeconds: seconds });
    setBiometricConfig(getBiometricSettings(user.id));
  };

  const handleTestBiometrics = async () => {
    if (!biometricConfig) return;
    setIsProcessingBiometrics(true);
    setErrorMessage(null);
    try {
      const res = await verifyBiometricCredential(biometricConfig.credentialId);
      if (res.success) {
        setSuccessMessage("Biometria reconhecida com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3500);
      } else {
        setErrorMessage(res.error || "Falha no reconhecimento biométrico.");
      }
    } finally {
      setIsProcessingBiometrics(false);
    }
  };

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
      await fetch("/api/chat", { method: "DELETE" });
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
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-4xl mx-auto w-full font-sans">
      {/* Header Estilo Wealthfolio */}
      <header className="flex flex-col gap-1 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div className="flex items-center gap-2">
          <WfIcons.Settings className="w-5 h-5 text-[#FF8216]" />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
            Configurações & Preferências
          </h1>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Personalize a segurança biométrica, parâmetros do assistente de inteligência e exportações de dados.
        </p>
      </header>

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WfIcons.ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* SEÇÃO 1: GUARDIÃO BIOMÉTRICO (WEBAUTHN / FACE ID / TOUCH ID) */}
      <section className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#FF8216]">fingerprint</span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
                Guardião Biométrico & Cortina PWA
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Proteja seus saldos e faturas contra visualização indevida no multitarefa do celular e bloqueie o app via hardware seguro (Face ID / Digital).
            </p>
          </div>

          <div className="shrink-0">
            {biometricConfig?.enabled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Ativo no Aparelho</span>
              </span>
            ) : hasBiometricHardware ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-[#18181B] text-zinc-500 border border-zinc-200 dark:border-[#27272A]">
                <span>Disponível</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/12 text-amber-500 border border-amber-500/25">
                <span>Hardware Ausente</span>
              </span>
            )}
          </div>
        </div>

        {/* Detalhes de Configuração */}
        <div className="pt-2 border-t border-zinc-100 dark:border-[#27272A] space-y-4">
          {!hasBiometricHardware ? (
            <p className="text-xs text-zinc-500">
              Este navegador ou dispositivo não possui suporte a autenticador de plataforma compatível com WebAuthn (Face ID, Touch ID ou leitor de impressão digital).
            </p>
          ) : !biometricConfig?.enabled ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-[#F4F4F5]">
                  Ativar Bloqueio por Biometria
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Gera uma credencial criptográfica Passkey W3C armazenada no Secure Enclave deste aparelho.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRegisterBiometrics}
                disabled={isProcessingBiometrics}
                className="h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FF9438] text-black text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isProcessingBiometrics ? (
                  <>
                    <Spinner size={14} className="text-black" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                    <span>Cadastrar Biometria</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Seletor de Tempo de Bloqueio */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Tempo para Bloquear ao Sair do App (Cortina de Privacidade)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { sec: 0, label: "Imediato (0s)" },
                    { sec: 15, label: "15 Segundos" },
                    { sec: 60, label: "1 Minuto" },
                    { sec: 300, label: "5 Minutos" },
                  ].map((opt) => {
                    const isSel = biometricConfig.lockTimeoutSeconds === opt.sec;
                    return (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() => handleChangeTimeout(opt.sec)}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium font-mono tabular-nums transition-colors cursor-pointer ${
                          isSel
                            ? "bg-[#FF8216]/12 border-[#FF8216] text-[#FF8216] font-bold"
                            : "bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500">
                  A Cortina de Privacidade oculta imediatamente os saldos na miniatura do multitarefa ao minimizar a aba ou trocar de aplicativo.
                </p>
              </div>

              {/* Botões de Ação da Biometria */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleTestBiometrics}
                  disabled={isProcessingBiometrics}
                  className="h-9 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#FF8216]">fingerprint</span>
                  <span>Testar Biometria Agora</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisableBiometrics}
                  className="h-9 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-medium text-rose-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Desativar Bloqueio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 2: TEMA VISUAL & INTERFACE */}
      <section className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#FF8216]">palette</span>
            Tema Visual & Interface
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Alterne entre o tema escuro (Warm Obsidian) e o tema claro com contraste otimizado.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
              theme === "dark"
                ? "border-[#FF8216] bg-[#FF8216]/10 text-zinc-900 dark:text-white font-bold ring-1 ring-[#FF8216]"
                : "border-zinc-200 dark:border-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#18181B] text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-[#FF8216]">dark_mode</span>
            <span className="text-xs">Modo Escuro (Obsidian)</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
              theme === "light"
                ? "border-[#FF8216] bg-[#FF8216]/10 text-zinc-900 font-bold ring-1 ring-[#FF8216]"
                : "border-zinc-200 dark:border-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#18181B] text-zinc-600 dark:text-zinc-400"
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
                ? "border-[#FF8216] bg-[#FF8216]/10 text-zinc-900 dark:text-white font-bold ring-1 ring-[#FF8216]"
                : "border-zinc-200 dark:border-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#18181B] text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-zinc-400">devices</span>
            <span className="text-xs">Sistema</span>
          </button>
        </div>
      </section>

      {/* SEÇÃO 3: PREFERÊNCIAS DA KITSUNE AI */}
      <section className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] flex items-center gap-2">
            <WfIcons.Agents className="w-4 h-4 text-[#FF8216]" />
            Inteligência Artificial & Agentes
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Defina o comportamento analítico padrão para suas sessões com os 7 Agentes da Kitsune.
          </p>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Modelo Padrão de Raciocínio
            </label>
            <select
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value)}
              className="p-3 bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-[#FF8216] cursor-pointer"
            >
              <option value="gemini-3.8-flash">✨ Kitsune Smart (Intermediário • Recomendado)</option>
              <option value="gemini-3.5-flash-lite">⚡ Kitsune Flash (Ultra Rápido & Respostas Imediatas)</option>
              <option value="gemini-3.1-pro-preview">🧠 Kitsune Pro Ultra (Máxima Potência & Documentos)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                        : "border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#18181B]"
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

      {/* SEÇÃO 4: DADOS, PRIVACIDADE & BACKUP */}
      <section className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] flex items-center gap-2">
            <WfIcons.ShieldCheck className="w-4 h-4 text-[#FF8216]" />
            Privacidade & Gestão de Dados
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Baixe seus lançamentos estruturados ou limpe históricos locais do navegador.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isExporting ? (
              <Spinner size={14} className="text-[#FF8216]" />
            ) : (
              <WfIcons.Download className="w-4 h-4 text-[#FF8216]" />
            )}
            <span>Exportar Dados em JSON</span>
          </button>

          <button
            type="button"
            onClick={handleClearChatHistory}
            className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-zinc-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-500">delete_sweep</span>
            <span>Limpar Histórico do Chat</span>
          </button>
        </div>

        <div className="pt-2 border-t border-zinc-200 dark:border-[#27272A] flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Conexões Bancárias Open Finance</span>
          <Link
            href="/connections"
            className="text-[#FF8216] font-bold hover:underline flex items-center gap-1"
          >
            Gerenciar Instituições
            <WfIcons.ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* SEÇÃO 5: CONTA & SESSÃO */}
      <section className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Conectado como</span>
          <span className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
            {user?.email || "Usuário Autenticado"}
          </span>
          <span className="text-[11px] text-zinc-500">
            Kitsune Finance v2.1 • Padrão Wealthfolio Warm Obsidian
          </span>
        </div>

        <button
          onClick={handleLogout}
          type="button"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/25 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          <span>Encerrar Sessão</span>
        </button>
      </section>
    </div>
  );
}
