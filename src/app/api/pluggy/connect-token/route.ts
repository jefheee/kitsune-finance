import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { pluggyClient } from '@/utils/pluggy/client';

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

    let familyMemberId: string | null = null;
    let itemId: string | undefined;

    try {
      const body = await request.json();
      if (body.familyMemberId) {
        familyMemberId = body.familyMemberId;
      }
      if (body.itemId) {
        itemId = body.itemId;
      }
    } catch {
      // Body vazio é válido (conexão individual padrão vinculada diretamente ao user.id)
    }

    // Se um familyMemberId opcional foi informado, valida que pertence estritamente ao user.id logado
    if (familyMemberId) {
      const { data: memberCheck, error: memberCheckError } = await supabase
        .from('family_members')
        .select('id')
        .eq('id', familyMemberId)
        .eq('user_id', user.id)
        .single();

      if (memberCheckError || !memberCheck) {
        return NextResponse.json(
          { error: 'Membro familiar inválido ou não pertencente à sua conta.' },
          { status: 403 }
        );
      }
    }

    // Garante que o clientUserId enviado à Pluggy seja SEMPRE o user.id (auth.uid()) do usuário logado
    const { accessToken } = await pluggyClient.createConnectToken({
      clientUserId: user.id,
      connectorId: 200,
      itemId,
    });

    return NextResponse.json({
      connectToken: accessToken,
      accessToken,
      userId: user.id,
      familyMemberId,
    });
  } catch (error: any) {
    console.error('[Pluggy Connect Token Error]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar connect token' },
      { status: 500 }
    );
  }
}
