"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  comparePayoffStrategies,
  evaluateInstallmentAdvance,
  getRegressiveIRRate,
  truncateDecimal,
  type DebtInput,
} from "@/utils/finance/engine";
import {
  fetchLiveMacroRates,
  formatPercentPtBr,
  getCachedOrFallbackMacroRates,
  type LiveMacroRatesSnapshot,
} from "@/utils/finance/macro-rates";
import { getCardInvoiceAmount } from "@/components/finance/WalletCards";

export interface SimulatorAccountItem {
  id: string;
  bank_name?: string | null;
  institution_name?: string | null;
  institution_slug?: string | null;
  product_name?: string | null;
  type?: string | null;
  subtype?: string | null;
  balance?: number | string | null;
  credit_limit?: number | string | null;
  minimum_payment?: number | string | null;
  card_brand?: string | null;
}

export interface SimulatorLoanItem {
  id?: string;
  product_name?: string | null;
  type?: string | null;
  institution_name?: string | null;
  contracted_amount?: number | string | null;
  outstanding_balance?: number | string | null;
  balance_due?: number | string | null;
  paid_installments?: number | null;
  total_installments?: number | null;
  installment_amount?: number | string | null;
  interest_rate?: number | string | null;
}

export interface SimulatorTransactionItem {
  id?: string;
  account_id?: string | null;
  description?: string | null;
  clean_description?: string | null;
  amount: number | string;
  date?: string | null;
  executed_at?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  is_refund?: boolean;
  is_internal_transfer?: boolean;
}

interface DetectedInstallmentPlan {
  key: string;
  description: string;
  institutionName: string;
  installmentAmount: number;
  currentInstallment: number;
  totalInstallments: number;
  remainingInstallments: number;
  dateStr: string;
}

interface EditableDebtLine extends DebtInput {
  source: "card" | "loan" | "custom";
}

export interface DebtAndAdvanceSimulatorProps {
  accounts: SimulatorAccountItem[];
  loans?: SimulatorLoanItem[];
  transactions: SimulatorTransactionItem[];
  formatCurrency: (val: number) => string;
  isPrivacyMode?: boolean;
}

function annualToMonthlyCompoundPct(annualPct: number): number {
  if (!Number.isFinite(annualPct) || annualPct <= 0) return 0;
  const monthly = (Math.pow(1 + annualPct / 100, 1 / 12) - 1) * 100;
  return truncateDecimal(monthly, 2);
}

