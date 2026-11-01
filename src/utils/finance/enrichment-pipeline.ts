/**
 * Kitsune Finance — Pipeline de Enriquecimento Comercial em 3 Camadas ($0.00/mês)
 *
 * Camada 1 (0ms - Local): `merchant-resolver.ts` (Simple Icons + Dicionário Heurístico Brasileiro + Regex de Adquirentes).
 * Camada 2 (Cache Supabase + BrasilAPI): Extração de CNPJ com validação oficial de dígitos verificadores (Módulo 11 RFB),
 *          consulta em lote em `public.known_merchants` e fallback em `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
 *          (máx. 5 chamadas concorrentes, `AbortSignal.timeout(3000)`), mapeando `cnae_fiscal` -> categoria Kitsune.
 * Camada 3 (Opcional - Batch LLM Text-Only): Classificação textual em lote para descrições inéditas sem CNPJ (zero matemática).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMerchant, stripBankingNoise } from './merchant-resolver';
import { generateWithGeminiPool } from '@/utils/ai/gemini';

export interface KnownMerchantCacheRow {
    cnpj: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cnae_fiscal: number | null;
    cnae_descricao: string | null;
    mapped_category_pt: string;
    clean_brand_name: string;
    simple_icon_slug: string | null;
    created_at?: string;
    updated_at?: string;
}

interface BrasilApiCnpjResponse {
    cnpj?: string;
    razao_social?: string | null;
    nome_fantasia?: string | null;
    cnae_fiscal?: number | string | null;
    cnae_fiscal_descricao?: string | null;
}

export interface EnrichableTransactionItem {
    id?: string;
    pluggyTransactionId?: string | null;
    pluggy_transaction_id?: string | null;
    description?: string | null;
    rawDescription?: string | null;
    raw_description?: string | null;
    cleanDescription?: string | null;
    clean_description?: string | null;
    category?: string | null;
    categoryPt?: string | null;
    category_pt?: string | null;
    merchantCnpj?: string | null;
    merchant_cnpj?: string | null;
    merchantName?: string | null;
    merchant_name?: string | null;
    merchantBusinessName?: string | null;
    merchant_business_name?: string | null;
    receiverName?: string | null;
    receiver_name?: string | null;
    paymentReason?: string | null;
    payment_reason?: string | null;
    isInternalTransfer?: boolean;
    is_internal_transfer?: boolean;
    isRefund?: boolean;
    is_refund?: boolean;
    amount?: number;
}

export type EnrichedTransactionBatchItem<T extends EnrichableTransactionItem = EnrichableTransactionItem> = T & {
    merchant_cnpj: string | null;
    clean_description: string;
    category_pt: string;
    simple_icon_slug: string | null;
    enrichment_layer: 1 | 2 | 3;
};

export interface EnrichmentBatchOptions {
    /** Máximo de chamadas simultâneas à BrasilAPI (default: 5, teto estrito: 5) */
    maxConcurrency?: number;
    /** Limite de novos CNPJs consultados externamente por execução de sync (default: 25) */
    maxExternalLookups?: number;
    /** Timeout em ms por requisição à BrasilAPI (default: 3000) */
    timeoutMs?: number;
    /** Habilita Camada 3 em lote para descrições inéditas sem CNPJ (default: false no hot-path de sync) */
    enableAiFallback?: boolean;
}

const CNPJ_WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/**
 * Valida matematicamente os 2 dígitos verificadores oficiais do CNPJ (Módulo 11 da Receita Federal),
 * impedindo falsos positivos com códigos de autorização, NSU, linhas digitáveis ou chaves aleatórias.
 */
