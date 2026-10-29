import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool, KITSUNE_AI_MODELS } from '@/utils/ai/gemini';
import { generateWithGroq } from '@/utils/ai/groq';
import { buildUserFinancialDossier } from '@/utils/ai/dossier';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({
                models: KITSUNE_AI_MODELS,
                sessions: [],
            });
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');

        if (sessionId && UUID_REGEX.test(sessionId)) {
            const [{ data: session }, { data: messages }] = await Promise.all([
                supabase
                    .from('ai_chat_sessions')
                    .select('id, title, context_snapshot, created_at, updated_at')
                    .eq('id', sessionId)
                    .eq('user_id', user.id)
                    .maybeSingle(),
                supabase
                    .from('ai_chat_messages')
                    .select('id, role, content, model_used, created_at')
                    .eq('session_id', sessionId)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: true }),
            ]);

            return NextResponse.json({
                models: KITSUNE_AI_MODELS,
                session: session || null,
                messages: messages || [],
            });
        }

        const { data: sessions } = await supabase
            .from('ai_chat_sessions')
            .select('id, title, created_at, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(30);

        return NextResponse.json({
            models: KITSUNE_AI_MODELS,
            sessions: sessions || [],
        });
    } catch {
        return NextResponse.json({
            models: KITSUNE_AI_MODELS,
            sessions: [],
        });
    }
}