export function DebtAndAdvanceSimulator({
  accounts,
  loans = [],
  transactions,
  formatCurrency,
  isPrivacyMode = false,
}: DebtAndAdvanceSimulatorProps) {
  const [activeTab, setActiveTab] = useState<"payoff" | "advance">("payoff");
  const [macroRates, setMacroRates] = useState<LiveMacroRatesSnapshot>(() =>
    getCachedOrFallbackMacroRates()
  );

  useEffect(() => {
    let mounted = true;
    fetchLiveMacroRates().then((live) => {
      if (mounted) {
        setMacroRates(live);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================================
  // 1. EXTRAÇÃO AUTOMÁTICA DE DÍVIDAS REAIS (CARTÕES + EMPRÉSTIMOS)
  // =========================================================================
  const detectedRealDebts = useMemo<EditableDebtLine[]>(() => {
    const items: EditableDebtLine[] = [];

    const creditCards = accounts.filter(
      (acc) =>
        acc.type === "CREDIT" ||
        acc.subtype === "CREDIT_CARD" ||
        Number(acc.credit_limit) > 0 ||
        Boolean(acc.card_brand)
    );

    for (const card of creditCards) {
      const invoiceBal = getCardInvoiceAmount(card as any, transactions as any[]);
      if (invoiceBal > 1) {
        const minPayRaw = Number(card.minimum_payment) || 0;
        const minPay =
          minPayRaw > 0 && minPayRaw < invoiceBal
            ? truncateDecimal(minPayRaw, 2)
            : truncateDecimal(Math.max(25, invoiceBal * 0.15), 2);
        const bankLabel = card.institution_name || card.bank_name || "Cartão";
        const prodLabel = card.product_name || "Fatura Rotativa / Parcelada";

        items.push({
          id: `card-${card.id}`,
          name: `${bankLabel} • ${prodLabel}`,
          balance: truncateDecimal(invoiceBal, 2),
          // Taxa média de parcelamento/rotativo de cartão no Brasil caso levada adiante (~11,9% a.m.)
          monthlyCetPct: 11.9,
          minimumPayment: Math.min(invoiceBal, minPay),
          source: "card",
        });
      }
    }

    for (let idx = 0; idx < loans.length; idx++) {
      const loan = loans[idx];
      const outBal = Number(loan.outstanding_balance ?? loan.balance_due) || 0;
      if (outBal <= 1) continue;

      const rawRate = Number(loan.interest_rate) || 0;
      // Na Pluggy `interest_rate` pode vir em % anual (ex: 28.5) ou mensal (ex: 2.19)
      const monthlyCetPct =
        rawRate > 18
          ? annualToMonthlyCompoundPct(rawRate)
          : rawRate > 0
          ? truncateDecimal(rawRate, 2)
          : 2.45;

      const remainingCount = Math.max(
        1,
        (Number(loan.total_installments) || 12) - (Number(loan.paid_installments) || 0)
      );
      const explicitPmt = Number(loan.installment_amount) || 0;
      const estimatedPmt =
        explicitPmt > 0
          ? explicitPmt
          : truncateDecimal(
              (outBal * (monthlyCetPct / 100)) /
                (1 - Math.pow(1 + monthlyCetPct / 100, -remainingCount)) ||
                outBal / remainingCount,
              2
            );

      items.push({
        id: loan.id || `loan-${idx}`,
        name: `${loan.institution_name || "Banco"} • ${loan.product_name || "Empréstimo"}`,
        balance: truncateDecimal(outBal, 2),
        monthlyCetPct,
        minimumPayment: Math.min(outBal, Math.max(25, estimatedPmt)),
        source: "loan",
      });
    }

    return items;
  }, [accounts, loans, transactions]);

  const [customDebts, setCustomDebts] = useState<EditableDebtLine[]>([]);
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});
  const [excludedRealIds, setExcludedRealIds] = useState<Record<string, boolean>>({});
  const [extraMonthlyBudget, setExtraMonthlyBudget] = useState<number>(500);

  // Formulário para adicionar linha de simulação customizada
  const [newDebtName, setNewDebtName] = useState<string>("");
  const [newDebtBalance, setNewDebtBalance] = useState<string>("2400");
  const [newDebtCetMonthly, setNewDebtCetMonthly] = useState<string>("9.8");
  const [newDebtMinPayment, setNewDebtMinPayment] = useState<string>("320");

  const activeDebtsForEngine = useMemo<EditableDebtLine[]>(() => {
    const realIncluded = detectedRealDebts
      .filter((d) => !excludedRealIds[d.id])
      .map((d) => ({
        ...d,
        monthlyCetPct:
          rateOverrides[d.id] !== undefined ? rateOverrides[d.id] : d.monthlyCetPct,
      }));
    return [...realIncluded, ...customDebts];
  }, [detectedRealDebts, excludedRealIds, rateOverrides, customDebts]);

  const strategyComparison = useMemo(() => {
    if (activeDebtsForEngine.length === 0) return null;
    return comparePayoffStrategies(activeDebtsForEngine, extraMonthlyBudget);
  }, [activeDebtsForEngine, extraMonthlyBudget]);

  const handleAddCustomDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = Math.max(10, Number(newDebtBalance.replace(",", ".")) || 0);
    const cet = Math.max(0, Number(newDebtCetMonthly.replace(",", ".")) || 0);
    const minP = Math.max(10, Math.min(bal, Number(newDebtMinPayment.replace(",", ".")) || bal * 0.1));
    const cleanName = newDebtName.trim() || `Simulação #${customDebts.length + 1}`;

    setCustomDebts((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: cleanName,
        balance: truncateDecimal(bal, 2),
        monthlyCetPct: truncateDecimal(cet, 2),
        minimumPayment: truncateDecimal(minP, 2),
        source: "custom",
      },
    ]);
    setNewDebtName("");
  };

  const handleLoadInteractivePreset = () => {
    setCustomDebts([
      {
        id: "sim-preset-1",
        name: "Cartão Parcelado c/ Juros (Simulação)",
        balance: 3200,
        monthlyCetPct: 12.4,
        minimumPayment: 420,
        source: "custom",
      },
      {
        id: "sim-preset-2",
        name: "Crédito Pessoal (Simulação)",
        balance: 7800,
        monthlyCetPct: 3.9,
        minimumPayment: 510,
        source: "custom",
      },
      {
        id: "sim-preset-3",
        name: "Saldo Menor Loja (Simulação)",
        balance: 950,
        monthlyCetPct: 6.5,
        minimumPayment: 190,
        source: "custom",
      },
    ]);
  };

  // =========================================================================
  // 2. COMPRAS PARCELADAS ATIVAS NOS CARTÕES (ANTECIPAÇÃO VS CDI)
  // =========================================================================
  const detectedInstallmentPlans = useMemo<DetectedInstallmentPlan[]>(() => {
    const accountNameById = new Map<string, string>();
    for (const acc of accounts) {
      accountNameById.set(
        acc.id,
        acc.institution_name || acc.bank_name || acc.product_name || "Cartão"
      );
    }

    const planMap = new Map<string, DetectedInstallmentPlan>();

    for (const tx of transactions) {
      if (tx.is_refund || tx.is_internal_transfer) continue;
      const totalInst = Number(tx.total_installments) || 0;
      const currInst = Number(tx.installment_number) || 0;
      if (totalInst <= 1 || currInst <= 0 || currInst >= totalInst) continue;

      const amt = Math.abs(Number(tx.amount) || 0);
      if (amt <= 1) continue;

      const rawTitle = (tx.clean_description || tx.description || "Compra Parcelada")
        .replace(/\s*\d{1,2}\/\d{1,2}\b/g, "")
        .trim();
      const dedupeKey = `${tx.account_id || "card"}::${rawTitle.toLowerCase()}::${totalInst}`;
      const dateStr = String(tx.date || tx.executed_at || "");

      const existing = planMap.get(dedupeKey);
      if (!existing || currInst > existing.currentInstallment) {
        planMap.set(dedupeKey, {
          key: dedupeKey,
          description: rawTitle || "Compra Parcelada",
          institutionName: tx.account_id
            ? accountNameById.get(tx.account_id) || "Cartão"
            : "Cartão",
          installmentAmount: truncateDecimal(amt, 2),
          currentInstallment: currInst,
          totalInstallments: totalInst,
          remainingInstallments: totalInst - currInst,
          dateStr,
        });
      }
    }

    return Array.from(planMap.values()).sort(
      (a, b) =>
        b.installmentAmount * b.remainingInstallments -
        a.installmentAmount * a.remainingInstallments
    );
  }, [accounts, transactions]);

  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("manual");
  const [advInstallmentAmount, setAdvInstallmentAmount] = useState<number>(350);
  const [advRemainingInstallments, setAdvRemainingInstallments] = useState<number>(8);
  const [advBankAnnualDiscountPct, setAdvBankAnnualDiscountPct] = useState<number>(9.8);

  // Seleciona automaticamente a maior compra parcelada ativa na 1ª carga, se existir
  useEffect(() => {
    if (detectedInstallmentPlans.length > 0 && selectedPlanKey === "manual") {
      const top = detectedInstallmentPlans[0];
      setSelectedPlanKey(top.key);
      setAdvInstallmentAmount(top.installmentAmount);
      setAdvRemainingInstallments(top.remainingInstallments);
    }
  }, [detectedInstallmentPlans, selectedPlanKey]);

  const handleSelectInstallmentPlan = (key: string) => {
    setSelectedPlanKey(key);
    const found = detectedInstallmentPlans.find((p) => p.key === key);
    if (found) {
      setAdvInstallmentAmount(found.installmentAmount);
      setAdvRemainingInstallments(found.remainingInstallments);
    }
  };

  const advanceEvaluation = useMemo(() => {
    const result = evaluateInstallmentAdvance({
      installmentAmount: advInstallmentAmount,
      remainingInstallments: advRemainingInstallments,
      annualDiscountRatePct: advBankAnnualDiscountPct,
      currentSelicOrCDIPct: macroRates.annualCDIPct,
    });

    const avgMonths = (advRemainingInstallments + 1) / 2;
    const estCalendarDays = Math.round(avgMonths * 30.4375);
    const irRatePct = truncateDecimal(getRegressiveIRRate(estCalendarDays) * 100, 1);

    return {
      ...result,
      estCalendarDays,
      irRatePct,
    };
  }, [
    advInstallmentAmount,
    advRemainingInstallments,
    advBankAnnualDiscountPct,
    macroRates.annualCDIPct,
  ]);

  const kenjiPayoffPrompt = useMemo(() => {
    if (!strategyComparison) {
      return "Agente Kenji, analise meus cartões de crédito e empréstimos e monte uma estratégia preventiva para blindar meu fluxo de caixa contra juros rotativos.";
    }
    return `Agente Kenji, simulei a quitação de ${activeDebtsForEngine.length} passivo(s) com aporte extra mensal de ${formatCurrency(
      extraMonthlyBudget
    )}. A estratégia Avalanche quita tudo em ${strategyComparison.avalanche.totalMonths} meses economizando ${formatCurrency(
      strategyComparison.interestSavedByAvalanche
    )} em juros frente à Bola de Neve (que elimina a 1ª dívida no mês ${
      strategyComparison.firstDebtClearedMonthSnowball
    }). Monte meu cronograma tático mês a mês com Snowball Rollover.`;
  }, [strategyComparison, activeDebtsForEngine.length, extraMonthlyBudget, formatCurrency]);

  const kenjiAdvancePrompt = useMemo(() => {
    return `Agente Kenji, avaliei antecipar ${advRemainingInstallments} parcelas de ${formatCurrency(
      advInstallmentAmount
    )} com desconto anual de ${formatPercentPtBr(
      advBankAnnualDiscountPct
    )} no app do banco vs manter no CDB 100% CDI (${formatPercentPtBr(
      macroRates.annualCDIPct
    )} a.a., IR regressivo de ${advanceEvaluation.irRatePct}%). O motor apontou que ${
      advanceEvaluation.isWorthAdvancing
        ? "vale a pena antecipar"
        : "é melhor manter investido no CDI"
    } com vantagem líquida de ${formatCurrency(
      advanceEvaluation.netFinancialAdvantage
    )}. Valide como encaixar essa decisão sem comprometer minha reserva de liquidez.`;
  }, [
    advRemainingInstallments,
    advInstallmentAmount,
    advBankAnnualDiscountPct,
    macroRates.annualCDIPct,
    advanceEvaluation,
    formatCurrency,
  ]);

  return (
    <section className="rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] p-5 md:p-6 flex flex-col gap-6 shadow-xs">
      {/* Cabeçalho + Seletor de Abas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#27272A]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/25 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">calculate</span>
            </span>
            <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Motor Tático de Quitação & Antecipação vs. CDI
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#18181B] text-emerald-400 border border-[#27272A] tabular-nums">
              CDI BCB Ao Vivo: {formatPercentPtBr(macroRates.annualCDIPct)} a.a.
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Simulações 100% determinísticas com Snowball Rollover exato e desconto composto líquido de IR regressivo.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("payoff")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "payoff"
                ? "bg-[#FF8216] text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">stacked_line_chart</span>
            <span>Avalanche vs. Bola de Neve</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("advance")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "advance"
                ? "bg-[#FF8216] text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">percent</span>
            <span>Antecipar Parcelas vs. CDI</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          ABA 1: SIMULADOR BOLA DE NEVE VS. AVALANCHE (COM ROLLOVER VISUAL)
         ===================================================================== */}
      {activeTab === "payoff" && (
        <div className="flex flex-col gap-6">
          {/* Controle de Aporte Extra Mensal */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                  Aporte Extra Mensal para Quitação Acelerada
                </span>
                <span className="text-[11px] text-zinc-400">
                  Todo valor liberado de uma dívida quitada é automaticamente incorporado à próxima (Snowball Rollover).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-semibold">Extra/mês:</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={50}
                  value={extraMonthlyBudget}
                  onChange={(e) =>
                    setExtraMonthlyBudget(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-28 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-xs font-mono font-black text-[#FF8216] focus:outline-none focus:border-[#FF8216]"
                />
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={10000}
              step={50}
              value={Math.min(10000, extraMonthlyBudget)}
              onChange={(e) => setExtraMonthlyBudget(Number(e.target.value))}
              className="w-full accent-[#FF8216] cursor-pointer"
            />

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[0, 200, 500, 1000, 2500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExtraMonthlyBudget(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      extraMonthlyBudget === preset
                        ? "bg-[#FF8216] text-white"
                        : "bg-white dark:bg-[#121214] text-zinc-400 border border-slate-200 dark:border-[#27272A] hover:text-white"
                    }`}
                  >
                    +{formatCurrency(preset)}
                  </button>
                ))}
              </div>

              <Link
                href={`/kitsune?prompt=${encodeURIComponent(kenjiPayoffPrompt)}`}
                className="px-3.5 py-1.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">shield</span>
                <span>Estratégia Detalhada com Kenji</span>
              </Link>
            </div>
          </div>

          {/* Lista de Passivos Ativos Carregados + Adição de Simulação */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Passivos Analisados ({activeDebtsForEngine.length})
              </span>
              {activeDebtsForEngine.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadInteractivePreset}
                  className="px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[#FF8216] text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">science</span>
                  <span>Carregar Cenário Exemplo Interativo</span>
                </button>
              )}
            </div>

            {activeDebtsForEngine.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-dashed border-slate-300 dark:border-[#27272A] text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-emerald-500">
                  verified
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Parabéns! Você não possui dívidas rotativas ou empréstimos pendentes sincronizados.
                </p>
                <p className="text-[11px] text-zinc-400 max-w-lg">
                  Adicione linhas abaixo ou clique em &ldquo;Carregar Cenário Exemplo Interativo&rdquo; para simular o efeito matemático Avalanche vs. Bola de Neve com Snowball Rollover.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {activeDebtsForEngine.map((debt) => (
                  <div
                    key={debt.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {debt.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#121214] text-zinc-400 border border-[#27272A]">
                          {debt.source === "card"
                            ? "Cartão"
                            : debt.source === "loan"
                            ? "Contrato"
                            : "Simulação"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 flex-wrap">
                        <span>
                          Saldo:{" "}
                          <strong className="text-white tabular-nums">
                            {formatCurrency(debt.balance)}
                          </strong>
                        </span>
                        <span>
                          Mínimo:{" "}
                          <strong className="text-zinc-300 tabular-nums">
                            {formatCurrency(debt.minimumPayment)}/mês
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end">
                        <label className="text-[9px] text-zinc-400 uppercase font-bold">
                          CET Mensal (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          step={0.1}
                          value={debt.monthlyCetPct}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            if (debt.source === "custom") {
                              setCustomDebts((prev) =>
                                prev.map((c) =>
                                  c.id === debt.id ? { ...c, monthlyCetPct: val } : c
                                )
                              );
                            } else {
                              setRateOverrides((prev) => ({ ...prev, [debt.id]: val }));
                            }
                          }}
                          className="w-16 px-2 py-1 rounded bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-right text-xs font-mono font-bold text-[#FF8216]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (debt.source === "custom") {
                            setCustomDebts((prev) => prev.filter((c) => c.id !== debt.id));
                          } else {
                            setExcludedRealIds((prev) => ({ ...prev, [debt.id]: true }));
                          }
                        }}
                        title="Remover da simulação"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mini-Form para Adicionar Linha de Simulação */}
            <form
              onSubmit={handleAddCustomDebt}
              className="p-3 rounded-xl bg-slate-50/70 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
            >
              <div className="sm:col-span-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Simular Nova Dívida
                </label>
                <input
                  type="text"
                  placeholder="Ex: Rotativo / Empréstimo"
                  value={newDebtName}
                  onChange={(e) => setNewDebtName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Saldo (R$)
                </label>
                <input
                  type="number"
                  min={10}
                  step="50"
                  value={newDebtBalance}
                  onChange={(e) => setNewDebtBalance(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  CET (% a.m.)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step="0.1"
                  value={newDebtCetMonthly}
                  onChange={(e) => setNewDebtCetMonthly(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-3 flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    min={10}
                    step="10"
                    value={newDebtMinPayment}
                    onChange={(e) => setNewDebtMinPayment(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="h-[30px] px-3 rounded-lg bg-[#18181B] hover:bg-[#FF8216] text-white border border-[#27272A] text-xs font-bold transition-colors cursor-pointer shrink-0 mt-4"
                >
                  + Incluir
                </button>
              </div>
            </form>
          </div>

          {/* Comparativo Lado a Lado em Tempo Real: Avalanche vs Bola de Neve */}
          {strategyComparison && (
            <div className="flex flex-col gap-4">
              {/* Banner Resumo de Economia */}
              <div className="p-4 rounded-xl bg-[#18181B] border border-[#FF8216]/35 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="material-symbols-outlined text-[#FF8216] text-2xl">
                    emoji_events
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216] block">
                      Veredito Matemático de Amortização (Rollover Ativo)
                    </span>
                    <p className="text-xs text-zinc-200 mt-0.5 leading-relaxed">
                      {isPrivacyMode
                        ? "Modo Privacidade ativo: valores monetários mascarados na recomendação."
                        : strategyComparison.recommendationPtBr}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 md:border-l border-[#27272A] pt-3 md:pt-0 md:pl-4">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase block">
                      Juros Poupados (Avalanche)
                    </span>
                    <span className="text-base font-black text-emerald-400 tabular-nums">
                      {formatCurrency(strategyComparison.interestSavedByAvalanche)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase block">
                      Prazo Economizado
                    </span>
                    <span className="text-base font-black text-[#FF8216] tabular-nums">
                      {strategyComparison.monthsSavedByAvalanche} meses
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Card Estratégia Avalanche */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-emerald-500/35 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                        Ótimo Matemático • Menor Juro Total
                      </span>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Estratégia Avalanche (Maior CET Primeiro)
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tabular-nums">
                      {strategyComparison.avalanche.totalMonths} meses
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                      <span className="text-[10px] text-zinc-400 block">Total Juros</span>
                      <span className="font-black text-emerald-400 tabular-nums">
                        {formatCurrency(strategyComparison.avalanche.totalInterestPaid)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                      <span className="text-[10px] text-zinc-400 block">Total Pago</span>
                      <span className="font-black text-white tabular-nums">
                        {formatCurrency(strategyComparison.avalanche.totalPaid)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                      <span className="text-[10px] text-zinc-400 block">1ª Quitação</span>
                      <span className="font-black text-zinc-200 tabular-nums">
                        Mês {strategyComparison.firstDebtClearedMonthAvalanche}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Ordem de Ataque & Rollover (Avalanche)
                    </span>
                    {strategyComparison.avalanche.debtCompletionRecords.map((rec, i) => (
                      <div
                        key={`av-${rec.debtId}-${i}`}
                        className="px-3 py-2 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-zinc-200 truncate">
                          {i + 1}º • {rec.debtName}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0 ml-2">
                          Quitada no Mês {rec.clearedMonth} ↻
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Estratégia Bola de Neve */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-[#FF8216]/35 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216] block">
                        Vitória Comportamental • Tração Rápida
                      </span>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Estratégia Bola de Neve (Menor Saldo Primeiro)
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-[#FF8216]/15 text-[#FF8216] border border-[#FF8216]/30 tabular-nums">
                      {strategyComparison.snowball.totalMonths} meses
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                      <span className="text-[10px] text-zinc-400 block">Total Juros</span>
                      <span className="font-black text-amber-400 tabular-nums">
                        {formatCurrency(strategyComparison.snowball.totalInterestPaid)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                      <span className="text-[10px] text-zinc-400 block">Total Pago</span>
                      <span className="font-black text-white tabular-nums">
                        {formatCurrency(strategyComparison.snowball.totalPaid)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A]">
                      <span className="text-[10px] text-zinc-400 block">1ª Quitação</span>
                      <span className="font-black text-[#FF8216] tabular-nums">
                        Mês {strategyComparison.firstDebtClearedMonthSnowball}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Ordem de Ataque & Snowball Rollover
                    </span>
                    {strategyComparison.snowball.debtCompletionRecords.map((rec, i) => (
                      <div
                        key={`sb-${rec.debtId}-${i}`}
                        className="px-3 py-2 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-zinc-200 truncate">
                          {i + 1}º • {rec.debtName}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[#FF8216] shrink-0 ml-2">
                          Quitada no Mês {rec.clearedMonth} ↻
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA 2: CALCULADORA DE ANTECIPAÇÃO DE PARCELAS VS. DEIXAR NO CDI
         ===================================================================== */}
      {activeTab === "advance" && (
        <div className="flex flex-col gap-6">
          {/* Seletor de Compras Parceladas Detectadas nos Cartões */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Compras Parceladas Ativas nos Seus Cartões ({detectedInstallmentPlans.length})
              </span>
              <span className="text-[11px] text-zinc-400">
                Selecione uma compra real ou simule qualquer valor abaixo
              </span>
            </div>

            {detectedInstallmentPlans.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {detectedInstallmentPlans.slice(0, 8).map((plan) => {
                  const active = selectedPlanKey === plan.key;
                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => handleSelectInstallmentPlan(plan.key)}
                      className={`p-3 rounded-xl border text-left transition-all shrink-0 min-w-[210px] cursor-pointer ${
                        active
                          ? "bg-[#FF8216]/15 border-[#FF8216] text-white"
                          : "bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#27272A] text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-[#FF8216] uppercase block truncate">
                        {plan.institutionName} • Restam {plan.remainingInstallments}x
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white block truncate mt-0.5">
                        {plan.description}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono block mt-1">
                        {formatCurrency(plan.installmentAmount)}/mês ({plan.currentInstallment}/
                        {plan.totalInstallments})
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] text-xs text-zinc-400">
                Nenhuma compra parcelada em andamento detectada nas faturas recentes — digite os valores abaixo para testar qualquer oferta de desconto do seu banco (ex: Nubank, Inter, Itaú).
              </div>
            )}
          </div>

          {/* Inputs da Calculadora de Antecipação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>Valor de Cada Parcela (R$)</span>
                <span className="text-[#FF8216] font-mono">
                  {formatCurrency(advInstallmentAmount)}
                </span>
              </label>
              <input
                type="number"
                min={10}
                max={100000}
                step={10}
                value={advInstallmentAmount}
                onChange={(e) => {
                  setSelectedPlanKey("manual");
                  setAdvInstallmentAmount(Math.max(1, Number(e.target.value) || 0));
                }}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] text-xs font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>Parcelas Restantes</span>
                <span className="text-[#FF8216] font-mono">{advRemainingInstallments}x</span>
              </label>
              <input
                type="range"
                min={1}
                max={36}
                step={1}
                value={advRemainingInstallments}
                onChange={(e) => {
                  setSelectedPlanKey("manual");
                  setAdvRemainingInstallments(Number(e.target.value));
                }}
                className="w-full accent-[#FF8216] cursor-pointer mt-2"
              />
              <span className="text-[10px] text-zinc-400">
                Prazo médio ponderado: ~{advanceEvaluation.estCalendarDays} dias (IR{" "}
                {advanceEvaluation.irRatePct}%)
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>Desconto Anual no App (%)</span>
                <span className="text-emerald-400 font-mono">
                  {formatPercentPtBr(advBankAnnualDiscountPct)} a.a.
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={25}
                step={0.1}
                value={advBankAnnualDiscountPct}
                onChange={(e) => setAdvBankAnnualDiscountPct(Number(e.target.value))}
                className="w-full accent-[#FF8216] cursor-pointer mt-2"
              />
              <span className="text-[10px] text-zinc-400">
                Comparado contra 100% CDI ({formatPercentPtBr(macroRates.annualCDIPct)} a.a.)
              </span>
            </div>
          </div>

          {/* Veredito Matemático Claro */}
          <div
            className={`p-5 rounded-2xl border flex flex-col gap-4 ${
              advanceEvaluation.isWorthAdvancing
                ? "bg-emerald-500/10 border-emerald-500/35"
                : "bg-[#18181B] border-[#FF8216]/40"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                    advanceEvaluation.isWorthAdvancing
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      : "bg-[#FF8216]/15 border-[#FF8216]/35 text-[#FF8216]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {advanceEvaluation.isWorthAdvancing ? "bolt" : "savings"}
                  </span>
                </div>
                <div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest block ${
                      advanceEvaluation.isWorthAdvancing
                        ? "text-emerald-400"
                        : "text-[#FF8216]"
                    }`}
                  >
                    Veredito Auditado (Desconto Composto vs. CDI Líquido de IR)
                  </span>
                  <h3 className="text-sm md:text-base font-black text-white mt-0.5">
                    {advanceEvaluation.isWorthAdvancing
                      ? "VALE A PENA ANTECIPAR AS PARCELAS NO APP"
                      : "MELHOR MANTER APLICADO NO CDB 100% CDI"}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase block">
                    Ganho Líquido da Escolha
                  </span>
                  <span
                    className={`text-lg font-black tabular-nums ${
                      advanceEvaluation.isWorthAdvancing
                        ? "text-emerald-400"
                        : "text-[#FF8216]"
                    }`}
                  >
                    + {formatCurrency(advanceEvaluation.netFinancialAdvantage)}
                  </span>
                </div>

                <Link
                  href={`/kitsune?prompt=${encodeURIComponent(kenjiAdvancePrompt)}`}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  <span>Validar com Kenji</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
                <span className="text-[10px] text-zinc-400 uppercase block">
                  Total Nominal Sem Desconto
                </span>
                <span className="text-sm font-black text-zinc-200 tabular-nums mt-0.5 block">
                  {formatCurrency(advanceEvaluation.totalNominalDebt)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
                <span className="text-[10px] text-zinc-400 uppercase block">
                  Valor p/ Quitar Hoje no App
                </span>
                <span className="text-sm font-black text-white tabular-nums mt-0.5 block">
                  {formatCurrency(advanceEvaluation.discountedPayoffAmount)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
                <span className="text-[10px] text-zinc-400 uppercase block">
                  Desconto Imediato Obtido
                </span>
                <span className="text-sm font-black text-emerald-400 tabular-nums mt-0.5 block">
                  + {formatCurrency(advanceEvaluation.totalDiscountSaved)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#121214] border border-[#27272A]">
                <span className="text-[10px] text-zinc-400 uppercase block">
                  Rendimento Líquido no CDI
                </span>
                <span className="text-sm font-black text-[#FF8216] tabular-nums mt-0.5 block">
                  + {formatCurrency(advanceEvaluation.netCDIYieldIfInvested)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
