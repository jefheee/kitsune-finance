import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool } from '@/utils/ai/gemini';
import { getBankCatalogBySlugOrName } from '@/utils/pluggy/bank-resolver';
import { detectUserIncomePattern } from '@/utils/finance/income-detector';

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
    let bankSlug: string | null = null;

    try {
      const body = await req.json();
      if (body?.model) preferredModel = body.model;
      if (body?.familyMemberId && body.familyMemberId !== 'all') {
        familyMemberId = body.familyMemberId;
      }
      if (body?.bankSlug && body.bankSlug !== 'all') {
        bankSlug = body.bankSlug;
      }
    } catch {
      // Body opcional
    }

    const userId = user.id;

    // Buscar perfil do usuário para capturar objetivo patrimonial e renda declarada
    const { data: userProfile } = await supabase
      .from('users_profile')
      .select('financial_goal, display_name, full_name, monthly_income')
      .eq('id', userId)
      .maybeSingle();

    const userGoal = userProfile?.financial_goal || 'Equilíbrio Financeiro e Reserva de Liquidez';

    let accountsQuery = supabase
      .from('bank_accounts')
      .select('id, balance, type, subtype, bank_name, institution_name, institution_slug, family_member_id')
      .eq('user_id', userId);

    if (familyMemberId) {
      accountsQuery = accountsQuery.eq('family_member_id', familyMemberId);
    }

    const { data: rawBankAccounts } = await accountsQuery;
    let bankAccounts = rawBankAccounts || [];

    // Se houver filtro de banco específico, restringe as contas ao banco selecionado
    if (bankSlug) {
      bankAccounts = bankAccounts.filter((acc) => {
        const slug = getBankCatalogBySlugOrName(
          acc.institution_slug || acc.institution_name || acc.bank_name
        ).slug;
        return slug === bankSlug;
      });
    }

    const targetAccountIds = new Set(bankAccounts.map((a) => a.id));

    // Buscar investimentos reais
    let invQuery = supabase
      .from('investments')
      .select('balance, institution_name, name')
      .eq('user_id', userId);

    const { data: rawInvestments } = await invQuery;
    let investments = rawInvestments || [];
    if (bankSlug) {
      investments = investments.filter((inv) => {
        const slug = getBankCatalogBySlugOrName(inv.institution_name).slug;
        return slug === bankSlug;
      });
    }

    let txQuery = supabase
      .from('transactions')
      .select('account_id, description, clean_description, amount, type, category, category_pt, date, executed_at, is_internal_transfer, is_refund, payer_name')
      .eq('user_id', userId)
      .eq('is_internal_transfer', false)
      .order('executed_at', { ascending: false })
      .limit(250);

    if (familyMemberId) {
      txQuery = txQuery.eq('family_member_id', familyMemberId);
    }

    const { data: rawTransactions } = await txQuery;
    let transactions = rawTransactions || [];

    // Se houver filtro de banco, filtra transações pertencentes às contas daquele banco
    if (bankSlug && targetAccountIds.size > 0) {
      transactions = transactions.filter((t) => targetAccountIds.has(t.account_id));
    }

    // Detectar padrão de renda real a partir dos lançamentos
    const incomeProfile = detectUserIncomePattern(transactions, userProfile?.monthly_income);

    let liquidBalance = 0;
    let creditDebt = 0;

    bankAccounts.forEach((acc) => {
      const bal = Number(acc.balance) || 0;
      if (acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD') {
        creditDebt += Math.abs(bal);
      } else {
        liquidBalance += bal;
      }
    });

    const totalInvested = investments.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
    const totalBalance = liquidBalance + totalInvested - creditDebt;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const categoryTotals: Record<string, number> = {};
    const expenses: any[] = [];

    transactions.forEach((txn) => {
      const rawDate = txn.executed_at || txn.date;
      const txnDate = rawDate ? new Date(rawDate) : new Date();
      const amount = Number(txn.amount) || 0;

      if (txnDate >= currentMonthStart) {
        if (txn.is_refund) {
          // Estornos abatem saídas diretamente
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
      .slice(0, 3)
      .map((e) => `${e.clean_description || e.description} (R$ ${Math.abs(Number(e.amount)).toFixed(2)})`)
      .join(', ');

    // Cálculo matemático do score patrimonial (0 a 1000)
    let calculatedScore = 750;
    if (liquidBalance > creditDebt * 2) calculatedScore += 100;
    else if (liquidBalance >= creditDebt) calculatedScore += 50;
    else calculatedScore -= 120;

    if (monthlyIncome > monthlyExpense * 1.3) calculatedScore += 50;
    else if (monthlyIncome < monthlyExpense) calculatedScore -= 80;

    calculatedScore = Math.min(990, Math.max(300, calculatedScore));
    const scoreLabel = calculatedScore >= 800 ? 'Excelente' : calculatedScore >= 650 ? 'Muito Bom' : 'Atenção';

    const bankContextLabel = bankSlug
      ? `Filtrado para o banco: ${getBankCatalogBySlugOrName(bankSlug).name}`
      : 'Consolidado Geral de Todos os Bancos';

    const systemInstruction = `Você é a Kitsune AI, estrategista de patrimônio pessoal e Private Wealth Advisor.
Sua missão é responder EXCLUSIVAMENTE em formato JSON VÁLIDO (sem blocos de código markdown ou texto extra).
REGRAS INVIOLÁVEIS:
1. NUNCA invente, estime ou alucine números de receitas ou despesas. Use ESTRITAMENTE os valores do prompt.
   - Receitas do mês: R$ ${monthlyIncome.toFixed(2)}
   - Despesas do mês: R$ ${monthlyExpense.toFixed(2)}
   - Saldo líquido: R$ ${liquidBalance.toFixed(2)}
   - Faturas de cartão: R$ ${creditDebt.toFixed(2)}
2. NUNCA classifique "Transferência Própria" ou "Pagamento de Fatura" como despesa ou saída.
3. As recomendações e plano de ação DEVEM estar 100% alinhadas com o objetivo patrimonial do usuário: "${userGoal}".
4. Considere o perfil de renda do usuário: "${incomeProfile.typeLabel}".

Formato estrito esperado:
{
  "headline": "Frase de efeito executiva (máx 10 palavras)",
  "summary": "Resumo executivo de exatamente 2 frases citando os números reais exatos fornecidos.",
  "score": ${calculatedScore},
  "scoreLabel": "${scoreLabel}",
  "cards": [
    {
      "title": "Cobertura de Liquidez",
      "value": "R$ ${liquidBalance.toFixed(2)}",
      "badge": "${liquidBalance >= creditDebt ? 'Faturas Cobertas' : 'Atenção à Liquidez'}",
      "status": "${liquidBalance >= creditDebt ? 'positive' : 'warning'}",
      "desc": "Saldo disponível em conta frente a faturas abertas."
    },
    {
      "title": "Principal Saída",
      "value": "R$ ${(Object.values(categoryTotals)[0] || 0).toFixed(2)}",
      "badge": "${Object.keys(categoryTotals)[0] || 'Despesas Gerais'}",
      "status": "neutral",
      "desc": "Maior linha de desembolso operacional no mês."
    },
    {
      "title": "Margem Operacional",
      "value": "R$ ${(monthlyIncome - monthlyExpense).toFixed(2)}",
      "badge": "${monthlyIncome >= monthlyExpense ? 'Superávit' : 'Déficit'}",
      "status": "${monthlyIncome >= monthlyExpense ? 'positive' : 'danger'}",
      "desc": "Diferença líquida real entre entradas e saídas do mês."
    }
  ],
  "actionPoints": [
    {
      "icon": "shield",
      "title": "Ação Estratégica 1",
      "desc": "Ação prática direcionada à meta: ${userGoal}."
    },
    {
      "icon": "trending_up",
      "title": "Ação Estratégica 2",
      "desc": "Meta de caixa ou controle coerente com o perfil: ${incomeProfile.typeLabel}."
    }
  ],
  "fullReport": "Parecer consultivo detalhado de 3 parágrafos sem asteriscos ou jargões técnicos."
}`;

    const prompt = `Analise os dados patrimoniais auditados (${bankContextLabel}):
- Contexto de Visualização: ${bankContextLabel}
- Objetivo Patrimonial do Usuário: "${userGoal}"
- Perfil de Renda Detectado: ${incomeProfile.typeLabel} (Média Mensal: R$ ${incomeProfile.monthlyAverageIncome.toFixed(2)})
- Patrimônio Líquido: R$ ${totalBalance.toFixed(2)}
- Saldo Disponível em Conta: R$ ${liquidBalance.toFixed(2)}
- Faturas de Cartão Atuais: R$ ${creditDebt.toFixed(2)}
- Total Investido: R$ ${totalInvested.toFixed(2)}
- Receitas do Mês Atual: R$ ${monthlyIncome.toFixed(2)}
- Despesas do Mês Atual: R$ ${monthlyExpense.toFixed(2)}
- Margem do Mês: R$ ${(monthlyIncome - monthlyExpense).toFixed(2)}
- Principais Categorias Operacionais: ${topCategories || 'Sem gastos no mês'}
- Maiores Despesas Operacionais: ${top3Expenses || 'Nenhuma saída'}
- Contas Conectadas no Âmbito: ${bankAccounts.length}

Gere o JSON estrito conforme especificado. NUNCA cite números que não sejam os acima.`;

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

    let jsonPayload: any;
    try {
      jsonPayload = JSON.parse(cleanedText);
    } catch {
      jsonPayload = {
        headline: 'Diagnóstico Consolidado do Seu Patrimônio',
        summary: `Receitas de R$ ${monthlyIncome.toFixed(2)} e despesas de R$ ${monthlyExpense.toFixed(2)}, com saldo líquido de R$ ${liquidBalance.toFixed(2)}.`,
        score: calculatedScore,
        scoreLabel,
        cards: [
          {
            title: 'Cobertura de Liquidez',
            value: `R$ ${liquidBalance.toFixed(2)}`,
            badge: liquidBalance >= creditDebt ? 'Faturas Cobertas' : 'Atenção',
            status: liquidBalance >= creditDebt ? 'positive' : 'warning',
            desc: 'Saldo disponível em contas.',
          },
          {
            title: 'Principal Saída',
            value: `R$ ${(Object.values(categoryTotals)[0] || 0).toFixed(2)}`,
            badge: Object.keys(categoryTotals)[0] || 'Despesas Gerais',
            status: 'neutral',
            desc: 'Maior volume de despesas operacionais.',
          },
          {
            title: 'Margem do Mês',
            value: `R$ ${(monthlyIncome - monthlyExpense).toFixed(2)}`,
            badge: monthlyIncome >= monthlyExpense ? 'Superávit' : 'Déficit',
            status: monthlyIncome >= monthlyExpense ? 'positive' : 'danger',
            desc: 'Diferença entre entradas e saídas confirmadas.',
          },
        ],
        actionPoints: [
          {
            icon: 'savings',
            title: 'Diretriz Patrimonial',
            desc: `Direcione o saldo excedente para alavancar sua meta: ${userGoal}.`,
          },
        ],
        fullReport: cleanedText,
      };
      cleanedText = JSON.stringify(jsonPayload);
    }

    // Salva o insight consolidado se for global (bankSlug === null), mantendo persistência
    if (!bankSlug) {
      await supabase
        .from('ai_insights')
        .upsert(
          {
            user_id: userId,
            last_analysis_text: cleanedText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        last_analysis_text: cleanedText,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in generate-insight API:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
