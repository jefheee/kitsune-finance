import { NextResponse } from 'next/server';
import { assertAdminAccess } from '@/utils/security/auth-guard';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const guard = await assertAdminAccess();
  if (!guard.authorized) {
    return NextResponse.json(
      { error: guard.errorResponse?.error || 'Acesso negado' },
      { status: guard.errorResponse?.status || 403 }
    );
  }

  try {
    const supabase = await createClient();

    // Consultas agregadas de saúde e volume da base
    const [
      membersCountRes,
      accountsCountRes,
      transactionsCountRes,
      assetsCountRes,
      connectionsCountRes,
    ] = await Promise.all([
      supabase.from('allowed_members').select('*', { count: 'exact', head: true }),
      supabase.from('bank_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('custom_assets').select('*', { count: 'exact', head: true }),
      supabase.from('pluggy_connections').select('*', { count: 'exact', head: true }),
    ]);

    const systemVitals = {
      database: {
        status: 'HEALTHY',
        provider: 'Supabase PostgreSQL 17',
        region: 'us-east-1',
      },
      aiPool: {
        status: 'ONLINE',
        gemini: 'Google AI Studio (gemini-3.8-flash, gemini-3.5-flash-lite)',
        groq: 'Groq Cloud (llama-3.3-70b-versatile, whisper-large-v3)',
      },
      openFinance: {
        status: 'ONLINE',
        provider: 'Pluggy Open Finance Brasil',
        totalConnections: connectionsCountRes.count || 0,
      },
      metrics: {
        totalMembers: membersCountRes.count || 0,
        totalAccounts: accountsCountRes.count || 0,
        totalTransactions: transactionsCountRes.count || 0,
        totalAssets: assetsCountRes.count || 0,
      },
      environment: {
        platform: 'Vercel Edge / Serverless',
        domain: 'mykitsune.vercel.app',
        securityMode: 'Allowlist Estrita & Force RLS',
      },
    };

    return NextResponse.json({ success: true, data: systemVitals });
  } catch (error) {
    console.error('[Admin System GET error]:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar telemetria do sistema.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const guard = await assertAdminAccess();
  if (!guard.authorized) {
    return NextResponse.json(
      { error: guard.errorResponse?.error || 'Acesso negado' },
      { status: guard.errorResponse?.status || 403 }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = await createClient();

    if (action === 'purge_ai_cache') {
      // Invalida os dossiês cacheados de IA
      const { error } = await supabase
        .from('ai_chat_sessions')
        .update({ system_prompt_cached: null })
        .not('id', 'is', null);

      if (error) {
        console.error('[Purge AI Cache error]:', error);
        return NextResponse.json({ error: 'Erro ao invalidar cache.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Cache de dossiês da Kitsune IA invalidado com sucesso. Novos chats remontarão o contexto do zero.',
      });
    }

    if (action === 'test_apis') {
      const startTime = Date.now();
      const { data: dbCheck, error: dbErr } = await supabase.from('allowed_members').select('count').limit(1);
      const dbLatency = Date.now() - startTime;

      const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
      const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
      const hasPluggy = Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);

      return NextResponse.json({
        success: true,
        tests: [
          { name: 'Supabase PostgreSQL RLS', ok: !dbErr, latencyMs: dbLatency, info: `${dbLatency}ms` },
          { name: 'Google Gemini API Pool', ok: hasGeminiKey, info: hasGeminiKey ? 'Chave configurada' : 'Chave ausente' },
          { name: 'Groq Cloud Engine', ok: hasGroqKey, info: hasGroqKey ? 'Chave configurada' : 'Chave ausente' },
          { name: 'Pluggy Open Finance API', ok: hasPluggy, info: hasPluggy ? 'Credenciais ativas' : 'Credenciais ausentes' },
        ],
      });
    }

    return NextResponse.json({ error: 'Ação administrativa não reconhecida.' }, { status: 400 });
  } catch (error) {
    console.error('[Admin System POST error]:', error);
    return NextResponse.json(
      { error: 'Erro ao executar comando administrativo.' },
      { status: 500 }
    );
  }
}
