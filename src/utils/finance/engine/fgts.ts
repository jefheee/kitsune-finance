/**
 * Kitsune Finance — Motor Determinístico do FGTS (Caixa Econômica Federal)
 *
 * Regras Legais & Bancárias Estritas (Lei nº 8.036/1990):
 * - Remuneração da conta vinculada: 3% a.a. capitalizada mensalmente à taxa de 0,2466% a.m. (fator 0.002466)
 * - Correção monetária pela Taxa Referencial (TR) no dia 10 de cada mês:
 *   Saldo_Corrigido = Saldo_Anterior * (1 + TR_mensal) * (1 + 0.002466)
 * - Depósito compulsório do empregador: 8% sobre o salário bruto (CLT padrão) ou 2% (Jovem Aprendiz)
 * - Blindagem Matemática MSLR: Zero alucinação por LLM.
 * - Desconto da inflação oficial (IPCA) pela Equação de Fisher exata:
 *   i_real = ((1 + i_nominal) / (1 + pi_inflacao)) - 1
 */

import { calculateRealInterestRate } from '@/utils/finance/engine/fisher';

export interface FgtsSimulationOptions {
  /** Taxa de depósito sobre o salário bruto (default: 0.08 = 8% CLT) */
  depositRate?: number;
  /** Taxa anual estimada da TR em % (ex: 1.2% a.a. em ciclos de Selic alta) */
  trAnnualPct?: number;
  /** Inflação anual projetada pelo IPCA em % (ex: 4.5% a.a.) */
  ipcaAnnualPct?: number;
  /** Taxa CDI anual para benchmarking de oportunidade em % (ex: 14.15% a.a.) */
  cdiAnnualPct?: number;
}

export interface FgtsTimelineMonth {
  monthIndex: number;
  dateIso: string;
  startBalance: number;
  interestAndTrEarned: number;
  depositAmount: number;
  endBalance: number;
  accumulatedDeposits: number;
  accumulatedInterest: number;
  realPurchasingPower: number;
}

export interface FgtsSimulationResult {
  initialBalance: number;
  monthlySalary: number;
  projectionMonths: number;
  finalNominalBalance: number;
  totalDeposited: number;
  totalInterestEarned: number;
  realPurchasingPower: number;
  realInflationLoss: number;
  cdiOpportunityCostBalance: number;
  effectiveNominalReturnPct: number;
  effectiveRealReturnPct: number;
  timeline: FgtsTimelineMonth[];
}

/**
 * Fator mensal fixo dos 3% a.a. capitalizado pela lei do FGTS:
 * (1 + 0.03)^(1/12) - 1 ≈ 0.00246627 (arredondado na 6ª casa decimal: 0.002466)
 */
export const FGTS_MONTHLY_INTEREST_RATE = 0.002466;

/**
 * Converte taxa percentual anual composta para taxa equivalente mensal.
 * (1 + r_anual)^(1/12) - 1
 */
