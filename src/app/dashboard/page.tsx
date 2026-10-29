"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import PluggyConnectModal from "@/components/PluggyConnectModal";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { AiDiagnosticPanel } from "@/components/AiDiagnosticPanel";
import { AnomalyAlertCard } from "@/components/AnomalyAlertCard";
import { SpendingHeatmap } from "@/components/finance/SpendingHeatmap";
import { SubscriptionsTracker } from "@/components/finance/SubscriptionsTracker";
import { InstallmentsTracker } from "@/components/finance/InstallmentsTracker";
import { BankLogo } from "@/components/BankLogo";
import { MerchantLogo } from "@/components/MerchantLogo";
import { GlobalFinanceSearchModal } from "@/components/finance/GlobalFinanceSearchModal";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { useFinanceData } from "@/context/FinanceDataContext";

export default function DashboardPage() {
    const {
        user,
        userProfile,
        accounts,
        investments,
        loans,
        transactions,
        connections,
        familyMembers,
        aiInsight,
        isInitialLoading,
        isRevalidating,
        selectedBankSlug,
        setSelectedBankSlug,
        isFamilyModeEnabled,
        setIsFamilyModeEnabled,
        revalidate,
        setAiInsightState,
        addFamilyMemberLocal,
        removeFamilyMemberLocal,
    } = useFinanceData();

    const [activeTab, setActiveTab] = useState("Visão Geral");
    const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [connectForMemberId, setConnectForMemberId] = useState<string | null>(null);

    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Pesquisa Global Inteligente e Granularidade Temporal
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [timeGranularity, setTimeGranularity] = useState<"day" | "week" | "month" | "year">("month");

    // Atalho global Ctrl+K / Cmd+K para abrir busca
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setIsSearchModalOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const [newMemberName, setNewMemberName] = useState("");
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [newMemberRole, setNewMemberRole] = useState("Cônjuge");
    const [isCreatingMember, setIsCreatingMember] = useState(false);
    const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

    const TABS = [
        "Visão Geral",
        "Extrato & Transações",
        "Parcelamentos",
        "Assinaturas",
        "Cartões de Crédito",
        "Investimentos & Crédito",
        "Categorias de Gastos",
        "Perfil Open Finance",
        "Visão Familiar",
    ];

    // Lista única de bancos conectados pelo usuário para a barra horizontal de filtro
    // ORDENADA POR IMPORTÂNCIA FINANCEIRA: maior volume consolidado (saldo líquido + investimentos) em primeiro
    const connectedBanks = useMemo(() => {
        const map = new Map<string, { slug: string; name: string; accountCount: number; totalAssets: number }>();

        accounts.forEach((acc) => {
            const entry = getBankCatalogBySlugOrName(
                acc.institution_slug || acc.institution_name || acc.bank_name
            );
            const bal = Number(acc.balance) || 0;
            const isCredit = acc.type === "CREDIT" || acc.subtype === "CREDIT_CARD";
            const assetVal = isCredit ? 0 : bal;

            const existing = map.get(entry.slug);
            if (existing) {
                existing.accountCount += 1;
                existing.totalAssets += assetVal;
            } else {
                map.set(entry.slug, {
                    slug: entry.slug,
                    name: entry.shortName,
                    accountCount: 1,
                    totalAssets: assetVal,
                });
            }
        });

        // Adiciona e soma volume de investimentos por instituição
        investments.forEach((inv) => {
            const entry = getBankCatalogBySlugOrName(inv.institution_name);
            const bal = Number(inv.balance) || 0;
            const existing = map.get(entry.slug);
            if (existing) {
                existing.totalAssets += bal;
            } else if (entry.slug !== "generic") {
                map.set(entry.slug, {
                    slug: entry.slug,
                    name: entry.shortName,
                    accountCount: 0,
                    totalAssets: bal,
                });
            }
        });

        connections.forEach((conn) => {
            const entry = getBankCatalogBySlugOrName(
                conn.institution_slug || conn.institution_name || conn.provider_name
            );
            if (entry.slug !== "generic" && !map.has(entry.slug)) {
                map.set(entry.slug, {
                    slug: entry.slug,
                    name: entry.shortName,
                    accountCount: 0,
                    totalAssets: 0,
                });
            }
        });

        // Ordena estritamente por relevância financeira decrescente (maior valor total primeiro)
        return Array.from(map.values()).sort((a, b) => b.totalAssets - a.totalAssets);
    }, [accounts, investments, connections]);

    // Garante que se o banco selecionado foi desconectado, volta para 'all'
    useEffect(() => {
        if (
            selectedBankSlug !== "all" &&
            connectedBanks.length > 0 &&
            !connectedBanks.some((b) => b.slug === selectedBankSlug)
        ) {
            setSelectedBankSlug("all");
        }
    }, [selectedBankSlug, connectedBanks, setSelectedBankSlug]);

    // Filtragem Global Combinada (Membro da Família + Banco Selecionado) ordenada por saldo decrescente
    const filteredAccounts = useMemo(() => {
        return accounts
            .filter((a) => {
                if (isFamilyModeEnabled && selectedMemberId !== "all") {
                    if (selectedMemberId === "personal" && a.family_member_id) return false;
                    if (selectedMemberId !== "personal" && a.family_member_id !== selectedMemberId)
                        return false;
                }
                if (selectedBankSlug !== "all") {
                    const slug = getBankCatalogBySlugOrName(
                        a.institution_slug || a.institution_name || a.bank_name
                    ).slug;
                    if (slug !== selectedBankSlug) return false;
                }
                return true;
            })
            .sort((a, b) => Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0));
    }, [accounts, isFamilyModeEnabled, selectedMemberId, selectedBankSlug]);

    const filteredAccountIds = useMemo(
        () => new Set(filteredAccounts.map((a) => a.id)),
        [filteredAccounts]
    );

    const filteredInvestments = useMemo(() => {
        return investments
            .filter((inv) => {
                if (selectedBankSlug !== "all") {
                    const slug = getBankCatalogBySlugOrName(
                        inv.institution_slug || inv.institution_name || inv.issuer
                    ).slug;
                    if (slug !== selectedBankSlug) return false;
                }
                return true;
            })
            .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));
    }, [investments, selectedBankSlug]);

    const filteredLoans = useMemo(() => {
        return loans.filter((loan) => {
            if (selectedBankSlug !== "all") {
                const slug = getBankCatalogBySlugOrName(
                    loan.institution_slug || loan.institution_name
                ).slug;
                if (slug !== selectedBankSlug) return false;
            }
            return true;
        });
    }, [loans, selectedBankSlug]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            if (isFamilyModeEnabled && selectedMemberId !== "all") {
                if (selectedMemberId === "personal" && t.family_member_id) return false;
                if (selectedMemberId !== "personal" && t.family_member_id !== selectedMemberId)
                    return false;
            }
            if (selectedBankSlug !== "all") {
                if (filteredAccountIds.has(t.account_id)) return true;
                const txBankSlug = getBankCatalogBySlugOrName(
                    t.bank_accounts?.institution_slug ||
                        t.bank_accounts?.institution_name ||
                        t.bank_accounts?.bank_name
                ).slug;
                return txBankSlug === selectedBankSlug;
            }
            return true;
        });
    }, [
        transactions,
        isFamilyModeEnabled,
        selectedMemberId,
        selectedBankSlug,
        filteredAccountIds,
    ]);

    const {
        totalBalance,
        liquidBalance,
        investmentsBalance,
        loansBalance,
        creditCardBalance,
        monthlyIncome,
        monthlyExpense,
        monthlyInternalTransfers,
        monthlyRefunds,
        categorySummary,
    } = useMemo(() => {
        let liquid = 0;
        let credit = 0;

        filteredAccounts.forEach((curr) => {
            const bal = Number(curr.balance) || 0;
            if (
                curr.type === "CREDIT" ||
                curr.type === "CREDIT_CARD" ||
                curr.subtype === "CREDIT_CARD"
            ) {
                credit += Math.abs(bal);
            } else {
                liquid += bal;
            }
        });

        const invTotal = filteredInvestments.reduce(
            (sum, i) => sum + (Number(i.balance) || 0),
            0
        );
        const loansTotal = filteredLoans.reduce(
            (sum, l) => sum + (Number(l.outstanding_balance) || 0),
            0
        );

        // Determinar janela temporal conforme granularidade selecionada (Dia, Semana, Mês ou Ano)
        const latestTxTime =
            filteredTransactions.length > 0
                ? Math.max(
                      ...filteredTransactions
                          .map((t) => new Date(t.date || t.executed_at || 0).getTime())
                          .filter((n) => !isNaN(n))
                  )
                : Date.now();
        const refDate = new Date(latestTxTime || Date.now());

        let windowStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        if (timeGranularity === "day") {
            // Últimos 7 dias para visão dia a dia
            windowStart = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeGranularity === "week") {
            // Últimos 14 dias para visão semanal
            windowStart = new Date(refDate.getTime() - 14 * 24 * 60 * 60 * 1000);
        } else if (timeGranularity === "year") {
            // 1 de janeiro do ano atual para visão anual
            windowStart = new Date(refDate.getFullYear(), 0, 1);
        }

        let income = 0;
        let expense = 0;
        let internalTotal = 0;
        let refundsTotal = 0;
        const catMap: Record<string, { total: number; count: number }> = {};

        filteredTransactions.forEach((txn) => {
            const rawDate = txn.date || txn.executed_at;
            if (!rawDate) return;
            const txnDate = new Date(rawDate);
            const absAmount = Math.abs(Number(txn.amount) || 0);
            if (absAmount === 0) return;

            const isInternal = Boolean(txn.is_internal_transfer);
            const isRefund = Boolean(txn.is_refund);
            const isCreditCardAcc =
                txn.bank_accounts?.type === "CREDIT" ||
                txn.bank_accounts?.subtype === "CREDIT_CARD" ||
                txn.operation_type === "CREDIT_CARD";

            // 1. Transferências próprias e pagamentos de fatura NUNCA inflam entradas ou saídas
            if (isInternal) {
                if (txnDate >= windowStart) {
                    internalTotal += absAmount;
                }
                return;
            }

            // 2. Estornos / reembolsos em cartão abatem da fatura e são contabilizados separadamente
            if (isRefund) {
                if (txnDate >= windowStart) {
                    refundsTotal += absAmount;
                }
                return;
            }

            // 3. Receita real (somente créditos em conta corrente/poupança) vs Despesa real
            const isRealIncome = txn.type === "CREDIT" && !isCreditCardAcc;

            if (txnDate >= windowStart) {
                if (isRealIncome) {
                    income += absAmount;
                } else {
                    expense += absAmount;
                }
            }

            if (!isRealIncome) {
                const catName = txn.category_pt || txn.category || "Outros";
                if (!catMap[catName]) catMap[catName] = { total: 0, count: 0 };
                catMap[catName].total += absAmount;
                catMap[catName].count += 1;
            }
        });

        const sortedCategories = Object.entries(catMap)
            .map(([name, info]) => ({ name, ...info }))
            .sort((a, b) => b.total - a.total);

        return {
            totalBalance: liquid + invTotal - credit - loansTotal,
            liquidBalance: liquid,
            investmentsBalance: invTotal,
            loansBalance: loansTotal,
            creditCardBalance: credit,
            monthlyIncome: income,
            monthlyExpense: expense,
            monthlyInternalTransfers: internalTotal,
            monthlyRefunds: refundsTotal,
            categorySummary: sortedCategories,
        };
    }, [filteredAccounts, filteredInvestments, filteredLoans, filteredTransactions, timeGranularity]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        const clean = dateString.split("T")[0];
        const parts = clean.split("-");
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateString;
    };

    const kitsuneScore = useMemo(() => {
        if (accounts.length === 0)
            return { score: 500, label: "Aguardando Conexões", color: "text-slate-400" };
        let score = 550;

        const totalAssets = liquidBalance + investmentsBalance;
        if (totalAssets > creditCardBalance * 1.5) score += 180;
        else if (totalAssets >= creditCardBalance) score += 90;
        else score -= 120;

        const netMonthly = monthlyIncome - monthlyExpense;
        if (netMonthly > 0) score += 160;
        else if (monthlyExpense > 0) score -= 80;

        if (investmentsBalance > 0) score += 50;
        if (accounts.length >= 2) score += 40;

        const finalScore = Math.max(300, Math.min(990, score));
        if (finalScore >= 800)
            return { score: finalScore, label: "Excelente", color: "text-emerald-500" };
        if (finalScore >= 650)
            return { score: finalScore, label: "Saudável", color: "text-emerald-500" };
        if (finalScore >= 500)
            return { score: finalScore, label: "Equilibrado", color: "text-[#FF8216]" };
        return { score: finalScore, label: "Atenção Necessária", color: "text-red-500" };
    }, [
        accounts.length,
        liquidBalance,
        investmentsBalance,
        creditCardBalance,
        monthlyIncome,
        monthlyExpense,
    ]);

    // Diagnóstico Matemático Acionável do Objetivo Patrimonial Selecionado
    const goalDiagnostics = useMemo(() => {
        const goal = userProfile?.financial_goal || "Construir reserva";
        let progress = 50;
        let text = "Acompanhamento da sua meta patrimonial.";

        if (goal.toLowerCase().includes("reserva")) {
            const monthlyCost = monthlyExpense > 0 ? monthlyExpense : 2500;
            const target = monthlyCost * 6;
            const months = (liquidBalance / monthlyCost).toFixed(1);
            progress = Math.min(100, Math.max(5, Math.round((liquidBalance / target) * 100)));
            text = `Você possui ${months} meses de custo de vida garantidos em liquidez imediata (Meta: 6 meses ou ${formatCurrency(target)}).`;
        } else if (goal.toLowerCase().includes("gasto")) {
            const limit = monthlyIncome > 0 ? monthlyIncome * 0.7 : 3000;
            const usedRatio = monthlyExpense / limit;
            progress = Math.min(100, Math.max(0, Math.round((1 - usedRatio) * 100)));
            text = `Você utilizou ${formatCurrency(monthlyExpense)} do teto orçamentário seguro previsto de ${formatCurrency(limit)}.`;
        } else if (goal.toLowerCase().includes("invest")) {
            const ratio = totalBalance > 0 ? Math.round((investmentsBalance / totalBalance) * 100) : 0;
            progress = Math.min(100, Math.max(10, ratio));
            text = `${ratio}% do seu patrimônio está alocado em investimentos (${formatCurrency(investmentsBalance)} de ${formatCurrency(totalBalance)}).`;
        } else if (goal.toLowerCase().includes("dívida") || goal.toLowerCase().includes("divida")) {
            const ratio = creditCardBalance > 0 ? liquidBalance / creditCardBalance : 10;
            progress = creditCardBalance === 0 ? 100 : Math.min(100, Math.round(ratio * 50));
            text = creditCardBalance === 0 ? "Parabéns! Suas faturas de cartão de crédito estão 100% quitadas." : `Faturas em aberto somam ${formatCurrency(creditCardBalance)}, cobertas ${ratio.toFixed(1)}x pelo seu saldo disponível.`;
        } else {
            progress = 75;
            text = `Consolidação e alocação compartilhada em andamento com ${accounts.length} contas monitoradas.`;
        }

        return { goal, progress, text };
    }, [userProfile?.financial_goal, liquidBalance, monthlyExpense, monthlyIncome, totalBalance, investmentsBalance, creditCardBalance, accounts.length, formatCurrency]);

    useEffect(() => {
        if (!aiInsight && !isGeneratingAi && accounts.length > 0 && transactions.length > 0) {
            generateAiInsight();
        }
    }, [aiInsight, accounts.length, transactions.length]);

    const generateAiInsight = async () => {
        setIsGeneratingAi(true);
        setAiError(null);
        try {
            const response = await fetch("/api/ai/generate-insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bankSlug: selectedBankSlug !== "all" ? selectedBankSlug : null,
                    familyMemberId: isFamilyModeEnabled ? selectedMemberId : "all",
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao gerar análise");
            if (data.success && data.data) {
                setAiInsightState({
                    text: data.data.last_analysis_text,
                    updatedAt: data.data.updated_at,
                });
            }
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleAddFamilyMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim() || isCreatingMember) return;
        setIsCreatingMember(true);
        try {
            const response = await fetch("/api/family-members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newMemberName.trim(),
                    role: newMemberRole,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Falha ao criar membro");
            addFamilyMemberLocal(data.member);
            setNewMemberName("");
            setNewMemberEmail("");
            setIsFamilyModeEnabled(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsCreatingMember(false);
        }
    };

    const handleDeleteFamilyMember = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover este membro da visualização compartilhada?"))
            return;
        try {
            const response = await fetch(`/api/family-members?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Falha ao remover membro");
            removeFamilyMemberLocal(id);
            if (selectedMemberId === id) setSelectedMemberId("all");
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCopyInviteLink = (memberId: string) => {
        if (typeof window === "undefined") return;
        const url = `${window.location.origin}/agents?memberId=${memberId}`;
        navigator.clipboard.writeText(url);
        setCopiedMemberId(memberId);
        setTimeout(() => setCopiedMemberId(null), 3000);
    };

    const userFirstName = (() => {
        if (userProfile?.display_name && userProfile.display_name.trim().length > 0) {
            return userProfile.display_name.trim().split(" ")[0];
        }
        if (userProfile?.full_name && userProfile.full_name.trim().length > 0) {
            return userProfile.full_name.trim().split(" ")[0];
        }
        const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name;
        if (metaName) return String(metaName).split(" ")[0];
        return user?.email?.split("@")[0] || "Investidor";
    })();

    if (isInitialLoading && accounts.length === 0 && transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-xl text-[#FF8216]">
                        auto_awesome
                    </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium mt-3">
                    Sincronizando patrimônio com segurança...
                </span>
            </div>
        );
    }

    const renderTransactionBadge = (txn: any) => {
        if (txn.is_refund) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    Estorno / Reembolso
                </span>
            );
        }
        if (txn.is_internal_transfer) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    Movimentação Interna
                </span>
            );
        }
        if (txn.total_installments && Number(txn.total_installments) > 1) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF8216]/15 text-[#FF8216] border border-[#FF8216]/25">
                    Parcela {txn.installment_number || 1}/{txn.total_installments}
                </span>
            );
        }
        if (txn.is_subscription) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    Recorrente
                </span>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-6 md:gap-7 p-4 md:p-8 max-w-6xl mx-auto w-full font-sans">
            {/* Header Principal */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
                <div className="flex flex-col gap-1.5">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Open Finance Brasil • Dados Conciliados & Isolados (RLS)
                        </span>
                    </div>

                    <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
                        Olá, {userFirstName}!
                    </h1>

                    <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8] max-w-xl leading-relaxed">
                        Acompanhe suas contas, cartões, investimentos e fluxo de caixa real (livre de inflação por transferências próprias).
                    </p>
                </div>

                {/* Ações Superiores */}
                <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto flex-wrap">
                    <button
                        onClick={() => setIsSearchModalOpen(true)}
                        title="Buscar compras, iFood, Uber, lojas... (Atalho: Ctrl+K)"
                        className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-white dark:bg-[#12161F] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] hover:border-[#FF8216]/40 text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group"
                    >
                        <span className="material-symbols-outlined text-[18px] text-[#FF8216] group-hover:scale-110 transition-transform">
                            search
                        </span>
                        <span className="hidden sm:inline">Buscar (Ctrl+K)</span>
                        <span className="sm:hidden">Buscar</span>
                    </button>

                    <a
                        href="/api/export/spreadsheet"
                        download
                        title="Exportar dados consolidados em Planilha (CSV / Excel)"
                        className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-white dark:bg-[#12161F] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                        <span className="material-symbols-outlined text-[17px] text-[#FF8216]">
                            table_chart
                        </span>
                        <span className="hidden sm:inline">Exportar Planilha</span>
                        <span className="sm:hidden">Planilha</span>
                    </a>

                    <button
                        onClick={() => revalidate(true)}
                        title="Atualizar dados bancários agora"
                        className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-white dark:bg-[#12161F] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                        <span
                            className={`material-symbols-outlined text-[17px] text-emerald-500 ${
                                isRevalidating ? "animate-spin" : ""
                            }`}
                        >
                            sync
                        </span>
                        <span>Atualizar</span>
                    </button>

                    <button
                        onClick={() => {
                            setConnectForMemberId(null);
                            setIsConnectModalOpen(true);
                        }}
                        className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[17px]">add_link</span>
                        <span>Conectar Conta</span>
                    </button>
                </div>
            </header>

            {/* Seletor de Granularidade Temporal: Dia a Dia | Semana a Semana | Mês a Mês | Ano a Ano */}
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <span className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-[#FF8216]">tune</span>
                        Período:
                    </span>
                    {(["day", "week", "month", "year"] as const).map((gran) => {
                        const labels = {
                            day: "Dia a Dia",
                            week: "Semana a Semana",
                            month: "Mês a Mês",
                            year: "Ano a Ano",
                        };
                        const isSel = timeGranularity === gran;
                        return (
                            <button
                                key={gran}
                                onClick={() => setTimeGranularity(gran)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                                    isSel
                                        ? "bg-[#FF8216] text-white shadow-xs font-bold ring-2 ring-[#FF8216]/20"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                                }`}
                            >
                                {labels[gran]}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono self-end sm:self-auto px-2">
                    {timeGranularity === "month" && "📅 Visão Mensal Consolidada"}
                    {timeGranularity === "day" && "⏱️ Visão dos Últimos 7 Dias"}
                    {timeGranularity === "week" && "📊 Ritmo das Últimas 2 Semanas"}
                    {timeGranularity === "year" && "📈 Visão Anual Acumulada"}
                </div>
            </section>

            {/* Barra Horizontal de Seleção Global por Banco com Logos SVG Oficiais */}
            {connectedBanks.length > 0 && (
                <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Filtro Global por Instituição Financeira
                        </span>
                        {selectedBankSlug !== "all" && (
                            <button
                                onClick={() => setSelectedBankSlug("all")}
                                className="text-[11px] font-bold text-[#FF8216] hover:underline cursor-pointer"
                            >
                                Limpar filtro de banco
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
                        <button
                            onClick={() => setSelectedBankSlug("all")}
                            className={`whitespace-nowrap h-10 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                                selectedBankSlug === "all"
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                                    : "bg-white dark:bg-[#12161F] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#262E3D]"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px] text-[#FF8216]">
                                account_balance
                            </span>
                            <span>Todos os Bancos (Consolidado)</span>
                        </button>

                        {connectedBanks.map((bank) => {
                            const isSelected = selectedBankSlug === bank.slug;
                            return (
                                <button
                                    key={bank.slug}
                                    onClick={() => setSelectedBankSlug(bank.slug)}
                                    className={`whitespace-nowrap h-10 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                                        isSelected
                                            ? "bg-[#FF8216] text-white shadow-xs ring-2 ring-[#FF8216]/30"
                                            : "bg-white dark:bg-[#12161F] text-slate-700 dark:text-slate-200 hover:border-[#FF8216]/50 border border-slate-200 dark:border-[#262E3D]"
                                    }`}
                                >
                                    <BankLogo bank={bank.slug} size="xs" />
                                    <span>{bank.name}</span>
                                    {bank.accountCount > 0 && (
                                        <span
                                            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                                isSelected
                                                    ? "bg-white/20 text-white"
                                                    : "bg-slate-100 dark:bg-[#1E2533] text-slate-400"
                                            }`}
                                        >
                                            {bank.accountCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Abas de Navegação */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    const isFamilyTab = tab === "Visão Familiar";
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isActive
                                    ? "bg-[#FF8216] text-white shadow-xs"
                                    : isFamilyTab
                                      ? "bg-white dark:bg-[#12161F] text-[#FF8216] hover:bg-slate-50 dark:hover:bg-[#1A202C] border border-[#FF8216]/30"
                                      : "bg-white dark:bg-[#12161F] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D]"
                            }`}
                        >
                            {isFamilyTab && (
                                <span className="material-symbols-outlined text-[15px]">group</span>
                            )}
                            {tab}
                        </button>
                    );
                })}
            </div>

            {activeTab === "Visão Geral" ? (
                <>
                    {/* Alerta Preventivo de Anomalias */}
                    <AnomalyAlertCard />

                    {/* Meta Patrimonial Ativa com Progresso Real */}
                    <section className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-xl">flag</span>
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Meta Patrimonial em Foco
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                                        {goalDiagnostics.goal}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    {goalDiagnostics.text}
                                </p>
                            </div>
                        </div>
                        <div className="w-full sm:w-48 flex flex-col gap-1.5 shrink-0 self-stretch sm:self-auto">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-slate-400">Progresso</span>
                                <span className="text-emerald-500 font-black">{goalDiagnostics.progress}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#1A202C] overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#FF8216] to-emerald-500 rounded-full transition-all duration-700"
                                    style={{ width: `${goalDiagnostics.progress}%` }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Key Metrics: 4 Cards Responsivos */}
                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {/* Card 1: Patrimônio Líquido Consolidado */}
                        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Patrimônio Líquido
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 flex items-center justify-center text-[#FF8216]">
                                    <span className="material-symbols-outlined text-[16px]">
                                        account_balance
                                    </span>
                                </div>
                            </div>
                            <div>
                                <span className="text-lg md:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tabular-nums tracking-tight block">
                                    {formatCurrency(totalBalance)}
                                </span>
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
                                    Conta: {formatCurrency(liquidBalance)} • Inv:{" "}
                                    {formatCurrency(investmentsBalance)}
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Faturas descontadas</span>
                                <span
                                    className={
                                        totalBalance >= 0
                                            ? "text-emerald-500 font-bold"
                                            : "text-red-500 font-bold"
                                    }
                                >
                                    {totalBalance >= 0 ? "Positivo" : "Negativo"}
                                </span>
                            </div>
                        </div>

                        {/* Card 2: Entradas Reais do Mês */}
                        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Entradas do Mês
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <span className="material-symbols-outlined text-[16px]">
                                        trending_up
                                    </span>
                                </div>
                            </div>
                            <div>
                                <span className="text-lg md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight block">
                                    {formatCurrency(monthlyIncome)}
                                </span>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    Sem transferências próprias
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Mov. Internas</span>
                                <span className="text-slate-600 dark:text-slate-300 font-semibold tabular-nums">
                                    {formatCurrency(monthlyInternalTransfers)}
                                </span>
                            </div>
                        </div>

                        {/* Card 3: Saídas Reais do Mês */}
                        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Saídas do Mês
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                    <span className="material-symbols-outlined text-[16px]">
                                        shopping_bag
                                    </span>
                                </div>
                            </div>
                            <div>
                                <span className="text-lg md:text-2xl font-extrabold text-red-600 dark:text-red-400 tabular-nums tracking-tight block">
                                    {formatCurrency(monthlyExpense)}
                                </span>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    {categorySummary[0]
                                        ? `Top: ${categorySummary[0].name}`
                                        : "Gastos reais conciliados"}
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Estornos no mês</span>
                                <span className="text-emerald-500 font-bold tabular-nums">
                                    +{formatCurrency(monthlyRefunds)}
                                </span>
                            </div>
                        </div>

                        {/* Card 4: Faturas de Cartão */}
                        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Faturas em Aberto
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 flex items-center justify-center text-[#FF8216]">
                                    <span className="material-symbols-outlined text-[16px]">
                                        credit_card
                                    </span>
                                </div>
                            </div>
                            <div>
                                <span className="text-lg md:text-2xl font-extrabold text-[#FF8216] tabular-nums tracking-tight block">
                                    {formatCurrency(creditCardBalance)}
                                </span>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    {liquidBalance + investmentsBalance >= creditCardBalance
                                        ? "Coberto pela liquidez"
                                        : "Atenção à liquidez"}
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Cartões ativos</span>
                                <span className="text-[#FF8216] font-semibold">
                                    {
                                        filteredAccounts.filter(
                                            (a) =>
                                                a.type === "CREDIT" ||
                                                a.subtype === "CREDIT_CARD"
                                        ).length
                                    }{" "}
                                    cartão(ões)
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Painel Consultivo da Kitsune AI */}
                    <AiDiagnosticPanel
                        aiInsight={aiInsight}
                        isGenerating={isGeneratingAi}
                        onRefresh={generateAiInsight}
                        totalBalance={totalBalance}
                        liquidBalance={liquidBalance}
                        creditCardBalance={creditCardBalance}
                        monthlyIncome={monthlyIncome}
                        monthlyExpense={monthlyExpense}
                        kitsuneScore={kitsuneScore}
                        formatCurrency={formatCurrency}
                    />

                    {/* Grid de 2 Colunas: Contas Conectadas + Lançamentos Recentes */}
                    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Coluna Esquerda: Minhas Contas, Cartões & Investimentos (5 cols) */}
                        <div className="lg:col-span-5 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-lg text-[#FF8216]">
                                        account_balance_wallet
                                    </span>
                                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                                        Minhas Contas & Cartões
                                    </h2>
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] px-2 py-0.5 rounded-md">
                                    {filteredAccounts.length} Ativa(s)
                                </span>
                            </div>

                            <div className="flex flex-col gap-2.5">
                                {filteredAccounts.length > 0 ? (
                                    filteredAccounts.map((account) => {
                                        const isCredit =
                                            account.type === "CREDIT" ||
                                            account.type === "CREDIT_CARD" ||
                                            account.subtype === "CREDIT_CARD";
                                        const isSavings = account.subtype === "SAVINGS_ACCOUNT";
                                        const instName =
                                            account.institution_name ||
                                            account.bank_name ||
                                            "Banco Conectado";
                                        const prodName =
                                            account.product_name ||
                                            account.bank_name ||
                                            "Conta Bancária";
                                        const slug =
                                            account.institution_slug || instName;

                                        return (
                                            <div
                                                key={account.id}
                                                className="p-3.5 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between hover:border-[#FF8216]/40 transition-colors shadow-xs gap-3"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <BankLogo bank={slug} size="sm" />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                                                            {prodName}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 truncate">
                                                            {instName} •{" "}
                                                            {isCredit
                                                                ? account.credit_limit
                                                                    ? `Limite: ${formatCurrency(Number(account.credit_limit))}`
                                                                    : "Cartão de Crédito"
                                                                : isSavings
                                                                  ? "Conta Poupança"
                                                                  : "Conta Corrente"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end shrink-0 pl-2">
                                                    <span
                                                        className={`text-xs md:text-sm font-extrabold tabular-nums ${
                                                            isCredit
                                                                ? "text-[#FF8216]"
                                                                : "text-slate-900 dark:text-white"
                                                        }`}
                                                    >
                                                        {formatCurrency(
                                                            Math.abs(Number(account.balance) || 0)
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {isCredit
                                                            ? account.available_credit_limit != null
                                                                ? `Disp: ${formatCurrency(Number(account.available_credit_limit))}`
                                                                : "Fatura atual"
                                                            : "Saldo livre"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 text-center bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-xl flex flex-col items-center gap-2">
                                        <p className="text-xs text-slate-400">
                                            Nenhuma conta conectada neste filtro.
                                        </p>
                                        <Link
                                            href="/agents"
                                            className="text-xs font-bold text-[#FF8216] hover:underline"
                                        >
                                            Conectar banco no Open Finance
                                        </Link>
                                    </div>
                                )}

                                {/* Resumo Rápido de Investimentos se existirem */}
                                {filteredInvestments.length > 0 && (
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-2.5">
                                            <span className="material-symbols-outlined text-emerald-500 text-lg">
                                                trending_up
                                            </span>
                                            <div>
                                                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                                    {filteredInvestments.length} Títulos / CDBs Sincronizados
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        setActiveTab("Investimentos & Crédito")
                                                    }
                                                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                                                >
                                                    Ver carteira detalhada →
                                                </button>
                                            </div>
                                        </div>
                                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                            {formatCurrency(investmentsBalance)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Coluna Direita: Lançamentos Recentes Enriquecidos (7 cols) */}
                        <div className="lg:col-span-7 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-lg text-[#FF8216]">
                                        receipt_long
                                    </span>
                                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                                        Movimentações Recentes Conciliadas
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setActiveTab("Extrato & Transações")}
                                    className="text-xs font-bold text-[#FF8216] hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                    Ver extrato completo
                                    <span className="material-symbols-outlined text-[14px]">
                                        arrow_forward
                                    </span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                {filteredTransactions.slice(0, 9).length > 0 ? (
                                    filteredTransactions.slice(0, 9).map((txn) => {
                                        const amt = Number(txn.amount) || 0;
                                        const isCredit = txn.type === "CREDIT";
                                        const cleanDesc =
                                            txn.clean_description || txn.description || "Transação";
                                        const catPt = txn.category_pt || txn.category || "Outros";
                                        const bankSlug =
                                            txn.bank_accounts?.institution_slug ||
                                            txn.bank_accounts?.institution_name ||
                                            txn.bank_accounts?.bank_name ||
                                            "generic";
                                        const bankLabel =
                                            txn.bank_accounts?.institution_name ||
                                            txn.bank_accounts?.bank_name ||
                                            "Banco";

                                        return (
                                            <div
                                                key={txn.id}
                                                className="p-3 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between gap-3 shadow-xs"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <BankLogo bank={bankSlug} size="xs" />
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                                {cleanDesc}
                                                            </span>
                                                            {renderTransactionBadge(txn)}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 truncate mt-0.5">
                                                            {formatDate(txn.date || txn.executed_at)} •{" "}
                                                            {bankLabel} • {catPt}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span
                                                    className={`text-xs md:text-sm font-bold tabular-nums shrink-0 ${
                                                        txn.is_refund
                                                            ? "text-emerald-500"
                                                            : txn.is_internal_transfer
                                                              ? "text-slate-400"
                                                              : isCredit
                                                                ? "text-emerald-500"
                                                                : "text-slate-800 dark:text-slate-200"
                                                    }`}
                                                >
                                                    {isCredit ? "+" : "-"}
                                                    {formatCurrency(Math.abs(amt))}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 text-center bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-xl text-xs text-slate-400">
                                        Nenhuma transação registrada neste filtro.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Mapa de Calor de Gastos Diários */}
                    <SpendingHeatmap
                        transactions={filteredTransactions.filter(
                            (t) => !t.is_internal_transfer && !t.is_refund
                        )}
                        formatCurrency={formatCurrency}
                    />
                </>
            ) : activeTab === "Parcelamentos" ? (
                <InstallmentsTracker
                    transactions={filteredTransactions}
                    formatCurrency={formatCurrency}
                />
            ) : activeTab === "Assinaturas" ? (
                <SubscriptionsTracker
                    transactions={filteredTransactions}
                    formatCurrency={formatCurrency}
                />
            ) : activeTab === "Extrato & Transações" ? (
                <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-4 md:p-6 shadow-xs flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                Extrato Open Finance Conciliado ({filteredTransactions.length}{" "}
                                lançamentos)
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Nomes de estabelecimentos decodificados, categorias em português e transferências próprias isoladas.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
                        {filteredTransactions.slice(0, 100).map((txn) => {
                            const amt = Number(txn.amount) || 0;
                            const isCredit = txn.type === "CREDIT";
                            const cleanDesc =
                                txn.clean_description || txn.description || "Transação";
                            const catPt = txn.category_pt || txn.category || "Outros";
                            const bankSlug =
                                txn.bank_accounts?.institution_slug ||
                                txn.bank_accounts?.institution_name ||
                                txn.bank_accounts?.bank_name ||
                                "generic";
                            const bankLabel =
                                txn.bank_accounts?.product_name ||
                                txn.bank_accounts?.institution_name ||
                                txn.bank_accounts?.bank_name ||
                                "Conta";

                            return (
                                <div
                                    key={txn.id}
                                    className="py-3 flex items-center justify-between text-xs gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <MerchantLogo
                                            cleanName={cleanDesc}
                                            rawDescription={txn.raw_description}
                                            category={catPt}
                                            size="sm"
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                    {cleanDesc}
                                                </span>
                                                {renderTransactionBadge(txn)}
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                                                <span>{formatDate(txn.date || txn.executed_at)}</span>
                                                <span>•</span>
                                                <BankLogo bank={bankSlug} size="xs" className="w-3.5 h-3.5 inline-block" />
                                                <span>{bankLabel}</span>
                                                <span>•</span>
                                                <span>{catPt}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={`font-bold tabular-nums shrink-0 ${
                                            txn.is_refund
                                                ? "text-emerald-500"
                                                : txn.is_internal_transfer
                                                  ? "text-slate-400"
                                                  : isCredit
                                                    ? "text-emerald-500"
                                                    : "text-slate-800 dark:text-slate-200"
                                        }`}
                                    >
                                        {isCredit ? "+" : "-"} {formatCurrency(Math.abs(amt))}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ) : activeTab === "Cartões de Crédito" ? (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredAccounts
                        .filter(
                            (a) =>
                                a.type === "CREDIT" ||
                                a.type === "CREDIT_CARD" ||
                                a.subtype === "CREDIT_CARD"
                        )
                        .map((card) => {
                            const bill = Math.abs(Number(card.balance) || 0);
                            const limit = Number(card.credit_limit) || 0;
                            const available =
                                card.available_credit_limit != null
                                    ? Number(card.available_credit_limit)
                                    : Math.max(0, limit - bill);
                            const usedPct =
                                limit > 0 ? Math.min(100, Math.round((bill / limit) * 100)) : 0;

                            return (
                                <div
                                    key={card.id}
                                    className="p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col justify-between gap-4"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <BankLogo
                                                bank={
                                                    card.institution_slug ||
                                                    card.institution_name ||
                                                    card.bank_name
                                                }
                                                size="md"
                                            />
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {card.product_name || card.bank_name}
                                                </h3>
                                                <span className="text-[11px] text-slate-400">
                                                    {card.institution_name || card.bank_name}
                                                    {card.card_brand ? ` • ${card.card_brand}` : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FF8216]/10 text-[#FF8216]">
                                            {bill > 0 ? "Fatura Aberta" : "Sem Fatura"}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block">
                                                Fatura Atual
                                            </span>
                                            <span className="text-base font-extrabold text-[#FF8216] tabular-nums">
                                                {formatCurrency(bill)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block">
                                                Limite Disponível
                                            </span>
                                            <span className="text-base font-extrabold text-emerald-500 tabular-nums">
                                                {limit > 0 ? formatCurrency(available) : "N/D"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block">
                                                Limite Total
                                            </span>
                                            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                                                {limit > 0 ? formatCurrency(limit) : "N/D"}
                                            </span>
                                        </div>
                                    </div>

                                    {limit > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                <span>Uso do limite: {usedPct}%</span>
                                                <span>
                                                    {card.balance_due_date
                                                        ? `Vencimento: ${formatDate(card.balance_due_date)}`
                                                        : ""}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 dark:bg-[#1E2533] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#FF8216] rounded-full"
                                                    style={{ width: `${usedPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </section>
            ) : activeTab === "Investimentos & Crédito" ? (
                <section className="flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Carteira de Investimentos Open Finance ({filteredInvestments.length})
                                </h2>
                                <p className="text-xs text-slate-400">
                                    CDBs, Renda Fixa, Tesouro e Fundos sincronizados diretamente das instituições conectadas.
                                </p>
                            </div>
                            <span className="text-lg font-extrabold text-emerald-500 tabular-nums">
                                {formatCurrency(investmentsBalance)}
                            </span>
                        </div>

                        {filteredInvestments.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">
                                Nenhum investimento encontrado neste filtro.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredInvestments.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <BankLogo
                                                bank={
                                                    inv.institution_slug ||
                                                    inv.institution_name ||
                                                    inv.issuer
                                                }
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                                    {inv.name}
                                                </span>
                                                <span className="text-[11px] text-slate-400 block truncate">
                                                    {inv.institution_name || inv.issuer || "Carteira"} •{" "}
                                                    {inv.subtype || inv.type}
                                                    {inv.rate
                                                        ? ` • ${inv.rate}% ${inv.rate_type || "CDI"}`
                                                        : ""}
                                                    {inv.due_date
                                                        ? ` • Venc: ${formatDate(inv.due_date)}`
                                                        : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-xs md:text-sm font-extrabold text-emerald-500 tabular-nums block">
                                                {formatCurrency(Number(inv.balance) || 0)}
                                            </span>
                                            {inv.amount_profit != null &&
                                                Number(inv.amount_profit) > 0 && (
                                                    <span className="text-[10px] text-slate-400">
                                                        Lucro: +
                                                        {formatCurrency(Number(inv.amount_profit))}
                                                    </span>
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Empréstimos / Financiamentos se existirem */}
                    <div className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Contratos de Empréstimos & Financiamentos ({filteredLoans.length})
                                </h2>
                                <p className="text-xs text-slate-400">
                                    Contratos registrados em GET /loans na Pluggy.
                                </p>
                            </div>
                            <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                                {formatCurrency(loansBalance)}
                            </span>
                        </div>
                        {filteredLoans.length === 0 ? (
                            <p className="text-xs text-slate-400">
                                Nenhum contrato de empréstimo ativo retornado pelas instituições conectadas.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {filteredLoans.map((loan) => (
                                    <div
                                        key={loan.id}
                                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between"
                                    >
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                                {loan.product_name}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {loan.institution_name} • Parcelas:{" "}
                                                {loan.paid_installments ?? "?"}/
                                                {loan.total_installments ?? "?"}
                                            </span>
                                        </div>
                                        <span className="text-sm font-extrabold text-[#FF8216] tabular-nums">
                                            {formatCurrency(Number(loan.outstanding_balance) || 0)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            ) : activeTab === "Categorias de Gastos" ? (
                <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-4 md:p-6 shadow-xs flex flex-col gap-3">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Distribuição de Gastos Reais por Categoria (Em Português)
                    </h2>
                    <div className="flex flex-col gap-2 pt-2">
                        {categorySummary.map((cat) => (
                            <div
                                key={cat.name}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-[#0E121A] flex items-center justify-between text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-[#FF8216]">
                                        category
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {cat.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        ({cat.count} lançamentos)
                                    </span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                                    {formatCurrency(cat.total)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : activeTab === "Perfil Open Finance" ? (
                <section className="flex flex-col gap-5">
                    <div className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 shadow-xs flex flex-col gap-5">
                        <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-white/5 pb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#FF8216]">
                                    verified_user
                                </span>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    Perfil Open Finance Consolidado (Consenso Multi-Banco)
                                </h2>
                            </div>
                            <p className="text-xs text-slate-400">
                                Dados cadastrais cruzados e unificados automaticamente a partir do endpoint /identity de todas as suas instituições conectadas.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                    Nome Civil Oficial
                                </span>
                                <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-1 block">
                                    {userProfile?.full_name || "Não informado"}
                                </span>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                    CPF Protegido
                                </span>
                                <span className="text-sm font-extrabold text-emerald-500 mt-1 block tabular-nums">
                                    {userProfile?.document_mask || "***.***.***-**"}
                                </span>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                    Nascimento
                                </span>
                                <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-1 block">
                                    {userProfile?.birth_date
                                        ? formatDate(userProfile.birth_date)
                                        : "Não informado"}
                                </span>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D]">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                    Profissão / Ocupação
                                </span>
                                <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-1 block truncate">
                                    {userProfile?.job_title || "Não informada"}
                                </span>
                            </div>
                        </div>

                        {/* Fontes por Banco */}
                        <div className="flex flex-col gap-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                O que cada instituição financeira informa ({userProfile?.bank_sources?.length || 0} fontes)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(userProfile?.bank_sources || []).map((src, idx) => (
                                    <div
                                        key={`${src.itemId}_${idx}`}
                                        className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] flex flex-col gap-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <BankLogo
                                                    bank={src.institutionSlug || src.institutionName}
                                                    size="xs"
                                                />
                                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                    {src.institutionName}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-emerald-500 font-semibold">
                                                {src.documentMask || "CPF Verificado"}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 flex flex-col gap-0.5">
                                            <span>Titular: {src.fullName || "-"}</span>
                                            {src.jobTitle && <span>Ocupação: {src.jobTitle}</span>}
                                            {src.emails?.length > 0 && (
                                                <span>E-mail: {src.emails.join(", ")}</span>
                                            )}
                                            {src.phones?.length > 0 && (
                                                <span>Telefone: {src.phones.join(", ")}</span>
                                            )}
                                            {src.cityState && (
                                                <span>Localidade: {src.cityState}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                /* Aba: Visão Compartilhada / Agregação Familiar Completa */
                <section className="flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#FF8216]">
                                        diversity_3
                                    </span>
                                    <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
                                        Agregação Familiar & Compartilhamento
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-2xl leading-relaxed">
                                    Conecte contas de dependentes ou parceiros ao seu workspace. Cada membro pode vincular seus próprios bancos via Open Finance de forma isolada.
                                </p>
                            </div>

                            <button
                                onClick={() => setIsFamilyModeEnabled(!isFamilyModeEnabled)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                    isFamilyModeEnabled
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-[#FF8216] text-white shadow-xs"
                                }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {isFamilyModeEnabled ? "check_circle" : "toggle_on"}
                                </span>
                                {isFamilyModeEnabled
                                    ? "Visão Familiar Ativa"
                                    : "Ativar Modo Familiar"}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <form
                                onSubmit={handleAddFamilyMember}
                                className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] flex flex-col gap-3.5"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[#FF8216] text-[17px]">
                                            person_add
                                        </span>
                                        Adicionar Membro da Família
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        Crie o perfil e envie o convite para conectar contas bancárias.
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nome do membro (ex: Mariana)"
                                        value={newMemberName}
                                        onChange={(e) => setNewMemberName(e.target.value)}
                                        required
                                        className="p-2.5 bg-white dark:bg-[#141A24] border border-slate-200 dark:border-[#262E3D] rounded-xl text-xs text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:border-[#FF8216]"
                                    />

                                    <CustomDropdown
                                        value={newMemberRole}
                                        onChange={(val) => setNewMemberRole(val)}
                                        options={[
                                            { value: "Cônjuge", label: "Cônjuge / Parceiro(a)" },
                                            { value: "Filho(a)", label: "Filho(a) / Dependente" },
                                            { value: "Sócio(a)", label: "Sócio(a)" },
                                            { value: "Outro", label: "Outro Membro" },
                                        ]}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isCreatingMember || !newMemberName.trim()}
                                    className="h-10 px-4 bg-[#FF8216] hover:bg-[#FFA047] text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    {isCreatingMember ? (
                                        <Spinner size={14} className="text-white" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[16px]">
                                            add
                                        </span>
                                    )}
                                    <span>Adicionar Membro</span>
                                </button>
                            </form>

                            <div className="lg:col-span-7 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                        Membros Cadastrados ({familyMembers.length})
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        Clique para vincular bancos ou compartilhar link
                                    </span>
                                </div>

                                {familyMembers.length > 0 ? (
                                    <div className="flex flex-col gap-2.5">
                                        {familyMembers.map((m) => {
                                            const memberAccounts = accounts.filter(
                                                (a) => a.family_member_id === m.id
                                            );
                                            return (
                                                <div
                                                    key={m.id}
                                                    className="p-3.5 bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-[#262E3D] rounded-xl flex flex-col gap-2.5"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center font-bold text-xs">
                                                                {m.name.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">
                                                                    {m.name}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400">
                                                                    {m.role || "Membro"} •{" "}
                                                                    {memberAccounts.length} conta(s)
                                                                    vinculada(s)
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() =>
                                                                handleDeleteFamilyMember(m.id)
                                                            }
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                                            title="Remover membro"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">
                                                                delete
                                                            </span>
                                                        </button>
                                                    </div>

                                                    {memberAccounts.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {memberAccounts.map((acc) => (
                                                                <span
                                                                    key={acc.id}
                                                                    className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-[#161B26] border border-slate-200 dark:border-white/5 font-semibold text-slate-700 dark:text-slate-300"
                                                                >
                                                                    {acc.product_name ||
                                                                        acc.bank_name}{" "}
                                                                    (
                                                                    {formatCurrency(
                                                                        Number(acc.balance) || 0
                                                                    )}
                                                                    )
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setConnectForMemberId(m.id);
                                                                setIsConnectModalOpen(true);
                                                            }}
                                                            className="h-8 px-2.5 rounded-lg bg-[#FF8216]/10 hover:bg-[#FF8216]/20 text-[#FF8216] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">
                                                                add_link
                                                            </span>
                                                            <span>
                                                                Conectar Banco via Open Finance
                                                            </span>
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                handleCopyInviteLink(m.id)
                                                            }
                                                            className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#141A24] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">
                                                                link
                                                            </span>
                                                            <span>
                                                                {copiedMemberId === m.id
                                                                    ? "Link Copiado!"
                                                                    : "Copiar Link"}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-[#0E121A] text-center border border-slate-200 dark:border-[#262E3D]">
                                        Nenhum membro adicional cadastrado. Adicione seu cônjuge ou dependentes para consolidar o patrimônio da família.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <PluggyConnectModal
                isOpen={isConnectModalOpen}
                onClose={() => {
                    setIsConnectModalOpen(false);
                    setConnectForMemberId(null);
                }}
                familyMembers={familyMembers}
                initialMemberId={connectForMemberId}
                onMemberCreated={(newMember) => {
                    addFamilyMemberLocal(newMember);
                }}
                onConnectionSuccess={() => {
                    revalidate(true);
                }}
            />

            <GlobalFinanceSearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                transactions={filteredTransactions}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
            />
        </div>
    );
}
