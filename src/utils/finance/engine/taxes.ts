/**
 * Tributação Regressiva Brasileira (IR + IOF) e Equivalência de Renda Fixa
 * Implementação conforme Instrução Normativa RFB nº 1.585/2015 e Decreto nº 6.306/2007.
 */

import { truncateDecimal } from './cdi';

/**
 * Tabela regressiva oficial do IOF (Decreto nº 6.306/2007).
 * O índice corresponde aos dias corridos decorridos desde a aplicação (0 a 29 dias).
 * A partir do 30º dia, a alíquota é 0%.
 */
export const IOF_TABLE: readonly number[] = [
  0.96, // Dia 0 (mesmo dia)
  0.96, // Dia 1
  0.93, // Dia 2
  0.90, // Dia 3
  0.86, // Dia 4
  0.83, // Dia 5
  0.80, // Dia 6
  0.76, // Dia 7
  0.73, // Dia 8
  0.70, // Dia 9
  0.66, // Dia 10
  0.63, // Dia 11
  0.60, // Dia 12
  0.56, // Dia 13
  0.53, // Dia 14
  0.50, // Dia 15
  0.46, // Dia 16
  0.43, // Dia 17
  0.40, // Dia 18
  0.36, // Dia 19
  0.33, // Dia 20
  0.30, // Dia 21
  0.26, // Dia 22
  0.23, // Dia 23
  0.20, // Dia 24
  0.16, // Dia 25
  0.13, // Dia 26
  0.10, // Dia 27
  0.06, // Dia 28
  0.03, // Dia 29
];

/**
 * Retorna a alíquota de Imposto de Renda Regressivo sobre Renda Fixa conforme dias corridos.
 * Lei nº 11.033/2004:
 * - Até 180 dias: 22,5%
 * - De 181 a 360 dias: 20,0%
 * - De 361 a 720 dias: 17,5%
 * - Acima de 720 dias: 15,0%
 */
export function getRegressiveIRRate(calendarDays: number): number {
  if (calendarDays <= 180) return 0.225;
  if (calendarDays <= 360) return 0.20;
  if (calendarDays <= 720) return 0.175;
  return 0.15;
}

export interface FixedIncomeNetResult {
  grossYield: number;
  iofRate: number;
  iofAmount: number;
  irRate: number;
  irAmount: number;
  totalTax: number;
  netYield: number;
  effectiveTaxRatePct: number;
}

/**
 * Calcula o rendimento líquido de uma aplicação de renda fixa aplicando IOF e IR regressivo.
 * O IOF é aplicado primeiro sobre o rendimento bruto; o IR incide sobre a base já deduzida do IOF.
 * 
 * Se isTaxExempt for true (LCI, LCA, CRI, CRA, Debêntures Incentivadas), ambos os tributos são zerados.
 */
export function calculateFixedIncomeNet(
  grossYield: number,
  calendarDays: number,
  isTaxExempt = false
): FixedIncomeNetResult {
  if (grossYield <= 0) {
    return {
      grossYield: Math.max(0, grossYield),
      iofRate: 0,
      iofAmount: 0,
      irRate: 0,
      irAmount: 0,
      totalTax: 0,
      netYield: grossYield,
      effectiveTaxRatePct: 0,
    };
  }

  if (isTaxExempt) {
    return {
      grossYield,
      iofRate: 0,
      iofAmount: 0,
      irRate: 0,
      irAmount: 0,
      totalTax: 0,
      netYield: grossYield,
      effectiveTaxRatePct: 0,
    };
  }

  // Cálculo do IOF (apenas nos primeiros 29 dias)
  const iofRate = calendarDays < 30 ? (IOF_TABLE[calendarDays] ?? 0) : 0;
  // Truncamento financeiro padrão da Receita Federal (arredondamento para baixo nos centavos)
  const iofAmount = Math.floor(grossYield * iofRate * 100) / 100;

  // Base de cálculo para o IR é o rendimento deduzido do IOF
  const taxableYield = Math.max(0, grossYield - iofAmount);
  const irRate = getRegressiveIRRate(calendarDays);
  const irAmount = Math.floor(taxableYield * irRate * 100) / 100;

  const totalTax = truncateDecimal(iofAmount + irAmount, 2);
  const netYield = truncateDecimal(grossYield - totalTax, 2);
  const effectiveTaxRatePct = grossYield > 0 ? truncateDecimal((totalTax / grossYield) * 100, 2) : 0;

  return {
    grossYield,
    iofRate,
    iofAmount,
    irRate,
    irAmount,
    totalTax,
    netYield,
    effectiveTaxRatePct,
  };
}

