import { generateWithGroq } from './groq';

export interface GeminiModelInfo {
  id: string;
  shortTitle: string;
  name: string;
  subtitle: string;
  provider: 'gemini' | 'groq';
  tier: 'flagship' | 'fast' | 'lite' | 'groq';
}

export const KITSUNE_AI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    shortTitle: '✨ Smart (Principal)',
    name: 'Kitsune Smart (Gemini 3.8 Flash)',
    subtitle: 'Equilíbrio ideal: rápido, multimodal e ágil para auditorias e planejamento',
    provider: 'gemini',
    tier: 'fast',
  },
  {
    id: 'gemini-3.5-flash-lite',
    shortTitle: 'Flash Lite (Rápido)',
    name: 'Kitsune Flash (Gemini 3.5 Flash-Lite)',
    subtitle: 'Ultra-rápido para dúvidas diretas e consultas imediatas',
    provider: 'gemini',
    tier: 'lite',
  },
  {
    id: 'gemini-3.1-pro-preview',
    shortTitle: 'Pro Ultra (Mais Potente)',
    name: 'Kitsune Pro Ultra (Gemini 3.1 Pro)',
    subtitle: 'Máximo poder de raciocínio, projeções complexas e geração de documentos para download',
    provider: 'gemini',
    tier: 'flagship',
  },
];

// Compatibilidade com imports existentes
export const KITSUNE_GEMINI_MODELS = KITSUNE_AI_MODELS;

// Cooldown por par (key + model) para não bloquear a chave inteira quando apenas um modelo específico tiver limite
const keyModelCooldowns = new Map<string, number>();
const invalidKeys = new Set<string>();

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Valida e retorna as chaves do Google AI Studio em rotação.
 * Prioriza chaves Standard (AIzaSy...) de baixa latência e inclui Auth Keys (AQ.Ab8RN6...) válidas,
 * descartando qualquer string malformada.
 */
export function getRotatedGeminiKeys(): string[] {
  const poolRaw = process.env.GEMINI_API_KEYS || '';
  const singleRaw = process.env.GEMINI_API_KEY || '';

  const rawCandidates = Array.from(
    new Set(
      [...poolRaw.split(','), singleRaw]
        .map((k) => k.trim().replace(/^["']|["']$/g, ''))
        .filter((k) => k.length > 20 && !invalidKeys.has(k))
    )
  );

  // Valida prefixo oficial do Google AI Studio (AIzaSy para Standard Keys ou AQ. para Auth Keys)
  const standardKeys = shuffleArray(
    rawCandidates.filter((k) => k.startsWith('AIzaSy'))
  );
  const authKeys = shuffleArray(
    rawCandidates.filter((k) => k.startsWith('AQ.'))
  );

  return [...standardKeys, ...authKeys];
}

export interface GenerateKitsuneResponseOptions {
  systemInstruction: string;
  prompt: string;
  history?: { role: 'user' | 'model'; content: string }[];
  preferredModel?: string;
  reasoningLevel?: 'fast' | 'standard' | 'deep';
  temperature?: number;
  images?: Array<{ mimeType: string; data: string }>;
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
    preferredModel = 'gemini-3.5-flash-lite',
    temperature = 0.35,
    images = [],
  } = options;

  // Se o modelo selecionado for da Groq (Llama) e houver imagens, redireciona para Gemini multimodal
  if (preferredModel.startsWith('llama-') && images.length === 0) {
    const groqRes = await generateWithGroq({
      systemInstruction,
      prompt,
      history,
      preferredModel,
      temperature,
    });
    return {
      text: groqRes.text,
      modelUsed: groqRes.modelUsed,
      keyIndexUsed: 0,
    };
  }

  const keys = getRotatedGeminiKeys();

  // Se contiver imagens, prioriza modelos com excelência multimodal comprovada
  const preferred = images.length > 0 && preferredModel.startsWith('llama-') 
    ? 'gemini-3.8-flash' 
    : preferredModel;

  const modelChain = Array.from(
    new Set([
      preferred,
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
    ])
  );

  const userParts: any[] = [];
  if (images && images.length > 0) {
    images.forEach((img) => {
      userParts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data,
        },
      });
    });
  }
  userParts.push({ text: prompt });

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: userParts,
    },
  ];

  let lastError = '';
  const now = Date.now();

  for (const model of modelChain) {
    for (let kIdx = 0; kIdx < keys.length; kIdx++) {
      const apiKey = keys[kIdx];
      const cooldownKey = `${apiKey}:${model}`;
      const cooldownUntil = keyModelCooldowns.get(cooldownKey) || 0;

      if (now < cooldownUntil) {
        continue;
      }

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
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
          signal: AbortSignal.timeout(8500),
        });

        if (response.status === 429) {
          const errText = await response.text();
          // Se o modelo tem limit: 0 no plano gratuito, coloca esse modelo em cooldown de 2 min nesta chave e tenta a próxima chave/modelo
          keyModelCooldowns.set(cooldownKey, Date.now() + 120_000);
          lastError = `${model} quota exceeded (429)`;
          // Se a mensagem indicar quota zero do modelo (e não rate limit momentâneo da chave), pula direto para o próximo modelo estável
          if (errText.includes('check your plan and billing details')) {
            break;
          }
          continue;
        }

        if (response.status === 503 || response.status === 500) {
          lastError = `${model} high demand (${response.status})`;
          // Se o modelo está com pico de demanda (503), passa imediatamente para o próximo modelo da cadeia
          break;
        }

        if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
          const errText = await response.text();
          if (errText.includes('API_KEY_INVALID') || errText.includes('API key not valid')) {
            invalidKeys.add(apiKey);
            lastError = `Key #${kIdx + 1} invalid`;
            continue;
          }
          // Modelo indisponível para a conta (ex: 404 em gemini-2.5-flash para contas novas)
          keyModelCooldowns.set(cooldownKey, Date.now() + 300_000);
          lastError = `${model} unavailable (${response.status})`;
          break;
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
        lastError = err?.message || 'Timeout/network error calling Gemini API';
        // Em caso de timeout no modelo atual, tenta o próximo modelo mais rápido
        break;
      }
    }
  }

  // Fallback final para Groq caso todas as chaves/modelos Gemini estejam ocupados
  const groqFallback = await generateWithGroq({
    systemInstruction,
    prompt,
    history,
    preferredModel: 'llama-3.3-70b-versatile',
    temperature,
  });

  return {
    text: groqFallback.text,
    modelUsed: groqFallback.modelUsed,
    keyIndexUsed: 0,
  };
}
