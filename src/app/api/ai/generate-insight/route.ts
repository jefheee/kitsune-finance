import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool } from '@/utils/ai/gemini';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let preferredModel = 'gemini-3.8-flash';
    let familyMemberId: string | null = null;
    try {
      const body = await req.json();
      if (body?.model) preferredModel = body.model;
      if (body?.familyMemberId && body.familyMemberId !== 'all') {
        familyMemberId = body.familyMemberId;
      }
    } catch {
      // Body opcional
    }

    const userId = user.id;

    let accountsQuery = supabase
      .from('bank_accounts')
      .select('balance, type, bank_name, family_member_id')
      .eq('user_id', userId);

    if (familyMemberId) {
      accountsQuery = accountsQuery.eq('family_member_id', familyMemberId);
    }

    const { data: bankAccounts } = await accountsQuery;

    let txQuery = supabase
      .from('transactions')
      .select('description, amount, type, category, date, executed_at')
      .eq('user_id', userId)
      .order('executed_at', { ascending: false })
      .limit(120);

    if (familyMemberId) {
      txQuery = txQuery.eq('family_member_id', familyMemberId);
    }

    const { data: transactions } = await txQuery;

    const totalBalance = (bankAccounts || []).reduce((acc, curr) => {
      const bal = Number(curr.balance) || 0;
      return curr.type === 'CREDIT' || curr.type === 'CREDIT_CARD' ? acc - bal : acc + bal;
    }, 0);

    const creditDebt = (bankAccounts || []).reduce((acc, curr) => {
      const bal = Number(curr.balance) || 0;
      return curr.type === 'CREDIT' || curr.type === 'CREDIT_CARD' ? acc + bal : acc;
    }, 0);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const categoryTotals: Record<string, number> = {};
    const expenses: any[] = [];

    (transactions || []).forEach((txn) => {
      const rawDate = txn.executed_at || txn.date;
      const txnDate = rawDate ? new Date(rawDate) : new Date();
      const amount = Number(txn.amount) || 0;
      const isCredit = txn.type === 'CREDIT' || amount > 0;

      if (txnDate >= currentMonthStart) {
        if (isCredit) {
          monthlyIncome += Math.abs(amount);
        } else {
          const absVal = Math.abs(amount);
          monthlyExpense += absVal;
          expenses.push(txn);
          const cat = txn.category || 'Outros';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + absVal;
        }
      }
    });

    const top3Expenses = expenses
      .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
      .slice(0, 4)
      .map((e) => `${e.description} (R$ ${Math.abs(Number(e.amount)).toFixed(2)})`)
      .join(', ');

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`)
      .join(', ');

    const systemInstruction = `Você é a Kitsune AI, estrategista patrimonial pessoal e Private Wealth Advisor do Kitsune Finance.
Sua missão é entregar diagnósticos financeiros claros, objetivos, elegantes e acionáveis em português do Brasil.`;

    const prompt = `Analise os dados patrimoniais reais do usuário autenticado:
- Patrimônio Líquido Consolidado: R$ ${totalBalance.toFixed(2)}
- Faturas de Cartão de Crédito Atuais: R$ ${creditDebt.toFixed(2)}
- Receitas no Mês Atual: R$ ${monthlyIncome.toFixed(2)}
- Despesas no Mês Atual: R$ ${monthlyExpense.toFixed(2)}
- Principais Categorias de Gasto: ${topCategories || 'Sem gastos categorizados no mês atual'}
- Maiores Despesas Recentes: ${top3Expenses || 'Nenhuma despesa registrada neste mês'}
- Quantidade de Contas/Cartões Conectados: ${(bankAccounts || []).length}

Elabore um diagnóstico executivo em no máximo 3 parágrafos curtos (usando formatação limpa):
1. Visão de liquidez e balanço entre entradas, saídas e exposição em cartão de crédito.
2. Padrão de consumo observado nas maiores despesas/categorias.
3. Uma recomendação prática e imediata para otimização patrimonial.`;

    const aiResult = await generateWithGeminiPool({
      systemInstruction,
      prompt,
      preferredModel,
      temperature: 0.3,
    });

    const { data: insightData, error } = await supabase
      .from('ai_insights')
      .upsert(
        {
          user_id: userId,
          last_analysis_text: aiResult.text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: insightData,
      modelUsed: aiResult.modelUsed,
    });
  } catch (error: any) {
    console.error('Insight API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
