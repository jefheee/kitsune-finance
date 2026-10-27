import { SupabaseClient } from '@supabase/supabase-js';
import { pluggyClient, generateTransactionIdempotencyHash } from './client';

export interface SyncResult {
  success: boolean;
  accountsSynced: number;
  transactionsSynced: number;
  institutionName?: string;
  error?: string;
}

function normalizeInstitutionName(rawName?: string): string {
  if (!rawName) return 'Instituição Conectada';
  const lower = rawName.toLowerCase();
  if (lower.includes('nu pagamentos') || lower.includes('nubank')) return 'Nubank';
  if (lower.includes('itau') || lower.includes('itaú')) return 'Itaú Unibanco';
  if (lower.includes('bradesco')) return 'Bradesco';
  if (lower.includes('santander')) return 'Santander';
  if (lower.includes('banco inter') || lower === 'inter') return 'Banco Inter';
  if (lower.includes('c6 bank') || lower.includes('c6')) return 'C6 Bank';
  if (lower.includes('btg')) return 'BTG Pactual';
  if (lower.includes('xp ')) return 'XP Investimentos';
  if (lower.includes('caixa')) return 'Caixa Econômica';
  if (lower.includes('banco do brasil')) return 'Banco do Brasil';
  if (lower === 'pluggy' || lower === 'meu pluggy') return 'Meu Pluggy';
  return rawName;
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
    // 1. Coletar contas diretamente da rota de produtos da Pluggy (higienizadas)
    const accounts = await pluggyClient.fetchAccounts(itemId);

    // Determina o nome real da instituição a partir das contas retornadas
    const primaryBankAccount = accounts.find((a) => a.type === 'BANK') || accounts[0];
    const resolvedProviderName =
      providerName &&
      providerName.toLowerCase() !== 'pluggy' &&
      providerName.toLowerCase() !== 'meu pluggy' &&
      providerName.toLowerCase() !== 'instituição conectada'
        ? normalizeInstitutionName(providerName)
        : normalizeInstitutionName(primaryBankAccount?.name || providerName);

    // 2. Registrar/atualizar a conexão no Supabase via RPC seguro (valida user_id e deduplica)
    const { error: connRpcError } = await supabase.rpc('upsert_pluggy_connection_sync', {
      p_user_id: userId,
      p_family_member_id: familyMemberId || null,
      p_item_id: itemId,
      p_provider_name: resolvedProviderName,
      p_status: 'CONNECTED',
    });

    if (connRpcError) {
      console.error(`[Sync] Erro ao registrar conexão ${itemId}:`, connRpcError);
    }

    let totalTransactions = 0;

    for (const acc of accounts) {
      // 3. Upsert da conta na tabela bank_accounts via RPC seguro (com deduplicação de item)
      const { data: dbAccountId, error: accError } = await supabase.rpc('sync_pluggy_account', {
        p_family_member_id: familyMemberId || null,
        p_user_id: userId,
        p_item_id: itemId,
        p_pluggy_account_id: acc.id,
        p_bank_name: acc.name || resolvedProviderName,
        p_type: acc.type || 'BANK',
        p_balance: Number(acc.balance) || 0,
        p_currency: acc.currencyCode || 'BRL',
      });

      if (accError || !dbAccountId) {
        console.error(`[Sync] Erro ao sincronizar conta ${acc.id}:`, accError);
        continue;
      }

      // 4. Coletar transações higienizadas diretamente da rota da Pluggy com accountId
      try {
        const transactions = await pluggyClient.fetchTransactions(acc.id);

        for (const tx of transactions) {
          const extId = tx.id || tx.providerCode || '';
          const txDate = tx.date
            ? new Date(tx.date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          const executedAt = tx.date
            ? new Date(tx.date).toISOString()
            : new Date().toISOString();

          const idempotencyHash = generateTransactionIdempotencyHash(
            acc.id,
            extId,
            tx.amount,
            txDate
          );

          const txType = tx.type === 'CREDIT' || Number(tx.amount) > 0 ? 'CREDIT' : 'DEBIT';

          // Higiene e Privacidade de Dados: persiste apenas dados financeiros normalizados
          const { error: txError } = await supabase.rpc('upsert_pluggy_transaction', {
            p_account_id: dbAccountId,
            p_family_member_id: familyMemberId || null,
            p_user_id: userId,
            p_pluggy_tx_id: tx.id,
            p_idempotency_hash: idempotencyHash,
            p_description: tx.description || tx.descriptionRaw || 'Transação',
            p_amount: Number(tx.amount) || 0,
            p_type: txType,
            p_category: tx.category || 'Outros',
            p_executed_at: executedAt,
            p_date: txDate,
          });

          if (!txError) {
            totalTransactions++;
          } else {
            console.error(`[Sync] Erro ao sincronizar transação ${tx.id}:`, txError);
          }
        }
      } catch (txFetchError) {
        console.error(`[Sync] Erro ao coletar transações para a conta ${acc.id}:`, txFetchError);
      }
    }

    return {
      success: true,
      accountsSynced: accounts.length,
      transactionsSynced: totalTransactions,
      institutionName: resolvedProviderName,
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
