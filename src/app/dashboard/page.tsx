"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PluggyConnectModal from "@/components/PluggyConnectModal";
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
import { SpendingCurveChart } from "@/components/charts/SpendingCurveChart";
import { CashFlowSankey } from "@/components/charts/CashFlowSankey";
import { CategoriesView } from "@/components/finance/CategoriesView";
import { PaginatedTransactionsView } from "@/components/finance/PaginatedTransactionsView";
import { runFinancialXRay } from "@/utils/finance/engine";
import { parseLocalDate } from "@/utils/finance/reconciler";
import {
  fetchLiveMacroRates,
  getCachedOrFallbackMacroRates,
  type LiveMacroRatesSnapshot,
} from "@/utils/finance/macro-rates";
import { NetWorthHeroChart } from "@/components/wealthfolio/NetWorthHeroChart";
import { GroupedAccountsList } from "@/components/wealthfolio/GroupedAccountsList";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import { AssetModal } from "@/components/assets/AssetModal";
import type { CustomAsset } from "@/types/finance";


const FINANCIAL_GOALS_MAP: Record<string, string> = {
  asset_growth: "Crescimento e Alocação Estratégica",
  emergency_fund: "Construção de Reserva de Emergência",
  debt_freedom: "Zerar Faturas & Dívidas",
  debt_payoff: "Quitação de Dívidas e Alavancagem",
  fire_investing: "Independência Financeira (FIRE)",
  real_estate: "Conquista de Imóvel / Veículo",
  travel_lifestyle: "Projetos Pessoais & Viagens",
  reduce_expenses: "Otimização de Custos e Gastos",
  investir: "Multiplicação Patrimonial e Renda Passiva",
  "investir e multiplicar": "Crescimento e Alocação Estratégica",
};

type DashboardTab =
  | "Visão Geral"
  | "Fluxo & Gastos"
  | "Transações"
  | "Parcelas & Assinaturas";

