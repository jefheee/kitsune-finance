"use client";

import { useState, useMemo } from "react";
import Spinner from "@/components/Spinner";
import PluggyConnectModal from "@/components/PluggyConnectModal";
import { useFinanceData } from "@/context/FinanceDataContext";

export default function DashboardPage() {
  const {
    user,
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

  const [activeTab, setActiveTab] = useState("Visão geral");
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
    "Visão geral",
    "Transações",
    "Cartões",
    "Categorias",
    "Visão Compartilhada/Familiar",
  ];

  const memberMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    familyMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [familyMembers]);

  // Filtro inteligente: se modo familiar estiver ativo e um membro específico foi escolhido, filtra por ele;
  // caso contrário, exibe todas as contas pertencentes ao user_id autenticado
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
    if (!newMemberName.trim()) return;
    setIsCreatingMember(true);
    try {
      const res = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMemberName.trim(), role: newMemberRole }),
      });
      const data = await res.json();
      if (res.ok && data.member) {
        addFamilyMemberLocal(data.member);
        setNewMemberName("");
      }
    } finally {
      setIsCreatingMember(false);
    }
  };

  const handleDeleteFamilyMember = async (memberId: string) => {
    const res = await fetch(`/api/family-members?id=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      removeFamilyMemberLocal(memberId);
      if (selectedMemberId === memberId) {
        setSelectedMemberId("all");
      }
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
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Investidor";

  const scopeLabel = !isFamilyModeEnabled
    ? `Patrimônio Pessoal • ${userDisplayName}`
    : selectedMemberId === "all"
    ? "Consolidado Compartilhado"
    : selectedMemberId === "personal"
    ? `Individual (${userDisplayName})`
    : memberMap.get(selectedMemberId)?.name || "Membro";

  if (isInitialLoading && accounts.length === 0 && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kitsune"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-6xl mx-auto w-full">
      {/* Header Principal: Foco Individual do Usuário Autenticado */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-kitsune text-2xl">
              account_balance_wallet
            </span>
            <h1 className="text-2xl md:text-3xl font-bold font-sans text-gray-900 dark:text-white tracking-tight">
              Meu Patrimônio
            </h1>
            {isRevalidating && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-kitsune/10 text-kitsune">
                <span className="w-1.5 h-1.5 rounded-full bg-kitsune animate-ping" />
                Atualizando
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-white/50 text-sm font-sans">
            Dashboard patrimonial isolado de{" "}
            <span className="text-gray-800 dark:text-white/80 font-medium">
              {userDisplayName}
            </span>{" "}
            • Leitura instantânea via Supabase RLS.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => revalidate(true)}
            title="Recarregar do banco local"
            className="p-2.5 rounded-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:text-kitsune transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
          </button>

          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-kitsune hover:bg-kitsune/90 text-white rounded-full font-sans text-sm font-bold shadow-md shadow-kitsune/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_link</span>
            <span>Conectar Instituição</span>
          </button>
        </div>
      </header>

      {/* Barra de Filtro Opcional — Aparece somente se o usuário ativou a Visão Compartilhada/Familiar */}
      {isFamilyModeEnabled && (
        <section className="flex flex-col gap-2 bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-kitsune text-[16px]">
                diversity_3
              </span>
              Filtro da Visão Compartilhada / Familiar (Opcional)
            </span>
            <button
              onClick={() => {
                setIsFamilyModeEnabled(false);
                setSelectedMemberId("all");
              }}
              className="text-[11px] font-sans text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
            >
              Voltar ao modo 100% individual
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pt-1 scrollbar-hide">
            <button
              onClick={() => setSelectedMemberId("all")}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full font-sans text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedMemberId === "all"
                  ? "bg-kitsune text-white shadow-sm"
                  : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">groups</span>
              <span>Todas as Contas</span>
            </button>

            {familyMembers.map((member) => {
              const isSelected = selectedMemberId === member.id;
              return (
                <button
                  key={member.id}
                  onClick={() => setSelectedMemberId(member.id)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full font-sans text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-kitsune text-white shadow-sm"
                      : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">person</span>
                  <span>{member.name}</span>
                  <span className="opacity-60 text-[10px]">({member.role || "Membro"})</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Abas de Navegação Rápida */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const isFamilyTab = tab === "Visão Compartilhada/Familiar";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2 rounded-full font-sans text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                  : isFamilyTab
                  ? "bg-kitsune/10 text-kitsune hover:bg-kitsune/20 border border-kitsune/20"
                  : "bg-transparent text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white border border-gray-200 dark:border-white/10"
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

      {activeTab === "Visão geral" ? (
        <>
          {/* Cards de Métricas Patrimoniais */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Patrimônio Líquido
                </span>
                <span className="material-symbols-outlined text-kitsune text-sm">
                  account_balance
                </span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(totalBalance)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">
                Saldo em conta: {formatCurrency(liquidBalance)}
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Receitas (Mês)
                </span>
                <span className="material-symbols-outlined text-green-500 text-sm">
                  trending_up
                </span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-green-500">
                {formatCurrency(monthlyIncome)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">
                Entradas registradas no mês
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Despesas (Mês)
                </span>
                <span className="material-symbols-outlined text-red-500 text-sm">
                  trending_down
                </span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-red-500">
                {formatCurrency(monthlyExpense)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">
                Saídas e pagamentos no mês
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Faturas de Cartões
                </span>
                <span className="material-symbols-outlined text-gray-400 text-sm">
                  credit_card
                </span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(creditCardBalance)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">
                Compromissos de crédito
              </span>
            </div>
          </section>

          {/* Diagnóstico Kitsune AI */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-kitsune">auto_awesome</span>
                Diagnóstico Patrimonial Kitsune AI
              </h2>
              <button
                onClick={generateAiInsight}
                disabled={isGeneratingAi}
                className="flex items-center gap-2 px-4 py-2 bg-kitsune/10 hover:bg-kitsune/20 text-kitsune rounded-full font-sans text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingAi ? (
                  <>
                    <Spinner size={14} className="text-kitsune" />
                    <span>Analisando finanças...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Gerar Diagnóstico IA</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-kitsune/20 dark:border-kitsune/20 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-kitsune"></div>

              {aiError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium border border-red-100 dark:border-red-500/20">
                  {aiError}
                </div>
              )}

              {isGeneratingAi ? (
                <div className="flex flex-col gap-3 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-5/6"></div>
                </div>
              ) : aiInsight ? (
                <div className="flex flex-col gap-4">
                  <p className="text-gray-900 dark:text-white/90 font-sans text-sm leading-relaxed whitespace-pre-line">
                    {aiInsight.text}
                  </p>
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-white/5">
                    <span className="material-symbols-outlined text-[14px] text-gray-400">
                      schedule
                    </span>
                    <span className="text-[11px] text-gray-400 font-sans">
                      Última análise: {new Date(aiInsight.updatedAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 font-sans text-sm">
                  Nenhum diagnóstico gerado ainda. Clique em &ldquo;Gerar Diagnóstico IA&rdquo; para analisar suas contas com o pool Gemini.
                </div>
              )}
            </div>
          </section>

          {/* Contas e Cartões do Usuário */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400">
                  account_balance_wallet
                </span>
                Minhas Contas & Cartões ({filteredAccounts.length})
              </h2>
              <span className="text-xs text-gray-400 font-sans">{scopeLabel}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => {
                  const isCredit =
                    account.type === "CREDIT" || account.type === "CREDIT_CARD";
                  const member =
                    account.family_members || memberMap.get(account.family_member_id);

                  return (
                    <div
                      key={account.id}
                      className="flex flex-col justify-between bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:border-kitsune/30 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/70 rounded-full text-[11px] font-sans font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">
                              {isCredit ? "credit_card" : "verified_user"}
                            </span>
                            {isFamilyModeEnabled && member
                              ? `${member.name} (${member.role || "Membro"})`
                              : isCredit
                              ? "Cartão de Crédito"
                              : "Conta Corrente / Digital"}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500">
                            <span className="material-symbols-outlined text-sm">
                              {isCredit ? "credit_card" : "account_balance"}
                            </span>
                          </div>
                        </div>

                        <h3 className="text-base font-bold font-sans text-gray-900 dark:text-white mb-1">
                          {account.bank_name || account.name || "Instituição"}
                        </h3>
                        <p className="text-xs text-gray-400 font-sans mb-4">
                          {isCredit ? "Fatura Aberta" : "Saldo Disponível"} •{" "}
                          {account.currency || "BRL"}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-baseline justify-between">
                        <span className="text-xs text-gray-400 font-sans">
                          {isCredit ? "Fatura Atual" : "Saldo Atual"}
                        </span>
                        <span
                          className={`text-xl font-bold font-mono tracking-tight ${
                            isCredit ? "text-red-500" : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {isCredit ? "-" : ""}
                          {formatCurrency(Number(account.balance) || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-8 text-center bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-white/20">
                    account_balance
                  </span>
                  <p className="font-sans font-semibold text-gray-700 dark:text-gray-300">
                    Nenhuma instituição bancária conectada ainda.
                  </p>
                  <p className="text-xs text-gray-400 font-sans max-w-sm">
                    Conecte seu banco via Open Finance para visualizar saldos e transações isolados na sua conta.
                  </p>
                  <button
                    onClick={() => setIsConnectModalOpen(true)}
                    className="mt-2 px-4 py-2 bg-kitsune text-white rounded-full text-xs font-bold font-sans hover:bg-kitsune/90 transition-colors cursor-pointer"
                  >
                    Conectar Minha Conta
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Transações Recentes */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400">receipt_long</span>
                Transações Recentes ({filteredTransactions.length})
              </h2>
              <span className="text-xs text-gray-400 font-sans">
                Sincronizadas no banco local
              </span>
            </div>

            <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
              {filteredTransactions.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredTransactions.slice(0, 30).map((txn) => {
                    const isCredit = txn.type === "CREDIT" || Number(txn.amount) > 0;
                    const member =
                      txn.family_members || memberMap.get(txn.family_member_id);
                    const bankName = txn.bank_accounts?.bank_name || "Conta";

                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              isCredit
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                            }`}
                          >
                            <span className="material-symbols-outlined text-base">
                              {isCredit ? "arrow_upward" : "arrow_downward"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-sans font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                              {txn.description}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-gray-400 font-sans mt-0.5 flex-wrap">
                              <span>{formatDate(txn.executed_at || txn.date)}</span>
                              <span>•</span>
                              <span className="text-gray-500 dark:text-white/60">
                                {txn.category || "Outros"}
                              </span>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-medium text-gray-600 dark:text-white/70">
                                {bankName}
                                {isFamilyModeEnabled && member ? ` • ${member.name}` : ""}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`font-mono font-bold text-sm shrink-0 pl-3 ${
                            isCredit ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatCurrency(Math.abs(Number(txn.amount)))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 font-sans text-sm">
                  Nenhuma transação registrada para o filtro atual.
                </div>
              )}
            </div>
          </section>
        </>
      ) : activeTab === "Transações" ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white">
              Histórico Completo de Transações ({filteredTransactions.length})
            </h2>
            <span className="text-xs text-gray-400 font-sans">{scopeLabel}</span>
          </div>

          <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
            {filteredTransactions.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredTransactions.map((txn) => {
                  const isCredit = txn.type === "CREDIT" || Number(txn.amount) > 0;
                  const bankName = txn.bank_accounts?.bank_name || "Instituição";

                  return (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isCredit
                              ? "bg-green-500/10 text-green-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {isCredit ? "arrow_upward" : "arrow_downward"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-sans font-semibold text-sm text-gray-900 dark:text-white">
                            {txn.description}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-gray-400 font-sans mt-0.5">
                            <span>{formatDate(txn.executed_at || txn.date)}</span>
                            <span>•</span>
                            <span>{txn.category || "Outros"}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-medium text-gray-600 dark:text-white/70">
                              {bankName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`font-mono font-bold text-sm shrink-0 pl-3 ${
                          isCredit ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatCurrency(Math.abs(Number(txn.amount)))}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 font-sans text-sm">
                Nenhum lançamento encontrado.
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "Cartões" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white">
            Meus Cartões de Crédito
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD")
              .length > 0 ? (
              filteredAccounts
                .filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD")
                .map((card) => {
                  const member =
                    card.family_members || memberMap.get(card.family_member_id);
                  return (
                    <div
                      key={card.id}
                      className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-[#161616] dark:to-[#0f0f0f] border border-gray-700/30 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between h-48"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-sm tracking-wide text-white/80">
                          {card.bank_name || card.name}
                        </span>
                        <span className="material-symbols-outlined text-kitsune text-xl">
                          contactless
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/50 font-sans">Fatura Atual</span>
                        <span className="text-2xl font-mono font-bold tracking-tight text-white">
                          {formatCurrency(Number(card.balance) || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-white/70 font-sans">
                        <span>{member?.name || userDisplayName}</span>
                        <span>{card.currency || "BRL"}</span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="col-span-full p-8 text-center bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-white/5 text-gray-400 font-sans text-sm">
                Nenhum cartão de crédito encontrado.
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "Categorias" ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white">
              Despesas por Categoria
            </h2>
            <span className="text-xs text-gray-400 font-sans">
              Baseado nas transações sincronizadas
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorySummary.length > 0 ? (
              categorySummary.map((cat) => (
                <div
                  key={cat.name}
                  className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-5 flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-sans font-bold text-sm text-gray-900 dark:text-white">
                      {cat.name}
                    </span>
                    <span className="text-xs text-gray-400 font-sans">
                      {cat.count} {cat.count === 1 ? "lançamento" : "lançamentos"}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-base text-red-500">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-white/5 text-gray-400 font-sans text-sm">
                Nenhuma despesa categorizada até o momento.
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Aba Opcional: Visão Compartilhada / Familiar */
        <section className="flex flex-col gap-6">
          <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-kitsune">
                    diversity_3
                  </span>
                  <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-white">
                    Visão Compartilhada / Agregação Familiar (Opcional)
                  </h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-white/60 font-sans max-w-2xl">
                  Por padrão, o Kitsune Finance opera de forma 100% individual para o seu usuário. Ative este modo opcional caso queira organizar contas conjuntas ou de dependentes no seu workspace.
                </p>
              </div>

              <button
                onClick={() => setIsFamilyModeEnabled(!isFamilyModeEnabled)}
                className={`px-5 py-2.5 rounded-full font-sans text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                  isFamilyModeEnabled
                    ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30"
                    : "bg-kitsune text-white shadow-md shadow-kitsune/20"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isFamilyModeEnabled ? "check_circle" : "toggle_on"}
                </span>
                {isFamilyModeEnabled
                  ? "Visão Compartilhada Ativa (Clique para Desativar)"
                  : "Ativar Visão Compartilhada"}
              </button>
            </div>

            {/* Cadastro e Gestão de Membros do Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleAddFamilyMember}
                className="p-5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col gap-4"
              >
                <h3 className="text-sm font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-kitsune text-[18px]">
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
                    className="p-3 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-sans text-gray-900 dark:text-white focus:outline-none focus:border-kitsune"
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="p-3 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-sans text-gray-900 dark:text-white focus:outline-none focus:border-kitsune"
                  >
                    <option value="Titular">Titular</option>
                    <option value="Cônjuge">Cônjuge</option>
                    <option value="Sócio(a)">Sócio(a)</option>
                    <option value="Filho(a)">Filho(a)</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isCreatingMember || !newMemberName.trim()}
                  className="self-start px-5 py-2.5 bg-kitsune hover:bg-kitsune/90 text-white rounded-xl text-xs font-sans font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingMember ? "Adicionando..." : "Adicionar Membro"}
                </button>
              </form>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold font-sans text-gray-900 dark:text-white">
                  Membros Cadastrados ({familyMembers.length})
                </h3>
                {familyMembers.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {familyMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-kitsune/10 text-kitsune flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">person</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-sans font-semibold text-gray-900 dark:text-white">
                              {m.name}
                            </span>
                            <span className="text-[11px] font-sans text-gray-400">
                              {m.role || "Membro"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteFamilyMember(m.id)}
                          title="Remover membro (contas permanecem salvas na sua conta principal)"
                          className="text-gray-400 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-sans">
                    Nenhum membro adicional cadastrado. Suas contas estão vinculadas diretamente ao seu usuário.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal de Conexão com a Pluggy */}
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
