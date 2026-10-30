"use client";

import { useMemo, useState } from "react";
import { BankLogo } from "@/components/BankLogo";

interface TransactionLike {
    id: string;
    description?: string;
    clean_description?: string | null;
    amount: number | string;
    category?: string | null;
    category_pt?: string | null;
    type?: string;
    operation_type?: string | null;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
    installment_number?: number | null;
    total_installments?: number | null;
    total_purchase_amount?: number | null;
    date?: string;
    executed_at?: string;
    value_date?: string;
    bank_accounts?: {
        bank_name?: string;
        institution_name?: string;
        institution_slug?: string;
        product_name?: string;
        type?: string;
    };
}

interface InstallmentsTrackerProps {
    transactions: TransactionLike[];
    formatCurrency: (val: number) => string;
}

interface InstallmentItem {
    id: string;
    description: string;
    category: string;
    date: string;
    currentInstallment: number;
    totalInstallments: number;
    installmentAmount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    remainingCount: number;
    bankName: string;
    bankSlug: string;
    productName: string;
}

export function InstallmentsTracker({ transactions, formatCurrency }: InstallmentsTrackerProps) {
    const [activeTab, setActiveTab] = useState<"ongoing" | "finished" | "single">("ongoing");

    const { multiInstallments, singleInstallments } = useMemo(() => {
        const multiMap = new Map<string, InstallmentItem>();
        const singleList: InstallmentItem[] = [];
        const installmentRegex = /(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i;

        transactions.forEach((t) => {
            if (t.is_internal_transfer || t.is_refund) return;

            const amt = Math.abs(Number(t.amount) || 0);
            if (amt === 0) return;

            const rawLabel = t.clean_description || t.description || "Compra no Cartão";
            const category = t.category_pt || t.category || "Compras";
            const bankName =
                t.bank_accounts?.institution_name ||
                t.bank_accounts?.bank_name ||
                "Cartão de Crédito";
            const bankSlug = t.bank_accounts?.institution_slug || bankName;
            const productName = t.bank_accounts?.product_name || bankName;
            const dateStr = (t.date || t.executed_at || t.value_date || "").split("T")[0];

            let current = t.installment_number ? Number(t.installment_number) : null;
            let total = t.total_installments ? Number(t.total_installments) : null;

            if (!total) {
                const match = (t.description || "").match(installmentRegex);
                if (match) {
                    const c = parseInt(match[1], 10);
                    const tot = parseInt(match[2], 10);
                    if (c >= 1 && tot >= 2 && c <= tot && tot <= 72) {
                        current = c;
                        total = tot;
                    }
                }
            }

            if (total && total > 1) {
                const instNum = current && current >= 1 ? current : 1;
                const totalVal =
                    t.total_purchase_amount && Number(t.total_purchase_amount) > 0
                        ? Number(t.total_purchase_amount)
                        : Number((amt * total).toFixed(2));
                const paidVal = Number((amt * instNum).toFixed(2));
                const remainingVal = Math.max(0, Number((totalVal - paidVal).toFixed(2)));
                const remainingCount = Math.max(0, total - instNum);

                // Agrupa a mesma compra parcelada mantendo a parcela mais recente (maior currentInstallment)
                const dedupKey = `${bankSlug}_${rawLabel.toLowerCase()}_${total}_${amt.toFixed(2)}`;
                const existing = multiMap.get(dedupKey);
                if (!existing || instNum > existing.currentInstallment) {
                    multiMap.set(dedupKey, {
                        id: t.id,
                        description: rawLabel,
                        category,
                        date: dateStr,
                        currentInstallment: instNum,
                        totalInstallments: total,
                        installmentAmount: amt,
                        totalAmount: totalVal,
                        paidAmount: paidVal,
                        remainingAmount: remainingVal,
                        remainingCount,
                        bankName,
                        bankSlug,
                        productName,
                    });
                }
            } else if (
                total === 1 ||
                t.operation_type === "CREDIT_CARD" ||
                t.bank_accounts?.type === "CREDIT"
            ) {
                singleList.push({
                    id: t.id,
                    description: rawLabel,
                    category,
                    date: dateStr,
                    currentInstallment: 1,
                    totalInstallments: 1,
                    installmentAmount: amt,
                    totalAmount: amt,
                    paidAmount: amt,
                    remainingAmount: 0,
                    remainingCount: 0,
                    bankName,
                    bankSlug,
                    productName,
                });
            }
        });

        return {
            multiInstallments: Array.from(multiMap.values()).sort(
                (a, b) => b.remainingAmount - a.remainingAmount
            ),
            singleInstallments: singleList.slice(0, 40),
        };
    }, [transactions]);

    const ongoingList = multiInstallments.filter((i) => i.currentInstallment < i.totalInstallments);
    const finishedList = multiInstallments.filter((i) => i.currentInstallment >= i.totalInstallments);

    const displayList =
        activeTab === "ongoing"
            ? ongoingList
            : activeTab === "finished"
              ? finishedList
              : singleInstallments;

    const totalValue = ongoingList.reduce((acc, i) => acc + i.totalAmount, 0);
    const totalPaid = ongoingList.reduce((acc, i) => acc + i.paidAmount, 0);
    const totalRemaining = ongoingList.reduce((acc, i) => acc + i.remainingAmount, 0);
    const generalProgress = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;

    return (
        <div className="flex flex-col gap-5">
            {/* 4 Cards de Métricas de Parcelamento Reais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Em Andamento
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
                            {ongoingList.length}
                        </span>
                        <span className="text-[11px] text-slate-400">compras parceladas</span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Valor Contratado
                    </span>
                    <div className="mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(totalValue)}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Já Amortizado
                    </span>
                    <div className="mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(totalPaid)}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Saldo Vincendo
                    </span>
                    <div className="mt-1">
                        <span className="text-xl md:text-2xl font-extrabold text-[#FF8216] tabular-nums">
                            {formatCurrency(totalRemaining)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Barra de Progresso Geral */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Progresso Geral de Quitação das Parcelas Ativas
                    </span>
                    <span className="font-bold text-emerald-500 tabular-nums">
                        {generalProgress}% quitado
                    </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#18181B] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, generalProgress)}%` }}
                    />
                </div>
            </div>

            {/* Tabs Em Andamento / Última Parcela / À Vista (1x) */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setActiveTab("ongoing")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === "ongoing"
                            ? "bg-[#FF8216] text-white shadow-xs"
                            : "bg-white dark:bg-[#121214] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#27272A]"
                    }`}
                >
                    Parceladas em andamento ({ongoingList.length})
                </button>
                <button
                    onClick={() => setActiveTab("finished")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === "finished"
                            ? "bg-[#FF8216] text-white shadow-xs"
                            : "bg-white dark:bg-[#121214] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#27272A]"
                    }`}
                >
                    Última parcela / Concluídas ({finishedList.length})
                </button>
                <button
                    onClick={() => setActiveTab("single")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === "single"
                            ? "bg-[#FF8216] text-white shadow-xs"
                            : "bg-white dark:bg-[#121214] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#27272A]"
                    }`}
                >
                    Compras à Vista 1x ({singleInstallments.length})
                </button>
            </div>

            {/* Lista de Parcelas Reais ou Empty State */}
            <div className="flex flex-col gap-2.5">
                {displayList.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                        <span className="material-symbols-outlined text-3xl text-slate-400">
                            credit_card
                        </span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                            {activeTab === "ongoing"
                                ? "Nenhum parcelamento ativo detectado nos seus cartões"
                                : activeTab === "finished"
                                  ? "Nenhum parcelamento concluído neste filtro"
                                  : "Nenhuma compra à vista no cartão neste filtro"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                            Todas as informações aqui são extraídas diretamente dos metadados de faturas da Pluggy Open Finance, sem dados fictícios.
                        </p>
                    </div>
                ) : (
                    displayList.map((item) => {
                        const pct = Math.round(
                            (item.currentInstallment / item.totalInstallments) * 100
                        );
                        return (
                            <div
                                key={item.id}
                                className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] hover:border-[#FF8216]/40 transition-colors flex flex-col gap-3 shadow-xs"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <BankLogo bank={item.bankSlug} size="sm" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                                                    {item.description}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#18181B] text-slate-500 dark:text-slate-300 font-semibold">
                                                    {item.totalInstallments === 1
                                                        ? "À vista (1x)"
                                                        : `Parcela ${item.currentInstallment}/${item.totalInstallments}`}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-slate-400 block mt-0.5">
                                                {item.productName} • {item.category}
                                                {item.date ? ` • ${item.date}` : ""}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white tabular-nums block">
                                                {formatCurrency(item.installmentAmount)}
                                            </span>
                                            {item.totalInstallments > 1 && (
                                                <span className="text-[11px] font-semibold text-emerald-500">
                                                    /mês
                                                </span>
                                            )}
                                        </div>
                                        {item.totalInstallments > 1 ? (
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                <span>Total parcelado: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(item.totalAmount)}</strong></span>
                                                <span className="mx-1">•</span>
                                                <span className="text-[#FF8216] font-semibold">Resta {formatCurrency(item.remainingAmount)} ({item.remainingCount}x)</span>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-emerald-500 font-medium">
                                                Compra à vista (1x)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {item.totalInstallments > 1 && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-[#18181B] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#FF8216] rounded-full transition-all duration-300"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                            {pct}% quitado
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
