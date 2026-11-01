import { SupabaseClient } from '@supabase/supabase-js';
import { pluggyClient, generateTransactionIdempotencyHash } from './client';
import { resolveInstitutionForItem, resolveAccountProductDetails } from './bank-resolver';
import { enrichPluggyTransaction } from './transaction-enricher';
import { consolidateIdentityAcrossBanks, type PluggyIdentityRaw } from './identity-consolidator';
import {
    reconcilePendingToPostedTransactions,
    classifyAndMatchInternalTransfers,
    formatLocalDateKey,
    parseLocalDate,
    type ReconcilableTransaction,
    type ReconcilerAccount,
    type TransactionKind,
} from '@/utils/finance/reconciler';
import { enrichTransactionBatch } from '@/utils/finance/enrichment-pipeline';

export interface SyncResult {
    success: boolean;
    accountsSynced: number;
    transactionsSynced: number;
    reconciledPendingCount?: number;
    matchedTransfersCount?: number;
    investmentsSynced?: number;
    loansSynced?: number;
    institutionName?: string;
    institutionSlug?: string;
    error?: string;
}

interface PreparedSyncTransaction extends ReconcilableTransaction {
    pluggyTransactionId: string;
    account_id: string;
    date: string;
    executedAt: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    status: 'PENDING' | 'POSTED';
    kind: TransactionKind;
    cleanDescription: string;
    clean_description: string;
    rawDescription: string;
    raw_description: string;
    categoryPt: string;
    category_pt: string;
    categoryOriginal: string | null;
    operationType: string;
    isInternalTransfer: boolean;
    is_internal_transfer: boolean;
    isRefund: boolean;
    isSubscription: boolean;
    installmentNumber: number | null;
    totalInstallments: number | null;
    totalPurchaseAmount: number | null;
    merchantName: string | null;
    merchantBusinessName: string | null;
    merchantCnpj: string | null;
    merchant_cnpj: string | null;
    payerName: string | null;
    receiverName: string | null;
    paymentReason: string | null;
    billId: string | null;
    providerExtId: string;
    pluggyAccountId: string;
    rawPayload: Record<string, unknown> | null;
    reconciled_from_pending_id?: string | null;
    matched_pending_db_id?: string | null;
    matched_transfer_id?: string | null;
}

function isMissingRpcOverloadError(err: { code?: string; message?: string } | null): boolean {
    if (!err) return false;
    const msg = String(err.message || '');
    return (
        err.code === 'PGRST202' ||
        err.code === '42883' ||
        msg.includes('Could not find the function') ||
        msg.includes('p_kind') ||
        msg.includes('p_reconciled_from_pending_id')
    );
}

