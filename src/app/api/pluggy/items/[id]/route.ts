import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { pluggyClient } from '@/utils/pluggy/client';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID da conexão/item é obrigatório.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Localiza a conexão garantindo que pertence estritamente ao user.id logado (RLS + filtro explícito)
    const { data: connection, error: findError } = await supabase
      .from('pluggy_connections')
      .select('id, item_id, user_id, provider_name')
      .eq('user_id', user.id)
      .or(`item_id.eq.${id},id.eq.${id}`)
      .maybeSingle();

    if (findError || !connection) {
      return NextResponse.json(
        { error: 'Conexão bancária não encontrada ou acesso negado.' },
        { status: 404 }
      );
    }

    const targetItemId = connection.item_id;

    // 1. Deleta o item remotamente no provedor Pluggy (DELETE https://api.pluggy.ai/items/{id})
    let providerDeleted = false;
    try {
      const providerRes = await pluggyClient.deleteItem(targetItemId);
      providerDeleted = providerRes.deleted;
    } catch (pluggyErr: any) {
      console.warn(
        `[Pluggy Delete Item] Aviso ao remover item ${targetItemId} no provedor Pluggy:`,
        pluggyErr?.message || pluggyErr
      );
    }

    // 2. Busca contas locais vinculadas a este item_id para remover transações e contas em cascata
    const { data: itemAccounts } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', targetItemId);

    if (itemAccounts && itemAccounts.length > 0) {
      const accountIds = itemAccounts.map((a) => a.id);
      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .in('account_id', accountIds);

      await supabase
        .from('bank_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', targetItemId);
    }

    // 3. Remove a conexão na tabela pluggy_connections (também dispara ON DELETE CASCADE no banco)
    const { error: deleteError } = await supabase
      .from('pluggy_connections')
      .delete()
      .eq('id', connection.id)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedItemId: targetItemId,
      providerDeleted,
    });
  } catch (error: any) {
    console.error('[Pluggy Delete Item Error]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao desconectar instituição bancária' },
      { status: 500 }
    );
  }
}
