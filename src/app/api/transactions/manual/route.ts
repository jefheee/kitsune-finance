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
      isInstallment = false,
      installmentsCount = 1,
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

    const signedTotalAmount = type === 'DEBIT' ? -Math.abs(numAmount) : Math.abs(numAmount);
    const baseDate = date ? new Date(`${date}T12:00:00.000Z`) : new Date();
    const count = isInstallment && Number(installmentsCount) > 1 ? Math.min(Number(installmentsCount), 48) : 1;
    const installmentAmount = Math.round((signedTotalAmount / count) * 100) / 100;

    const txnsToInsert = [];
    for (let i = 1; i <= count; i++) {
      const txDate = new Date(baseDate);
      if (i > 1) {
        txDate.setMonth(txDate.getMonth() + (i - 1));
      }
      const dateStr = txDate.toISOString().split('T')[0];
      const manualId = `manual_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const desc = count > 1 ? `${description.trim()} (${i}/${count})` : description.trim();

      txnsToInsert.push({
        user_id: user.id,
        account_id: targetAccountId,
        pluggy_transaction_id: manualId,
        description: desc,
        clean_description: description.trim(),
        amount: installmentAmount,
        date: dateStr,
        executed_at: `${dateStr}T12:00:00.000Z`,
        category: category.trim(),
        category_pt: category.trim(),
        type: type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
        operation_type: 'MANUAL',
        is_internal_transfer: false,
        is_refund: false,
        is_subscription: false,
        installment_number: count > 1 ? i : null,
        total_installments: count > 1 ? count : null,
      });
    }

    const { data: insertedTxns, error: insertError } = await supabase
      .from('transactions')
      .insert(txnsToInsert)
      .select('*');

    if (insertError) {
      console.error('[API Manual Transaction error]:', insertError);
      return NextResponse.json({ error: 'Falha ao registrar transação manual.' }, { status: 500 });
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
        .update({ balance: currentBal + signedTotalAmount })
        .eq('id', targetAccountId);
    }

    return NextResponse.json({ success: true, transactions: insertedTxns });
  } catch (err: any) {
    console.error('[API Manual Transaction uncaught]:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar transação.' }, { status: 500 });
  }
}
