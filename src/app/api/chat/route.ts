import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool, KITSUNE_AI_MODELS } from '@/utils/ai/gemini';
import { generateWithGroq } from '@/utils/ai/groq';

export async function GET() {
  return NextResponse.json({
    models: KITSUNE_AI_MODELS,
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
    const attachedContexts: string[] = Array.isArray(body?.attachedContexts) ? body.attachedContexts : [];
    const requestedModel = typeof body?.model === 'string' ? body.model : 'auto';
    const reasoningLevel =
      body?.reasoningLevel === 'fast' || body?.reasoningLevel === 'deep'
        ? body.reasoningLevel
        : 'standard';
    const scopeMemberId =
      typeof body?.familyMemberId === 'string' &&
      body.familyMemberId !== 'all' &&
      body.familyMemberId !== 'personal'
        ? body.familyMemberId
        : null;
    const rawHistory = Array.isArray(body?.history) ? body.history : [];

    // Se o usuário não digitou texto, mas anexou blocos de contexto, sintetiza o prompt do bloco
    let effectivePrompt = userMessage;
    if (!effectivePrompt && attachedContexts.length > 0) {
      if (attachedContexts.includes('raio-x-mes')) {
        effectivePrompt = 'Faça um Raio-X completo do meu mês atual: compare receitas e despesas, analise o saldo líquido e aponte desvios.';
      } else if (attachedContexts.includes('auditar-cartao')) {
        effectivePrompt = 'Audite minha exposição no cartão de crédito em relação ao saldo em conta corrente e dias para o fechamento.';
      } else if (attachedContexts.includes('cortar-gastos')) {
        effectivePrompt = 'Analise meus gastos e aponte onde posso cortar despesas supérfluas ou recorrentes sem comprometer meu padrão.';
      } else if (attachedContexts.includes('extrato-7-dias')) {
        effectivePrompt = 'Audite detalhadamente minhas transações dos últimos 7 dias e destaque pontos de atenção.';
      } else {
        effectivePrompt = 'Analise os dados financeiros anexados e forneça seu diagnóstico consultivo.';
      }
    }

    if (!effectivePrompt) {
      return NextResponse.json({ error: 'Mensagem ou bloco de contexto é obrigatório.' }, { status: 400 });
    }

    // Roteamento Inteligente: Modo Automático por complexidade e tamanho
    let preferredModel = requestedModel;
    let routerReason = '';

    if (requestedModel === 'auto') {
      const isComplexQuery =
        effectivePrompt.length > 280 ||
        /planejamento|aposentadoria|tribut|imposto|investimento|sac|price|amortiza|proje[çc]|futuro|fire/i.test(effectivePrompt) ||
        reasoningLevel === 'deep';

      const isMediumQuery =
        attachedContexts.length > 0 ||
        effectivePrompt.length > 70 ||
        /fatura|cart[aã]o|cortar|gastos|extrato|compara|saldo/i.test(effectivePrompt);

      if (isComplexQuery) {
        preferredModel = 'gemini-4-argon';
        routerReason = 'Pergunta estratégica complexa: roteado para Gemini 4 Argon';
      } else if (isMediumQuery) {
        preferredModel = 'gemini-3.8-flash';
        routerReason = 'Consulta financeira estruturada: roteado para Gemini 3.8 Flash';
      } else {
        preferredModel = 'gemini-3.5-flash-lite';
        routerReason = 'Pergunta direta: roteado para Gemini 3.5 Flash-Lite para resposta ultra-rápida';
      }
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

    const [{ data: accounts }, { data: transactions }, { data: familyMembers }, { data: profile }] =
      await Promise.all([
        accountsQuery,
        transactionsQuery,
        supabase
          .from('family_members')
          .select('id, name, role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('users_profile')
          .select('display_name, full_name, financial_goal, monthly_income')
          .eq('id', user.id)
          .maybeSingle(),
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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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

    // Otimização de Tokens: Formato compacto de alta densidade informativa
    const needs7Days =
      attachedContexts.includes('extrato-7-dias') ||
      /7 dias|semana|recente|auditoria/i.test(effectivePrompt);

    const txLimit = reasoningLevel === 'deep' ? 20 : 12;
    const compactTransactions = safeTransactions.slice(0, txLimit).map((tx) => {
      const dt = (tx.executed_at || tx.date || '').toString().split('T')[0];
      const bank = accountMap.get(tx.account_id) || 'Banco';
      const amount = Number(tx.amount) || 0;
      const sign = tx.type === 'CREDIT' || amount > 0 ? '+' : '-';
      const cat = tx.category || 'Geral';
      return `${dt} | ${bank} | ${tx.description} | ${sign}R$ ${Math.abs(amount).toFixed(2)} (${cat})`;
    });

    const compact7Days = needs7Days
      ? safeTransactions
          .filter((tx) => {
            const rawDate = tx.executed_at || tx.date;
            const d = rawDate ? new Date(rawDate) : new Date(0);
            return d >= sevenDaysAgo;
          })
          .map((tx) => {
            const dt = (tx.executed_at || tx.date || '').toString().split('T')[0];
            const amount = Number(tx.amount) || 0;
            const sign = tx.type === 'CREDIT' || amount > 0 ? '+' : '-';
            return `${dt} | ${tx.description} | ${sign}R$ ${Math.abs(amount).toFixed(2)} (${tx.category || 'Geral'})`;
          })
      : undefined;

    const userDisplayName =
      profile?.display_name ||
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email ||
      'Titular';

    const financialContext: Record<string, any> = {
      usuario: userDisplayName,
      objetivoFinanceiro: profile?.financial_goal || 'Gestão patrimonial e controle inteligente',
      rendaMensalDeclaradaBRL: profile?.monthly_income ? Number(profile.monthly_income) : undefined,
      escopoAnalise:
        body?.familyMemberId === 'all'
          ? 'Consolidado Familiar / Compartilhado'
          : scopeMemberId
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
        .slice(0, 8)
        .map(([categoria, total]) => ({ categoria, totalBRL: Number(total.toFixed(2)) })),
      ultimasTransacoesCompactas: compactTransactions,
    };

    if (compact7Days && compact7Days.length > 0) {
      financialContext.extratoUltimos7Dias = compact7Days;
    }

    const reasoningDirective =
      reasoningLevel === 'fast'
        ? 'Seja extremamente concisa, direta ao ponto e responda em poucos tópicos rápidos.'
        : reasoningLevel === 'deep'
        ? 'Realize uma análise profunda, estruturada com tabelas Markdown quando útil, cruzando liquidez, categorias e projeções.'
        : 'Responda de forma analítica, bem estruturada em Markdown (usando **negrito**, listas e tabelas quando apropriado).';

    let contextDirectives = '';
    if (attachedContexts.length > 0) {
      contextDirectives =
        '\nFOCO PRIORITÁRIO DOS BLOCOS DE CONTEXTO ANEXADOS PELO USUÁRIO:\n' +
        attachedContexts
          .map((id) => {
            if (id === 'raio-x-mes') {
              return '- [ANEXO ATIVO: RAIO-X DO MÊS] Priorize o fechamento do mês, saldo líquido livre vs faturas em aberto e desvios de orçamento.';
            }
            if (id === 'auditar-cartao') {
              return '- [ANEXO ATIVO: AUDITORIA DE CARTÃO] Compare a fatura aberta do cartão com o saldo líquido em conta e alerte sobre os dias até o fechamento.';
            }
            if (id === 'cortar-gastos') {
              return '- [ANEXO ATIVO: CORTE DE GASTOS] Identifique assinaturas, despesas invisíveis e categorias de maior volume para sugerir cortes indolores.';
            }
            if (id === 'extrato-7-dias') {
              return '- [ANEXO ATIVO: EXTRATO 7 DIAS] Audite minuciosamente as transações da última semana, apontando qualquer anomalia.';
            }
            return `- [ANEXO ATIVO: ${id}]`;
          })
          .join('\n');
    }

    const systemInstruction = `Você é a Kitsune AI, estrategista financeira pessoal de elite (Private Family Office & Wealth Advisor) integrada ao Kitsune Finance.
Diretrizes obrigatórias de comunicação e design:
1. Utilize EXCLUSIVAMENTE os dados financeiros reais do usuário logado fornecidos no JSON abaixo. Nunca invente transações ou saldos.
2. Responda sempre em português do Brasil com precisão numérica (formate valores em R$ X.XXX,XX).
3. ${reasoningDirective}
4. ESTRUTURAÇÃO VISUAL LIMPA:
   - Use títulos com tamanhos adequados (## para seções principais, ### para subseções) para criar hierarquia clara.
   - Use listas e **negrito** nos pontos-chave e números relevantes para leitura dinâmica.
   - Apresente comparativos em tabelas Markdown estruturadas sempre que envolver mais de 2 números ou itens.
   - EVITE poluição visual e NÃO use múltiplos traços ou divisores seguidos. Deixe o espaçamento entre tópicos e títulos estruturar o texto com elegância.
${contextDirectives}

CONTEXTO FINANCEIRO ATUALIZADO DO USUÁRIO:
${JSON.stringify(financialContext, null, 2)}`;

    const sanitizedHistory = rawHistory
      .slice(-8)
      .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? ('model' as const) : ('user' as const),
        content: m.content,
      }));

    const temperature = reasoningLevel === 'fast' ? 0.2 : reasoningLevel === 'deep' ? 0.4 : 0.35;

    // Roteamento explícito: modelos Llama -> Groq API; modelos Gemini -> Gemini Pool (com failover automático)
    if (preferredModel.startsWith('llama-')) {
      const groqRes = await generateWithGroq({
        systemInstruction,
        prompt: effectivePrompt,
        history: sanitizedHistory,
        preferredModel,
        temperature,
      });

      return NextResponse.json({
        message: groqRes.text,
        modelUsed: groqRes.modelUsed,
        routerReason: routerReason || undefined,
        provider: 'groq',
        summarySnapshot: financialContext.resumoPatrimonial,
      });
    }

    const aiResponse = await generateWithGeminiPool({
      systemInstruction,
      prompt: effectivePrompt,
      history: sanitizedHistory,
      preferredModel,
      reasoningLevel,
      temperature,
    });

    return NextResponse.json({
      message: aiResponse.text,
      modelUsed: aiResponse.modelUsed,
      routerReason: routerReason || undefined,
      keyPoolIndex: aiResponse.keyIndexUsed,
      provider: aiResponse.modelUsed.startsWith('llama-') ? 'groq' : 'gemini',
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
