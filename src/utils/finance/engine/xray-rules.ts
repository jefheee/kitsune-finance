/**
 * Motor de Diagnóstico Patrimonial X-Ray (Inspirado no Ghostfolio + Regras SFN/BACEN/FGC)
 * 
 * Avalia a saúde patrimonial, risco de liquidez, exposição a conglomerados do FGC,
 * comprometimento de crédito e custos de oportunidade em 5 regras determinísticas puras.
 */

import { truncateDecimal } from './cdi';
import { calculateRealInterestRate } from './fisher';

export interface XRayInvestmentItem {
  id: string;
  name: string;
  institutionName: string;
  type: string; // 'CDB' | 'LCI' | 'LCA' | 'RDB' | 'POUPANCA' | 'TESOURO' | 'ACOES' | 'FII' | 'OUTROS'
  balance: number;
  ratePercentOfCDI?: number;
  isDailyLiquidity?: boolean;
  isFGCGuaranteed?: boolean;
}

export interface XRayAccountItem {
  id: string;
  institutionName: string;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD';
  balance: number;
  creditLimit?: number;
  usedCreditLimit?: number;
}

export interface XRayMacroRates {
  annualCDIPct: number;
  annualIPCAPct: number;
  annualSelicPct: number;
}

export interface FinancialXRayInput {
  accounts: XRayAccountItem[];
  investments: XRayInvestmentItem[];
  monthlyIncome: number;
  monthlyExpenses: number;
  macroRates: XRayMacroRates;
}

export type XRaySeverity = 'PASS' | 'INFO' | 'WARNING' | 'CRITICAL';

export interface XRayRuleResult {
  ruleId: string;
  title: string;
  severity: XRaySeverity;
  scoreContribution: number; // 0 a 20 pontos
  description: string;
  recommendation: string;
  details?: Record<string, unknown>;
}

export interface FinancialXRayReport {
  kitsuneScore: number; // 0 a 100
  statusLabel: 'EXCELENTE' | 'SAUDÁVEL' | 'ATENÇÃO' | 'CRÍTICO';
  rules: XRayRuleResult[];
  totalUncoveredFGC: number;
  annualOpportunityCostBRL: number;
}

/**
 * 1. Regra de Concentração FGC (Teto de R$ 250.000 por conglomerado financeiro)
 */
function evaluateFGCConcentration(investments: XRayInvestmentItem[]): {
  rule: XRayRuleResult;
  uncoveredFGC: number;
} {
  const fgcByInstitution = new Map<string, number>();

  for (const inv of investments) {
    const isFGC =
      inv.isFGCGuaranteed ??
      ['CDB', 'LCI', 'LCA', 'RDB', 'POUPANCA'].includes(inv.type.toUpperCase());

    if (isFGC) {
      const current = fgcByInstitution.get(inv.institutionName) ?? 0;
      fgcByInstitution.set(inv.institutionName, current + inv.balance);
    }
  }

  let totalUncovered = 0;
  const institutionsInCaution: Array<{ name: string; balance: number; uncovered: number }> = [];

  for (const [name, balance] of fgcByInstitution.entries()) {
    if (balance > 250000) {
      const uncovered = balance - 250000;
      totalUncovered += uncovered;
      institutionsInCaution.push({ name, balance, uncovered });
    } else if (balance >= 220000) {
      institutionsInCaution.push({ name, balance, uncovered: 0 });
    }
  }

  let severity: XRaySeverity = 'PASS';
  let scoreContribution = 20;
  let description = 'Todos os investimentos elegíveis ao FGC estão confortavelmente abaixo do teto de R$ 250.000 por instituição.';
  let recommendation = 'Mantenha a diversificação atual de custódia entre instituições financeiras.';

  if (totalUncovered > 0) {
    severity = 'CRITICAL';
    scoreContribution = 5;
    description = `Você possui R$ ${totalUncovered.toFixed(2)} expostos além do limite de cobertura do FGC em ${institutionsInCaution.length} instituição(ões).`;
    recommendation = `Transfira os valores excedentes a R$ 250.000 para outras instituições ou títulos do Tesouro Direto (risco soberano imune ao FGC).`;
  } else if (institutionsInCaution.length > 0) {
    severity = 'WARNING';
    scoreContribution = 14;
    description = `Você possui investimentos próximos ao limite de segurança do FGC (>= R$ 220.000) no(a) ${institutionsInCaution[0].name}.`;
    recommendation = `Com o acúmulo de juros futuros, o saldo ultrapassará os R$ 250.000. Considere novos aportes em outros bancos.`;
  }

  return {
    rule: {
      ruleId: 'fgc-concentration-risk',
      title: 'Concentração e Proteção FGC (R$ 250k)',
      severity,
      scoreContribution,
      description,
      recommendation,
      details: { totalUncovered, institutionsInCaution },
    },
    uncoveredFGC: truncateDecimal(totalUncovered, 2),
  };
}