export interface TaxComparisonParams {
  cdbPercentCDI: number;
  lciPercentCDI: number;
  calendarDays: number;
}

export interface TaxComparisonResult {
  equivalentCDBRateForLCI: number;
  equivalentLCIRateForCDB: number;
  winner: 'CDB' | 'LCI_LCA' | 'TIE';
  spreadAdvantagePctCDI: number;
  explanationPtBr: string;
}

/**
 * Compara a equivalência tributária exata entre um título isento (LCI/LCA/CRI/CRA)
 * e um título tributado (CDB/RDB/Tesouro Direto) para o prazo específico em dias corridos.
 * 
 * Relação matemática:
 * - Taxa CDB equivalente = Taxa LCI / (1 - IR)
 * - Taxa LCI equivalente = Taxa CDB * (1 - IR)
 */
export function compareTaxExemptVsTaxable(params: TaxComparisonParams): TaxComparisonResult {
  const { cdbPercentCDI, lciPercentCDI, calendarDays } = params;
  const irRate = getRegressiveIRRate(calendarDays);

  // Equivalências
  const equivalentCDBRateForLCI = truncateDecimal(lciPercentCDI / (1 - irRate), 2);
  const equivalentLCIRateForCDB = truncateDecimal(cdbPercentCDI * (1 - irRate), 2);

  // Rendimento líquido em % do CDI
  const netCDBPercentCDI = truncateDecimal(cdbPercentCDI * (1 - irRate), 4);
  const netLCIPercentCDI = truncateDecimal(lciPercentCDI, 4);

  const spread = truncateDecimal(Math.abs(netCDBPercentCDI - netLCIPercentCDI), 2);

  let winner: 'CDB' | 'LCI_LCA' | 'TIE';
  let explanationPtBr = '';

  const irLabel = (irRate * 100).toFixed(1).replace('.0', '') + '%';

  if (Math.abs(netCDBPercentCDI - netLCIPercentCDI) < 0.001) {
    winner = 'TIE';
    explanationPtBr = `Empate financeiro: Para ${calendarDays} dias corridos (IR de ${irLabel}), um CDB a ${cdbPercentCDI}% do CDI entrega exatamente o mesmo retorno líquido que uma LCI/LCA a ${lciPercentCDI}% do CDI.`;
  } else if (netCDBPercentCDI > netLCIPercentCDI) {
    winner = 'CDB';
    explanationPtBr = `O CDB vence: Para ${calendarDays} dias (IR de ${irLabel}), o CDB de ${cdbPercentCDI}% do CDI rende líquido ${netCDBPercentCDI}% do CDI, superando a LCI/LCA de ${lciPercentCDI}% por uma margem de ${spread}% do CDI. A LCI precisaria render ao menos ${equivalentLCIRateForCDB}% para empatar.`;
  } else {
    winner = 'LCI_LCA';
    explanationPtBr = `A LCI/LCA vence: Para ${calendarDays} dias (IR de ${irLabel}), a LCI de ${lciPercentCDI}% do CDI isenta de IR equivale a um CDB tributado de ${equivalentCDBRateForLCI}% do CDI. O CDB atual de ${cdbPercentCDI}% fica atrás por uma margem de ${spread}% do CDI.`;
  }

  return {
    equivalentCDBRateForLCI,
    equivalentLCIRateForCDB,
    winner,
    spreadAdvantagePctCDI: spread,
    explanationPtBr,
  };
}