export function isValidCnpj(candidate: string | null | undefined): boolean {
    if (!candidate) return false;
    const digits = candidate.replace(/\D/g, '');
    if (digits.length !== 14) return false;

    // Rejeita sequências repetidas inválidas (00000000000000 .. 99999999999999)
    if (/^(\d)\1{13}$/.test(digits)) return false;

    let sum1 = 0;
    for (let i = 0; i < 12; i++) {
        sum1 += Number(digits[i]) * CNPJ_WEIGHTS_FIRST[i];
    }
    const rem1 = sum1 % 11;
    const check1 = rem1 < 2 ? 0 : 11 - rem1;
    if (Number(digits[12]) !== check1) return false;

    let sum2 = 0;
    for (let i = 0; i < 13; i++) {
        sum2 += Number(digits[i]) * CNPJ_WEIGHTS_SECOND[i];
    }
    const rem2 = sum2 % 11;
    const check2 = rem2 < 2 ? 0 : 11 - rem2;
    if (Number(digits[13]) !== check2) return false;

    return true;
}

/**
 * 1. Extrator de CNPJ e Limpeza de Adquirentes (`extractCnpjFromText`)
 *
 * Detecta padrões formatados (`XX.XXX.XXX/XXXX-XX`), semi-formatados ou 14 dígitos contínuos
 * em descrições de Pix, TED, Boleto e Cartão, validando os 2 dígitos verificadores oficiais.
 */
export function extractCnpjFromText(text: string | null | undefined): string | null {
    if (!text) return null;

    // Remove caracteres invisíveis / zero-width emitidos por alguns gateways de pagamento
    const sanitized = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // 1º: Padrão formatado ou semi-formatado (XX.XXX.XXX/XXXX-XX)
    const formattedRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/?\d{4}-\d{2}\b/g;
    const formattedMatches = sanitized.match(formattedRegex);
    if (formattedMatches) {
        for (const match of formattedMatches) {
            const clean = match.replace(/\D/g, '');
            if (isValidCnpj(clean)) {
                return clean;
            }
        }
    }

    // 2º: Sequências contínuas exatas de 14 dígitos isoladas de dígitos adjacentes (não captura blocos de 44 dígitos de boleto)
    const continuousRegex = /(?<!\d)\d{14}(?!\d)/g;
    const continuousMatches = sanitized.match(continuousRegex);
    if (continuousMatches) {
        for (const match of continuousMatches) {
            if (isValidCnpj(match)) {
                return match;
            }
        }
    }

    return null;
}

/**
 * Mapeamento determinístico de prefixos CNAE da Receita Federal (divisões 45 a 96)
 * para as categorias oficiais em português do Kitsune Finance.
 */
const CNAE_PREFIX_RULES: ReadonlyArray<{ prefixes: readonly string[]; categoryPt: string }> = [
    // Regras prioritárias explícitas de 4 e 3 dígitos
    {
        prefixes: ['5611', '5612', '5620'],
        categoryPt: 'Alimentação & Restaurantes',
    },
    {
        prefixes: ['4711', '4712', '4721', '4722', '4723', '4724', '4729'],
        categoryPt: 'Supermercado',
    },
    {
        prefixes: ['4731', '4732'],
        categoryPt: 'Transporte & Combustível',
    },
    {
        prefixes: ['4771', '4772', '4773', '4774', '8610', '8621', '8622', '8630', '8640', '8650', '8660', '8690'],
        categoryPt: 'Saúde & Farmácia',
    },
    {
        prefixes: ['851', '852', '853', '854', '855', '859', '4761'],
        categoryPt: 'Educação',
    },
    {
        prefixes: ['4751', '4752', '620', '631', '639'],
        categoryPt: 'Tecnologia & Assinaturas',
    },
    {
        prefixes: ['4741', '4742', '4743', '4744', '4753', '4754', '4755'],
        categoryPt: 'Casa & Construção',
    },
    {
        prefixes: ['931', '932', '900', '910', '920', '591'],
        categoryPt: 'Lazer & Entretenimento',
    },
    // Cobertura complementar das divisões 45 a 96 da Receita Federal
    {
        prefixes: ['451', '452', '453', '454', '491', '492', '493', '50', '51', '522', '771'],
        categoryPt: 'Transporte & Combustível',
    },
    {
        prefixes: ['551', '559', '791', '799'],
        categoryPt: 'Lazer & Entretenimento',
    },
    {
        prefixes: ['56'],
        categoryPt: 'Alimentação & Restaurantes',
    },
    {
        prefixes: ['61'],
        categoryPt: 'Tecnologia & Assinaturas',
    },
    {
        prefixes: ['64', '65', '66'],
        categoryPt: 'Serviços Financeiros & Seguros',
    },
    {
        prefixes: ['68'],
        categoryPt: 'Moradia & Condomínio',
    },
    {
        prefixes: ['750'],
        categoryPt: 'Saúde & Farmácia',
    },
    {
        prefixes: ['87', '88'],
        categoryPt: 'Saúde & Farmácia',
    },
    {
        prefixes: ['4713', '475', '476', '477', '478', '479'],
        categoryPt: 'Compras & Varejo',
    },
    {
        prefixes: ['95', '96'],
        categoryPt: 'Serviços & Cuidados Pessoais',
    },
];