export function annualPctToMonthlyRate(annualPct: number): number {
  if (annualPct <= 0) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/**
 * Calcula a movimentação determinística de um único mês na conta do FGTS.
 */
export function calculateFgtsSingleMonth(
  previousBalance: number,
  grossSalary: number,
  trMonthlyRate = 0.0008, // ~0.08% ao mês (base conservadora da TR)
  depositRate = 0.08
): {
  interestEarned: number;
  depositMade: number;
  newBalance: number;
} {
  const safePrev = Math.max(0, previousBalance || 0);
  const safeSalary = Math.max(0, grossSalary || 0);

  // Regra Caixa: Saldo anterior corrigido por (1 + TR) * (1 + 0.002466)
  const correctedBalance = safePrev * (1 + trMonthlyRate) * (1 + FGTS_MONTHLY_INTEREST_RATE);
  const interestEarned = Math.round((correctedBalance - safePrev) * 100) / 100;

  // Aporte compulsório do empregador
  const depositMade = Math.round(safeSalary * depositRate * 100) / 100;
  const newBalance = Math.round((safePrev + interestEarned + depositMade) * 100) / 100;

  return {
    interestEarned,
    depositMade,
    newBalance,
  };
}

/**
 * Simula a evolução da conta do FGTS mês a mês ao longo do tempo.
 */
export function simulateFgtsProjection(
  initialBalance: number,
  grossSalary: number,
  projectionMonths = 12,
  options: FgtsSimulationOptions = {}
): FgtsSimulationResult {
  const {
    depositRate = 0.08,
    trAnnualPct = 1.15,
    ipcaAnnualPct = 4.5,
    cdiAnnualPct = 14.15,
  } = options;

  const trMonthlyRate = annualPctToMonthlyRate(trAnnualPct);
  const ipcaMonthlyRate = annualPctToMonthlyRate(ipcaAnnualPct);
  // CDI com 15% de IR retido na fonte p/ comparativo conservador
  const cdiMonthlyNetRate = annualPctToMonthlyRate(cdiAnnualPct * 0.85);

  const timeline: FgtsTimelineMonth[] = [];
  let currentBalance = Math.max(0, initialBalance || 0);
  let totalDeposited = 0;
  let totalInterest = 0;
  let cdiAlternativeBalance = currentBalance;

  const now = new Date();

  for (let m = 1; m <= projectionMonths; m++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + m, 10);
    const startBal = currentBalance;

    const { interestEarned, depositMade, newBalance } = calculateFgtsSingleMonth(
      startBal,
      grossSalary,
      trMonthlyRate,
      depositRate
    );

    currentBalance = newBalance;
    totalDeposited += depositMade;
    totalInterest += interestEarned;

    // Alternativa de oportunidade: Se o mesmo dinheiro estivesse rendendo 100% CDI Líquido
    cdiAlternativeBalance = (cdiAlternativeBalance * (1 + cdiMonthlyNetRate)) + depositMade;

    // Fator de inflação acumulada até o mês m para calcular o poder de compra real via Fisher
    const cumulativeInflationFactor = Math.pow(1 + ipcaMonthlyRate, m);
    const realPurchasingPower = Math.round((currentBalance / cumulativeInflationFactor) * 100) / 100;

    timeline.push({
      monthIndex: m,
      dateIso: monthDate.toISOString().slice(0, 10),
      startBalance: Math.round(startBal * 100) / 100,
      interestAndTrEarned: interestEarned,
      depositAmount: depositMade,
      endBalance: Math.round(currentBalance * 100) / 100,
      accumulatedDeposits: Math.round(totalDeposited * 100) / 100,
      accumulatedInterest: Math.round(totalInterest * 100) / 100,
      realPurchasingPower,
    });
  }

  const finalNominal = Math.round(currentBalance * 100) / 100;
  const totalInvestedBase = initialBalance + totalDeposited;
  const nominalGainPct = totalInvestedBase > 0
    ? Math.round(((finalNominal - totalInvestedBase) / totalInvestedBase) * 10000) / 100
    : 0;

  const totalInflationPct = (Math.pow(1 + ipcaMonthlyRate, projectionMonths) - 1) * 100;
  const effectiveRealReturnPct = calculateRealInterestRate(nominalGainPct, totalInflationPct);

  const finalRealPower = timeline[timeline.length - 1]?.realPurchasingPower || finalNominal;
  const realInflationLoss = Math.max(0, Math.round((finalNominal - finalRealPower) * 100) / 100);

  return {
    initialBalance: Math.round(initialBalance * 100) / 100,
    monthlySalary: Math.round(grossSalary * 100) / 100,
    projectionMonths,
    finalNominalBalance: finalNominal,
    totalDeposited: Math.round(totalDeposited * 100) / 100,
    totalInterestEarned: Math.round(totalInterest * 100) / 100,
    realPurchasingPower: finalRealPower,
    realInflationLoss,
    cdiOpportunityCostBalance: Math.round(cdiAlternativeBalance * 100) / 100,
    effectiveNominalReturnPct: nominalGainPct,
    effectiveRealReturnPct,
    timeline,
  };
}

/**
 * Calcula a rentabilidade histórica do FGTS já realizado contra a inflação oficial acumulada.
 */
export function calculateFgtsHistoricalYield(
  initialBalance: number,
  currentBalance: number,
  accumulatedIpcaPct: number
): {
  nominalGain: number;
  nominalGainPct: number;
  realGainPct: number;
  realPurchasingPower: number;
  isLosingToInflation: boolean;
} {
  const safeInit = Math.max(0, initialBalance);
  const safeCurr = Math.max(0, currentBalance);

  const nominalGain = Math.round((safeCurr - safeInit) * 100) / 100;
  const nominalGainPct = safeInit > 0
    ? Math.round(((safeCurr - safeInit) / safeInit) * 10000) / 100
    : 0;

  const realGainPct = calculateRealInterestRate(nominalGainPct, accumulatedIpcaPct);
  const inflationFactor = 1 + Math.max(-0.9, accumulatedIpcaPct / 100);
  const realPurchasingPower = Math.round((safeCurr / inflationFactor) * 100) / 100;

  return {
    nominalGain,
    nominalGainPct,
    realGainPct,
    realPurchasingPower,
    isLosingToInflation: realGainPct < 0,
  };
}
