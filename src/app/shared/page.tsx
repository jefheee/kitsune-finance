"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { BankLogo } from "@/components/BankLogo";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import Spinner from "@/components/Spinner";
import { useFinanceData } from "@/context/FinanceDataContext";

interface MemberData {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  connection_id: string;
  accountsCount: number;
  accounts: any[];
  investments: any[];
  transactions: any[];
}

export default function SharedSpacePage() {
  const { user, userProfile, isPrivacyMode, revalidate } = useFinanceData();

  const [isLoading, setIsLoading] = useState(true);
  const [sharedData, setSharedData] = useState<any>(null);
  const [activeMemberTab, setActiveMemberTab] = useState<string>("consolidated");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Formulário de convite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("Cônjuge / Parceiro(a)");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [lastCreatedInvite, setLastCreatedInvite] = useState<{ email: string; code: string; url: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal de desconexão
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchSharedSpace = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/shared-space");
      const data = await res.json();
      if (res.ok) {
        setSharedData(data);
      } else {
        setFeedbackMessage({ type: "error", text: data.error || "Erro ao carregar Espaço Compartilhado." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Erro de conexão." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSharedSpace();
  }, [fetchSharedSpace]);

  const formatCurrency = useCallback(
    (value: number) => {
      if (isPrivacyMode) return "R$ ••••••";
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    },
    [isPrivacyMode]
  );

  const myDisplayName =
    userProfile?.display_name ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Você";

  const myAccounts = useMemo(() => sharedData?.userAccounts || [], [sharedData]);
  const myInvestments = useMemo(() => sharedData?.userInvestments || [], [sharedData]);
  const myTransactions = useMemo(() => sharedData?.userTransactions || [], [sharedData]);
  const activePartners: MemberData[] = useMemo(() => sharedData?.activePartners || [], [sharedData]);

  // Lista de membros para as abas
  const memberTabs = useMemo(() => {
    const list: { id: string; name: string; isSelf?: boolean }[] = [
      { id: "consolidated", name: "Visão Consolidada" },
      { id: user?.id || "me", name: `${myDisplayName} (Você)`, isSelf: true },
    ];
    activePartners.forEach((p) => {
      const name = p.display_name || p.full_name || "Parceiro";
      list.push({ id: p.id, name: `${name} (${p.role || "Membro"})` });
    });
    return list;
  }, [activePartners, myDisplayName, user?.id]);

  // Totais consolidados
  const totals = useMemo(() => {
    let allAccounts = [...myAccounts];
    let allInvestments = [...myInvestments];
    let allTransactions = [...myTransactions];

    activePartners.forEach((p) => {
      if (p.accounts) allAccounts.push(...p.accounts);
      if (p.investments) allInvestments.push(...p.investments);
      if (p.transactions) allTransactions.push(...p.transactions);
    });

    let liquid = 0;
    let credit = 0;
    allAccounts.forEach((acc) => {
      const b = Number(acc.balance) || 0;
      if (acc.type === "CREDIT" || acc.type === "CREDIT_CARD" || acc.subtype === "CREDIT_CARD") {
        credit += Math.abs(b);
      } else {
        liquid += b;
      }
    });

    const inv = allInvestments.reduce((sum, i) => sum + (Number(i.balance) || 0), 0);
    const net = liquid + inv - credit;

    // Métricas por membro para gráfico de distribuição
    const myLiquid = myAccounts.reduce((s: number, a: any) => {
      const isCard = a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
      return isCard ? s : s + (Number(a.balance) || 0);
    }, 0);
    const myInv = myInvestments.reduce((s: number, i: any) => s + (Number(i.balance) || 0), 0);
    const myNet = myLiquid + myInv;

    const partnerStats = activePartners.map((p) => {
      const pLiquid = (p.accounts || []).reduce((s: number, a: any) => {
        const isCard = a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
        return isCard ? s : s + (Number(a.balance) || 0);
      }, 0);
      const pInv = (p.investments || []).reduce((s: number, i: any) => s + (Number(i.balance) || 0), 0);
      return {
        id: p.id,
        name: p.display_name || p.full_name || "Parceiro",
        role: p.role,
        liquid: pLiquid,
        investments: pInv,
        net: pLiquid + pInv,
      };
    });

    return {
      net,
      liquid,
      investments: inv,
      creditCards: credit,
      allAccounts,
      allTransactions,
      myNet,
      partnerStats,
    };
  }, [myAccounts, myInvestments, myTransactions, activePartners]);

  // Transações ou dados do membro selecionado
  const selectedMemberData = useMemo(() => {
    if (activeMemberTab === "consolidated") return null;
    if (activeMemberTab === (user?.id || "me")) {
      return {
        id: user?.id,
        name: `${myDisplayName} (Você)`,
        role: "Titular Principal",
        accounts: myAccounts,
        investments: myInvestments,
        transactions: myTransactions,
      };
    }
    const partner = activePartners.find((p) => p.id === activeMemberTab);
    if (partner) {
      return {
        id: partner.id,
        name: partner.display_name || partner.full_name || "Parceiro",
        role: partner.role || "Membro",
        accounts: partner.accounts || [],
        investments: partner.investments || [],
        transactions: partner.transactions || [],
      };
    }
    return null;
  }, [activeMemberTab, user?.id, myDisplayName, myAccounts, myInvestments, myTransactions, activePartners]);

  // Enviar convite por email
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setActionLoading(true);
      setFeedbackMessage(null);
      const res = await fetch("/api/shared-space", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedbackMessage({ type: "error", text: data.error || "Erro ao enviar convite." });
        return;
      }

      setLastCreatedInvite({
        email: inviteEmail.trim(),
        code: data.inviteCode || data.invite_code,
        url: data.inviteUrl || `${window.location.origin}/shared?code=${data.inviteCode}`,
      });
      setInviteEmail("");
      setInviteName("");
      setFeedbackMessage({
        type: "success",
        text: `Convite enviado com sucesso para ${inviteEmail}! Código: ${data.inviteCode || data.invite_code}`,
      });
      fetchSharedSpace();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Erro ao conectar." });
    } finally {
      setActionLoading(false);
    }
  };

  // Aceitar convite por código
  const handleAcceptByCode = async () => {
    if (!inviteCodeInput.trim()) return;

    try {
      setActionLoading(true);
      setFeedbackMessage(null);
      const res = await fetch("/api/shared-space", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCodeInput.trim().toUpperCase(), action: "accept" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedbackMessage({ type: "error", text: data.error || "Código de convite inválido." });
        return;
      }

      setFeedbackMessage({ type: "success", text: "Espaço Compartilhado ativado com sucesso! Contas vinculadas." });
      setInviteCodeInput("");
      fetchSharedSpace();
      revalidate(true);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Erro ao validar código." });
    } finally {
      setActionLoading(false);
    }
  };

  // Sair do Espaço Compartilhado / Desconectar
  const handleDisconnect = async (connectionId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/shared-space?id=${connectionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackMessage({ type: "error", text: data.error || "Erro ao desconectar." });
        return;
      }

      setDisconnectTarget(null);
      setFeedbackMessage({
        type: "success",
        text: "Conexão desfeita com sucesso. Seus dados foram isolados e nada permaneceu visível para a outra conta.",
      });
      fetchSharedSpace();
      revalidate(true);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Erro ao desconectar." });
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col gap-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#27272A]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">diversity_3</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Espaço Compartilhado
              </h1>
              {activePartners.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{activePartners.length} Membro(s) Ativo(s)</span>
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8] max-w-2xl">
              Consolidação transparente de patrimônio com proteção Row Level Security (RLS). Os dados permanecem isolados nas páginas pessoais e são unificados exclusivamente aqui.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSharedSpace}
              disabled={isLoading}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-[#18181B] text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? "animate-spin" : ""}`}>
                refresh
              </span>
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Mensagens de Feedback */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-2 border animate-in fade-in ${
              feedbackMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                {feedbackMessage.type === "success" ? "check_circle" : "error"}
              </span>
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="p-1 hover:opacity-70 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Pré-requisito: Sem contas conectadas */}
        {sharedData && !sharedData.canInvite && (
          <div className="p-4 md:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">
                account_balance
              </span>
              <div>
                <h3 className="text-sm font-bold text-amber-500">Conecte uma conta bancária primeiro</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Para participar ou convidar membros para o Espaço Compartilhado, você precisa ter pelo menos 1 banco sincronizado via Open Finance.
                </p>
              </div>
            </div>
            <Link
              href="/connections"
              className="px-4 py-2 rounded-xl bg-[#FF8216] text-white font-bold text-xs hover:bg-[#FFA047] transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              <span>Conectar Banco</span>
            </Link>
          </div>
        )}

        {/* 4 Cards de Métricas Consolidadas do Espaço */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Patrimônio Compartilhado
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">account_balance</span>
              </div>
            </div>
            <div>
              <span className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight block">
                {formatCurrency(totals.net)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                Líquido + Investimentos - Faturas
              </span>
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Saldo em Contas
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">payments</span>
              </div>
            </div>
            <div>
              <span className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight block">
                {formatCurrency(totals.liquid)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                Disponível para movimentação conjunta
              </span>
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Investimentos Totais
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
              </div>
            </div>
            <div>
              <span className="text-lg md:text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums tracking-tight block">
                {formatCurrency(totals.investments)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                Renda Fixa, Fundos e Ações somados
              </span>
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Faturas em Aberto
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">credit_card</span>
              </div>
            </div>
            <div>
              <span className="text-lg md:text-2xl font-black text-purple-500 tabular-nums tracking-tight block">
                {formatCurrency(totals.creditCards)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                Gastos comprometidos nos cartões
              </span>
            </div>
          </SpotlightCard>
        </section>

        {/* Seletor de Integrantes (Abas) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-[#27272A]">
          {memberTabs.map((tab) => {
            const isActive = activeMemberTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMemberTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-[#FF8216] text-white shadow-xs"
                    : "bg-white dark:bg-[#121214] text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#27272A]"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {tab.id === "consolidated" ? "hub" : "person"}
                </span>
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo da Aba Ativa */}
        {activeMemberTab === "consolidated" ? (
          /* Visão Consolidada */
          <div className="flex flex-col gap-6">
            {/* Barra de Distribuição de Patrimônio */}
            {totals.net > 0 && activePartners.length > 0 && (
              <SpotlightCard className="p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216] text-lg">pie_chart</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Distribuição do Patrimônio Compartilhado
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">100% Auditado</span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-[#18181B] overflow-hidden flex">
                  {/* Minha parcela */}
                  {(() => {
                    const myPercent = Math.max(0, Math.min(100, Math.round((totals.myNet / (totals.net || 1)) * 100)));
                    return (
                      <div
                        className="h-full bg-[#FF8216] transition-all duration-500"
                        style={{ width: `${myPercent}%` }}
                        title={`${myDisplayName}: ${myPercent}%`}
                      />
                    );
                  })()}
                  {/* Parcelas dos parceiros */}
                  {totals.partnerStats.map((p, idx) => {
                    const pPercent = Math.max(0, Math.min(100, Math.round((p.net / (totals.net || 1)) * 100)));
                    const colors = ["bg-emerald-500", "bg-purple-500", "bg-blue-500"];
                    return (
                      <div
                        key={p.id}
                        className={`h-full ${colors[idx % colors.length]} transition-all duration-500`}
                        style={{ width: `${pPercent}%` }}
                        title={`${p.name}: ${pPercent}%`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF8216]" />
                    <span className="font-bold text-slate-900 dark:text-white">{myDisplayName} (Você):</span>
                    <span className="text-slate-400 font-mono">
                      {Math.max(0, Math.min(100, Math.round((totals.myNet / (totals.net || 1)) * 100)))}% ({formatCurrency(totals.myNet)})
                    </span>
                  </div>

                  {totals.partnerStats.map((p, idx) => {
                    const pPercent = Math.max(0, Math.min(100, Math.round((p.net / (totals.net || 1)) * 100)));
                    const colors = ["bg-emerald-500", "bg-purple-500", "bg-blue-500"];
                    return (
                      <div key={p.id} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`} />
                        <span className="font-bold text-slate-900 dark:text-white">{p.name}:</span>
                        <span className="text-slate-400 font-mono">
                          {pPercent}% ({formatCurrency(p.net)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SpotlightCard>
            )}

            {/* Grid 2 Colunas: Contas de Todos os Membros & Movimentações Recentes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Contas Bancárias Consolidadas (6 cols) */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216] text-lg">account_balance_wallet</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Contas Conectadas no Espaço ({totals.allAccounts.length})
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {totals.allAccounts.map((account) => {
                    const isCredit = account.type === "CREDIT" || account.type === "CREDIT_CARD" || account.subtype === "CREDIT_CARD";
                    const isMine = account.user_id === user?.id;
                    const ownerName = isMine
                      ? `${myDisplayName} (Você)`
                      : activePartners.find((p) => p.id === account.user_id)?.display_name || "Membro";

                    return (
                      <div
                        key={account.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <BankLogo bank={account.institution_slug || account.bank_name} size="sm" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {account.product_name || account.bank_name || "Conta Bancária"}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isMine ? "bg-[#FF8216]/10 text-[#FF8216]" : "bg-emerald-500/10 text-emerald-500"}`}>
                                {ownerName}
                              </span>
                              <span>{account.institution_name || account.bank_name}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 pl-2">
                          <span
                            className={`text-xs md:text-sm font-extrabold tabular-nums ${
                              isCredit ? "text-[#FF8216]" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {formatCurrency(Math.abs(Number(account.balance) || 0))}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isCredit ? "Fatura atual" : "Saldo livre"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Movimentações Recentes Consolidadas (6 cols) */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216] text-lg">receipt_long</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Extrato Consolidado Recente
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {totals.allTransactions.slice(0, 10).map((t) => {
                    const isExpense = Number(t.amount) < 0 || t.type === "DEBIT";
                    const isMine = t.user_id === user?.id;
                    const ownerName = isMine
                      ? "Você"
                      : activePartners.find((p) => p.id === t.user_id)?.display_name || "Membro";

                    return (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BankLogo bank={t.bank_accounts?.institution_slug || t.bank_accounts?.bank_name} size="sm" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {t.clean_description || t.description}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isMine ? "bg-[#FF8216]/10 text-[#FF8216]" : "bg-emerald-500/10 text-emerald-500"}`}>
                                {ownerName}
                              </span>
                              <span>{t.date || t.executed_at}</span>
                              {t.category_pt && <span>• {t.category_pt}</span>}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-black tabular-nums shrink-0 ${
                            isExpense ? "text-slate-900 dark:text-white" : "text-emerald-500 font-bold"
                          }`}
                        >
                          {isExpense ? "-" : "+"} {formatCurrency(Math.abs(Number(t.amount) || 0))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : selectedMemberData ? (
          /* Visão Individual do Integrante */
          <div className="flex flex-col gap-6">
            <SpotlightCard className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF8216]/10 text-[#FF8216] font-black text-lg flex items-center justify-center border border-[#FF8216]/20">
                  {selectedMemberData.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {selectedMemberData.name}
                  </h2>
                  <span className="text-xs text-slate-400 block">
                    {selectedMemberData.role} • {selectedMemberData.accounts.length} contas bancárias vinculadas
                  </span>
                </div>
              </div>
            </SpotlightCard>

            {/* Contas do Integrante */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FF8216] text-lg">account_balance</span>
                <span>Contas e Cartões de {selectedMemberData.name}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedMemberData.accounts.map((acc: any) => {
                  const isCredit = acc.type === "CREDIT" || acc.type === "CREDIT_CARD" || acc.subtype === "CREDIT_CARD";
                  return (
                    <div
                      key={acc.id}
                      className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <BankLogo bank={acc.institution_slug || acc.bank_name} size="sm" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {acc.product_name || acc.bank_name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {acc.institution_name || acc.bank_name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                        <span className="text-[11px] text-slate-400">
                          {isCredit ? "Fatura Atual" : "Saldo Livre"}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(Math.abs(Number(acc.balance) || 0))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Extrato do Integrante */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FF8216] text-lg">receipt_long</span>
                <span>Últimas Movimentações de {selectedMemberData.name}</span>
              </h3>

              <div className="flex flex-col gap-2">
                {selectedMemberData.transactions.slice(0, 15).map((tx: any) => {
                  const isExpense = Number(tx.amount) < 0 || tx.type === "DEBIT";
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BankLogo bank={tx.bank_accounts?.institution_slug || tx.bank_accounts?.bank_name} size="sm" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {tx.clean_description || tx.description}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {tx.date || tx.executed_at} {tx.category_pt ? `• ${tx.category_pt}` : ""}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-black tabular-nums ${
                          isExpense ? "text-slate-900 dark:text-white" : "text-emerald-500 font-bold"
                        }`}
                      >
                        {isExpense ? "-" : "+"} {formatCurrency(Math.abs(Number(tx.amount) || 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Seção de Administração e Governança do Espaço Compartilhado */}
        <section className="mt-8 pt-8 border-t border-slate-200 dark:border-[#27272A] flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF8216]">admin_panel_settings</span>
              <span>Administração & Integrantes do Espaço</span>
            </h2>
            <p className="text-xs text-slate-400">
              Gerencie quem tem acesso, envie novos convites e revogue conexões a qualquer momento com isolamento total imediato.
            </p>
          </div>

          {/* Lista de Membros Ativos Conectados com Opção de Desconectar */}
          {activePartners.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col gap-3">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                Membros Conectados Atualmente
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePartners.map((partner) => (
                  <div
                    key={partner.connection_id}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FF8216]/10 text-[#FF8216] font-bold text-sm flex items-center justify-center shrink-0">
                        {(partner.display_name || partner.full_name || "MB").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {partner.display_name || partner.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {partner.role || "Membro"} • {partner.accountsCount} conta(s) sincronizada(s)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDisconnectTarget({
                          id: partner.connection_id,
                          name: partner.display_name || partner.full_name || "Membro",
                        })
                      }
                      className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">link_off</span>
                      <span>Sair / Desconectar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulários de Convite: 1. Por E-mail | 2. Por Código KT-XXXX */}
          {sharedData?.canInvite && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Form 1: Convidar por E-mail */}
              <form
                onSubmit={handleInvite}
                className="lg:col-span-6 p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216] text-[18px]">send</span>
                    <span>Convidar Novo Membro por E-mail</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    O convite gera um código exclusivo KT-XXXX e notifica o usuário caso ele já tenha cadastro.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    placeholder="E-mail do integrante cadastrado"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FF8216]"
                  />
                  <input
                    type="text"
                    placeholder="Nome do integrante (opcional)"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FF8216]"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF8216]"
                  >
                    <option value="Cônjuge / Parceiro(a)">Cônjuge / Parceiro(a)</option>
                    <option value="Familiar / Parente">Familiar / Parente</option>
                    <option value="Filho(a) / Dependente">Filho(a) / Dependente</option>
                    <option value="Sócio(a) / Duo Profissional">Sócio(a) / Duo Profissional</option>
                    <option value="Parceiro Financeiro">Parceiro Financeiro / Investidor</option>
                    <option value="Amigo(a)">Amigo(a) / Divisão de Contas</option>
                    <option value="Workspace">Workspace / Finanças da Equipe</option>
                    <option value="Personalizado">Personalizado</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? <Spinner size={14} className="text-white" /> : <span className="material-symbols-outlined text-[16px]">mail</span>}
                  <span>Enviar Convite Seguro</span>
                </button>

                {/* Card de Convite Gerado com Botões de WhatsApp e Gmail */}
                {lastCreatedInvite && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Convite Criado com Sucesso</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLastCreatedInvite(null)}
                        className="text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/10">
                      <code className="text-xs font-mono font-bold text-[#FF8216] flex-1">
                        {lastCreatedInvite.code}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(lastCreatedInvite.code, "last_code")}
                        className="px-2.5 py-1 rounded bg-[#FF8216] text-white text-[10px] font-bold hover:bg-[#FFA047] cursor-pointer"
                      >
                        {copiedKey === "last_code" ? "Copiado!" : "Copiar Código"}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Olá! Estou te convidando para conectar seu patrimônio no Kitsune Finance no nosso Espaço Compartilhado. Acesse o link para aceitar: ${lastCreatedInvite.url} (Código: ${lastCreatedInvite.code})`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">chat</span>
                        <span>Enviar via WhatsApp</span>
                      </a>
                      <a
                        href={`mailto:${lastCreatedInvite.email}?subject=${encodeURIComponent("Convite para Espaço Compartilhado - Kitsune Finance")}&body=${encodeURIComponent(`Olá!\n\nVocê recebeu um convite para conectar seu patrimônio ao Espaço Compartilhado no Kitsune Finance com conciliação mútua.\n\nAcesse o link direto:\n${lastCreatedInvite.url}\n\nOu utilize o código de convite: ${lastCreatedInvite.code}\n\nAté logo,\nKitsune Finance`)}`}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">mail</span>
                        <span>Enviar via Gmail</span>
                      </a>
                    </div>
                  </div>
                )}
              </form>

              {/* Form 2: Validar Código KT-XXXX */}
              <div className="lg:col-span-6 p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col justify-between gap-4 shadow-xs">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216] text-[18px]">key</span>
                    <span>Possui um Código de Convite?</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Se outro usuário compartilhou um código KT-XXXX com você, insira abaixo para ativar o vínculo compartilhado.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="KT-XXXX (ex: KT-A1B2C3)"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAcceptByCode}
                  disabled={actionLoading || !inviteCodeInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? <Spinner size={14} className="text-white" /> : <span className="material-symbols-outlined text-[16px]">link</span>}
                  <span>Validar e Vincular Contas</span>
                </button>
              </div>
            </div>
          )}

          {/* Convites Pendentes Enviados */}
          {sharedData?.connections?.some((c: any) => c.status === "pending" && c.requester_id === user?.id) && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Convites Pendentes Enviados por Você
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sharedData.connections
                  .filter((c: any) => c.status === "pending" && c.requester_id === user?.id)
                  .map((sent: any) => (
                    <div
                      key={sent.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col gap-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[#FF8216] text-base">schedule</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                              {sent.recipient_name || sent.recipient_email}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {sent.role} • Código: {sent.invite_code}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDisconnect(sent.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                          title="Cancelar convite"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sent.invite_code, `code_${sent.id}`)}
                          className="flex-1 py-1.5 rounded-lg bg-slate-50 dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#202024] border border-slate-200 dark:border-[#27272A] text-[11px] font-semibold text-slate-700 dark:text-zinc-200 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">content_copy</span>
                          <span>{copiedKey === `code_${sent.id}` ? "Copiado!" : "Copiar Código"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Modal de Confirmação de Desconexão / Sair do Espaço */}
        {disconnectTarget && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">warning</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Sair do Espaço Compartilhado?
                  </h3>
                  <span className="text-xs text-slate-400">
                    Desconectar de {disconnectTarget.name}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-[#94A3B8] leading-relaxed">
                Ao desconectar, seus dados financeiros serão <strong>imediatamente isolados</strong> via Row Level Security (RLS). Nenhuma conta, cartão ou transação sua continuará visível para {disconnectTarget.name}, e você deixará de ver os dados dele(a).
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisconnectTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#27272A] text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-[#18181B] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDisconnect(disconnectTarget.id)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Spinner size={12} className="text-white" /> : null}
                  <span>Confirmar e Sair</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
