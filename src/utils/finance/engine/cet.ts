/**
 * Custo Efetivo Total (CET) e Avaliação de Antecipação de Parcelas
 * Implementação conforme Resolução CMN nº 3.517/2007 (BACEN) utilizando o método numérico de Newton-Raphson.
 */

import { truncateDecimal } from './cdi';
import { getRegressiveIRRate } from './taxes';

export interface LoanCETParams {
  financedAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  upfrontFees?: number;
}

export interface LoanCETResult {
  monthlyCetPct: number;
  annualCetPct: number;
  totalPaid: number;
  totalInterestPaid: number;
  converged: boolean;
  iterations: number;
}

/**
 * Calcula o Custo Efetivo Total (CET) mensal e anual de um financiamento ou empréstimo
 * através do método numérico de Newton-Raphson para encontrar a Taxa Interna de Retorno (TIR).
 * 
 * Fórmula BACEN:
 * PV_liquido = sum_{t=1}^{n} [ PMT / (1 + r)^t ]
 */
export function calculateLoanCET(params: LoanCETParams): LoanCETResult {
  const { financedAmount, installmentAmount, totalInstallments, upfrontFees = 0 } = params;

  const netFinanced = financedAmount - upfrontFees;
  const totalPaid = truncateDecimal(installmentAmount * totalInstallments, 2);
  const totalInterestPaid = truncateDecimal(Math.max(0, totalPaid - netFinanced), 2);

  if (netFinanced <= 0 || installmentAmount <= 0 || totalInstallments <= 0) {
    return {
      monthlyCetPct: 0,
      annualCetPct: 0,
      totalPaid,
      totalInterestPaid: 0,
      converged: false,
      iterations: 0,
    };
  }

  // Se o total pago for igual ao valor financiado, a taxa é 0
  if (Math.abs(totalPaid - netFinanced) < 0.01) {
    return {
      monthlyCetPct: 0,
      annualCetPct: 0,
      totalPaid,
      totalInterestPaid: 0,
      converged: true,
      iterations: 0,
    };
  }

  // Estimativa inicial para o método de Newton-Raphson
  // Aproximação linear: r0 = (totalPaid / netFinanced - 1) / totalInstallments
  let r = (totalPaid / netFinanced - 1) / (totalInstallments * 0.5);
  if (r <= 0) r = 0.01;

  const maxIterations = 100;
  const tolerance = 1e-7;
  let iterations = 0;
  let converged = false;

  for (let k = 0; k < maxIterations; k++) {
    iterations++;

    // f(r) = sum(PMT / (1+r)^t) - netFinanced
    // f'(r) = - sum(t * PMT / (1+r)^(t+1))
    let fValue = -netFinanced;
    let fDerivative = 0;

    for (let t = 1; t <= totalInstallments; t++) {
      const denom = Math.pow(1 + r, t);
      fValue += installmentAmount / denom;
      fDerivative -= (t * installmentAmount) / (denom * (1 + r));
    }

    if (Math.abs(fDerivative) < 1e-12) break;

    const diff = fValue / fDerivative;
    r = r - diff;

    // Evita taxas negativas irreais
    if (r <= -0.99) r = -0.99;

    if (Math.abs(diff) < tolerance) {
      converged = true;
      break;
    }
  }

  const monthlyCetPct = truncateDecimal(r * 100, 4);
  const annualCetRate = Math.pow(1 + r, 12) - 1;
  const annualCetPct = truncateDecimal(annualCetRate * 100, 2);

  return {
    monthlyCetPct,
    annualCetPct,
    totalPaid,
    totalInterestPaid,
    converged,
    iterations,
  };
}

export interface InstallmentAdvanceParams {
  installmentAmount: number;
  remainingInstallments: number;
  annualDiscountRatePct: number;
  currentSelicOrCDIPct: number;
}

export interface InstallmentAdvanceResult {
  totalNominalDebt: number;
  discountedPayoffAmount: number;
  totalDiscountSaved: number;
  netCDIYieldIfInvested: number;
  isWorthAdvancing: boolean;
  netFinancialAdvantage: number;
  recommendationPtBr: string;
}

