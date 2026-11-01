/**
 * Kitsune Finance — Macro-Tools Determinísticas para Agentes & Servidor MCP (v2.0)
 *
 * Inspirado na arquitetura `app/models/assistant/function/` do Maybe Finance
 * e nas X-Ray Rules / MCP Server do Ghostfolio.
 *
 * REGRAS INEGOCIÁVEIS (BLINDAGEM MSLR):
 * - 100% Determinístico em TypeScript estrito (Zero chamadas de LLM para matemática).
 * - Isomórfico (Client & Server safe — sem imports de `next/headers` ou APIs exclusivas de Node).
 * - Datas sem hora ancoradas via `parseLocalDate` para evitar shift UTC no dia 1º do mês.
 * - Soma monetária em centavos inteiros (`toCents` / `fromCents`) respeitando `Number.MAX_SAFE_INTEGER`.
 */

import {
    truncateDecimal,
    calculateCDIPosition,
    getRegressiveIRRate,
    calculateFixedIncomeNet,
    compareTaxExemptVsTaxable,
    calculateRealInterestRate,
    projectRealWealthPurchasingPower,
    calculateLoanCET,
    evaluateInstallmentAdvance,
    comparePayoffStrategies,
    runFinancialXRay,
    type DebtInput,
    type StrategyComparisonResult,
    type InstallmentAdvanceResult,
    type TaxComparisonResult,
    type XRayAccountItem,
    type XRayInvestmentItem,
    type XRayMacroRates,
    type XRayRuleResult,
} from '@/utils/finance/engine';
import {
    detectUserIncomePattern,
    type DetectedIncomeProfile,
} from '@/utils/finance/income-detector';
import {
    classifyAndMatchInternalTransfers,
    parseLocalDate,
    formatLocalDateKey,
    type ClassifiedTransaction,
    type ReconcilableTransaction,
    type TransactionKind,
} from '@/utils/finance/reconciler';

// ============================================================================
// CONSTANTES E TIPOS DE ENTRADA CONSOLIDADOS
// ============================================================================

export const DEFAULT_BR_MACRO_RATES: XRayMacroRates = {
    annualCDIPct: 10.65,
    annualSelicPct: 10.75,
    annualIPCAPct: 4.42,
};

export const ANTI_HALLUCINATION_SYSTEM_DIRECTIVE =
    'Todos os cálculos de CDI, IR/IOF, Fisher, CET, FGC, Kitsune Score e Amortização já foram computados deterministicamente no bloco `[ENGINE_MATEMATICO_AUDITADO]`. É proibido recalcular ou inventar valores diferentes destes.';

export interface RawAccountRecord {
    id: string;
    pluggy_account_id?: string | null;
    bank_name?: string | null;
    institution_name?: string | null;
    institution_slug?: string | null;
    product_name?: string | null;
    type?: string | null;
    subtype?: string | null;
    balance?: number | string | null;
    credit_limit?: number | string | null;
    available_credit_limit?: number | string | null;
    minimum_payment?: number | string | null;
    balance_close_date?: string | null;
    balance_due_date?: string | null;
    card_brand?: string | null;
    family_member_id?: string | null;
}

export interface RawInvestmentRecord {
    id?: string;
    name?: string | null;
    type?: string | null;
    subtype?: string | null;
    institution_name?: string | null;
    issuer?: string | null;
    balance?: number | string | null;
    amount_original?: number | string | null;
    amount_profit?: number | string | null;
    rate?: number | string | null;
    rate_type?: string | null;
    annual_rate?: number | string | null;
    date?: string | null;
    due_date?: string | null;
    status?: string | null;
}

export interface RawLoanRecord {
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
    due_date?: string | null;
}

export interface RawTransactionRecord {
    id?: string;
    pluggy_transaction_id?: string | null;
    account_id?: string | null;
    description?: string | null;
    clean_description?: string | null;
    raw_description?: string | null;
    amount: number | string;
    type?: string | null;
    status?: string | null;
    category?: string | null;
    category_pt?: string | null;
    operation_type?: string | null;
    kind?: TransactionKind | string | null;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
    is_subscription?: boolean;
    installment_number?: number | null;
    total_installments?: number | null;
    total_purchase_amount?: number | string | null;
    receiver_name?: string | null;
    payer_name?: string | null;
    merchant_cnpj?: string | null;
    date?: string | null;
    executed_at?: string | null;
    family_member_id?: string | null;
}

export interface SharedPartnerInput {
    id: string;
    name: string;
    role?: string | null;
    monthlyIncome?: number | null;
    accounts?: RawAccountRecord[];
    transactions?: RawTransactionRecord[];
}

export interface UserFinancialDataInput {
    accounts: RawAccountRecord[];
    investments?: RawInvestmentRecord[];
    loans?: RawLoanRecord[];
    transactions: RawTransactionRecord[];
    profile?: {
        full_name?: string | null;
        display_name?: string | null;
        financial_goal?: string | null;
        monthly_income?: number | string | null;
    } | null;
    familyMembers?: Array<{ id?: string; name: string; role?: string | null }>;
    sharedPartners?: SharedPartnerInput[];
    macroRates?: Partial<XRayMacroRates>;
    referenceDate?: string | Date;
}

// ============================================================================
// UTILITÁRIOS MONETÁRIOS EXATOS EM CENTAVOS INTEIROS (SAFE INTEGER 53-BIT)
// ============================================================================

function toCents(value: number | string | null | undefined): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const clamped = Math.max(-9_000_000_000_000, Math.min(9_000_000_000_000, num));
    return Math.round(clamped * 100);
}

function fromCents(cents: number): number {
    if (!Number.isFinite(cents)) return 0;
    return truncateDecimal(cents / 100, 2);
}

function isCreditCardAccountRecord(acc: RawAccountRecord): boolean {
    const t = String(acc.type || '').toUpperCase();
    const s = String(acc.subtype || '').toUpperCase();
    return t === 'CREDIT' || t === 'CREDIT_CARD' || s === 'CREDIT_CARD';
}

function isTaxExemptAsset(typeRaw: string, nameRaw: string): boolean {
    const combined = `${typeRaw} ${nameRaw}`.toUpperCase();
    return (
        combined.includes('LCI') ||
        combined.includes('LCA') ||
        combined.includes('CRI') ||
        combined.includes('CRA') ||
        combined.includes('POUPANCA') ||
        combined.includes('POUPANÇA') ||
        combined.includes('INCENTIVAD')
    );
}

function normalizeInvestmentType(inv: RawInvestmentRecord): string {
    const combined = `${inv.subtype || ''} ${inv.type || ''} ${inv.name || ''}`.toUpperCase();
    if (combined.includes('LCI')) return 'LCI';
    if (combined.includes('LCA')) return 'LCA';
    if (combined.includes('CRI')) return 'CRI';
    if (combined.includes('CRA')) return 'CRA';
    if (combined.includes('CDB')) return 'CDB';
    if (combined.includes('RDB')) return 'RDB';
    if (combined.includes('TESOURO') || combined.includes('SELIC') || combined.includes('NTN') || combined.includes('LTN')) {
        return 'TESOURO';
    }
    if (combined.includes('POUPANCA') || combined.includes('POUPANÇA')) return 'POUPANCA';
    if (combined.includes('FII') || combined.includes('IMOBILI')) return 'FII';
    if (combined.includes('ACAO') || combined.includes('AÇÃO') || combined.includes('EQUITY') || combined.includes('STOCK')) {
        return 'ACOES';
    }
    return 'CDB';
}

function resolveMacroRates(override?: Partial<XRayMacroRates>): XRayMacroRates {
    return {
        annualCDIPct:
            override?.annualCDIPct && override.annualCDIPct > 0
                ? override.annualCDIPct
                : DEFAULT_BR_MACRO_RATES.annualCDIPct,
        annualSelicPct:
            override?.annualSelicPct && override.annualSelicPct > 0
                ? override.annualSelicPct
                : DEFAULT_BR_MACRO_RATES.annualSelicPct,
        annualIPCAPct:
            override?.annualIPCAPct && override.annualIPCAPct >= 0
                ? override.annualIPCAPct
                : DEFAULT_BR_MACRO_RATES.annualIPCAPct,
    };
}

/**
 * Normaliza e classifica transações em memória usando `classifyAndMatchInternalTransfers`
 * garantindo retrocompatibilidade total mesmo antes da migration de `kind` rodar no banco.
 */
function getNormalizedClassifiedTransactions(
    transactions: RawTransactionRecord[],
    accounts: RawAccountRecord[]
): Array<ClassifiedTransaction<ReconcilableTransaction & { original: RawTransactionRecord }>> {
    const mapped: Array<ReconcilableTransaction & { original: RawTransactionRecord }> = transactions.map((tx) => {
        const rawDate = tx.date || tx.executed_at || formatLocalDateKey(new Date());
        const validKind: TransactionKind | undefined =
            tx.kind === 'standard' ||
            tx.kind === 'funds_movement' ||
            tx.kind === 'cc_payment' ||
            tx.kind === 'loan_payment' ||
            tx.kind === 'one_time'
                ? tx.kind
                : undefined;

        return {
            id: tx.id,
            pluggy_transaction_id: tx.pluggy_transaction_id ?? null,
            account_id: tx.account_id ?? null,
            date: rawDate,
            amount: Number(tx.amount) || 0,
            type: tx.type ?? null,
            status: tx.status ?? null,
            description: tx.description ?? null,
            clean_description: tx.clean_description ?? null,
            raw_description: tx.raw_description ?? null,
            category: tx.category ?? null,
            category_pt: tx.category_pt ?? null,
            operation_type: tx.operation_type ?? null,
            is_internal_transfer: Boolean(tx.is_internal_transfer),
            is_refund: Boolean(tx.is_refund),
            kind: validKind,
            original: tx,
        };
    });

    return classifyAndMatchInternalTransfers(mapped, accounts);
}

