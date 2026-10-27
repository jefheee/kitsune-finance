/**
 * Kitsune AI — Groq LPU Inference Service
 * Supports ultra-fast Llama 3.3 70B & Llama 3.1 8B models via Groq API.
 */

export interface GroqGenerateOptions {
  systemInstruction: string;
  prompt: string;
  history?: { role: 'user' | 'model'; content: string }[];
  preferredModel?: 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | string;
  temperature?: number;
}

export interface GroqGenerateResult {
  text: string;
  modelUsed: string;
}

export async function generateWithGroq(
  options: GroqGenerateOptions
): Promise<GroqGenerateResult> {
  const {
    systemInstruction,
    prompt,
    history = [],
    preferredModel = 'llama-3.3-70b-versatile',
    temperature = 0.35,
  } = options;

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY não configurada no ambiente.');
  }

  const targetModel = preferredModel.startsWith('llama-')
    ? preferredModel
    : 'llama-3.3-70b-versatile';

  const modelChain = Array.from(
    new Set([targetModel, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])
  );

  const messages = [
    { role: 'system' as const, content: systemInstruction },
    ...history.map((msg) => ({
      role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: msg.content,
    })),
    { role: 'user' as const, content: prompt },
  ];

  let lastError = '';

  for (const model of modelChain) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 2048,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = `Groq ${model} (${response.status}): ${errText.slice(0, 120)}`;
        continue;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content?.trim();

      if (text) {
        return {
          text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      lastError = err?.message || 'Erro de rede na chamada Groq';
    }
  }

  throw new Error(`Falha ao gerar resposta via Groq (${lastError})`);
}
