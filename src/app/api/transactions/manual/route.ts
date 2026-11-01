import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      description,
      amount,
      type = 'DEBIT',
      date,
      category = 'Geral',
      accountId,
    } = body;

    const numAmount = parseFloat(String(amount).replace(',', '.'));
    if (!description || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Descrição e valor positivo são obrigatórios.' },
        { status: 400 }
      );
    }

    // Se o usuário não passou conta específica, busca ou cria a conta "Carteira / Dinheiro Físico"
    let targetAccountId = accountId;

    if (!targetAccountId) {
      const { data: existingCashAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'MANUAL')
        .maybeSingle();

      if (existingCashAccount) {
        targetAccountId = existingCashAccount.id;
      } else {
        // Cria a conta virtual de Dinheiro Físico
        const { data: newCashAccount, error: createAccErr } = await supabase
          .from('bank_accounts')
          .insert({
            user_id: user.id,
            product_name: 'Carteira / Dinheiro em Espécie',
            bank_name: 'Dinheiro Físico',
            institution_name: 'Carteira Física',
            institution_slug: 'cash',
            type: 'MANUAL',
            subtype: 'CASH',
            balance: 0,
            currency_code: 'BRL',
          })
          .select('id')
          .single();

        if (createAccErr || !newCashAccount) {
          // Fallback para qualquer conta bancária do usuário
          const { data: anyAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          targetAccountId = anyAccount?.id;
        } else {
          targetAccountId = newCashAccount.id;
        }
      }
    }

    if (!targetAccountId) {
      return NextResponse.json(
        { error: 'Nenhuma conta bancária ou de carteira encontrada.' },
        { status: 400 }
      );
    }

    const signedAmount = type === 'DEBIT' ? -Math.abs(numAmount) : Math.abs(numAmount);
    const executionDate = date || new Date().toISOString().split('T')[0];
    const manualId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const { data: insertedTxn, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: targetAccountId,
        pluggy_transaction_id: manualId,
        description: description.trim(),
        clean_description: description.trim(),
        amount: signedAmount,
        date: executionDate,
        executed_at: `${executionDate}T12:00:00.000Z`,
        category: category.trim(),
        category_pt: category.trim(),
        type: type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
        operation_type: 'MANUAL',
        is_internal_transfer: false,
        is_refund: false,
        is_subscription: false,
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Atualiza o saldo da conta de destino se for conta manual de dinheiro
    const { data: accData } = await supabase
      .from('bank_accounts')
      .select('type, balance')
      .eq('id', targetAccountId)
      .single();

    if (accData && accData.type === 'MANUAL') {
      const currentBal = Number(accData.balance) || 0;
      await supabase
        .from('bank_accounts')
        .update({ balance: currentBal + signedAmount })
        .eq('id', targetAccountId);
    }

    return NextResponse.json({ success: true, transaction: insertedTxn });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