function isStrictOperationalTransaction(
    tx: ClassifiedTransaction<ReconcilableTransaction & { original: RawTransactionRecord }>,
    familyLowerNames: string[]
): boolean {
    if (tx.is_internal_transfer === true) return false;
    if (tx.kind === 'funds_movement' || tx.kind === 'cc_payment') return false;

    const catPt = (tx.category_pt || '').toLowerCase();
    if (catPt === 'transferência própria' || catPt === 'pagamento de fatura') {
        return false;
    }

    if (familyLowerNames.length > 0) {
        const counterpart = (
            tx.original.receiver_name ||
            tx.original.payer_name ||
            tx.clean_description ||
            tx.description ||
            ''
        ).toLowerCase();
        if (familyLowerNames.some((fname) => fname.length >= 3 && counterpart.includes(fname))) {
            return false;
        }
    }

    return true;
}

// ============================================================================
// 1. MACRO-TOOL: BALANÇO PATRIMONIAL EXATO & X-RAY (GHOSTFOLIO + SFN/FGC)
// ============================================================================

export interface FGCInstitutionExposure {
    institutionName: string;
    totalEligibleBalance: number;
    fgcCoveredBalance: number;
    uncoveredAmount: number;
    fgcLimitUtilizationPct: number;
}

export interface BalanceSheetAndXRayOutput {
    toolName: 'get_balance_sheet_xray';
    calculatedAt: string;
    balanceSheet: {
        liquidAssets: number;
        investedAssets: number;
        totalAssets: number;
        creditCardLiabilities: number;
        loanLiabilities: number;
        totalLiabilities: number;
        netWorth: number;
        totalCreditLimit: number;
        creditUtilizationPct: number;
    };
    kitsuneScore: number;
    statusLabel: 'EXCELENTE' | 'SAUDÁVEL' | 'ATENÇÃO' | 'CRÍTICO';
    emergencyFundMonths: number;
    totalUncoveredFGC: number;
    fgcExposureByInstitution: FGCInstitutionExposure[];
    annualOpportunityCostBRL: number;
    idleCheckingAmount: number;
    monthlyReferenceIncome: number;
    monthlyReferenceExpenses: number;
    xrayRules: XRayRuleResult[];
}

export function toolGetBalanceSheetAndXRay(
    userData: UserFinancialDataInput
): BalanceSheetAndXRayOutput {
    const accounts = userData.accounts || [];
    const investments = (userData.investments || []).filter(
        (inv) => (Number(inv.balance) || 0) > 0 && String(inv.status || 'ACTIVE').toUpperCase() !== 'TOTAL_WITHDRAWAL'
    );
    const loans = userData.loans || [];
    const macroRates = resolveMacroRates(userData.macroRates);

    let liquidCents = 0;
    let creditDebtCents = 0;
    let totalCreditLimitCents = 0;

    const xrayAccounts: XRayAccountItem[] = accounts.map((acc, idx) => {
        const bal = Number(acc.balance) || 0;
        const instName = acc.institution_name || acc.bank_name || 'Instituição Bancária';

        if (isCreditCardAccountRecord(acc)) {
            const cardBillCents = Math.abs(toCents(bal));
            const limitCents = Math.max(0, toCents(acc.credit_limit));
            const availCents = acc.available_credit_limit != null ? Math.max(0, toCents(acc.available_credit_limit)) : null;
            const usedLimitCents =
                limitCents > 0 && availCents !== null && limitCents >= availCents
                    ? Math.max(cardBillCents, limitCents - availCents)
                    : cardBillCents;

            creditDebtCents += cardBillCents;
            totalCreditLimitCents += limitCents;

            return {
                id: acc.id || `cc-${idx}`,
                institutionName: instName,
                type: 'CREDIT_CARD',
                balance: -fromCents(cardBillCents),
                creditLimit: fromCents(limitCents),
                usedCreditLimit: fromCents(usedLimitCents),
            };
        }

        const accCents = toCents(bal);
        liquidCents += accCents;
        const subtypeUpper = String(acc.subtype || acc.type || '').toUpperCase();
        const mappedType: 'CHECKING' | 'SAVINGS' = subtypeUpper.includes('SAVINGS') || subtypeUpper.includes('POUPANCA')
            ? 'SAVINGS'
            : 'CHECKING';

        return {
            id: acc.id || `acc-${idx}`,
            institutionName: instName,
            type: mappedType,
            balance: fromCents(accCents),
        };
    });

    let investedCents = 0;
    const fgcMap = new Map<string, number>();

    const xrayInvestments: XRayInvestmentItem[] = investments.map((inv, idx) => {
        const balCents = Math.max(0, toCents(inv.balance));
        investedCents += balCents;

        const normType = normalizeInvestmentType(inv);
        const instName = inv.institution_name || inv.issuer || 'Custódia Consolidada';
        const rawRate = Number(inv.rate) || 0;
        const rateTypeUpper = String(inv.rate_type || '').toUpperCase();
        const nameUpper = String(inv.name || '').toUpperCase();

        const ratePercentOfCDI =
            rawRate > 0 && (rateTypeUpper.includes('CDI') || rateTypeUpper === '' || rawRate >= 70)
                ? rawRate
                : normType === 'CDB' || normType === 'RDB'
                  ? 100
                  : undefined;

        const hasFutureLock =
            Boolean(inv.due_date) &&
            !nameUpper.includes('LIQUIDEZ DI') &&
            !nameUpper.includes('CAIXINHA') &&
            !nameUpper.includes('RESERVA') &&
            (normType === 'LCI' || normType === 'LCA' || normType === 'CRI' || normType === 'CRA');

        const isDailyLiquidity =
            !hasFutureLock &&
            (normType === 'CDB' || normType === 'RDB' || normType === 'TESOURO' || normType === 'POUPANCA');

        const isFGCGuaranteed = ['CDB', 'LCI', 'LCA', 'RDB', 'POUPANCA'].includes(normType);
        if (isFGCGuaranteed) {
            fgcMap.set(instName, (fgcMap.get(instName) ?? 0) + balCents);
        }

        return {
            id: inv.id || `inv-${idx}`,
            name: inv.name || normType,
            institutionName: instName,
            type: normType,
            balance: fromCents(balCents),
            ratePercentOfCDI,
            isDailyLiquidity,
            isFGCGuaranteed,
        };
    });

    let loanDebtCents = 0;
    for (const loan of loans) {
        const debtVal = loan.outstanding_balance ?? loan.balance_due ?? 0;
        loanDebtCents += Math.max(0, toCents(debtVal));
    }

    const totalAssetsCents = liquidCents + investedCents;
    const totalLiabilitiesCents = creditDebtCents + loanDebtCents;
    const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

    // Fluxo operacional de referência (1 mês corrente ou janela móvel de 30 dias se início do mês)
    const incomeStmtCurrent = toolGetIncomeStatement(userData, 1);
    const incomeStmtQuarter =
        incomeStmtCurrent.netOperationalExpenses === 0 && (userData.transactions || []).length > 0
            ? toolGetIncomeStatement(userData, 3)
            : null;

    const declaredMonthlyIncome = Number(userData.profile?.monthly_income) || 0;
    const monthlyReferenceIncome =
        incomeStmtCurrent.operationalIncome > 0
            ? incomeStmtCurrent.operationalIncome
            : incomeStmtCurrent.incomeProfile.monthlyAverageIncome > 0
              ? truncateDecimal(incomeStmtCurrent.incomeProfile.monthlyAverageIncome, 2)
              : truncateDecimal(declaredMonthlyIncome, 2);

    const monthlyReferenceExpenses =
        incomeStmtCurrent.netOperationalExpenses > 0
            ? incomeStmtCurrent.netOperationalExpenses
            : incomeStmtQuarter && incomeStmtQuarter.netOperationalExpenses > 0
              ? truncateDecimal(incomeStmtQuarter.netOperationalExpenses / 3, 2)
              : 0;

    const xrayReport = runFinancialXRay({
        accounts: xrayAccounts,
        investments: xrayInvestments,
        monthlyIncome: monthlyReferenceIncome,
        monthlyExpenses: monthlyReferenceExpenses,
        macroRates,
    });

    const emergencyRule = xrayReport.rules.find((r) => r.ruleId === 'emergency-fund-coverage');
    const emergencyFundMonths =
        typeof emergencyRule?.details?.coverageMonths === 'number'
            ? emergencyRule.details.coverageMonths
            : monthlyReferenceExpenses > 0
              ? truncateDecimal(fromCents(Math.max(0, liquidCents)) / monthlyReferenceExpenses, 1)
              : 0;

    const oppRule = xrayReport.rules.find((r) => r.ruleId === 'suboptimal-fixed-income');
    const idleCheckingAmount =
        typeof oppRule?.details?.idleCheckingAmount === 'number' ? oppRule.details.idleCheckingAmount : 0;

    const fgcExposureByInstitution: FGCInstitutionExposure[] = Array.from(fgcMap.entries())
        .map(([institutionName, cents]) => {
            const totalEligibleBalance = fromCents(cents);
            const fgcCapCents = 250_000_00; // R$ 250.000,00
            const coveredCents = Math.min(cents, fgcCapCents);
            const uncoveredCents = Math.max(0, cents - fgcCapCents);
            return {
                institutionName,
                totalEligibleBalance,
                fgcCoveredBalance: fromCents(coveredCents),
                uncoveredAmount: fromCents(uncoveredCents),
                fgcLimitUtilizationPct: truncateDecimal((cents / fgcCapCents) * 100, 2),
            };
        })
        .sort((a, b) => b.totalEligibleBalance - a.totalEligibleBalance);

    const creditUtilizationPct =
        totalCreditLimitCents > 0
            ? truncateDecimal((creditDebtCents / totalCreditLimitCents) * 100, 2)
            : 0;

    return {
        toolName: 'get_balance_sheet_xray',
        calculatedAt: new Date().toISOString(),
        balanceSheet: {
            liquidAssets: fromCents(liquidCents),
            investedAssets: fromCents(investedCents),
            totalAssets: fromCents(totalAssetsCents),
            creditCardLiabilities: fromCents(creditDebtCents),
            loanLiabilities: fromCents(loanDebtCents),
            totalLiabilities: fromCents(totalLiabilitiesCents),
            netWorth: fromCents(netWorthCents),
            totalCreditLimit: fromCents(totalCreditLimitCents),
            creditUtilizationPct,
        },
        kitsuneScore: xrayReport.kitsuneScore,
        statusLabel: xrayReport.statusLabel,
        emergencyFundMonths,
        totalUncoveredFGC: xrayReport.totalUncoveredFGC,
        fgcExposureByInstitution,
        annualOpportunityCostBRL: xrayReport.annualOpportunityCostBRL,
        idleCheckingAmount,
        monthlyReferenceIncome,
        monthlyReferenceExpenses,
        xrayRules: xrayReport.rules,
    };
}

