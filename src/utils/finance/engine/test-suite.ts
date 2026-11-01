import {
  calculateCDIPosition,
  compareTaxExemptVsTaxable,
  simulateDebtPayoff,
  comparePayoffStrategies,
  calculateRealInterestRate,
  calculateLoanCET,
  evaluateInstallmentAdvance,
  runFinancialXRay,
} from './index';

console.log('--- TESTE 1: CDI 100% sobre R$ 10.000,00 por 252 dias úteis a 10,65% a.a. ---');
// 252 dias úteis em 2026 (por volta de 02/01/2026 até 31/12/2026)
const cdiTest = calculateCDIPosition({
  principal: 10000,
  startDate: new Date('2026-01-02T12:00:00Z'),
  endDate: new Date('2027-01-05T12:00:00Z'), // cobre aproximadamente 252 dias úteis
  annualDI: 10.65,
  percentOfCDI: 100,
});
console.log('Resultado CDI:', {
  principal: cdiTest.principal,
  grossBalance: cdiTest.grossBalance,
  grossYield: cdiTest.grossYield,
  businessDays: cdiTest.businessDays,
  effectiveReturnPct: cdiTest.effectiveReturnPct,
});

console.log('\n--- TESTE 2: Comparação LCI 90% CDI vs CDB 110% CDI em 180 dias e 721 dias ---');
const comp180 = compareTaxExemptVsTaxable({
  cdbPercentCDI: 110,
  lciPercentCDI: 90,
  calendarDays: 180, // IR 22.5% => CDB líquido = 110 * 0.775 = 85.25% vs LCI 90%
});
console.log('180 dias (IR 22.5%):', {
  winner: comp180.winner,
  spreadAdvantagePctCDI: comp180.spreadAdvantagePctCDI,
  explanation: comp180.explanationPtBr,
});

const comp721 = compareTaxExemptVsTaxable({
  cdbPercentCDI: 110,
  lciPercentCDI: 90,
  calendarDays: 721, // IR 15% => CDB líquido = 110 * 0.85 = 93.5% vs LCI 90%
});
console.log('721 dias (IR 15.0%):', {
  winner: comp721.winner,
  spreadAdvantagePctCDI: comp721.spreadAdvantagePctCDI,
  explanation: comp721.explanationPtBr,
});

console.log('\n--- TESTE 3: Simulação Bola de Neve vs Avalanche com 3 Dívidas & Rollover ---');
const debts = [
  { id: '1', name: 'Cartão Rotativo', balance: 3000, monthlyCetPct: 12.5, minimumPayment: 300 },
  { id: '2', name: 'Cheque Especial', balance: 1500, monthlyCetPct: 8.0, minimumPayment: 150 },
  { id: '3', name: 'Empréstimo Pessoal', balance: 8000, monthlyCetPct: 3.5, minimumPayment: 400 },
];
// Orçamento mínimo total = 300 + 150 + 400 = 850. Extra = 350 => Total mensal = 1200.
const debtComparison = comparePayoffStrategies(debts, 350);
console.log('Comparativo de Dívidas:', {
  avalancheMonths: debtComparison.avalanche.totalMonths,
  avalancheInterestPaid: debtComparison.avalanche.totalInterestPaid,
  snowballMonths: debtComparison.snowball.totalMonths,
  snowballInterestPaid: debtComparison.snowball.totalInterestPaid,
  interestSavedByAvalanche: debtComparison.interestSavedByAvalanche,
  firstClearedSnowballMonth: debtComparison.firstDebtClearedMonthSnowball,
  firstClearedAvalancheMonth: debtComparison.firstDebtClearedMonthAvalanche,
  recommendation: debtComparison.recommendationPtBr,
});

console.log('\n--- TESTE 4: Diagnóstico Patrimonial X-Ray ---');
const xrayReport = runFinancialXRay({
  accounts: [
    { id: 'acc1', institutionName: 'Itaú', type: 'CHECKING', balance: 1250 },
    { id: 'acc2', institutionName: 'Nubank', type: 'CREDIT_CARD', balance: 0, creditLimit: 15000, usedCreditLimit: 2800 },
  ],
  investments: [
    { id: 'inv1', name: 'CDB PagBank 110%', institutionName: 'PagBank', type: 'CDB', balance: 265000, ratePercentOfCDI: 110, isDailyLiquidity: true },
    { id: 'inv2', name: 'Poupança Caixa', institutionName: 'Caixa', type: 'POUPANCA', balance: 15000 },
  ],
  monthlyIncome: 14000,
  monthlyExpenses: 5200,
  macroRates: {
    annualCDIPct: 10.65,
    annualIPCAPct: 4.25,
    annualSelicPct: 10.75,
  },
});
console.log('X-Ray Score:', xrayReport.kitsuneScore, xrayReport.statusLabel);
console.log('FGC Descoberto:', xrayReport.totalUncoveredFGC);
console.log('Custo Oportunidade Anual:', xrayReport.annualOpportunityCostBRL);
console.log('Regras auditadas:', xrayReport.rules.map(r => `${r.title}: ${r.severity} (${r.scoreContribution} pts)`));

