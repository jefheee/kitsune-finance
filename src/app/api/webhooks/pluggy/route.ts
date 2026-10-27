import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncItemAccountsAndTransactions } from '@/utils/pluggy/sync';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { event, itemId } = payload;
    const clientUserId = payload.clientUserId || payload.data?.clientUserId;

    console.log(`[Pluggy Webhook] Evento recebido: ${event} para item ${itemId}`);

    if (!itemId) {
      return NextResponse.json({ error: 'itemId não fornecido' }, { status: 400 });
    }

    // Cria cliente Supabase direto para contexto de Webhook (sem cookies de sessão)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Tratamento dos eventos solicitados
    switch (event) {
      case 'item/created':
      case 'item/updated': {
        // Busca com segurança as informações da conexão e membro familiar associado via RPC SECURITY DEFINER
        const { data: connInfo, error: connError } = await supabase.rpc(
          'get_or_create_connection_for_webhook',
          {
            p_item_id: itemId,
            p_client_user_id: clientUserId || null,
          }
        );

        if (connError || !connInfo || connInfo.length === 0) {
          console.error(`[Pluggy Webhook] Erro ao localizar/vincular item ${itemId}:`, connError);
          break;
        }

        const { user_id, family_member_id, provider_name } = connInfo[0];

        // Executa a sincronização segura de contas e transações com idempotência (Regra 4 e 6)
        // Sem bloquear o tempo limite de resposta do webhook
        syncItemAccountsAndTransactions(supabase, {
          itemId,
          userId: user_id,
          familyMemberId: family_member_id,
          providerName: provider_name,
        })
          .then((result) => {
            console.log(
              `[Pluggy Webhook] Sincronização concluída para item ${itemId}: ${result.accountsSynced} contas, ${result.transactionsSynced} transações.`
            );
          })
          .catch((err) => {
            console.error(`[Pluggy Webhook] Falha na sincronização do item ${itemId}:`, err);
          });

        break;
      }

      case 'item/error': {
        console.warn(`[Pluggy Webhook] Item com erro: ${itemId}`);
        await supabase
          .from('pluggy_connections')
          .update({ status: 'ERROR' })
          .eq('item_id', itemId);
        break;
      }

      case 'item/deleted': {
        console.log(`[Pluggy Webhook] Item deletado: ${itemId}`);
        await supabase
          .from('pluggy_connections')
          .update({ status: 'DISCONNECTED' })
          .eq('item_id', itemId);
        break;
      }

      default:
        console.log(`[Pluggy Webhook] Evento ignorado ou não tratado: ${event}`);
    }

    // A Pluggy exige resposta rápida com status 200
    return NextResponse.json({ received: true, event, itemId }, { status: 200 });
  } catch (error: any) {
    console.error('[Pluggy Webhook Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
