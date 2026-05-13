import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Coletar dados do usuário para a análise
    const { data: accounts } = await supabase.from('accounts').select('balance, type').eq('user_id', userId);
    const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
    
    // Matemática básica
    const totalBalance = (accounts || []).reduce((acc, curr) => {
      const bal = Number(curr.balance) || 0;
      return curr.type === 'CREDIT' ? acc - bal : acc + bal;
    }, 0);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const expenses: any[] = [];
    
    (transactions || []).forEach(txn => {
      const [year, month, day] = txn.date.split('-');
      const txnDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (txnDate >= currentMonthStart) {
        const amount = Number(txn.amount) || 0;
        if (amount > 0) {
          monthlyIncome += amount;
        } else if (amount < 0) {
          monthlyExpense += Math.abs(amount);
          expenses.push(txn);
        }
      }
    });

    const top3Expenses = expenses.sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount))).slice(0, 3);
    const top3ExpensesText = top3Expenses.map(e => `${e.description}: R$ ${Math.abs(Number(e.amount)).toFixed(2)}`).join(', ');

    const userData = {
      saldoTotal: `R$ ${totalBalance.toFixed(2)}`,
      receitasMes: `R$ ${monthlyIncome.toFixed(2)}`,
      despesasMes: `R$ ${monthlyExpense.toFixed(2)}`,
      principaisDespesas: top3ExpensesText || 'Nenhuma despesa registrada este mês.'
    };

    // 2. Chamar LLM
    const prompt = `Você é um assessor financeiro de elite (Family Office) de um aplicativo chamado Kitsune Finance. Com base nestes dados do usuário:
- Saldo Total: ${userData.saldoTotal}
- Receitas do Mês: ${userData.receitasMes}
- Despesas do Mês: ${userData.despesasMes}
- Principais Despesas: ${userData.principaisDespesas}

Faça uma análise de no máximo 3 parágrafos. Seja analítico, não use jargões complexos, aponte onde o dinheiro está indo e dê uma recomendação prática. Responda em Markdown.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      console.error('Groq error:', err);
      return NextResponse.json({ error: 'Erro ao conectar com a inteligência artificial' }, { status: 500 });
    }

    const groqData = await groqResponse.json();
    const analysisText = groqData.choices?.[0]?.message?.content;

    if (!analysisText) {
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 });
    }

    // 3. Salvar no Supabase (Upsert usando user_id)
    const { data: insightData, error } = await supabase
      .from('ai_insights')
      .upsert({ 
        user_id: userId, 
        last_analysis_text: analysisText,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving insight:', error);
      throw error;
    }

    return NextResponse.json({ success: true, data: insightData });

  } catch (error: any) {
    console.error('Insight API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