/**
 * 2. Regra de Cobertura da Reserva de Emergência
 */
function evaluateEmergencyFund(
  accounts: XRayAccountItem[],
  investments: XRayInvestmentItem[],
  monthlyExpenses: number
): XRayRuleResult {
  if (monthlyExpenses <= 0) {
    return {
      ruleId: 'emergency-fund-coverage',
      title: 'Reserva de Emergência & Liquidez',
      severity: 'INFO',
      scoreContribution: 15,
      description: 'Gastos mensais não informados ou zerados para o cálculo da reserva.',
      recommendation: 'Cadastre suas despesas mensais médias para calibrar a reserva ideal.',
    };
  }

  // Liquidez imediata: contas correntes + poupança + CDBs liquidez diária
  let liquidBalance = 0;
  for (const acc of accounts) {
    if (acc.type === 'CHECKING' || acc.type === 'SAVINGS') {
      liquidBalance += Math.max(0, acc.balance);
    }
  }
  for (const inv of investments) {
    if (inv.isDailyLiquidity) {
      liquidBalance += Math.max(0, inv.balance);
    }
  }

  const coverageMonths = truncateDecimal(liquidBalance / monthlyExpenses, 1);

  let severity: XRaySeverity = 'PASS';
  let scoreContribution = 20;
  let description = `Sua liquidez imediata cobre ${coverageMonths} meses do seu custo de vida atual.`;
  let recommendation = 'Excelente colchão financeiro. Seu capital imediato oferece segurança sólida contra imprevistos.';

  if (coverageMonths < 1.0) {
    severity = 'CRITICAL';
    scoreContribution = 4;
    description = `Sua reserva cobre apenas ${coverageMonths} mês(es) de custo operacional (R$ ${liquidBalance.toFixed(2)} vs R$ ${monthlyExpenses.toFixed(2)}/mês).`;
    recommendation = 'Prioridade máxima: construa uma reserva de emergência mínima de 3 meses em ativos de liquidez diária.';
  } else if (coverageMonths < 3.0) {
    severity = 'WARNING';
    scoreContribution = 10;
    description = `Sua reserva cobre ${coverageMonths} meses de custo operacional.`;
    recommendation = 'Recomendado ampliar para ao menos 6 meses de gastos mensais antes de aumentar a exposição a risco.';
  } else if (coverageMonths < 6.0) {
    severity = 'INFO';
    scoreContribution = 16;
    description = `Sua reserva de ${coverageMonths} meses atende à faixa intermediária recomendada.`;
    recommendation = 'Meta de 6 meses quase atingida. Continue aportando consistentemente.';
  }

  return {
    ruleId: 'emergency-fund-coverage',
    title: 'Reserva de Emergência & Liquidez',
    severity,
    scoreContribution,
    description,
    recommendation,
    details: { liquidBalance: truncateDecimal(liquidBalance, 2), coverageMonths, monthlyExpenses },
  };
}

/**
 * 3. Regra de Comprometimento de Crédito e Limite
 */
function evaluateCreditRisk(accounts: XRayAccountItem[], monthlyIncome: number): XRayRuleResult {
  const creditCards = accounts.filter((a) => a.type === 'CREDIT_CARD');

  if (creditCards.length === 0) {
    return {
      ruleId: 'credit-commitment-risk',
      title: 'Comprometimento de Crédito & Limites',
      severity: 'PASS',
      scoreContribution: 20,
      description: 'Nenhum cartão de crédito ativo com limite comprometido.',
      recommendation: 'Controle de crédito perfeito.',
    };
  }

  let totalLimit = 0;
  let totalUsed = 0;

  for (const card of creditCards) {
    totalLimit += card.creditLimit ?? 0;
    totalUsed += card.usedCreditLimit ?? Math.max(0, -card.balance);
  }

  const utilizationRate = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
  const incomeCommitment = monthlyIncome > 0 ? (totalUsed / monthlyIncome) * 100 : 0;

  let severity: XRaySeverity = 'PASS';
  let scoreContribution = 20;
  let description = `Utilização de limite em ${utilizationRate.toFixed(1)}% e comprometimento de ${incomeCommitment.toFixed(1)}% da renda mensal.`;
  let recommendation = 'Mantenha a utilização abaixo de 30% para otimizar seu score de crédito e fluxo de caixa.';

  if (incomeCommitment > 50 || utilizationRate > 70) {
    severity = 'CRITICAL';
    scoreContribution = 4;
    description = `Alerta severo: Faturas e parcelas comprometem ${incomeCommitment.toFixed(1)}% da sua renda e ${utilizationRate.toFixed(1)}% do seu limite total.`;
    recommendation = 'Evite novas compras parceladas imediatamente e estude antecipação ou amortização para aliviar a margem.';
  } else if (incomeCommitment > 30 || utilizationRate > 35) {
    severity = 'WARNING';
    scoreContribution = 12;
    description = `Uso de crédito elevado: ${utilizationRate.toFixed(1)}% do limite total consumido.`;
    recommendation = 'Mantenha vigilância nos gastos parcelados para evitar efeito bola de neve nas próximas faturas.';
  }

  return {
    ruleId: 'credit-commitment-risk',
    title: 'Comprometimento de Crédito & Limites',
    severity,
    scoreContribution,
    description,
    recommendation,
    details: { totalLimit, totalUsed, utilizationRate: truncateDecimal(utilizationRate, 2), incomeCommitment: truncateDecimal(incomeCommitment, 2) },
  };
}