export async function syncItemAccountsAndTransactions(
    supabase: SupabaseClient,
    params: {
        itemId: string;
        userId: string;
        familyMemberId?: string | null;
        providerName?: string;
    }
): Promise<SyncResult> {
    const { itemId, userId, familyMemberId = null, providerName } = params;

    try {
        // 1. Coletar dados completos do Item na Pluggy em paralelo
        const [itemDetail, accounts, identity, investments, loans] = await Promise.all([
            pluggyClient.fetchItem(itemId),
            pluggyClient.fetchAccounts(itemId),
            pluggyClient.fetchIdentity(itemId),
            pluggyClient.fetchInvestments(itemId),
            pluggyClient.fetchLoans(itemId),
        ]);

        // 2. Motor Determinístico de Resolução da Instituição (resolve todas as contas e cartões do mesmo item_id)
        const institution = resolveInstitutionForItem({
            connectorName: itemDetail?.connector?.name || providerName,
            accounts,
            investments,
            loans,
            fallbackProviderName: providerName,
        });

        // 3. Registrar/atualizar a conexão no Supabase via RPC seguro
        const { data: connectionId, error: connRpcError } = await supabase.rpc('upsert_pluggy_connection_sync', {
            p_user_id: userId,
            p_family_member_id: familyMemberId || null,
            p_item_id: itemId,
            p_provider_name: institution.name,
            p_status: 'CONNECTED',
            p_institution_name: institution.name,
            p_institution_slug: institution.slug,
            p_institution_logo_url: institution.logoPath,
            p_raw_identity: identity ? (identity as unknown as Record<string, unknown>) : null,
            p_raw_connector: itemDetail?.connector
                ? (itemDetail.connector as unknown as Record<string, unknown>)
                : null,
            p_consent_expires_at: itemDetail?.consentExpiresAt || null,
        });

        if (connRpcError) {
            console.error(`[Sync] Erro ao registrar conexão ${itemId}:`, connRpcError);
        }

        // 4. Consolidar Identidade Open Finance entre todos os bancos conectados do usuário
        let holderNames: string[] = [];
        let holderDocuments: string[] = [];

        try {
            const { data: allConns } = await supabase.rpc('get_user_pluggy_connections_for_sync', {
                p_user_id: userId,
            });

            if (Array.isArray(allConns) && allConns.length > 0) {
                const consolidated = consolidateIdentityAcrossBanks(
                    allConns.map((c: Record<string, unknown>) => ({
                        itemId: String(c.item_id || ''),
                        institutionName: String(
                            c.institution_name || c.provider_name || 'Instituição Conectada'
                        ),
                        institutionSlug: String(c.institution_slug || 'generic'),
                        identity: (c.raw_identity || null) as PluggyIdentityRaw | null,
                        updatedAt: c.updated_at ? String(c.updated_at) : undefined,
                    }))
                );

                holderNames = consolidated.holderNames;
                holderDocuments = consolidated.holderRawDocuments;

                await supabase.rpc('upsert_user_consolidated_identity', {
                    p_user_id: userId,
                    p_full_name: consolidated.fullName,
                    p_birth_date: consolidated.birthDate,
                    p_document_mask: consolidated.documentMask,
                    p_job_title: consolidated.jobTitle,
                    p_emails: consolidated.emails,
                    p_phones: consolidated.phones,
                    p_addresses: consolidated.addresses,
                    p_bank_sources: consolidated.bankSources,
                    p_consolidated_identity: {
                        fullName: consolidated.fullName,
                        birthDate: consolidated.birthDate,
                        documentMask: consolidated.documentMask,
                        jobTitle: consolidated.jobTitle,
                        emails: consolidated.emails,
                        phones: consolidated.phones,
                        addresses: consolidated.addresses,
                        bankSources: consolidated.bankSources,
                        lastConsolidatedAt: new Date().toISOString(),
                    },
                });
            }
        } catch (identityErr) {
            console.error(`[Sync] Aviso ao consolidar identidade do usuário ${userId}:`, identityErr);
        }

        // 5. Sincronizar Contas (BANK e CREDIT), Reconciliar Pendentes e Enriquecer Comercialmente (3 Camadas)
        let totalTransactions = 0;
        let reconciledPendingCount = 0;
        let supportsV2Rpc = true;

        const syncedUserAccounts: ReconcilerAccount[] = [];

        for (const acc of accounts) {
            const details = resolveAccountProductDetails(acc, institution);

            const { data: dbAccountId, error: accError } = await supabase.rpc('sync_pluggy_account', {
                p_family_member_id: familyMemberId || null,
                p_user_id: userId,
                p_item_id: itemId,
                p_pluggy_account_id: acc.id,
                p_bank_name: details.institutionName,
                p_type: acc.type || 'BANK',
                p_balance: Number(acc.balance) || 0,
                p_currency: acc.currencyCode || 'BRL',
                p_institution_name: details.institutionName,
                p_institution_slug: details.institutionSlug,
                p_product_name: details.productName,
                p_subtype: details.subtype,
                p_account_number: details.accountNumber,
                p_agency_number: details.agencyNumber,
                p_transfer_number: details.transferNumber,
                p_credit_limit: acc.creditData?.creditLimit ?? null,
                p_available_credit_limit: acc.creditData?.availableCreditLimit ?? null,
                p_balance_close_date: acc.creditData?.balanceCloseDate ?? null,
                p_balance_due_date: acc.creditData?.balanceDueDate ?? null,
                p_minimum_payment: acc.creditData?.minimumPayment ?? null,
                p_card_brand: details.cardBrand,
            });

            if (accError || !dbAccountId) {
                console.error(`[Sync] Erro ao sincronizar conta ${acc.id}:`, accError);
                continue;
            }

            const currentAccountMeta: ReconcilerAccount = {
                id: String(dbAccountId),
                pluggy_account_id: acc.id,
                type: acc.type || 'BANK',
                subtype: details.subtype,
                institution_name: details.institutionName,
                bank_name: details.institutionName,
            };
            syncedUserAccounts.push(currentAccountMeta);

            try {
                const rawTransactions = await pluggyClient.fetchTransactions(acc.id);
                if (!rawTransactions.length) continue;

                // 5.1 Enriquecimento Determinístico Base + Extração de CNPJ
                const basePrepared: PreparedSyncTransaction[] = rawTransactions.map((tx) => {
                    const enriched = enrichPluggyTransaction({
                        tx,
                        accountType: acc.type || 'BANK',
                        accountSubtype: details.subtype,
                        holderNames,
                        holderDocuments,
                    });

                    return {
                        pluggyTransactionId: enriched.pluggyTransactionId,
                        pluggy_transaction_id: enriched.pluggyTransactionId,
                        account_id: String(dbAccountId),
                        date: enriched.dateOnly,
                        executedAt: enriched.executedAt,
                        amount: enriched.amount,
                        type: enriched.type,
                        status: enriched.status,
                        kind: enriched.kind,
                        description: enriched.cleanDescription,
                        cleanDescription: enriched.cleanDescription,
                        clean_description: enriched.cleanDescription,
                        rawDescription: enriched.rawDescription,
                        raw_description: enriched.rawDescription,
                        category: enriched.categoryPt,
                        categoryPt: enriched.categoryPt,
                        category_pt: enriched.categoryPt,
                        categoryOriginal: enriched.categoryOriginal,
                        category_original: enriched.categoryOriginal,
                        operationType: enriched.operationType,
                        operation_type: enriched.operationType,
                        isInternalTransfer: enriched.isInternalTransfer,
                        is_internal_transfer: enriched.isInternalTransfer,
                        isRefund: enriched.isRefund,
                        is_refund: enriched.isRefund,
                        isSubscription: enriched.isSubscription,
                        installmentNumber: enriched.installmentNumber,
                        totalInstallments: enriched.totalInstallments,
                        totalPurchaseAmount: enriched.totalPurchaseAmount,
                        merchantName: enriched.merchantName,
                        merchantBusinessName: enriched.merchantBusinessName,
                        merchantCnpj: enriched.merchantCnpj,
                        merchant_cnpj: enriched.merchantCnpj,
                        payerName: enriched.payerName,
                        receiverName: enriched.receiverName,
                        paymentReason: enriched.paymentReason,
                        billId: enriched.billId,
                        providerExtId: tx.id || tx.providerCode || '',
                        pluggyAccountId: acc.id,
                        rawPayload: tx.rawPayload || null,
                    };
                });

                // 5.2 Pipeline de Enriquecimento Comercial em 3 Camadas (Simple Icons + Cache Supabase + BrasilAPI CNPJ/CNAE)
                const commerciallyEnriched = await enrichTransactionBatch(basePrepared, supabase, {
                    maxConcurrency: 5,
                    timeoutMs: 3000,
                });

                // 5.3 Reconciliação Anti-Duplicidade (PENDING -> POSTED com possível troca de UUID)
                let existingPendingTxs: ReconcilableTransaction[] = [];
                try {
                    const { data: recentAccTxs } = await supabase
                        .from('transactions')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('account_id', dbAccountId)
                        .order('date', { ascending: false })
                        .limit(200);

                    if (Array.isArray(recentAccTxs)) {
                        existingPendingTxs = recentAccTxs
                            .filter((row: Record<string, unknown>) => {
                                const colStatus = String(row.status || '').toUpperCase();
                                const rawPayload = row.raw_payload as Record<string, unknown> | null;
                                const payloadStatus = String(rawPayload?.status || '').toUpperCase();
                                return colStatus === 'PENDING' || payloadStatus === 'PENDING';
                            })
                            .map((row: Record<string, unknown>) => ({
                                id: row.id ? String(row.id) : undefined,
                                pluggy_transaction_id: row.pluggy_transaction_id
                                    ? String(row.pluggy_transaction_id)
                                    : null,
                                account_id: String(row.account_id || dbAccountId),
                                date: String(row.date || ''),
                                amount: Number(row.amount) || 0,
                                type: row.type ? String(row.type) : null,
                                status: 'PENDING',
                                description: row.description ? String(row.description) : null,
                                clean_description: row.clean_description
                                    ? String(row.clean_description)
                                    : null,
                                raw_description: row.raw_description
                                    ? String(row.raw_description)
                                    : null,
                            }));
                    }
                } catch {
                    // Retrocompatível caso executado via cliente sem sessão direta (webhook)
                }

                const pendingReconciled = reconcilePendingToPostedTransactions(
                    commerciallyEnriched,
                    existingPendingTxs
                );
                reconciledPendingCount += pendingReconciled.inPlaceUpdates.length;

                // 5.4 Classificação Determinística de `kind` antes da gravação
                const classifiedBatch = classifyAndMatchInternalTransfers(
                    pendingReconciled.transactions,
                    [currentAccountMeta]
                );

                // 5.5 Gravação em Lote com Retrocompatibilidade Total (v2 RPC -> fallback v1 RPC)
                const BATCH_SIZE = 25;
                for (let i = 0; i < classifiedBatch.length; i += BATCH_SIZE) {
                    const slice = classifiedBatch.slice(i, i + BATCH_SIZE);
                    const results = await Promise.all(
                        slice.map(async (txItem) => {
                            const idempotencyHash = generateTransactionIdempotencyHash(
                                txItem.pluggyAccountId,
                                txItem.providerExtId,
                                txItem.amount,
                                txItem.date
                            );

                            const baseRpcPayload = {
                                p_account_id: dbAccountId,
                                p_family_member_id: familyMemberId || null,
                                p_user_id: userId,
                                p_pluggy_tx_id: txItem.pluggyTransactionId,
                                p_idempotency_hash: idempotencyHash,
                                p_description: txItem.clean_description,
                                p_amount: txItem.amount,
                                p_type: txItem.type,
                                p_category: txItem.category_pt,
                                p_executed_at: txItem.executedAt,
                                p_date: txItem.date,
                                p_clean_description: txItem.clean_description,
                                p_raw_description: txItem.raw_description,
                                p_category_pt: txItem.category_pt,
                                p_category_original: txItem.categoryOriginal,
                                p_operation_type: txItem.operationType,
                                p_is_internal_transfer: txItem.is_internal_transfer,
                                p_is_refund: txItem.isRefund,
                                p_is_subscription: txItem.isSubscription,
                                p_installment_number: txItem.installmentNumber,
                                p_total_installments: txItem.totalInstallments,
                                p_total_purchase_amount: txItem.totalPurchaseAmount,
                                p_merchant_name: txItem.merchantName,
                                p_merchant_business_name: txItem.merchantBusinessName,
                                p_merchant_cnpj: txItem.merchant_cnpj,
                                p_payer_name: txItem.payerName,
                                p_receiver_name: txItem.receiverName,
                                p_payment_reason: txItem.paymentReason,
                                p_bill_id: txItem.billId,
                                p_raw_payload: txItem.rawPayload,
                            };

                            if (supportsV2Rpc) {
                                const { error: v2Err } = await supabase.rpc('upsert_pluggy_transaction', {
                                    ...baseRpcPayload,
                                    p_kind: txItem.kind,
                                    p_matched_transfer_id: txItem.matched_transfer_id || null,
                                    p_reconciled_from_pending_id: txItem.reconciled_from_pending_id || null,
                                    p_status: txItem.status || 'POSTED',
                                });

                                if (!v2Err) {
                                    return 1;
                                }

                                if (isMissingRpcOverloadError(v2Err)) {
                                    supportsV2Rpc = false;
                                } else {
                                    console.error(
                                        `[Sync] Erro ao sincronizar transação ${txItem.pluggyTransactionId}:`,
                                        v2Err
                                    );
                                    return 0;
                                }
                            }

                            // Fallback retrocompatível (banco ainda sem migration 20261101):
                            // Se reconciliou uma PENDING de ID diferente, migra o pluggy_transaction_id in-place antes do upsert
                            if (
                                txItem.matched_pending_db_id &&
                                txItem.reconciled_from_pending_id &&
                                txItem.reconciled_from_pending_id !== txItem.pluggyTransactionId
                            ) {
                                try {
                                    await supabase
                                        .from('transactions')
                                        .update({
                                            pluggy_transaction_id: txItem.pluggyTransactionId,
                                            idempotency_hash: idempotencyHash,
                                        })
                                        .eq('id', txItem.matched_pending_db_id)
                                        .eq('user_id', userId);
                                } catch {
                                    // Ignora silenciosamente se sem permissão direta
                                }
                            }

                            const { error: v1Err } = await supabase.rpc(
                                'upsert_pluggy_transaction',
                                baseRpcPayload
                            );

                            if (v1Err) {
                                console.error(
                                    `[Sync] Erro ao sincronizar transação (v1 fallback) ${txItem.pluggyTransactionId}:`,
                                    v1Err
                                );
                                return 0;
                            }
                            return 1;
                        })
                    );
                    totalTransactions += results.reduce<number>((sum, val) => sum + val, 0);
                }
            } catch (txFetchError) {
                console.error(`[Sync] Erro ao coletar transações para a conta ${acc.id}:`, txFetchError);
            }
        }

        // 5.6 Auto-Transfer Matcher Multi-Contas na Janela de 72h (pós-sync entre bancos conectados)
        let matchedTransfersCount = 0;
        try {
            const ninetyDaysAgo = parseLocalDate(new Date());
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const cutoffDateKey = formatLocalDateKey(ninetyDaysAgo);

            const [{ data: allUserAccountsData }, { data: recentUserTxsData }] = await Promise.all([
                supabase
                    .from('bank_accounts')
                    .select('id, pluggy_account_id, type, subtype, institution_name, bank_name')
                    .eq('user_id', userId),
                supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('date', cutoffDateKey)
                    .order('date', { ascending: false })
                    .limit(1000),
            ]);

            const effectiveAccounts: ReconcilerAccount[] =
                Array.isArray(allUserAccountsData) && allUserAccountsData.length > 0
                    ? (allUserAccountsData as ReconcilerAccount[])
                    : syncedUserAccounts;

            if (Array.isArray(recentUserTxsData) && recentUserTxsData.length > 1) {
                const priorMatchedIds = new Set<string>(
                    recentUserTxsData
                        .filter((r: Record<string, unknown>) => Boolean(r.matched_transfer_id))
                        .map((r: Record<string, unknown>) => String(r.id))
                );

                const crossMatched = classifyAndMatchInternalTransfers(
                    recentUserTxsData as ReconcilableTransaction[],
                    effectiveAccounts
                );

                const processedPairKeys = new Set<string>();

                for (const tx of crossMatched) {
                    if (!tx.id || !tx.matched_transfer_id) continue;
                    if (priorMatchedIds.has(tx.id)) continue;
                    if (tx.amount >= 0) continue; // Processa cada par apenas uma vez a partir da perna de saída (outflow)

                    const pairKey = [tx.id, tx.matched_transfer_id].sort().join(':');
                    if (processedPairKeys.has(pairKey)) continue;
                    processedPairKeys.add(pairKey);

                    matchedTransfersCount++;

                    if (supportsV2Rpc) {
                        const { error: linkErr } = await supabase.rpc('link_matched_internal_transfers', {
                            p_user_id: userId,
                            p_tx_out_id: tx.id,
                            p_tx_in_id: tx.matched_transfer_id,
                            p_kind: tx.kind,
                        });

                        if (!linkErr) continue;
                        if (isMissingRpcOverloadError(linkErr)) {
                            supportsV2Rpc = false;
                        }
                    }

                    // Fallback retrocompatível para colunas já existentes (`is_internal_transfer`, `category_pt`)
                    await supabase
                        .from('transactions')
                        .update({
                            is_internal_transfer: true,
                            category_pt: 'Transferência Própria',
                            category: 'Transferência Própria',
                            updated_at: new Date().toISOString(),
                        })
                        .in('id', [tx.id, tx.matched_transfer_id])
                        .eq('user_id', userId);
                }
            }
        } catch (transferMatchErr) {
            console.warn('[Sync] Aviso não-fatal no Auto-Transfer Matcher 72h:', transferMatchErr);
        }

        // 6. Sincronizar Investimentos (CDBs, Tesouro, Fundos, Caixinhas, Ações)
        let investmentsSynced = 0;
        for (const inv of investments) {
            const { error: invErr } = await supabase.rpc('upsert_pluggy_investment', {
                p_user_id: userId,
                p_connection_id: connectionId || null,
                p_item_id: itemId,
                p_pluggy_investment_id: inv.id,
                p_name: inv.name,
                p_type: inv.type,
                p_subtype: inv.subtype,
                p_balance: inv.balance,
                p_currency: inv.currencyCode || 'BRL',
                p_institution_name: inv.institutionName || institution.name,
                p_institution_slug: institution.slug,
                p_issuer: inv.issuer || null,
                p_rate: inv.rate,
                p_rate_type: inv.rateType,
                p_annual_rate: inv.annualRate,
                p_amount_original: inv.amountOriginal,
                p_amount_profit: inv.amountProfit,
                p_taxes: inv.taxes,
                p_due_date: inv.dueDate,
                p_issue_date: inv.issueDate,
                p_status: inv.status || 'ACTIVE',
                p_raw_payload: inv.rawPayload || null,
            });
            if (!invErr) investmentsSynced++;
        }

        // 7. Sincronizar Empréstimos / Financiamentos
        let loansSynced = 0;
        for (const loan of loans) {
            const { error: loanErr } = await supabase.rpc('upsert_pluggy_loan', {
                p_user_id: userId,
                p_connection_id: connectionId || null,
                p_item_id: itemId,
                p_pluggy_loan_id: loan.id,
                p_product_name: loan.productName,
                p_type: loan.type,
                p_institution_name: institution.name,
                p_institution_slug: institution.slug,
                p_contracted_amount: loan.contractAmount ?? 0,
                p_outstanding_balance: loan.outstandingBalance ?? 0,
                p_paid_installments: loan.paidInstallments,
                p_total_installments: loan.totalInstallments,
                p_interest_rate: loan.interestRate,
                p_currency: loan.currencyCode || 'BRL',
                p_contract_date: loan.date,
                p_due_date: loan.dueDate,
                p_raw_payload: loan.rawPayload || null,
            });
            if (!loanErr) loansSynced++;
        }

        // 8. Invalidar caches de insights e dossiês de sessão da Kitsune AI
        await supabase.rpc('invalidate_user_ai_caches', {
            p_user_id: userId,
        });

        return {
            success: true,
            accountsSynced: accounts.length,
            transactionsSynced: totalTransactions,
            reconciledPendingCount,
            matchedTransfersCount,
            investmentsSynced,
            loansSynced,
            institutionName: institution.name,
            institutionSlug: institution.slug,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro ao sincronizar dados da Pluggy';
        console.error(`[Sync] Erro geral na sincronização do item ${itemId}:`, error);
        return {
            success: false,
            accountsSynced: 0,
            transactionsSynced: 0,
            error: message,
        };
    }
}
