"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import PluggyConnectModal from "@/components/PluggyConnectModal";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useFinanceData } from "@/context/FinanceDataContext";

export default function DashboardPage() {
  const {
    user,
    userProfile,
    accounts,
    transactions,
    familyMembers,
    aiInsight,
    isInitialLoading,
    isRevalidating,
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

  // Estado de geração de insight IA
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Estado para adicionar membro na aba Visão Compartilhada/Familiar
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Cônjuge");
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  const TABS = [
    "Visão Geral",
    "Extrato & Transações",
    "Cartões de Crédito",
    "Categorias de Gastos",
    "Visão Familiar",
  ];

  const memberMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    familyMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [familyMembers]);

  const filteredAccounts = useMemo(() => {
    if (!isFamilyModeEnabled || selectedMemberId === "all") {
      return accounts;
    }
    if (selectedMemberId === "personal") {
      return accounts.filter((a) => !a.family_member_id);
    }
    return accounts.filter((a) => a.family_member_id === selectedMemberId);
  }, [accounts, isFamilyModeEnabled, selectedMemberId]);

  const filteredTransactions = useMemo(() => {
    if (!isFamilyModeEnabled || selectedMemberId === "all") {
      return transactions;
    }
    if (selectedMemberId === "personal") {
      return transactions.filter((t) => !t.family_member_id);
    }
    return transactions.filter((t) => t.family_member_id === selectedMemberId);
  }, [transactions, isFamilyModeEnabled, selectedMemberId]);

  const {
    totalBalance,
    liquidBalance,
    creditCardBalance,
    monthlyIncome,
    monthlyExpense,
    categorySummary,
  } = useMemo(() => {
    let liquid = 0;
    let credit = 0;

    filteredAccounts.forEach((curr) => {
      const bal = Number(curr.balance) || 0;
      if (curr.type === "CREDIT" || curr.type === "CREDIT_CARD") {
        credit += Math.abs(bal);
      } else {
        liquid += bal;
      }
    });

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let income = 0;
    let expense = 0;
    const catMap: Record<string, { total: number; count: number }> = {};

    filteredTransactions.forEach((txn) => {
      const rawDate = txn.executed_at || txn.date;
      if (!rawDate) return;
      const txnDate = new Date(rawDate);
      const amount = Number(txn.amount) || 0;
      const isCreditTx = txn.type === "CREDIT" || amount > 0;

      if (txnDate >= currentMonthStart) {
        if (isCreditTx) {
          income += Math.abs(amount);
        } else {
          expense += Math.abs(amount);
        }
      }

      if (!isCreditTx) {
        const catName = txn.category || "Outros";
        if (!catMap[catName]) catMap[catName] = { total: 0, count: 0 };
        catMap[catName].total += Math.abs(amount);
        catMap[catName].count += 1;
      }
    });

    const sortedCategories = Object.entries(catMap)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.total - a.total);

    return {
      totalBalance: liquid - credit,
      liquidBalance: liquid,
      creditCardBalance: credit,
      monthlyIncome: income,
      monthlyExpense: expense,
      categorySummary: sortedCategories,
    };
  }, [filteredAccounts, filteredTransactions]);

  // Cálculo Determinístico do Kitsune Score de Saúde Financeira
  const kitsuneScore = useMemo(() => {
    if (accounts.length === 0) return { score: 500, label: "Aguardando Conexões", color: "text-slate-400" };
    let score = 550;

    // Cobertura da fatura com liquidez disponível
    if (liquidBalance > creditCardBalance * 1.5) score += 180;
    else if (liquidBalance >= creditCardBalance) score += 90;
    else score -= 140;

    // Balanço do mês
    const netMonthly = monthlyIncome - monthlyExpense;
    if (netMonthly > 0) score += 160;
    else if (monthlyExpense > 0) score -= 100;

    // Diversificação
    if (accounts.length >= 2) score += 60;

    const finalScore = Math.max(300, Math.min(990, score));
    if (finalScore >= 800) return { score: finalScore, label: "Excelente", color: "text-emerald-500" };
    if (finalScore >= 650) return { score: finalScore, label: "Saudável", color: "text-emerald-500" };
    if (finalScore >= 500) return { score: finalScore, label: "Equilibrado", color: "text-[#FF8216]" };
    return { score: finalScore, label: "Atenção Necessária", color: "text-red-500" };
  }, [accounts.length, liquidBalance, creditCardBalance, monthlyIncome, monthlyExpense]);

  // Pré-computação automática de IA em background se não houver insight salvo
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
    if (!confirm("Tem certeza que deseja remover este membro da visualização compartilhada?")) return;
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      const parts = dateString.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateString;
    }
    return d.toLocaleDateString("pt-BR");
  };

  const userDisplayName =
    userProfile?.display_name ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Investidor";

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

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 max-w-6xl mx-auto w-full font-sans">
      {/* Header Principal */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Ambiente Blindado • Leitura Somente-Leitura
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Olá, {userDisplayName}!
          </h1>

          <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8] max-w-xl leading-relaxed">
            Acompanhe suas contas, faturas e fluxo de caixa consolidado em tempo real.
          </p>
        </div>

        {/* Ações Superiores */}
        <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto">
          <button
            onClick={() => revalidate(true)}
            title="Atualizar dados bancários agora"
            className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-white dark:bg-[#12161F] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <span className={`material-symbols-outlined text-[17px] text-emerald-500 ${isRevalidating ? "animate-spin" : ""}`}>
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
          {/* Key Metrics: 4 Cards Responsivos */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Card 1: Patrimônio Total */}
            <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Patrimônio Líquido
                </span>
                <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 flex items-center justify-center text-[#FF8216]">
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                </div>
              </div>
              <div>
                <span className="text-lg md:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tabular-nums tracking-tight block">
                  {formatCurrency(totalBalance)}
                </span>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
                  Disponível: {formatCurrency(liquidBalance)}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Faturas descontadas</span>
                <span className={totalBalance >= 0 ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                  {totalBalance >= 0 ? "Positivo" : "Negativo"}
                </span>
              </div>
            </div>

            {/* Card 2: Entradas Deste Mês */}
            <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Entradas do Mês
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                </div>
              </div>
              <div>
                <span className="text-lg md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight block">
                  {formatCurrency(monthlyIncome)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Créditos registrados
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Fluxo de Caixa</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">Confirmado</span>
              </div>
            </div>

            {/* Card 3: Gastos Deste Mês */}
            <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex flex-col justify-between gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Saídas do Mês
                </span>
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                  <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                </div>
              </div>
              <div>
                <span className="text-lg md:text-2xl font-extrabold text-red-600 dark:text-red-400 tabular-nums tracking-tight block">
                  {formatCurrency(monthlyExpense)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {categorySummary[0] ? `Top: ${categorySummary[0].name}` : "Despesas do período"}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Margem de Sobra</span>
                <span className="text-emerald-500 font-bold tabular-nums">
                  {formatCurrency(Math.max(0, monthlyIncome - monthlyExpense))}
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
                  <span className="material-symbols-outlined text-[16px]">credit_card</span>
                </div>
              </div>
              <div>
                <span className="text-lg md:text-2xl font-extrabold text-[#FF8216] tabular-nums tracking-tight block">
                  {formatCurrency(creditCardBalance)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {liquidBalance >= creditCardBalance ? "Coberto pelo saldo" : "Atenção à liquidez"}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Status da Fatura</span>
                <span className="text-[#FF8216] font-semibold">Em Aberto</span>
              </div>
            </div>
          </section>

          {/* Painel Consultivo da Kitsune AI (Sóbrio, Sem Glows, 100% Dinâmico) */}
          <section className="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">psychology</span>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
                    Diagnóstico da Kitsune IA
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A202C] text-xs font-bold ${kitsuneScore.color}`}>
                    Score: {kitsuneScore.score} • {kitsuneScore.label}
                  </span>
                </div>

                {isGeneratingAi ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-slate-500 dark:text-[#94A3B8]">
                    <Spinner size={14} className="text-[#FF8216]" />
                    <span>A Kitsune IA está analisando seu patrimônio...</span>
                  </div>
                ) : aiInsight ? (
                  <p className="text-xs md:text-sm text-slate-600 dark:text-[#94A3B8] leading-relaxed whitespace-pre-line font-normal">
                    {aiInsight.text}
                  </p>
                ) : (
                  <p className="text-xs md:text-sm text-slate-600 dark:text-[#94A3B8] leading-relaxed">
                    Seu patrimônio consolidado está em <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(totalBalance)}</strong> com <strong className="text-emerald-500">{formatCurrency(liquidBalance)}</strong> disponível em conta e <strong className="text-[#FF8216]">{formatCurrency(creditCardBalance)}</strong> em faturas abertas. Clique ao lado para gerar sua análise consultiva.
                  </p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-emerald-500">verified</span>
                    Baseado em dados reais do Open Finance
                  </span>
                  {aiInsight && (
                    <>
                      <span>•</span>
                      <span>Atualizado às {new Date(aiInsight.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Ações da Consultora */}
            <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
              <Link
                href="/kitsune"
                className="flex-1 md:flex-initial h-10 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chat</span>
                <span>Conversar</span>
              </Link>

              <button
                onClick={generateAiInsight}
                disabled={isGeneratingAi}
                className="flex-1 md:flex-initial h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A202C] dark:hover:bg-[#222A3A] border border-slate-200 dark:border-[#262E3D] text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px] text-[#FF8216]">refresh</span>
                <span>Atualizar</span>
              </button>
            </div>
          </section>

          {/* Grid de 2 Colunas: Contas Conectadas + Lançamentos Recentes */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna Esquerda: Minhas Contas & Cartões (5 cols) */}
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
                    const isCredit = account.type === "CREDIT" || account.type === "CREDIT_CARD";
                    return (
                      <div
                        key={account.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between hover:border-[#FF8216]/40 transition-colors shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1A202C] flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                            <span className="material-symbols-outlined text-[18px]">
                              {isCredit ? "credit_card" : "account_balance"}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                              {account.bank_name || "Conta Bancária"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {isCredit ? "Cartão de Crédito" : "Conta Corrente"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 pl-2">
                          <span
                            className={`text-xs md:text-sm font-extrabold tabular-nums ${
                              isCredit ? "text-[#FF8216]" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {formatCurrency(Number(account.balance) || 0)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isCredit ? "Fatura atual" : "Saldo livre"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-xl flex flex-col items-center gap-2">
                    <p className="text-xs text-slate-400">Nenhuma conta conectada neste escopo.</p>
                    <Link
                      href="/agents"
                      className="text-xs font-bold text-[#FF8216] hover:underline"
                    >
                      Conectar banco no Open Finance
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Coluna Direita: Lançamentos Recentes (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg text-[#FF8216]">
                    receipt_long
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                    Movimentações Recentes
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab("Extrato & Transações")}
                  className="text-xs font-bold text-[#FF8216] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  Ver extrato
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {filteredTransactions.slice(0, 7).length > 0 ? (
                  filteredTransactions.slice(0, 7).map((txn) => {
                    const amt = Number(txn.amount) || 0;
                    const isCredit = txn.type === "CREDIT" || amt > 0;
                    return (
                      <div
                        key={txn.id}
                        className="p-3 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isCredit
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-slate-100 dark:bg-[#1A202C] text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isCredit ? "arrow_downward" : "arrow_upward"}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {txn.description}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(txn.executed_at || txn.date)} • {txn.category || "Geral"}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-xs md:text-sm font-bold tabular-nums shrink-0 ${
                            isCredit ? "text-emerald-500" : "text-slate-800 dark:text-slate-200"
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
                    Nenhuma transação registrada no período.
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : activeTab === "Extrato & Transações" ? (
        /* Aba Extrato */
        <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-4 md:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Extrato Consolidado ({filteredTransactions.length} lançamentos)
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
            {filteredTransactions.slice(0, 30).map((txn) => {
              const amt = Number(txn.amount) || 0;
              const isCredit = txn.type === "CREDIT" || amt > 0;
              return (
                <div key={txn.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {txn.description}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(txn.executed_at || txn.date)} • {txn.category || "Outros"}
                    </span>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${
                      isCredit ? "text-emerald-500" : "text-slate-800 dark:text-slate-200"
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
        /* Aba Cartões */
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAccounts
            .filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD")
            .map((card) => (
              <div
                key={card.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216]">credit_card</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {card.bank_name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF8216]/10 text-[#FF8216]">
                    Fatura Aberta
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Valor Atual da Fatura</span>
                  <div className="text-2xl font-extrabold text-[#FF8216] tabular-nums mt-0.5">
                    {formatCurrency(Number(card.balance) || 0)}
                  </div>
                </div>
              </div>
            ))}
        </section>
      ) : activeTab === "Categorias de Gastos" ? (
        /* Aba Categorias */
        <section className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-4 md:p-6 shadow-xs flex flex-col gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Distribuição de Gastos do Mês
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
                  <span className="text-[10px] text-slate-400">({cat.count} lançamentos)</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* Aba: Visão Compartilhada / Agregação Familiar Completa */
        <section className="flex flex-col gap-6">
          <div className="bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 md:p-6 flex flex-col gap-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF8216]">diversity_3</span>
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
                {isFamilyModeEnabled ? "Visão Familiar Ativa" : "Ativar Modo Familiar"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulário de Adicionar Membro */}
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
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  )}
                  <span>Adicionar Membro</span>
                </button>
              </form>

              {/* Lista de Membros e Suas Conexões */}
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
                      const memberAccounts = accounts.filter((a) => a.family_member_id === m.id);
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
                                  {m.role || "Membro"} • {memberAccounts.length} conta(s) vinculada(s)
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteFamilyMember(m.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                              title="Remover membro"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>

                          {/* Contas do Membro */}
                          {memberAccounts.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {memberAccounts.map((acc) => (
                                <span
                                  key={acc.id}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-[#161B26] border border-slate-200 dark:border-white/5 font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {acc.bank_name} ({formatCurrency(Number(acc.balance) || 0)})
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Ações de Conexão do Membro */}
                          <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-2">
                            <button
                              onClick={() => {
                                setConnectForMemberId(m.id);
                                setIsConnectModalOpen(true);
                              }}
                              className="h-8 px-2.5 rounded-lg bg-[#FF8216]/10 hover:bg-[#FF8216]/20 text-[#FF8216] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">add_link</span>
                              <span>Conectar Banco via Open Finance</span>
                            </button>

                            <button
                              onClick={() => handleCopyInviteLink(m.id)}
                              className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#141A24] hover:bg-slate-100 dark:hover:bg-[#1A202C] border border-slate-200 dark:border-[#262E3D] text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">link</span>
                              <span>{copiedMemberId === m.id ? "Link Copiado!" : "Copiar Link"}</span>
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

      {/* Modal de Conexão Open Finance com suporte a Membro da Família */}
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
    </div>
  );
}
