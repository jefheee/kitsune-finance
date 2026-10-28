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

  // Estado de geração de insight IA
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Estado para adicionar membro na aba Visão Compartilhada/Familiar
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Cônjuge");
  const [isCreatingMember, setIsCreatingMember] = useState(false);

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
        credit += bal;
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

  // Cálculo Determinístico do Kitsune Score de Saúde Financeira (0 - 1000)
  const kitsuneScore = useMemo(() => {
    if (accounts.length === 0) return { score: 500, label: "Aguardando Conexões", color: "text-[#94A3B8]" };
    let score = 500;

    // 1. Cobertura de Cartão com Liquidez
    if (liquidBalance > creditCardBalance * 1.5) score += 200;
    else if (liquidBalance >= creditCardBalance) score += 100;
    else score -= 150;

    // 2. Balanço Mensal
    const netMonthly = monthlyIncome - monthlyExpense;
    if (netMonthly > 0) score += 180;
    else if (monthlyExpense > 0) score -= 120;

    // 3. Diversificação / Contas
    if (accounts.length >= 2) score += 70;

    const finalScore = Math.max(300, Math.min(980, score));
    if (finalScore >= 800) return { score: finalScore, label: "Excelente", color: "text-[#10B981]" };
    if (finalScore >= 650) return { score: finalScore, label: "Saudável", color: "text-[#10B981]" };
    if (finalScore >= 500) return { score: finalScore, label: "Atenção Necessária", color: "text-[#FF6B00]" };
    return { score: finalScore, label: "Risco de Liquidez", color: "text-[#EF4444]" };
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
        body: JSON.stringify({ name: newMemberName.trim(), role: newMemberRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao criar membro");
      addFamilyMemberLocal(data.member);
      setNewMemberName("");
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

  const scopeLabel = !isFamilyModeEnabled
    ? `Patrimônio Pessoal • ${userDisplayName}`
    : selectedMemberId === "all"
    ? "Consolidado Compartilhado"
    : selectedMemberId === "personal"
    ? `Individual (${userDisplayName})`
    : memberMap.get(selectedMemberId)?.name || "Membro";

  if (isInitialLoading && accounts.length === 0 && transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-12 bg-[#0F141C]">
        <div className="w-12 h-12 rounded-2xl bg-[#141A24] border border-[#263042] flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-2xl text-[#FF6B00]">
            auto_awesome
          </span>
        </div>
        <span className="text-xs text-[#94A3B8] font-medium mt-3">
          Sincronizando patrimônio com segurança...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-6xl mx-auto w-full bg-[#0F141C] text-[#F8FAFC]">
      {/* Header Principal: Warm Obsidian & Human-Centric */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#141A24] border border-[#263042] w-fit">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="text-xs text-[#10B981] font-semibold tracking-normal">
              Proteção Bancária Ativa • Criptografia de ponta a ponta
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
            Olá, {userDisplayName}!{" "}
            <span className="text-[#FF6B00] font-normal">Aqui está seu resumo financeiro de hoje.</span>
          </h1>

          <p className="text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Acompanhe de forma simples e transparente suas contas, metas e o fechamento do seu mês, sem termos complicados.
          </p>
        </div>

        {/* Top Action Cluster */}
        <div className="flex items-center gap-3 shrink-0 self-start lg:self-auto">
          <button
            onClick={() => revalidate(true)}
            title="Atualizar dados bancários agora"
            className="h-11 px-4 rounded-xl bg-[#141A24] hover:bg-[#1C2331] border border-[#263042] text-xs font-semibold text-[#F8FAFC] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <span className={`material-symbols-outlined text-[18px] text-[#10B981] ${isRevalidating ? "animate-spin" : ""}`}>
              sync
            </span>
            <span className="hidden sm:inline">Atualizar Tudo</span>
          </button>

          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="h-11 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7D1A] active:bg-[#E05E00] text-white font-bold text-xs flex items-center gap-2 shadow-[0_4px_16px_rgba(255,107,0,0.35)] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_link</span>
            <span>Conectar Nova Conta</span>
          </button>
        </div>
      </header>

      {/* Abas de Navegação Rápida (Estilo Stitch) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-6 px-6 md:mx-0 md:px-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const isFamilyTab = tab === "Visão Familiar";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/25"
                  : isFamilyTab
                  ? "bg-[#141A24] text-[#FF6B00] hover:bg-[#1C2331] border border-[#FF6B00]/30"
                  : "bg-[#141A24] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1C2331] border border-[#263042]"
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
          {/* Key Metrics Row (4 Cards de Alto Contraste Stitch) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Patrimônio Líquido */}
            <div className="p-6 rounded-2xl bg-[#141A24] border border-[#263042] flex flex-col justify-between gap-3 shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Patrimônio Total Líquido
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#1C2331] flex items-center justify-center text-[#FF6B00]">
                  <span className="material-symbols-outlined text-lg">account_balance</span>
                </div>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-extrabold text-[#F8FAFC] tabular-nums tracking-tight">
                  {formatCurrency(totalBalance)}
                </span>
                <p className="text-xs text-[#10B981] font-semibold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Disponível em conta: {formatCurrency(liquidBalance)}
                </p>
              </div>
              <div className="pt-2 border-t border-[#263042]/70 flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span>Descontadas faturas em aberto</span>
                <span className="text-[#10B981] font-semibold">Balanço Positivo</span>
              </div>
            </div>

            {/* Card 2: Entradas Deste Mês */}
            <div className="p-6 rounded-2xl bg-[#141A24] border border-[#263042] flex flex-col justify-between gap-3 shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Entradas Deste Mês
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 flex items-center justify-center text-[#10B981]">
                  <span className="material-symbols-outlined text-lg">trending_up</span>
                </div>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-extrabold text-[#10B981] tabular-nums tracking-tight">
                  {formatCurrency(monthlyIncome)}
                </span>
                <p className="text-xs text-[#94A3B8] mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#10B981]">check_circle</span>
                  Recebimentos e créditos registrados
                </p>
              </div>
              <div className="pt-2 border-t border-[#263042]/70 flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span>Fluxo de Caixa</span>
                <span className="text-[#F8FAFC] font-semibold">Entradas Confirmadas</span>
              </div>
            </div>

            {/* Card 3: Gastos Deste Mês */}
            <div className="p-6 rounded-2xl bg-[#141A24] border border-[#263042] flex flex-col justify-between gap-3 shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Gastos Deste Mês
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#EF4444]/15 flex items-center justify-center text-[#EF4444]">
                  <span className="material-symbols-outlined text-lg">shopping_bag</span>
                </div>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-extrabold text-[#EF4444] tabular-nums tracking-tight">
                  {formatCurrency(monthlyExpense)}
                </span>
                <p className="text-xs text-[#94A3B8] mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#FF6B00]">pie_chart</span>
                  {categorySummary[0] ? `Maior peso: ${categorySummary[0].name}` : "Gastos controlados"}
                </p>
              </div>
              <div className="pt-2 border-t border-[#263042]/70 flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span>Margem de Sobra</span>
                <span className="text-[#10B981] font-semibold">
                  {formatCurrency(Math.max(0, monthlyIncome - monthlyExpense))}
                </span>
              </div>
            </div>

            {/* Card 4: Faturas de Cartão */}
            <div className="p-6 rounded-2xl bg-[#141A24] border border-[#263042] flex flex-col justify-between gap-3 shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Fatura Atual do Cartão
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#1C2331] flex items-center justify-center text-[#FF6B00]">
                  <span className="material-symbols-outlined text-lg">credit_card</span>
                </div>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-extrabold text-[#FF6B00] tabular-nums tracking-tight">
                  {formatCurrency(creditCardBalance)}
                </span>
                <p className="text-xs text-[#94A3B8] mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#FF6B00]">schedule</span>
                  {liquidBalance >= creditCardBalance ? "Saldo em conta cobre 100%" : "Atenção: liquidez menor que a fatura"}
                </p>
              </div>
              <div className="pt-2 border-t border-[#263042]/70 flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span>Status da Fatura</span>
                <span className="text-[#FF6B00] font-semibold">Em Aberto</span>
              </div>
            </div>
          </section>

          {/* Kitsune Health Score & Atmospheric Advisory Panel (Stitch) */}
          <section className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#FF6B00]/15 via-[#141A24] to-[#090E16] border border-[#FF6B00]/30 shadow-xl relative overflow-hidden">
            {/* Ambient Back Glow */}
            <div className="absolute -left-16 -bottom-16 w-72 h-72 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FF6B00] flex items-center justify-center text-white shrink-0 shadow-[0_4px_20px_rgba(255,107,0,0.4)]">
                  <span className="material-symbols-outlined text-3xl">psychology</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg md:text-xl font-bold text-[#F8FAFC]">
                      Diagnóstico & Conselho da Kitsune IA
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-xs font-bold">
                      Score de Saúde: {kitsuneScore.score} • {kitsuneScore.label}
                    </span>
                  </div>

                  {isGeneratingAi ? (
                    <div className="flex items-center gap-3 py-2 text-xs text-[#94A3B8] animate-pulse">
                      <Spinner size={16} />
                      <span>A Kitsune IA está analisando seus lançamentos e preparando recomendações...</span>
                    </div>
                  ) : aiInsight ? (
                    <p className="text-sm md:text-base text-[#94A3B8] leading-relaxed max-w-3xl whitespace-pre-line font-normal">
                      {aiInsight.text}
                    </p>
                  ) : (
                    <p className="text-sm text-[#94A3B8]">
                      Seus dados financeiros estão prontos para análise consultiva. Clique ao lado para gerar seu diagnóstico personalizado.
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-[#94A3B8] pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#10B981]">verified</span>
                      Gerado com base em seus hábitos recentes
                    </span>
                    {aiInsight && (
                      <>
                        <span>•</span>
                        <span>Atualizado em {new Date(aiInsight.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações Rápidas da Consultora */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full lg:w-auto">
                <Link
                  href="/kitsune"
                  className="h-11 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#FF7D1A] active:bg-[#E05E00] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,107,0,0.35)] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                  Conversar com a Kitsune
                </Link>

                <button
                  onClick={generateAiInsight}
                  disabled={isGeneratingAi}
                  className="h-11 px-5 rounded-xl bg-[#1C2331] hover:bg-[#252A33] border border-[#263042] text-xs font-semibold text-[#F8FAFC] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#FF6B00]">
                    refresh
                  </span>
                  Atualizar Diagnóstico
                </button>
              </div>
            </div>
          </section>

          {/* Two Column Layout: Connected Accounts + Recent Transactions */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Minhas Contas e Cartões (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-[#FF6B00]">
                    account_balance_wallet
                  </span>
                  <h2 className="text-base font-bold text-[#F8FAFC]">
                    Minhas Contas & Cartões
                  </h2>
                </div>
                <span className="text-xs text-[#94A3B8] bg-[#141A24] border border-[#263042] px-2.5 py-1 rounded-lg">
                  {filteredAccounts.length} Ativa(s)
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => {
                    const isCredit =
                      account.type === "CREDIT" || account.type === "CREDIT_CARD";
                    return (
                      <div
                        key={account.id}
                        className="p-5 rounded-2xl bg-[#141A24] border border-[#263042] hover:border-[#FF6B00]/40 transition-all flex flex-col gap-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#1C2331] flex items-center justify-center text-[#FF6B00]">
                              <span className="material-symbols-outlined text-xl">
                                {isCredit ? "credit_card" : "account_balance"}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-[#F8FAFC]">
                                {account.bank_name || account.name || "Instituição"}
                              </h3>
                              <p className="text-[11px] text-[#94A3B8]">
                                {isCredit ? "Cartão de Crédito" : "Conta Corrente / Digital"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isCredit
                                ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                                : "bg-[#10B981]/15 text-[#10B981]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isCredit ? "bg-[#FF6B00]" : "bg-[#10B981]"
                              }`}
                            />
                            {isCredit ? "Fatura Aberta" : "Seguro & Ativo"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#0F141C] border border-[#263042]/70 flex items-center justify-between">
                          <span className="text-xs text-[#94A3B8]">
                            {isCredit ? "Fatura Atual:" : "Saldo Disponível:"}
                          </span>
                          <span
                            className={`text-base font-extrabold tabular-nums ${
                              isCredit ? "text-[#FF6B00]" : "text-[#10B981]"
                            }`}
                          >
                            {formatCurrency(Number(account.balance) || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center bg-[#141A24] rounded-2xl border border-[#263042] flex flex-col items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-[#94A3B8]">
                      account_balance
                    </span>
                    <p className="text-xs font-semibold text-[#F8FAFC]">
                      Nenhuma instituição bancária conectada.
                    </p>
                    <button
                      onClick={() => setIsConnectModalOpen(true)}
                      className="px-4 py-2 bg-[#FF6B00] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                    >
                      Conectar Banco
                    </button>
                  </div>
                )}
              </div>

              {/* Caixa de Garantia Bancária Bacen */}
              <div className="p-4 rounded-xl bg-[#141A24] border border-[#263042] flex items-center gap-3 text-xs text-[#94A3B8]">
                <span className="material-symbols-outlined text-xl text-[#10B981] shrink-0">
                  shield
                </span>
                <p>
                  Protegido pelos protocolos do <strong className="text-[#F8FAFC]">Banco Central do Brasil</strong>. Nenhuma senha bancária é armazenada.
                </p>
              </div>
            </div>

            {/* Right Column: Movimentações Recentes (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-[#FF6B00]">
                    receipt_long
                  </span>
                  <h2 className="text-base font-bold text-[#F8FAFC]">
                    Movimentações Recentes
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab("Extrato & Transações")}
                  className="text-xs text-[#FF6B00] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Ver extrato completo
                  <span className="material-symbols-outlined text-[15px]">
                    chevron_right
                  </span>
                </button>
              </div>

              <div className="flex flex-col bg-[#141A24] border border-[#263042] rounded-2xl shadow-sm overflow-hidden divide-y divide-[#263042]/70">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.slice(0, 15).map((txn) => {
                    const isCredit = txn.type === "CREDIT" || Number(txn.amount) > 0;
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-4 hover:bg-[#1C2331]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isCredit
                                ? "bg-[#10B981]/15 text-[#10B981]"
                                : "bg-[#EF4444]/15 text-[#EF4444]"
                            }`}
                          >
                            <span className="material-symbols-outlined text-base">
                              {isCredit ? "payments" : "shopping_cart"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs md:text-sm font-semibold text-[#F8FAFC] line-clamp-1">
                              {txn.description}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] mt-0.5">
                              <span>{formatDate(txn.executed_at || txn.date)}</span>
                              <span>•</span>
                              <span>{txn.category || "Outros"}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-sm font-bold tabular-nums shrink-0 pl-3 ${
                            isCredit ? "text-[#10B981]" : "text-[#EF4444]"
                          }`}
                        >
                          {isCredit ? "+ " : "- "}
                          {formatCurrency(Math.abs(Number(txn.amount)))}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-[#94A3B8]">
                    Nenhuma transação sincronizada ainda.
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : activeTab === "Extrato & Transações" ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F8FAFC]">
              Histórico Completo de Transações ({filteredTransactions.length})
            </h2>
            <span className="text-xs text-[#94A3B8]">{scopeLabel}</span>
          </div>

          <div className="flex flex-col bg-[#141A24] border border-[#263042] rounded-2xl shadow-sm overflow-hidden divide-y divide-[#263042]/70">
            {filteredTransactions.map((txn) => {
              const isCredit = txn.type === "CREDIT" || Number(txn.amount) > 0;
              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 hover:bg-[#1C2331]/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit
                          ? "bg-[#10B981]/15 text-[#10B981]"
                          : "bg-[#EF4444]/15 text-[#EF4444]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {isCredit ? "arrow_upward" : "arrow_downward"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#F8FAFC]">
                        {txn.description}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-[#94A3B8] mt-0.5">
                        <span>{formatDate(txn.executed_at || txn.date)}</span>
                        <span>•</span>
                        <span>{txn.category || "Outros"}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-sm font-bold tabular-nums shrink-0 pl-3 ${
                      isCredit ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {isCredit ? "+ " : "- "}
                    {formatCurrency(Math.abs(Number(txn.amount)))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : activeTab === "Cartões de Crédito" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-[#F8FAFC]">
            Meus Cartões de Crédito
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD")
              .length > 0 ? (
              filteredAccounts
                .filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD")
                .map((card) => (
                  <div
                    key={card.id}
                    className="bg-[#141A24] border border-[#263042] rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between h-48 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm tracking-wide text-[#F8FAFC]">
                        {card.bank_name || card.name}
                      </span>
                      <span className="material-symbols-outlined text-[#FF6B00] text-xl">
                        contactless
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#94A3B8]">Fatura Atual</span>
                      <span className="text-2xl font-extrabold tabular-nums tracking-tight text-[#FF6B00]">
                        {formatCurrency(Number(card.balance) || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#263042] text-xs text-[#94A3B8]">
                      <span>{userDisplayName}</span>
                      <span>{card.currency || "BRL"}</span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="col-span-full p-8 text-center bg-[#141A24] rounded-2xl border border-[#263042] text-xs text-[#94A3B8]">
                Nenhum cartão de crédito registrado no momento.
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "Categorias de Gastos" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-[#F8FAFC]">
            Despesas por Categoria (Mês Atual)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorySummary.length > 0 ? (
              categorySummary.map((cat) => (
                <div
                  key={cat.name}
                  className="bg-[#141A24] border border-[#263042] rounded-2xl p-5 flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-sm text-[#F8FAFC]">
                      {cat.name}
                    </span>
                    <span className="text-xs text-[#94A3B8]">
                      {cat.count} {cat.count === 1 ? "lançamento" : "lançamentos"}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums text-[#EF4444]">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-[#141A24] rounded-2xl border border-[#263042] text-xs text-[#94A3B8]">
                Nenhuma despesa categorizada até o momento.
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Aba: Visão Familiar */
        <section className="flex flex-col gap-6">
          <div className="bg-[#141A24] border border-[#263042] rounded-3xl p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#263042] pb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF6B00]">
                    diversity_3
                  </span>
                  <h2 className="text-lg font-bold text-[#F8FAFC]">
                    Visão Compartilhada / Agregação Familiar
                  </h2>
                </div>
                <p className="text-xs text-[#94A3B8] max-w-2xl leading-relaxed">
                  Por padrão, o Kitsune Finance opera de forma 100% individual. Ative este modo opcional caso queira organizar contas conjuntas ou de dependentes no seu workspace.
                </p>
              </div>

              <button
                onClick={() => setIsFamilyModeEnabled(!isFamilyModeEnabled)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                  isFamilyModeEnabled
                    ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30"
                    : "bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isFamilyModeEnabled ? "check_circle" : "toggle_on"}
                </span>
                {isFamilyModeEnabled
                  ? "Visão Compartilhada Ativa"
                  : "Ativar Visão Compartilhada"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleAddFamilyMember}
                className="p-5 bg-[#0F141C] border border-[#263042] rounded-2xl flex flex-col gap-4"
              >
                <h3 className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF6B00] text-[18px]">
                    person_add
                  </span>
                  Adicionar Membro ao Workspace
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nome do membro (ex: Ana)"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    required
                    className="p-3 bg-[#141A24] border border-[#263042] rounded-xl text-xs text-[#F8FAFC] focus:outline-none focus:border-[#FF6B00]"
                  />
                  <CustomDropdown
                    value={newMemberRole}
                    onChange={(val) => setNewMemberRole(val)}
                    options={[
                      { value: "Titular", label: "Titular" },
                      { value: "Cônjuge", label: "Cônjuge" },
                      { value: "Sócio(a)", label: "Sócio(a)" },
                      { value: "Filho(a)", label: "Filho(a)" },
                      { value: "Dependente", label: "Dependente" },
                    ]}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingMember || !newMemberName.trim()}
                  className="self-start px-5 py-2.5 bg-[#FF6B00] hover:bg-[#FF7D1A] text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingMember ? "Adicionando..." : "Adicionar Membro"}
                </button>
              </form>

              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-[#F8FAFC]">
                  Membros Cadastrados ({familyMembers.length})
                </h3>
                {familyMembers.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {familyMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3.5 bg-[#0F141C] border border-[#263042] rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">person</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-[#F8FAFC]">
                              {m.name}
                            </span>
                            <span className="text-[11px] text-[#94A3B8]">
                              {m.role || "Membro"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteFamilyMember(m.id)}
                          className="text-[#94A3B8] hover:text-[#EF4444] transition-colors p-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#94A3B8]">
                    Nenhum membro adicional cadastrado. Suas contas estão vinculadas diretamente ao seu usuário.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal de Conexão Open Finance */}
      <PluggyConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        familyMembers={familyMembers}
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