/**
 * 4. Regra de Eficiência de Renda Fixa e Custo de Oportunidade
 */
function evaluateFixedIncomeEfficiency(
  accounts: XRayAccountItem[],
  investments: XRayInvestmentItem[],
  macroRates: XRayMacroRates
): {
  rule: XRayRuleResult;
  annualOpportunityCost: number;
} {
  let idleCheckingAmount = 0;
  for (const acc of accounts) {
    if (acc.type === 'CHECKING' && acc.balance > 2000) {
      // Saldo parado acima do colchão operacional imediato de R$ 2.000
      idleCheckingAmount += acc.balance - 2000;
    }
  }

  let suboptimalInvestmentsAmount = 0;
  let annualOpportunityCost = 0;

  const cdi = macroRates.annualCDIPct;
  const ipca = macroRates.annualIPCAPct;

  for (const inv of investments) {
    // Investimento rendendo abaixo de 95% do CDI
    if (inv.ratePercentOfCDI && inv.ratePercentOfCDI < 95) {
      suboptimalInvestmentsAmount += inv.balance;
      const rateSpread = (cdi * (100 - inv.ratePercentOfCDI)) / 10000;
      annualOpportunityCost += inv.balance * rateSpread;
    } else if (inv.type === 'POUPANCA') {
      // Poupança rende significativamente menos que 100% CDI
      suboptimalInvestmentsAmount += inv.balance;
      const poupancaEstimate = Math.min(6.17, cdi * 0.7);
      const spread = (cdi - poupancaEstimate) / 100;
      annualOpportunityCost += inv.balance * spread;
    }
  }

  // Custo de oportunidade de saldo parado em conta corrente (deixando de render 100% CDI)
  if (idleCheckingAmount > 0) {
    annualOpportunityCost += idleCheckingAmount * (cdi / 100);
  }

  // Avaliação do juro real pelo Fisher
  const realCDIRate = calculateRealInterestRate(cdi, ipca);

  let severity: XRaySeverity = 'PASS';
  let scoreContribution = 20;
  let description = `Seus investimentos estão operando com eficiência, capturando ganho real de ${realCDIRate}% acima da inflação.`;
  let recommendation = 'Continue alocando a taxas competitivas em relação ao CDI de mercado.';

  if (annualOpportunityCost > 1500) {
    severity = 'CRITICAL';
    scoreContribution = 5;
    description = `Você está deixando de ganhar aproximadamente R$ ${annualOpportunityCost.toFixed(2)} por ano com capital descalibrado ou parado.`;
    recommendation = `Remaneje o saldo parado em conta corrente (R$ ${idleCheckingAmount.toFixed(2)}) e ativos com taxas subótimas para CDBs ou LCIs de 100%+ do CDI.`;
  } else if (annualOpportunityCost > 200) {
    severity = 'WARNING';
    scoreContribution = 12;
    description = `Custo de oportunidade estimado em R$ ${annualOpportunityCost.toFixed(2)} anuais com recursos mal remunerados.`;
    recommendation = 'Avalie migrar posições antigas de baixa rentabilidade para títulos mais eficientes.';
  }

  return {
    rule: {
      ruleId: 'suboptimal-fixed-income',
      title: 'Eficiência de Rentabilidade & Custo de Oportunidade',
      severity,
      scoreContribution,
      description,
      recommendation,
      details: {
        idleCheckingAmount: truncateDecimal(idleCheckingAmount, 2),
        suboptimalInvestmentsAmount: truncateDecimal(suboptimalInvestmentsAmount, 2),
        annualOpportunityCost: truncateDecimal(annualOpportunityCost, 2),
        realCDIRate,
      },
    },
    annualOpportunityCost: truncateDecimal(annualOpportunityCost, 2),
  };
}

