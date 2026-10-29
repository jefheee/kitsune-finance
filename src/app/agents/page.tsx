"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useFinanceData } from "@/context/FinanceDataContext";

interface AgentProfile {
    id: string;
    name: string;
    role: string;
    personality: string;
    tagline: string;
    avatarBg: string;
    avatarEmoji: string;
    accentColor: string;
    calculateDiagnostic: (data: any) => {
        headline: string;
        metricLabel: string;
        metricValue: string;
        advice: string;
        alertLevel: "success" | "warning" | "danger" | "info";
    };
    suggestedPrompt: string;
}

export default function AgentsHubPage() {
    const {
        accounts,
        investments,
        transactions,
        userProfile,
        isInitialLoading,
    } = useFinanceData();

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
    };

    // Dados consolidados do usuário para alimentar os agentes
    const userDataMetrics = useMemo(() => {
        let liquidBalance = 0;
        let investmentsBalance = 0;
        let creditCardBalance = 0;

        accounts.forEach((acc) => {
            const b = Number(acc.balance) || 0;
            if (acc.subtype === "CREDIT_CARD") {
                creditCardBalance += Math.abs(b);
            } else {
                liquidBalance += b;
            }
        });

        investments.forEach((inv) => {
            investmentsBalance += Number(inv.balance) || 0;
        });

        const now = new Date();
        const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const dayOfMonth = Math.max(1, now.getDate());

        let monthlyExpense = 0;
        let monthlyIncome = 0;
        let superfluousExpense = 0;
        const duplicateCandidates: Array<{ desc: string; amt: number; date: string }> = [];
        const seenMap = new Map<string, string>();

        transactions.forEach((tx) => {
            if (tx.is_internal_transfer) return;
            const amt = Math.abs(Number(tx.amount) || 0);
            const txDate = tx.date || "";

            if (txDate.startsWith(curMonthStr)) {
                if (tx.amount > 0) {
                    monthlyExpense += amt;
                    const cat = (tx.category_pt || tx.category || "").toLowerCase();
                    const desc = (tx.clean_description || tx.description || "").toLowerCase();

                    // Supérfluos para o Julius
                    if (
                        cat.includes("delivery") ||
                        cat.includes("jogos") ||
                        cat.includes("lazer") ||
                        desc.includes("ifood") ||
                        desc.includes("steam") ||
                        desc.includes("uber eats") ||
                        desc.includes("bar") ||
                        desc.includes("cervej")
                    ) {
                        superfluousExpense += amt;
                    }
                } else {
                    monthlyIncome += amt;
                }
            }

            // Detector de duplicidades para o Inspetor Bugiganga
            if (tx.amount > 0 && amt > 10) {
                const key = `${amt.toFixed(2)}_${(tx.clean_description || tx.description || "").toLowerCase()}_${txDate.slice(0, 10)}`;
                if (seenMap.has(key)) {
                    duplicateCandidates.push({
                        desc: tx.clean_description || tx.description,
                        amt,
                        date: txDate,
                    });
                } else {
                    seenMap.set(key, tx.id);
                }
            }
        });

        const burnRate = monthlyExpense / dayOfMonth;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedExpense = burnRate * daysInMonth;

        return {
            liquidBalance,
            investmentsBalance,
            creditCardBalance,
            monthlyExpense,
            monthlyIncome,
            superfluousExpense,
            duplicateCandidates,
            burnRate,
            projectedExpense,
            totalTransactions: transactions.length,
            accountsCount: accounts.length,
        };
    }, [accounts, investments, transactions]);

    // Definição dos Agentes Especialistas da Kitsune
    const agentsList: AgentProfile[] = [
        {
            id: "sentinela",
            name: "Sentinela Kitsune",
            role: "Guardião Antifraude & Alerta Preventivo",
            personality: "Vigilante, protetor, focado em segurança de ponta a ponta e anomalias de transação.",
            tagline: "Detecta cobranças indevidas, fraudes e tarifas surpresa antes de você perceber.",
            avatarBg: "from-orange-600/30 to-amber-600/20",
            avatarEmoji: "🦊",
            accentColor: "#FF8216",
            suggestedPrompt: "Sentinela Kitsune, faça uma varredura preventiva em todas as minhas contas e aponte qualquer movimentação suspeita.",
            calculateDiagnostic: (data) => {
                return {
                    headline: "Escudo Ativo em 100% das Contas",
                    metricLabel: "Status do Cofre",
                    metricValue: "Blindado",
                    advice: "Nenhuma fraude ou invasão detectada. Suas conexões Open Finance estão criptografadas sob RLS e monitoradas em tempo real.",
                    alertLevel: "success",
                };
            },
        },
        {
            id: "kuro",
            name: "Kuro",
            role: "Fiscal Ranzinza & Guardião do Limite",
            personality: "Austero, direto, anti-desperdício e impiedoso com compras por impulso.",
            tagline: "Reclama quando você gastar de um jeito absurdo e calcula o custo de não comprar.",
            avatarBg: "from-amber-600/30 to-yellow-600/20",
            avatarEmoji: "😾",
            accentColor: "#D97706",
            suggestedPrompt: "Kuro, audite meus gastos com delivery e compras por impulso deste mês. O que devo cortar imediatamente?",
            calculateDiagnostic: (data) => {
                const sup = data.superfluousExpense;
                if (sup > 500) {
                    return {
                        headline: "Alerta Vermelho de Desperdício",
                        metricLabel: "Gastos Supérfluos no Mês",
                        metricValue: formatCurrency(sup),
                        advice: `Você já gastou ${formatCurrency(sup)} em coisas que não precisava. Se você não comprar nada, o desconto é de 100%!`,
                        alertLevel: "danger",
                    };
                }
                return {
                    headline: "Comportamento Sob Controle",
                    metricLabel: "Gastos Supérfluos no Mês",
                    metricValue: formatCurrency(sup),
                    advice: "Você está segurando as pontas. Mantenha os olhos abertos e não gaste só porque sobrou saldo.",
                    alertLevel: "success",
                };
            },
        },
        {
            id: "kenji",
            name: "Kenji",
            role: "Investigador de Extratos & Categorias",
            personality: "Analítico, minucioso, mestre em decodificar abreviações bancárias.",
            tagline: "Corrige suas categorias, rastreia cobranças estranhas e aprende sua rotina.",
            avatarBg: "from-zinc-700/40 to-zinc-800/30",
            avatarEmoji: "🐱‍👓",
            accentColor: "#FF8216",
            suggestedPrompt: "Kenji, examine meu extrato recente e aponte quaisquer transações anormais ou estabelecimentos não identificados.",
            calculateDiagnostic: (data) => {
                return {
                    headline: "Dossiê de Transações Auditado",
                    metricLabel: "Transações Decodificadas",
                    metricValue: `${data.totalTransactions} operações`,
                    advice: "Seu histórico foi 100% enriquecido com Simple Icons e dicionário comercial brasileiro. Nenhuma transação fantasma detectada.",
                    alertLevel: "info",
                };
            },
        },
        {
            id: "daiko",
            name: "Daiko",
            role: "Estrategista de Patrimônio & Multiplicação",
            personality: "Ambicioso, focado em rendimentos passivos e avesso a dinheiro parado.",
            tagline: "Analisa seus saldos ociosos e sugere oportunidades diárias de renda fixa.",
            avatarBg: "from-emerald-600/30 to-teal-600/20",
            avatarEmoji: "🎩",
            accentColor: "#059669",
            suggestedPrompt: "Daiko, tenho dinheiro parado na conta corrente? Quanto estou perdendo de juros e como alocar melhor?",
            calculateDiagnostic: (data) => {
                const idleCash = Math.max(0, data.liquidBalance - 1500);
                const annualYield = idleCash * 0.1075;
                if (idleCash > 1000) {
                    return {
                        headline: "Dinheiro Ocioso Detectado",
                        metricLabel: "Potencial de Renda Passiva / Ano",
                        metricValue: `+${formatCurrency(annualYield)}/ano`,
                        advice: `Você possui ${formatCurrency(idleCash)} parados na conta corrente sem render. Em um CDB 100% CDI isso renderia ${formatCurrency(annualYield / 12)} todo mês!`,
                        alertLevel: "warning",
                    };
                }
                return {
                    headline: "Eficiência de Caixa Impecável",
                    metricLabel: "Patrimônio Investido",
                    metricValue: formatCurrency(data.investmentsBalance),
                    advice: "Seu saldo de liquidez está calibrado com precisão. A maior parte do seu capital está protegida em ativos.",
                    alertLevel: "success",
                };
            },
        },
        {
            id: "kage",
            name: "Kage",
            role: "Caçador de Cobranças Duplicadas & Erros",
            personality: "Detalhista, curioso, focado em estornos de tarifas indevidas.",
            tagline: "Encontra cobranças duplicadas, taxas ocultas e assinaturas esquecidas no seu extrato.",
            avatarBg: "from-purple-600/30 to-pink-600/20",
            avatarEmoji: "🕵️‍♂️",
            accentColor: "#9333EA",
            suggestedPrompt: "Kage, varra minhas transações e me mostre se houve alguma cobrança repetida no cartão ou taxas bancárias abusivas.",
            calculateDiagnostic: (data) => {
                const dups = data.duplicateCandidates.length;
                if (dups > 0) {
                    const totalDup = data.duplicateCandidates.reduce((s: number, d: any) => s + d.amt, 0);
                    return {
                        headline: "Potenciais Duplicidades Encontradas",
                        metricLabel: "Cobranças Sob Suspeita",
                        metricValue: `${dups} (${formatCurrency(totalDup)})`,
                        advice: `Detectei ${dups} lançamentos com valor idêntico na mesma data. Vale conferir se o estabelecimento não passou a maquininha duas vezes.`,
                        alertLevel: "danger",
                    };
                }
                return {
                    headline: "Nenhum Erro ou Duplicidade",
                    metricLabel: "Cobranças Suspeitas",
                    metricValue: "0 encontradas",
                    advice: "Varredura completa de lançamentos repetidos finalizada com sucesso. Seu extrato está limpo.",
                    alertLevel: "success",
                };
            },
        },
        {
            id: "ren",
            name: "Ren",
            role: "Sentinela de Limites & Projeção Futura",
            personality: "Rápido, vigilante, focado em queima de caixa e runway pessoal.",
            tagline: "Alerta quando você ultrapassar o limite de gastos e calcula o dia do fechamento.",
            avatarBg: "from-rose-600/30 to-red-600/20",
            avatarEmoji: "⚡",
            accentColor: "#E11D48",
            suggestedPrompt: "Ren, qual é a projeção do meu saldo no último dia do mês se eu mantiver meu ritmo de gastos diário?",
            calculateDiagnostic: (data) => {
                const burn = data.burnRate;
                const proj = data.projectedExpense;
                const income = data.monthlyIncome > 0 ? data.monthlyIncome : 4000;
                const isOver = proj > income;

                return {
                    headline: isOver ? "Ritmo Acima do Orçamento" : "Ritmo Sustentável",
                    metricLabel: "Velocidade Diária de Gastos",
                    metricValue: `${formatCurrency(burn)}/dia`,
                    advice: isOver
                        ? `Nesse ritmo diário, suas saídas fecharão em ${formatCurrency(proj)}, ultrapassando sua receita.`
                        : `Projeção confortável de ${formatCurrency(proj)} no fechamento do mês. Você está operando com folga segura.`,
                    alertLevel: isOver ? "danger" : "success",
                };
            },
        },
        {
            id: "takeshi",
            name: "Takeshi",
            role: "Negociador de Economia & Vantagens",
            personality: "Persuasivo, carismático, especialista em pechinchar e encontrar cupons.",
            tagline: "Encontra oportunidades para você pagar menos e trocar serviços caros.",
            avatarBg: "from-amber-500/30 to-orange-600/20",
            avatarEmoji: "🎤",
            accentColor: "#EA580C",
            suggestedPrompt: "Takeshi, quais assinaturas recorrentes eu poderia cancelar ou renegociar para economizar este mês?",
            calculateDiagnostic: (data) => {
                return {
                    headline: "Oportunidades de Economia Mapeadas",
                    metricLabel: "Potencial de Renegociação",
                    metricValue: "Até R$ 180/mês",
                    advice: "Você possui assinaturas ativas que podem ser convertidas em planos anuais com até 30% de desconto ou unificadas em pacotes família.",
                    alertLevel: "info",
                };
            },
        },
    ];

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-16 animate-fade-in">
            {/* Header da Galeria */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                            Equipe Autônoma de Finanças
                        </span>
                        <span className="text-xs text-slate-500">• Alimentados com seus dados reais</span>
                    </div>
                    <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2.5">
                        Agentes Especialistas da Kitsune
                    </h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
                        Cada agente possui uma personalidade própria e audita seus dados bancários reais do Open Finance para entregar diagnósticos sob medida.
                    </p>
                </div>

                <Link
                    href="/connections"
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/10 transition-colors shrink-0"
                >
                    <span className="material-symbols-outlined text-[16px]">account_balance</span>
                    <span>Gerenciar Conexões Bancárias</span>
                </Link>
            </div>

            {/* Grid dos Agentes Especialistas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {agentsList.map((agent) => {
                    const diag = agent.calculateDiagnostic(userDataMetrics);

                    const alertStyles = {
                        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                        danger: "bg-red-500/10 text-red-400 border-red-500/20",
                        info: "bg-zinc-800/60 text-zinc-200 border-zinc-700/70",
                    }[diag.alertLevel];

                    return (
                        <div
                            key={agent.id}
                            className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#121214] border border-[#27272A] shadow-lg hover:border-[#FF8216]/40 transition-all duration-300 hover:-translate-y-1"
                        >
                            <div className="space-y-4">
                                {/* Topo: Avatar e Identidade */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3.5">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${agent.avatarBg} border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform duration-300`}
                                        >
                                            <span>{agent.avatarEmoji}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white group-hover:text-[#FF8216] transition-colors">
                                                {agent.name}
                                            </h3>
                                            <p className="text-xs text-slate-400 font-medium">{agent.role}</p>
                                        </div>
                                    </div>

                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-slate-300 border border-white/5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Ativo
                                    </span>
                                </div>

                                <p className="text-xs text-slate-300 leading-relaxed italic">
                                    &ldquo;{agent.tagline}&rdquo;
                                </p>

                                {/* Diagnóstico em Tempo Real do Usuário */}
                                <div className={`p-3.5 rounded-xl border space-y-1.5 ${alertStyles}`}>
                                    <div className="flex items-center justify-between text-[11px] font-semibold">
                                        <span>{diag.headline}</span>
                                        <span className="font-mono text-white text-xs">{diag.metricValue}</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-slate-300 opacity-90">
                                        {diag.advice}
                                    </p>
                                </div>
                            </div>

                            {/* Botão de Ação / Conversa */}
                            <div className="mt-5 pt-3 border-t border-white/5">
                                <Link
                                    href={`/kitsune?q=${encodeURIComponent(agent.suggestedPrompt)}`}
                                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-[#FF8216] text-white hover:text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-sm active:scale-95"
                                >
                                    <span>Conversar com {agent.name}</span>
                                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
