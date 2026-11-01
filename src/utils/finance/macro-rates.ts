/**
 * Kitsune Finance — Taxas Macroeconômicas do Banco Central Ao Vivo ($0.00/mês)
 *
 * Fonte oficial upstream verificada em `BrasilAPI/BrasilAPI` (`pages/api/taxas/v1/index.js`):
 * Endpoint: `GET https://brasilapi.com.br/api/taxas/v1`
 * Formato de retorno: `[{ nome: 'Selic', valor: number }, { nome: 'CDI', valor: number }, { nome: 'IPCA', valor: number }]`
 *
 * Estratégia de Cache Híbrido (12 horas):
 * 1. Memória em processo (Node.js / Edge / Browser) -> resposta em 0ms.
 * 2. Persistência em `localStorage` no navegador (`kitsune_bcb_macro_rates_v1`) -> sobrevive a reloads e modo offline.
 * 3. Fallback determinístico para as últimas taxas conhecidas caso o endpoint esteja indisponível.
 */

import { truncateDecimal } from '@/utils/finance/engine/cdi';
import { calculateRealInterestRate } from '@/utils/finance/engine/fisher';
import type { XRayMacroRates } from '@/utils/finance/engine/xray-rules';

export interface BrasilApiTaxaItem {
    nome?: string;
    valor?: number | string | null;
}

export interface LiveMacroRatesSnapshot extends XRayMacroRates {
    /** Juro real exato (Equação de Fisher sobre CDI vs IPCA em % a.a.) */
    realInterestAnnualPct: number;
    /** Rendimento mensal composto equivalente a 100% do CDI (fator decimal, ex: 0.0110) */
    monthlyCDICompoundFactor: number;
    /** Timestamp ISO da última sincronização bem-sucedida */
    fetchedAt: string;
    /** Origem do dado retornado */
    source: 'brasilapi_live' | 'cache' | 'fallback';
}

const MACRO_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const LOCAL_STORAGE_MACRO_KEY = 'kitsune_bcb_macro_rates_v1';

const LAST_KNOWN_FALLBACK_RATES: XRayMacroRates = {
    annualSelicPct: 14.25,
    annualCDIPct: 14.15,
    annualIPCAPct: 4.83,
};

interface StoredMacroCachePayload {
    annualSelicPct: number;
    annualCDIPct: number;
    annualIPCAPct: number;
    fetchedAtMs: number;
    fetchedAtIso: string;
}

let memoryCachedPayload: StoredMacroCachePayload | null = null;
let inFlightMacroPromise: Promise<LiveMacroRatesSnapshot> | null = null;

function buildSnapshotFromRates(
    rates: XRayMacroRates,
    fetchedAtIso: string,
    source: LiveMacroRatesSnapshot['source']
): LiveMacroRatesSnapshot {
    const annualSelicPct = truncateDecimal(rates.annualSelicPct, 2);
    const annualCDIPct = truncateDecimal(rates.annualCDIPct, 2);
    const annualIPCAPct = truncateDecimal(rates.annualIPCAPct, 2);
    const realInterestAnnualPct = calculateRealInterestRate(annualCDIPct, annualIPCAPct);
    const monthlyCDICompoundFactor = Math.pow(1 + annualCDIPct / 100, 1 / 12) - 1;

    return {
        annualSelicPct,
        annualCDIPct,
        annualIPCAPct,
        realInterestAnnualPct,
        monthlyCDICompoundFactor,
        fetchedAt: fetchedAtIso,
        source,
    };
}

function readBrowserStoredMacroPayload(): StoredMacroCachePayload | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_MACRO_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredMacroCachePayload>;
        if (
            typeof parsed.annualSelicPct === 'number' &&
            parsed.annualSelicPct > 0 &&
            typeof parsed.annualCDIPct === 'number' &&
            parsed.annualCDIPct > 0 &&
            typeof parsed.annualIPCAPct === 'number' &&
            parsed.annualIPCAPct >= 0 &&
            typeof parsed.fetchedAtMs === 'number'
        ) {
            return {
                annualSelicPct: parsed.annualSelicPct,
                annualCDIPct: parsed.annualCDIPct,
                annualIPCAPct: parsed.annualIPCAPct,
                fetchedAtMs: parsed.fetchedAtMs,
                fetchedAtIso: parsed.fetchedAtIso || new Date(parsed.fetchedAtMs).toISOString(),
            };
        }
        return null;
    } catch {
        return null;
    }
}

function writeBrowserStoredMacroPayload(payload: StoredMacroCachePayload): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(LOCAL_STORAGE_MACRO_KEY, JSON.stringify(payload));
    } catch {
        // Ignora silenciosamente caso quota excedida ou modo anônimo restrito
    }
}

/**
 * Faz o parse resiliente da resposta oficial de `GET https://brasilapi.com.br/api/taxas/v1`.
 */