/**
 * 5. Regra de Margem Operacional e Taxa de Poupança
 */
function evaluateSavingsRate(monthlyIncome: number, monthlyExpenses: number): XRayRuleResult {
  if (monthlyIncome <= 0) {
    return {
      ruleId: 'savings-rate-health',
      title: 'Taxa de Poupança & Fluxo Líquido',
      severity: 'INFO',
      scoreContribution: 15,
      description: 'Renda mensal não parametrizada para cálculo da margem de poupança.',
      recommendation: 'Atualize seus dados de receita mensal.',
    };
  }

  const netSavings = monthlyIncome - monthlyExpenses;
  const savingsRatePct = (netSavings / monthlyIncome) * 100;

  let severity: XRaySeverity = 'PASS';
  let scoreContribution = 20;
  let description = `Taxa de poupança de ${savingsRatePct.toFixed(1)}% da renda líquida mensal (sobra de R$ ${netSavings.toFixed(2)}/mês).`;
  let recommendation = 'Margem excelente. Direcione os excedentes para metas patrimoniais de longo prazo.';

  if (savingsRatePct < 0) {
    severity = 'CRITICAL';
    scoreContribution = 2;
    description = `Déficit operacional: Despesas superam as receitas em ${Math.abs(savingsRatePct).toFixed(1)}% (sangria de R$ ${Math.abs(netSavings).toFixed(2)}/mês).`;
    recommendation = 'Audite gastos imediatamente e corte assinaturas ou despesas supérfluas para estancar o endividamento.';
  } else if (savingsRatePct < 10) {
    severity = 'WARNING';
    scoreContribution = 10;
    description = `Margem de poupança apertada: apenas ${savingsRatePct.toFixed(1)}% da renda sobra no final do mês.`;
    recommendation = 'Tente elevar sua taxa de poupança para a meta saudável de ao menos 20% da renda líquida.';
  } else if (savingsRatePct < 20) {
    severity = 'INFO';
    scoreContribution = 16;
    description = `Margem de poupança de ${savingsRatePct.toFixed(1)}% está próxima da faixa ideal.`;
    recommendation = 'Mantenha o bom trabalho rumo à meta de 20% a 30%.';
  }

  return {
    ruleId: 'savings-rate-health',
    title: 'Taxa de Poupança & Fluxo Líquido',
    severity,
    scoreContribution,
    description,
    recommendation,
    details: { netSavings: truncateDecimal(netSavings, 2), savingsRatePct: truncateDecimal(savingsRatePct, 2) },
  };
}

/**
 * Executa a auditoria completa do portfólio e fluxo de caixa retornando o diagnóstico X-Ray.
 */
export function runFinancialXRay(input: FinancialXRayInput): FinancialXRayReport {
  const { accounts, investments, monthlyIncome, monthlyExpenses, macroRates } = input;

  const fgcResult = evaluateFGCConcentration(investments);
  const emergencyResult = evaluateEmergencyFund(accounts, investments, monthlyExpenses);
  const creditResult = evaluateCreditRisk(accounts, monthlyIncome);
  const efficiencyResult = evaluateFixedIncomeEfficiency(accounts, investments, macroRates);
  const savingsResult = evaluateSavingsRate(monthlyIncome, monthlyExpenses);

  const rules: XRayRuleResult[] = [
    fgcResult.rule,
    emergencyResult,
    creditResult,
    efficiencyResult.rule,
    savingsResult,
  ];

  // Pontuação Kitsune Health Score (0 a 100)
  const totalScore = Math.round(rules.reduce((acc, r) => acc + r.scoreContribution, 0));
  const kitsuneScore = Math.max(0, Math.min(100, totalScore));

  let statusLabel: 'EXCELENTE' | 'SAUDÁVEL' | 'ATENÇÃO' | 'CRÍTICO' = 'SAUDÁVEL';
  if (kitsuneScore >= 85) {
    statusLabel = 'EXCELENTE';
  } else if (kitsuneScore >= 70) {
    statusLabel = 'SAUDÁVEL';
  } else if (kitsuneScore >= 50) {
    statusLabel = 'ATENÇÃO';
  } else {
    statusLabel = 'CRÍTICO';
  }

  return {
    kitsuneScore,
    statusLabel,
    rules,
    totalUncoveredFGC: fgcResult.uncoveredFGC,
    annualOpportunityCostBRL: efficiencyResult.annualOpportunityCost,
  };
}