export async function DELETE(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');

        if (sessionId && UUID_REGEX.test(sessionId)) {
            await supabase
                .from('ai_chat_sessions')
                .delete()
                .eq('id', sessionId)
                .eq('user_id', user.id);
        } else {
            await supabase
                .from('ai_chat_sessions')
                .delete()
                .eq('user_id', user.id);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Erro ao remover sessão' }, { status: 500 });
    }
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
        const requestedSessionId =
            typeof body?.sessionId === 'string' && UUID_REGEX.test(body.sessionId)
                ? body.sessionId
                : null;
        const rawHistory = Array.isArray(body?.history) ? body.history : [];

        // Se o usuário não digitou texto, mas anexou blocos de contexto, sintetiza o prompt do bloco
        let effectivePrompt = userMessage;
        if (!effectivePrompt && attachedContexts.length > 0) {
            if (attachedContexts.includes('raio-x-mes')) {
                effectivePrompt =
                    'Faça um Raio-X completo do meu mês atual: compare receitas e despesas reais (excluindo transferências próprias), analise o saldo líquido e aponte desvios.';
            } else if (attachedContexts.includes('auditar-cartao')) {
                effectivePrompt =
                    'Audite minha exposição nos cartões de crédito em relação ao saldo em conta corrente, parcelamentos ativos e vencimentos.';
            } else if (attachedContexts.includes('cortar-gastos')) {
                effectivePrompt =
                    'Analise meus gastos reais e assinaturas recorrentes e aponte onde posso cortar despesas sem comprometer meu padrão.';
            } else if (attachedContexts.includes('extrato-7-dias')) {
                effectivePrompt =
                    'Audite detalhadamente minhas transações recentes e destaque pontos de atenção.';
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
                /planejamento|aposentadoria|tribut|imposto|investimento|sac|price|amortiza|proje[çc]|futuro|fire/i.test(
                    effectivePrompt
                ) ||
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

        // 1. Localizar ou Criar Sessão em ai_chat_sessions (Isolamento Estrito por user.id)
        let sessionRecord: {
            id: string;
            title: string;
            system_prompt_cached: string | null;
            context_snapshot: any;
        } | null = null;

        if (requestedSessionId) {
            const { data: existingSession } = await supabase
                .from('ai_chat_sessions')
                .select('id, title, system_prompt_cached, context_snapshot')
                .eq('id', requestedSessionId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (existingSession) {
                sessionRecord = existingSession;
            }
        }

        // 2. Injeção de Contexto Única na Abertura da Sessão (ou quando invalidado por sync.ts)
        let cachedSystemPrompt = sessionRecord?.system_prompt_cached || null;
        let contextSnapshot = sessionRecord?.context_snapshot || null;

        if (!cachedSystemPrompt) {
            const dossier = await buildUserFinancialDossier(supabase, user.id, user.email);
            cachedSystemPrompt = dossier.systemPrompt;
            contextSnapshot = dossier.contextSnapshot;

            const sessionTitle = effectivePrompt.slice(0, 60) + (effectivePrompt.length > 60 ? '...' : '');

            if (sessionRecord) {
                await supabase
                    .from('ai_chat_sessions')
                    .update({
                        system_prompt_cached: cachedSystemPrompt,
                        context_snapshot: contextSnapshot,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', sessionRecord.id)
                    .eq('user_id', user.id);
            } else {
                const { data: createdSession } = await supabase
                    .from('ai_chat_sessions')
                    .insert({
                        user_id: user.id,
                        title: sessionTitle,
                        system_prompt_cached: cachedSystemPrompt,
                        context_snapshot: contextSnapshot,
                    })
                    .select('id, title, system_prompt_cached, context_snapshot')
                    .single();

                if (createdSession) {
                    sessionRecord = createdSession;
                }
            }
        } else if (sessionRecord) {
            await supabase
                .from('ai_chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionRecord.id)
                .eq('user_id', user.id);
        }

        const activeSessionId = sessionRecord?.id || null;

        // 3. Carregar Histórico da Thread do Banco (sem repetir o dossiê a cada mensagem)
        let sanitizedHistory: Array<{ role: 'user' | 'model'; content: string }> = [];

        if (activeSessionId) {
            const { data: dbMessages } = await supabase
                .from('ai_chat_messages')
                .select('role, content')
                .eq('session_id', activeSessionId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })
                .limit(16);

            if (dbMessages && dbMessages.length > 0) {
                sanitizedHistory = dbMessages
                    .filter((m) => m.content && m.content.trim().length > 0)
                    .map((m) => ({
                        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
                        content: m.content,
                    }));
            }
        }

        if (sanitizedHistory.length === 0 && rawHistory.length > 0) {
            sanitizedHistory = rawHistory
                .slice(-10)
                .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0)
                .map((m: any) => ({
                    role: m.role === 'assistant' || m.role === 'model' ? ('model' as const) : ('user' as const),
                    content: m.content,
                }));
        }

        // Persistir a mensagem do usuário na sessão
        if (activeSessionId) {
            await supabase.from('ai_chat_messages').insert({
                session_id: activeSessionId,
                user_id: user.id,
                role: 'user',
                content: effectivePrompt,
            });
        }

        const reasoningDirective =
            reasoningLevel === 'fast'
                ? 'Seja extremamente concisa, direta ao ponto e responda em poucos tópicos rápidos.'
                : reasoningLevel === 'deep'
                  ? 'Realize uma análise profunda, estruturada com tabelas Markdown quando útil, cruzando liquidez, faturas, investimentos e projeções.'
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
                            return '- [ANEXO ATIVO: AUDITORIA DE CARTÃO] Compare a fatura aberta do cartão com o saldo líquido em conta, parcelamentos e vencimentos.';
                        }
                        if (id === 'cortar-gastos') {
                            return '- [ANEXO ATIVO: CORTE DE GASTOS] Identifique assinaturas reais, despesas invisíveis e categorias de maior volume para sugerir cortes indolores.';
                        }
                        if (id === 'extrato-7-dias') {
                            return '- [ANEXO ATIVO: EXTRATO 7 DIAS] Audite minuciosamente as transações recentes, apontando qualquer anomalia.';
                        }
                        return `- [ANEXO ATIVO: ${id}]`;
                    })
                    .join('\n');
        }

        const systemInstruction = `${cachedSystemPrompt}\n\nDIRETIVA DE ESTILO DESTA RESPOSTA:\n- ${reasoningDirective}${contextDirectives}`;
        const temperature = reasoningLevel === 'fast' ? 0.2 : reasoningLevel === 'deep' ? 0.4 : 0.35;

        if (preferredModel.startsWith('llama-')) {
            const groqRes = await generateWithGroq({
                systemInstruction,
                prompt: effectivePrompt,
                history: sanitizedHistory,
                preferredModel,
                temperature,
            });

            if (activeSessionId) {
                await supabase.from('ai_chat_messages').insert({
                    session_id: activeSessionId,
                    user_id: user.id,
                    role: 'assistant',
                    content: groqRes.text,
                    model_used: groqRes.modelUsed,
                });
            }

            return NextResponse.json({
                message: groqRes.text,
                modelUsed: groqRes.modelUsed,
                routerReason: routerReason || undefined,
                provider: 'groq',
                sessionId: activeSessionId,
                summarySnapshot: contextSnapshot?.summary || null,
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

        if (activeSessionId) {
            await supabase.from('ai_chat_messages').insert({
                session_id: activeSessionId,
                user_id: user.id,
                role: 'assistant',
                content: aiResponse.text,
                model_used: aiResponse.modelUsed,
            });
        }

        return NextResponse.json({
            message: aiResponse.text,
            modelUsed: aiResponse.modelUsed,
            routerReason: routerReason || undefined,
            keyPoolIndex: aiResponse.keyIndexUsed,
            provider: aiResponse.modelUsed.startsWith('llama-') ? 'groq' : 'gemini',
            sessionId: activeSessionId,
            summarySnapshot: contextSnapshot?.summary || null,
        });
    } catch (error: any) {
        console.error('[Chat API Error]:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao processar sua consulta na Kitsune AI.' },
            { status: 500 }
        );
    }
}