export function parseBrasilApiTaxasResponse(items: unknown): XRayMacroRates | null {
    if (!Array.isArray(items) || items.length === 0) return null;

    let selic: number | null = null;
    let cdi: number | null = null;
    let ipca: number | null = null;

    for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const item = rawItem as BrasilApiTaxaItem;
        const nameUpper = String(item.nome || '')
            .trim()
            .toUpperCase();
        const val = Number(String(item.valor ?? '').replace(',', '.'));
        if (!Number.isFinite(val) || val < 0) continue;

        if (nameUpper === 'SELIC' || nameUpper.includes('SELIC')) {
            selic = val;
        } else if (nameUpper === 'CDI' || nameUpper.includes('CDI')) {
            cdi = val;
        } else if (nameUpper === 'IPCA' || nameUpper.includes('IPCA')) {
            ipca = val;
        }
    }

    if (selic === null && cdi === null) {
        return null;
    }

    const resolvedSelic = selic !== null && selic > 0 ? selic : (cdi as number) + 0.1;
    const resolvedCdi = cdi !== null && cdi > 0 ? cdi : Math.max(0.1, resolvedSelic - 0.1);
    const resolvedIpca = ipca !== null && ipca >= 0 ? ipca : LAST_KNOWN_FALLBACK_RATES.annualIPCAPct;

    return {
        annualSelicPct: truncateDecimal(resolvedSelic, 2),
        annualCDIPct: truncateDecimal(resolvedCdi, 2),
        annualIPCAPct: truncateDecimal(resolvedIpca, 2),
    };
}

/**
 * Leitura síncrona em 0ms (ideal para render inicial de componentes React sem layout shift).
 */
export function getCachedOrFallbackMacroRates(): LiveMacroRatesSnapshot {
    if (memoryCachedPayload) {
        return buildSnapshotFromRates(
            memoryCachedPayload,
            memoryCachedPayload.fetchedAtIso,
            'cache'
        );
    }

    const stored = readBrowserStoredMacroPayload();
    if (stored) {
        memoryCachedPayload = stored;
        return buildSnapshotFromRates(stored, stored.fetchedAtIso, 'cache');
    }

    return buildSnapshotFromRates(
        LAST_KNOWN_FALLBACK_RATES,
        new Date(0).toISOString(),
        'fallback'
    );
}

/**
 * Busca as taxas oficiais vigentes do Banco Central (Selic, CDI, IPCA) via BrasilAPI (`/api/taxas/v1`),
 * respeitando cache de 12 horas em memória/localStorage e fallback seguro para a última leitura válida.
 */
export async function fetchLiveMacroRates(forceRefresh = false): Promise<LiveMacroRatesSnapshot> {
    const nowMs = Date.now();

    if (!forceRefresh) {
        if (memoryCachedPayload && nowMs - memoryCachedPayload.fetchedAtMs < MACRO_CACHE_TTL_MS) {
            return buildSnapshotFromRates(
                memoryCachedPayload,
                memoryCachedPayload.fetchedAtIso,
                'cache'
            );
        }

        const stored = readBrowserStoredMacroPayload();
        if (stored) {
            memoryCachedPayload = stored;
            if (nowMs - stored.fetchedAtMs < MACRO_CACHE_TTL_MS) {
                return buildSnapshotFromRates(stored, stored.fetchedAtIso, 'cache');
            }
        }
    }

    if (inFlightMacroPromise) {
        return inFlightMacroPromise;
    }

    inFlightMacroPromise = (async (): Promise<LiveMacroRatesSnapshot> => {
        try {
            const response = await fetch('https://brasilapi.com.br/api/taxas/v1', {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(4000),
            });

            if (response.ok) {
                const json = await response.json();
                const parsed = parseBrasilApiTaxasResponse(json);
                if (parsed) {
                    const fetchedAtIso = new Date().toISOString();
                    const payload: StoredMacroCachePayload = {
                        ...parsed,
                        fetchedAtMs: Date.now(),
                        fetchedAtIso,
                    };
                    memoryCachedPayload = payload;
                    writeBrowserStoredMacroPayload(payload);
                    return buildSnapshotFromRates(parsed, fetchedAtIso, 'brasilapi_live');
                }
            }
        } catch {
            // Rede offline ou timeout -> usa última leitura em cache ou fallback seguro
        } finally {
            inFlightMacroPromise = null;
        }

        const stale = memoryCachedPayload || readBrowserStoredMacroPayload();
        if (stale) {
            return buildSnapshotFromRates(stale, stale.fetchedAtIso, 'cache');
        }

        return buildSnapshotFromRates(
            LAST_KNOWN_FALLBACK_RATES,
            new Date().toISOString(),
            'fallback'
        );
    })();

    return inFlightMacroPromise;
}

/**
 * Formata percentual no padrão brasileiro (ex: `14.25` -> `"14,25%"`).
 */
export function formatPercentPtBr(value: number, decimals = 2): string {
    if (!Number.isFinite(value)) return '0,00%';
    return `${value.toFixed(decimals).replace('.', ',')}%`;
}
