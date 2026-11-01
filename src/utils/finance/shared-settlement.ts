/**
 * Kitsune Finance — Reconciliador Dinâmico Familiar & Algoritmo "Pix de Acerto Único"
 *
 * REGRAS INEGOCIÁVEIS (BLINDAGEM MSLR):
 * - 100% Determinístico em TypeScript estrito (Zero uso de LLM para cálculos de divisão).
 * - Aritmética inteira estrita em centavos (`toCents` / `fromCents`) com Método do Maior Resto (Hamilton)
 *   garantindo invariante contábil exata: sum(fairShareCents) === totalSharedExpensesCents e sum(netBalanceCents) === 0.
 * - Algoritmo Greedy Minimum Cash Flow para liquidação no menor número absoluto de transferências Pix
 *   (para um casal/duo, resulta matematicamente em no máximo 1 único Pix exato).
 */

import { truncateDecimal } from '@/utils/finance/engine/cdi';

export type SharedSplitMode = 'proportional' | 'equal';

export interface SharedMemberContributionInput {
    memberId: string;
    memberName: string;
    role?: string | null;
    isSelf?: boolean;
    /** Renda líquida mensal auditada (ou declarada) em R$ */
    auditedNetIncomeBRL: number;
    /** Total de despesas compartilhadas efetivamente pagas por este membro no mês em R$ */
    paidSharedExpensesBRL: number;
}

export interface SharedSettlementInput {
    mode: SharedSplitMode;
    members: SharedMemberContributionInput[];
    referenceMonthLabel?: string;
}

export interface SharedMemberSettlementBreakdown {
    memberId: string;
    memberName: string;
    role: string;
    isSelf: boolean;
    auditedNetIncomeBRL: number;
    /** Peso exato de contribuição entre 0 e 1 */
    weightRatio: number;
    /** Peso percentual formatável (0 a 100) */
    weightPct: number;
    /** Valor efetivamente pago pelo membro no mês (R$) */
    paidAmountBRL: number;
    paidAmountCents: number;
    /** Cota justa devida pelo membro (R$) */
    fairShareBRL: number;
    fairShareCents: number;
    /** Saldo líquido de acerto: > 0 credor (recebe), < 0 devedor (paga), 0 quitado */
    netBalanceBRL: number;
    netBalanceCents: number;
    status: 'CREDITOR' | 'DEBTOR' | 'SETTLED';
    /** Percentual da cota justa já cumprido pelo pagamento direto (ex: 135% se pagou além da cota) */
    quotaFulfillmentPct: number;
}

export interface MinimumSettlementTransfer {
    fromMemberId: string;
    fromMember: string;
    toMemberId: string;
    toMember: string;
    amountCents: number;
    amountBRL: number;
    explanationPtBr: string;
}

export interface SharedSettlementResult {
    mode: SharedSplitMode;
    modeLabelPtBr: string;
    usedFallbackEqualWeights: boolean;
    totalHouseholdIncomeBRL: number;
    totalSharedExpensesBRL: number;
    totalSharedExpensesCents: number;
    isAlreadyBalanced: boolean;
    members: SharedMemberSettlementBreakdown[];
    transfers: MinimumSettlementTransfer[];
    summaryHeadlinePtBr: string;
}

const MAX_SAFE_BRL = 9_000_000_000_000;

function toCents(value: number | string | null | undefined): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const clamped = Math.max(-MAX_SAFE_BRL, Math.min(MAX_SAFE_BRL, num));
    return Math.round(clamped * 100);
}

function fromCents(cents: number): number {
    if (!Number.isFinite(cents)) return 0;
    return truncateDecimal(cents / 100, 2);
}

function formatBRLStatic(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number(value) || 0);
}

/**
 * Executa o algoritmo Greedy Minimum Cash Flow sobre saldos líquidos em centavos cuja soma é zero,
 * gerando o menor número possível de transferências Pix para zerar todos os membros simultaneamente.
 */
