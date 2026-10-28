import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave Groq API não configurada para transcrição.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('file') as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Nenhum arquivo de áudio recebido.' },
        { status: 400 }
      );
    }

    const groqFormData = new FormData();
    groqFormData.append('file', audioFile, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('language', 'pt');
    groqFormData.append('temperature', '0.0');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[Transcribe API Error]:', errText);
      return NextResponse.json(
        { error: 'Falha ao processar o áudio no servidor Whisper.' },
        { status: 502 }
      );
    }

    const result = await groqRes.json();
    return NextResponse.json({
      text: result.text || '',
    });
  } catch (error: any) {
    console.error('[Transcribe Route Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao transcrever áudio.' },
      { status: 500 }
    );
  }
}
