/**
 * Simulador de Quitação de Dívidas (Bola de Neve vs. Avalanche com Rollover Real)
 * 
 * Correção Matemática de Rollover:
 * O comprometimento mensal total do usuário com dívidas é fixo:
 * totalMonthlyCommitment = sum(minimumPayments) + extraMonthlyBudget.
 * 
 * Quando uma dívida é liquidada no mês M, a parcela mínima que era destinada a ela NÃO é retirada
 * do orçamento, e sim automaticamente incorporada ao poder de amortização da próxima dívida prioritária
 * no mês M+1 (efeito Snowball Rollover), acelerando a quitação exponencialmente.
 */

import { truncateDecimal } from './cdi';

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  monthlyCetPct: number;
  minimumPayment: number;
}

export interface DebtPayoffSnapshot {
  id: string;
  name: string;
  startBalance: number;
  interestCharged: number;
  paidAmount: number;
  endBalance: number;
  isCleared: boolean;
}

export interface MonthlyPayoffStep {
  month: number;
  totalStartBalance: number;
  totalInterestCharged: number;
  totalPaid: number;
  totalEndBalance: number;
  debts: DebtPayoffSnapshot[];
}

export interface DebtCompletionRecord {
  debtId: string;
  debtName: string;
  clearedMonth: number;
}

export interface StrategyPayoffResult {
  strategy: 'AVALANCHE' | 'SNOWBALL';
  totalMonths: number;
  totalPaid: number;
  totalInterestPaid: number;
  initialTotalDebt: number;
  debtCompletionRecords: DebtCompletionRecord[];
  timeline: MonthlyPayoffStep[];
}

export interface StrategyComparisonResult {
  avalanche: StrategyPayoffResult;
  snowball: StrategyPayoffResult;
  interestSavedByAvalanche: number;
  monthsSavedByAvalanche: number;
  firstDebtClearedMonthSnowball: number;
  firstDebtClearedMonthAvalanche: number;
  recommendationPtBr: string;
}

/**
 * Simula a liquidação de dívidas mês a mês com rollover completo de parcelas mínimas.
 */
