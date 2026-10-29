import { SupabaseClient } from '@supabase/supabase-js';
import { pluggyClient, generateTransactionIdempotencyHash } from './client';
import { resolveInstitutionForItem, resolveAccountProductDetails } from './bank-resolver';
import { enrichPluggyTransaction } from './transaction-enricher';
import { consolidateIdentityAcrossBanks, type PluggyIdentityRaw } from './identity-consolidator';

export interface SyncResult {
    success: boolean;
    accountsSynced: number;
    transactionsSynced: number;
    investmentsSynced?: number;
    loansSynced?: number;
    institutionName?: string;
    institutionSlug?: string;
    error?: string;
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
            p_raw_identity: identity ? (identity as any) : null,
            p_raw_connector: itemDetail?.connector ? (itemDetail.connector as any) : null,
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
                    allConns.map((c: any) => ({
                        itemId: c.item_id,
                        institutionName: c.institution_name || c.provider_name || 'Instituição Conectada',
                        institutionSlug: c.institution_slug || 'generic',
                        identity: (c.raw_identity || null) as PluggyIdentityRaw | null,
                        updatedAt: c.updated_at,
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

        // 5. Sincronizar Contas (BANK e CREDIT) e Transações Enriquecidas
        let totalTransactions = 0;

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

            try {
                const transactions = await pluggyClient.fetchTransactions(acc.id);
                const BATCH_SIZE = 25;

                for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
                    const batch = transactions.slice(i, i + BATCH_SIZE);
                    const results = await Promise.all(
                        batch.map(async (tx) => {
                            const enriched = enrichPluggyTransaction({
                                tx,
                                accountType: acc.type || 'BANK',
                                accountSubtype: details.subtype,
                                holderNames,
                                holderDocuments,
                            });

                            const extId = tx.id || tx.providerCode || '';
                            const idempotencyHash = generateTransactionIdempotencyHash(
                                acc.id,
                                extId,
                                enriched.amount,
                                enriched.dateOnly
                            );

                            const { error: txError } = await supabase.rpc('upsert_pluggy_transaction', {
                                p_account_id: dbAccountId,
                                p_family_member_id: familyMemberId || null,
                                p_user_id: userId,
                                p_pluggy_tx_id: enriched.pluggyTransactionId,
                                p_idempotency_hash: idempotencyHash,
                                p_description: enriched.cleanDescription,
                                p_amount: enriched.amount,
                                p_type: enriched.type,
                                p_category: enriched.categoryPt,
                                p_executed_at: enriched.executedAt,
                                p_date: enriched.dateOnly,
                                p_clean_description: enriched.cleanDescription,
                                p_raw_description: enriched.rawDescription,
                                p_category_pt: enriched.categoryPt,
                                p_category_original: enriched.categoryOriginal,
                                p_operation_type: enriched.operationType,
                                p_is_internal_transfer: enriched.isInternalTransfer,
                                p_is_refund: enriched.isRefund,
                                p_is_subscription: enriched.isSubscription,
                                p_installment_number: enriched.installmentNumber,
                                p_total_installments: enriched.totalInstallments,
                                p_total_purchase_amount: enriched.totalPurchaseAmount,
                                p_merchant_name: enriched.merchantName,
                                p_merchant_business_name: enriched.merchantBusinessName,
                                p_merchant_cnpj: enriched.merchantCnpj,
                                p_payer_name: enriched.payerName,
                                p_receiver_name: enriched.receiverName,
                                p_payment_reason: enriched.paymentReason,
                                p_bill_id: enriched.billId,
                                p_raw_payload: tx.rawPayload || null,
                            });

                            if (txError) {
                                console.error(`[Sync] Erro ao sincronizar transação ${tx.id}:`, txError);
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
                p_institution_name: institution.name,
                p_institution_slug: institution.slug,
                p_issuer: inv.issuer,
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
            investmentsSynced,
            loansSynced,
            institutionName: institution.name,
            institutionSlug: institution.slug,
        };
    } catch (error: any) {
        console.error(`[Sync] Erro geral na sincronização do item ${itemId}:`, error);
        return {
            success: false,
            accountsSynced: 0,
            transactionsSynced: 0,
            error: error.message || 'Erro ao sincronizar dados da Pluggy',
        };
    }
}
