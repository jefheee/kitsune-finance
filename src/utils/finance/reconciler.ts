/**
 * Kitsune Finance — Motor Determinístico de Reconciliação Open Finance & Calculadora Reversa de Patrimônio
 * Inspirado na arquitetura do Maybe Finance (`auto_transfer_matchable.rb` & `reverse_calculator.rb`) e Firefly III.
 *
 * Regras Inegociáveis:
 * - 100% Determinístico (Zero LLMs em cálculos ou conciliação contábil).
 * - Datas sem hora processadas via `parseLocalDate` (meio-dia local) para eliminar deslocamento UTC no dia 1º do mês.
 * - Aritmética monetária em centavos inteiros (`Math.round(v * 100)`) dentro de `Number.MAX_SAFE_INTEGER`.
 */

import { stripBankingNoise } from './merchant-resolver';

export type TransactionKind =
    | 'standard'
    | 'funds_movement'
    | 'cc_payment'
    | 'loan_payment'
    | 'one_time';

export interface ReconcilerAccount {
    id: string;
    pluggy_account_id?: string | null;
    type?: string | null;
    subtype?: string | null;
    institution_name?: string | null;
    bank_name?: string | null;
}

export interface ReconcilableTransaction {
    id?: string;
    pluggy_transaction_id?: string | null;
    pluggyTransactionId?: string | null;
    account_id?: string | null;
    accountId?: string | null;
    date: string;
    amount: number;
    type?: string | null;
    status?: string | null;
    currency_code?: string | null;
    currencyCode?: string | null;
    description?: string | null;
    clean_description?: string | null;
    cleanDescription?: string | null;
    raw_description?: string | null;
    rawDescription?: string | null;
    category?: string | null;
    category_pt?: string | null;
    categoryPt?: string | null;
    category_original?: string | null;
    categoryOriginal?: string | null;
    operation_type?: string | null;
    operationType?: string | null;
    is_internal_transfer?: boolean;
    isInternalTransfer?: boolean;
    is_refund?: boolean;
    isRefund?: boolean;
    kind?: TransactionKind;
    matched_transfer_id?: string | null;
    reconciled_from_pending_id?: string | null;
}

export interface ReconciledInPlaceUpdate<T extends ReconcilableTransaction = ReconcilableTransaction> {
    existingDbId: string | null;
    previousPendingPluggyId: string;
    newPostedPluggyId: string;
    accountId: string;
    daysDiff: number;
    similarityScore: number;
    reconciled_from_pending_id: string;
    transaction: T & {
        reconciled_from_pending_id: string;
        status: 'POSTED';
    };
}

export interface PendingToPostedReconciliationResult<T extends ReconcilableTransaction = ReconcilableTransaction> {
    /** Transações que correspondem a uma PENDING anterior e devem ser atualizadas in-place */
    inPlaceUpdates: Array<ReconciledInPlaceUpdate<T>>;
    /** Transações genuinamente novas sem par PENDING prévio */
    unmatchedIncoming: T[];
    /** Lista consolidada de todas as transações de entrada já enriquecidas com reconciled_from_pending_id quando aplicável */
    transactions: Array<
        T & {
            reconciled_from_pending_id?: string | null;
            matched_pending_db_id?: string | null;
        }
    >;
}

export type ClassifiedTransaction<T extends ReconcilableTransaction = ReconcilableTransaction> = T & {
    kind: TransactionKind;
    is_internal_transfer: boolean;
    matched_transfer_id: string | null;
};

export interface HistoricalBalancePoint {
    /** Data calendário no formato YYYY-MM-DD */
    date: string;
    /** Saldo / Patrimônio Líquido de fechamento na data */
    balance: number;
    /** Fluxo líquido operacional ocorrido na própria data */
    netFlow: number;
}

export interface ReverseBalanceOptions {
    /** Data âncora de referência para `currentBalance` (default: data local de hoje) */
    referenceDate?: string | Date;
    /** Se true, inclui transferências internas no cálculo (útil apenas para extrato isolado de 1 conta; default: false) */
    includeInternalTransfers?: boolean;
    /** Data de abertura da conta (âncora inicial inspirada no `use_opening_anchor_for_date?` do Maybe Finance) */
    openingAnchorDate?: string | Date;
    /** Saldo inicial na data de abertura da conta (default: 0 quando `openingAnchorDate` é informado) */
    openingAnchorBalance?: number;
    /** Natureza contábil da conta quando calculando extrato individual (`asset` default vs `liability` p/ cartão/empréstimo) */
    accountNature?: 'asset' | 'liability';
}

