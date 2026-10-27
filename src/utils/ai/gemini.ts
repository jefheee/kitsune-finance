/**
 * Kitsune AI — Multi-Key Rotation & Multi-Model Gemini Engine
 * Implements random key selection with automatic anti-rate-limit failover
 * across the Gemini 4 / Gemini 3.8 / Gemini 3.5 model family.
 */

export interface GeminiModelInfo {
  id: string;
  name: string;
  badge: string;
  description: string;
  tier: 'flagship' | 'fast' | 'lite' | 'agent';
}

export const KITSUNE_GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Recomendado • Agentes',
    description: 'Nosso modelo Flash mais inteligente para fluxos autônomos e análise financeira.',
    tier: 'fast',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    badge: 'Flagship • Raciocínio 1M',
    description: 'Modelo flagship de raciocínio profundo com janela de contexto unificada de 1M tokens.',
    tier: 'flagship',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Estável • Multimodal',
    description: 'Equilíbrio ideal entre velocidade e capacidade analítica para tarefas do dia a dia.',
    tier: 'fast',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    badge: 'Ultra Rápido',
    description: 'Modelo de altíssima velocidade e baixa latência para respostas instantâneas.',
    tier: 'lite',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    badge: 'Eficiência',
    description: 'Performance de fronteira com custo reduzido e resposta imediata.',
    tier: 'lite',
  },
];

// Cooldown tracker in memory for keys that hit 429/quota errors (key -> timestamp until available)
const keyCooldowns = new Map<string, number>();

/**
 * Collects and deduplicates all configured Gemini API keys from environment variables,
 * returning them in randomized order with non-cooled-down keys prioritized first.
 */
export function getRotatedGeminiKeys(): string[] {
  const poolRaw = process.env.GEMINI_API_KEYS || '';
  const singleRaw = process.env.GEMINI_API_KEY || '';

  const allKeys = Array.from(
    new Set(
      [...poolRaw.split(','), singleRaw]
        .map((k) => k.trim().replace(/^["']|["']$/g, ''))
        .filter((k) => k.length > 10)
    )
  );

  // Fisher-Yates shuffle for random load balancing
  for (let i = allKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allKeys[i], allKeys[j]] = [allKeys[j], allKeys[i]];
  }

  const now = Date.now();
  const activeKeys: string[] = [];
  const cooledDownKeys: string[] = [];

  for (const key of allKeys) {
    const cooldownUntil = keyCooldowns.get(key) || 0;
    if (now >= cooldownUntil) {
      activeKeys.push(key);
    } else {
      cooledDownKeys.push(key);
    }
  }

  // Try active keys first, then cooled-down keys as last resort
  return [...activeKeys, ...cooledDownKeys];
}

export interface GenerateKitsuneResponseOptions {
  systemInstruction: string;
  prompt: string;
  history?: { role: 'user' | 'model'; content: string }[];
  preferredModel?: string;
  temperature?: number;
}

export interface GenerateKitsuneResponseResult {
  text: string;
  modelUsed: string;
  keyIndexUsed: number;
}

export async function generateWithGeminiPool(
  options: GenerateKitsuneResponseOptions
): Promise<GenerateKitsuneResponseResult> {
  const {
    systemInstruction,
    prompt,
    history = [],
    preferredModel = 'gemini-3.8-flash',
    temperature = 0.35,
  } = options;

  const keys = getRotatedGeminiKeys();

  // Ordered fallback chain of models to guarantee availability
  const modelChain = Array.from(
    new Set([
      preferredModel,
      'gemini-3.8-flash',
      'gemini-4-argon',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
    ])
  );

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  let lastError = '';

  // Iterate over rotated keys and model fallback chain
  for (let kIdx = 0; kIdx < keys.length; kIdx++) {
    const apiKey = keys[kIdx];

    for (const model of modelChain) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: 2048,
            },
          }),
          cache: 'no-store',
        });

        if (response.status === 429 || response.status === 403 || response.status === 401) {
          // Put this key on a 60s cooldown and immediately break to try the next key
          keyCooldowns.set(apiKey, Date.now() + 60_000);
          lastError = `Key #${kIdx + 1} rate-limited or unauthorized (${response.status})`;
          break;
        }

        if (response.status === 404 || response.status === 400) {
          const errBody = await response.text();
          // If key itself is invalid (API_KEY_INVALID), switch to next key immediately
          if (errBody.includes('API_KEY_INVALID') || errBody.includes('API key not valid')) {
            keyCooldowns.set(apiKey, Date.now() + 300_000);
            lastError = `Key #${kIdx + 1} invalid format`;
            break;
          }
          // Otherwise model endpoint might not be enabled on this key/tier; try next model in chain
          lastError = `Model ${model} unavailable (${response.status})`;
          continue;
        }

        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text || '')
          .join('\n')
          .trim();

        if (candidateText) {
          return {
            text: candidateText,
            modelUsed: model,
            keyIndexUsed: kIdx + 1,
          };
        }
      } catch (err: any) {
        lastError = err?.message || 'Network error calling Gemini API';
      }
    }
  }

  // Fallback to Groq if all Gemini keys/models are temporarily exhausted
  if (process.env.GROQ_API_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            ...history.map((h) => ({
              role: h.role === 'model' ? ('assistant' as const) : ('user' as const),
              content: h.content,
            })),
            { role: 'user', content: prompt },
          ],
          temperature,
        }),
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData?.choices?.[0]?.message?.content?.trim();
        if (text) {
          return {
            text,
            modelUsed: `${preferredModel} (Failover)`,
            keyIndexUsed: 0,
          };
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  throw new Error(`Não foi possível obter resposta do pool de IA (${lastError}).`);
}
