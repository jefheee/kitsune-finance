import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool, KITSUNE_GEMINI_MODELS } from '@/utils/ai/gemini';

export async function GET() {
  return NextResponse.json({
    models: KITSUNE_GEMINI_MODELS,
  });
}

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

    const body = await req.json();
    const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';
    const preferredModel = typeof body?.model === 'string' ? body.model : 'gemini-3.8-flash';
    const scopeMemberId =
      typeof body?.familyMemberId === 'string' && body.familyMemberId !== 'all' && body.familyMemberId !== 'personal'
        ? body.familyMemberId
        : null;
    const rawHistory = Array.isArray(body?.history) ? body.history : [];

    if (!userMessage) {
      return NextResponse.json({ error: 'Mensagem é obrigatória.' }, { status: 400 });
    }

    // 1. Coleta estritamente os dados financeiros do user.id autenticado (Isolamento Multi-Tenant)
    let accountsQuery = supabase
      .from('bank_accounts')
      .select('id, bank_name, type, balance, currency, family_member_id, updated_at')
      .eq('user_id', user.id);

    let transactionsQuery = supabase
      .from('transactions')
      .select('id, description, amount, type, category, date, executed_at, account_id, family_member_id')
      .eq('user_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(100);

    if (scopeMemberId) {
      accountsQuery = accountsQuery.eq('family_member_id', scopeMemberId);
      transactionsQuery = transactionsQuery.eq('family_member_id', scopeMemberId);
    }

    const [{ data: accounts }, { data: transactions }, { data: familyMembers }] =
      await Promise.all([
        accountsQuery,
        transactionsQuery,
        supabase
          .from('family_members')
          .select('id, name, role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ]);

    const safeAccounts = accounts || [];
    const safeTransactions = transactions || [];
    const safeMembers = familyMembers || [];

    const accountMap = new Map<string, string>();
    safeAccounts.forEach((a) => accountMap.set(a.id, a.bank_name));

    const memberMap = new Map<string, string>();
    safeMembers.forEach((m) => memberMap.set(m.id, `${m.name} (${m.role || 'Membro'})`));

    // 2. Agregações determinísticas em TypeScript
    let liquidBalance = 0;
    let creditCardDebt = 0;

    safeAccounts.forEach((acc) => {
      const bal = Number(acc.balance) || 0;
      if (acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD') {
        creditCardDebt += bal;
      } else {
        liquidBalance += bal;
      }
    });

    const netWorth = liquidBalance - creditCardDebt;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthlyInflow = 0;
    let monthlyOutflow = 0;
    const categoryBreakdown: Record<string, number> = {};

    safeTransactions.forEach((tx) => {
      const rawDate = tx.executed_at || tx.date;
      const d = rawDate ? new Date(rawDate) : new Date();
      const amt = Number(tx.amount) || 0;
      const isCredit = tx.type === 'CREDIT' || amt > 0;

      if (d >= currentMonthStart) {
        if (isCredit) {
          monthlyInflow += Math.abs(amt);
        } else {
          monthlyOutflow += Math.abs(amt);
        }
      }

      if (!isCredit) {
        const cat = tx.category || 'Outros';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(amt);
      }
    });

    const recentTransactionsDigest = safeTransactions.slice(0, 35).map((tx) => ({
      data: (tx.executed_at || tx.date || '').toString().split('T')[0],
      descricao: tx.description,
      valor: Number(tx.amount),
      tipo: tx.type === 'CREDIT' || Number(tx.amount) > 0 ? 'ENTRADA' : 'SAIDA',
      categoria: tx.category || 'Outros',
      conta: accountMap.get(tx.account_id) || 'Conta',
      membro: tx.family_member_id ? memberMap.get(tx.family_member_id) || 'Titular' : 'Pessoal',
    }));

    const financialContext = {
      usuario: user.user_metadata?.full_name || user.email || 'Titular',
      escopoAnalise: scopeMemberId
        ? memberMap.get(scopeMemberId) || 'Membro selecionado'
        : 'Patrimônio Pessoal do Usuário',
      resumoPatrimonial: {
        patrimonioLiquidoBRL: Number(netWorth.toFixed(2)),
        saldoEmContaBRL: Number(liquidBalance.toFixed(2)),
        faturaCartoesBRL: Number(creditCardDebt.toFixed(2)),
        receitasMesAtualBRL: Number(monthlyInflow.toFixed(2)),
        despesasMesAtualBRL: Number(monthlyOutflow.toFixed(2)),
        resultadoMensalBRL: Number((monthlyInflow - monthlyOutflow).toFixed(2)),
      },
      contasConectadas: safeAccounts.map((a) => ({
        instituicao: a.bank_name,
        tipo: a.type,
        saldo: Number(a.balance),
        moeda: a.currency,
        membro: a.family_member_id ? memberMap.get(a.family_member_id) || 'Titular' : 'Pessoal',
      })),
      gastosPorCategoriaRecentes: Object.entries(categoryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([categoria, total]) => ({ categoria, totalBRL: Number(total.toFixed(2)) })),
      ultimasTransacoes: recentTransactionsDigest,
    };

    const systemInstruction = `Você é a Kitsune AI, uma estrategista financeira pessoal de elite (Private Family Office & Wealth Advisor) integrada ao Kitsune Finance.
Diretrizes obrigatórias:
1. Você tem acesso EXCLUSIVO aos dados financeiros reais do usuário logado fornecidos no JSON de contexto abaixo. Nunca invente transações ou saldos que não estejam no contexto.
2. Responda sempre em português do Brasil com clareza, precisão numérica (formate valores em R$ X.XXX,XX) e recomendações práticas.
3. Use formatação clara (tópicos, destaques) para facilitar a leitura rápida.

CONTEXTO FINANCEIRO ATUALIZADO DO USUÁRIO:
${JSON.stringify(financialContext, null, 2)}`;

    const sanitizedHistory = rawHistory
      .slice(-8)
      .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? ('model' as const) : ('user' as const),
        content: m.content,
      }));

    const aiResponse = await generateWithGeminiPool({
      systemInstruction,
      prompt: userMessage,
      history: sanitizedHistory,
      preferredModel,
      temperature: 0.35,
    });

    return NextResponse.json({
      message: aiResponse.text,
      modelUsed: aiResponse.modelUsed,
      keyPoolIndex: aiResponse.keyIndexUsed,
      summarySnapshot: financialContext.resumoPatrimonial,
    });
  } catch (error: any) {
    console.error('[Chat API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar sua consulta na Kitsune AI.' },
      { status: 500 }
    );
  }
}
