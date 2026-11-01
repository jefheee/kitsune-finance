/**
 * Equação de Fisher Exata e Projeção Real de Poder de Compra
 * 
 * Regra Matemática Inegociável:
 * É matematicamente incorreto subtrair a inflação diretamente da taxa nominal (aproximação linear ingênua).
 * A fórmula exata de Irving Fisher relaciona as taxas multiplicativamente:
 * (1 + i_nominal) = (1 + i_real) * (1 + pi_inflacao)
 * => i_real = ((1 + i_nominal) / (1 + pi_inflacao)) - 1
 */

import { truncateDecimal } from './cdi';

/**
 * Calcula a taxa de juros real exata pela Equação de Fisher.
 * 
 * @param nominalRatePct Taxa nominal anual em percentual (ex: 12.0 para 12%)
 * @param inflationRatePct Taxa de inflação anual (IPCA) em percentual (ex: 4.5 para 4,5%)
 * @returns Taxa real líquida de juros em percentual (ex: 7.1770%)
 */
export function calculateRealInterestRate(nominalRatePct: number, inflationRatePct: number): number {
  const nominalFactor = 1 + nominalRatePct / 100;
  const inflationFactor = 1 + inflationRatePct / 100;

  if (inflationFactor <= 0) return 0;

  const realFactor = nominalFactor / inflationFactor - 1;
  return truncateDecimal(realFactor * 100, 4);
}

export interface RealWealthProjectionParams {
  initialCapital: number;
  monthlyContribution: number;
  annualNominalRatePct: number;
  annualInflationRatePct: number;
  months: number;
}

export interface MonthlyWealthSnapshot {
  month: number;
  nominalBalance: number;
  realBalance: number;
  totalInvested: number;
  realGain: number;
}

export interface RealWealthProjectionResult {
  totalInvested: number;
  finalNominalBalance: number;
  finalRealBalance: number;
  totalRealGain: number;
  purchasingPowerRetentionPct: number;
  monthlyTimeline: MonthlyWealthSnapshot[];
}

/**
 * Projeta mês a mês a acumulação patrimonial comparando o saldo nominal aparente
 * com o saldo em poder de compra real (descontando a inflação composta pela Equação de Fisher).
 */
export function projectRealWealthPurchasingPower(
  params: RealWealthProjectionParams
): RealWealthProjectionResult {
  const { initialCapital, monthlyContribution, annualNominalRatePct, annualInflationRatePct, months } = params;

  // Taxas mensais equivalentes compostas
  const monthlyNominalRate = Math.pow(1 + annualNominalRatePct / 100, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + annualInflationRatePct / 100, 1 / 12) - 1;

  let currentNominal = Math.max(0, initialCapital);
  let totalInvested = Math.max(0, initialCapital);
  const monthlyTimeline: MonthlyWealthSnapshot[] = [];

  // Ponto inicial (Mês 0)
  monthlyTimeline.push({
    month: 0,
    nominalBalance: truncateDecimal(currentNominal, 2),
    realBalance: truncateDecimal(currentNominal, 2),
    totalInvested: truncateDecimal(totalInvested, 2),
    realGain: 0,
  });

  for (let m = 1; m <= months; m++) {
    // Rendimento nominal do mês sobre o saldo anterior
    const monthlyYield = currentNominal * monthlyNominalRate;
    currentNominal = currentNominal + monthlyYield + monthlyContribution;
    totalInvested += monthlyContribution;

    // Fator acumulado de inflação até o mês m
    const accumulatedInflationFactor = Math.pow(1 + monthlyInflationRate, m);

    // Saldo real deflacionado para moeda de poder de compra de hoje
    const realBalance = currentNominal / accumulatedInflationFactor;
    const realGain = realBalance - totalInvested;

    monthlyTimeline.push({
      month: m,
      nominalBalance: truncateDecimal(currentNominal, 2),
      realBalance: truncateDecimal(realBalance, 2),
      totalInvested: truncateDecimal(totalInvested, 2),
      realGain: truncateDecimal(realGain, 2),
    });
  }

  const finalNominal = truncateDecimal(currentNominal, 2);
  const finalReal = truncateDecimal(monthlyTimeline[months].realBalance, 2);
  const totalRealGain = truncateDecimal(finalReal - totalInvested, 2);
  const retentionPct = finalNominal > 0 ? truncateDecimal((finalReal / finalNominal) * 100, 2) : 100;

  return {
    totalInvested: truncateDecimal(totalInvested, 2),
    finalNominalBalance: finalNominal,
    finalRealBalance: finalReal,
    totalRealGain,
    purchasingPowerRetentionPct: retentionPct,
    monthlyTimeline,
  };
}