const DASHBOARD_TABS: DashboardTab[] = [
  "Visão Geral",
  "Fluxo & Gastos",
  "Transações",
  "Parcelas & Assinaturas",
];

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    accounts,
    investments,
    loans,
    transactions,
    connections,
    familyMembers,
    customAssets,
    aiInsight,
    isInitialLoading,
    isRevalidating,
    selectedBankSlug,
    setSelectedBankSlug,
    isFamilyModeEnabled,
    setIsFamilyModeEnabled,
    activePartner,
    isPrivacyMode,
    togglePrivacyMode,
    revalidate,
    setAiInsightState,
    addFamilyMemberLocal,
  } = useFinanceData();

  const [activeTab, setActiveTab] = useState<DashboardTab>("Visão Geral");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectForMemberId, setConnectForMemberId] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [selectedAssetToEdit, setSelectedAssetToEdit] = useState<CustomAsset | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<"day" | "week" | "month" | "year">("month");

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [macroRates, setMacroRates] = useState<LiveMacroRatesSnapshot>(() =>
    getCachedOrFallbackMacroRates()
  );

  // Redirecionamento limpo caso o usuário abra link de convite no Dashboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get("accept_invite");
      if (inviteParam) {
        router.replace(`/shared?accept_invite=${encodeURIComponent(inviteParam)}`);
      }
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    fetchLiveMacroRates().then((live) => {
      if (mounted) setMacroRates(live);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const userFirstName = useMemo(() => {
    if (userProfile?.display_name && userProfile.display_name.trim().length > 0) {
      return userProfile.display_name.trim().split(" ")[0];
    }
    if (userProfile?.full_name && userProfile.full_name.trim().length > 0) {
      return userProfile.full_name.trim().split(" ")[0];
    }
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    if (metaName) return String(metaName).split(" ")[0];
    return user?.email?.split("@")[0] || "Investidor";
  }, [userProfile, user]);

  // Lista única de instituições conectadas ordenada por relevância patrimonial
  const connectedBanks = useMemo(() => {
    const map = new Map<
      string,
      { slug: string; name: string; accountCount: number; totalAssets: number }
    >();

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

    return Array.from(map.values()).sort((a, b) => b.totalAssets - a.totalAssets);
  }, [accounts, investments, connections]);

  useEffect(() => {
    if (
      selectedBankSlug !== "all" &&
      connectedBanks.length > 0 &&
      !connectedBanks.some((b) => b.slug === selectedBankSlug)
    ) {
      setSelectedBankSlug("all");
    }
  }, [selectedBankSlug, connectedBanks, setSelectedBankSlug]);

  // Filtragem Global Combinada (Membro da Família + Banco Selecionado)
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

  const selfAndFamilyNames = useMemo(() => {
    return [
      userProfile?.full_name,
      userProfile?.display_name,
      userFirstName,
      ...familyMembers.map((f) => f.name),
    ]
      .filter(Boolean)
      .map((n) => n!.toLowerCase().trim());
  }, [userProfile, userFirstName, familyMembers]);

  // Transações filtradas pela janela de granularidade (para Fluxo & Gastos / Sankey)
  const periodFilteredTransactions = useMemo(() => {
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const curYearStr = `${now.getFullYear()}`;

    return filteredTransactions.filter((tx) => {
      const rawDate = tx.executed_at || tx.date;
      if (!rawDate) return false;
      const txDate = parseLocalDate(rawDate);
      const dStr = rawDate.split("T")[0];

      if (timeGranularity === "day") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return txDate >= sevenDaysAgo && txDate <= now;
      }
      if (timeGranularity === "week") {
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        return txDate >= fourteenDaysAgo && txDate <= now;
      }
      if (timeGranularity === "year") {
        return dStr.startsWith(curYearStr);
      }
      return dStr.startsWith(curMonthStr);
    });
  }, [filteredTransactions, timeGranularity]);

  // Curva acumulada de gastos dia a dia
  const spendingCurveData = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = Math.min(31, Math.max(1, now.getDate()));

    const curMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const curDays = new Array(31).fill(0);
    const prevDays = new Array(31).fill(0);
    let curTotal = 0;
    let prevTotal = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.is_internal_transfer || tx.is_refund) return;
      const amt = Number(tx.amount) || 0;
      const isExpense = amt < 0 || tx.type === "DEBIT" || tx.operation_type === "CREDIT_CARD";
      if (!isExpense) return;
      const absAmt = Math.abs(amt);
      if (absAmt === 0) return;

      const dStr = (tx.date || tx.executed_at || "").split("T")[0];
      if (dStr.startsWith(curMonthStr)) {
        const dayNum = parseInt(dStr.split("-")[2], 10);
        if (dayNum >= 1 && dayNum <= 31) {
          curDays[dayNum - 1] += absAmt;
          curTotal += absAmt;
        }
      } else if (dStr.startsWith(prevMonthStr)) {
        const dayNum = parseInt(dStr.split("-")[2], 10);
        if (dayNum >= 1 && dayNum <= 31) {
          prevDays[dayNum - 1] += absAmt;
          prevTotal += absAmt;
        }
      }
    });

    const curCumul: number[] = [];
    let accCur = 0;
    for (let i = 0; i < 31; i++) {
      accCur += curDays[i];
      curCumul.push(accCur);
    }

    const prevCumul: number[] = [];
    let accPrev = 0;
    for (let i = 0; i < 31; i++) {
      accPrev += prevDays[i];
      prevCumul.push(accPrev);
    }

    return {
      currentMonthDays: curCumul,
      previousMonthDays: prevCumul,
      currentDay: curDay,
      totalCurrentMonth: curTotal,
      totalPreviousMonth: prevTotal > 0 ? prevTotal : Math.round(curTotal * 1.25),
    };
  }, [filteredTransactions]);

  // Motor Determinístico Consolidado (MSLR)
  const {
    totalBalance,
    liquidBalance,
    investmentsBalance,
    vehiclesBalance,
    realEstateBalance,
    fgtsBalance,
    otherAssetsBalance,
    loansBalance,
    creditCardBalance,
    monthlyIncome,
    monthlyExpense,
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

    const invTotal = filteredInvestments
      .filter((i) => (Number(i.balance) || 0) > 0 && i.status !== "TOTAL_WITHDRAWAL")
      .reduce((sum, i) => sum + (Number(i.balance) || 0), 0);

    const loansTotal = filteredLoans.reduce(
      (sum, l) => sum + (Number(l.outstanding_balance) || 0),
      0
    );

    // Ativos Físicos e Imobilizados (Veículos FIPE, Terrenos/Imóveis, FGTS)
    const vehTotal = (customAssets || [])
      .filter((a) => a.category === "vehicle")
      .reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);

    const reTotal = (customAssets || [])
      .filter((a) => a.category === "land" || a.category === "real_estate")
      .reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);

    const fgTotal = (customAssets || [])
      .filter((a) => a.category === "fgts")
      .reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);

    const otTotal = (customAssets || [])
      .filter((a) => a.category === "other")
      .reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);

    const physicalTotal = vehTotal + reTotal + fgTotal + otTotal;

    const now = new Date();
    let windowStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    let windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (timeGranularity === "day") {
      windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
      windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (timeGranularity === "week") {
      windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (timeGranularity === "year") {
      windowStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      windowEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((txn) => {
      const rawDate = txn.date || txn.executed_at;
      if (!rawDate) return;
      const txnDate = parseLocalDate(rawDate);
      const absAmount = Math.abs(Number(txn.amount) || 0);
      if (absAmount === 0) return;

      const isInternal = Boolean(txn.is_internal_transfer);
      const isRefund = Boolean(txn.is_refund);
      const isCreditCardAcc =
        txn.bank_accounts?.type === "CREDIT" ||
        txn.bank_accounts?.subtype === "CREDIT_CARD" ||
        txn.operation_type === "CREDIT_CARD";

      const catLower = (txn.category_pt || txn.category || "").toLowerCase();
      const descLower = (
        txn.receiver_name ||
        txn.payer_name ||
        txn.clean_description ||
        txn.description ||
        ""
      ).toLowerCase();

      const isSelfOrFamilyPix =
        selfAndFamilyNames.some((name) => descLower.includes(name)) ||
        descLower.includes("mesma titularidade") ||
        descLower.includes("mesmo cpf") ||
        descLower.includes("entre contas") ||
        descLower.includes("transferência própria") ||
        descLower.includes("transferencia propria") ||
        descLower.includes("pagamento recebido") ||
        descLower.includes("pagamento de fatura") ||
        descLower.includes("fatura cartão") ||
        catLower.includes("transferência própria") ||
        catLower.includes("transferencia propria") ||
        catLower.includes("same person transfer") ||
        catLower.includes("internal transfer") ||
        catLower.includes("credit card payment");

      const isInvestmentMovement =
        catLower.includes("investimento") ||
        catLower.includes("renda fixa") ||
        descLower.includes("resgate cdb") ||
        descLower.includes("resgate rdb") ||
        descLower.includes("aplic cdb") ||
        descLower.includes("aplicacao cdb") ||
        descLower.includes("aplicacao aut") ||
        descLower.includes("rend pago") ||
        descLower.includes("rendimento pago");

      if (isInternal || isSelfOrFamilyPix || isInvestmentMovement || isRefund) {
        return;
      }

      const isExpense = Number(txn.amount) < 0 || txn.type === "DEBIT" || isCreditCardAcc;
      const isRealIncome =
        !isExpense && (txn.type === "CREDIT" || Number(txn.amount) > 0) && !isCreditCardAcc;

      if (txnDate >= windowStart && txnDate <= windowEnd) {
        if (isRealIncome) {
          income += absAmount;
        } else if (isExpense) {
          expense += absAmount;
        }
      }
    });

    return {
      totalBalance: liquid + invTotal + physicalTotal - credit - loansTotal,
      liquidBalance: liquid,
      investmentsBalance: invTotal,
      vehiclesBalance: vehTotal,
      realEstateBalance: reTotal,
      fgtsBalance: fgTotal,
      otherAssetsBalance: otTotal,
      loansBalance: loansTotal,
      creditCardBalance: credit,
      monthlyIncome: income,
      monthlyExpense: expense,
    };
  }, [
    filteredAccounts,
    filteredInvestments,
    filteredLoans,
    customAssets,
    filteredTransactions,
    timeGranularity,
    selfAndFamilyNames,
  ]);

  const formatCurrency = (value: number) => {
    if (isPrivacyMode) return "R$ ••••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    const clean = dateString.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
  };

  // Kitsune Health Score determinístico via X-Ray Engine
  const kitsuneScore = useMemo(() => {
    if (accounts.length === 0) {
      return { score: 500, label: "Aguardando Conexões", color: "text-zinc-400" };
    }

    const mappedAccounts = accounts.map((a) => ({
      id: a.id,
      institutionName: a.institution_name || a.bank_name || "Banco",
      type: (
        a.type === "CREDIT" || a.subtype === "CREDIT_CARD"
          ? "CREDIT_CARD"
          : a.type === "SAVINGS"
          ? "SAVINGS"
          : "CHECKING"
      ) as any,
      balance: Number(a.balance) || 0,
      creditLimit: Number(a.credit_limit) || undefined,
      usedCreditLimit: Number(a.used_credit_limit) || undefined,
    }));

    const mappedInvestments = investments.map((inv) => ({
      id: inv.id,
      name: inv.name || inv.code || "Título",
      institutionName: inv.institution_name || inv.bank_name || "Instituição",
      issuerName: inv.issuer || null,
      type: (inv.type || "CDB").toUpperCase(),
      balance: Number(inv.balance) || 0,
      ratePercentOfCDI: Number(inv.rate) || undefined,
      isDailyLiquidity:
        (inv.subtype || "").toLowerCase().includes("daily") ||
        (inv.name || "").toLowerCase().includes("diária"),
      isFGCGuaranteed: true,
    }));

    const xray = runFinancialXRay({
      accounts: mappedAccounts,
      investments: mappedInvestments,
      monthlyIncome,
      monthlyExpenses: monthlyExpense,
      macroRates: {
        annualCDIPct: macroRates.annualCDIPct,
        annualIPCAPct: macroRates.annualIPCAPct,
        annualSelicPct: macroRates.annualSelicPct,
      },
    });

    const scaledScore = Math.max(300, Math.min(990, Math.round(xray.kitsuneScore * 10)));
    const color =
      xray.statusLabel === "EXCELENTE" || xray.statusLabel === "SAUDÁVEL"
        ? "text-emerald-500"
        : xray.statusLabel === "ATENÇÃO"
        ? "text-[#FF8216]"
        : "text-rose-500";

    const label =
      xray.statusLabel === "EXCELENTE"
        ? "Excelente"
        : xray.statusLabel === "SAUDÁVEL"
        ? "Saudável"
        : xray.statusLabel === "ATENÇÃO"
        ? "Equilibrado"
        : "Atenção Necessária";

    return { score: scaledScore, label, color };
  }, [accounts, investments, monthlyIncome, monthlyExpense, macroRates]);

  // Alerta de concentração FGC > R$ 250k por conglomerado emissor
  const fgcWarning = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvestments.forEach((inv) => {
      const bal = Number(inv.balance) || 0;
      if (bal <= 0 || inv.status === "TOTAL_WITHDRAWAL") return;
      const issuer =
        inv.issuer && inv.issuer.trim().length > 1
          ? inv.issuer.trim()
          : (inv.institution_name || "Instituição").trim();
      map.set(issuer, (map.get(issuer) || 0) + bal);
    });
    for (const [name, total] of map.entries()) {
      if (total > 250000) {
        return { issuerName: name, total, excess: total - 250000 };
      }
    }
    return null;
  }, [filteredInvestments]);

  // Diagnóstico determinístico de Metas Patrimoniais (estilo SavingGoals do Wealthfolio)
  const goalsSummary = useMemo(() => {
    const monthlyCost = monthlyExpense > 0 ? monthlyExpense : 2500;
    const emergencyTarget = monthlyCost * 6;
    const emergencyPct = Math.min(100, Math.max(0, Math.round((liquidBalance / emergencyTarget) * 100)));
    const emergencyMonths = (liquidBalance / monthlyCost).toFixed(1);

    const projectedMonthlyYield = Math.round(
      investmentsBalance * macroRates.monthlyCDICompoundFactor * 100
    ) / 100;
    const fireCoveragePct = Math.min(
      100,
      Math.max(0, Math.round((projectedMonthlyYield / monthlyCost) * 100))
    );

    const goalKey = (userProfile?.financial_goal || "asset_growth").toLowerCase().trim();
    const goalLabel =
      FINANCIAL_GOALS_MAP[goalKey] || "Crescimento e Alocação Estratégica";

    let primaryProgress = 50;
    if (goalKey.includes("reserva") || goalKey === "emergency_fund") {
      primaryProgress = emergencyPct;
    } else if (goalKey.includes("debt") || goalKey.includes("dívida") || goalKey.includes("divida")) {
      const ratio = creditCardBalance > 0 ? liquidBalance / creditCardBalance : 10;
      primaryProgress = creditCardBalance === 0 ? 100 : Math.min(100, Math.round(ratio * 50));
    } else {
      const allocRatio = totalBalance > 0 ? Math.round((investmentsBalance / totalBalance) * 100) : 0;
      primaryProgress = Math.min(100, Math.max(8, allocRatio));
    }

    return {
      goalLabel,
      primaryProgress,
      emergencyTarget,
      emergencyPct,
      emergencyMonths,
      projectedMonthlyYield,
      fireCoveragePct,
      monthlyCost,
    };
  }, [
    userProfile?.financial_goal,
    liquidBalance,
    investmentsBalance,
    totalBalance,
    creditCardBalance,
    monthlyExpense,
    macroRates.monthlyCDICompoundFactor,
  ]);

  // Top posições ativas e atividades recentes conciliadas (sem datas futuras)
  const topHoldings = useMemo(() => {
    const active = filteredInvestments.filter(
      (i) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL"
    );
    const total = active.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    return active.slice(0, 5).map((inv) => {
      const bal = Number(inv.balance) || 0;
      return {
        id: inv.id,
        name: inv.name || inv.code || "Título",
        institution: inv.institution_name || inv.bank_name || "Custódia",
        slug: inv.institution_slug || inv.institution_name || "generic",
        balance: bal,
        weightPct: total > 0 ? (bal / total) * 100 : 0,
      };
    });
  }, [filteredInvestments]);

  const recentConciliatedTxns = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().split("T")[0];
    return [...filteredTransactions]
      .filter((t) => {
        if (t.is_internal_transfer) return false;
        const rawDate = t.executed_at || t.date;
        if (!rawDate) return false;
        const txIso = rawDate.split("T")[0].split(" ")[0];
        if (txIso > todayIso) return false;
        return Math.abs(Number(t.amount) || 0) > 0;
      })
      .sort((a, b) => {
        const da = parseLocalDate(a.executed_at || a.date).getTime();
        const db = parseLocalDate(b.executed_at || b.date).getTime();
        return db - da;
      })
      .slice(0, 7);
  }, [filteredTransactions]);

  const generateAiInsight = async () => {
    setIsGeneratingAi(true);
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
      if (response.ok && data.success && data.data) {
        setAiInsightState({
          text: data.data.last_analysis_text,
          updatedAt: data.data.updated_at,
        });
      }
    } catch (err) {
      console.warn("Falha ao atualizar insight IA:", err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  useEffect(() => {
    if (!aiInsight && !isGeneratingAi && accounts.length > 0 && transactions.length > 0) {
      generateAiInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiInsight, accounts.length, transactions.length]);

  const activeScopeLabel = useMemo(() => {
    const bankObj = connectedBanks.find((b) => b.slug === selectedBankSlug);
    const bankLabel = bankObj ? bankObj.name : "Patrimônio Líquido Consolidado";
    if (isFamilyModeEnabled) {
      return `${bankLabel} • Visão Compartilhada`;
    }
    return bankLabel;
  }, [connectedBanks, selectedBankSlug, isFamilyModeEnabled]);

  if (isInitialLoading && accounts.length === 0 && transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center animate-pulse text-[#FF8216]">
          <WfIcons.Overview className="w-5 h-5" />
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-3">
          Sincronizando patrimônio com segurança...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      {/* Top Bar Estilo Wealthfolio: Saudação enxuta + Tabs Lineares + Ações Rápidas */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-3 border-b border-zinc-200 dark:border-[#27272A]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
                Olá, {userFirstName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF8216]/12 text-[#FF8216] border border-[#FF8216]/25 tabular-nums">
                Score {isPrivacyMode ? "•••" : kitsuneScore.score}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {connectedBanks.length} instituições Open Finance • CDI {macroRates.annualCDIPct.toFixed(2)}% a.a.
            </p>
          </div>

          {/* Segmented View Switcher Estilo Wealthfolio */}
          <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-x-auto scrollbar-none">
            {DASHBOARD_TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? "bg-white dark:bg-[#18181B] text-zinc-900 dark:text-[#F4F4F5] shadow-xs border border-zinc-200/80 dark:border-[#27272A]"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões de Ação Superiores */}
        <div className="flex items-center gap-2 flex-wrap">
          {activePartner && (
            <button
              type="button"
              onClick={() => setIsFamilyModeEnabled(!isFamilyModeEnabled)}
              className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isFamilyModeEnabled
                  ? "bg-[#FF8216]/12 border-[#FF8216]/35 text-[#FF8216]"
                  : "bg-white dark:bg-[#121214] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#18181B]"
              }`}
              title="Alternar Visão Pessoal vs Espaço Compartilhado"
            >
              <WfIcons.Shared className="w-3.5 h-3.5" />
              <span>{isFamilyModeEnabled ? "Conjunto" : "Pessoal"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Busca Financeira Global (Ctrl+K)"
          >
            <WfIcons.Search className="w-3.5 h-3.5 text-[#FF8216]" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-400">
              ⌘K
            </kbd>
          </button>

          <a
            href="/api/export/spreadsheet"
            download
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 transition-colors"
            title="Exportar planilha consolidada CSV"
          >
            <WfIcons.Download className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">CSV</span>
          </a>

          <button
            type="button"
            onClick={() => revalidate(true)}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Sincronizar Open Finance agora"
          >
            <WfIcons.RefreshCw
              className={`w-3.5 h-3.5 text-emerald-500 ${isRevalidating ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConnectForMemberId(null);
              setIsConnectModalOpen(true);
            }}
            className="h-9 px-3.5 rounded-xl bg-[#FF8216] hover:bg-[#FF9438] text-black font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <WfIcons.Plus className="w-3.5 h-3.5" />
            <span>Conectar Conta</span>
          </button>
        </div>
      </header>

      {/* Barra Linear de Filtro por Instituição Bancária (e Membro quando modo familiar está ativo) */}
      {connectedBanks.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedBankSlug("all")}
            className={`h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
              selectedBankSlug === "all"
                ? "bg-[#FF8216]/15 border-[#FF8216]/40 text-[#FF8216]"
                : "bg-white dark:bg-[#121214] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <span>Todas ({connectedBanks.length})</span>
          </button>

          {connectedBanks.map((bank) => {
            const isSelected = selectedBankSlug === bank.slug;
            return (
              <button
                key={bank.slug}
                type="button"
                onClick={() => setSelectedBankSlug(isSelected ? "all" : bank.slug)}
                className={`h-8 pl-2 pr-3 rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#FF8216]/15 border-[#FF8216]/40 text-[#FF8216]"
                    : "bg-white dark:bg-[#121214] border-zinc-200 dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <BankLogo bank={bank.slug} size="xs" />
                <span>{bank.name}</span>
              </button>
            );
          })}

          {isFamilyModeEnabled && familyMembers.length > 0 && (
            <div className="flex items-center gap-1 pl-2 ml-1 border-l border-zinc-200 dark:border-[#27272A] shrink-0">
              <button
                type="button"
                onClick={() => setSelectedMemberId("all")}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer ${
                  selectedMemberId === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Todos Membros
              </button>
              <button
                type="button"
                onClick={() => setSelectedMemberId("personal")}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer ${
                  selectedMemberId === "personal"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {userFirstName}
              </button>
              {familyMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer ${
                    selectedMemberId === m.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          ABA 1: VISÃO GERAL (PADRÃO WEALTHFOLIO OVERVIEW)
      ======================================================================== */}
      {activeTab === "Visão Geral" && (
        <div className="space-y-6">
          {/* Alertas de Anomalia e Teto FGC */}
          <AnomalyAlertCard />

          {fgcWarning && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <WfIcons.ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-zinc-800 dark:text-zinc-200">
                  <strong>Atenção ao Teto do FGC:</strong> Emissor{" "}
                  <span className="font-semibold text-[#FF8216]">{fgcWarning.issuerName}</span>{" "}
                  acumula{" "}
                  <span className="font-mono tabular-nums font-semibold">
                    {formatCurrency(fgcWarning.total)}
                  </span>{" "}
                  ({formatCurrency(fgcWarning.excess)} acima da garantia ordinária de R$ 250 mil).
                </p>
              </div>
              <Link
                href="/investments"
                className="text-xs font-semibold text-[#FF8216] hover:underline shrink-0"
              >
                Ver Auditoria FGC →
              </Link>
            </div>
          )}

          {/* Hero Net Worth + Gráfico de Área Gradiente #FF8216 + Seletor 1M / 3M / 6M / 1Y / ALL */}
          <NetWorthHeroChart
            netWorth={totalBalance}
            liquidBalance={liquidBalance}
            investmentsBalance={investmentsBalance}
            vehiclesBalance={vehiclesBalance}
            realEstateBalance={realEstateBalance}
            fgtsBalance={fgtsBalance}
            liabilitiesBalance={creditCardBalance + loansBalance}
            transactions={filteredTransactions}
            hideValues={isPrivacyMode}
            onTogglePrivacy={togglePrivacyMode}
            scopeLabel={activeScopeLabel}
            annualCDIPct={macroRates.annualCDIPct}
          />

          {/* Grid Assimétrico 2 Colunas Fiel ao Wealthfolio (1.7fr Contas & Extrato | 1fr Metas, Carteira & IA) */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,1fr)] gap-6 items-start">
            {/* COLUNA ESQUERDA: Contas Agrupadas em Linhas Densas + Atividades Recentes */}
            <div className="space-y-6 min-w-0">
              <GroupedAccountsList
                accounts={filteredAccounts}
                investments={filteredInvestments}
                loans={filteredLoans}
                customAssets={customAssets}
                formatCurrency={formatCurrency}
                hideValues={isPrivacyMode}
                onConnectBank={() => {
                  setConnectForMemberId(null);
                  setIsConnectModalOpen(true);
                }}
                onAddAsset={() => {
                  setSelectedAssetToEdit(null);
                  setIsAssetModalOpen(true);
                }}
                onEditAsset={(asset) => {
                  setSelectedAssetToEdit(asset);
                  setIsAssetModalOpen(true);
                }}
                monthlyCDIFactor={macroRates.monthlyCDICompoundFactor}
              />

              {/* Atividades Recentes Conciliadas (Linhas densas sem cards soltos) */}
              <section className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden">
                <div className="px-4 md:px-5 py-3.5 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      Atividades Recentes Conciliadas
                    </h3>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      Entradas do mês:{" "}
                      <span className="font-mono tabular-nums text-emerald-500 font-medium">
                        {formatCurrency(monthlyIncome)}
                      </span>{" "}
                      • Saídas:{" "}
                      <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300 font-medium">
                        {formatCurrency(monthlyExpense)}
                      </span>
                    </p>
                  </div>
                  <Link
                    href="/transactions"
                    className="text-xs font-medium text-[#FF8216] hover:underline flex items-center gap-1 shrink-0"
                  >
                    <span>Ver extrato</span>
                    <WfIcons.ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentConciliatedTxns.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    Nenhuma movimentação recente encontrada para o filtro selecionado.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-[#27272A]/70">
                    {recentConciliatedTxns.map((tx) => {
                      const amt = Number(tx.amount) || 0;
                      const isCreditCard =
                        tx.bank_accounts?.type === "CREDIT" ||
                        tx.bank_accounts?.subtype === "CREDIT_CARD" ||
                        tx.operation_type === "CREDIT_CARD";
                      const isExpense = amt < 0 || tx.type === "DEBIT" || isCreditCard;
                      const absAmt = Math.abs(amt);
                      const title =
                        tx.clean_description || tx.description || "Movimentação Bancária";
                      const category = tx.category_pt || tx.category || "Geral";
                      const bankName =
                        tx.bank_accounts?.institution_name ||
                        tx.bank_accounts?.bank_name ||
                        "Conta";

                      return (
                        <div
                          key={tx.id}
                          className="px-4 md:px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <MerchantLogo
                              cleanName={tx.clean_description}
                              rawDescription={tx.description}
                              category={category}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                                {title}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                {category} • {bankName} • {formatDate(tx.executed_at || tx.date)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-mono font-semibold tabular-nums ${
                                tx.is_refund || !isExpense
                                  ? "text-emerald-500"
                                  : "text-zinc-900 dark:text-[#F4F4F5]"
                              }`}
                            >
                              {isPrivacyMode
                                ? "R$ ••••••"
                                : `${tx.is_refund || !isExpense ? "+" : "-"}${formatCurrency(absAmt)}`}
                            </span>
                            {tx.total_installments && Number(tx.total_installments) > 1 && (
                              <span className="block text-[10px] font-mono tabular-nums text-[#FF8216]">
                                {tx.installment_number || 1}/{tx.total_installments}x
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* COLUNA DIREITA: Metas (SavingGoals), Destaques da Carteira & Diagnóstico Kitsune AI */}
            <div className="space-y-6 min-w-0">
              {/* Card Estilo SavingGoals do Wealthfolio */}
              <section className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WfIcons.Goals className="w-4 h-4 text-[#FF8216]" />
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      Metas & Reserva
                    </h3>
                  </div>
                  <Link
                    href="/goals"
                    className="text-xs font-medium text-[#FF8216] hover:underline"
                  >
                    Gerenciar →
                  </Link>
                </div>

                <div className="space-y-3.5">
                  {/* Meta 1: Reserva de Liquidez (6 meses) */}
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Reserva de Emergência (6m)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#FF8216]">
                        {isPrivacyMode ? "••%" : `${goalsSummary.emergencyPct}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-[#27272A] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF8216] transition-all duration-500"
                        style={{ width: `${goalsSummary.emergencyPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono tabular-nums">
                      <span>
                        {isPrivacyMode ? "•• meses" : `${goalsSummary.emergencyMonths} meses`}
                      </span>
                      <span>Alvo: {formatCurrency(goalsSummary.emergencyTarget)}</span>
                    </div>
                  </div>

                  {/* Meta 2: Cobertura FIRE (Renda Passiva CDI vs Custo Mensal) */}
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Cobertura Passiva CDI (FIRE)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-500">
                        {isPrivacyMode ? "••%" : `${goalsSummary.fireCoveragePct}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-[#27272A] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${goalsSummary.fireCoveragePct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono tabular-nums">
                      <span>+{formatCurrency(goalsSummary.projectedMonthlyYield)}/mês</span>
                      <span>Custo: {formatCurrency(goalsSummary.monthlyCost)}</span>
                    </div>
                  </div>

                  {/* Meta Principal do Perfil */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 truncate pr-2">
                      Foco: <strong className="text-zinc-800 dark:text-zinc-200">{goalsSummary.goalLabel}</strong>
                    </span>
                    <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-300 shrink-0">
                      {isPrivacyMode ? "••%" : `${goalsSummary.primaryProgress}%`}
                    </span>
                  </div>
                </div>
              </section>

              {/* Card Destaques de Holdings & Insights */}
              <section className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WfIcons.Holdings className="w-4 h-4 text-[#FF8216]" />
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      Maiores Posições
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Link href="/insights" className="text-zinc-500 hover:text-zinc-200">
                      Insights
                    </Link>
                    <Link href="/investments" className="font-medium text-[#FF8216] hover:underline">
                      Holdings →
                    </Link>
                  </div>
                </div>

                {topHoldings.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3">
                    Nenhum ativo de investimento sincronizado ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-[#27272A]/70">
                    {topHoldings.map((item) => (
                      <div
                        key={item.id}
                        className="py-2 flex items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BankLogo bank={item.slug} size="xs" />
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-[#F4F4F5] truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {item.institution}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          <p className="font-semibold text-zinc-900 dark:text-[#F4F4F5]">
                            {formatCurrency(item.balance)}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {isPrivacyMode ? "••%" : `${item.weightPct.toFixed(1)}%`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Diagnóstico Executivo Kitsune AI + Camada Determinística MSLR */}
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
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          ABA 2: FLUXO & GASTOS (RITMO DIÁRIO, SANKEY, CATEGORIAS E HEATMAP)
      ======================================================================== */}
      {activeTab === "Fluxo & Gastos" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A]">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 px-2">
              Janela de Fluxo de Caixa:
            </span>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A]">
              {(
                [
                  { id: "day", label: "7 Dias" },
                  { id: "week", label: "14 Dias" },
                  { id: "month", label: "Mês Atual" },
                  { id: "year", label: "Ano Atual" },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTimeGranularity(g.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    timeGranularity === g.id
                      ? "bg-[#FF8216] text-black font-semibold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendingCurveChart
              currentMonthDays={spendingCurveData.currentMonthDays}
              previousMonthDays={spendingCurveData.previousMonthDays}
              currentDay={spendingCurveData.currentDay}
              totalCurrentMonth={spendingCurveData.totalCurrentMonth}
              totalPreviousMonth={spendingCurveData.totalPreviousMonth}
              hideValues={isPrivacyMode}
            />
            <SpendingHeatmap
              transactions={filteredTransactions}
              formatCurrency={formatCurrency}
            />
          </div>

          <CashFlowSankey
            transactions={periodFilteredTransactions}
            isPrivacyMode={isPrivacyMode}
            selfAndFamilyNames={selfAndFamilyNames}
            periodLabel={
              timeGranularity === "day"
                ? "Últimos 7 dias"
                : timeGranularity === "week"
                ? "Últimos 14 dias"
                : timeGranularity === "year"
                ? "Ano Atual"
                : "Mês Atual"
            }
          />

          <CategoriesView
            transactions={filteredTransactions}
            formatCurrency={formatCurrency}
            timeGranularity={timeGranularity}
          />
        </div>
      )}

      {/* ========================================================================
          ABA 3: TRANSAÇÕES (TABELA DENSA WEALTHFOLIO + LISTA EMPILHADA MOBILE)
      ======================================================================== */}
      {activeTab === "Transações" && (
        <PaginatedTransactionsView
          transactions={filteredTransactions}
          accounts={filteredAccounts}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

      {/* ========================================================================
          ABA 4: PARCELAS & ASSINATURAS
      ======================================================================== */}
      {activeTab === "Parcelas & Assinaturas" && (
        <div className="space-y-6">
          <InstallmentsTracker
            transactions={filteredTransactions}
            formatCurrency={formatCurrency}
          />
          <SubscriptionsTracker
            transactions={filteredTransactions}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {/* Modais Globais Preservados */}
      <PluggyConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        familyMembers={familyMembers}
        initialMemberId={connectForMemberId}
        onMemberCreated={(member) => addFamilyMemberLocal(member)}
        onConnectionSuccess={() => {
          setIsConnectModalOpen(false);
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

      {/* Modal de Gestão de Ativos Físicos (Veículos FIPE, Terrenos/Imóveis, FGTS) */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => {
          setIsAssetModalOpen(false);
          setSelectedAssetToEdit(null);
        }}
        assetToEdit={selectedAssetToEdit}
      />
    </div>
  );
}
