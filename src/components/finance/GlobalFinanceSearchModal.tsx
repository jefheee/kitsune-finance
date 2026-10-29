"use client";

import React, { useState, useMemo, useEffect } from "react";
import { MerchantLogo } from "@/components/MerchantLogo";
import { resolveMerchant } from "@/utils/finance/merchant-resolver";
import Link from "next/link";

interface Transaction {
    id: string;
    amount: number;
    description: string;
    clean_description?: string | null;
    raw_description?: string | null;
    category?: string | null;
    category_pt?: string | null;
    date: string;
    type?: string | null;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
    installment_number?: number | null;
    total_installments?: number | null;
    bank_account_id?: string;
    bank_accounts?: {
        name?: string;
        institution_name?: string;
        institution_slug?: string;
    };
}

interface GlobalFinanceSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    formatCurrency: (value: number) => string;
    formatDate: (date?: string) => string;
}

export function GlobalFinanceSearchModal({
    isOpen,
    onClose,
    transactions,
    formatCurrency,
    formatDate,
}: GlobalFinanceSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState("");

    // Fecha com ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    // Termos populares sugeridos
    const quickTerms = ["iFood", "Uber", "Supermercado", "Netflix", "Posto de Combustíveis", "Spotify", "Farmácia", "Amazon"];

    // Análise inteligente da busca
    const searchAnalytics = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return null;

        const filtered = transactions.filter((tx) => {
            if (tx.is_internal_transfer) return false;
            const desc = (tx.clean_description || tx.description || "").toLowerCase();
            const raw = (tx.raw_description || "").toLowerCase();
            const cat = (tx.category_pt || tx.category || "").toLowerCase();
            return desc.includes(query) || raw.includes(query) || cat.includes(query);
        });

        if (filtered.length === 0) {
            return {
                matchedTransactions: [],
                totalSpent: 0,
                currentMonthSpent: 0,
                lastMonthSpent: 0,
                avgTicket: 0,
                count: 0,
                preferredPayment: "Nenhum",
                peakDay: "N/D",
                resolvedBrand: resolveMerchant(searchTerm),
            };
        }

        const now = new Date();
        const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

        let total = 0;
        let curMonth = 0;
        let lastMonth = 0;
        const bankCounts: Record<string, number> = {};
        const dayCounts: Record<string, number> = {
            "Domingo": 0, "Segunda": 0, "Terça": 0, "Quarta": 0, "Quinta": 0, "Sexta": 0, "Sábado": 0
        };
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

        filtered.forEach((tx) => {
            const amt = Math.abs(Number(tx.amount) || 0);
            total += amt;

            const txMonth = (tx.date || "").slice(0, 7);
            if (txMonth === curMonthStr) curMonth += amt;
            if (txMonth === lastMonthStr) lastMonth += amt;

            const bankName = tx.bank_accounts?.institution_name || tx.bank_accounts?.name || "Cartão/Conta";
            bankCounts[bankName] = (bankCounts[bankName] || 0) + 1;

            if (tx.date) {
                const parts = tx.date.split("T")[0].split("-");
                if (parts.length === 3) {
                    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    const dayName = dayNames[d.getDay()];
                    if (dayName) dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
                }
            }
        });

        // Banco preferido
        const preferredPayment = Object.entries(bankCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Cartão";

        // Dia de pico
        const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Fim de Semana";

        const resolvedBrand = resolveMerchant(searchTerm, filtered[0]?.category_pt);

        return {
            matchedTransactions: filtered,
            totalSpent: total,
            currentMonthSpent: curMonth,
            lastMonthSpent: lastMonth,
            avgTicket: total / filtered.length,
            count: filtered.length,
            preferredPayment,
            peakDay,
            resolvedBrand,
        };
    }, [searchTerm, transactions]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 md:pt-16 px-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div
                className="w-full max-w-2xl bg-[#0F0F11] border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header de Pesquisa */}
                <div className="p-4 md:p-5 border-b border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF8216]/10 flex items-center justify-center text-[#FF8216] shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Pesquise por iFood, Uber, Supermercado, Netflix..."
                        className="flex-1 bg-transparent border-none text-base md:text-lg text-white placeholder-slate-500 focus:outline-none"
                        autoFocus
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-2.5 py-1 text-xs font-mono text-slate-400 border border-white/10 rounded-md hover:bg-white/5 transition-colors hidden sm:block"
                    >
                        ESC
                    </button>
                </div>

                {/* Corpo do Modal */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 scrollbar-thin">
                    {/* Tags Rápidas se busca vazia */}
                    {!searchTerm && (
                        <div className="space-y-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Buscas Rápidas & Frequentes
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {quickTerms.map((term) => (
                                    <button
                                        key={term}
                                        onClick={() => setSearchTerm(term)}
                                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm text-slate-300 transition-colors"
                                    >
                                        <MerchantLogo cleanName={term} size="sm" />
                                        <span>{term}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5">
                                <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                                    <span>💡</span> Inteligência de Consumo 360°
                                </h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Digite qualquer termo para ver seu raio-x completo: quanto você já gastou no total, ticket médio por compra, dias em que mais consome e histórico consolidado entre todos os seus bancos.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Dossiê Inteligente da Busca */}
                    {searchAnalytics && searchAnalytics.count > 0 && (
                        <div className="space-y-5 animate-fade-in">
                            {/* Card Resumo do Estabelecimento */}
                            <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-b from-[#18181B] to-[#121215] border border-white/10 shadow-lg">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3.5">
                                        <MerchantLogo
                                            cleanName={searchAnalytics.resolvedBrand.cleanName}
                                            category={searchAnalytics.resolvedBrand.category}
                                            size="lg"
                                        />
                                        <div>
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                {searchAnalytics.resolvedBrand.cleanName}
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                {searchAnalytics.resolvedBrand.category} • {searchAnalytics.count} compras encontradas
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/kitsune?q=${encodeURIComponent(`Faça uma análise profunda dos meus gastos com ${searchAnalytics.resolvedBrand.cleanName}. Me diga se estou gastando demais e sugira como otimizar.`)}`}
                                        onClick={onClose}
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF8216] text-black text-xs font-semibold hover:bg-[#FF8216]/90 transition-transform active:scale-95 shadow-md"
                                    >
                                        <span>✨ Analisar com IA</span>
                                    </Link>
                                </div>

                                {/* Grade de Métricas */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/5">
                                    <div className="p-2.5 rounded-xl bg-white/[0.03]">
                                        <span className="text-[11px] text-slate-400 block mb-0.5">Total Gasto</span>
                                        <span className="text-sm md:text-base font-bold text-white">
                                            {formatCurrency(searchAnalytics.totalSpent)}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white/[0.03]">
                                        <span className="text-[11px] text-slate-400 block mb-0.5">Ticket Médio</span>
                                        <span className="text-sm md:text-base font-bold text-emerald-400">
                                            {formatCurrency(searchAnalytics.avgTicket)}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white/[0.03]">
                                        <span className="text-[11px] text-slate-400 block mb-0.5">Mês Atual</span>
                                        <span className="text-sm md:text-base font-bold text-[#FF8216]">
                                            {formatCurrency(searchAnalytics.currentMonthSpent)}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white/[0.03]">
                                        <span className="text-[11px] text-slate-400 block mb-0.5">Pico de Consumo</span>
                                        <span className="text-sm md:text-base font-bold text-slate-200">
                                            {searchAnalytics.peakDay}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Lista de Transações Encontradas */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                                    Histórico de Transações ({searchAnalytics.matchedTransactions.length})
                                </h4>
                                <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                    {searchAnalytics.matchedTransactions.slice(0, 15).map((tx) => {
                                        const amt = Math.abs(Number(tx.amount) || 0);
                                        const isDebit = tx.amount > 0;
                                        return (
                                            <div
                                                key={tx.id}
                                                className="p-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 pr-3">
                                                    <MerchantLogo
                                                        cleanName={tx.clean_description || tx.description}
                                                        rawDescription={tx.raw_description}
                                                        category={tx.category_pt}
                                                        size="sm"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">
                                                            {tx.clean_description || tx.description}
                                                        </p>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                                            <span>{formatDate(tx.date)}</span>
                                                            {tx.bank_accounts?.institution_name && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{tx.bank_accounts.institution_name}</span>
                                                                </>
                                                            )}
                                                            {tx.total_installments && tx.total_installments > 1 && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-amber-400">
                                                                        {tx.installment_number || 1}/{tx.total_installments}x
                                                                    </span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-mono font-semibold shrink-0 ${isDebit ? "text-slate-200" : "text-emerald-400"}`}>
                                                    {isDebit ? "-" : "+"} {formatCurrency(amt)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vazio se não encontrou nada */}
                    {searchAnalytics && searchAnalytics.count === 0 && (
                        <div className="text-center py-12 space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-2xl">
                                🔍
                            </div>
                            <h4 className="text-base font-semibold text-white">Nenhuma transação encontrada</h4>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Não encontramos compras correspondentes a &quot;{searchTerm}&quot; no seu histórico sincronizado.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
