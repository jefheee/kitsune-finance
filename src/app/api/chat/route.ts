import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// MSLR: Multi-Step Logical Reasoning Architecture

// ==========================================
// 1. Enums and Interfaces
// ==========================================
export enum IntentEnum {
  QUERY_TRANSACTIONS = 'QUERY_TRANSACTIONS',
  GENERAL_ADVICE = 'GENERAL_ADVICE',
  GREETING = 'GREETING',
}

export interface GroqIntentResponse {
  intent: IntentEnum;
  parameters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    minValue?: number;
    maxValue?: number;
    [key: string]: any;
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const userMessage = body.message;

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ==========================================
    // STEP 1: Groq (O Roteador Rápido - Llama 3)
    // ==========================================
    // Objetivo: Classificar a intenção e extrair parâmetros estruturados do usuário.
    /*
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are an intent classifier. Return JSON strictly.' },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: "json_object" }
      })
    });
    const groqData = await groqResponse.json();
    const intentData: GroqIntentResponse = JSON.parse(groqData.choices[0].message.content);
    */
    
    // Mocking Groq Response for architecture structure
    const intentData: GroqIntentResponse = {
      intent: IntentEnum.QUERY_TRANSACTIONS,
      parameters: {}
    };

    // ==========================================
    // STEP 2: Alfândega (TypeScript + Supabase RAG)
    // ==========================================
    // Objetivo: Buscar os dados vetoriais ou relacionais puros com base na intenção.
    let contextData = null;

    if (intentData.intent === IntentEnum.QUERY_TRANSACTIONS) {
      // 1. Gerar embedding da mensagem do usuário (Ex: OpenAI text-embedding-3-small)
      // const embeddingResponse = await fetch(...)
      const mockEmbedding = new Array(1536).fill(0); // Vetor falso para estruturar código

      // 2. Busca Vetorial via RPC no Supabase (Protegida por RLS)
      const { data: matchedTransactions, error: rpcError } = await supabase.rpc('match_transactions', {
        query_embedding: mockEmbedding,
        match_threshold: 0.7,
        match_count: 10
      });

      if (rpcError) throw rpcError;

      // 3. Lógica TypeScript: Somatórias, filtros rigorosos
      const totalAmount = matchedTransactions?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0;
      
      contextData = {
        transactions: matchedTransactions,
        summary: { total: totalAmount, count: matchedTransactions?.length || 0 }
      };
    } else if (intentData.intent === IntentEnum.GENERAL_ADVICE) {
      const { data: profile } = await supabase.from('users_profile').select('*').single();
      contextData = { profile };
    }

    // ==========================================
    // STEP 3: Gemini (A Kitsune / Visão e Empatia)
    // ==========================================
    // Objetivo: Formatar a resposta final em linguagem natural, dotada da persona "Kitsune".
    /*
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `Você é Kitsune, uma raposa mítica e IA financeira sagaz. Use estritamente estes dados para responder ao usuário: ${JSON.stringify(contextData)}. Pergunta original: ${userMessage}`
          }]
        }]
      })
    });
    const geminiData = await geminiResponse.json();
    const finalAnswer = geminiData.candidates[0].content.parts[0].text;
    */

    // Mocking Gemini Response for architecture structure
    const finalAnswer = `(Simulação Gemini) Eu, a Kitsune, encontrei no meu banco mágico ${contextData?.summary?.count || 0} registros das suas transações. O total é R$ ${contextData?.summary?.total.toFixed(2) || '0.00'}. Como posso te ajudar mais?`;

    return NextResponse.json({ 
      message: finalAnswer,
      debug: { intent: intentData.intent, parameters: intentData.parameters }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