export function settleBalancesMinimumTransfers(
    balances: ReadonlyArray<{ memberId: string; memberName: string; netBalanceCents: number }>
): MinimumSettlementTransfer[] {
    interface MutableNode {
        memberId: string;
        memberName: string;
        remainingCents: number;
    }

    const creditors: MutableNode[] = [];
    const debtors: MutableNode[] = [];

    for (const item of balances) {
        if (item.netBalanceCents > 0) {
            creditors.push({
                memberId: item.memberId,
                memberName: item.memberName,
                remainingCents: item.netBalanceCents,
            });
        } else if (item.netBalanceCents < 0) {
            debtors.push({
                memberId: item.memberId,
                memberName: item.memberName,
                remainingCents: Math.abs(item.netBalanceCents),
            });
        }
    }

    const transfers: MinimumSettlementTransfer[] = [];
    let safetyCounter = 0;
    const maxSteps = balances.length * 4 + 8;

    while (creditors.length > 0 && debtors.length > 0 && safetyCounter < maxSteps) {
        safetyCounter++;

        // Prioriza primeiro pares de valor idêntico (cancelamento 1-para-1 exato), depois maior saldo absoluto
        let matchedDebtorIdx = 0;
        let matchedCreditorIdx = 0;
        let foundExactPair = false;

        for (let dIdx = 0; dIdx < debtors.length && !foundExactPair; dIdx++) {
            for (let cIdx = 0; cIdx < creditors.length; cIdx++) {
                if (debtors[dIdx].remainingCents === creditors[cIdx].remainingCents) {
                    matchedDebtorIdx = dIdx;
                    matchedCreditorIdx = cIdx;
                    foundExactPair = true;
                    break;
                }
            }
        }

        if (!foundExactPair) {
            creditors.sort((a, b) => b.remainingCents - a.remainingCents);
            debtors.sort((a, b) => b.remainingCents - a.remainingCents);
            matchedDebtorIdx = 0;
            matchedCreditorIdx = 0;
        }

        const debtor = debtors[matchedDebtorIdx];
        const creditor = creditors[matchedCreditorIdx];
        const settleCents = Math.min(debtor.remainingCents, creditor.remainingCents);

        if (settleCents > 0) {
            const amountBRL = fromCents(settleCents);
            transfers.push({
                fromMemberId: debtor.memberId,
                fromMember: debtor.memberName,
                toMemberId: creditor.memberId,
                toMember: creditor.memberName,
                amountCents: settleCents,
                amountBRL,
                explanationPtBr: `${debtor.memberName} transfere ${formatBRLStatic(amountBRL)} via Pix para ${creditor.memberName} para liquidar 100% da diferença do mês.`,
            });
        }

        debtor.remainingCents -= settleCents;
        creditor.remainingCents -= settleCents;

        if (debtor.remainingCents <= 0) {
            debtors.splice(matchedDebtorIdx, 1);
        }
        if (creditor.remainingCents <= 0) {
            creditors.splice(matchedCreditorIdx, 1);
        }
    }

    return transfers;
}

/**
 * Calcula a divisão justa (Proporcional à Renda Líquida Auditada ou 50/50 Igualitária)
 * e emite o plano determinístico de liquidação mínima ("Pix de Acerto Único").
 */
