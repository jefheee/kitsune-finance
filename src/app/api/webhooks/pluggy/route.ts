import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { event, itemId } = payload;

    // A Pluggy exige que o endpoint responda rapidamente (menos de 5 segundos).
    // O ideal é enfileirar o processamento via Background Jobs ou tratar assincronamente.
    
    switch (event) {
      case 'item/created':
        console.log(`[Webhook] Item Created: ${itemId}`);
        // TODO: Iniciar processo de importação inicial das transações (RAG)
        break;
      case 'item/updated':
        console.log(`[Webhook] Item Updated: ${itemId}`);
        // TODO: Atualizar transações novas/modificadas, recalcular saldos
        break;
      case 'item/error':
        console.log(`[Webhook] Item Error: ${itemId}`);
        // TODO: Notificar o usuário que a conexão bancária falhou ou expirou
        break;
      case 'transaction/created':
        console.log(`[Webhook] Transaction Created: ${itemId}`);
        // TODO: Fetch transaction details from Pluggy API using event.id and insert into Supabase transactions table with vector embeddings
        break;
      case 'transaction/updated':
        console.log(`[Webhook] Transaction Updated: ${itemId}`);
        // TODO: Fetch transaction details from Pluggy API using event.id and update Supabase transactions table
        break;
      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