// ============================================================================
// 2. MACRO-TOOL: DRE PESSOAL / FLUXO DE CAIXA OPERACIONAL PURO
// ============================================================================

export interface RankedSpendBucket {
    name: string;
    totalAmount: number;
    transactionCount: number;
    shareOfExpensesPct: number;
}

export interface IncomeStatementOutput {
    toolName: 'get_income_statement';
    periodMonths: number;
    periodStart: string;
    periodEnd: string;
    incomeProfile: DetectedIncomeProfile;
    operationalIncome: number;
    grossOperationalExpenses: number;
    refundsAbated: number;
    netOperationalExpenses: number;
    internalMovementsIgnored: number;
    netSavings: number;
    netSavingsMarginPct: number;
    dailyBurnRate: number;
    projectedMonthEndExpenses: number;
    topCategories: RankedSpendBucket[];
    topMerchants: RankedSpendBucket[];
    operationalTransactionCount: number;
}

export function toolGetIncomeStatement(
    userData: UserFinancialDataInput,
    periodMonths = 1
): IncomeStatementOutput {
    const safeMonths = Math.max(1, Math.min(24, Math.floor(Number(periodMonths) || 1)));
    const accounts = userData.accounts || [];
    const rawTransactions = userData.transactions || [];
    const familyLowerNames = (userData.familyMembers || [])
        .map((f) => String(f.name || '').toLowerCase().trim())
        .filter((n) => n.length >= 3);

    const accountTypeById = new Map<string, boolean>();
    for (const acc of accounts) {
        if (acc.id) {
            accountTypeById.set(acc.id, isCreditCardAccountRecord(acc));
        }
    }

    const classified = getNormalizedClassifiedTransactions(rawTransactions, accounts);

    const incomeProfile = detectUserIncomePattern(
        classified.map((c) => ({
            ...c.original,
            is_internal_transfer: c.is_internal_transfer || c.kind === 'funds_movement' || c.kind === 'cc_payment',
        })),
        userData.profile?.monthly_income
    );

    const anchor = userData.referenceDate ? parseLocalDate(userData.referenceDate) : parseLocalDate(new Date());
    const startMonthDate = new Date(
        anchor.getFullYear(),
        anchor.getMonth() - (safeMonths - 1),
        1,
        0,
        0,
        0,
        0
    );
    const endOfAnchorDay = new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        anchor.getDate(),
        23,
        59,
        59,
        999
    );

    let operationalIncomeCents = 0;
    let grossExpenseCents = 0;
    let refundsAbatedCents = 0;
    let internalIgnoredCents = 0;
    let operationalTxCount = 0;

    const categoryCentsMap = new Map<string, { cents: number; count: number }>();
    const merchantCentsMap = new Map<string, { cents: number; count: number }>();

    for (const tx of classified) {
        const txDate = parseLocalDate(tx.date);
        if (txDate.getTime() < startMonthDate.getTime() || txDate.getTime() > endOfAnchorDay.getTime()) {
            continue;
        }

        const absCents = Math.abs(toCents(tx.amount));
        if (absCents === 0) continue;

        if (!isStrictOperationalTransaction(tx, familyLowerNames)) {
            internalIgnoredCents += absCents;
            continue;
        }

        if (tx.is_refund || String(tx.operation_type || '').toUpperCase() === 'REFUND') {
            refundsAbatedCents += absCents;
            continue;
        }

        const isCreditCardAcc = tx.account_id ? accountTypeById.get(tx.account_id) === true : false;
        const txTypeUpper = String(tx.type || '').toUpperCase();
        const opTypeUpper = String(tx.operation_type || '').toUpperCase();

        const isExpense =
            tx.amount < 0 ||
            txTypeUpper === 'DEBIT' ||
            opTypeUpper === 'CREDIT_CARD';

        const isRealIncome =
            !isExpense &&
            (tx.amount > 0 || txTypeUpper === 'CREDIT') &&
            !isCreditCardAcc;

        if (isRealIncome) {
            operationalIncomeCents += absCents;
            operationalTxCount++;
        } else if (isExpense) {
            grossExpenseCents += absCents;
            operationalTxCount++;

            const catName = (tx.category_pt || tx.category || 'Outros').trim();
            const prevCat = categoryCentsMap.get(catName) ?? { cents: 0, count: 0 };
            categoryCentsMap.set(catName, { cents: prevCat.cents + absCents, count: prevCat.count + 1 });

            const merchantName = (tx.clean_description || tx.description || 'Estabelecimento').trim();
            const prevMerch = merchantCentsMap.get(merchantName) ?? { cents: 0, count: 0 };
            merchantCentsMap.set(merchantName, {
                cents: prevMerch.cents + absCents,
                count: prevMerch.count + 1,
            });
        }
    }

    const netExpenseCents = Math.max(0, grossExpenseCents - refundsAbatedCents);
    const netSavingsCents = operationalIncomeCents - netExpenseCents;

    const referenceIncomeForMargin =
        operationalIncomeCents > 0
            ? fromCents(operationalIncomeCents)
            : incomeProfile.monthlyAverageIncome > 0
              ? incomeProfile.monthlyAverageIncome * safeMonths
              : (Number(userData.profile?.monthly_income) || 0) * safeMonths;

    const netSavingsMarginPct =
        referenceIncomeForMargin > 0
            ? truncateDecimal(
                  (( (operationalIncomeCents > 0 ? fromCents(operationalIncomeCents) : referenceIncomeForMargin) -
                      fromCents(netExpenseCents)) /
                      referenceIncomeForMargin) *
                      100,
                  2
              )
            : 0;

    const dayOfMonth = Math.max(1, anchor.getDate());
    const daysInAnchorMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const elapsedDays =
        safeMonths === 1
            ? dayOfMonth
            : Math.max(1, Math.round((endOfAnchorDay.getTime() - startMonthDate.getTime()) / 86_400_000));

    const dailyBurnRate = truncateDecimal(fromCents(netExpenseCents) / elapsedDays, 2);
    const projectedMonthEndExpenses =
        safeMonths === 1
            ? truncateDecimal(dailyBurnRate * daysInAnchorMonth, 2)
            : truncateDecimal(fromCents(netExpenseCents) / safeMonths, 2);

    const denomExpenseCents = Math.max(1, grossExpenseCents);

    const topCategories: RankedSpendBucket[] = Array.from(categoryCentsMap.entries())
        .sort((a, b) => b[1].cents - a[1].cents)
        .slice(0, 8)
        .map(([name, info]) => ({
            name,
            totalAmount: fromCents(info.cents),
            transactionCount: info.count,
            shareOfExpensesPct: truncateDecimal((info.cents / denomExpenseCents) * 100, 2),
        }));

    const topMerchants: RankedSpendBucket[] = Array.from(merchantCentsMap.entries())
        .sort((a, b) => b[1].cents - a[1].cents)
        .slice(0, 8)
        .map(([name, info]) => ({
            name,
            totalAmount: fromCents(info.cents),
            transactionCount: info.count,
            shareOfExpensesPct: truncateDecimal((info.cents / denomExpenseCents) * 100, 2),
        }));

    return {
        toolName: 'get_income_statement',
        periodMonths: safeMonths,
        periodStart: formatLocalDateKey(startMonthDate),
        periodEnd: formatLocalDateKey(anchor),
        incomeProfile,
        operationalIncome: fromCents(operationalIncomeCents),
        grossOperationalExpenses: fromCents(grossExpenseCents),
        refundsAbated: fromCents(refundsAbatedCents),
        netOperationalExpenses: fromCents(netExpenseCents),
        internalMovementsIgnored: fromCents(internalIgnoredCents),
        netSavings: fromCents(netSavingsCents),
        netSavingsMarginPct,
        dailyBurnRate,
        projectedMonthEndExpenses,
        topCategories,
        topMerchants,
        operationalTransactionCount: operationalTxCount,
    };
}

// ============================================================================
// 3. MACRO-TOOL: SIMULADOR DE DÍVIDAS, CARTÕES, CET & ANTECIPAÇÃO DE PARCELAS
// ============================================================================

export interface AuditedDebtItem extends DebtInput {
    sourceType: 'LOAN' | 'CREDIT_CARD_REVOLVING' | 'CREDIT_CARD_BILL';
    institutionName: string;
    annualCetPct: number;
    cetConverged: boolean;
}

export interface AuditedInstallmentAdvanceItem {
    description: string;
    institutionName: string;
    currentInstallment: number;
    totalInstallments: number;
    remainingInstallments: number;
    installmentAmount: number;
    evaluation: InstallmentAdvanceResult;
}

export interface DebtAndCardsSimulationOutput {
    toolName: 'simulate_debt_payoff';
    extraMonthlyBudget: number;
    hasInterestBearingDebt: boolean;
    liquidCoverageStatus: 'FULLY_COVERED' | 'PARTIAL_COVERAGE_REVOLVING_RISK' | 'NO_CARD_DEBT';
    liquidCashAvailable: number;
    totalCreditCardBills: number;
    totalLoansBalance: number;
    totalMappedDebt: number;
    mappedDebts: AuditedDebtItem[];
    payoffComparison: StrategyComparisonResult | null;
    payoffSchedulePreview: Array<{
        month: number;
        avalancheEndBalance: number;
        snowballEndBalance: number;
        avalanchePaid: number;
    }>;
    installmentAdvances: {
        activePlansCount: number;
        totalRemainingInstallmentsNominal: number;
        assumedAnnualAdvanceDiscountPct: number;
        benchmarkCDIPct: number;
        consolidatedVerdict: InstallmentAdvanceResult | null;
        plans: AuditedInstallmentAdvanceItem[];
    };
}

