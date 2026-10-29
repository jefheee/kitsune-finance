"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BankLogo } from "@/components/BankLogo";

interface TransactionLike {
    id: string;
    description?: string;
    clean_description?: string | null;
    amount: number | string;
    category?: string | null;
    category_pt?: string | null;
    type?: string;
    is_subscription?: boolean;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
    total_installments?: number | null;
    date?: string;
    executed_at?: string;
    value_date?: string;
    bank_accounts?: {
        bank_name?: string;
        institution_name?: string;
        institution_slug?: string;
        product_name?: string;
    };
}

interface SubscriptionsTrackerProps {
    transactions: TransactionLike[];
    formatCurrency: (val: number) => string;
}

interface SubscriptionItem {
    id: string;
    name: string;
    category: string;
    amount: number;
    bankName: string;
    bankSlug: string;
    lastBillingDate: string;
    nextBillingDate: string;
    paymentCount: number;
    icon: string;
}

const KNOWN_SUB_META: Record<string, { name: string; category: string; icon: string }> = {
    spotify: { name: "Spotify", category: "Streaming de Música", icon: "music_note" },
    netflix: { name: "Netflix", category: "Streaming de Vídeo", icon: "movie" },
    "google one": { name: "Google One", category: "Armazenamento em Nuvem", icon: "cloud" },
    youtube: { name: "YouTube (Google)", category: "Vídeo & Streaming", icon: "play_circle" },
    "ifood club": { name: "iFood Club", category: "Clube de Benefícios", icon: "restaurant" },
    "meli+": { name: "Meli+ (Mercado Livre)", category: "Assinatura & Streaming", icon: "shopping_bag" },
    melimais: { name: "Meli+ (Mercado Livre)", category: "Assinatura & Streaming", icon: "shopping_bag" },
    "amazon prime": { name: "Amazon Prime", category: "Compras & Streaming", icon: "shopping_bag" },
    wellhub: { name: "Wellhub (Gympass)", category: "Academia & Bem-Estar", icon: "fitness_center" },
    gympass: { name: "Wellhub (Gympass)", category: "Academia & Bem-Estar", icon: "fitness_center" },
    apple: { name: "Apple Services", category: "Serviços Digitais", icon: "phone_iphone" },
    chatgpt: { name: "ChatGPT Plus (OpenAI)", category: "Inteligência Artificial", icon: "smart_toy" },
    openai: { name: "OpenAI", category: "Inteligência Artificial", icon: "smart_toy" },
    claude: { name: "Anthropic Claude", category: "Inteligência Artificial", icon: "auto_awesome" },
    disney: { name: "Disney+", category: "Streaming de Vídeo", icon: "movie" },
    globoplay: { name: "Globoplay", category: "Streaming de Vídeo", icon: "live_tv" },
    canva: { name: "Canva Pro", category: "Design & Criatividade", icon: "palette" },
};