/**
 * 2. Mapeador Determinístico CNAE -> Categoria Kitsune (`mapCnaeToCategoryPt`)
 */
export function mapCnaeToCategoryPt(cnae: number | string | null | undefined): string {
    if (cnae === null || cnae === undefined) return 'Outros';
    const digits = String(cnae).replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) return 'Outros';

    for (const rule of CNAE_PREFIX_RULES) {
        for (const prefix of rule.prefixes) {
            if (digits.startsWith(prefix)) {
                return rule.categoryPt;
            }
        }
    }

    return 'Outros';
}

function formatCleanCorporateBrandName(rawName: string): string {
    const lowerConnectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na']);

    // Remove prefixo numérico de MEI da Receita Federal (ex: "51.234.567 JOAO SILVA" ou "51234567 JOAO SILVA")
    let cleaned = rawName
        .trim()
        .replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, '')
        .replace(/^\d{8,14}\s+/, '');

    // Remove sufixos societários repetitivos mantendo o nome comercial limpo
    cleaned = cleaned
        .replace(/\s*[-–/]\s*(ME|MEI|EPP|EIRELI|LTDA\.?|S\.?A\.?|S\/A|SOCIEDADE\s+SIMPLES|UNIPESSOAL)$/i, '')
        .replace(/\b(COMERCIO\s+VAREJISTA\s+DE|ATIVIDADES\s+DE)\b/gi, '')
        .replace(/\b(LTDA\.?|EIRELI|S\/A|S\.A\.|EPP|MEI)\b$/i, '')
        .replace(/\s+\bME\b$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!cleaned) cleaned = rawName.trim();

    return cleaned
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, idx) => {
            if (idx > 0 && lowerConnectors.has(word)) return word;
            if (word === 'br' || word === 'sp' || word === 'rj' || word === 'pr' || word === 'mg') {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

/**
 * Executa tarefas assíncronas com limite estrito de concorrência (Worker Pool).
 */
async function runWithConcurrencyLimit<TItem, TResult>(
    items: TItem[],
    concurrency: number,
    worker: (item: TItem) => Promise<TResult>
): Promise<TResult[]> {
    const safeConcurrency = Math.max(1, Math.min(5, Math.floor(concurrency)));
    const results: TResult[] = new Array(items.length);
    let nextIndex = 0;

    async function runner(): Promise<void> {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            results[currentIndex] = await worker(items[currentIndex]);
        }
    }

    const workersCount = Math.min(safeConcurrency, items.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workersCount; i++) {
        workers.push(runner());
    }
    await Promise.all(workers);
    return results;
}

const recentMerchantMemoryCache = new Map<string, KnownMerchantCacheRow>();
const inFlightBrasilApiRequests = new Map<string, Promise<KnownMerchantCacheRow | null>>();

async function fetchMerchantFromBrasilApi(
    cnpj: string,
    timeoutMs: number
): Promise<KnownMerchantCacheRow | null> {
    const cachedMem = recentMerchantMemoryCache.get(cnpj);
    if (cachedMem) return cachedMem;

    const existingPromise = inFlightBrasilApiRequests.get(cnpj);
    if (existingPromise) return existingPromise;

    const requestPromise = (async (): Promise<KnownMerchantCacheRow | null> => {
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
                cache: 'force-cache',
                signal: AbortSignal.timeout(timeoutMs),
            });

            if (!response.ok) {
                return null;
            }

            const data = (await response.json()) as BrasilApiCnpjResponse;
            const razaoSocial = data.razao_social?.trim() || null;
            const nomeFantasia = data.nome_fantasia?.trim() || null;
            const rawChosenName = nomeFantasia || razaoSocial;

            if (!rawChosenName) {
                return null;
            }

            const cnaeRaw = data.cnae_fiscal != null ? Number(String(data.cnae_fiscal).replace(/\D/g, '')) : null;
            const cnaeFiscal = cnaeRaw && Number.isFinite(cnaeRaw) ? cnaeRaw : null;
            const cnaeDescricao = data.cnae_fiscal_descricao?.trim() || null;

            const cleanCorporate = formatCleanCorporateBrandName(rawChosenName);
            const brandResolved = resolveMerchant(cleanCorporate);

            const cnaeCategory = mapCnaeToCategoryPt(cnaeFiscal);
            const mappedCategoryPt =
                cnaeCategory !== 'Outros'
                    ? cnaeCategory
                    : brandResolved.category && brandResolved.category !== 'Outros'
                      ? brandResolved.category
                      : 'Outros';

            const cleanBrandName =
                brandResolved.simpleIconSlug || brandResolved.brandColor
                    ? brandResolved.cleanName
                    : cleanCorporate;

            const resolvedRow: KnownMerchantCacheRow = {
                cnpj,
                razao_social: razaoSocial,
                nome_fantasia: nomeFantasia,
                cnae_fiscal: cnaeFiscal,
                cnae_descricao: cnaeDescricao,
                mapped_category_pt: mappedCategoryPt,
                clean_brand_name: cleanBrandName,
                simple_icon_slug: brandResolved.simpleIconSlug,
            };

            if (recentMerchantMemoryCache.size > 500) {
                recentMerchantMemoryCache.clear();
            }
            recentMerchantMemoryCache.set(cnpj, resolvedRow);
            return resolvedRow;
        } catch {
            // Timeout (3000ms), erro de rede ou rate-limit: cai silenciosamente para a Camada 1
            return null;
        } finally {
            inFlightBrasilApiRequests.delete(cnpj);
        }
    })();

    inFlightBrasilApiRequests.set(cnpj, requestPromise);
    return requestPromise;
}