export function toolSimulateDebtAndCards(
    userData: UserFinancialDataInput,
    extraMonthlyBudget = 0,
    annualAdvanceDiscountPct = 9.85
): DebtAndCardsSimulationOutput {
    const accounts = userData.accounts || [];
    const loans = userData.loans || [];
    const transactions = userData.transactions || [];
    const macroRates = resolveMacroRates(userData.macroRates);
    const safeExtraBudget = Math.max(0, Number(extraMonthlyBudget) || 0);

    const accountNameById = new Map<string, string>();
    let liquidCashCents = 0;
    let totalCardBillsCents = 0;

    const creditCardAccounts: RawAccountRecord[] = [];
    for (const acc of accounts) {
        const inst = acc.institution_name || acc.bank_name || 'Cartão';
        if (acc.id) accountNameById.set(acc.id, inst);

        if (isCreditCardAccountRecord(acc)) {
            const billCents = Math.abs(toCents(acc.balance));
            if (billCents > 0) {
                totalCardBillsCents += billCents;
                creditCardAccounts.push(acc);
            }
        } else {
            liquidCashCents += Math.max(0, toCents(acc.balance));
        }
    }

    const mappedDebts: AuditedDebtItem[] = [];
    let totalLoansCents = 0;

    // 1. Mapeamento de Empréstimos e Financiamentos com cálculo de CET via Newton-Raphson
    loans.forEach((loan, idx) => {
        const outstanding = Number(loan.outstanding_balance ?? loan.balance_due) || 0;
        const outstandingCents = toCents(outstanding);
        if (outstandingCents <= 0) return;

        totalLoansCents += outstandingCents;
        const instName = loan.institution_name || 'Instituição Financeira';
        const prodName = loan.product_name || loan.type || 'Empréstimo';
        const totalInst = Math.max(1, Number(loan.total_installments) || 12);
        const paidInst = Math.max(0, Number(loan.paid_installments) || 0);
        const remainingInst = Math.max(1, totalInst - paidInst);
        const contracted = Number(loan.contracted_amount) || outstanding;

        let monthlyCetPct = 0;
        let annualCetPct = 0;
        let cetConverged = false;

        const explicitInstallment = Number(loan.installment_amount) || 0;
        const declaredRate = Number(loan.interest_rate) || 0;

        if (explicitInstallment > 0 && contracted > 0 && totalInst > 0) {
            const cetRes = calculateLoanCET({
                financedAmount: contracted,
                installmentAmount: explicitInstallment,
                totalInstallments: totalInst,
            });
            monthlyCetPct = cetRes.monthlyCetPct;
            annualCetPct = cetRes.annualCetPct;
            cetConverged = cetRes.converged;
        } else if (declaredRate > 0) {
            // Se interest_rate > 4.5, tratamos como taxa anual se > 25%, senão taxa mensal
            if (declaredRate > 25) {
                annualCetPct = truncateDecimal(declaredRate, 2);
                monthlyCetPct = truncateDecimal((Math.pow(1 + declaredRate / 100, 1 / 12) - 1) * 100, 4);
            } else {
                monthlyCetPct = truncateDecimal(declaredRate, 4);
                annualCetPct = truncateDecimal((Math.pow(1 + declaredRate / 100, 12) - 1) * 100, 2);
            }
            cetConverged = true;
        } else {
            monthlyCetPct = 2.45; // Taxa média de crédito pessoal SFN quando omitida pelo conector
            annualCetPct = truncateDecimal((Math.pow(1 + 0.0245, 12) - 1) * 100, 2);
        }

        const r = monthlyCetPct / 100;
        const estimatedPmt =
            explicitInstallment > 0
                ? explicitInstallment
                : r > 0
                  ? (fromCents(outstandingCents) * r) / (1 - Math.pow(1 + r, -remainingInst))
                  : fromCents(outstandingCents) / remainingInst;

        mappedDebts.push({
            id: loan.id || `loan-${idx}`,
            name: `${prodName} (${instName})`,
            institutionName: instName,
            sourceType: 'LOAN',
            balance: fromCents(outstandingCents),
            monthlyCetPct,
            annualCetPct,
            cetConverged,
            minimumPayment: truncateDecimal(Math.max(25, estimatedPmt), 2),
        });
    });

    // 2. Mapeamento de Cartões de Crédito (risco de rotativo quando liquidez < faturas, ou faturas ativas)
    const isRevolvingRisk = totalCardBillsCents > liquidCashCents && totalCardBillsCents > 0;
    creditCardAccounts.forEach((card, idx) => {
        const billAmount = fromCents(Math.abs(toCents(card.balance)));
        if (billAmount <= 0) return;

        const instName = card.institution_name || card.bank_name || 'Cartão de Crédito';
        const cardLabel = `${card.product_name || instName}`;
        const minPaymentRaw = Number(card.minimum_payment) || 0;
        const minimumPayment =
            minPaymentRaw > 0 ? truncateDecimal(minPaymentRaw, 2) : truncateDecimal(Math.max(50, billAmount * 0.15), 2);

        // Rotativo médio regulado (Lei 14.690/2023 teto de 100% + CET mensal típico ~12.5% a.m. caso descoberto)
        const monthlyCetPct = isRevolvingRisk ? 12.5 : 9.9;
        const annualCetPct = truncateDecimal((Math.pow(1 + monthlyCetPct / 100, 12) - 1) * 100, 2);

        if (isRevolvingRisk || loans.length > 0 || safeExtraBudget > 0) {
            mappedDebts.push({
                id: card.id || `card-${idx}`,
                name: `Fatura ${cardLabel}`,
                institutionName: instName,
                sourceType: isRevolvingRisk ? 'CREDIT_CARD_REVOLVING' : 'CREDIT_CARD_BILL',
                balance: billAmount,
                monthlyCetPct,
                annualCetPct,
                cetConverged: true,
                minimumPayment,
            });
        }
    });

    const payoffComparison =
        mappedDebts.length > 0 ? comparePayoffStrategies(mappedDebts, safeExtraBudget) : null;

    const payoffSchedulePreview: DebtAndCardsSimulationOutput['payoffSchedulePreview'] = [];
    if (payoffComparison) {
        const maxPreviewMonths = Math.min(
            12,
            Math.max(payoffComparison.avalanche.timeline.length, payoffComparison.snowball.timeline.length)
        );
        for (let i = 0; i < maxPreviewMonths; i++) {
            const avStep = payoffComparison.avalanche.timeline[i];
            const sbStep = payoffComparison.snowball.timeline[i];
            payoffSchedulePreview.push({
                month: i + 1,
                avalancheEndBalance: avStep ? avStep.totalEndBalance : 0,
                snowballEndBalance: sbStep ? sbStep.totalEndBalance : 0,
                avalanchePaid: avStep ? avStep.totalPaid : 0,
            });
        }
    }

    // 3. Avaliação Matemática de Antecipação de Parcelas vs Liquidez no CDI
    const seenInstallmentKeys = new Set<string>();
    const auditedPlans: AuditedInstallmentAdvanceItem[] = [];
    let totalRemainingNominalCents = 0;
    let weightedRemainingMonthsNum = 0;
    let totalMonthlyInstallmentCents = 0;

    for (const tx of transactions) {
        const totalInst = Number(tx.total_installments) || 0;
        const currInst = Number(tx.installment_number) || 0;
        if (totalInst <= 1 || currInst <= 0 || currInst >= totalInst) continue;
        if (tx.is_internal_transfer || tx.is_refund) continue;

        const instAmtCents = Math.abs(toCents(tx.amount));
        if (instAmtCents <= 0) continue;

        const cleanDesc = (tx.clean_description || tx.description || 'Compra Parcelada').trim();
        const dedupKey = `${cleanDesc.toLowerCase().slice(0, 20)}_${totalInst}_${instAmtCents}`;
        if (seenInstallmentKeys.has(dedupKey)) continue;
        seenInstallmentKeys.add(dedupKey);

        const remainingInstallments = totalInst - currInst;
        const installmentAmount = fromCents(instAmtCents);
        const instName = (tx.account_id && accountNameById.get(tx.account_id)) || 'Cartão de Crédito';

        const evaluation = evaluateInstallmentAdvance({
            installmentAmount,
            remainingInstallments,
            annualDiscountRatePct: annualAdvanceDiscountPct,
            currentSelicOrCDIPct: macroRates.annualCDIPct,
        });

        auditedPlans.push({
            description: cleanDesc,
            institutionName: instName,
            currentInstallment: currInst,
            totalInstallments: totalInst,
            remainingInstallments,
            installmentAmount,
            evaluation,
        });

        const planNominalCents = instAmtCents * remainingInstallments;
        totalRemainingNominalCents += planNominalCents;
        totalMonthlyInstallmentCents += instAmtCents;
        weightedRemainingMonthsNum += remainingInstallments * planNominalCents;
    }

    auditedPlans.sort(
        (a, b) => b.evaluation.totalNominalDebt - a.evaluation.totalNominalDebt
    );

    const avgRemainingMonths =
        totalRemainingNominalCents > 0
            ? Math.max(1, Math.round(weightedRemainingMonthsNum / totalRemainingNominalCents))
            : 0;

    const consolidatedVerdict =
        auditedPlans.length > 0 && avgRemainingMonths > 0
            ? evaluateInstallmentAdvance({
                  installmentAmount: truncateDecimal(
                      fromCents(totalRemainingNominalCents) / avgRemainingMonths,
                      2
                  ),
                  remainingInstallments: avgRemainingMonths,
                  annualDiscountRatePct: annualAdvanceDiscountPct,
                  currentSelicOrCDIPct: macroRates.annualCDIPct,
              })
            : null;

    const liquidCoverageStatus: DebtAndCardsSimulationOutput['liquidCoverageStatus'] =
        totalCardBillsCents === 0
            ? 'NO_CARD_DEBT'
            : liquidCashCents >= totalCardBillsCents
              ? 'FULLY_COVERED'
              : 'PARTIAL_COVERAGE_REVOLVING_RISK';

    const totalMappedDebtCents = mappedDebts.reduce((acc, d) => acc + toCents(d.balance), 0);

    return {
        toolName: 'simulate_debt_payoff',
        extraMonthlyBudget: safeExtraBudget,
        hasInterestBearingDebt: totalLoansCents > 0 || isRevolvingRisk,
        liquidCoverageStatus,
        liquidCashAvailable: fromCents(liquidCashCents),
        totalCreditCardBills: fromCents(totalCardBillsCents),
        totalLoansBalance: fromCents(totalLoansCents),
        totalMappedDebt: fromCents(totalMappedDebtCents),
        mappedDebts,
        payoffComparison,
        payoffSchedulePreview,
        installmentAdvances: {
            activePlansCount: auditedPlans.length,
            totalRemainingInstallmentsNominal: fromCents(totalRemainingNominalCents),
            assumedAnnualAdvanceDiscountPct: annualAdvanceDiscountPct,
            benchmarkCDIPct: macroRates.annualCDIPct,
            consolidatedVerdict,
            plans: auditedPlans.slice(0, 12),
        },
    };
}

