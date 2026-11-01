import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: members, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API Family Members GET error]', error);
      return NextResponse.json({ error: 'Erro ao buscar membros familiares.' }, { status: 500 });
    }

    return NextResponse.json({ members: members || [] });
  } catch (error: unknown) {
    console.error('[API Family Members GET uncaught]', error);
    return NextResponse.json({ error: 'Erro interno ao processar requisição.' }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { name, role } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nome do membro familiar é obrigatório.' }, { status: 400 });
    }

    const { data: newMember, error } = await supabase
      .from('family_members')
      .insert({
        user_id: user.id,
        name: name.trim(),
        role: role?.trim() || 'Membro',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[API Family Members POST error]', error);
      return NextResponse.json({ error: 'Erro ao cadastrar membro.' }, { status: 500 });
    }

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API Family Members POST uncaught]', error);
    return NextResponse.json({ error: 'Erro interno ao processar requisição.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('id');

    if (!memberId) {
      return NextResponse.json({ error: 'ID do membro é obrigatório.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', memberId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[API Family Members DELETE error]', error);
      return NextResponse.json({ error: 'Erro ao remover membro.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[API Family Members DELETE uncaught]', error);
    return NextResponse.json({ error: 'Erro interno ao processar requisição.' }, { status: 500 });
  }
}