const GENERIC_CATEGORIES = new Set([
    '',
    'outros',
    'other',
    'others',
    'compras',
    'pix',
    'transferências',
    'transferência para terceiros',
    'boleto bancário',
]);

function isGenericCategory(cat: string | null | undefined): boolean {
    if (!cat) return true;
    return GENERIC_CATEGORIES.has(cat.toLowerCase().trim());
}

const KITSUNE_ALLOWED_AI_CATEGORIES = [
    'Alimentação & Restaurantes',
    'Supermercado',
    'Transporte & Combustível',
    'Saúde & Farmácia',
    'Educação',
    'Tecnologia & Assinaturas',
    'Casa & Construção',
    'Lazer & Entretenimento',
    'Compras & Varejo',
    'Moradia & Condomínio',
    'Serviços & Cuidados Pessoais',
    'Outros',
] as const;

async function classifyMysteryMerchantsWithAiBatch(
    queries: string[]
): Promise<Map<string, { cleanName: string; categoryPt: string }>> {
    const resultMap = new Map<string, { cleanName: string; categoryPt: string }>();
    if (!queries.length) return resultMap;

    const hasAiKeys = Boolean(
        process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
    );
    if (!hasAiKeys) return resultMap;

    try {
        const uniqueSlice = Array.from(new Set(queries)).slice(0, 15);
        const prompt = JSON.stringify(uniqueSlice);
        const systemInstruction = [
            'Você é um decodificador comercial de faturas bancárias brasileiras.',
            'Receba um array JSON de descrições brutas de maquininhas/extratos e retorne APENAS um objeto JSON puro (sem markdown) mapeando cada string original para {"cleanName": string, "categoryPt": string}.',
            `Categorias permitidas em categoryPt: ${KITSUNE_ALLOWED_AI_CATEGORIES.join(', ')}.`,
            'PROIBIDO realizar qualquer cálculo numérico.',
        ].join(' ');

        const aiRes = await generateWithGeminiPool({
            systemInstruction,
            prompt,
            preferredModel: 'gemini-3.5-flash-lite',
            temperature: 0.1,
        });

        const cleanJsonText = aiRes.text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        const parsed = JSON.parse(cleanJsonText) as Record<
            string,
            { cleanName?: string; categoryPt?: string }
        >;

        for (const [rawKey, entry] of Object.entries(parsed)) {
            if (entry?.cleanName && entry?.categoryPt) {
                resultMap.set(rawKey, {
                    cleanName: entry.cleanName.trim(),
                    categoryPt: entry.categoryPt.trim(),
                });
            }
        }
    } catch {
        // Silencioso: mantém resultado determinístico da Camada 1
    }

    return resultMap;
}

