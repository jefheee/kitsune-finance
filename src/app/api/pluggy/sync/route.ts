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
      return NextResponse.json({ error: 'itemId é obrigatório' }, { status: 400 });
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

    const result = await syncItemAccountsAndTransactions(supabase, {
      itemId,
      userId: user.id,
      familyMemberId,
      providerName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      accountsSynced: result.accountsSynced,
      transactionsSynced: result.transactionsSynced,
      institutionName: result.institutionName,
    });
  } catch (error: any) {
    console.error('[Pluggy Sync Route Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
