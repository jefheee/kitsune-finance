import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncItemAccountsAndTransactions } from '@/utils/pluggy/sync';

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
      case 'item/updated': {
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
            `[Pluggy Webhook] Item ${itemId} ignorado: nenhum user_id proprietário verificado.`
          );
          return NextResponse.json(
            { received: true, ignored: true, reason: 'Unverified item owner' },
            { status: 200 }
          );
        }

        const { user_id, family_member_id, provider_name } = connInfo[0];

        syncItemAccountsAndTransactions(supabase, {
          itemId,
          userId: user_id,
          familyMemberId: family_member_id || null,
          providerName: provider_name,
        }).catch((err) => {
          console.error(`[Pluggy Webhook] Falha na sincronização do item ${itemId}:`, err);
        });

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
        await supabase.rpc('webhook_update_connection_status', {
          p_item_id: itemId,
          p_status: 'DISCONNECTED',
        });
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
