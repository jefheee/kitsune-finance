import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncItemAccountsAndTransactions, invalidateUserAiCaches } from '@/utils/pluggy/sync';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // 1. Validação de integridade da chamada (token secreto opcional + formato estrito)
    const configuredSecret = process.env.PLUGGY_WEBHOOK_SECRET;
    if (configuredSecret) {
      const headerSecret =
        request.headers.get('x-pluggy-webhook-secret') ||
        request.headers.get('authorization')?.replace('Bearer ', '');
      if (headerSecret !== configuredSecret) {
        return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
      }
    }

    const payload = await request.json();
    const event = typeof payload?.event === 'string' ? payload.event : '';
    const itemId = typeof payload?.itemId === 'string' ? payload.itemId.trim() : '';
    const rawClientUserId = payload?.clientUserId || payload?.data?.clientUserId;
    const clientUserId =
      typeof rawClientUserId === 'string' && UUID_REGEX.test(rawClientUserId.trim())
        ? rawClientUserId.trim()
        : null;

    if (!event || !itemId || !UUID_REGEX.test(itemId)) {
      return NextResponse.json(
        { error: 'Payload de webhook inválido: event e itemId (UUID) são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    switch (event) {
      case 'item/created':
      case 'item/updated':
      case 'transactions/created':
      case 'transactions/updated': {
        // Localiza estritamente o user_id proprietário do itemId registrado previamente (ou clientUserId autenticado)
        const { data: connInfo, error: connError } = await supabase.rpc(
          'get_or_create_connection_for_webhook',
          {
            p_item_id: itemId,
            p_client_user_id: clientUserId,
          }
        );

        if (connError || !connInfo || connInfo.length === 0 || !connInfo[0]?.user_id) {
          console.warn(
            `[Pluggy Webhook] Evento ${event} no item ${itemId} ignorado: nenhum user_id proprietário verificado.`
          );
          return NextResponse.json(
            { received: true, ignored: true, reason: 'Unverified item owner' },
            { status: 200 }
          );
        }

        const { user_id, family_member_id, provider_name } = connInfo[0];

        // Dispara o pipeline determinístico completo (reconciliação, pareamento de transferências, enriquecimento 3 camadas)
        syncItemAccountsAndTransactions(supabase, {
          itemId,
          userId: user_id,
          familyMemberId: family_member_id || null,
          providerName: provider_name,
        }).catch((err) => {
          console.error(`[Pluggy Webhook] Falha na sincronização do item ${itemId} (${event}):`, err);
        });

        break;
      }

      case 'transactions/deleted': {
        const { data: connInfo, error: connError } = await supabase.rpc(
          'get_or_create_connection_for_webhook',
          {
            p_item_id: itemId,
            p_client_user_id: clientUserId,
          }
        );

        if (connError || !connInfo || connInfo.length === 0 || !connInfo[0]?.user_id) {
          console.warn(
            `[Pluggy Webhook] Evento transactions/deleted no item ${itemId} ignorado: usuário não verificado.`
          );
          return NextResponse.json(
            { received: true, ignored: true, reason: 'Unverified item owner' },
            { status: 200 }
          );
        }

        const { user_id, family_member_id, provider_name } = connInfo[0];

        // Extrai IDs específicos de transações deletadas se enviados no payload
        const rawIds =
          payload?.data?.transactionIds ||
          payload?.data?.id ||
          payload?.transactionIds ||
          payload?.transactionId;

        const deletedIds: string[] = Array.isArray(rawIds)
          ? rawIds.map(String).filter(Boolean)
          : typeof rawIds === 'string' && rawIds.trim()
          ? [rawIds.trim()]
          : [];

        if (deletedIds.length > 0) {
          const { error: delErr } = await supabase
            .from('transactions')
            .delete()
            .in('pluggy_transaction_id', deletedIds)
            .eq('user_id', user_id);

          if (delErr) {
            console.error(`[Pluggy Webhook] Erro ao remover transações deletadas do item ${itemId}:`, delErr);
          }
        }

        // Resincroniza contas e saldos em background para eliminar saldo fantasma e invalida cache da IA
        syncItemAccountsAndTransactions(supabase, {
          itemId,
          userId: user_id,
          familyMemberId: family_member_id || null,
          providerName: provider_name,
        }).catch((err) => {
          console.error(`[Pluggy Webhook] Falha na resincronização pós-deleção do item ${itemId}:`, err);
        });

        await invalidateUserAiCaches(supabase, user_id);
        break;
      }

      case 'item/error': {
        await supabase.rpc('webhook_update_connection_status', {
          p_item_id: itemId,
          p_status: 'ERROR',
        });
        break;
      }

      case 'item/deleted': {
        const { data: connInfo } = await supabase.rpc(
          'get_or_create_connection_for_webhook',
          {
            p_item_id: itemId,
            p_client_user_id: clientUserId,
          }
        );

        await supabase.rpc('webhook_update_connection_status', {
          p_item_id: itemId,
          p_status: 'DISCONNECTED',
        });

        if (connInfo && connInfo.length > 0 && connInfo[0]?.user_id) {
          await invalidateUserAiCaches(supabase, connInfo[0].user_id);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true, event, itemId }, { status: 200 });
  } catch (error: any) {
    console.error('[Pluggy Webhook Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
