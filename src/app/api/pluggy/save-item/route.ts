import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncItemAccountsAndTransactions } from '@/utils/pluggy/sync';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const { itemId, providerName } = payload;
    let familyMemberId: string | null = payload.familyMemberId || null;

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }

    if (familyMemberId) {
      const { data: member } = await supabase
        .from('family_members')
        .select('id')
        .eq('id', familyMemberId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) {
        familyMemberId = null;
      }
    }

    const { data: connId, error: rpcError } = await supabase.rpc('upsert_pluggy_connection_sync', {
      p_user_id: user.id,
      p_family_member_id: familyMemberId,
      p_item_id: itemId,
      p_provider_name: providerName || 'Instituição Conectada',
      p_status: 'CONNECTED',
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Dispara a sincronização inicial das contas e transações vinculadas ao user.id
    const syncResult = await syncItemAccountsAndTransactions(supabase, {
      itemId,
      userId: user.id,
      familyMemberId,
      providerName,
    });

    return NextResponse.json(
      {
        success: true,
        connectionId: connId,
        accountsSynced: syncResult.accountsSynced,
        transactionsSynced: syncResult.transactionsSynced,
        institutionName: syncResult.institutionName,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Pluggy Save Item Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
