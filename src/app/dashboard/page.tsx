"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Spinner from "@/components/Spinner";
import PluggyConnectModal, { FamilyMember } from "@/components/PluggyConnectModal";

export default function DashboardPage() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Visão geral");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // AI Insights State
  const [aiInsight, setAiInsight] = useState<{ text: string; updatedAt: string } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const TABS = ["Visão geral", "Transações", "Cartões", "Parcelamento", "Assinaturas", "Categorias"];

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Carregar membros da família
    const { data: membersData } = await supabase
      .from("family_members")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (membersData && membersData.length > 0) {
      setFamilyMembers(membersData);
    } else {
      // Cria membro inicial caso ainda não exista
      const { data: createdMember } = await supabase
        .from("family_members")
        .insert({
          user_id: user.id,
          name: user.user_metadata?.full_name || "Titular",
          role: "Titular",
        })
        .select("*")
        .single();

      if (createdMember) {
        setFamilyMembers([createdMember]);
      }
    }

    // 2. Carregar contas bancárias relacionais
    const { data: bankAccData } = await supabase
      .from("bank_accounts")
      .select("*, family_members(id, name, role)")
      .eq("user_id", user.id);

    // Suporte caso ainda existam dados na tabela legado accounts
    let finalAccounts = bankAccData || [];
    if (finalAccounts.length === 0) {
      const { data: legacyAcc } = await supabase
        .from("accounts")
        .select("*, pluggy_connections(provider_name)")
        .eq("user_id", user.id);
      if (legacyAcc) {
        finalAccounts = legacyAcc.map((a) => ({
          ...a,
          bank_name: a.name,
          type: a.type || "BANK",
        }));
      }
    }
    setAccounts(finalAccounts);

    // 3. Carregar investimentos
    const { data: invData } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", user.id);
    if (invData) setInvestments(invData);

    // 4. Carregar transações
    const { data: txnData } = await supabase
      .from("transactions")
      .select("*, bank_accounts(bank_name, type), family_members(id, name, role)")
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false })
      .limit(100);

    if (txnData) setTransactions(txnData);

    // 5. Carregar Insights da IA
    const { data: insightData } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (insightData) {
      setAiInsight({
        text: insightData.last_analysis_text,
        updatedAt: insightData.updated_at,
      });
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtro por Membro Familiar selecionado
  const filteredAccounts =
    selectedMemberId === "all"
      ? accounts
      : accounts.filter((a) => a.family_member_id === selectedMemberId);

  const filteredTransactions =
    selectedMemberId === "all"
      ? transactions
      : transactions.filter((t) => t.family_member_id === selectedMemberId);

  // Mapeamento de nome de membro para badges rápidas
  const memberMap = new Map<string, FamilyMember>();
  familyMembers.forEach((m) => memberMap.set(m.id, m));

  // Matemática Financeira
  const totalBalance = filteredAccounts.reduce((acc, curr) => {
    const bal = Number(curr.balance) || 0;
    if (curr.type === "CREDIT" || curr.type === "CREDIT_CARD") {
      return acc - bal;
    }
    return acc + bal;
  }, 0);

  const creditCardBalance = filteredAccounts.reduce((acc, curr) => {
    if (curr.type === "CREDIT" || curr.type === "CREDIT_CARD") {
      return acc + (Number(curr.balance) || 0);
    }
    return acc;
  }, 0);

  // Fluxo Mensal Corrente
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let monthlyIncome = 0;
  let monthlyExpense = 0;

  filteredTransactions.forEach((txn) => {
    const rawDate = txn.executed_at || txn.date;
    if (!rawDate) return;
    const txnDate = new Date(rawDate);

    if (txnDate >= currentMonthStart) {
      const amount = Number(txn.amount) || 0;
      if (txn.type === "CREDIT" || amount > 0) {
        monthlyIncome += Math.abs(amount);
      } else {
        monthlyExpense += Math.abs(amount);
      }
    }
  });

  const generateAiInsight = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/generate-insight", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao gerar análise");
      if (data.success && data.data) {
        setAiInsight({
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
      // Fallback para strings yyyy-mm-dd
      const parts = dateString.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateString;
    }
    return d.toLocaleDateString("pt-BR");
  };

  const selectedMemberName =
    selectedMemberId === "all"
      ? "Consolidado Familiar"
      : memberMap.get(selectedMemberId)?.name || "Membro";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kitsune"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-6xl mx-auto w-full">
      {/* Header Principal */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-kitsune text-2xl">family_restroom</span>
            <h1 className="text-2xl md:text-3xl font-bold font-sans text-gray-900 dark:text-white tracking-tight">
              Agregação Familiar
            </h1>
          </div>
          <p className="text-gray-500 dark:text-white/50 text-sm font-sans">
            Visão patrimonial multi-membro consolidada em tempo real via Open Finance (Meu Pluggy).
          </p>
        </div>

        {/* Botão de Conectar Instituição */}
        <button
          onClick={() => setIsConnectModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-kitsune hover:bg-kitsune/90 text-white rounded-full font-sans text-sm font-bold shadow-md shadow-kitsune/20 transition-all cursor-pointer self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_link</span>
          <span>Conectar Instituição</span>
        </button>
      </header>

      {/* Barra de Filtro de Membros Familiares */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-sans font-bold text-gray-400 dark:text-white/40 uppercase tracking-wider">
          Filtrar por Membro da Família
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
          <button
            onClick={() => setSelectedMemberId("all")}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-sans text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedMemberId === "all"
                ? "bg-kitsune text-white shadow-sm"
                : "bg-white dark:bg-[#121212] text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">groups</span>
            <span>Toda a Família (Consolidado)</span>
          </button>

          {familyMembers.map((member) => {
            const isSelected = selectedMemberId === member.id;
            return (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-full font-sans text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-kitsune text-white shadow-sm"
                    : "bg-white dark:bg-[#121212] text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span>{member.name}</span>
                <span className="opacity-60 text-[10px]">({member.role || "Membro"})</span>
              </button>
            );
          })}

          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="whitespace-nowrap px-3 py-2 rounded-full font-sans text-xs font-semibold text-kitsune bg-kitsune/10 hover:bg-kitsune/20 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span>+ Novo</span>
          </button>
        </div>
      </section>

      {/* Tabs Secundárias */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2 rounded-full font-sans text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                  : "bg-transparent text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white border border-gray-200 dark:border-white/10"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === "Visão geral" ? (
        <>
          {/* Métricas Consolidadas / do Membro */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Patrimônio Líquido
                </span>
                <span className="material-symbols-outlined text-kitsune text-sm">account_balance</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(totalBalance)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">{selectedMemberName}</span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Receitas (Mês)
                </span>
                <span className="material-symbols-outlined text-green-500 text-sm">trending_up</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-green-500">
                {formatCurrency(monthlyIncome)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">Entradas registradas</span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Despesas (Mês)
                </span>
                <span className="material-symbols-outlined text-red-500 text-sm">trending_down</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-red-500">
                {formatCurrency(monthlyExpense)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">Saídas e pagamentos</span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">
                  Faturas de Cartões
                </span>
                <span className="material-symbols-outlined text-gray-400 text-sm">credit_card</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(creditCardBalance)}
              </span>
              <span className="text-[11px] text-gray-400 font-sans">Compromissos pendentes</span>
            </div>
          </section>

          {/* Kitsune AI Insight */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-kitsune">auto_awesome</span>
                Kitsune Family Intelligence
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
                    <span>Analisar Patrimônio</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-kitsune/20 dark:border-kitsune/20 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-kitsune"></div>

              {aiError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100">
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
                    <span className="material-symbols-outlined text-[14px] text-gray-400">schedule</span>
                    <span className="text-[11px] text-gray-400 font-sans">
                      Última análise: {new Date(aiInsight.updatedAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 font-sans text-sm">
                  Nenhuma análise consolidada gerada ainda. Clique no botão acima para iniciar a avaliação da IA.
                </div>
              )}
            </div>
          </section>

          {/* Contas e Cartões Agrupados por Familiar */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400">account_balance_wallet</span>
                Contas & Cartões Bancários ({filteredAccounts.length})
              </h2>
              <span className="text-xs text-gray-400 font-sans">
                {selectedMemberName}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => {
                  const isCredit =
                    account.type === "CREDIT" || account.type === "CREDIT_CARD";
                  const member =
                    account.family_members || memberMap.get(account.family_member_id);
                  const memberName = member?.name || "Titular";
                  const memberRole = member?.role || "Membro";

                  return (
                    <div
                      key={account.id}
                      className="flex flex-col justify-between bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:border-kitsune/30 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/70 rounded-full text-[11px] font-sans font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">person</span>
                            {memberName} ({memberRole})
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
                          {isCredit ? "Cartão de Crédito" : "Conta Bancária"} • {account.currency || "BRL"}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-baseline justify-between">
                        <span className="text-xs text-gray-400 font-sans">Saldo Atual</span>
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
                    Nenhuma conta conectada para {selectedMemberName}.
                  </p>
                  <p className="text-xs text-gray-400 font-sans max-w-sm">
                    Utilize o botão abaixo para conectar bancos e cartões de qualquer membro da sua família.
                  </p>
                  <button
                    onClick={() => setIsConnectModalOpen(true)}
                    className="mt-2 px-4 py-2 bg-kitsune text-white rounded-full text-xs font-bold font-sans hover:bg-kitsune/90 transition-colors cursor-pointer"
                  >
                    Conectar Conta Agora
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Lançamentos e Transações Recentes */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400">receipt_long</span>
                Transações Recentes ({filteredTransactions.length})
              </h2>
              <span className="text-xs text-gray-400 font-sans">
                Idempotência e categorização ativas
              </span>
            </div>

            <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
              {filteredTransactions.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredTransactions.slice(0, 30).map((txn) => {
                    const isCredit = txn.type === "CREDIT" || Number(txn.amount) > 0;
                    const member =
                      txn.family_members || memberMap.get(txn.family_member_id);
                    const memberName = member?.name || "Titular";
                    const bankName =
                      txn.bank_accounts?.bank_name || "Instituição";

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
                            <div className="flex items-center gap-2 text-xs text-gray-400 font-sans mt-0.5">
                              <span>{formatDate(txn.executed_at || txn.date)}</span>
                              <span>•</span>
                              <span className="text-gray-500 dark:text-white/60">
                                {txn.category || "Outros"}
                              </span>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-medium text-gray-600 dark:text-white/70">
                                {memberName} ({bankName})
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
                  Nenhuma transação encontrada para {selectedMemberName}.
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
            <span className="text-xs text-gray-400 font-sans">{selectedMemberName}</span>
          </div>

          <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
            {filteredTransactions.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredTransactions.map((txn) => {
                  const isCredit = txn.type === "CREDIT" || Number(txn.amount) > 0;
                  const member =
                    txn.family_members || memberMap.get(txn.family_member_id);
                  const memberName = member?.name || "Titular";
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
                              {memberName} ({bankName})
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
            Cartões de Crédito da Família
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD").length > 0 ? (
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
                        <span className="material-symbols-outlined text-kitsune text-xl">contactless</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/50 font-sans">Fatura Atual</span>
                        <span className="text-2xl font-mono font-bold tracking-tight text-white">
                          {formatCurrency(Number(card.balance) || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-white/70 font-sans">
                        <span>{member?.name || "Titular"}</span>
                        <span>{card.currency || "BRL"}</span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="col-span-full p-8 text-center bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-white/5 text-gray-400 font-sans text-sm">
                Nenhum cartão de crédito cadastrado para {selectedMemberName}.
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-white/20 mb-4">
            construction
          </span>
          <h3 className="text-xl font-bold font-sans text-gray-900 dark:text-white">
            Aba em Construção
          </h3>
          <p className="text-gray-500 dark:text-white/50 font-sans mt-2">
            Esta funcionalidade estará disponível em breve.
          </p>
        </div>
      )}

      {/* Modal de Conexão com a Pluggy */}
      <PluggyConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        familyMembers={familyMembers}
        onMemberCreated={(newMember) => {
          setFamilyMembers((prev) => [...prev, newMember]);
          setSelectedMemberId(newMember.id);
        }}
        onConnectionSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
