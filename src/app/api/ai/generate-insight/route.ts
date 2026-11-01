import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool } from '@/utils/ai/gemini';
import { getBankCatalogBySlugOrName } from '@/utils/pluggy/bank-resolver';
import {
    ANTI_HALLUCINATION_SYSTEM_DIRECTIVE,
    runAllDeterministicMacroTools,
    formatAuditedMathEngineBlock,
    type UserFinancialDataInput,
} from '@/utils/ai/deterministic-tools';

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

        const [profileRes, accountsRes, investmentsRes, loansRes, familyRes] = await Promise.all([
            supabase
                .from('users_profile')
                .select('financial_goal, display_name, full_name, monthly_income')
                .eq('id', userId)
                .maybeSingle(),
            familyMemberId
                ? supabase
                      .from('bank_accounts')
                      .select('*')
                      .eq('user_id', userId)
                      .eq('family_member_id', familyMemberId)
                : supabase.from('bank_accounts').select('*').eq('user_id', userId),
            supabase.from('investments').select('*').eq('user_id', userId),
            supabase.from('loans').select('*').eq('user_id', userId),
            supabase.from('family_members').select('id, name, role').eq('user_id', userId),
        ]);

        const userProfile = profileRes.data;
        const userGoal =
            userProfile?.financial_goal || 'Equilíbrio Financeiro e Reserva de Liquidez';

        let bankAccounts = accountsRes.data || [];
        if (bankSlug) {
            bankAccounts = bankAccounts.filter((acc) => {
                const slug = getBankCatalogBySlugOrName(
                    acc.institution_slug || acc.institution_name || acc.bank_name
                ).slug;
                return slug === bankSlug;
            });
        }

        const targetAccountIds = new Set(bankAccounts.map((a) => a.id));

        let rawInvestments = investmentsRes.data || [];
        let maxRefDateMs = 0;
        rawInvestments.forEach((inv) => {
            const rawD = inv.date || inv.executed_at || inv.created_at;
            if (rawD) {
                const t = new Date(rawD).getTime();
                if (t > maxRefDateMs) maxRefDateMs = t;
            }
        });

        let investments = rawInvestments.filter((inv) => {
            if (inv.status === 'TOTAL_WITHDRAWAL' || (Number(inv.balance) || 0) <= 0.05) return false;
            if (maxRefDateMs > 0 && inv.date) {
                const invMs = new Date(inv.date).getTime();
                if (maxRefDateMs - invMs > 60 * 24 * 60 * 60 * 1000) return false;
            }
            return true;
        });

        if (bankSlug) {
            investments = investments.filter((inv) => {
                const slug = getBankCatalogBySlugOrName(inv.institution_name).slug;
                return slug === bankSlug;
            });
        }

        let loans = loansRes.data || [];
        if (bankSlug) {
            loans = loans.filter((ln) => {
                const slug = getBankCatalogBySlugOrName(ln.institution_name).slug;
                return slug === bankSlug;
            });
        }

        let txQuery = supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(400);

        if (familyMemberId) {
            txQuery = txQuery.eq('family_member_id', familyMemberId);
        }

        const { data: rawTransactions } = await txQuery;
        let transactions = rawTransactions || [];
        if (bankSlug && targetAccountIds.size > 0) {
            transactions = transactions.filter((t) => targetAccountIds.has(t.account_id));
        }

        const userData: UserFinancialDataInput = {
            accounts: bankAccounts,
            investments,
            loans,
            transactions,
            profile: userProfile,
            familyMembers: familyRes.data || [],
        };

        // Execução Determinística das Macro-Tools (Sentinela Kitsune 360°)
        const bundle = runAllDeterministicMacroTools(userData);
        const auditedEngineBlock = formatAuditedMathEngineBlock(bundle);

        const xray = bundle.balanceSheetAndXRay;
        const stmt = bundle.incomeStatement;
        const incomeProfile = stmt.incomeProfile;

        const liquidBalance = xray.balanceSheet.liquidAssets;
        const creditDebt = xray.balanceSheet.creditCardLiabilities;
        const totalInvested = xray.balanceSheet.investedAssets;
        const totalBalance = xray.balanceSheet.netWorth;
        const monthlyIncome = stmt.operationalIncome;
        const monthlyExpense = stmt.netOperationalExpenses;
        const netMargin = stmt.netSavings;

        const formatBRL = (val: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

        // Kitsune Score oficial (0..100)
        const kitsuneScore100 = xray.kitsuneScore;
        const calculatedScore = kitsuneScore100;
        const scoreLabel =
            xray.statusLabel === 'EXCELENTE'
                ? 'Excelente'
                : xray.statusLabel === 'SAUDÁVEL'
                  ? 'Saudável'
                  : 'Atenção';

        const topCategory = stmt.topCategories[0];
        const deterministicCards = [
            {
                title: 'Cobertura de Liquidez',
                value: formatBRL(liquidBalance),
                badge: liquidBalance >= creditDebt ? 'Faturas Cobertas' : 'Atenção à Liquidez',
                status: liquidBalance >= creditDebt ? 'positive' : 'warning',
                desc: `Reserva cobre ${xray.emergencyFundMonths} meses de custo operacional.`,
            },
            {
                title: 'Principal Saída',
                value: formatBRL(topCategory?.totalAmount ?? 0),
                badge: topCategory?.name || 'Despesas Gerais',
                status: 'neutral',
                desc: 'Maior linha de desembolso operacional no mês.',
            },
            {
                title: 'Margem Operacional',
                value: formatBRL(netMargin),
                badge: netMargin >= 0 ? 'Superávit' : 'Déficit',
                status: netMargin >= 0 ? 'positive' : 'danger',
                desc: 'Diferença líquida real entre entradas e saídas.',
            },
        ];

        const bankContextLabel = bankSlug
            ? `Filtrado para o banco: ${getBankCatalogBySlugOrName(bankSlug).name}`
            : 'Consolidado Geral de Todos os Bancos';

        const topCategoriesStr = stmt.topCategories
            .slice(0, 5)
            .map((c) => `${c.name}: R$ ${c.totalAmount.toFixed(2)}`)
            .join(', ');

        const topMerchantsStr = stmt.topMerchants
            .slice(0, 4)
            .map((m) => `${m.name} (R$ ${m.totalAmount.toFixed(2)})`)
            .join(', ');

        const systemInstruction = `Você é Sentinela Kitsune, orquestradora de diagnóstico 360° da Kitsune Finance.
Sua missão é responder EXCLUSIVAMENTE em formato JSON VÁLIDO (sem blocos markdown ou texto extra).

REGRA INVIOLÁVEL DE BLINDAGEM MATEMÁTICA (MSLR):
${ANTI_HALLUCINATION_SYSTEM_DIRECTIVE}

${auditedEngineBlock}

Formato estrito esperado:
{
  "headline": "Frase de efeito executiva (máx 10 palavras)",
  "summary": "Resumo executivo de exatamente 2 frases citando os valores exatos do [ENGINE_MATEMATICO_AUDITADO].",
  "score": ${calculatedScore},
  "kitsuneScore": ${kitsuneScore100},
  "scoreLabel": "${scoreLabel}",
  "actionPoints": [
    {
      "icon": "shield",
      "title": "Ação Estratégica 1",
      "desc": "Ação prática direcionada à meta: ${userGoal}."
    },
    {
      "icon": "trending_up",
      "title": "Ação Estratégica 2",
      "desc": "Meta de caixa coerente com o perfil: ${incomeProfile.typeLabel}."
    }
  ],
  "fullReport": "Parecer consultivo detalhado de 3 parágrafos sem asteriscos, citando Kitsune Score (${kitsuneScore100}/100), reserva (${xray.emergencyFundMonths} meses), exposição FGC (R$ ${xray.totalUncoveredFGC.toFixed(2)}) e custo de oportunidade (R$ ${xray.annualOpportunityCostBRL.toFixed(2)}/ano)."
}`;

        const prompt = `Sintetize o parecer executivo para o escopo (${bankContextLabel}):
- Objetivo Patrimonial: "${userGoal}"
- Kitsune Health Score: ${kitsuneScore100}/100 (${xray.statusLabel})
- Perfil de Renda: ${incomeProfile.typeLabel} (Média: R$ ${incomeProfile.monthlyAverageIncome.toFixed(2)})
- Patrimônio Líquido Exato: R$ ${totalBalance.toFixed(2)}
- Liquidez em Conta: R$ ${liquidBalance.toFixed(2)} | Investimentos: R$ ${totalInvested.toFixed(2)} | Faturas: R$ ${creditDebt.toFixed(2)}
- Receitas Operacionais do Mês: R$ ${monthlyIncome.toFixed(2)} | Despesas Operacionais Líquidas: R$ ${monthlyExpense.toFixed(2)} | Margem: R$ ${netMargin.toFixed(2)}
- Principais Categorias: ${topCategoriesStr || 'Sem gastos no mês'}
- Maiores Estabelecimentos: ${topMerchantsStr || 'Nenhuma saída'}

Retorne apenas o JSON válido sem recalcular nenhum número.`;

        const aiResult = await generateWithGeminiPool({
            systemInstruction,
            prompt,
            preferredModel,
            temperature: 0.2,
        });

        let cleanedText = aiResult.text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let jsonPayload: Record<string, unknown>;
        try {
            const parsed = JSON.parse(cleanedText);
            // Sobrescreve deterministicamente todos os campos numéricos e cards (Blindagem MSLR total)
            jsonPayload = {
                ...parsed,
                score: calculatedScore,
                kitsuneScore: kitsuneScore100,
                scoreLabel,
                cards: deterministicCards,
            };
        } catch {
            jsonPayload = {
                headline: 'Diagnóstico Consolidado do Seu Patrimônio',
                summary: `Kitsune Score de ${kitsuneScore100}/100 (${xray.statusLabel}), com receitas operacionais de R$ ${monthlyIncome.toFixed(2)}, saídas líquidas de R$ ${monthlyExpense.toFixed(2)} e liquidez de R$ ${liquidBalance.toFixed(2)}.`,
                score: calculatedScore,
                kitsuneScore: kitsuneScore100,
                scoreLabel,
                cards: deterministicCards,
                actionPoints: [
                    {
                        icon: 'savings',
                        title: 'Diretriz Patrimonial',
                        desc: `Direcione o saldo excedente para alavancar sua meta: ${userGoal}.`,
                    },
                ],
                fullReport: cleanedText,
            };
        }

        const finalSerialized = JSON.stringify(jsonPayload);

        if (!bankSlug) {
            await supabase.from('ai_insights').upsert(
                {
                    user_id: userId,
                    last_analysis_text: finalSerialized,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                last_analysis_text: finalSerialized,
                updated_at: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Error in generate-insight API:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