/**
 * 3. Orquestrador `enrichTransactionBatch` (3 Camadas a Custo Zero)
 */
export async function enrichTransactionBatch<T extends EnrichableTransactionItem>(
    transactions: T[],
    supabaseClient?: SupabaseClient | null,
    options: EnrichmentBatchOptions = {}
): Promise<Array<EnrichedTransactionBatchItem<T>>> {
    if (!transactions.length) return [];

    const maxConcurrency = Math.min(5, Math.max(1, options.maxConcurrency ?? 5));
    const maxExternalLookups = Math.max(1, options.maxExternalLookups ?? 25);
    const timeoutMs = Math.max(500, options.timeoutMs ?? 3000);
    const enableAiFallback = Boolean(options.enableAiFallback);

    interface IntermediateItem {
        tx: T;
        rawText: string;
        existingClean: string;
        existingCategory: string;
        detectedCnpj: string | null;
        isInternalOrRefund: boolean;
        layer1HighConfidence: boolean;
        layer1CleanName: string;
        layer1Category: string;
        layer1Slug: string | null;
    }

    // ========================================================================
    // CAMADA 1: Resolução Local Instantânea (0ms - Simple Icons + Heurísticas BR)
    // ========================================================================
    const intermediates: IntermediateItem[] = transactions.map((tx) => {
        const rawText = String(
            tx.rawDescription ?? tx.raw_description ?? tx.description ?? tx.cleanDescription ?? tx.clean_description ?? ''
        ).trim();

        const existingClean = String(
            tx.cleanDescription ?? tx.clean_description ?? tx.description ?? rawText
        ).trim();

        const existingCategory = String(
            tx.categoryPt ?? tx.category_pt ?? tx.category ?? 'Outros'
        ).trim();

        const isInternalOrRefund = Boolean(
            tx.isInternalTransfer ?? tx.is_internal_transfer ?? tx.isRefund ?? tx.is_refund
        );

        // Extração determinística de CNPJ (campo explícito ou texto da transação)
        const rawExplicitCnpj = tx.merchantCnpj ?? tx.merchant_cnpj ?? null;
        const explicitValidCnpj =
            rawExplicitCnpj && isValidCnpj(rawExplicitCnpj)
                ? rawExplicitCnpj.replace(/\D/g, '')
                : null;

        const textCorpusForCnpj = [
            rawText,
            tx.description,
            tx.merchantBusinessName,
            tx.merchant_business_name,
            tx.paymentReason,
            tx.payment_reason,
        ]
            .filter(Boolean)
            .join(' ');

        const detectedCnpj = !isInternalOrRefund
            ? explicitValidCnpj || extractCnpjFromText(textCorpusForCnpj)
            : explicitValidCnpj;

        const resolved = resolveMerchant(rawText || existingClean, existingCategory);
        const layer1HighConfidence = Boolean(
            resolved.simpleIconSlug || resolved.brandColor || resolved.isDecodedStore
        );

        const layer1CleanName = layer1HighConfidence
            ? resolved.cleanName
            : existingClean || resolved.cleanName || 'Transação';

        const layer1Category =
            layer1HighConfidence && resolved.category && resolved.category !== 'Outros'
                ? resolved.category
                : existingCategory || resolved.category || 'Outros';

        return {
            tx,
            rawText,
            existingClean,
            existingCategory,
            detectedCnpj,
            isInternalOrRefund,
            layer1HighConfidence,
            layer1CleanName,
            layer1Category,
            layer1Slug: resolved.simpleIconSlug,
        };
    });

    // ========================================================================
    // CAMADA 2: Cache Global `known_merchants` (Supabase) + BrasilAPI CNPJ/CNAE
    // ========================================================================
    const cnpjsNeedingLookup = Array.from(
        new Set(
            intermediates
                .filter((item) => !item.isInternalOrRefund && !item.layer1HighConfidence && item.detectedCnpj)
                .map((item) => item.detectedCnpj as string)
        )
    );

    const merchantByCnpj = new Map<string, KnownMerchantCacheRow>();

    if (cnpjsNeedingLookup.length > 0 && supabaseClient) {
        try {
            const { data: cachedRows, error: cacheReadError } = await supabaseClient
                .from('known_merchants')
                .select('*')
                .in('cnpj', cnpjsNeedingLookup);

            if (!cacheReadError && Array.isArray(cachedRows)) {
                for (const row of cachedRows) {
                    if (row?.cnpj) {
                        merchantByCnpj.set(String(row.cnpj), row as KnownMerchantCacheRow);
                    }
                }
            }
        } catch {
            // Tabela ainda não migrada ou sessão sem permissão: segue silenciosamente para BrasilAPI/Camada 1
        }
    }

    const missingCnpjs = cnpjsNeedingLookup
        .filter((cnpj) => !merchantByCnpj.has(cnpj))
        .slice(0, maxExternalLookups);

    if (missingCnpjs.length > 0) {
        const fetchedMerchants = await runWithConcurrencyLimit(
            missingCnpjs,
            maxConcurrency,
            (cnpj) => fetchMerchantFromBrasilApi(cnpj, timeoutMs)
        );

        const newlyResolvedRows: KnownMerchantCacheRow[] = [];
        for (const row of fetchedMerchants) {
            if (row) {
                merchantByCnpj.set(row.cnpj, row);
                newlyResolvedRows.push(row);
            }
        }

        if (newlyResolvedRows.length > 0 && supabaseClient) {
            try {
                await supabaseClient.from('known_merchants').upsert(
                    newlyResolvedRows.map((r) => ({
                        cnpj: r.cnpj,
                        razao_social: r.razao_social,
                        nome_fantasia: r.nome_fantasia,
                        cnae_fiscal: r.cnae_fiscal,
                        cnae_descricao: r.cnae_descricao,
                        mapped_category_pt: r.mapped_category_pt,
                        clean_brand_name: r.clean_brand_name,
                        simple_icon_slug: r.simple_icon_slug,
                        updated_at: new Date().toISOString(),
                    })),
                    { onConflict: 'cnpj' }
                );
            } catch {
                // Falha de escrita no cache nunca interrompe o sync
            }
        }
    }

    // ========================================================================
    // CAMADA 3 (Opcional): Batch Fallback p/ Descrições Inéditas sem CNPJ
    // ========================================================================
    let aiResolvedMap = new Map<string, { cleanName: string; categoryPt: string }>();
    if (enableAiFallback) {
        const mysteryQueries = intermediates
            .filter(
                (item) =>
                    !item.isInternalOrRefund &&
                    !item.layer1HighConfidence &&
                    !item.detectedCnpj &&
                    isGenericCategory(item.layer1Category) &&
                    item.rawText.length >= 4
            )
            .map((item) => stripBankingNoise(item.rawText).cleanQuery)
            .filter((q) => q.length >= 4);

        if (mysteryQueries.length > 0) {
            aiResolvedMap = await classifyMysteryMerchantsWithAiBatch(mysteryQueries);
        }
    }

    // ========================================================================
    // Consolidação Final Preservando Campos CamelCase e SnakeCase
    // ========================================================================
    return intermediates.map((item) => {
        const { tx, detectedCnpj, isInternalOrRefund } = item;

        let finalCleanName = item.layer1CleanName;
        let finalCategory = item.layer1Category;
        let finalSlug = item.layer1Slug;
        let finalBusinessName =
            tx.merchantBusinessName ?? tx.merchant_business_name ?? null;
        let finalMerchantName = tx.merchantName ?? tx.merchant_name ?? null;
        let enrichmentLayer: 1 | 2 | 3 = 1;

        if (!isInternalOrRefund && !item.layer1HighConfidence && detectedCnpj) {
            const cachedMerchant = merchantByCnpj.get(detectedCnpj);
            if (cachedMerchant) {
                enrichmentLayer = 2;
                const isPixPrefix = /^pix\s+(para|de)\s+/i.test(item.existingClean);
                finalCleanName = isPixPrefix
                    ? `Pix • ${cachedMerchant.clean_brand_name}`
                    : cachedMerchant.clean_brand_name;

                if (
                    cachedMerchant.mapped_category_pt &&
                    cachedMerchant.mapped_category_pt !== 'Outros'
                ) {
                    finalCategory = cachedMerchant.mapped_category_pt;
                } else if (isGenericCategory(finalCategory)) {
                    finalCategory = cachedMerchant.mapped_category_pt || finalCategory;
                }

                finalSlug = cachedMerchant.simple_icon_slug ?? finalSlug;
                finalBusinessName = cachedMerchant.razao_social ?? finalBusinessName;
                finalMerchantName = cachedMerchant.clean_brand_name ?? finalMerchantName;
            }
        } else if (!isInternalOrRefund && !item.layer1HighConfidence && enableAiFallback) {
            const strippedKey = stripBankingNoise(item.rawText).cleanQuery;
            const aiMatch = aiResolvedMap.get(strippedKey);
            if (aiMatch) {
                enrichmentLayer = 3;
                finalCleanName = aiMatch.cleanName;
                finalCategory = aiMatch.categoryPt;
            }
        }

        const updated: EnrichedTransactionBatchItem<T> = {
            ...tx,
            merchant_cnpj: detectedCnpj,
            clean_description: finalCleanName,
            category_pt: finalCategory,
            simple_icon_slug: finalSlug,
            enrichment_layer: enrichmentLayer,
        };

        // Mantém sincronia com propriedades camelCase caso o objeto de origem seja `EnrichedTransaction`
        if ('cleanDescription' in tx) {
            updated.cleanDescription = finalCleanName;
        }
        if ('categoryPt' in tx) {
            updated.categoryPt = finalCategory;
        }
        if ('merchantCnpj' in tx) {
            updated.merchantCnpj = detectedCnpj;
        }
        if ('merchantName' in tx && finalMerchantName) {
            updated.merchantName = finalMerchantName;
        }
        if ('merchant_name' in tx && finalMerchantName) {
            updated.merchant_name = finalMerchantName;
        }
        if ('merchantBusinessName' in tx && finalBusinessName) {
            updated.merchantBusinessName = finalBusinessName;
        }
        if ('merchant_business_name' in tx && finalBusinessName) {
            updated.merchant_business_name = finalBusinessName;
        }

        return updated;
    });
}