export function SubscriptionsTracker({ transactions, formatCurrency }: SubscriptionsTrackerProps) {
    const subscriptions: SubscriptionItem[] = useMemo(() => {
        const subsMap = new Map<string, SubscriptionItem>();

        transactions.forEach((t) => {
            if (t.is_internal_transfer || t.is_refund) return;
            if (t.total_installments && t.total_installments > 1) return;

            const rawLabel = t.clean_description || t.description || "";
            const descLower = rawLabel.toLowerCase();
            const amt = Math.abs(Number(t.amount) || 0);
            const isExpense = t.type === "DEBIT" || t.type === "OUTFLOW" || Number(t.amount) < 0;
            if (!isExpense || amt === 0) return;

            let matchedKey: string | null = null;
            for (const key of Object.keys(KNOWN_SUB_META)) {
                if (descLower.includes(key)) {
                    matchedKey = key;
                    break;
                }
            }

            const isFlaggedSub = Boolean(t.is_subscription || matchedKey);
            if (!isFlaggedSub) return;

            const groupKey = matchedKey || rawLabel.trim().toLowerCase();
            const meta = matchedKey
                ? KNOWN_SUB_META[matchedKey]
                : {
                      name: rawLabel.trim() || "Assinatura Recorrente",
                      category: t.category_pt || t.category || "Serviços Digitais",
                      icon: "autorenew",
                  };

            const rawDate = t.date || t.executed_at || t.value_date;
            const tDate = rawDate ? new Date(rawDate) : new Date();

            const bankName =
                t.bank_accounts?.institution_name ||
                t.bank_accounts?.bank_name ||
                "Instituição Conectada";
            const bankSlug = t.bank_accounts?.institution_slug || bankName;

            if (subsMap.has(groupKey)) {
                const current = subsMap.get(groupKey)!;
                current.paymentCount += 1;
            } else {
                const nextDate = new Date(tDate);
                nextDate.setMonth(nextDate.getMonth() + 1);

                subsMap.set(groupKey, {
                    id: groupKey,
                    name: meta.name,
                    category: meta.category,
                    amount: amt,
                    bankName,
                    bankSlug,
                    lastBillingDate: tDate.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                    }),
                    nextBillingDate: nextDate.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                    }),
                    paymentCount: 1,
                    icon: meta.icon,
                });
            }
        });

        return Array.from(subsMap.values()).sort((a, b) => b.amount - a.amount);
    }, [transactions]);

    const totalMonthly = subscriptions.reduce((acc, s) => acc + s.amount, 0);
    const annualProjection = totalMonthly * 12;
    const averagePerService = subscriptions.length > 0 ? totalMonthly / subscriptions.length : 0;

    return (
        <div className="flex flex-col gap-5">
            {/* 4 Cards de Métricas Reais de Assinaturas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Assinaturas Reais
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
                            {subscriptions.length}
                        </span>
                        <span className="text-[11px] text-slate-400">detectadas</span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Gasto Mensal
                    </span>
                    <div className="mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(totalMonthly)}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Projeção Anual
                    </span>
                    <div className="mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-[#FF8216] tabular-nums">
                            {formatCurrency(annualProjection)}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Média / Serviço
                    </span>
                    <div className="mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(averagePerService)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Lista de Assinaturas Reais ou Empty State */}
            <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Serviços Recorrentes Identificados ({subscriptions.length})
                    </h3>
                    <span className="text-[11px] text-slate-400">
                        100% baseado nas suas transações Open Finance
                    </span>
                </div>

                {subscriptions.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                        <span className="material-symbols-outlined text-3xl text-slate-400">
                            subscriptions
                        </span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                            Nenhuma assinatura recorrente detectada neste filtro
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                            Quando cobranças recorrentes (como Spotify, Netflix, Google One, Wellhub, iFood Club ou Meli+) aparecerem nas suas contas ou cartões conectados, elas serão listadas automaticamente aqui.
                        </p>
                    </div>
                ) : (
                    subscriptions.map((sub) => (
                        <div
                            key={sub.id}
                            className="p-3.5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] hover:border-[#FF8216]/40 transition-colors flex items-center justify-between gap-3 shadow-xs"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <BankLogo bank={sub.bankSlug} size="sm" />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                                            {sub.name}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#18181B] text-slate-500 dark:text-slate-300 font-medium">
                                            {sub.category}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                        <span>Última: {sub.lastBillingDate}</span>
                                        <span>•</span>
                                        <span>Próxima est.: {sub.nextBillingDate}</span>
                                        <span>•</span>
                                        <span>{sub.paymentCount} cobrança(s) no histórico</span>
                                        <span>•</span>
                                        <span className="text-[#FF8216] font-semibold">{sub.bankName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white tabular-nums block">
                                        {formatCurrency(sub.amount)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">/cobrança</span>
                                </div>
                                <Link
                                    href={`/kitsune?prompt=${encodeURIComponent(
                                        `Kitsune AI, gostaria de auditar minha assinatura de "${sub.name}" no valor de ${formatCurrency(
                                            sub.amount
                                        )} por cobrança (impacto anual estimado de ${formatCurrency(
                                            sub.amount * 12
                                        )}). Vale a pena manter esse serviço ou cortar/otimizar?`
                                    )}`}
                                    title="Auditar assinatura com a Kitsune AI"
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#18181B] dark:hover:bg-[#27272A] flex items-center justify-center text-slate-500 hover:text-[#FF8216] transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
