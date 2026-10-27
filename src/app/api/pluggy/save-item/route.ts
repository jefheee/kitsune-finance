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
    let { familyMemberId } = payload;

    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }

    if (!familyMemberId) {
      const { data: member } = await supabase
        .from('family_members')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (member) {
        familyMemberId = member.id;
      }
    }

    const { data: insertedConnection, error: insertError } = await supabase
      .from('pluggy_connections')
      .upsert(
        {
          user_id: user.id,
          family_member_id: familyMemberId,
          item_id: itemId,
          provider_name: providerName || 'Meu Pluggy',
          status: 'CONNECTED',
        },
        { onConflict: 'item_id' }
      )
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Dispara a sincronização inicial em background/concorrência segura
    syncItemAccountsAndTransactions(supabase, {
      itemId,
      userId: user.id,
      familyMemberId,
      providerName,
    }).catch((err) => console.error('[Background Sync Error]', err));

    return NextResponse.json(
      { success: true, connectionId: insertedConnection?.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Pluggy Save Item Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
