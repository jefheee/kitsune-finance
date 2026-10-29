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

    let preferredModel = 'gemini-3.5-flash-lite';
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
      .select('balance, type, subtype, bank_name, institution_name, family_member_id')
      .eq('user_id', userId);

    if (familyMemberId) {
      accountsQuery = accountsQuery.eq('family_member_id', familyMemberId);
    }

    const { data: bankAccounts } = await accountsQuery;

    // Buscar investimentos reais
    const { data: investments } = await supabase
      .from('investments')
      .select('balance')
      .eq('user_id', userId);

    let txQuery = supabase
      .from('transactions')
      .select('description, clean_description, amount, type, category, category_pt, date, executed_at, is_internal_transfer, is_refund')
      .eq('user_id', userId)
      .eq('is_internal_transfer', false)
      .order('executed_at', { ascending: false })
      .limit(150);

    if (familyMemberId) {
      txQuery = txQuery.eq('family_member_id', familyMemberId);
    }

    const { data: transactions } = await txQuery;

    let liquidBalance = 0;
    let creditDebt = 0;

    (bankAccounts || []).forEach((acc) => {
      const bal = Number(acc.balance) || 0;
      if (acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD') {
        creditDebt += Math.abs(bal);
      } else {
        liquidBalance += bal;
      }
    });

    const totalInvested = (investments || []).reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
    const totalBalance = liquidBalance + totalInvested - creditDebt;

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

      if (txnDate >= currentMonthStart) {
        if (txn.is_refund) {
          // Estornos abatem saídas
          monthlyExpense = Math.max(0, monthlyExpense - Math.abs(amount));
          return;
        }

        const isCredit = txn.type === 'CREDIT' || amount > 0;
        if (isCredit) {
          monthlyIncome += Math.abs(amount);
        } else {
          const absVal = Math.abs(amount);
          monthlyExpense += absVal;
          expenses.push(txn);
          const cat = txn.category_pt || txn.category || 'Outros';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + absVal;
        }
      }
    });

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`)
      .join(', ');

    const top3Expenses = expenses
      .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
      .slice(0, 4)
      .map((e) => `${e.description} (R$ ${Math.abs(Number(e.amount)).toFixed(2)})`)
      .join(', ');

    // Cálculo matemático do score patrimonial (0 a 1000)
    let calculatedScore = 750;
    if (liquidBalance > creditDebt * 2) calculatedScore += 100;
    else if (liquidBalance >= creditDebt) calculatedScore += 50;
    else calculatedScore -= 120;

    if (monthlyIncome > monthlyExpense * 1.3) calculatedScore += 50;
    else if (monthlyIncome < monthlyExpense) calculatedScore -= 80;

    calculatedScore = Math.min(990, Math.max(300, calculatedScore));
    const scoreLabel = calculatedScore >= 800 ? 'Excelente' : calculatedScore >= 650 ? 'Bom' : 'Atenção';

    const systemInstruction = `Você é a Kitsune AI, estrategista de patrimônio pessoal e Private Wealth Advisor.
