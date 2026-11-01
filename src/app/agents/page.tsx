"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";
import {
    runAllDeterministicMacroTools,
    type SharedPartnerInput,
} from "@/utils/ai/deterministic-tools";
import {
    KITSUNE_AGENTS_REGISTRY,
    type MacroToolIdentifier,
} from "@/utils/ai/kitsune-agents-registry";

const MACRO_TOOL_LABELS: Record<MacroToolIdentifier, string> = {
    get_balance_sheet_xray: "X-Ray & FGC",
    get_income_statement: "DRE Operacional",
    simulate_debt_payoff: "CET & Avalanche",
    compare_fixed_income_br: "CDI DU/252 & Fisher",
    audit_anomalies_and_subscriptions: "Forense & 2σ",
    shared_space_reconciler: "Rateio Proporcional",
};

export default function AgentsHubPage() {
    const {
        accounts,
        investments,
        loans,
        transactions,
        userProfile,
        familyMembers,
        activePartner,
        sharedConnection,
        isInitialLoading,
        isPrivacyMode,
    } = useFinanceData();

    const formatCurrency = useMemo(
        () => (val: number) => {
            if (isPrivacyMode) return "R$ ••••••";
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
            }).format(Number(val) || 0);
        },
        [isPrivacyMode]
    );

    const maskIfPrivacy = (text: string) => {
        if (!isPrivacyMode) return text;
        return text.replace(/R\$\s*-?[\d.,]+/g, "R$ ••••••");
    };

    // Execução 100% Determinística das 5 Macro-Tools sobre os dados reais do usuário
    const deterministicBundle = useMemo(() => {
        const sharedPartners: SharedPartnerInput[] = [];
        if (activePartner && sharedConnection?.status === "accepted") {
            sharedPartners.push({
                id: activePartner.id,
                name:
                    activePartner.display_name ||
                    activePartner.full_name ||
                    "Parceiro(a)",
                role: sharedConnection.role || "Familiar",
            });
        }

        return runAllDeterministicMacroTools({
            accounts,
            investments,
            loans,
            transactions,
            profile: userProfile,
            familyMembers,
            sharedPartners,
        });
    }, [
        accounts,
        investments,
        loans,
        transactions,
        userProfile,
        familyMembers,
        activePartner,
        sharedConnection,
    ]);

    const xray = deterministicBundle.balanceSheetAndXRay;
    const fixedIncome = deterministicBundle.fixedIncomeAndGoals;

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 pt-6 md:pt-8 pb-28 md:pb-10 max-w-6xl mx-auto w-full font-sans animate-fade-in">
            {/* Header da Central Multi-Agente */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#18181B] border border-[#27272A] text-[11px] font-mono text-[#FF8216] mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216]" />
                        <span>MOTOR DETERMINÍSTICO MSLR • ZERO ALUCINAÇÃO</span>
                    </div>
                    <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2.5">
                        Agentes Especialistas da Kitsune
                    </h1>
                    <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-2xl">
                        Os 7 agentes operam acoplados ao motor matemático determinístico (DU/252 B3, IR/IOF regressivo, Fisher, CET Newton-Raphson e FGC) sobre seus dados reais do Open Finance.
                    </p>
                </div>

                <Link
                    href="/connections"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A]/80 text-zinc-200 font-semibold text-xs border border-[#27272A] transition-colors shrink-0 min-h-[44px]"
                >
                    <span className="material-symbols-outlined text-[16px] text-[#FF8216]">
                        account_balance
                    </span>
                    <span>Gerenciar Conexões Bancárias</span>
                </Link>
            </div>

            {/* Barra Executiva do Motor Determinístico */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] flex flex-col justify-between gap-1">
                    <span className="text-[11px] font-medium text-zinc-400">
                        Kitsune Health Score
                    </span>
                    <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="text-lg md:text-xl font-bold font-mono text-white tabular-nums">
                            {isInitialLoading
                                ? "..."
                                : isPrivacyMode
                                  ? "••/100"
                                  : `${xray.kitsuneScore}/100`}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FF8216]/15 text-[#FF8216] border border-[#FF8216]/30">
                            {xray.statusLabel}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] flex flex-col justify-between gap-1">
                    <span className="text-[11px] font-medium text-zinc-400">
                        Patrimônio Líquido Auditado
                    </span>
                    <span className="text-lg md:text-xl font-bold font-mono text-white tabular-nums mt-0.5">
                        {isInitialLoading ? "..." : formatCurrency(xray.balanceSheet.netWorth)}
                    </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] flex flex-col justify-between gap-1">
                    <span className="text-[11px] font-medium text-zinc-400">
                        Exposição Acima do Teto FGC
                    </span>
                    <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="text-lg md:text-xl font-bold font-mono text-white tabular-nums">
                            {isInitialLoading ? "..." : formatCurrency(xray.totalUncoveredFGC)}
                        </span>
                        <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                xray.totalUncoveredFGC > 0
                                    ? "bg-red-500/10 text-red-400 border-red-500/25"
                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                            }`}
                        >
                            {xray.totalUncoveredFGC > 0 ? "Alerta >250k" : "100% Coberto"}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] flex flex-col justify-between gap-1">
                    <span className="text-[11px] font-medium text-zinc-400">
                        Juro Real da Carteira (Fisher)
                    </span>
                    <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="text-lg md:text-xl font-bold font-mono text-emerald-400 tabular-nums">
                            {isInitialLoading
                                ? "..."
                                : isPrivacyMode
                                  ? "••% a.a."
                                  : `+${fixedIncome.portfolioSummary.weightedRealAnnualFisherPct.toFixed(2)}% a.a.`}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                            IPCA {fixedIncome.macroRates.annualIPCAPct}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid dos 7 Agentes Especialistas Oficiais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {KITSUNE_AGENTS_REGISTRY.map((agent) => {
                    const diag = agent.buildLiveDiagnostic(
                        deterministicBundle,
                        formatCurrency,
                        isPrivacyMode
                    );

                    const alertStyles = {
                        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                        danger: "bg-red-500/10 text-red-400 border-red-500/20",
                        info: "bg-[#18181B] text-zinc-200 border-[#27272A]",
                    }[diag.alertLevel];

                    return (
                        <div
                            key={agent.id}
                            className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#121214] border border-[#27272A] hover:border-[#FF8216]/45 transition-all duration-300 hover:-translate-y-0.5"
                        >
                            <div className="space-y-4">
                                {/* Topo: Avatar e Identidade */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3.5">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${agent.avatarBg} border border-[#27272A] flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform duration-300`}
                                        >
                                            <span>{agent.avatarEmoji}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white group-hover:text-[#FF8216] transition-colors">
                                                {agent.name}
                                            </h3>
                                            <p className="text-xs text-zinc-400 font-medium leading-snug">
                                                {agent.role}
                                            </p>
                                        </div>
                                    </div>

                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#18181B] text-zinc-300 border border-[#27272A] shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        MSLR
                                    </span>
                                </div>

                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    &ldquo;{agent.tagline}&rdquo;
                                </p>

                                {/* Badges das Macro-Tools Conectadas */}
                                <div className="flex flex-wrap gap-1.5">
                                    {agent.consumedTools.map((toolId) => (
                                        <span
                                            key={toolId}
                                            className="px-2 py-0.5 rounded-md bg-[#18181B] border border-[#27272A] text-[10px] font-mono text-zinc-400"
                                        >
                                            {MACRO_TOOL_LABELS[toolId]}
                                        </span>
                                    ))}
                                </div>

                                {/* Diagnóstico Determinístico Vivo */}
                                <div className={`p-3.5 rounded-xl border space-y-2 ${alertStyles}`}>
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                        <span className="truncate">{diag.headline}</span>
                                        <span className="font-mono text-white text-xs tabular-nums shrink-0">
                                            {maskIfPrivacy(diag.metricValue)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-[11px]">
                                        <span className="text-zinc-400">{diag.secondaryLabel}</span>
                                        <span className="font-mono text-zinc-200 tabular-nums">
                                            {maskIfPrivacy(diag.secondaryValue)}
                                        </span>
                                    </div>

                                    <p className="text-[11px] leading-relaxed text-zinc-300 pt-0.5">
                                        {maskIfPrivacy(diag.advice)}
                                    </p>
                                </div>
                            </div>

                            {/* Botão de Ação Direta no Chat Kitsune AI */}
                            <div className="mt-5 pt-3 border-t border-[#27272A]">
                                <Link
                                    href={`/kitsune?prompt=${encodeURIComponent(agent.suggestedPrompt)}`}
                                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#18181B] hover:bg-[#FF8216] text-white hover:text-black font-semibold text-xs border border-[#27272A] hover:border-[#FF8216] flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
                                >
                                    <span>Acionar {agent.name}</span>
                                    <span className="material-symbols-outlined text-[16px]">
                                        arrow_forward
                                    </span>
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