export interface TransferMatchOptions {
    /** Janela máxima em dias corridos para pareamento entre contas próprias (default: 4, fiel ao Maybe Finance `date - 4..date + 4`) */
    maxDaysWindow?: number;
    /** Conjunto opcional de pares `outId:inId` rejeitados manualmente pelo usuário (`rejected_transfers` do Maybe Finance) */
    rejectedTransferPairs?: ReadonlySet<string>;
}

const MS_PER_DAY = 86_400_000;

/**
 * Converte uma data `YYYY-MM-DD` ou ISO string para `Date` ancorada ao meio-dia local (12:00:00),
 * prevenindo deslocamentos de fuso horário UTC (ex: 2026-10-01 virar 30/09 às 21h no Brasil).
 */
export function parseLocalDate(dateInput: string | Date): Date {
    if (dateInput instanceof Date) {
        if (Number.isNaN(dateInput.getTime())) {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        }
        return new Date(
            dateInput.getFullYear(),
            dateInput.getMonth(),
            dateInput.getDate(),
            12,
            0,
            0,
            0
        );
    }

    const trimmed = String(dateInput || '').trim();
    const isoPrefixMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoPrefixMatch) {
        const year = Number(isoPrefixMatch[1]);
        const month = Number(isoPrefixMatch[2]) - 1;
        const day = Number(isoPrefixMatch[3]);
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    const brFormatMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brFormatMatch) {
        const day = Number(brFormatMatch[1]);
        const month = Number(brFormatMatch[2]) - 1;
        const year = Number(brFormatMatch[3]);
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    const fallback = new Date(trimmed);
    if (Number.isNaN(fallback.getTime())) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    }
    return new Date(
        fallback.getFullYear(),
        fallback.getMonth(),
        fallback.getDate(),
        12,
        0,
        0,
        0
    );
}

/**
 * Formata uma `Date` local em `YYYY-MM-DD` sem conversão para UTC.
 */
export function formatLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Calcula a diferença exata em dias corridos entre duas datas calendário (`dateA - dateB`).
 */
export function calendarDaysDiff(dateA: string | Date, dateB: string | Date): number {
    const a = parseLocalDate(dateA);
    const b = parseLocalDate(dateB);
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcA - utcB) / MS_PER_DAY);
}

/**
 * Converte valor em reais para centavos inteiros com segurança contra imprecisão IEEE 754.
 */
function toCents(amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    const rounded = Math.round(amount * 100);
    if (Math.abs(rounded) > Number.MAX_SAFE_INTEGER) {
        throw new RangeError('Valor monetário excede o limite seguro de precisão inteira (53 bits).');
    }
    return rounded;
}

function fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
}

function getAccountId(tx: ReconcilableTransaction): string {
    return String(tx.account_id || tx.accountId || '').trim();
}

function getPluggyTxId(tx: ReconcilableTransaction): string {
    return String(tx.pluggy_transaction_id || tx.pluggyTransactionId || tx.id || '').trim();
}

function getPrimaryDescription(tx: ReconcilableTransaction): string {
    return String(
        tx.raw_description ||
            tx.rawDescription ||
            tx.description ||
            tx.clean_description ||
            tx.cleanDescription ||
            ''
    ).trim();
}