// ============================================================================
// 4. MACRO-TOOL: RENDA FIXA B3 (DU/252), IR/IOF REGRESSIVO, LCI/CDB & FISHER
// ============================================================================

export interface AuditedInvestmentPosition {
    name: string;
    institutionName: string;
    normalizedType: string;
    isTaxExempt: boolean;
    currentBalance: number;
    contractedPercentOfCDI: number;
    estimatedAnnualGrossPct: number;
    projected12mGrossYield: number;
    projected12mNetYield: number;
    projected12mTaxAmount: number;
    regressiveIRRatePct: number;
    realAnnualReturnFisherPct: number;
}

export interface FixedIncomeSimulationParams {
    annualCDIPct?: number;
    annualSelicPct?: number;
    annualIPCAPct?: number;
    cdbPercentCDI?: number;
    lciPercentCDI?: number;
    comparisonCalendarDays?: number;
    projectionMonths?: number;
    monthlyContribution?: number;
}

export interface FixedIncomeAndGoalsOutput {
    toolName: 'compare_fixed_income_br';
    macroRates: XRayMacroRates;
    financialGoal: string;
    portfolioSummary: {
        activePositionsCount: number;
        totalInvestedBalance: number;
        weightedNominalGrossAnnualPct: number;
        weightedNominalNetAnnualPct: number;
        weightedRealAnnualFisherPct: number;
        projected12mGrossYieldBRL: number;
        projected12mNetYieldBRL: number;
        projected12mTaxesBRL: number;
    };
    positions: AuditedInvestmentPosition[];
    taxEquivalenceBenchmarks: {
        shortTerm180d: TaxComparisonResult;
        mediumTerm365d: TaxComparisonResult;
        longTerm721d: TaxComparisonResult;
        customComparison: TaxComparisonResult;
    };
    realWealthProjection: {
        horizonMonths: number;
        monthlyContributionUsed: number;
        initialCapitalUsed: number;
        totalInvestedCapital: number;
        finalNominalBalance: number;
        finalRealPurchasingPowerBRL: number;
        totalRealGainAboveInflation: number;
        purchasingPowerRetentionPct: number;
        milestones: Array<{
            month: number;
            nominalBalance: number;
            realBalance: number;
            realGain: number;
        }>;
    };
}

export function toolAnalyzeFixedIncomeAndGoals(
    userData: UserFinancialDataInput,
    simParams?: FixedIncomeSimulationParams
): FixedIncomeAndGoalsOutput {
    const macroRates = resolveMacroRates({
        ...userData.macroRates,
        annualCDIPct: simParams?.annualCDIPct ?? userData.macroRates?.annualCDIPct,
        annualSelicPct: simParams?.annualSelicPct ?? userData.macroRates?.annualSelicPct,
        annualIPCAPct: simParams?.annualIPCAPct ?? userData.macroRates?.annualIPCAPct,
    });

    const activeInvestments = (userData.investments || []).filter(
        (inv) => (Number(inv.balance) || 0) > 0 && String(inv.status || 'ACTIVE').toUpperCase() !== 'TOTAL_WITHDRAWAL'
    );

    const anchor = userData.referenceDate ? parseLocalDate(userData.referenceDate) : parseLocalDate(new Date());
    const oneYearAhead = new Date(anchor.getFullYear() + 1, anchor.getMonth(), anchor.getDate(), 12, 0, 0, 0);

    let totalBalanceCents = 0;
    let weightedGrossNum = 0;
    let weightedNetNum = 0;
    let total12mGrossYieldCents = 0;
    let total12mNetYieldCents = 0;
    let total12mTaxCents = 0;

    const auditedPositions: AuditedInvestmentPosition[] = activeInvestments.map((inv) => {
        const balCents = Math.max(0, toCents(inv.balance));
        const currentBalance = fromCents(balCents);
        totalBalanceCents += balCents;

        const normType = normalizeInvestmentType(inv);
        const instName = inv.institution_name || inv.issuer || 'Carteira';
        const exempt = isTaxExemptAsset(normType, inv.name || '');

        const rawRate = Number(inv.rate) || 0;
        const annualExplicit = Number(inv.annual_rate) || 0;

        let contractedPctCDI = 100;
        if (normType === 'POUPANCA') {
            const poupancaAnnual = macroRates.annualSelicPct > 8.5 ? 6.17 : macroRates.annualSelicPct * 0.7;
            contractedPctCDI = truncateDecimal((poupancaAnnual / macroRates.annualCDIPct) * 100, 2);
        } else if (rawRate >= 50 && rawRate <= 250) {
            contractedPctCDI = rawRate;
        } else if (annualExplicit > 0) {
            contractedPctCDI = truncateDecimal((annualExplicit / macroRates.annualCDIPct) * 100, 2);
        } else if (normType === 'LCI' || normType === 'LCA') {
            contractedPctCDI = 90;
        }

        // Simulação oficial DU/252 B3/CETIP de 12 meses para frente sobre o saldo atual da posição
        const cdiPos = calculateCDIPosition({
            principal: currentBalance,
            startDate: anchor,
            endDate: oneYearAhead,
            annualDI: macroRates.annualCDIPct,
            percentOfCDI: contractedPctCDI,
        });

        // Prazo decorrido desde aplicação (se houver `inv.date`) + 365 dias para alíquota regressiva correta
        const pastDays = inv.date
            ? Math.max(0, Math.round((anchor.getTime() - parseLocalDate(inv.date).getTime()) / 86_400_000))
            : 0;
        const effectiveHoldingDays = pastDays + Math.max(365, cdiPos.calendarDays);

        const netTaxRes = calculateFixedIncomeNet(cdiPos.grossYield, effectiveHoldingDays, exempt);
        const grossAnnualPct = cdiPos.effectiveReturnPct;
        const netAnnualPct =
            currentBalance > 0 ? truncateDecimal((netTaxRes.netYield / currentBalance) * 100, 4) : 0;
        const realFisherPct = calculateRealInterestRate(netAnnualPct, macroRates.annualIPCAPct);

        weightedGrossNum += grossAnnualPct * balCents;
        weightedNetNum += netAnnualPct * balCents;
        total12mGrossYieldCents += toCents(cdiPos.grossYield);
        total12mNetYieldCents += toCents(netTaxRes.netYield);
        total12mTaxCents += toCents(netTaxRes.totalTax);

        return {
            name: inv.name || normType,
            institutionName: instName,
            normalizedType: normType,
            isTaxExempt: exempt,
            currentBalance,
            contractedPercentOfCDI: contractedPctCDI,
            estimatedAnnualGrossPct: grossAnnualPct,
            projected12mGrossYield: cdiPos.grossYield,
            projected12mNetYield: netTaxRes.netYield,
            projected12mTaxAmount: netTaxRes.totalTax,
            regressiveIRRatePct: exempt ? 0 : truncateDecimal(getRegressiveIRRate(effectiveHoldingDays) * 100, 1),
            realAnnualReturnFisherPct: realFisherPct,
        };
    });

    auditedPositions.sort((a, b) => b.currentBalance - a.currentBalance);

    const defaultNetAnnualPct = truncateDecimal(macroRates.annualCDIPct * (1 - 0.175), 4);
    const weightedNominalGrossAnnualPct =
        totalBalanceCents > 0
            ? truncateDecimal(weightedGrossNum / totalBalanceCents, 4)
            : macroRates.annualCDIPct;
    const weightedNominalNetAnnualPct =
        totalBalanceCents > 0
            ? truncateDecimal(weightedNetNum / totalBalanceCents, 4)
            : defaultNetAnnualPct;
    const weightedRealAnnualFisherPct = calculateRealInterestRate(
        weightedNominalNetAnnualPct,
        macroRates.annualIPCAPct
    );

    // Equivalência Tributária CDB vs LCI/LCA
    const cdbPct = simParams?.cdbPercentCDI && simParams.cdbPercentCDI > 0 ? simParams.cdbPercentCDI : 105;
    const lciPct = simParams?.lciPercentCDI && simParams.lciPercentCDI > 0 ? simParams.lciPercentCDI : 90;
    const customDays =
        simParams?.comparisonCalendarDays && simParams.comparisonCalendarDays > 0
            ? Math.round(simParams.comparisonCalendarDays)
            : 365;

    const shortTerm180d = compareTaxExemptVsTaxable({
        cdbPercentCDI: cdbPct,
        lciPercentCDI: lciPct,
        calendarDays: 180,
    });
    const mediumTerm365d = compareTaxExemptVsTaxable({
        cdbPercentCDI: cdbPct,
        lciPercentCDI: lciPct,
        calendarDays: 365,
    });
    const longTerm721d = compareTaxExemptVsTaxable({
        cdbPercentCDI: cdbPct,
        lciPercentCDI: lciPct,
        calendarDays: 721,
    });
    const customComparison = compareTaxExemptVsTaxable({
        cdbPercentCDI: cdbPct,
        lciPercentCDI: lciPct,
        calendarDays: customDays,
    });

    // Projeção Patrimonial em Poder de Compra Real (Equação de Fisher)
    const incomeStmt = toolGetIncomeStatement(userData, 1);
    const estimatedMonthlySavings =
        simParams?.monthlyContribution !== undefined && simParams.monthlyContribution >= 0
            ? simParams.monthlyContribution
            : incomeStmt.netSavings > 0
              ? incomeStmt.netSavings
              : Math.max(0, (Number(userData.profile?.monthly_income) || 0) * 0.2);

    const horizonMonths =
        simParams?.projectionMonths && simParams.projectionMonths > 0
            ? Math.min(360, Math.round(simParams.projectionMonths))
            : 60;

    const liquidPositiveCents = (userData.accounts || []).reduce((acc, a) => {
        if (isCreditCardAccountRecord(a)) return acc;
        return acc + Math.max(0, toCents(a.balance));
    }, 0);

    const initialCapitalUsed = fromCents(totalBalanceCents + liquidPositiveCents);
    const fisherProjection = projectRealWealthPurchasingPower({
        initialCapital: initialCapitalUsed,
        monthlyContribution: truncateDecimal(estimatedMonthlySavings, 2),
        annualNominalRatePct: weightedNominalNetAnnualPct,
        annualInflationRatePct: macroRates.annualIPCAPct,
        months: horizonMonths,
    });

    const milestoneMonths = Array.from(new Set([12, 24, 36, horizonMonths])).filter(
        (m) => m <= horizonMonths && fisherProjection.monthlyTimeline[m]
    );
    const milestones = milestoneMonths.map((m) => {
        const snap = fisherProjection.monthlyTimeline[m];
        return {
            month: snap.month,
            nominalBalance: snap.nominalBalance,
            realBalance: snap.realBalance,
            realGain: snap.realGain,
        };
    });

    return {
        toolName: 'compare_fixed_income_br',
        macroRates,
        financialGoal:
            userData.profile?.financial_goal || 'Construir reserva sólida e independência patrimonial',
        portfolioSummary: {
            activePositionsCount: auditedPositions.length,
            totalInvestedBalance: fromCents(totalBalanceCents),
            weightedNominalGrossAnnualPct,
            weightedNominalNetAnnualPct,
            weightedRealAnnualFisherPct,
            projected12mGrossYieldBRL: fromCents(total12mGrossYieldCents),
            projected12mNetYieldBRL: fromCents(total12mNetYieldCents),
            projected12mTaxesBRL: fromCents(total12mTaxCents),
        },
        positions: auditedPositions.slice(0, 25),
        taxEquivalenceBenchmarks: {
            shortTerm180d,
            mediumTerm365d,
            longTerm721d,
            customComparison,
        },
        realWealthProjection: {
            horizonMonths,
            monthlyContributionUsed: truncateDecimal(estimatedMonthlySavings, 2),
            initialCapitalUsed,
            totalInvestedCapital: fisherProjection.totalInvested,
            finalNominalBalance: fisherProjection.finalNominalBalance,
            finalRealPurchasingPowerBRL: fisherProjection.finalRealBalance,
            totalRealGainAboveInflation: fisherProjection.totalRealGain,
            purchasingPowerRetentionPct: fisherProjection.purchasingPowerRetentionPct,
            milestones,
        },
    };
}