Sua missão é responder EXCLUSIVAMENTE em formato JSON VÁLIDO (sem blocos de código markdown ou texto extra).
Diretrizes:
- Baseie-se ESTRITAMENTE nos números numéricos fornecidos no prompt. Nunca invente valores.
- O formato deve ser um JSON estrito com os seguintes campos:
{
  "headline": "Frase de efeito executiva (máx 10 palavras)",
  "summary": "Resumo executivo em 2 frases diretas de alto impacto.",
  "score": ${calculatedScore},
  "scoreLabel": "${scoreLabel}",
  "cards": [
    {
      "title": "Cobertura de Liquidez",
      "value": "R$ ${liquidBalance.toFixed(2)}",
      "badge": "${liquidBalance >= creditDebt ? 'Faturas Cobertas' : 'Atenção à Liquidez'}",
      "status": "${liquidBalance >= creditDebt ? 'positive' : 'warning'}",
      "desc": "Saldo em conta representa ${creditDebt > 0 ? (liquidBalance / creditDebt).toFixed(1) + 'x' : '100% de folga sobre'} o volume de faturas abertas."
    },
    {
      "title": "Impacto Principal",
      "value": "R$ ${(Object.values(categoryTotals)[0] || 0).toFixed(2)}",
      "badge": "${Object.keys(categoryTotals)[0] || 'Despesas Gerais'}",
      "status": "neutral",
      "desc": "Categoria com maior peso nas saídas do período consolidado."
    },
    {
      "title": "Margem Operacional",
      "value": "R$ ${Math.max(0, monthlyIncome - monthlyExpense).toFixed(2)}",
      "badge": "${monthlyIncome >= monthlyExpense ? 'Superávit' : 'Déficit'}",
      "status": "${monthlyIncome >= monthlyExpense ? 'positive' : 'danger'}",
      "desc": "${monthlyIncome >= monthlyExpense ? 'Capacidade de poupança e expansão patrimonial ativa.' : 'Despesas superaram as receitas no período.'}"
    }
  ],
  "actionPoints": [
    {
      "icon": "shield",
      "title": "Recomendação 1",
      "desc": "Ação prática imediata para otimização de caixa."
    },
    {
      "icon": "trending_up",
      "title": "Recomendação 2",
      "desc": "Meta de alocação ou controle de despesas discricionárias."
    }
  ],
  "fullReport": "Parecer consultivo detalhado e fundamentado em 3 parágrafos sem usar asteriscos soltos."
}`;

    const prompt = `Analise os dados patrimoniais reais:
- Patrimônio Líquido Consolidado: R$ ${totalBalance.toFixed(2)}
- Saldo Disponível em Conta: R$ ${liquidBalance.toFixed(2)}
- Faturas de Cartão de Crédito Atuais: R$ ${creditDebt.toFixed(2)}
- Receitas no Mês Atual: R$ ${monthlyIncome.toFixed(2)}
- Despesas no Mês Atual: R$ ${monthlyExpense.toFixed(2)}
- Principais Categorias: ${topCategories || 'Sem gastos categorizados'}
- Maiores Despesas: ${top3Expenses || 'Nenhuma'}
- Contas Conectadas: ${(bankAccounts || []).length}

Gere o JSON estrito conforme a especificação do sistema.`;

    const aiResult = await generateWithGeminiPool({
      systemInstruction,
      prompt,
      preferredModel,
      temperature: 0.2,
    });

    // Sanitiza para garantir que temos JSON limpo
    let cleanedText = aiResult.text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Valida se é JSON válido; se não for, envelopa
    let jsonPayload: any;
    try {
      jsonPayload = JSON.parse(cleanedText);
    } catch {
      jsonPayload = {
        headline: 'Diagnóstico Consolidado do Seu Patrimônio',
        summary: cleanedText.slice(0, 180) + '...',
        score: calculatedScore,
        scoreLabel,
        cards: [
          {
            title: 'Cobertura de Liquidez',
            value: `R$ ${liquidBalance.toFixed(2)}`,
            badge: liquidBalance >= creditDebt ? 'Faturas Cobertas' : 'Atenção',
            status: liquidBalance >= creditDebt ? 'positive' : 'warning',
            desc: 'Saldo disponível em contas correntes.',
          },
          {
            title: 'Maior Categoria',
            value: `R$ ${(Object.values(categoryTotals)[0] || 0).toFixed(2)}`,
            badge: Object.keys(categoryTotals)[0] || 'Geral',
            status: 'neutral',
            desc: 'Maior volume de despesas registradas.',
          },
          {
            title: 'Margem do Mês',
            value: `R$ ${Math.max(0, monthlyIncome - monthlyExpense).toFixed(2)}`,
            badge: monthlyIncome >= monthlyExpense ? 'Superávit' : 'Déficit',
            status: monthlyIncome >= monthlyExpense ? 'positive' : 'danger',
            desc: 'Diferença entre entradas e saídas confirmadas.',
          },
        ],
        actionPoints: [
          {
            icon: 'savings',
            title: 'Equilíbrio Financeiro',
            desc: 'Mantenha os aportes recorrentes para ampliar a reserva de liquidez.',
          },
        ],
        fullReport: cleanedText,
      };
      cleanedText = JSON.stringify(jsonPayload);
    }

    const { data: insightData, error } = await supabase
      .from('ai_insights')
      .upsert(
        {
          user_id: userId,
          last_analysis_text: cleanedText,
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