function getCombinedNormalizedText(tx: ReconcilableTransaction): string {
    const combined = [
        tx.raw_description,
        tx.rawDescription,
        tx.description,
        tx.clean_description,
        tx.cleanDescription,
    ]
        .filter(Boolean)
        .join(' ');

    return combined
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normaliza uma descrição comercial removendo ruído de adquirente, acentos e pontuação
 * para avaliação de similaridade de prefixo entre transações PENDING e POSTED.
 */
export function normalizeCommercialPrefix(description: string): string {
    const { cleanQuery } = stripBankingNoise(description || '');
    return cleanQuery
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\bparcela\s*\d{1,2}\/\d{1,2}\b/g, '')
        .replace(/\b\d{1,2}\/\d{1,2}\b/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calcula o score de similaridade de prefixo comercial no intervalo [0, 1].
 * Retorna >= 0.6 quando há forte correspondência comercial entre a compra pendente e a postada.
 */
export function computeCommercialPrefixSimilarity(descA: string, descB: string): number {
    const normA = normalizeCommercialPrefix(descA);
    const normB = normalizeCommercialPrefix(descB);

    if (!normA || !normB) return 0;
    if (normA === normB) return 1;

    const compactA = normA.replace(/\s+/g, '');
    const compactB = normB.replace(/\s+/g, '');

    if (!compactA || !compactB) return 0;
    if (compactA === compactB) return 1;

    const minLen = Math.min(compactA.length, compactB.length);
    if (minLen >= 3 && (compactA.startsWith(compactB) || compactB.startsWith(compactA))) {
        return 0.92;
    }

    // Verifica comprimento do prefixo contínuo em comum
    let commonPrefix = 0;
    for (let i = 0; i < minLen; i++) {
        if (compactA[i] === compactB[i]) {
            commonPrefix++;
        } else {
            break;
        }
    }

    if (commonPrefix >= 5) {
        return Math.min(0.9, 0.65 + commonPrefix / Math.max(compactA.length, compactB.length) * 0.25);
    }

    if (commonPrefix >= 4 && commonPrefix / minLen >= 0.6) {
        return 0.75;
    }

    // Verifica se o primeiro token comercial significativo (>= 3 letras) é idêntico (ex: "ifood", "uber", "drogasil")
    const firstTokenA = normA.split(' ').find((t) => t.length >= 3);
    const firstTokenB = normB.split(' ').find((t) => t.length >= 3);
    if (firstTokenA && firstTokenB && firstTokenA === firstTokenB) {
        return 0.8;
    }

    return 0;
}

const GENERIC_PENDING_PLACEHOLDER_PATTERNS: RegExp[] = [
    /^$/,
    /^compra(\s+no|\s+de)?\s+cartao(\s+de\s+credito|\s+de\s+debito)?$/i,
    /^autorizacao(\s+pendente)?$/i,
    /^transacao\s+pendente$/i,
    /^pendente$/i,
    /^pagamento\s+processando$/i,
];

function isGenericPendingPlaceholder(description: string): boolean {
    const norm = normalizeCommercialPrefix(description);
    return GENERIC_PENDING_PLACEHOLDER_PATTERNS.some((rx) => rx.test(norm));
}

/**
 * 1. Reconciliação Anti-Duplicidade em Múltiplos Passes de Fidelidade (PENDING -> POSTED)
 * Inspirado em `matchTransactions` do Actual Budget (`loot-core/src/server/accounts/sync.ts`).
 *
 * Quando o Pluggy atualiza uma compra de `PENDING` para `POSTED` gerando um novo `pluggy_transaction_id`,
 * localiza o par correspondente na mesma `account_id` em 3 níveis de fidelidade:
 *  - Nível 1 (Exact ID): Mesmo `pluggy_transaction_id` mudando de `PENDING` para `POSTED`.
 *  - Nível 2 (High Fidelity): Mesma conta, mesmo valor em centavos (`toCents`), `|daysDiff| <= 4` e similaridade comercial `>= 0.6`.
 *  - Nível 3 (Placeholder Pre-Auth): Mesma conta, mesmo valor exato em centavos, `|daysDiff| <= 4`, quando a pré-autorização `PENDING` possuía descrição genérica/vazia de cartão.
 */
export function reconcilePendingToPostedTransactions<
    TIncoming extends ReconcilableTransaction,
    TPending extends ReconcilableTransaction = ReconcilableTransaction,
>(
    incomingTxs: TIncoming[],
    existingPendingTxs: TPending[]
): PendingToPostedReconciliationResult<TIncoming> {
    if (!existingPendingTxs.length || !incomingTxs.length) {
        return {
            inPlaceUpdates: [],
            unmatchedIncoming: [...incomingTxs],
            transactions: incomingTxs.map((tx) => ({
                ...tx,
                reconciled_from_pending_id: tx.reconciled_from_pending_id ?? null,
                matched_pending_db_id: null,
            })),
        };
    }

    // Filtra apenas transações existentes efetivamente pendentes
    const pendingPool = existingPendingTxs.filter((p) => {
        const st = String(p.status || 'PENDING').toUpperCase();
        return st === 'PENDING';
    });

    interface CandidateMatch {
        incomingIdx: number;
        pendingIdx: number;
        fidelityTier: 1 | 2 | 3;
        daysDiff: number;
        absDaysDiff: number;
        similarityScore: number;
    }

    const candidates: CandidateMatch[] = [];

    for (let i = 0; i < incomingTxs.length; i++) {
        const inc = incomingTxs[i];
        const incStatus = String(inc.status || 'POSTED').toUpperCase();
        if (incStatus === 'PENDING') continue;

        const incAccId = getAccountId(inc);
        const incPluggyId = getPluggyTxId(inc);
        const incCents = toCents(inc.amount);
        const incAbsCents = Math.abs(incCents);

        for (let j = 0; j < pendingPool.length; j++) {
            const pend = pendingPool[j];
            const pendAccId = getAccountId(pend);
            const pendPluggyId = getPluggyTxId(pend);

            // Mesma conta bancária/cartão obrigatória quando ambos possuem account_id
            if (incAccId && pendAccId && incAccId !== pendAccId) {
                continue;
            }

            // Passe 1 (Fidelidade Máxima): O Pluggy manteve exatamente o mesmo ID e trocou status PENDING -> POSTED
            if (incPluggyId && pendPluggyId && incPluggyId === pendPluggyId) {
                candidates.push({
                    incomingIdx: i,
                    pendingIdx: j,
                    fidelityTier: 1,
                    daysDiff: calendarDaysDiff(inc.date, pend.date),
                    absDaysDiff: 0,
                    similarityScore: 1,
                });
                continue;
            }

            // Valor idêntico em centavos inteiros
            const pendCents = toCents(pend.amount);
            const signedMatch = incCents === pendCents;
            const sameExplicitDirection =
                Boolean(inc.type && pend.type && inc.type.toUpperCase() === pend.type.toUpperCase()) &&
                incAbsCents === Math.abs(pendCents);

            if (!signedMatch && !sameExplicitDirection) {
                continue;
            }

            // Janela temporal <= 4 dias corridos
            const daysDiff = calendarDaysDiff(inc.date, pend.date);
            const absDaysDiff = Math.abs(daysDiff);
            if (absDaysDiff > 4) {
                continue;
            }

            const pendDesc = getPrimaryDescription(pend);
            const incDesc = getPrimaryDescription(inc);

            // Passe 2 (Alta Fidelidade): Similaridade de prefixo comercial >= 0.6
            const similarityScore = computeCommercialPrefixSimilarity(incDesc, pendDesc);
            if (similarityScore >= 0.6) {
                candidates.push({
                    incomingIdx: i,
                    pendingIdx: j,
                    fidelityTier: 2,
                    daysDiff,
                    absDaysDiff,
                    similarityScore,
                });
                continue;
            }

            // Passe 3 (Fallback Seguro Actual Budget): Pré-autorização genérica/vazia na mesma conta e mesmo valor exato
            if (incAccId && pendAccId && incAccId === pendAccId && isGenericPendingPlaceholder(pendDesc)) {
                candidates.push({
                    incomingIdx: i,
                    pendingIdx: j,
                    fidelityTier: 3,
                    daysDiff,
                    absDaysDiff,
                    similarityScore: 0.5,
                });
            }
        }
    }

    // Ordena por nível de fidelidade (1 -> 2 -> 3), menor distância temporal e maior similaridade comercial
    candidates.sort((a, b) => {
        if (a.fidelityTier !== b.fidelityTier) return a.fidelityTier - b.fidelityTier;
        if (a.absDaysDiff !== b.absDaysDiff) return a.absDaysDiff - b.absDaysDiff;
        return b.similarityScore - a.similarityScore;
    });

    const matchedIncomingIndices = new Map<number, CandidateMatch>();
    const consumedPendingIndices = new Set<number>();

    for (const cand of candidates) {
        if (matchedIncomingIndices.has(cand.incomingIdx)) continue;
        if (consumedPendingIndices.has(cand.pendingIdx)) continue;

        matchedIncomingIndices.set(cand.incomingIdx, cand);
        consumedPendingIndices.add(cand.pendingIdx);
    }

    const inPlaceUpdates: Array<ReconciledInPlaceUpdate<TIncoming>> = [];
    const unmatchedIncoming: TIncoming[] = [];
    const transactions: PendingToPostedReconciliationResult<TIncoming>['transactions'] = [];

    for (let i = 0; i < incomingTxs.length; i++) {
        const inc = incomingTxs[i];
        const match = matchedIncomingIndices.get(i);

        if (match) {
            const pend = pendingPool[match.pendingIdx];
            const prevPendingId = getPluggyTxId(pend);
            const newPostedId = getPluggyTxId(inc);
            const accountId = getAccountId(inc) || getAccountId(pend);

            const updatedTx = {
                ...inc,
                reconciled_from_pending_id: prevPendingId,
                status: 'POSTED' as const,
            };

            inPlaceUpdates.push({
                existingDbId: pend.id ?? null,
                previousPendingPluggyId: prevPendingId,
                newPostedPluggyId: newPostedId,
                accountId,
                daysDiff: match.daysDiff,
                similarityScore: match.similarityScore,
                reconciled_from_pending_id: prevPendingId,
                transaction: updatedTx,
            });

            transactions.push({
                ...updatedTx,
                matched_pending_db_id: pend.id ?? null,
            });
        } else {
            unmatchedIncoming.push(inc);
            transactions.push({
                ...inc,
                reconciled_from_pending_id: inc.reconciled_from_pending_id ?? null,
                matched_pending_db_id: null,
            });
        }
    }

    return {
        inPlaceUpdates,
        unmatchedIncoming,
        transactions,
    };
}

const CC_PAYMENT_PATTERNS: RegExp[] = [
    /\bPAGAMENTO\s+DE\s+FATURA\b/,
    /\bPAGTO\s+DE?\s*FATURA\b/,
    /\bPGTO\s+DE?\s*FATURA\b/,
    /\bPAGAMENTO\s+FATURA\b/,
    /\bFATURA\s+(DO\s+)?CARTAO\b/,
    /\bDEB(ITO)?\s+AUT(OMATICO)?\s+FATURA\b/,
    /\bPAGAMENTO\s+CARTAO\s+CREDITO\b/,
];

const FUNDS_MOVEMENT_PATTERNS: RegExp[] = [
    /\bAPLICACAO\s+(RDB|CDB|LCI|LCA|FUNDO|POUPANCA|INVEST|AUTOMATICA)\b/,
    /\bRESGATE\s+(RDB|CDB|LCI|LCA|FUNDO|POUPANCA|INVEST|AUTOMATICO|DINHEIRO)\b/,
    /\bGUARDAR\s+DINHEIRO\b/,
    /\bDINHEIRO\s+GUARDADO\b/,
    /\bCAIXINHA\b/,
    /\bCOFRINHO\b/,
    /\bTESOURO\s+(DIRETO|SELIC|IPCA|PREFIXADO)\b/,
    /\bTRANSFERENCIA\s+MESMA\s+TITULARIDADE\b/,
    /\bTRANSF\s+ENTRE\s+CONTAS\s+PROPRIAS\b/,
];

const LOAN_PAYMENT_PATTERNS: RegExp[] = [
    /\bPARCELA\s+(DE\s+)?(EMPRESTIMO|FINANCIAMENTO|CREDITO|CONSIGNADO)\b/,
    /\bAMORTIZACAO\s+(DE\s+)?(EMPRESTIMO|FINANCIAMENTO)\b/,
    /\bPRESTACAO\s+(HABITACIONAL|IMOBILIARIA|FINANCIAMENTO)\b/,
    /\bEMPRESTIMO\s+(PESSOAL|CONSIGNADO)\b/,
    /\bFINANCIAMENTO\s+(IMOBILIARIO|VEICULO|ESTUDANTIL)\b/,
];

function classifySingleTransactionKind(
    tx: ReconcilableTransaction,
    isCreditAccount: boolean
): { kind: TransactionKind; isInternalTransfer: boolean } {
    const normText = getCombinedNormalizedText(tx);
    const catOrig = String(tx.category_original || tx.categoryOriginal || '').toLowerCase().trim();
    const catPt = String(tx.category_pt || tx.categoryPt || tx.category || '').toLowerCase().trim();
    const opType = String(tx.operation_type || tx.operationType || '').toUpperCase().trim();

    // 1. Pagamento de fatura de cartão de crédito
    const isCcPayment =
        opType === 'BILL_PAYMENT' ||
        catOrig === 'credit card payment' ||
        catPt === 'pagamento de fatura' ||
        CC_PAYMENT_PATTERNS.some((rx) => rx.test(normText)) ||
        (isCreditAccount && normText === 'PAGAMENTO RECEBIDO');

    if (isCcPayment) {
        return { kind: 'cc_payment', isInternalTransfer: true };
    }

    // 2. Aportes / Resgates de CDB, RDB, Tesouro, Caixinhas e Movimentações Patrimoniais
    const isFundsMovement =
        opType === 'INTERNAL_TRANSFER' ||
        catOrig === 'same person transfer' ||
        catOrig === 'transfer - internal' ||
        catOrig === 'internal transfer' ||
        catOrig === 'automatic investment' ||
        catPt === 'transferência própria' ||
        catPt === 'transferência interna' ||
        catPt === 'investimento automático' ||
        FUNDS_MOVEMENT_PATTERNS.some((rx) => rx.test(normText));

    if (isFundsMovement) {
        return { kind: 'funds_movement', isInternalTransfer: true };
    }

    // 3. Parcelas de empréstimos e financiamentos
    const isLoanPayment =
        catOrig === 'loans and financing' ||
        catOrig === 'loans' ||
        catOrig === 'financing' ||
        catPt === 'empréstimos e financiamentos' ||
        catPt === 'financiamentos' ||
        LOAN_PAYMENT_PATTERNS.some((rx) => rx.test(normText));

    if (isLoanPayment) {
        return { kind: 'loan_payment', isInternalTransfer: false };
    }

    // 4. Preserva marcações explícitas anteriores
    const existingInternal = Boolean(tx.is_internal_transfer ?? tx.isInternalTransfer ?? false);
    if (existingInternal) {
        return { kind: 'funds_movement', isInternalTransfer: true };
    }

    if (tx.kind === 'one_time') {
        return { kind: 'one_time', isInternalTransfer: false };
    }

    return { kind: 'standard', isInternalTransfer: false };
}

function isAccountCreditCard(accMeta?: ReconcilerAccount): boolean {
    const t = String(accMeta?.type || '').toUpperCase();
    const st = String(accMeta?.subtype || '').toUpperCase();
    return t === 'CREDIT' || st === 'CREDIT_CARD';
}

function isAccountLoan(accMeta?: ReconcilerAccount): boolean {
    const t = String(accMeta?.type || '').toUpperCase();
    const st = String(accMeta?.subtype || '').toUpperCase();
    return t === 'LOAN' || st === 'LOAN' || st === 'FINANCING';
}

/**
 * 2. Classificação `kind` + Auto-Transfer Matcher (Fiel ao `auto_transfer_matchable.rb` e `transfer.rb` do Maybe Finance)
 *
 * Isola movimentações patrimoniais (`funds_movement`, `cc_payment`, `loan_payment`) do fluxo de caixa operacional
 * e pareia automaticamente saídas (`amount < 0`) e entradas (`amount > 0`) de mesmo valor em contas
 * distintas do mesmo usuário dentro da janela temporal (default <= 3 dias corridos / 72h, configurável até 4d),
 * preservando `kind` assimétrico conforme a natureza da conta destino (`Transfer.kind_for_account`).
 */
export function classifyAndMatchInternalTransfers<T extends ReconcilableTransaction>(
    transactions: T[],
    userAccounts: ReconcilerAccount[] = [],
    options: TransferMatchOptions = {}
): Array<ClassifiedTransaction<T>> {
    if (!transactions.length) return [];

    const maxDaysWindow = Math.max(0, Math.floor(options.maxDaysWindow ?? 3));
    const rejectedPairs = options.rejectedTransferPairs;

    const accountMap = new Map<string, ReconcilerAccount>();
    for (const acc of userAccounts) {
        if (acc.id) accountMap.set(acc.id, acc);
        if (acc.pluggy_account_id) accountMap.set(acc.pluggy_account_id, acc);
    }
    const restrictToUserAccounts = accountMap.size > 0;

    // Passo 1: Classificação determinística individual
    const classified: Array<ClassifiedTransaction<T>> = transactions.map((tx) => {
        const accId = getAccountId(tx);
        const accMeta = accId ? accountMap.get(accId) : undefined;
        const isCreditAccount = isAccountCreditCard(accMeta);

        const { kind, isInternalTransfer } = classifySingleTransactionKind(tx, isCreditAccount);

        return {
            ...tx,
            kind,
            is_internal_transfer: isInternalTransfer,
            matched_transfer_id: tx.matched_transfer_id ?? null,
        };
    });

    // Passo 2: Auto-Transfer Matcher com ordenação por menor distância temporal (`ORDER BY date_diff ASC`)
    interface TransferCandidate {
        outIdx: number;
        inIdx: number;
        absDaysDiff: number;
    }

    const candidates: TransferCandidate[] = [];

    for (let i = 0; i < classified.length; i++) {
        const txOut = classified[i];
        if (txOut.amount >= 0) continue;
        if (txOut.matched_transfer_id) continue;

        const outRefund = Boolean(txOut.is_refund ?? txOut.isRefund);
        const outOp = String(txOut.operation_type || txOut.operationType || '').toUpperCase();
        // Compras de varejo passadas no cartão de crédito ou estornos não são origem de transferência bancária
        if (outRefund || outOp === 'CREDIT_CARD') continue;

        const outAccId = getAccountId(txOut);
        if (!outAccId) continue;
        if (restrictToUserAccounts && !accountMap.has(outAccId)) continue;

        const absOutCents = Math.abs(toCents(txOut.amount));
        if (absOutCents < 1) continue;

        const outCurrency = String(txOut.currency_code || txOut.currencyCode || 'BRL').toUpperCase();
        const outIdentifier = txOut.id || getPluggyTxId(txOut) || '';

        for (let j = 0; j < classified.length; j++) {
            if (i === j) continue;
            const txIn = classified[j];
            if (txIn.amount <= 0) continue;
            if (txIn.matched_transfer_id) continue;

            const inRefund = Boolean(txIn.is_refund ?? txIn.isRefund);
            const inOp = String(txIn.operation_type || txIn.operationType || '').toUpperCase();
            if (inRefund || inOp === 'REFUND' || inOp === 'CREDIT_CARD') continue;

            const inAccId = getAccountId(txIn);
            if (!inAccId || inAccId === outAccId) continue;
            if (restrictToUserAccounts && !accountMap.has(inAccId)) continue;

            const inIdentifier = txIn.id || getPluggyTxId(txIn) || '';
            if (
                rejectedPairs &&
                outIdentifier &&
                inIdentifier &&
                (rejectedPairs.has(`${outIdentifier}:${inIdentifier}`) ||
                    rejectedPairs.has(`${inIdentifier}:${outIdentifier}`))
            ) {
                continue;
            }

            const absInCents = Math.abs(toCents(txIn.amount));
            const inCurrency = String(txIn.currency_code || txIn.currencyCode || 'BRL').toUpperCase();

            if (outCurrency === inCurrency) {
                // Mesma moeda: igualdade exata em centavos inteiros
                if (absOutCents !== absInCents) continue;
            } else {
                // Multi-moeda (padrão Maybe Finance 0.95..1.05 sobre valores convertidos)
                const ratio = absInCents / absOutCents;
                if (ratio < 0.95 || ratio > 1.05) continue;
            }

            // Diferença de data <= janela configurada (default 3d / 72h)
            const absDaysDiff = Math.abs(calendarDaysDiff(txOut.date, txIn.date));
            if (absDaysDiff > maxDaysWindow) {
                continue;
            }

            candidates.push({ outIdx: i, inIdx: j, absDaysDiff });
        }
    }

    // Prioriza transferências no mesmo dia (D+0), depois D+1, D+2, D+3 (`ORDER BY date_diff ASC`)
    candidates.sort((a, b) => a.absDaysDiff - b.absDaysDiff);

    const pairedIndices = new Set<number>();

    for (const cand of candidates) {
        if (pairedIndices.has(cand.outIdx) || pairedIndices.has(cand.inIdx)) {
            continue;
        }

        const txOut = classified[cand.outIdx];
        const txIn = classified[cand.inIdx];

        const outIdentifier = txOut.id || getPluggyTxId(txOut) || null;
        const inIdentifier = txIn.id || getPluggyTxId(txIn) || null;

        pairedIndices.add(cand.outIdx);
        pairedIndices.add(cand.inIdx);

        // Regra `Transfer.kind_for_account` do Maybe Finance (`app/models/transfer.rb`):
        // Se a conta destino é Cartão de Crédito -> outflow recebe `cc_payment`, inflow recebe `funds_movement`.
        // Se a conta destino é Empréstimo -> outflow recebe `loan_payment`, inflow recebe `funds_movement`.
        // Caso contrário (Conta Corrente <-> Poupança / RDB / Corretora) -> ambos recebem `funds_movement`.
        const inAccMeta = accountMap.get(getAccountId(txIn));
        const isDestCreditCard =
            isAccountCreditCard(inAccMeta) ||
            txOut.kind === 'cc_payment' ||
            txIn.kind === 'cc_payment';
        const isDestLoan = isAccountLoan(inAccMeta) || txOut.kind === 'loan_payment';

        txOut.kind = isDestCreditCard
            ? 'cc_payment'
            : isDestLoan
              ? 'loan_payment'
              : 'funds_movement';
        txOut.is_internal_transfer = true;
        txOut.matched_transfer_id = inIdentifier;

        txIn.kind = 'funds_movement';
        txIn.is_internal_transfer = true;
        txIn.matched_transfer_id = outIdentifier;
    }

    return classified;
}

/**
 * 3. Calculadora Reversa de Patrimônio e Saldos Históricos (`ReverseCalculator`)
 * Inspirada em `app/models/balance/reverse_calculator.rb` do Maybe Finance.
 *
 * Reconstrói a série diária de trás para frente a partir do saldo real de hoje:
 *   `Saldo[D-1] = Saldo[D] - FluxoLiquido[D]` (ou `+ FluxoLiquido[D]` para passivos puros)
 *
 * Suporta `openingAnchorDate` (`use_opening_anchor_for_date?`) para impedir saldos fantasmas antes da
 * abertura da conta, opera integralmente em centavos inteiros e exclui transferências internas por padrão.
 */
export function calculateReverseHistoricalBalances(
    currentBalance: number,
    transactions: Array<{
        date: string;
        amount: number;
        is_internal_transfer?: boolean;
        kind?: TransactionKind;
    }>,
    daysBack: number,
    options: ReverseBalanceOptions = {}
): HistoricalBalancePoint[] {
    const safeDaysBack = Math.max(0, Math.floor(daysBack));
    const anchorDate = parseLocalDate(options.referenceDate ?? new Date());
    const anchorKey = formatLocalDateKey(anchorDate);
    const includeInternal = Boolean(options.includeInternalTransfers);
    const isLiability = options.accountNature === 'liability';
    const openingAnchorKey = options.openingAnchorDate
        ? formatLocalDateKey(parseLocalDate(options.openingAnchorDate))
        : null;
    const openingAnchorCents = toCents(options.openingAnchorBalance ?? 0);

    // Agrupa fluxo líquido diário em centavos inteiros por chave YYYY-MM-DD
    const dailyNetFlowCents = new Map<string, number>();

    for (const tx of transactions) {
        if (!tx || !tx.date || !Number.isFinite(tx.amount)) continue;

        if (!includeInternal) {
            if (
                tx.is_internal_transfer === true ||
                tx.kind === 'funds_movement' ||
                tx.kind === 'cc_payment'
            ) {
                continue;
            }
        }

        const txDate = parseLocalDate(tx.date);
        const txKey = formatLocalDateKey(txDate);

        // Ignora lançamentos futuros (parcelas futuras ainda não liquidadas no saldo atual)
        if (txKey > anchorKey) {
            continue;
        }

        const prevCents = dailyNetFlowCents.get(txKey) || 0;
        dailyNetFlowCents.set(txKey, prevCents + toCents(tx.amount));
    }

    const reverseSeries: HistoricalBalancePoint[] = [];
    let runningBalanceCents = toCents(currentBalance);

    for (let step = 0; step <= safeDaysBack; step++) {
        const targetDate = new Date(
            anchorDate.getFullYear(),
            anchorDate.getMonth(),
            anchorDate.getDate() - step,
            12,
            0,
            0,
            0
        );
        const dateKey = formatLocalDateKey(targetDate);

        // Âncora de abertura (`use_opening_anchor_for_date?` do Maybe Finance)
        if (openingAnchorKey && dateKey < openingAnchorKey) {
            reverseSeries.push({
                date: dateKey,
                balance: fromCents(openingAnchorCents),
                netFlow: 0,
            });
            continue;
        }

        const dayFlowCents = dailyNetFlowCents.get(dateKey) || 0;
        const signedFlowCents = isLiability ? -dayFlowCents : dayFlowCents;

        reverseSeries.push({
            date: dateKey,
            balance: fromCents(runningBalanceCents),
            netFlow: fromCents(dayFlowCents),
        });

        // Saldo[D-1] = Saldo[D] - FluxoAssinado[D]
        runningBalanceCents = runningBalanceCents - signedFlowCents;
    }

    // Retorna em ordem cronológica crescente (do passado mais antigo até hoje)
    return reverseSeries.reverse();
}
