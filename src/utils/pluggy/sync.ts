import { SupabaseClient } from '@supabase/supabase-js';
import { pluggyClient, generateTransactionIdempotencyHash } from './client';

export interface SyncResult {
  success: boolean;
  accountsSynced: number;
  transactionsSynced: number;
  error?: string;
}

export async function syncItemAccountsAndTransactions(
  supabase: SupabaseClient,
  params: {
    itemId: string;
    userId: string;
    familyMemberId: string;
    providerName?: string;
  }
): Promise<SyncResult> {
  const { itemId, userId, familyMemberId, providerName } = params;

  try {
    // 1. Atualizar ou registrar a conexão no Supabase
    await supabase.from('pluggy_connections').upsert(
      {
        user_id: userId,
        family_member_id: familyMemberId,
        item_id: itemId,
        provider_name: providerName || 'Meu Pluggy',
        status: 'CONNECTED',
      },
      { onConflict: 'item_id' }
    );

    // 2. Coletar contas diretamente da rota de produtos da Pluggy
    const accounts = await pluggyClient.fetchAccounts(itemId);
    let totalTransactions = 0;

    for (const acc of accounts) {
      // 3. Upsert da conta na tabela bank_accounts via RPC seguro (SECURITY DEFINER)
      const { data: dbAccountId, error: accError } = await supabase.rpc('sync_pluggy_account', {
        p_family_member_id: familyMemberId,
        p_user_id: userId,
        p_item_id: itemId,
        p_pluggy_account_id: acc.id,
        p_bank_name: acc.name || providerName || 'Conta Bancária',
        p_type: acc.type || 'BANK',
        p_balance: Number(acc.balance) || 0,
        p_currency: acc.currencyCode || 'BRL',
      });

      if (accError || !dbAccountId) {
        console.error(`[Sync] Erro ao sincronizar conta ${acc.id}:`, accError);
        continue;
      }

      // 4. Coletar transações diretamente da rota da Pluggy com accountId
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

          // Idempotência SHA-256 (Regra 6)
          const idempotencyHash = generateTransactionIdempotencyHash(
            acc.id,
            extId,
            tx.amount,
            txDate
          );

          const txType = tx.type === 'CREDIT' || Number(tx.amount) > 0 ? 'CREDIT' : 'DEBIT';

          // Higiene e Privacidade de Dados (Regra 5):
          // Não armazena CPF, telefones ou endereços; apenas lançamentos financeiros.
          const { error: txError } = await supabase.rpc('upsert_pluggy_transaction', {
            p_account_id: dbAccountId,
            p_family_member_id: familyMemberId,
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
