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
      return NextResponse.json({ error: 'itemId é obrigatório' }, { status: 400 });
    }

    // Se o familyMemberId não foi fornecido, associa ao primeiro membro da família do usuário
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
      } else {
        const { data: newMember } = await supabase
          .from('family_members')
          .insert({
            user_id: user.id,
            name: user.user_metadata?.full_name || 'Titular',
            role: 'Titular',
          })
          .select('id')
          .single();
        familyMemberId = newMember?.id;
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
    });
  } catch (error: any) {
    console.error('[Pluggy Sync Route Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
