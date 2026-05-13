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

    // 1. Coletar dados do usuário para a análise (mock de lógica do Dashboard)
    const { data: accounts } = await supabase.from('accounts').select('balance, type').eq('user_id', userId);
    
    // Matemática básica
    const totalBalance = (accounts || []).reduce((acc, curr) => {
      const bal = Number(curr.balance) || 0;
      return curr.type === 'CREDIT' ? acc - bal : acc + bal;
    }, 0);

    // 2. Chamar LLM (Mockado para economizar tokens/API key)
    // Em produção seria: await fetch('https://api.groq.com/...' ou gemini)
    // Usando setTimeout para simular latência de LLM
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const analysisText = `(Análise Gerada por IA) Observo que seu patrimônio atual está em R$ ${totalBalance.toFixed(2)}. Recomendo revisar seus gastos no cartão de crédito e focar em alocações de renda fixa neste trimestre.`;

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
