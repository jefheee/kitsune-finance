"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
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
  const [activeFeatureTab, setActiveFeatureTab] = useState<
    "overview" | "flow" | "bills" | "investments" | "simulator" | "split" | "members"
  >("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Simulador de metas
  const [simMonthlyDeposit, setSimMonthlyDeposit] = useState<number>(1500);
  const [simYears, setSimYears] = useState<number>(3);
  const [simAnnualRate, setSimAnnualRate] = useState<number>(10.65);

  // Divisão justa
  const [splitMode, setSplitMode] = useState<"50-50" | "proportional">("proportional");

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

  // Lista de membros para abas
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

    // Filtra investimentos ativos (> 0 e sem total withdrawal)
    const activeInvs = allInvestments.filter((i) => {
      const bal = Number(i.balance) || 0;
      return bal > 0.05 && i.status !== "TOTAL_WITHDRAWAL";
    });

    const inv = activeInvs.reduce((sum, i) => sum + (Number(i.balance) || 0), 0);
    const net = liquid + inv - credit;

    // Métricas por membro
    const myLiquid = myAccounts.reduce((s: number, a: any) => {
      const isCard = a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
      return isCard ? s : s + (Number(a.balance) || 0);
    }, 0);
    const myActiveInvs = myInvestments.filter((i: any) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL");
    const myInv = myActiveInvs.reduce((s: number, i: any) => s + (Number(i.balance) || 0), 0);
    const myCredit = myAccounts.reduce((s: number, a: any) => {
      const isCard = a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
      return isCard ? s + Math.abs(Number(a.balance) || 0) : s;
    }, 0);
    const myNet = myLiquid + myInv - myCredit;

    const partnerStats = activePartners.map((p) => {
      const pLiquid = (p.accounts || []).reduce((s: number, a: any) => {
        const isCard = a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
        return isCard ? s : s + (Number(a.balance) || 0);
      }, 0);
      const pActiveInvs = (p.investments || []).filter(
        (i) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL"
      );
      const pInv = pActiveInvs.reduce((s: number, i: any) => s + (Number(i.balance) || 0), 0);
      const pCredit = (p.accounts || []).reduce((s: number, a: any) => {
        const isCard = a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD";
        return isCard ? s + Math.abs(Number(a.balance) || 0) : s;
      }, 0);
      return {
        id: p.id,
        name: p.display_name || p.full_name || "Parceiro",
        role: p.role,
        liquid: pLiquid,
        investments: pInv,
        credit: pCredit,
        net: pLiquid + pInv - pCredit,
      };
    });

    return {
      net,
      liquid,
      investments: inv,
      activeInvestmentsList: activeInvs,
      creditCards: credit,
      allAccounts,
      allTransactions,
      myNet,
      myLiquid,
      myInv,
      myCredit,
      partnerStats,
    };
  }, [myAccounts, myInvestments, myTransactions, activePartners]);

  // Análise de Fluxo Mensal (Salários / Entradas e Saídas do Mês)
  const monthlyFlow = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isThisMonth = (dStr: string) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    };

    // Helper para identificar transferências internas entre contas
    const isInternalTx = (t: any) => {
      const desc = `${t.clean_description || ""} ${t.description || ""}`.toLowerCase();
      return (
        desc.includes("mesma titularidade") ||
        desc.includes("resgate cdb") ||
        desc.includes("aplicacao") ||
        desc.includes("aplicação") ||
        desc.includes("rend pago") ||
        desc.includes("rendimento") ||
        desc.includes("transferencia entre contas") ||
        desc.includes("transf.mesma")
      );
    };

    // Minhas transações do mês
    const myMonthTx = myTransactions.filter((t: any) => isThisMonth(t.date || t.executed_at));
    let myIncome = 0;
    let myExpense = 0;
    const mySalaryList: any[] = [];

    myMonthTx.forEach((t: any) => {
      if (isInternalTx(t)) return;
      const amt = Number(t.amount) || 0;
      const desc = `${t.clean_description || ""} ${t.description || ""}`.toLowerCase();
      const isSalary =
        t.category_pt?.toLowerCase().includes("salário") ||
        t.category_pt?.toLowerCase().includes("renda") ||
        desc.includes("salario") ||
        desc.includes("provento") ||
        desc.includes("folha") ||
        desc.includes("pagto inss") ||
        desc.includes("inss") ||
        desc.includes("remuneracao") ||
        desc.includes("adicional");

      if (amt > 0) {
        myIncome += amt;
        if (isSalary || amt >= 1000) {
          mySalaryList.push({ ...t, member: myDisplayName });
        }
      } else {
        myExpense += Math.abs(amt);
      }
    });

    // Transações dos parceiros do mês
    const partnerFlows = activePartners.map((p) => {
      const pMonthTx = (p.transactions || []).filter((t) => isThisMonth(t.date || t.executed_at));
      let pIncome = 0;
      let pExpense = 0;
      const pSalaryList: any[] = [];

      pMonthTx.forEach((t) => {
        if (isInternalTx(t)) return;
        const amt = Number(t.amount) || 0;
        const desc = `${t.clean_description || ""} ${t.description || ""}`.toLowerCase();
        const isSalary =
          t.category_pt?.toLowerCase().includes("salário") ||
          t.category_pt?.toLowerCase().includes("renda") ||
          desc.includes("salario") ||
          desc.includes("provento") ||
          desc.includes("folha") ||
          desc.includes("pagto inss") ||
          desc.includes("inss") ||
          desc.includes("remuneracao") ||
          desc.includes("adicional");

        if (amt > 0) {
          pIncome += amt;
          if (isSalary || amt >= 1000) {
            pSalaryList.push({ ...t, member: p.display_name || p.full_name || "Parceiro" });
          }
        } else {
          pExpense += Math.abs(amt);
        }
      });

      return {
        id: p.id,
        name: p.display_name || p.full_name || "Parceiro",
        income: pIncome,
        expense: pExpense,
        balance: pIncome - pExpense,
        salaries: pSalaryList,
      };
    });

    const totalIncome = myIncome + partnerFlows.reduce((s, p) => s + p.income, 0);
    const totalExpense = myExpense + partnerFlows.reduce((s, p) => s + p.expense, 0);
    const netSaving = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? Math.max(0, Math.round((netSaving / totalIncome) * 100)) : 0;

    return {
      myIncome,
      myExpense,
      myBalance: myIncome - myExpense,
      mySalaryList,
      partnerFlows,
      totalIncome,
      totalExpense,
      netSaving,
      savingRate,
    };
  }, [myTransactions, activePartners, myDisplayName]);

  // Contas Pagas e a Pagar do Mês
  const monthlyBills = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isThisMonth = (dStr: string) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    };

    // Identifica se uma transação é pagamento de conta, boleto, água, luz, aluguel, condomínio, internet, etc.
    const isBillTx = (t: any) => {
      const desc = `${t.clean_description || ""} ${t.description || ""}`.toLowerCase();
      const cat = (t.category_pt || "").toLowerCase();
      return (
        cat.includes("contas") ||
        cat.includes("moradia") ||
        cat.includes("telecom") ||
        cat.includes("educação") ||
        cat.includes("saúde") ||
        desc.includes("pagto boleto") ||
        desc.includes("boleto") ||
        desc.includes("concessionaria") ||
        desc.includes("luz") ||
        desc.includes("enel") ||
        desc.includes("cpfl") ||
        desc.includes("sabesp") ||
        desc.includes("sanepar") ||
        desc.includes("agua") ||
        desc.includes("água") ||
        desc.includes("gas") ||
        desc.includes("gás") ||
        desc.includes("condomin") ||
        desc.includes("internet") ||
        desc.includes("claro") ||
        desc.includes("vivo") ||
        desc.includes("tim") ||
        desc.includes("aluguel") ||
        desc.includes("iptu") ||
        desc.includes("ipva") ||
        desc.includes("seguro") ||
        desc.includes("pagamento de fatura") ||
        desc.includes("pgto fatura")
      );
    };

    const paidBills: any[] = [];

    // Minhas contas pagas
    myTransactions.forEach((t: any) => {
      if (isThisMonth(t.date || t.executed_at) && Number(t.amount) < 0 && isBillTx(t)) {
        paidBills.push({
          id: t.id,
          name: t.clean_description || t.description,
          category: t.category_pt || "Contas e Serviços",
          amount: Math.abs(Number(t.amount)),
          date: t.date || t.executed_at,
          paidBy: `${myDisplayName} (Você)`,
          isMine: true,
          bank: t.bank_accounts?.institution_slug || t.bank_accounts?.bank_name,
        });
      }
    });

    // Contas pagas pelos parceiros
    activePartners.forEach((p) => {
      (p.transactions || []).forEach((t: any) => {
        if (isThisMonth(t.date || t.executed_at) && Number(t.amount) < 0 && isBillTx(t)) {
          paidBills.push({
            id: t.id,
            name: t.clean_description || t.description,
            category: t.category_pt || "Contas e Serviços",
            amount: Math.abs(Number(t.amount)),
            date: t.date || t.executed_at,
            paidBy: p.display_name || p.full_name || "Parceiro",
            isMine: false,
            bank: t.bank_accounts?.institution_slug || t.bank_accounts?.bank_name,
          });
        }
      });
    });

    // Contas A Pagar: Faturas em aberto de cartões de crédito
    const pendingBills: any[] = [];
    totals.allAccounts.forEach((acc) => {
      const isCard = acc.type === "CREDIT" || acc.type === "CREDIT_CARD" || acc.subtype === "CREDIT_CARD";
      const bal = Math.abs(Number(acc.balance) || 0);
      if (isCard && bal > 0.05) {
        const isMine = acc.user_id === user?.id;
        const ownerName = isMine
          ? `${myDisplayName} (Você)`
          : activePartners.find((p) => p.id === acc.user_id)?.display_name || "Parceiro";

        pendingBills.push({
          id: acc.id,
          name: `Fatura ${acc.product_name || acc.bank_name}`,
          category: "Fatura de Cartão",
          amount: bal,
          dueDate: "Próximo Vencimento",
          assignedTo: ownerName,
          isMine,
          bank: acc.institution_slug || acc.bank_name,
        });
      }
    });

    const totalPaid = paidBills.reduce((s, b) => s + b.amount, 0);
    const totalPending = pendingBills.reduce((s, b) => s + b.amount, 0);

    return {
      paidBills,
      pendingBills,
      totalPaid,
      totalPending,
      totalMonthBills: totalPaid + totalPending,
    };
  }, [myTransactions, activePartners, totals.allAccounts, user?.id, myDisplayName]);

  // Cálculos de Rentabilidade e Comparações
  const investmentYields = useMemo(() => {
    const total = totals.investments;
    // CDI atual de 10.65% a.a. -> rendimento mensal líquido (~0.846%)
    const monthlyCdiRate = Math.pow(1 + 0.1065, 1 / 12) - 1;
    const monthlyIncome = total * monthlyCdiRate;
    const annualIncome = total * 0.1065;

    // Comparativo anual
    const poupancaYield = total * 0.0617; // Poupança ~6.17% a.a.
    const ipcaPlusYield = total * 0.1068; // Tesouro IPCA+ ~10.68% a.a.
    const diffVsPoupanca = annualIncome - poupancaYield;

    return {
      total,
      monthlyIncome,
      annualIncome,
      poupancaYield,
      ipcaPlusYield,
      diffVsPoupanca,
    };
  }, [totals.investments]);

  // Simulação de Metas e Patrimônio Conjunto
  const simulationResult = useMemo(() => {
    const initialPrincipal = totals.net > 0 ? totals.net : 0;
    const months = simYears * 12;
    const monthlyRate = Math.pow(1 + simAnnualRate / 100, 1 / 12) - 1;

    let balance = initialPrincipal;
    let totalInvestedFromPocket = initialPrincipal;

    for (let m = 0; m < months; m++) {
      balance = balance * (1 + monthlyRate) + simMonthlyDeposit;
      totalInvestedFromPocket += simMonthlyDeposit;
    }

    const compoundInterest = Math.max(0, balance - totalInvestedFromPocket);

    return {
      initialPrincipal,
      totalInvestedFromPocket,
      compoundInterest,
      finalBalance: balance,
      months,
    };
  }, [totals.net, simYears, simAnnualRate, simMonthlyDeposit]);

  // Divisão Justa de Despesas (50/50 vs Proporcional)
  const fairSplitCalculation = useMemo(() => {
    const myIncome = monthlyFlow.myIncome || 1;
    const partnerTotalIncome = monthlyFlow.partnerFlows.reduce((s, p) => s + p.income, 0) || 1;
    const jointIncome = myIncome + partnerTotalIncome;

    const myShareRatio = splitMode === "50-50" ? 0.5 : myIncome / jointIncome;
    const partnerShareRatio = splitMode === "50-50" ? 0.5 : partnerTotalIncome / jointIncome;

    const jointBills = monthlyBills.totalMonthBills;
    const myExpectedShare = jointBills * myShareRatio;
    const partnerExpectedShare = jointBills * partnerShareRatio;

    // Quanto cada um realmente pagou
    const myActuallyPaid = monthlyBills.paidBills.filter((b) => b.isMine).reduce((s, b) => s + b.amount, 0);
    const partnerActuallyPaid = monthlyBills.paidBills.filter((b) => !b.isMine).reduce((s, b) => s + b.amount, 0);

    // Ajuste / acerto de contas
    const myBalanceDiff = myActuallyPaid - myExpectedShare;

    return {
      jointIncome,
      mySharePercent: Math.round(myShareRatio * 100),
      partnerSharePercent: Math.round(partnerShareRatio * 100),
      myExpectedShare,
      partnerExpectedShare,
      myActuallyPaid,
      partnerActuallyPaid,
      myBalanceDiff,
    };
  }, [monthlyFlow, monthlyBills, splitMode]);

  // Integrante Selecionado
  const selectedMemberData = useMemo(() => {
    if (activeMemberTab === "consolidated") return null;
    if (activeMemberTab === (user?.id || "me")) {
      return {
        id: user?.id,
        name: `${myDisplayName} (Você)`,
        role: "Titular Principal",
        accounts: myAccounts,
        investments: myInvestments.filter((i: any) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL"),
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
        investments: (partner.investments || []).filter(
          (i) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL"
        ),
        transactions: partner.transactions || [],
      };
    }
    return null;
  }, [activeMemberTab, user?.id, myDisplayName, myAccounts, myInvestments, myTransactions, activePartners]);

  // Ações de Convite e Desconexão
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col gap-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#27272A]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">diversity_3</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Espaço Compartilhado
            </h1>
            {activePartners.length > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{activePartners.length} Membro(s) Ativo(s)</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                Aguardando Conexão
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8] max-w-2xl">
            Gestão 360° do casal e família: salários, entradas e saídas, contas pagas e a pagar, rendimentos de investimentos e simulações com privacidade RLS.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchSharedSpace}
            disabled={isLoading}
            className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-[#18181B] text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? "animate-spin" : ""}`}>
              refresh
            </span>
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
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

      {/* Sem Contas Conectadas */}
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

      {/* 5 Cards de Métricas Consolidadas do Espaço */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Patrimônio Líquido
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
            </div>
          </div>
          <div>
            <span className="text-base md:text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight block">
              {formatCurrency(totals.net)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              Líquido + Invest. - Faturas
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
            <span className="text-base md:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight block">
              {formatCurrency(totals.liquid)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              Liquidez livre imediata
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Investimentos Ativos
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
            </div>
          </div>
          <div>
            <span className="text-base md:text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums tracking-tight block">
              {formatCurrency(totals.investments)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              Rende ~{formatCurrency(investmentYields.monthlyIncome)}/mês
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
            <span className="text-base md:text-xl font-black text-purple-500 tabular-nums tracking-tight block">
              {formatCurrency(totals.creditCards)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              Total devido nos cartões
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 md:p-5 flex flex-col justify-between gap-2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Entradas do Mês
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            </div>
          </div>
          <div>
            <span className="text-base md:text-xl font-black text-emerald-500 tabular-nums tracking-tight block">
              {formatCurrency(monthlyFlow.totalIncome)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              {monthlyFlow.savingRate}% taxa de poupança
            </span>
          </div>
        </SpotlightCard>
      </section>

      {/* Navegação de Abas do Espaço Compartilhado */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-[#27272A]">
        {[
          { id: "overview", label: "Visão Geral & Balanço", icon: "dashboard" },
          { id: "flow", label: "Salários & Fluxo Mensal", icon: "account_balance_wallet" },
          { id: "bills", label: "Contas Pagas & A Pagar", icon: "receipt_long" },
          { id: "investments", label: "Investimentos & Rendimento", icon: "trending_up" },
          { id: "simulator", label: "Simulador de Metas", icon: "calculate" },
          { id: "split", label: "Divisão Justa de Despesas", icon: "pie_chart" },
          { id: "members", label: "Membros & Convites", icon: "group_add" },
        ].map((tab) => {
          const isActive = activeFeatureTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFeatureTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#FF8216] text-white shadow-xs"
                  : "bg-white dark:bg-[#121214] text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#27272A]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ABA 1: VISÃO GERAL & BALANÇO */}
      {activeFeatureTab === "overview" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
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
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF8216] text-lg">account_balance_wallet</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Contas e Cartões Conectados ({totals.allAccounts.length})
                  </h3>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
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
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isMine ? "bg-[#FF8216]/10 text-[#FF8216]" : "bg-emerald-500/10 text-emerald-500"
                              }`}
                            >
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

            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF8216] text-lg">receipt_long</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Extrato Consolidado Recente
                  </h3>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                {totals.allTransactions.slice(0, 15).map((t) => {
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
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isMine ? "bg-[#FF8216]/10 text-[#FF8216]" : "bg-emerald-500/10 text-emerald-500"
                              }`}
                            >
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
      )}

      {/* ABA 2: SALÁRIOS & FLUXO MENSAL */}
      {activeFeatureTab === "flow" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Resumo do Mês */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard className="p-5 flex flex-col justify-between gap-3 bg-emerald-500/5 border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  Renda Total do Casal (Entradas)
                </span>
                <span className="material-symbols-outlined text-emerald-500">trending_up</span>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-500 tabular-nums">
                  {formatCurrency(monthlyFlow.totalIncome)}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Soma de salários, proventos e recebimentos de ambos os membros no mês atual.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between gap-3 bg-rose-500/5 border-rose-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                  Despesas Totais do Mês
                </span>
                <span className="material-symbols-outlined text-rose-500">trending_down</span>
              </div>
              <div>
                <span className="text-2xl font-black text-rose-500 tabular-nums">
                  {formatCurrency(monthlyFlow.totalExpense)}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Gastos debitados e compromissos efetuados por ambos no período.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between gap-3 bg-[#FF8216]/5 border-[#FF8216]/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#FF8216] uppercase tracking-wider">
                  Capacidade de Poupança do Casal
                </span>
                <span className="material-symbols-outlined text-[#FF8216]">savings</span>
              </div>
              <div>
                <span className="text-2xl font-black text-[#FF8216] tabular-nums">
                  {formatCurrency(monthlyFlow.netSaving)}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Sobra líquida mensal estimada ({monthlyFlow.savingRate}% da renda total retida).
                </p>
              </div>
            </SpotlightCard>
          </div>

          {/* Comparativo de Renda e Gastos por Membro */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF8216]">compare_arrows</span>
              <span>Divisão do Fluxo por Integrante</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Você */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FF8216] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#FF8216]" />
                    <span>{myDisplayName} (Você)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Titular Principal</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Entradas</span>
                    <span className="font-bold text-emerald-500 block tabular-nums text-sm">
                      {formatCurrency(monthlyFlow.myIncome)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Saídas</span>
                    <span className="font-bold text-rose-500 block tabular-nums text-sm">
                      {formatCurrency(monthlyFlow.myExpense)}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Saldo Líquido Pessoal:</span>
                  <span className={`font-black tabular-nums ${monthlyFlow.myBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {formatCurrency(monthlyFlow.myBalance)}
                  </span>
                </div>
              </div>

              {/* Parceiros */}
              {monthlyFlow.partnerFlows.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{p.name}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Parceiro(a)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Entradas</span>
                      <span className="font-bold text-emerald-500 block tabular-nums text-sm">
                        {formatCurrency(p.income)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Saídas</span>
                      <span className="font-bold text-rose-500 block tabular-nums text-sm">
                        {formatCurrency(p.expense)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Saldo Líquido Pessoal:</span>
                    <span className={`font-black tabular-nums ${p.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {formatCurrency(p.balance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CONTAS PAGAS & A PAGAR */}
      {activeFeatureTab === "bills" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Header de Resumo de Contas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard className="p-5 flex flex-col justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Compromissos do Mês
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(monthlyBills.totalMonthBills)}
              </span>
              <span className="text-xs text-slate-400">
                {monthlyBills.paidBills.length + monthlyBills.pendingBills.length} contas contabilizadas
              </span>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between gap-2 bg-emerald-500/5 border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                Já Pagas no Mês
              </span>
              <span className="text-2xl font-black text-emerald-500 tabular-nums">
                {formatCurrency(monthlyBills.totalPaid)}
              </span>
              <span className="text-xs text-emerald-500/80">
                {monthlyBills.paidBills.length} boletos/faturas liquidados
              </span>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between gap-2 bg-purple-500/5 border-purple-500/20">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                A Pagar / Faturas em Aberto
              </span>
              <span className="text-2xl font-black text-purple-400 tabular-nums">
                {formatCurrency(monthlyBills.totalPending)}
              </span>
              <span className="text-xs text-purple-400/80">
                {monthlyBills.pendingBills.length} faturas/contas pendentes
              </span>
            </SpotlightCard>
          </div>

          {/* Grid: Contas a Pagar e Contas Já Pagas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contas a Pagar / Pendentes */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400">pending_actions</span>
                  <span>A Pagar / Faturas Abertas ({monthlyBills.pendingBills.length})</span>
                </h3>
              </div>

              <div className="flex flex-col gap-2.5">
                {monthlyBills.pendingBills.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-center text-xs text-slate-400">
                    Nenhuma fatura ou conta aberta pendente para o casal.
                  </div>
                ) : (
                  monthlyBills.pendingBills.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <BankLogo bank={b.bank} size="sm" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {b.name}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                b.isMine ? "bg-[#FF8216]/10 text-[#FF8216]" : "bg-purple-500/10 text-purple-400"
                              }`}
                            >
                              {b.assignedTo}
                            </span>
                            <span>{b.dueDate}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span className="text-xs md:text-sm font-black text-purple-400 tabular-nums">
                          {formatCurrency(b.amount)}
                        </span>
                        <span className="text-[10px] text-amber-500 font-semibold">Pendente</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Contas Já Pagas */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                  <span>Já Pagas no Mês ({monthlyBills.paidBills.length})</span>
                </h3>
              </div>

              <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
                {monthlyBills.paidBills.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-center text-xs text-slate-400">
                    Nenhum boleto ou pagamento de conta registrado neste mês.
                  </div>
                ) : (
                  monthlyBills.paidBills.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <BankLogo bank={b.bank} size="sm" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {b.name}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                b.isMine ? "bg-[#FF8216]/10 text-[#FF8216]" : "bg-emerald-500/10 text-emerald-500"
                              }`}
                            >
                              Pago por {b.paidBy}
                            </span>
                            <span>{b.date}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span className="text-xs md:text-sm font-black text-emerald-500 tabular-nums">
                          {formatCurrency(b.amount)}
                        </span>
                        <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">done</span>
                          <span>Quitado</span>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: INVESTIMENTOS & RENDIMENTO CONJUNTO */}
      {activeFeatureTab === "investments" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Card Principal de Rendimento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard className="p-5 flex flex-col justify-between gap-3 bg-blue-500/5 border-blue-500/20">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                Patrimônio Investido da Família
              </span>
              <div>
                <span className="text-2xl font-black text-blue-500 tabular-nums">
                  {formatCurrency(investmentYields.total)}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  {totals.activeInvestmentsList.length} posições ativas em Renda Fixa, CDBs e Fundos.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between gap-3 bg-emerald-500/5 border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                Rendimento Mensal Estimado
              </span>
              <div>
                <span className="text-2xl font-black text-emerald-500 tabular-nums">
                  + {formatCurrency(investmentYields.monthlyIncome)}/mês
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Calculado a 100% do CDI atual (10,65% a.a.) pingando passivamente na carteira.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between gap-3 bg-[#FF8216]/5 border-[#FF8216]/20">
              <span className="text-xs font-bold text-[#FF8216] uppercase tracking-wider">
                Rendimento Anual Estimado
              </span>
              <div>
                <span className="text-2xl font-black text-[#FF8216] tabular-nums">
                  + {formatCurrency(investmentYields.annualIncome)}/ano
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Ganho projetado para os próximos 12 meses mantendo o saldo alocado.
                </p>
              </div>
            </SpotlightCard>
          </div>

          {/* Comparativo de Oportunidade: Quanto o dinheiro renderia */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF8216]">candlestick_chart</span>
                <span>Termômetro Comparativo: Quanto renderia o dinheiro do casal?</span>
              </h3>
              <p className="text-xs text-slate-400">
                Veja o impacto da alocação correta sobre o patrimônio atual de {formatCurrency(investmentYields.total)}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Se ficasse na Poupança (6,17% a.a.)</span>
                <span className="text-lg font-black text-slate-300 tabular-nums">
                  {formatCurrency(investmentYields.poupancaYield)}/ano
                </span>
                <span className="text-[11px] text-rose-500">
                  Perderia {formatCurrency(investmentYields.diffVsPoupanca)} comparado ao CDI atual!
                </span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2">
                <span className="text-xs font-bold text-emerald-500 uppercase">CDI 100% Atual (10,65% a.a.)</span>
                <span className="text-lg font-black text-emerald-400 tabular-nums">
                  {formatCurrency(investmentYields.annualIncome)}/ano
                </span>
                <span className="text-[11px] text-emerald-500 font-semibold">
                  Alocação segura com liquidez diária dos CDBs integrados.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col gap-2">
                <span className="text-xs font-bold text-blue-400 uppercase">Tesouro IPCA+ (IPCA + 6,2% a.a.)</span>
                <span className="text-lg font-black text-blue-400 tabular-nums">
                  {formatCurrency(investmentYields.ipcaPlusYield)}/ano
                </span>
                <span className="text-[11px] text-blue-400 font-semibold">
                  Proteção máxima contra inflação no longo prazo.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: SIMULADOR DE METAS E SONHOS CONJUNTOS */}
      {activeFeatureTab === "simulator" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col gap-6 shadow-xs">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF8216]">savings</span>
                <span>Simulador de Metas & Patrimônio Familiar</span>
              </h3>
              <p className="text-xs text-slate-400">
                Projete o crescimento do patrimônio conjunto somando os aportes mensais do casal com a força dos juros compostos.
              </p>
            </div>

            {/* Controles de Simulação */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Aporte Mensal */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Aporte Mensal Conjunto:</span>
                  <span className="text-[#FF8216] font-mono font-black">{formatCurrency(simMonthlyDeposit)}</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="15000"
                  step="100"
                  value={simMonthlyDeposit}
                  onChange={(e) => setSimMonthlyDeposit(Number(e.target.value))}
                  className="w-full accent-[#FF8216] cursor-pointer"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[500, 1000, 2000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSimMonthlyDeposit(val)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                        simMonthlyDeposit === val
                          ? "bg-[#FF8216] text-white"
                          : "bg-slate-100 dark:bg-[#18181B] text-slate-600 dark:text-zinc-400 hover:text-white"
                      }`}
                    >
                      {formatCurrency(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prazo */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Prazo da Meta:</span>
                  <span className="text-[#FF8216] font-mono font-black">{simYears} {simYears === 1 ? "Ano" : "Anos"}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={simYears}
                  onChange={(e) => setSimYears(Number(e.target.value))}
                  className="w-full accent-[#FF8216] cursor-pointer"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[1, 3, 5, 10].map((yrs) => (
                    <button
                      key={yrs}
                      type="button"
                      onClick={() => setSimYears(yrs)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                        simYears === yrs
                          ? "bg-[#FF8216] text-white"
                          : "bg-slate-100 dark:bg-[#18181B] text-slate-600 dark:text-zinc-400 hover:text-white"
                      }`}
                    >
                      {yrs} {yrs === 1 ? "Ano" : "Anos"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Taxa de Rentabilidade */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Rentabilidade Anual:</span>
                  <span className="text-[#FF8216] font-mono font-black">{simAnnualRate}% a.a.</span>
                </label>
                <input
                  type="range"
                  min="6"
                  max="16"
                  step="0.25"
                  value={simAnnualRate}
                  onChange={(e) => setSimAnnualRate(Number(e.target.value))}
                  className="w-full accent-[#FF8216] cursor-pointer"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[6.17, 10.65, 12.0, 14.0].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setSimAnnualRate(rate)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                        simAnnualRate === rate
                          ? "bg-[#FF8216] text-white"
                          : "bg-slate-100 dark:bg-[#18181B] text-slate-600 dark:text-zinc-400 hover:text-white"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado da Projeção */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FF8216]/10 via-[#18181B] to-[#121214] border border-[#FF8216]/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#FF8216] uppercase tracking-wider">
                  Patrimônio Futuro Acumulado em {simYears} anos
                </span>
                <span className="text-2xl md:text-4xl font-black text-white tabular-nums tracking-tight">
                  {formatCurrency(simulationResult.finalBalance)}
                </span>
                <span className="text-xs text-slate-400">
                  Partindo do patrimônio inicial de {formatCurrency(simulationResult.initialPrincipal)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Total do Seu Bolso</span>
                  <span className="text-base font-bold text-slate-200 tabular-nums">
                    {formatCurrency(simulationResult.totalInvestedFromPocket)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase block">Juros Compostos Ganho</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums">
                    + {formatCurrency(simulationResult.compoundInterest)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 6: DIVISÃO JUSTA DE DESPESAS */}
      {activeFeatureTab === "split" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex flex-col gap-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FF8216]">balance</span>
                  <span>Calculadora de Divisão Justa do Casal</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Evite atritos financeiros: divida as contas comuns igualitariamente (50/50) ou de forma proporcional à renda de cada um.
                </p>
              </div>

              {/* Toggle de Modo */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setSplitMode("proportional")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    splitMode === "proportional"
                      ? "bg-[#FF8216] text-white shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-white"
                  }`}
                >
                  Proporcional à Renda
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("50-50")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    splitMode === "50-50"
                      ? "bg-[#FF8216] text-white shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-white"
                  }`}
                >
                  Divisão 50% / 50%
                </button>
              </div>
            </div>

            {/* Visualização de Proporção */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-2">
                <span className="text-xs font-bold text-[#FF8216]">{myDisplayName} (Você)</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-white tabular-nums">
                    {fairSplitCalculation.mySharePercent}%
                  </span>
                  <span className="text-xs text-slate-400">
                    Cota justa: {formatCurrency(fairSplitCalculation.myExpectedShare)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Já pagou neste mês: <strong className="text-white">{formatCurrency(fairSplitCalculation.myActuallyPaid)}</strong>
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-2">
                <span className="text-xs font-bold text-emerald-500">
                  {activePartners[0]?.display_name || "Parceiro(a)"}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-white tabular-nums">
                    {fairSplitCalculation.partnerSharePercent}%
                  </span>
                  <span className="text-xs text-slate-400">
                    Cota justa: {formatCurrency(fairSplitCalculation.partnerExpectedShare)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Já pagou neste mês: <strong className="text-white">{formatCurrency(fairSplitCalculation.partnerActuallyPaid)}</strong>
                </span>
              </div>
            </div>

            {/* Acerto de Contas */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#FF8216] text-2xl">sync_alt</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Acerto de Contas Sugerido</h4>
                  <p className="text-[11px] text-slate-400">
                    {fairSplitCalculation.myBalanceDiff > 0
                      ? `${activePartners[0]?.display_name || "Seu parceiro(a)"} deve transferir ${formatCurrency(fairSplitCalculation.myBalanceDiff)} para você para equilibrar o mês.`
                      : fairSplitCalculation.myBalanceDiff < 0
                      ? `Você deve transferir ${formatCurrency(Math.abs(fairSplitCalculation.myBalanceDiff))} para ${activePartners[0]?.display_name || "seu parceiro(a)"} para equilibrar as despesas.`
                      : "As contas do mês estão perfeitamente equilibradas entre ambos!"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 7: MEMBROS & GOVERNANÇA */}
      {activeFeatureTab === "members" && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Membros Conectados */}
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
                      <span>Desconectar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulários de Convite: 1. Por E-mail | 2. Por Código KT-XXXX */}
          {sharedData?.canInvite && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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
                    Gera um código exclusivo KT-XXXX e notifica o usuário caso ele já tenha cadastro.
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
        </div>
      )}

      {/* Modal de Confirmação de Desconexão */}
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
  );
}