/**
 * Avalia matematicamente se vale a pena antecipar parcelas com desconto (ex: Nubank)
 * em comparação com manter o mesmo montante investido em um CDB 100% CDI com liquidez diária.
 */
export function evaluateInstallmentAdvance(params: InstallmentAdvanceParams): InstallmentAdvanceResult {
  const { installmentAmount, remainingInstallments, annualDiscountRatePct, currentSelicOrCDIPct } = params;

  const totalNominalDebt = truncateDecimal(installmentAmount * remainingInstallments, 2);

  if (remainingInstallments <= 0 || installmentAmount <= 0) {
    return {
      totalNominalDebt: 0,
      discountedPayoffAmount: 0,
      totalDiscountSaved: 0,
      netCDIYieldIfInvested: 0,
      isWorthAdvancing: false,
      netFinancialAdvantage: 0,
      recommendationPtBr: 'Sem parcelas restantes para avaliar.',
    };
  }

  // Taxa mensal de desconto oferecida pela instituição (composta)
  const monthlyDiscountRate = Math.pow(1 + annualDiscountRatePct / 100, 1 / 12) - 1;

  // Valor Presente (PV) das parcelas com desconto de antecipação
  let discountedPayoffAmount = 0;
  for (let t = 1; t <= remainingInstallments; t++) {
    discountedPayoffAmount += installmentAmount / Math.pow(1 + monthlyDiscountRate, t);
  }
  discountedPayoffAmount = truncateDecimal(discountedPayoffAmount, 2);
  const totalDiscountSaved = truncateDecimal(totalNominalDebt - discountedPayoffAmount, 2);

  // Cenário alternativo: Deixar discountedPayoffAmount investido a 100% do CDI
  // Duração média ponderada do fluxo de caixa: t_medio = (n + 1) / 2 meses
  const averageMonths = (remainingInstallments + 1) / 2;
  const estimatedCalendarDays = Math.round(averageMonths * 30.4375);

  const monthlyCDIRate = Math.pow(1 + currentSelicOrCDIPct / 100, 1 / 12) - 1;
  const grossYieldFactor = Math.pow(1 + monthlyCDIRate, averageMonths) - 1;
  const grossCDIYield = discountedPayoffAmount * grossYieldFactor;

  // Aplica IR regressivo correspondente ao prazo médio das parcelas
  const irRate = getRegressiveIRRate(estimatedCalendarDays);
  const netCDIYieldIfInvested = truncateDecimal(grossCDIYield * (1 - irRate), 2);

  const netAdvantage = truncateDecimal(Math.abs(totalDiscountSaved - netCDIYieldIfInvested), 2);
  const isWorthAdvancing = totalDiscountSaved > netCDIYieldIfInvested;

  let recommendationPtBr = '';
  if (isWorthAdvancing) {
    recommendationPtBr = `Vale a pena antecipar! O desconto imediato de R$ ${totalDiscountSaved.toFixed(2)} supera o rendimento líquido que o dinheiro teria aplicado no CDI (R$ ${netCDIYieldIfInvested.toFixed(2)} após IR), gerando uma vantagem real de R$ ${netAdvantage.toFixed(2)}.`;
  } else {
    recommendationPtBr = `Não vale a pena antecipar. O desconto oferecido (R$ ${totalDiscountSaved.toFixed(2)}) é menor do que os R$ ${netCDIYieldIfInvested.toFixed(2)} líquidos que você obterá deixando o valor aplicado no CDI a ${currentSelicOrCDIPct}% a.a., gerando um custo de oportunidade de R$ ${netAdvantage.toFixed(2)}.`;
  }

  return {
    totalNominalDebt,
    discountedPayoffAmount,
    totalDiscountSaved,
    netCDIYieldIfInvested,
    isWorthAdvancing,
    netFinancialAdvantage: netAdvantage,
    recommendationPtBr,
  };
}

