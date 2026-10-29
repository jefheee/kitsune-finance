"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import { createClient } from "@/utils/supabase/client";
import Spinner from "@/components/Spinner";
import { BankLogo } from "@/components/BankLogo";

const FINANCIAL_GOALS = [
    {
        id: "emergency_fund",
        label: "Reserva de Emergência",
        desc: "Blindar de 3 a 6 meses de custo de vida para imprevistos.",
        icon: "shield",
    },
    {
        id: "debt_freedom",
        label: "Zerar Faturas & Dívidas",
        desc: "Amortizar cartões e viver 100% no positivo sem juros.",
        icon: "credit_card_off",
    },
    {
        id: "fire_investing",
        label: "Independência Financeira (FIRE)",
        desc: "Construir patrimônio gerador de renda passiva mensal.",
        icon: "rocket_launch",
    },
    {
        id: "asset_growth",
        label: "Crescimento & Alocação Estratégica",
        desc: "Otimizar diversificação entre CDI, Ações e Fundos.",
        icon: "trending_up",
    },
    {
        id: "real_estate",
        label: "Conquista de Imóvel / Veículo",
        desc: "Poupar para entrada ou aquisição planejada de bens.",
        icon: "home",
    },
    {
        id: "travel_lifestyle",
        label: "Projetos Pessoais & Viagens",
        desc: "Garantir experiências sem comprometer o fluxo de caixa.",
        icon: "flight_takeoff",
    },
];

