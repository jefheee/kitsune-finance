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

    const { data: notifications, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[API Notifications GET error]', error);
      return NextResponse.json({ error: 'Erro ao buscar notificações.' }, { status: 500 });
    }

    const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (error: unknown) {
    console.error('[API Notifications GET uncaught]', error);
    return NextResponse.json({ error: 'Erro interno ao processar requisição.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const { id, all } = body;

    if (all) {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id);

      if (error) {
        console.error('[API Notifications PATCH error]', error);
        return NextResponse.json({ error: 'Erro ao marcar notificações como lidas.' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('[API Notifications PATCH single error]', error);
        return NextResponse.json({ error: 'Erro ao marcar notificação.' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID ou flag "all" é obrigatório.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API Notifications PATCH uncaught]', error);
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da notificação é obrigatório.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[API Notifications DELETE error]', error);
      return NextResponse.json({ error: 'Erro ao remover notificação.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[API Notifications DELETE uncaught]', error);
    return NextResponse.json({ error: 'Erro interno ao processar requisição.' }, { status: 500 });
  }
}