export function simulateDebtPayoff(
  debts: DebtInput[],
  extraMonthlyBudget: number,
  strategy: 'AVALANCHE' | 'SNOWBALL'
): StrategyPayoffResult {
  // Clona o estado inicial das dívidas
  const activeDebts = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Math.max(0, d.balance),
    monthlyCetPct: Math.max(0, d.monthlyCetPct),
    minimumPayment: Math.max(0, d.minimumPayment),
    isCleared: d.balance <= 0,
    clearedMonth: d.balance <= 0 ? 0 : -1,
  }));

  const initialTotalDebt = truncateDecimal(
    activeDebts.reduce((acc, d) => acc + d.balance, 0),
    2
  );
  const baseMinimumTotal = activeDebts.reduce((acc, d) => acc + d.minimumPayment, 0);
  const totalMonthlyCommitment = truncateDecimal(baseMinimumTotal + Math.max(0, extraMonthlyBudget), 2);

  const timeline: MonthlyPayoffStep[] = [];
  const completionRecords: DebtCompletionRecord[] = [];

  let month = 0;
  const maxMonths = 360; // Limite de 30 anos para evitar loops infinitos
  let totalInterestPaid = 0;
  let totalPaidOverall = 0;

  while (activeDebts.some((d) => !d.isCleared) && month < maxMonths) {
    month++;

    const startBalanceTotal = activeDebts.reduce((acc, d) => acc + d.balance, 0);
    let monthInterestCharged = 0;
    let monthPaidTotal = 0;

    // 1. Aplica juros mensais em todas as dívidas ativas
    for (const debt of activeDebts) {
      if (!debt.isCleared && debt.balance > 0) {
        const monthlyInterest = debt.balance * (debt.monthlyCetPct / 100);
        debt.balance = truncateDecimal(debt.balance + monthlyInterest, 2);
        monthInterestCharged += monthlyInterest;
        totalInterestPaid += monthlyInterest;
      }
    }

    // Snapshots do mês para auditoria
    const debtSnapshots: DebtPayoffSnapshot[] = [];

    // Orçamento total disponível no mês
    let availableBudget = totalMonthlyCommitment;

    // 2. Pagamentos mínimos obrigatórios em todas as dívidas ativas
    for (const debt of activeDebts) {
      if (!debt.isCleared) {
        const startBal = debt.balance;
        const payment = Math.min(debt.balance, debt.minimumPayment);
        debt.balance = truncateDecimal(debt.balance - payment, 2);
        availableBudget = truncateDecimal(availableBudget - payment, 2);
        monthPaidTotal += payment;
        totalPaidOverall += payment;

        const isCleared = debt.balance <= 0.009;
        if (isCleared) {
          debt.balance = 0;
          debt.isCleared = true;
          debt.clearedMonth = month;
          completionRecords.push({ debtId: debt.id, debtName: debt.name, clearedMonth: month });
        }

        debtSnapshots.push({
          id: debt.id,
          name: debt.name,
          startBalance: startBal,
          interestCharged: 0, // contabilizado no bloco anterior
          paidAmount: payment,
          endBalance: debt.balance,
          isCleared: debt.isCleared,
        });
      }
    }

    // 3. Ordenação das dívidas para alocação do saldo extra (incluindo o rollover)
    // AVALANCHE: maior CET primeiro
    // SNOWBALL: menor saldo restante primeiro
    const remainingDebts = activeDebts.filter((d) => !d.isCleared);
    remainingDebts.sort((a, b) => {
      if (strategy === 'AVALANCHE') {
        if (b.monthlyCetPct !== a.monthlyCetPct) {
          return b.monthlyCetPct - a.monthlyCetPct;
        }
        return a.balance - b.balance;
      } else {
        if (a.balance !== b.balance) {
          return a.balance - b.balance;
        }
        return b.monthlyCetPct - a.monthlyCetPct;
      }
    });

    // 4. Alocação agressiva do orçamento restante (Rollover) na fila prioritária
    for (const targetDebt of remainingDebts) {
      if (availableBudget <= 0.009) break;

      const extraPayment = Math.min(targetDebt.balance, availableBudget);
      targetDebt.balance = truncateDecimal(targetDebt.balance - extraPayment, 2);
      availableBudget = truncateDecimal(availableBudget - extraPayment, 2);
      monthPaidTotal += extraPayment;
      totalPaidOverall += extraPayment;

      // Atualiza o snapshot correspondente
      const snap = debtSnapshots.find((s) => s.id === targetDebt.id);
      if (snap) {
        snap.paidAmount = truncateDecimal(snap.paidAmount + extraPayment, 2);
        snap.endBalance = targetDebt.balance;
      }

      if (targetDebt.balance <= 0.009) {
        targetDebt.balance = 0;
        targetDebt.isCleared = true;
        targetDebt.clearedMonth = month;
        if (snap) snap.isCleared = true;
        if (!completionRecords.some((r) => r.debtId === targetDebt.id)) {
          completionRecords.push({ debtId: targetDebt.id, debtName: targetDebt.name, clearedMonth: month });
        }
      }
    }

    const endBalanceTotal = activeDebts.reduce((acc, d) => acc + d.balance, 0);

    timeline.push({
      month,
      totalStartBalance: truncateDecimal(startBalanceTotal, 2),
      totalInterestCharged: truncateDecimal(monthInterestCharged, 2),
      totalPaid: truncateDecimal(monthPaidTotal, 2),
      totalEndBalance: truncateDecimal(endBalanceTotal, 2),
      debts: debtSnapshots,
    });
  }

  return {
    strategy,
    totalMonths: month,
    totalPaid: truncateDecimal(totalPaidOverall, 2),
    totalInterestPaid: truncateDecimal(totalInterestPaid, 2),
    initialTotalDebt,
    debtCompletionRecords: completionRecords,
    timeline,
  };
}

/**
 * Compara lado a lado os métodos Avalanche (foco matemático/menor juro)
 * e Bola de Neve (foco comportamental/vitórias rápidas).
 */
export function comparePayoffStrategies(
  debts: DebtInput[],
  extraMonthlyBudget: number
): StrategyComparisonResult {
  const avalanche = simulateDebtPayoff(debts, extraMonthlyBudget, 'AVALANCHE');
  const snowball = simulateDebtPayoff(debts, extraMonthlyBudget, 'SNOWBALL');

  const interestSaved = truncateDecimal(Math.max(0, snowball.totalInterestPaid - avalanche.totalInterestPaid), 2);
  const monthsSaved = Math.max(0, snowball.totalMonths - avalanche.totalMonths);

  const firstDebtClearedMonthSnowball = snowball.debtCompletionRecords[0]?.clearedMonth ?? 0;
  const firstDebtClearedMonthAvalanche = avalanche.debtCompletionRecords[0]?.clearedMonth ?? 0;

  let recommendationPtBr = '';
  if (interestSaved > 0 || monthsSaved > 0) {
    recommendationPtBr = `A estratégia Avalanche economiza R$ ${interestSaved.toFixed(2)} em juros e encerra ${monthsSaved} meses antes da Bola de Neve. No entanto, a Bola de Neve liquida a primeira dívida no mês ${firstDebtClearedMonthSnowball} (vs mês ${firstDebtClearedMonthAvalanche} na Avalanche), o que pode ser ideal se você precisa de alívio psicológico rápido.`;
  } else {
    recommendationPtBr = `Ambas as estratégias convergem com eficiência equivalente para o seu perfil atual de dívidas.`;
  }

  return {
    avalanche,
    snowball,
    interestSavedByAvalanche: interestSaved,
    monthsSavedByAvalanche: monthsSaved,
    firstDebtClearedMonthSnowball,
    firstDebtClearedMonthAvalanche,
    recommendationPtBr,
  };
}

