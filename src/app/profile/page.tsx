"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { createClient } from "@/utils/supabase/client";

const FINANCIAL_GOALS = [
  {
    id: "reserva-emergencia",
    label: "Reserva de Emergência",
    icon: "shield",
    desc: "Blindar de 3 a 6 meses de custo de vida para imprevistos.",
  },
  {
    id: "quitar-dividas",
    label: "Zerar Faturas & Dívidas",
    icon: "credit_score",
    desc: "Amortizar cartões e viver 100% no positivo sem juros.",
  },
  {
    id: "independencia-fire",
    label: "Independência Financeira (FIRE)",
    icon: "rocket_launch",
    desc: "Construir patrimônio gerador de renda passiva mensal.",
  },
  {
    id: "aquisicao-imovel",
    label: "Compra de Imóvel ou Carro",
    icon: "home",
    desc: "Acumular entrada com aportes previsíveis e sem pressa.",
  },
  {
    id: "viagens-experiencias",
    label: "Viagens & Projetos de Vida",
    icon: "flight_takeoff",
    desc: "Planejar grandes sonhos sem recorrer a empréstimos.",
  },
];

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
];

export default function ProfilePage() {
  const { user, userProfile, updateUserProfileLocal, accounts, revalidate } = useFinanceData();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState<number | string>("");
  const [selectedGoal, setSelectedGoal] = useState<string>("reserva-emergencia");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicializa dados do formulário quando o perfil carrega
  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || "");
      setDisplayName(userProfile.display_name || "");
      setMonthlyIncome(userProfile.monthly_income ?? "");
      setSelectedGoal(userProfile.financial_goal || "reserva-emergencia");
      setAvatarUrl(userProfile.avatar_url || "");
    } else if (user) {
      const defaultName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
      setFullName(defaultName);
      setDisplayName(defaultName);
    }
  }, [userProfile, user]);

  // Upload ou seleção de foto local via Base64 para visualização imediata
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("A imagem deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const numIncome = monthlyIncome === "" ? null : Number(monthlyIncome);

      const { error } = await supabase
        .from("users_profile")
        .upsert(
          {
            id: user.id,
            full_name: fullName.trim(),
            display_name: displayName.trim(),
            financial_goal: selectedGoal,
            monthly_income: numIncome,
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      updateUserProfileLocal({
        full_name: fullName.trim(),
        display_name: displayName.trim(),
        financial_goal: selectedGoal,
        monthly_income: numIncome,
        avatar_url: avatarUrl || null,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      revalidate(true);
    } catch (err: any) {
      console.error("[Profile Save Error]:", err);
      setErrorMessage(err.message || "Erro ao salvar perfil. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Simulação pedagógica da Regra 50/30/20 com base na renda declarada
  const incomeCalculations = useMemo(() => {
    const inc = Number(monthlyIncome) || 0;
    if (inc <= 0) return null;
    return {
      necessidades: inc * 0.5,
      desejos: inc * 0.3,
      poupanca: inc * 0.2,
    };
  }, [monthlyIncome]);

  return (
    <div className="w-full min-h-screen bg-[#0F141C] text-[#F8FAFC] px-4 md:px-8 py-8 max-w-5xl mx-auto flex flex-col gap-8">
      {/* Header com estilo Warm Obsidian & Human-Centric */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#263042] pb-6">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141A24] border border-[#263042] w-fit">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="text-xs text-[#94A3B8] font-medium">
              Espaço Pessoal & Configurações
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
            Meu Perfil & Planejamento
          </h1>
          <p className="text-sm text-[#94A3B8] max-w-xl">
            Mantenha suas informações e renda atualizadas para que a Kitsune IA calibre diagnósticos e tetos de gastos com máxima precisão.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="h-10 px-4 rounded-xl bg-[#141A24] hover:bg-[#1C2331] border border-[#263042] text-xs font-semibold text-[#F8FAFC] flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Voltar ao Início
        </Link>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        {/* Bloco 1: Foto e Identidade */}
        <section className="bg-[#141A24] border border-[#263042] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start gap-8 shadow-sm">
          {/* Avatar com preview dinâmico */}
          <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
            <div className="relative group">
              <div className="w-28 h-28 rounded-3xl overflow-hidden bg-[#1C2331] border-2 border-[#263042] flex items-center justify-center relative shadow-lg">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Foto do perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-[#94A3B8]">
                    person
                  </span>
                )}
                {/* Overlay de hover para troca */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-medium cursor-pointer transition-opacity"
                >
                  <span className="material-symbols-outlined text-2xl mb-1">
                    photo_camera
                  </span>
                  Alterar foto
                </label>
              </div>

              {/* Botão flutuante de câmera no mobile */}
              <label
                htmlFor="avatar-upload"
                className="md:hidden absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-[#FF6B00] text-white flex items-center justify-center shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  photo_camera
                </span>
              </label>

              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />
            </div>

            <div className="flex flex-col items-center text-center">
              <span className="text-xs text-[#94A3B8]">Formatos: JPG ou PNG</span>
              <span className="text-[11px] text-[#94A3B8]/70">Máx. 2MB</span>
            </div>

            {/* Presets rápidos de Avatar */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider">
                Modelos:
              </span>
              <div className="flex items-center gap-1.5">
                {PRESET_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className="w-6 h-6 rounded-full overflow-hidden border border-[#263042] hover:border-[#FF6B00] transition-colors cursor-pointer"
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Campos de Nome e E-mail */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#F8FAFC]">
                Nome Completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Jefherson Luiz da Silva"
                required
                className="w-full h-12 px-4 rounded-xl bg-[#0F141C] border border-[#263042] focus:border-[#FF6B00] outline-none text-sm text-[#F8FAFC] transition-colors"
              />
              <span className="text-[11px] text-[#94A3B8]">
                Utilizado para registros de auditoria e relatórios formais.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#F8FAFC]">
                Nome de Tratamento (Como a IA te chama)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Jefherson"
                required
                className="w-full h-12 px-4 rounded-xl bg-[#0F141C] border border-[#263042] focus:border-[#FF6B00] outline-none text-sm text-[#F8FAFC] transition-colors"
              />
              <span className="text-[11px] text-[#94A3B8]">
                Nome acolhedor usado pela Kitsune AI em conversas diárias.
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-xs font-semibold text-[#94A3B8]">
                E-mail da Conta (Protegido por Autenticação)
              </label>
              <div className="w-full h-12 px-4 rounded-xl bg-[#0F141C]/60 border border-[#263042]/70 text-sm text-[#94A3B8] flex items-center justify-between select-none">
                <span>{user?.email || "carregando..."}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Google Auth Verificado
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Bloco 2: Renda Mensal Declarada & Calculadora 50/30/20 */}
        <section className="bg-[#141A24] border border-[#263042] rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-[#F8FAFC]">
                  Renda Mensal Líquida
                </h2>
                <span className="text-xs text-[#94A3B8]">
                  Atualize sempre que houver aumento, bônus ou mudança salarial.
                </span>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] text-xs font-bold">
              Calibração Ativa da IA
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Input de Renda */}
            <div className="md:col-span-5 flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#F8FAFC]">
                Valor Líquido Mensal (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#94A3B8]">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-14 pl-12 pr-4 rounded-xl bg-[#0F141C] border border-[#263042] focus:border-[#FF6B00] outline-none text-xl font-bold tabular-nums text-[#F8FAFC] transition-colors"
                />
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                Usado para calcular automaticamente sua margem de sobrevivência e teto de gastos no cartão.
              </span>
            </div>

            {/* Painel da Regra 50/30/20 */}
            <div className="md:col-span-7 bg-[#0F141C] border border-[#263042] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-[#F8FAFC]">
                <span>Divisão Recomendada (Regra de Ouro 50/30/20)</span>
                <span className="text-[#FF6B00] font-semibold">Teto Sugerido</span>
              </div>

              {incomeCalculations ? (
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-[#141A24] border border-[#263042] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8]">
                      50% Essencial
                    </span>
                    <span className="text-sm font-bold text-[#F8FAFC] tabular-nums mt-0.5">
                      R$ {incomeCalculations.necessidades.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">Moradia, luz, mercado</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#141A24] border border-[#263042] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-[#FF6B00]">
                      30% Estilo de Vida
                    </span>
                    <span className="text-sm font-bold text-[#FF6B00] tabular-nums mt-0.5">
                      R$ {incomeCalculations.desejos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">Lazer, streaming, saídas</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#141A24] border border-[#263042] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-[#10B981]">
                      20% Futuro / Reserva
                    </span>
                    <span className="text-sm font-bold text-[#10B981] tabular-nums mt-0.5">
                      R$ {incomeCalculations.poupanca.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">Investimentos & Metas</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-[#94A3B8]">
                  Digite sua renda ao lado para ver a distribuição de teto de gastos recomendada.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bloco 3: Objetivo Financeiro Principal */}
        <section className="bg-[#141A24] border border-[#263042] rounded-3xl p-6 md:p-8 flex flex-col gap-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">flag</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-bold text-[#F8FAFC]">
                Objetivo Financeiro Atual
              </h2>
              <span className="text-xs text-[#94A3B8]">
                A Kitsune AI adapta suas recomendações de corte de gastos de acordo com essa meta.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
            {FINANCIAL_GOALS.map((goal) => {
              const isSelected = selectedGoal === goal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2.5 cursor-pointer relative ${
                    isSelected
                      ? "bg-[#FF6B00]/10 border-[#FF6B00] shadow-[0_0_24px_-4px_rgba(255,107,0,0.25)]"
                      : "bg-[#0F141C] border-[#263042] hover:bg-[#1C2331]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? "bg-[#FF6B00] text-white"
                          : "bg-[#141A24] text-[#94A3B8]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {goal.icon}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-xl text-[#FF6B00]">
                        check_circle
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[#F8FAFC]">
                      {goal.label}
                    </span>
                    <span className="text-xs text-[#94A3B8] leading-relaxed">
                      {goal.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Mensagens de Sucesso ou Erro */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center gap-3 text-sm text-[#10B981] font-medium animate-in fade-in">
            <span className="material-symbols-outlined text-xl">check_circle</span>
            <span>Perfil atualizado com sucesso! A Kitsune AI já sincronizou suas novas metas.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center gap-3 text-sm text-[#EF4444] font-medium animate-in fade-in">
            <span className="material-symbols-outlined text-xl">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Barra de Ação Inferior */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            href="/dashboard"
            className="h-12 px-6 rounded-xl bg-[#141A24] hover:bg-[#1C2331] border border-[#263042] text-sm font-semibold text-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={isSaving}
            className="h-12 px-8 rounded-xl bg-[#FF6B00] hover:bg-[#FF7D1A] active:bg-[#E05E00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,107,0,0.35)] transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">
                  refresh
                </span>
                <span>Salvando alterações...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">save</span>
                <span>Salvar Perfil</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