// ============================================================================
// 5. MACRO-TOOL: AUDITORIA FORENSE DE ANOMALIAS, ASSINATURAS, TARIFAS & IMPULSO
// ============================================================================

export interface AuditedSubscriptionItem {
    merchantName: string;
    institutionName: string;
    monthlyAmount: number;
    annualizedAmount: number;
    lastChargeDate: string;
    occurrencesDetected: number;
}

export interface DuplicateChargeAnomaly {
    merchantName: string;
    institutionName: string;
    amount: number;
    firstDate: string;
    duplicateDate: string;
    daysApart: number;
}

export interface AvoidableFeeItem {
    description: string;
    institutionName: string;
    amount: number;
    date: string;
    feeCategory: 'ANUIDADE' | 'TARIFA_PACOTE' | 'IOF_JUROS_ENCARGOS';
}

export interface ImpulseOutlierItem {
    description: string;
    category: string;
    institutionName: string;
    amount: number;
    date: string;
    categoryMean: number;
    categoryStdDev: number;
    zScore: number;
}

export interface AnomaliesAndLeaksOutput {
    toolName: 'audit_anomalies_and_subscriptions';
    subscriptions: {
        activeCount: number;
        monthlyTotalBRL: number;
        annualizedTotalBRL: number;
        items: AuditedSubscriptionItem[];
    };
    duplicateCharges: {
        count: number;
        potentialRefundTotalBRL: number;
        items: DuplicateChargeAnomaly[];
    };
    avoidableFees: {
        count: number;
        totalFeesDetectedBRL: number;
        annualizedLeakEstimateBRL: number;
        items: AvoidableFeeItem[];
    };
    impulseAndDiscretionary: {
        currentMonthDiscretionaryBRL: number;
        outlierCount: number;
        outlierTotalBRL: number;
        outliers: ImpulseOutlierItem[];
    };
    totalMonthlyRecoverableLeakBRL: number;
}

const FEE_KEYWORDS_ANUIDADE = ['anuidade', 'mensalidade cartao', 'tarifa cartao'];
const FEE_KEYWORDS_TARIFA = [
    'tarifa pacote',
    'pacote de servicos',
    'cesta bancaria',
    'tarifa bancaria',
    'manutencao de conta',
    'taxa manutencao',
    'seguro prestamista',
    'seguro cartao',
    'tarifa ted',
    'tarifa doc',
];
const FEE_KEYWORDS_IOF_JUROS = [
    'iof ',
    'iof-',
    'iof rotativo',
    'iof adicional',
    'juros rotativo',
    'juros de mora',
    'multa atraso',
    'encargos rotativo',
    'encargos financeiros',
];

const DISCRETIONARY_KEYWORDS = [
    'delivery',
    'ifood',
    'rappi',
    'uber eats',
    'ze delivery',
    'jogos',
    'steam',
    'playstation',
    'xbox',
    'nintendo',
    'aposta',
    'bet',
    'cassino',
    'lazer',
    'bar ',
    'cervej',
    'balada',
    'fast food',
];