export default function ProfilePage() {
    const { user, userProfile, updateUserProfileLocal } = useFinanceData();

    const [fullName, setFullName] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [monthlyIncome, setMonthlyIncome] = useState<number | string>("");
    const [financialGoal, setFinancialGoal] = useState("debt_freedom");

    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (userProfile) {
            setFullName(userProfile.full_name || "");
            setDisplayName(
                userProfile.display_name ||
                    userProfile.full_name ||
                    user?.user_metadata?.full_name ||
                    user?.email?.split("@")[0] ||
                    ""
            );
            setAvatarUrl(userProfile.avatar_url || "");
            setMonthlyIncome(
                userProfile.monthly_income !== null && userProfile.monthly_income !== undefined
                    ? userProfile.monthly_income
                    : ""
            );
            if (userProfile.financial_goal) {
                setFinancialGoal(userProfile.financial_goal);
            }
        }
    }, [userProfile, user]);

    const parsedIncome = Number(monthlyIncome) || 0;
    const budget50 = parsedIncome * 0.5;
    const budget30 = parsedIncome * 0.3;
    const budget20 = parsedIncome * 0.2;

    const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("A imagem selecionada é muito grande. O limite máximo é de 2MB.");
            return;
        }

        setIsUploading(true);
        setErrorMessage(null);

        try {
            const supabase = createClient();
            const fileExt = file.name.split(".").pop();
            const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("user-avatars")
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setAvatarUrl(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                const { data: publicUrlData } = supabase.storage
                    .from("user-avatars")
                    .getPublicUrl(filePath);

                setAvatarUrl(publicUrlData.publicUrl);
            }
        } catch {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveAvatar = () => {
        setAvatarUrl("");
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSaving(true);
        setSaveSuccess(false);
        setErrorMessage(null);

        try {
            const supabase = createClient();
            const numericIncome =
                monthlyIncome === "" ? null : Math.max(0, Number(monthlyIncome));

            const payload = {
                id: user.id,
                full_name: fullName.trim() || null,
                display_name: displayName.trim() || fullName.trim() || "Investidor",
                avatar_url: avatarUrl || null,
                monthly_income: numericIncome,
                financial_goal: financialGoal,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from("users_profile")
                .upsert(payload, { onConflict: "id" });

            if (error) {
                throw error;
            }

            updateUserProfileLocal({
                full_name: payload.full_name,
                display_name: payload.display_name,
                avatar_url: payload.avatar_url,
                monthly_income: payload.monthly_income,
                financial_goal: payload.financial_goal,
            });

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3500);
        } catch (err: any) {
            console.error("Erro ao salvar perfil:", err);
            setErrorMessage(err.message || "Erro ao salvar informações do perfil.");
        } finally {
            setIsSaving(false);
        }
    };

    const initials = (displayName || fullName || user?.email || "K").slice(0, 2).toUpperCase();

    return (
        <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 max-w-4xl mx-auto w-full font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#262E3D]">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#FF8216]">person</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
                            Espaço Pessoal & Open Finance
                        </span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
                        Meu Perfil & Identidade Consolidada
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8]">
                        Visualize seus dados unificados entre bancos e calibre suas metas financeiras.
                    </p>
                </div>

                <Link
                    href="/dashboard"
                    className="self-start sm:self-auto h-9 px-4 rounded-xl border border-slate-200 dark:border-[#262E3D] hover:bg-slate-100 dark:hover:bg-[#161B26] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Voltar ao Início
                </Link>
            </div>

            {saveSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>Perfil e metas atualizados com sucesso!</span>
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button
                        onClick={() => setErrorMessage(null)}
                        className="underline cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            )}

            {/* Seção: Perfil Open Finance Consolidado */}
            {(userProfile?.document_mask ||
                (userProfile?.bank_sources && userProfile.bank_sources.length > 0)) && (
                <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl">
                                    verified_user
                                </span>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                                    Perfil Open Finance Consolidado
                                </h2>
                                <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
                                    Consenso automático entre {userProfile?.bank_sources?.length || 1} instituição(ões) financeira(s) conectada(s).
                                </span>
                            </div>
                        </div>
                        {userProfile?.document_mask && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-500 tabular-nums">
                                CPF: {userProfile.document_mask}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                Data de Nascimento
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">
                                {userProfile?.birth_date || "Não informada"}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                Profissão Registrada
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                                {userProfile?.job_title || "Não informada"}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                Telefones Verificados
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                                {userProfile?.phones?.length
                                    ? userProfile.phones.slice(0, 2).join(" • ")
                                    : "Não informado"}
                            </span>
                        </div>
                    </div>

                    {userProfile?.bank_sources && userProfile.bank_sources.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {userProfile.bank_sources.map((src, idx) => (
                                <div
                                    key={`${src.itemId}_${idx}`}
                                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <BankLogo
                                            bank={src.institutionSlug || src.institutionName}
                                            size="xs"
                                        />
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                                {src.institutionName}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block truncate">
                                                {src.fullName}
                                                {src.cityState ? ` • ${src.cityState}` : ""}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-semibold text-emerald-500 shrink-0">
                                        Sincronizado
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-6">
                {/* Bloco 1: Foto e Identidade */}
                <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm">
                    <div className="flex flex-col items-center gap-3 shrink-0">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#1A202C] border-2 border-slate-200 dark:border-[#262E3D] flex items-center justify-center shadow-sm">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="Foto do perfil"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF8216]/20 to-[#FF8216]/5 text-[#FF8216] font-extrabold text-2xl">
                                        {initials}
                                    </div>
                                )}

                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <Spinner size={20} className="text-white" />
                                    </div>
                                )}
                            </div>

                            <label
                                htmlFor="avatar-upload"
                                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#FF8216] hover:bg-[#FFA047] text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105"
                                title="Carregar foto"
                            >
                                <span className="material-symbols-outlined text-[16px]">
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

                        <div className="flex flex-col items-center gap-1">
                            <label
                                htmlFor="avatar-upload"
                                className="text-xs font-semibold text-[#FF8216] hover:underline cursor-pointer"
                            >
                                {avatarUrl ? "Trocar foto" : "Adicionar foto"}
                            </label>
                            {avatarUrl && (
                                <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    className="text-[11px] text-red-500 hover:underline cursor-pointer"
                                >
                                    Remover
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Nome Completo
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Ex: Jefherson Silva"
                                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] focus:border-[#FF8216] outline-none text-xs md:text-sm text-slate-900 dark:text-[#F8FAFC] transition-colors"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Como a Kitsune AI deve te chamar
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Ex: Jefherson"
                                required
                                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] focus:border-[#FF8216] outline-none text-xs md:text-sm text-slate-900 dark:text-[#F8FAFC] transition-colors"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
                                E-mail Vinculado (Autenticado)
                            </label>
                            <div className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-[#0E121A]/60 border border-slate-200 dark:border-[#262E3D] text-xs text-slate-600 dark:text-[#94A3B8] flex items-center justify-between select-none">
                                <span className="truncate">{user?.email || "carregando..."}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Verificado
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bloco 2: Renda Mensal Declarada & Regra 50/30/20 */}
                <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl">payments</span>
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                                    Renda Mensal Líquida
                                </h2>
                                <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
                                    Usado pela IA para estimar seu teto de gastos e margem de sobra real.
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start pt-1">
                        <div className="md:col-span-5 flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Valor Líquido Mensal (R$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    R$
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={monthlyIncome}
                                    onChange={(e) => setMonthlyIncome(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] focus:border-[#FF8216] outline-none text-sm text-slate-900 dark:text-[#F8FAFC] font-semibold tabular-nums"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-7 flex flex-col gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                Divisão Recomendada (Regra de Ouro 50/30/20)
                            </span>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 rounded-lg bg-white dark:bg-[#161B26] border border-slate-200 dark:border-white/5">
                                    <span className="text-[10px] text-slate-400 block">
                                        50% Essencial
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                        R$ {budget50.toFixed(0)}
                                    </span>
                                </div>

                                <div className="p-2 rounded-lg bg-white dark:bg-[#161B26] border border-slate-200 dark:border-white/5">
                                    <span className="text-[10px] text-slate-400 block">
                                        30% Estilo de Vida
                                    </span>
                                    <span className="text-xs font-bold text-[#FF8216] tabular-nums">
                                        R$ {budget30.toFixed(0)}
                                    </span>
                                </div>

                                <div className="p-2 rounded-lg bg-white dark:bg-[#161B26] border border-slate-200 dark:border-white/5">
                                    <span className="text-[10px] text-slate-400 block">
                                        20% Futuro / Invest
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        R$ {budget20.toFixed(0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bloco 3: Objetivo Financeiro Principal */}
                <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">flag</span>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                                Objetivo Patrimonial Ativo
                            </h2>
                            <span className="text-xs text-slate-500 dark:text-[#94A3B8]">
                                A Kitsune AI orienta conselhos priorizando essa meta.
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                        {FINANCIAL_GOALS.map((goal) => {
                            const isSelected = financialGoal === goal.id;
                            return (
                                <button
                                    key={goal.id}
                                    type="button"
                                    onClick={() => setFinancialGoal(goal.id)}
                                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                                        isSelected
                                            ? "border-[#FF8216] bg-[#FF8216]/10 ring-1 ring-[#FF8216]"
                                            : "border-slate-200 dark:border-[#262E3D] hover:bg-slate-50 dark:hover:bg-[#161B26]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`material-symbols-outlined text-xl ${
                                                isSelected ? "text-[#FF8216]" : "text-slate-400"
                                            }`}
                                        >
                                            {goal.icon}
                                        </span>
                                        {isSelected && (
                                            <span className="material-symbols-outlined text-[16px] text-[#FF8216]">
                                                check_circle
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span
                                            className={`text-xs font-bold ${
                                                isSelected
                                                    ? "text-[#FF8216]"
                                                    : "text-slate-800 dark:text-slate-200"
                                            }`}
                                        >
                                            {goal.label}
                                        </span>
                                        <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-snug mt-0.5">
                                            {goal.desc}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="h-11 px-6 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {isSaving ? (
                            <>
                                <Spinner size={16} className="text-white" />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">save</span>
                                <span>Salvar Informações</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
