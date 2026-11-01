import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncItemAccountsAndTransactions, type SyncResult } from '@/utils/pluggy/sync';
import {
    reconcilePendingToPostedTransactions,
    classifyAndMatchInternalTransfers,
    calculateReverseHistoricalBalances,
    calendarDaysDiff,
    type ReconcilableTransaction,
    type ReconcilerAccount,
} from '@/utils/finance/reconciler';
import { enrichTransactionBatch } from '@/utils/finance/enrichment-pipeline';

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
    if (!err) return false;
    const msg = String(err.message || '');
    return (
        err.code === '42703' ||
        err.code === 'PGRST204' ||
        msg.includes('column') ||
        msg.includes('schema cache')
    );
}

/**
 * Kitsune Finance — Open Finance API Route (v2.0)
 * GET: Retorna o portfólio autenticado reconciliado (`kind`, `matched_transfer_id`),
 *      fluxo operacional blindado e curvas históricas reversas de Patrimônio Líquido e Liquidez.
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const url = new URL(request.url);
        const daysBackParam = Number(url.searchParams.get('daysBack') || 90);
        const daysBack = Number.isFinite(daysBackParam)
            ? Math.min(365, Math.max(7, Math.floor(daysBackParam)))
            : 90;
        const limitParam = Number(url.searchParams.get('limit') || 50);
        const responseTxLimit = Number.isFinite(limitParam)
            ? Math.min(1500, Math.max(10, Math.floor(limitParam)))
            : 50;

        // 1. Buscar contas, investimentos, empréstimos, transações e contagem de conexões em paralelo
        const [
            { data: accounts, error: accError },
            { data: investments, error: invError },
            { data: loans, error: loanError },
            { data: transactions, error: txError },
            { count: connectionsCount },
        ] = await Promise.all([
            supabase.from('bank_accounts').select('*').eq('user_id', user.id),
            supabase.from('investments').select('*').eq('user_id', user.id),
            supabase.from('loans').select('*').eq('user_id', user.id),
            supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .limit(1500),
            supabase
                .from('pluggy_connections')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id),
        ]);

        if (accError) console.error('[OpenFinance API] Erro ao buscar contas:', accError);
        if (invError) console.error('[OpenFinance API] Erro ao buscar investimentos:', invError);
        if (loanError) console.error('[OpenFinance API] Erro ao buscar empréstimos:', loanError);
        if (txError) console.error('[OpenFinance API] Erro ao buscar transações:', txError);

        const safeAccounts = accounts || [];
        const safeInvestments = investments || [];
        const safeLoans = loans || [];
        const rawTransactions = (transactions || []) as Array<
            ReconcilableTransaction & Record<string, unknown>
        >;

        // 2. Classificação determinística `kind` + Auto-Transfer Matcher (72h)
        const reconciledTransactions = classifyAndMatchInternalTransfers(
            rawTransactions,
            safeAccounts as ReconcilerAccount[]
        );

        // 3. Cálculos Patrimoniais Determinísticos
        const liquidBalance = safeAccounts
            .filter(
                (a) =>
                    a.type === 'CHECKING' ||
                    a.type === 'SAVINGS' ||
                    a.type === 'BANK' ||
                    a.subtype === 'CHECKING_ACCOUNT' ||
                    a.subtype === 'SAVINGS_ACCOUNT'
            )
            .filter((a) => a.type !== 'CREDIT' && a.subtype !== 'CREDIT_CARD')
            .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

        const creditCardDebt = safeAccounts
            .filter((a) => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD')
            .reduce((sum, a) => sum + Math.abs(Number(a.balance) || 0), 0);

        const totalInvested = safeInvestments.reduce(
            (sum, inv) => sum + (Number(inv.balance) || 0),
            0
        );

        const totalLoanDebt = safeLoans.reduce(
            (sum, l) => sum + (Number(l.outstanding_balance ?? l.balance_due) || 0),
            0
        );

        const totalDebt = Number((creditCardDebt + totalLoanDebt).toFixed(2));
        const netWorth = Number((liquidBalance + totalInvested - totalDebt).toFixed(2));

        // 4. Fluxo Operacional de 30 dias (isolado de `funds_movement` e `cc_payment`)
        const now = new Date();
        let operationalIncome30d = 0;
        let operationalExpenses30d = 0;

        for (const tx of reconciledTransactions) {
            if (
                tx.is_internal_transfer ||
                tx.kind === 'funds_movement' ||
                tx.kind === 'cc_payment'
            ) {
                continue;
            }
            const ageDays = calendarDaysDiff(now, tx.date);
            if (ageDays < 0 || ageDays > 30) continue;

            if (tx.amount > 0 && !tx.is_refund) {
                operationalIncome30d += tx.amount;
            } else if (tx.amount < 0) {
                operationalExpenses30d += Math.abs(tx.amount);
            } else if (tx.amount > 0 && tx.is_refund) {
                // Estornos abatem diretamente as despesas operacionais
                operationalExpenses30d = Math.max(0, operationalExpenses30d - tx.amount);
            }
        }

        // 5. Calculadora Reversa de Patrimônio Líquido e Liquidez
        const historicalNetWorth = calculateReverseHistoricalBalances(
            netWorth,
            reconciledTransactions,
            daysBack
        );
        const historicalLiquidBalance = calculateReverseHistoricalBalances(
            liquidBalance,
            reconciledTransactions,
            daysBack
        );

        const portfolio = {
            user_id: user.id,
            connections_count: connectionsCount || 0,
            total_balance: Number(liquidBalance.toFixed(2)),
            total_invested: Number(totalInvested.toFixed(2)),
            total_debt: totalDebt,
            credit_card_debt: Number(creditCardDebt.toFixed(2)),
            net_worth: netWorth,
            operational_income_30d: Number(operationalIncome30d.toFixed(2)),
            operational_expenses_30d: Number(operationalExpenses30d.toFixed(2)),
            historical_net_worth: historicalNetWorth,
            historical_liquid_balance: historicalLiquidBalance,
            reconciliation_summary: {
                total_analyzed: reconciledTransactions.length,
                internal_movements: reconciledTransactions.filter((t) => t.is_internal_transfer)
                    .length,
                matched_transfer_pairs: Math.floor(
                    reconciledTransactions.filter((t) => Boolean(t.matched_transfer_id)).length / 2
                ),
            },
            accounts: safeAccounts,
            investments: safeInvestments,
            loans: safeLoans,
            transactions: reconciledTransactions.slice(0, responseTxLimit),
            last_sync: new Date().toISOString(),
        };

        return NextResponse.json(portfolio);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[OpenFinance API GET Error]', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * POST /api/openfinance
 * Executa sincronização Open Finance (opcional por `itemId` ou `syncAll`) e/ou roda o pipeline
 * completo de Reconciliação Anti-Duplicidade + Enriquecimento Comercial 3 Camadas na base do usuário,
 * mantendo 100% de retrocompatibilidade caso colunas novas ainda não tenham sido migradas.
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        let body: {
            itemId?: string;
            providerName?: string;
            familyMemberId?: string | null;
            syncAll?: boolean;
            enableAiFallback?: boolean;
        } = {};

        try {
            body = await request.json();
        } catch {
            // Permite chamada POST sem body para disparar reconciliação & enriquecimento do portfólio atual
        }

        const syncResults: SyncResult[] = [];

        // 1. Se solicitado sync explícito de item(s) na Pluggy
        if (body.itemId && typeof body.itemId === 'string') {
            const res = await syncItemAccountsAndTransactions(supabase, {
                itemId: body.itemId,
                userId: user.id,
                familyMemberId: body.familyMemberId || null,
                providerName: body.providerName,
            });
            syncResults.push(res);
        } else if (body.syncAll) {
            const { data: userConns } = await supabase
                .from('pluggy_connections')
                .select('item_id, provider_name, family_member_id')
                .eq('user_id', user.id)
                .eq('status', 'CONNECTED');

            if (Array.isArray(userConns)) {
                for (const conn of userConns) {
                    if (!conn.item_id) continue;
                    const res = await syncItemAccountsAndTransactions(supabase, {
                        itemId: String(conn.item_id),
                        userId: user.id,
                        familyMemberId: conn.family_member_id ? String(conn.family_member_id) : null,
                        providerName: conn.provider_name ? String(conn.provider_name) : undefined,
                    });
                    syncResults.push(res);
                }
            }
        }

        // 2. Reconciliação + Enriquecimento Comercial em Lote sobre as transações persistidas do usuário
        const [{ data: accounts }, { data: existingRows }] = await Promise.all([
            supabase
                .from('bank_accounts')
                .select('id, pluggy_account_id, type, subtype, institution_name, bank_name')
                .eq('user_id', user.id),
            supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .limit(500),
        ]);

        const safeAccounts = (accounts || []) as ReconcilerAccount[];
        const rows = (existingRows || []) as Array<ReconcilableTransaction & Record<string, unknown>>;

        let dedupedPendingCount = 0;
        let enrichedMerchantsCount = 0;
        let newlyClassifiedOrPairedCount = 0;

        if (rows.length > 0) {
            // 2.1 Deduplicação retrospectiva caso coexistam pares PENDING e POSTED duplicados na mesma conta
            const pendingRows = rows.filter((r) => {
                const st = String(r.status || (r.raw_payload as Record<string, unknown> | null)?.status || '').toUpperCase();
                return st === 'PENDING';
            });
            const postedRows = rows.filter((r) => {
                const st = String(r.status || (r.raw_payload as Record<string, unknown> | null)?.status || 'POSTED').toUpperCase();
                return st !== 'PENDING';
            });

            if (pendingRows.length > 0 && postedRows.length > 0) {
                const pendingRecon = reconcilePendingToPostedTransactions(postedRows, pendingRows);
                for (const upd of pendingRecon.inPlaceUpdates) {
                    if (
                        upd.existingDbId &&
                        upd.transaction.id &&
                        upd.existingDbId !== upd.transaction.id
                    ) {
                        // A versão POSTED já existe com novo UUID: marca reconciled_from_pending_id e remove a sombra PENDING
                        const { error: markErr } = await supabase
                            .from('transactions')
                            .update({
                                reconciled_from_pending_id: upd.reconciled_from_pending_id,
                                status: 'POSTED',
                            })
                            .eq('id', upd.transaction.id)
                            .eq('user_id', user.id);

                        if (markErr && !isMissingColumnError(markErr)) {
                            console.warn('[OpenFinance Reconcile] Aviso ao marcar POSTED:', markErr);
                        }

                        await supabase
                            .from('transactions')
                            .delete()
                            .eq('id', upd.existingDbId)
                            .eq('user_id', user.id);

                        dedupedPendingCount++;
                    }
                }
            }

            // 2.2 Enriquecimento Comercial 3 Camadas (Simple Icons + Cache `known_merchants` + BrasilAPI)
            const enrichedBatch = await enrichTransactionBatch(rows, supabase, {
                maxConcurrency: 5,
                timeoutMs: 3000,
                enableAiFallback: Boolean(body.enableAiFallback),
            });

            // 2.3 Classificação `kind` e Auto-Transfer Matcher (72h)
            const classifiedBatch = classifyAndMatchInternalTransfers(enrichedBatch, safeAccounts);

            let dbHasV2Columns = true;

            for (let idx = 0; idx < classifiedBatch.length; idx++) {
                const after = classifiedBatch[idx];
                const before = rows[idx];
                if (!after.id) continue;

                const cleanChanged =
                    after.clean_description &&
                    after.clean_description !== before.clean_description;
                const catChanged =
                    after.category_pt && after.category_pt !== before.category_pt;
                const cnpjChanged =
                    after.merchant_cnpj && after.merchant_cnpj !== before.merchant_cnpj;
                const internalChanged =
                    after.is_internal_transfer !== Boolean(before.is_internal_transfer);
                const kindChanged =
                    dbHasV2Columns && after.kind && after.kind !== (before.kind || 'standard');
                const matchChanged =
                    dbHasV2Columns &&
                    after.matched_transfer_id &&
                    after.matched_transfer_id !== (before.matched_transfer_id || null);

                if (
                    !cleanChanged &&
                    !catChanged &&
                    !cnpjChanged &&
                    !internalChanged &&
                    !kindChanged &&
                    !matchChanged
                ) {
                    continue;
                }

                if (cleanChanged || catChanged || cnpjChanged) enrichedMerchantsCount++;
                if (internalChanged || kindChanged || matchChanged) newlyClassifiedOrPairedCount++;

                const coreUpdate: Record<string, unknown> = {
                    description: after.clean_description,
                    clean_description: after.clean_description,
                    category: after.category_pt,
                    category_pt: after.category_pt,
                    merchant_cnpj: after.merchant_cnpj,
                    is_internal_transfer: after.is_internal_transfer,
                    updated_at: new Date().toISOString(),
                };

                if (dbHasV2Columns) {
                    const { error: v2UpdateErr } = await supabase
                        .from('transactions')
                        .update({
                            ...coreUpdate,
                            kind: after.kind,
                            matched_transfer_id: after.matched_transfer_id,
                        })
                        .eq('id', after.id)
                        .eq('user_id', user.id);

                    if (!v2UpdateErr) continue;

                    if (isMissingColumnError(v2UpdateErr)) {
                        dbHasV2Columns = false;
                    } else {
                        continue;
                    }
                }

                await supabase
                    .from('transactions')
                    .update(coreUpdate)
                    .eq('id', after.id)
                    .eq('user_id', user.id);
            }

            if (dedupedPendingCount > 0 || enrichedMerchantsCount > 0 || newlyClassifiedOrPairedCount > 0) {
                await supabase.rpc('invalidate_user_ai_caches', { p_user_id: user.id });
            }
        }

        return NextResponse.json({
            success: true,
            sync_results: syncResults,
            reconciliation: {
                analyzed: rows.length,
                deduped_pending_to_posted: dedupedPendingCount,
                enriched_merchants: enrichedMerchantsCount,
                classified_or_paired_transfers: newlyClassifiedOrPairedCount,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[OpenFinance API POST Error]', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
