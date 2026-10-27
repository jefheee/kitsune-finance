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

    let familyMemberId: string | undefined;
    try {
      const body = await request.json();
      familyMemberId = body.familyMemberId;
    } catch {
      // Body vazio é aceitável, buscaremos o membro padrão
    }

    // Se não fornecido, busca ou cria o membro familiar principal
    if (!familyMemberId) {
      let { data: defaultMember } = await supabase
        .from('family_members')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!defaultMember) {
        const { data: newMember, error: createError } = await supabase
          .from('family_members')
          .insert({
            user_id: user.id,
            name: user.user_metadata?.full_name || 'Titular',
            role: 'Titular',
          })
          .select('id')
          .single();

        if (createError) {
          throw new Error(`Erro ao criar membro padrão: ${createError.message}`);
        }
        defaultMember = newMember;
      }
      familyMemberId = defaultMember?.id;
    } else {
      // Valida se o familyMemberId pertence ao usuário autenticado
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

    // Gera o Connect Token configurado para o proxy "Meu Pluggy" (connectorId: 200)
    // mapeando clientUserId para o UUID do membro familiar (Regra 2)
    const { accessToken } = await pluggyClient.createConnectToken({
      clientUserId: familyMemberId,
      connectorId: 200,
    });

    return NextResponse.json({
      connectToken: accessToken,
      accessToken, // Mantém compatibilidade com ambos os formatos
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
