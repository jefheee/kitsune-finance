"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useFinanceData } from "@/context/FinanceDataContext";
import Spinner from "@/components/Spinner";

const FINANCIAL_GOALS = [
  {
    id: "Controlar gastos",
    title: "Controlar Gastos",
    desc: "Auditar despesas invisíveis, assinaturas e faturas de cartão.",
    icon: "track_changes",
  },
  {
    id: "Investir e multiplicar",
    title: "Investir & Multiplicar",
    desc: "Otimizar aportes mensais e acompanhar evolução patrimonial.",
    icon: "trending_up",
  },
  {
    id: "Construir reserva",
    title: "Reserva de Emergência",
    desc: "Blindar liquidez e organizar caixa com segurança.",
    icon: "shield",
  },
  {
    id: "Gestão familiar",
    title: "Planejamento Familiar",
    desc: "Consolidar contas pessoais e conjuntas num único lugar.",
    icon: "diversity_3",
  },
];

export default function OnboardingModal() {
  const { user, userProfile, isInitialLoading, updateUserProfileLocal } =
    useFinanceData();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("Controlar gastos");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(
        userProfile.display_name ||
          userProfile.full_name ||
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          ""
      );
      if (userProfile.financial_goal) {
        setSelectedGoal(userProfile.financial_goal);
      }
      if (userProfile.monthly_income) {
        setMonthlyIncome(String(userProfile.monthly_income));
      }
    }
  }, [userProfile, user]);

  // Só exibe se o usuário estiver autenticado, carregamento inicial concluído e onboarding_completed === false
  if (isInitialLoading || !user || !userProfile || userProfile.onboarding_completed) {
    return null;
  }

  const completeOnboarding = async (redirectToAgents: boolean) => {
    setIsSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const parsedIncome = monthlyIncome
        ? Number(monthlyIncome.replace(",", "."))
        : null;

      const payload = {
        id: user.id,
        display_name: displayName.trim() || "Investidor",
        financial_goal: selectedGoal,
        monthly_income:
          parsedIncome !== null && !isNaN(parsedIncome) ? parsedIncome : null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("users_profile")
        .upsert(payload, { onConflict: "id" });

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      updateUserProfileLocal({
        display_name: payload.display_name,
        financial_goal: payload.financial_goal,
        monthly_income: payload.monthly_income,
        onboarding_completed: true,
      });

      if (redirectToAgents) {
        router.push("/agents");
      }
    } catch (err: any) {
      setError(err.message || "Não foi possível salvar suas preferências.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900/95 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 text-zinc-100">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-kitsune text-xl">
              auto_awesome
            </span>
            <span className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-400">
              Configuração Inicial • Etapa {step} de 3
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === idx
                    ? "w-6 bg-kitsune"
                    : step > idx
                    ? "w-3 bg-kitsune/50"
                    : "w-3 bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-sans text-red-400">
            {error}
          </div>
        )}

        {/* ETAPA 1: Perfil e Objetivo */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl md:text-2xl font-bold font-sans text-white">
                Bem-vindo ao Kitsune Finance
              </h2>
              <p className="text-xs md:text-sm text-zinc-400 font-sans mt-1">
                Personalize como a Kitsune AI deve chamar você e calibrar suas análises patrimoniais.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-semibold text-zinc-300">
                  Como prefere ser chamado?
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Jefherson"
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-sans text-white focus:outline-none focus:border-kitsune"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-semibold text-zinc-300">
                  Renda Mensal Estimada (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  placeholder="Opcional (ex: 8500)"
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-mono text-white focus:outline-none focus:border-kitsune"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-sans font-semibold text-zinc-300">
                Qual é o seu objetivo principal?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FINANCIAL_GOALS.map((goal) => {
                  const active = selectedGoal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedGoal(goal.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                        active
                          ? "bg-amber-500/10 border-kitsune text-white"
                          : "bg-zinc-950/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-sans font-bold">
                          {goal.title}
                        </span>
                        <span
                          className={`material-symbols-outlined text-[18px] ${
                            active ? "text-kitsune" : "text-zinc-500"
                          }`}
                        >
                          {goal.icon}
                        </span>
                      </div>
                      <span className="text-[11px] font-sans text-zinc-400 leading-snug">
                        {goal.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!displayName.trim()}
              className="w-full py-3.5 rounded-2xl bg-kitsune hover:bg-kitsune/90 text-white font-sans font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continuar</span>
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          </div>
        )}

        {/* ETAPA 2: Guia Ilustrado Open Finance (3 Passos) */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl md:text-2xl font-bold font-sans text-white">
                Como funciona o Open Finance
              </h2>
              <p className="text-xs md:text-sm text-zinc-400 font-sans mt-1">
                Conecte seus bancos reais em 3 passos simples com privacidade absoluta:
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 font-mono font-bold text-sm">
                  1
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-sans font-bold text-white">
                    Inicie o Conector Meu Pluggy
                  </span>
                  <span className="text-xs font-sans text-zinc-400 leading-relaxed">
                    Escolha sua instituição bancária (Nubank, Itaú, Inter, BTG, etc.) no widget criptografado.
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 font-mono font-bold text-sm">
                  2
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-sans font-bold text-white">
                    Autorize apenas Leitura no App do Banco
                  </span>
                  <span className="text-xs font-sans text-zinc-400 leading-relaxed">
                    O acesso é 100% somente-leitura via Open Finance Brasil. Nenhuma senha bancária fica salva.
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 font-mono font-bold text-sm">
                  3
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-sans font-bold text-white">
                    Blindagem Multi-Tenant & Kitsune AI
                  </span>
                  <span className="text-xs font-sans text-zinc-400 leading-relaxed">
                    Dados sensíveis (CPF/endereço) são descartados e apenas seus saldos e lançamentos alimentam sua IA.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-sans font-semibold text-xs transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3.5 rounded-2xl bg-kitsune hover:bg-kitsune/90 text-white font-sans font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Próximo Passo</span>
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: Conexão Imediata ou Ir para a Dashboard */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="text-center flex flex-col items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-2xl bg-kitsune/15 text-kitsune flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">
                  rocket_launch
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold font-sans text-white">
                Tudo pronto, {displayName}!
              </h2>
              <p className="text-xs md:text-sm text-zinc-400 font-sans max-w-md">
                Seu espaço isolado está configurado com foco em{" "}
                <span className="text-amber-400 font-semibold">
                  {selectedGoal}
                </span>
                . Deseja conectar sua primeira conta bancária agora ou ir direto para o painel?
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => completeOnboarding(true)}
                className="w-full py-3.5 rounded-2xl bg-kitsune hover:bg-kitsune/90 text-white font-sans font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-kitsune/20"
              >
                {isSaving ? (
                  <Spinner size={18} className="text-white" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">
                    add_link
                  </span>
                )}
                <span>Conectar Instituição Bancária Agora</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => completeOnboarding(false)}
                className="w-full py-3 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 font-sans font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                Prosseguir para a Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
