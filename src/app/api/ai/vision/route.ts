import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool } from '@/utils/ai/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    const body = await req.json();
    const { imageBase64, analysisType = 'custom', customPrompt = '' } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Imagem não fornecida ou formato inválido.' },
        { status: 400 }
      );
    }

    // Separa mimetype e base64 raw
    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let rawBase64 = imageBase64;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      rawBase64 = matches[2];
    }

    // Busca dossiê financeiro sintetizado do usuário de forma ultra-otimizada
    const [profileRes, accountsRes, transactionsRes, investmentsRes] = await Promise.all([
      supabase
        .from('users_profile')
        .select('monthly_income, financial_goal, display_name, full_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('bank_accounts')
        .select('balance, type, subtype, credit_limit, available_credit_limit, bank_name, institution_name')
        .eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('amount, type, category_pt, date, is_internal_transfer')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100),
      supabase
        .from('investments')
        .select('balance')
        .eq('user_id', user.id),
    ]);

    const profile: any = profileRes.data || {};
    const accounts = accountsRes.data || [];
    const transactions = transactionsRes.data || [];
    const investments = investmentsRes.data || [];

    // Cálculos determinísticos no servidor para economizar tokens do modelo
    let liquidBalance = 0;
    let creditCardDebt = 0;
    let totalCreditLimit = 0;
    let availableCreditLimit = 0;

    accounts.forEach((acc) => {
      const b = Number(acc.balance) || 0;
      if (acc.subtype === 'CREDIT_CARD' || acc.type === 'CREDIT') {
        creditCardDebt += Math.abs(b);
        totalCreditLimit += Number(acc.credit_limit) || 0;
        availableCreditLimit += Number(acc.available_credit_limit) || 0;
      } else {
        liquidBalance += b;
      }
    });

    const investmentsTotal = investments.reduce(
      (sum, inv) => sum + (Number(inv.balance) || 0),
      0
    );

    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let monthlyExpenses = 0;
    const categoryTotals: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.is_internal_transfer) return;
      if (tx.date && tx.date.startsWith(curMonthStr) && tx.amount > 0) {
        monthlyExpenses += Number(tx.amount) || 0;
        const cat = tx.category_pt || 'Outros';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(tx.amount);
      }
    });

    const monthlyIncome = Number(profile.monthly_income) || 4500;
    const hourlyRate = monthlyIncome > 0 ? monthlyIncome / 160 : 28.12; // 160 horas úteis por mês
    const freeCashFlow = monthlyIncome - monthlyExpenses;

    const userSummary = {
      userName: profile.display_name || profile.full_name || 'Usuário',
      monthlyIncome,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      liquidBalance,
      investmentsTotal,
      creditCardDebt,
      availableCreditLimit,
      monthlyExpenses,
      freeCashFlow,
      financialGoal: profile.financial_goal || 'Construção de patrimônio e reserva',
    };

    const systemInstruction = `Você é o Kitsune Vision, o cérebro multimodal de inteligência financeira da Kitsune Finance.
Você é extremamente analítico, perspicaz, honesto, focado em prosperidade e matematicamente rigoroso.
Você analisa fotos de cardápios, produtos físicos, simulações de financiamento de bens caros (casas, apartamentos, carros, motos, consórcios), faturas e comprovantes.
O usuário possui o seguinte contexto financeiro consolidado:
- Nome: ${userSummary.userName}
- Renda Mensal Declarada: R$ ${userSummary.monthlyIncome.toFixed(2)}
- Valor da Hora de Trabalho: R$ ${userSummary.hourlyRate.toFixed(2)} / hora (base 160h/mês)
- Saldo Líquido em Conta Corrente: R$ ${userSummary.liquidBalance.toFixed(2)}
- Investimentos Totais: R$ ${userSummary.investmentsTotal.toFixed(2)}
- Dívida Atual de Cartão de Crédito: R$ ${userSummary.creditCardDebt.toFixed(2)}
- Limite Disponível no Cartão: R$ ${userSummary.availableCreditLimit.toFixed(2)}
- Gastos já realizados neste mês: R$ ${userSummary.monthlyExpenses.toFixed(2)}
- Fluxo de Caixa Livre Estimado: R$ ${userSummary.freeCashFlow.toFixed(2)}
- Objetivo Patrimonial: ${userSummary.financialGoal}

DIRETRIZES DE ANÁLISE POR TIPO:
1. "menu" (Cardápio de restaurante):
   - Identifique os pratos, categorias e preços.
   - Avalie o que cabe confortavelmente no orçamento diário de alimentação sem comprometer o fluxo do mês.
   - Aponte a melhor opção custo-benefício e alerte se algum prato for desproporcional.
2. "product" (Produto, etiqueta ou vitrine):
   - Identifique o item e o preço total/à vista.
   - Calcule quantas horas de trabalho do usuário (${userSummary.hourlyRate.toFixed(2)}/h) são necessárias para pagar esse item.
   - Julgue se é um gasto essencial ou impulso e se cabe no fluxo de caixa livre (R$ ${userSummary.freeCashFlow.toFixed(2)}).
3. "big_purchase" (Simulação de Casa, Carro, Financiamento, Empréstimo, Consórcio):
   - Extraia entrada, valor das parcelas, prazo (meses), taxa de juros (mensal/anual/CET) e valor total financiado.
   - Aplique a REGRA DE OURO DOS 30%: a parcela NUNCA deve ultrapassar 30% da renda líquida (limite seguro: R$ ${(userSummary.monthlyIncome * 0.3).toFixed(2)}).
   - Calcule o custo real total (Total pago menos o valor original do bem) para mostrar o quanto de juros o banco está lucrando.
   - Avalie o impacto na reserva de emergência e se o usuário deve juntar mais para dar de entrada ou amortizar.
4. "receipt" (Nota Fiscal ou comprovante):
   - Liste os itens, alerte cobranças indevidas, taxas de serviço e verifique se há despesas recorrentes.
5. "custom":
   - Responda à pergunta do usuário utilizando a imagem e todos os dados financeiros.

RETORNO MANDATÓRIO:
Você DEVE responder EXCLUSIVAMENTE em formato JSON VÁLIDO sem cercaduras de markdown além do bloco json:
{
  "title": "Título conciso da análise",
  "verdict": "APROVADO" | "ATENÇÃO" | "DESACONSELHADO" | "OPORTUNIDADE",
  "verdictColor": "emerald" | "amber" | "rose" | "blue",
  "summary": "Resumo executivo direto de 2 a 3 frases explicando a decisão.",
  "detectedItems": [
    { "name": "Nome do item/prato/parcela", "price": 120.50, "notes": "Custo benefício excelente" }
  ],
  "financialImpact": {
    "totalAmount": 120.50,
    "monthlyImpactPercent": 2.68,
    "workHoursRequired": 4.28,
    "cashFlowImpact": "Neutro / Positivo / Negativo",
    "interestCost": 0
  },
  "recommendations": [
    "Dica prática 1",
    "Dica prática 2"
  ],
  "alternativeStrategy": "Sugestão alternativa mais inteligente para pagar menos ou negociar.",
  "deepAnalysis": "Texto detalhado em markdown com cálculos explicados, prós e contras."
}`;

    const promptText = `Analise detalhadamente esta imagem sob a perspectiva do modo: "${analysisType}".
Instrução adicional do usuário: "${customPrompt || 'Faça a análise completa e calcule o impacto nas minhas finanças.'}"`;

    const aiRes = await generateWithGeminiPool({
      systemInstruction,
      prompt: promptText,
      preferredModel: 'gemini-3.8-flash',
      temperature: 0.2,
      images: [
        {
          mimeType,
          data: rawBase64,
        },
      ],
    });

    // Parse do JSON com fallback robusto caso venha envelopado em ```json
    let parsedJson: any = null;
    try {
      const cleaned = aiRes.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsedJson = JSON.parse(cleaned);
    } catch (parseErr) {
      // Se não for JSON estrito, empacota como deepAnalysis
      parsedJson = {
        title: 'Análise Visual Kitsune Vision',
        verdict: 'ATENÇÃO',
        verdictColor: 'amber',
        summary: 'A IA gerou a análise completa dos itens detectados na imagem.',
        detectedItems: [],
        financialImpact: {
          totalAmount: 0,
          monthlyImpactPercent: 0,
          workHoursRequired: 0,
          cashFlowImpact: 'Avaliação personalizada',
          interestCost: 0,
        },
        recommendations: [
          'Confira os detalhes na análise aprofundada abaixo.',
          'Consulte seu saldo livre antes de tomar decisões financeiras.',
        ],
        alternativeStrategy: null,
        deepAnalysis: aiRes.text,
      };
    }

    return NextResponse.json({
      success: true,
      data: parsedJson,
      modelUsed: aiRes.modelUsed,
      userMetrics: {
        monthlyIncome: userSummary.monthlyIncome,
        hourlyRate: userSummary.hourlyRate,
        liquidBalance: userSummary.liquidBalance,
        freeCashFlow: userSummary.freeCashFlow,
      },
    });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/vision:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar análise multimodal.' },
      { status: 500 }
    );
  }
}