export function toolAuditAnomaliesAndLeaks(
    userData: UserFinancialDataInput
): AnomaliesAndLeaksOutput {
    const accounts = userData.accounts || [];
    const rawTransactions = userData.transactions || [];
    const familyLowerNames = (userData.familyMembers || [])
        .map((f) => String(f.name || '').toLowerCase().trim())
        .filter((n) => n.length >= 3);

    const accountInstMap = new Map<string, string>();
    for (const acc of accounts) {
        if (acc.id) {
            accountInstMap.set(acc.id, acc.institution_name || acc.bank_name || 'Banco');
        }
    }

    const classified = getNormalizedClassifiedTransactions(rawTransactions, accounts);
    const anchor = userData.referenceDate ? parseLocalDate(userData.referenceDate) : parseLocalDate(new Date());
    const currentMonthPrefix = formatLocalDateKey(anchor).slice(0, 7);

    // Agrupadores
    const subGroups = new Map<
        string,
        {
            merchantName: string;
            institutionName: string;
            latestCents: number;
            latestDate: string;
            monthsSeen: Set<string>;
            explicitFlag: boolean;
            count: number;
        }
    >();

    const sameMonthCharges = new Map<
        string,
        Array<{ dateStr: string; dateObj: Date; cents: number; merchant: string; inst: string }>
    >();

    const avoidableFees: AvoidableFeeItem[] = [];
    let avoidableFeesCents = 0;

    const categoryAmountsMap = new Map<string, Array<{ tx: typeof classified[number]; cents: number; dateStr: string; inst: string }>>();
    let currentMonthDiscretionaryCents = 0;

    for (const tx of classified) {
        if (!isStrictOperationalTransaction(tx, familyLowerNames)) continue;
        if (tx.is_refund || String(tx.operation_type || '').toUpperCase() === 'REFUND') continue;

        const txTypeUpper = String(tx.type || '').toUpperCase();
        const opTypeUpper = String(tx.operation_type || '').toUpperCase();
        const isExpense = tx.amount < 0 || txTypeUpper === 'DEBIT' || opTypeUpper === 'CREDIT_CARD';
        if (!isExpense) continue;

        const absCents = Math.abs(toCents(tx.amount));
        if (absCents === 0) continue;

        const txDateObj = parseLocalDate(tx.date);
        const dateStr = formatLocalDateKey(txDateObj);
        const yearMonth = dateStr.slice(0, 7);
        const instName = (tx.account_id && accountInstMap.get(tx.account_id)) || 'Banco';
        const cleanDesc = (tx.clean_description || tx.description || 'Despesa').trim();
        const rawLower = `${cleanDesc} ${tx.raw_description || ''} ${tx.description || ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const catName = (tx.category_pt || tx.category || 'Outros').trim();
        const catLower = catName.toLowerCase();

        // 1. Tarifas, Anuidades e Encargos Evitáveis (últimos 90 dias)
        const daysSinceTx = Math.round((anchor.getTime() - txDateObj.getTime()) / 86_400_000);
        if (daysSinceTx >= 0 && daysSinceTx <= 90) {
            let feeCat: AvoidableFeeItem['feeCategory'] | null = null;
            if (FEE_KEYWORDS_ANUIDADE.some((k) => rawLower.includes(k))) {
                feeCat = 'ANUIDADE';
            } else if (FEE_KEYWORDS_TARIFA.some((k) => rawLower.includes(k))) {
                feeCat = 'TARIFA_PACOTE';
            } else if (FEE_KEYWORDS_IOF_JUROS.some((k) => rawLower.includes(k))) {
                feeCat = 'IOF_JUROS_ENCARGOS';
            }

            if (feeCat) {
                avoidableFeesCents += absCents;
                avoidableFees.push({
                    description: cleanDesc,
                    institutionName: instName,
                    amount: fromCents(absCents),
                    date: dateStr,
                    feeCategory: feeCat,
                });
            }
        }

        // 2. Assinaturas Recorrentes (flag explícita + recorrência mensal exata sem varejo cotidiano)
        const totalInst = Number(tx.original.total_installments) || 0;
        const isEverydayVariableRetail =
            catLower.includes('supermercado') ||
            catLower.includes('mercado') ||
            catLower.includes('delivery') ||
            catLower.includes('alimenta') ||
            catLower.includes('combust') ||
            catLower.includes('farmac') ||
            catLower.includes('transporte');

        if (totalInst <= 1 && (Boolean(tx.original.is_subscription) || !isEverydayVariableRetail)) {
            const subKey = cleanDesc.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
            if (subKey.length >= 3) {
                const existingSub = subGroups.get(subKey);
                if (!existingSub) {
                    subGroups.set(subKey, {
                        merchantName: cleanDesc,
                        institutionName: instName,
                        latestCents: absCents,
                        latestDate: dateStr,
                        monthsSeen: new Set([yearMonth]),
                        explicitFlag: Boolean(tx.original.is_subscription),
                        count: 1,
                    });
                } else {
                    const isFixedPrice =
                        Math.abs(existingSub.latestCents - absCents) <=
                        Math.min(300, Math.round(existingSub.latestCents * 0.02));
                    if (isFixedPrice || tx.original.is_subscription) {
                        existingSub.monthsSeen.add(yearMonth);
                        existingSub.count += 1;
                        if (tx.original.is_subscription) existingSub.explicitFlag = true;
                        if (dateStr > existingSub.latestDate) {
                            existingSub.latestDate = dateStr;
                            existingSub.latestCents = absCents;
                        }
                    }
                }
            }
        }

        // 3. Cobranças Duplicadas no Mesmo Mês (mesmo merchant + mesmo centavo em janela <= 5 dias, sem parcela distinta)
        if (yearMonth === currentMonthPrefix && absCents >= 1000 && totalInst <= 1) {
            const dupKey = `${yearMonth}_${absCents}_${cleanDesc.toLowerCase().slice(0, 20)}`;
            const bucket = sameMonthCharges.get(dupKey) ?? [];
            bucket.push({ dateStr, dateObj: txDateObj, cents: absCents, merchant: cleanDesc, inst: instName });
            sameMonthCharges.set(dupKey, bucket);
        }

        // 4. Consumo por Impulso / Supérfluo no Mês Atual & Coleta Estatística por Categoria
        if (
            yearMonth === currentMonthPrefix &&
            DISCRETIONARY_KEYWORDS.some((kw) => rawLower.includes(kw) || catLower.includes(kw))
        ) {
            currentMonthDiscretionaryCents += absCents;
        }

        const catBucket = categoryAmountsMap.get(catName) ?? [];
        catBucket.push({ tx, cents: absCents, dateStr, inst: instName });
        categoryAmountsMap.set(catName, catBucket);
    }

    // Consolida Assinaturas
    const subscriptionItems: AuditedSubscriptionItem[] = [];
    let monthlySubsCents = 0;
    for (const info of subGroups.values()) {
        // Exige flag explícita ou cobrança recorrente em >= 2 meses distintos (excluindo supermercados/transporte diário)
        const isFrequentDaily = info.count > info.monthsSeen.size * 2;
        if (info.explicitFlag || (info.monthsSeen.size >= 2 && !isFrequentDaily && info.latestCents <= 100_000)) {
            monthlySubsCents += info.latestCents;
            subscriptionItems.push({
                merchantName: info.merchantName,
                institutionName: info.institutionName,
                monthlyAmount: fromCents(info.latestCents),
                annualizedAmount: fromCents(info.latestCents * 12),
                lastChargeDate: info.latestDate,
                occurrencesDetected: info.count,
            });
        }
    }
    subscriptionItems.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

    // Consolida Duplicidades Suspeitas
    const duplicateItems: DuplicateChargeAnomaly[] = [];
    let duplicateRefundCents = 0;
    for (const entries of sameMonthCharges.values()) {
        if (entries.length < 2) continue;
        entries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        for (let i = 1; i < entries.length; i++) {
            const daysApart = Math.round(
                Math.abs(entries[i].dateObj.getTime() - entries[i - 1].dateObj.getTime()) / 86_400_000
            );
            if (daysApart <= 3) {
                duplicateRefundCents += entries[i].cents;
                duplicateItems.push({
                    merchantName: entries[i].merchant,
                    institutionName: entries[i].inst,
                    amount: fromCents(entries[i].cents),
                    firstDate: entries[i - 1].dateStr,
                    duplicateDate: entries[i].dateStr,
                    daysApart,
                });
            }
        }
    }

    // Consolida Outliers Estatísticos (Leave-One-Out Z-Score sobre histórico da categoria, imune ao limite de Shiffler)
    const outliers: ImpulseOutlierItem[] = [];
    let outlierTotalCents = 0;

    for (const [catName, list] of categoryAmountsMap.entries()) {
        if (list.length < 4) continue;
        const amounts = list.map((x) => fromCents(x.cents));

        for (let idx = 0; idx < list.length; idx++) {
            const item = list[idx];
            const val = amounts[idx];
            const daysAgo = Math.round(
                (anchor.getTime() - parseLocalDate(item.dateStr).getTime()) / 86_400_000
            );
            if (val < 100 || daysAgo < 0 || daysAgo > 45) continue;

            // Baseline excluindo a própria observação testada (evita que o próprio outlier infle a variância)
            const baseline = amounts.filter((_, j) => j !== idx);
            if (baseline.length < 3) continue;

            const mean = baseline.reduce((s, v) => s + v, 0) / baseline.length;
            const variance =
                baseline.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (baseline.length - 1);
            const rawStdDev = Math.sqrt(variance);
            const effectiveStdDev = Math.max(rawStdDev, mean * 0.15, 20);
            const zScore = (val - mean) / effectiveStdDev;

            if (zScore >= 2.2 && val >= mean * 1.6) {
                outlierTotalCents += item.cents;
                outliers.push({
                    description: (
                        item.tx.clean_description ||
                        item.tx.description ||
                        'Despesa Atípica'
                    ).trim(),
                    category: catName,
                    institutionName: item.inst,
                    amount: val,
                    date: item.dateStr,
                    categoryMean: truncateDecimal(mean, 2),
                    categoryStdDev: truncateDecimal(effectiveStdDev, 2),
                    zScore: truncateDecimal(zScore, 2),
                });
            }
        }
    }
    outliers.sort((a, b) => b.zScore - a.zScore);

    const monthlyAvgFeesCents = Math.round(avoidableFeesCents / 3);
    const recoverableMonthlyCents =
        duplicateRefundCents + monthlyAvgFeesCents + Math.round(currentMonthDiscretionaryCents * 0.25);

    return {
        toolName: 'audit_anomalies_and_subscriptions',
        subscriptions: {
            activeCount: subscriptionItems.length,
            monthlyTotalBRL: fromCents(monthlySubsCents),
            annualizedTotalBRL: fromCents(monthlySubsCents * 12),
            items: subscriptionItems.slice(0, 15),
        },
        duplicateCharges: {
            count: duplicateItems.length,
            potentialRefundTotalBRL: fromCents(duplicateRefundCents),
            items: duplicateItems.slice(0, 10),
        },
        avoidableFees: {
            count: avoidableFees.length,
            totalFeesDetectedBRL: fromCents(avoidableFeesCents),
            annualizedLeakEstimateBRL: fromCents(monthlyAvgFeesCents * 12),
            items: avoidableFees.slice(0, 10),
        },
        impulseAndDiscretionary: {
            currentMonthDiscretionaryBRL: fromCents(currentMonthDiscretionaryCents),
            outlierCount: outliers.length,
            outlierTotalBRL: fromCents(outlierTotalCents),
            outliers: outliers.slice(0, 8),
        },
        totalMonthlyRecoverableLeakBRL: fromCents(recoverableMonthlyCents),
    };
}

// ============================================================================
// CONCILIAÇÃO PROPORCIONAL FAMILIAR DETERMINÍSTICA (SUPORTE AO AGENTE TAKESHI)
// ============================================================================

export interface SharedProportionalSummary {
    hasActiveSharedSpace: boolean;
    membersCount: number;
    userMonthlyIncome: number;
    partnersTotalMonthlyIncome: number;
    householdTotalIncome: number;
    userFairShareWeightPct: number;
    userCurrentMonthExpenses: number;
    partnersCurrentMonthExpenses: number;
    householdTotalExpenses: number;
    userTargetFairContributionBRL: number;
    netSettlementDeltaBRL: number; // > 0 = usuário pagou a mais (a receber); < 0 = usuário deve transferir
}

export function calculateSharedProportionalSummary(
    userData: UserFinancialDataInput,
    userIncomeStmt?: IncomeStatementOutput
): SharedProportionalSummary {
    const stmt = userIncomeStmt ?? toolGetIncomeStatement(userData, 1);
    const userIncome =
        stmt.operationalIncome > 0
            ? stmt.operationalIncome
            : stmt.incomeProfile.monthlyAverageIncome > 0
              ? stmt.incomeProfile.monthlyAverageIncome
              : Number(userData.profile?.monthly_income) || 0;

    const partners = userData.sharedPartners || [];
    const familyCount = (userData.familyMembers || []).length;
    const hasActiveSharedSpace = partners.length > 0 || familyCount > 0;

    let partnersIncomeCents = 0;
    let partnersExpensesCents = 0;

    for (const p of partners) {
        if (p.transactions && p.transactions.length > 0) {
            const pStmt = toolGetIncomeStatement(
                {
                    accounts: p.accounts || [],
                    transactions: p.transactions,
                    profile: { monthly_income: p.monthlyIncome ?? null },
                    referenceDate: userData.referenceDate,
                },
                1
            );
            const pInc =
                pStmt.operationalIncome > 0
                    ? pStmt.operationalIncome
                    : pStmt.incomeProfile.monthlyAverageIncome > 0
                      ? pStmt.incomeProfile.monthlyAverageIncome
                      : Number(p.monthlyIncome) || 0;
            partnersIncomeCents += toCents(pInc);
            partnersExpensesCents += toCents(pStmt.netOperationalExpenses);
        } else if (p.monthlyIncome) {
            partnersIncomeCents += toCents(p.monthlyIncome);
        }
    }

    const userIncomeCents = toCents(userIncome);
    const householdIncomeCents = userIncomeCents + partnersIncomeCents;
    const userExpensesCents = toCents(stmt.netOperationalExpenses);
    const householdExpensesCents = userExpensesCents + partnersExpensesCents;

    const userWeightRatio =
        householdIncomeCents > 0 && partners.length > 0
            ? userIncomeCents / householdIncomeCents
            : partners.length > 0
              ? 1 / (partners.length + 1)
              : 1;

    const userTargetFairCents = Math.round(householdExpensesCents * userWeightRatio);
    const netSettlementDeltaCents = partners.length > 0 ? userExpensesCents - userTargetFairCents : 0;

    return {
        hasActiveSharedSpace,
        membersCount: 1 + Math.max(partners.length, familyCount),
        userMonthlyIncome: fromCents(userIncomeCents),
        partnersTotalMonthlyIncome: fromCents(partnersIncomeCents),
        householdTotalIncome: fromCents(householdIncomeCents),
        userFairShareWeightPct: truncateDecimal(userWeightRatio * 100, 2),
        userCurrentMonthExpenses: fromCents(userExpensesCents),
        partnersCurrentMonthExpenses: fromCents(partnersExpensesCents),
        householdTotalExpenses: fromCents(householdExpensesCents),
        userTargetFairContributionBRL: fromCents(userTargetFairCents),
        netSettlementDeltaBRL: fromCents(netSettlementDeltaCents),
    };
}

// ============================================================================
// BUNDLE CONSOLIDADO & SERIALIZADOR DO BLOCO [ENGINE_MATEMATICO_AUDITADO]
// ============================================================================

export interface AuditedDeterministicBundle {
    balanceSheetAndXRay: BalanceSheetAndXRayOutput;
    incomeStatement: IncomeStatementOutput;
    debtAndCards: DebtAndCardsSimulationOutput;
    fixedIncomeAndGoals: FixedIncomeAndGoalsOutput;
    anomaliesAndLeaks: AnomaliesAndLeaksOutput;
    sharedSpace: SharedProportionalSummary;
}

export function runAllDeterministicMacroTools(
    userData: UserFinancialDataInput,
    options?: {
        periodMonths?: number;
        extraMonthlyBudget?: number;
        fixedIncomeParams?: FixedIncomeSimulationParams;
    }
): AuditedDeterministicBundle {
    const incomeStatement = toolGetIncomeStatement(userData, options?.periodMonths ?? 1);
    const balanceSheetAndXRay = toolGetBalanceSheetAndXRay(userData);
    const debtAndCards = toolSimulateDebtAndCards(userData, options?.extraMonthlyBudget ?? 0);
    const fixedIncomeAndGoals = toolAnalyzeFixedIncomeAndGoals(userData, options?.fixedIncomeParams);
    const anomaliesAndLeaks = toolAuditAnomaliesAndLeaks(userData);
    const sharedSpace = calculateSharedProportionalSummary(userData, incomeStatement);

    return {
        balanceSheetAndXRay,
        incomeStatement,
        debtAndCards,
        fixedIncomeAndGoals,
        anomaliesAndLeaks,
        sharedSpace,
    };
}

/**
 * Formata o bloco `[ENGINE_MATEMATICO_AUDITADO]` para injeção estrita no System Prompt / Contexto
 * antes do envio aos modelos Gemini/Groq (Zero Alucinação Matemática MSLR).
 */
export function formatAuditedMathEngineBlock(bundle: AuditedDeterministicBundle): string {
    const compactPayload = {
        kitsuneScore: bundle.balanceSheetAndXRay.kitsuneScore,
        statusSaudePatrimonial: bundle.balanceSheetAndXRay.statusLabel,
        balancoPatrimonialBRL: bundle.balanceSheetAndXRay.balanceSheet,
        reservaEmergenciaMeses: bundle.balanceSheetAndXRay.emergencyFundMonths,
        exposicaoDescobertaFGC_BRL: bundle.balanceSheetAndXRay.totalUncoveredFGC,
        fgcPorInstituicao: bundle.balanceSheetAndXRay.fgcExposureByInstitution.slice(0, 6),
        custoOportunidadeAnualBRL: bundle.balanceSheetAndXRay.annualOpportunityCostBRL,
        saldoOciosoContaCorrenteBRL: bundle.balanceSheetAndXRay.idleCheckingAmount,
        fluxoOperacionalMesAtual: {
            periodo: `${bundle.incomeStatement.periodStart} a ${bundle.incomeStatement.periodEnd}`,
            entradasOperacionaisReaisBRL: bundle.incomeStatement.operationalIncome,
            saidasOperacionaisBrutasBRL: bundle.incomeStatement.grossOperationalExpenses,
            estornosAbatidosBRL: bundle.incomeStatement.refundsAbated,
            saidasOperacionaisLiquidasBRL: bundle.incomeStatement.netOperationalExpenses,
            transferenciasInternasIgnoradasBRL: bundle.incomeStatement.internalMovementsIgnored,
            poupancaLiquidaMesBRL: bundle.incomeStatement.netSavings,
            margemPoupancaLiquidaPct: bundle.incomeStatement.netSavingsMarginPct,
            ritmoDiarioGastosBRL: bundle.incomeStatement.dailyBurnRate,
            projecaoFechamentoMesBRL: bundle.incomeStatement.projectedMonthEndExpenses,
            top8Categorias: bundle.incomeStatement.topCategories,
            top8Estabelecimentos: bundle.incomeStatement.topMerchants,
        },
        dividasECartoes: {
            coberturaLiquidezFaturas: bundle.debtAndCards.liquidCoverageStatus,
            totalFaturasCartaoBRL: bundle.debtAndCards.totalCreditCardBills,
            totalEmprestimosBRL: bundle.debtAndCards.totalLoansBalance,
            comparativoAvalancheVsSnowball: bundle.debtAndCards.payoffComparison
                ? {
                      mesesAvalanche: bundle.debtAndCards.payoffComparison.avalanche.totalMonths,
                      jurosTotaisAvalancheBRL: bundle.debtAndCards.payoffComparison.avalanche.totalInterestPaid,
                      mesesSnowball: bundle.debtAndCards.payoffComparison.snowball.totalMonths,
                      jurosTotaisSnowballBRL: bundle.debtAndCards.payoffComparison.snowball.totalInterestPaid,
                      economiaJurosAvalancheBRL: bundle.debtAndCards.payoffComparison.interestSavedByAvalanche,
                      mesesEconomizadosAvalanche: bundle.debtAndCards.payoffComparison.monthsSavedByAvalanche,
                      recomendacao: bundle.debtAndCards.payoffComparison.recommendationPtBr,
                  }
                : null,
            antecipacaoParcelasCartao: {
                planosAtivos: bundle.debtAndCards.installmentAdvances.activePlansCount,
                saldoNominalParcelasFuturasBRL:
                    bundle.debtAndCards.installmentAdvances.totalRemainingInstallmentsNominal,
                vereditoConsolidado: bundle.debtAndCards.installmentAdvances.consolidatedVerdict,
            },
        },
        rendaFixaEMetasFisher: {
            taxasMacroReferencia: bundle.fixedIncomeAndGoals.macroRates,
            resumoCarteira: bundle.fixedIncomeAndGoals.portfolioSummary,
            equivalenciaLciVsCdb365d: bundle.fixedIncomeAndGoals.taxEquivalenceBenchmarks.mediumTerm365d,
            equivalenciaLciVsCdb721d: bundle.fixedIncomeAndGoals.taxEquivalenceBenchmarks.longTerm721d,
            projecaoPoderCompraRealFisher: bundle.fixedIncomeAndGoals.realWealthProjection,
        },
        auditoriaForenseEVazamentos: {
            assinaturasRecorrentes: {
                quantidade: bundle.anomaliesAndLeaks.subscriptions.activeCount,
                custoMensalBRL: bundle.anomaliesAndLeaks.subscriptions.monthlyTotalBRL,
                custoAnualBRL: bundle.anomaliesAndLeaks.subscriptions.annualizedTotalBRL,
                principais: bundle.anomaliesAndLeaks.subscriptions.items.slice(0, 8),
            },
            cobrancasDuplicadasSuspeitas: bundle.anomaliesAndLeaks.duplicateCharges,
            tarifasEAnuidadesEvitaveis: {
                quantidade: bundle.anomaliesAndLeaks.avoidableFees.count,
                totalDetectadoBRL: bundle.anomaliesAndLeaks.avoidableFees.totalFeesDetectedBRL,
                projecaoVazamentoAnualBRL: bundle.anomaliesAndLeaks.avoidableFees.annualizedLeakEstimateBRL,
                itens: bundle.anomaliesAndLeaks.avoidableFees.items.slice(0, 5),
            },
            gastosImpulsoEOutliers: bundle.anomaliesAndLeaks.impulseAndDiscretionary,
            vazamentoMensalRecuperavelEstimadoBRL: bundle.anomaliesAndLeaks.totalMonthlyRecoverableLeakBRL,
        },
        espacoCompartilhadoTakeshi: bundle.sharedSpace,
    };

    return `[ENGINE_MATEMATICO_AUDITADO]
${ANTI_HALLUCINATION_SYSTEM_DIRECTIVE}
${JSON.stringify(compactPayload, null, 2)}
[/ENGINE_MATEMATICO_AUDITADO]`;
}
