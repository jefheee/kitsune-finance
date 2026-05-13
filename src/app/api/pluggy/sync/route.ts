import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { PluggyClient } from 'pluggy-sdk';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId, itemId } = await request.json();

    if (!connectionId || !itemId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const pluggyClient = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID || '',
      clientSecret: process.env.PLUGGY_CLIENT_SECRET || '',
    });

    // 1. Fetch accounts
    const accountsResponse = await pluggyClient.fetchAccounts(itemId);
    const accounts = accountsResponse.results;

    let totalTransactions = 0;

    // 2. Iterate accounts and insert/upsert
    for (const acc of accounts) {
      // Upsert account
      const { data: insertedAcc, error: accError } = await supabase
        .from('accounts')
        .upsert({
          user_id: user.id,
          connection_id: connectionId,
          pluggy_account_id: acc.id,
          name: acc.name,
          type: acc.type,
          balance: acc.balance,
          currency: acc.currencyCode,
        }, { onConflict: 'pluggy_account_id' })
        .select('id')
        .single();
      
      if (accError || !insertedAcc) {
        console.error('Account Insert Error:', accError);
        continue;
      }

      // Fetch transactions for this account
      try {
        const txResponse = await pluggyClient.fetchTransactions(acc.id);
        const transactions = txResponse.results;

        if (transactions.length > 0) {
          const transactionsToInsert = transactions.map(tx => ({
            user_id: user.id,
            account_id: insertedAcc.id,
            pluggy_transaction_id: tx.id,
            description: tx.description,
            amount: tx.amount,
            date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
            category: tx.category || 'Outros',
          }));

          const { error: txError } = await supabase
            .from('transactions')
            .upsert(transactionsToInsert, { onConflict: 'pluggy_transaction_id' });

          if (txError) {
            console.error('Transaction Insert Error:', txError);
          } else {
            totalTransactions += transactionsToInsert.length;
          }
        }
      } catch (txFetchError) {
        console.error(`Failed to fetch transactions for account ${acc.id}:`, txFetchError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      accountsSynced: accounts.length,
      transactionsSynced: totalTransactions
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Pluggy Sync Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