export function calculateSharedSettlement(input: SharedSettlementInput): SharedSettlementResult {
    const mode: SharedSplitMode = input.mode === 'equal' ? 'equal' : 'proportional';
    const rawMembers = input.members || [];

    if (rawMembers.length === 0) {
        return {
            mode,
            modeLabelPtBr:
                mode === 'proportional'
                    ? 'Proporcional à Renda Líquida'
                    : 'Divisão Igualitária (50/50)',
            usedFallbackEqualWeights: false,
            totalHouseholdIncomeBRL: 0,
            totalSharedExpensesBRL: 0,
            totalSharedExpensesCents: 0,
            isAlreadyBalanced: true,
            members: [],
            transfers: [],
            summaryHeadlinePtBr: 'Adicione membros ao Espaço Compartilhado para calcular o acerto.',
        };
    }

    const memberCount = rawMembers.length;
    const sanitizedMembers = rawMembers.map((m, idx) => {
        const incomeCents = Math.max(0, toCents(m.auditedNetIncomeBRL));
        const paidCents = Math.max(0, toCents(m.paidSharedExpensesBRL));
        return {
            memberId: m.memberId || `member-${idx}`,
            memberName: (m.memberName || `Membro ${idx + 1}`).trim(),
            role: (m.role || (m.isSelf ? 'Titular Principal' : 'Membro')).trim(),
            isSelf: Boolean(m.isSelf),
            incomeCents,
            paidCents,
            index: idx,
        };
    });

    const totalIncomeCents = sanitizedMembers.reduce((sum, m) => sum + m.incomeCents, 0);
    const totalSharedExpensesCents = sanitizedMembers.reduce((sum, m) => sum + m.paidCents, 0);

    const usedFallbackEqualWeights = mode === 'proportional' && totalIncomeCents <= 0;

    const weights = sanitizedMembers.map((m) => {
        if (mode === 'equal' || usedFallbackEqualWeights) {
            return 1 / memberCount;
        }
        return m.incomeCents / totalIncomeCents;
    });

    // Distribuição exata em centavos pelo Método do Maior Resto (Hamilton)
    const exactShares = weights.map((w) => totalSharedExpensesCents * w);
    const floorShares = exactShares.map((val) => Math.floor(val));
    let remainderCents =
        totalSharedExpensesCents - floorShares.reduce((sum, val) => sum + val, 0);

    const remainderOrder = sanitizedMembers
        .map((m, idx) => ({
            idx,
            fractional: exactShares[idx] - floorShares[idx],
            incomeCents: m.incomeCents,
        }))
        .sort((a, b) => {
            if (Math.abs(b.fractional - a.fractional) > 1e-9) {
                return b.fractional - a.fractional;
            }
            if (b.incomeCents !== a.incomeCents) {
                return b.incomeCents - a.incomeCents;
            }
            return a.idx - b.idx;
        });

    for (let k = 0; k < remainderOrder.length && remainderCents > 0; k++) {
        floorShares[remainderOrder[k].idx] += 1;
        remainderCents -= 1;
    }

    const memberBreakdowns: SharedMemberSettlementBreakdown[] = sanitizedMembers.map((m, idx) => {
        const fairShareCents = floorShares[idx];
        const netBalanceCents = m.paidCents - fairShareCents;
        const weightRatio = weights[idx];
        const weightPct = truncateDecimal(weightRatio * 100, 1);

        let status: SharedMemberSettlementBreakdown['status'] = 'SETTLED';
        if (netBalanceCents > 0) status = 'CREDITOR';
        else if (netBalanceCents < 0) status = 'DEBTOR';

        const quotaFulfillmentPct =
            fairShareCents > 0
                ? truncateDecimal((m.paidCents / fairShareCents) * 100, 1)
                : m.paidCents > 0
                  ? 100
                  : 0;

        return {
            memberId: m.memberId,
            memberName: m.memberName,
            role: m.role,
            isSelf: m.isSelf,
            auditedNetIncomeBRL: fromCents(m.incomeCents),
            weightRatio: truncateDecimal(weightRatio, 6),
            weightPct,
            paidAmountBRL: fromCents(m.paidCents),
            paidAmountCents: m.paidCents,
            fairShareBRL: fromCents(fairShareCents),
            fairShareCents,
            netBalanceBRL: fromCents(netBalanceCents),
            netBalanceCents,
            status,
            quotaFulfillmentPct,
        };
    });

    const transfers = settleBalancesMinimumTransfers(
        memberBreakdowns.map((m) => ({
            memberId: m.memberId,
            memberName: m.memberName,
            netBalanceCents: m.netBalanceCents,
        }))
    );

    const isAlreadyBalanced = transfers.length === 0;
    const modeLabelPtBr =
        mode === 'proportional'
            ? 'Proporcional à Renda Líquida'
            : memberCount === 2
              ? 'Divisão 50/50 Igualitária'
              : `Divisão Igualitária (1/${memberCount})`;

    let summaryHeadlinePtBr = 'As contas compartilhadas do mês estão 100% equilibradas.';
    if (transfers.length === 1) {
        const single = transfers[0];
        summaryHeadlinePtBr = `Pix Único de ${formatBRLStatic(single.amountBRL)}: ${single.fromMember} → ${single.toMember}`;
    } else if (transfers.length > 1) {
        summaryHeadlinePtBr = `Liquidação ótima calculada em ${transfers.length} transferências Pix mínimas.`;
    }

    return {
        mode,
        modeLabelPtBr,
        usedFallbackEqualWeights,
        totalHouseholdIncomeBRL: fromCents(totalIncomeCents),
        totalSharedExpensesBRL: fromCents(totalSharedExpensesCents),
        totalSharedExpensesCents,
        isAlreadyBalanced,
        members: memberBreakdowns,
        transfers,
        summaryHeadlinePtBr,
    };
}

/**
 * Gera resumo limpo e auditado pronto para compartilhamento no WhatsApp do casal/família.
 */
export function buildSharedSettlementWhatsAppText(
    settlement: SharedSettlementResult,
    formatValue: (val: number) => string,
    referenceLabel?: string
): string {
    const header = referenceLabel
        ? `🦊 *Acerto Inteligente Kitsune — ${referenceLabel}*`
        : '🦊 *Acerto Inteligente do Mês — Kitsune Finance*';

    const lines: string[] = [
        header,
        `📐 Critério: *${settlement.modeLabelPtBr}*`,
        `🧾 Despesas Compartilhadas Pagas: *${formatValue(settlement.totalSharedExpensesBRL)}*`,
        '',
        '*Resumo por Integrante:*',
    ];

    for (const m of settlement.members) {
        lines.push(
            `• *${m.memberName}* (${m.weightPct}%): pagou ${formatValue(m.paidAmountBRL)} | cota justa ${formatValue(m.fairShareBRL)}`
        );
    }

    lines.push('');
    if (settlement.isAlreadyBalanced) {
        lines.push('✅ *Status:* Contas 100% equilibradas neste mês! Nenhum Pix necessário.');
    } else {
        lines.push('⚡ *Pix de Liquidação Mínima:*');
        for (const t of settlement.transfers) {
            lines.push(`👉 *${t.fromMember}* envia *${formatValue(t.amountBRL)}* para *${t.toMember}*`);
        }
    }

    return lines.join('\n');
}
