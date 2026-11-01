/**
 * Kitsune Finance — Read-Through Client Cache em IndexedDB Nativo (0ms Stale-While-Revalidate)
 *
 * Arquitetura inspirada no Actual Budget e Pierre Finance:
 * - Zero dependências externas ($0.00/mês, 0 KB de bundle extra).
 * - Isolamento multi-tenant estrito por banco de dados: `kitsune_${userId}_db`.
 * - Dupla camada (L1 Map em memória para trocas de rota em 0ms + L2 IndexedDB persistente).
 * - Limpeza completa (`deleteDatabase`) no logout ou troca de conta para blindagem de privacidade.
 */

import type { FamilyMemberItem, UserProfileData } from '@/context/FinanceDataContext';

const CACHE_SCHEMA_VERSION = 1;
const STORE_NAME = 'portfolio_snapshots';
const PRIMARY_RECORD_KEY = 'active_portfolio_dossier';
const DB_PREFIX = 'kitsune_';
const DB_SUFFIX = '_db';
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias de validade máxima offline/SWR

export interface CachedPartnerSummary {
    id: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
}

export interface CachedPortfolioPayload {
    userProfile: UserProfileData | null;
    accounts: any[];
    investments: any[];
    loans: any[];
    transactions: any[];
    connections: any[];
    familyMembers: FamilyMemberItem[];
    aiInsight: { text: string; updatedAt: string } | null;
    activePartner: CachedPartnerSummary | null;
    sharedConnection: any | null;
}

export interface CachedPortfolioSnapshot extends CachedPortfolioPayload {
    key: string;
    userId: string;
    schemaVersion: number;
    cachedAt: number;
}

// Camada L1 em memória para hidratação síncrona (0ms) ao alternar rotas
const memoryCacheByUser = new Map<string, CachedPortfolioSnapshot>();
// Registro local de DBs abertos nesta aba para garantir deleção mesmo em navegadores sem `indexedDB.databases()`
const knownUserDbNames = new Set<string>();

function isIndexedDbSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

export function getUserDbName(userId: string): string {
    const safeId = String(userId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return `${DB_PREFIX}${safeId}${DB_SUFFIX}`;
}

function openUserDatabase(userId: string): Promise<IDBDatabase | null> {
    if (!isIndexedDbSupported() || !userId) {
        return Promise.resolve(null);
    }

    const dbName = getUserDbName(userId);
    knownUserDbNames.add(dbName);

    return new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(dbName, CACHE_SCHEMA_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => {
                    db.close();
                };
                resolve(db);
            };

            request.onerror = () => {
                resolve(null);
            };

            request.onblocked = () => {
                resolve(null);
            };
        } catch {
            resolve(null);
        }
    });
}

/**
 * Leitura síncrona em 0ms a partir do espelho L1 em memória (ideal para montagem instantânea de telas).
 */
export function readUserPortfolioCacheSync(userId: string): CachedPortfolioSnapshot | null {
    if (!userId) return null;
    const hit = memoryCacheByUser.get(userId);
    if (!hit) return null;
    if (hit.schemaVersion !== CACHE_SCHEMA_VERSION) {
        memoryCacheByUser.delete(userId);
        return null;
    }
    if (Date.now() - hit.cachedAt > MAX_CACHE_AGE_MS) {
        memoryCacheByUser.delete(userId);
        return null;
    }
    return hit;
}

/**
 * Lê o snapshot enriquecido de contas, extrato e dossiê patrimonial do usuário autenticado.
 * Retorna imediatamente do L1 se disponível, ou hidrata a partir do IndexedDB nativo (`kitsune_${userId}_db`).
 */
export async function readUserPortfolioCache(
    userId: string
): Promise<CachedPortfolioSnapshot | null> {
    if (!userId) return null;

    const syncHit = readUserPortfolioCacheSync(userId);
    if (syncHit) return syncHit;

    const db = await openUserDatabase(userId);
    if (!db) return null;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(PRIMARY_RECORD_KEY);

            getReq.onsuccess = () => {
                const record = getReq.result as CachedPortfolioSnapshot | undefined;
                db.close();

                if (
                    !record ||
                    record.userId !== userId ||
                    record.schemaVersion !== CACHE_SCHEMA_VERSION ||
                    Date.now() - record.cachedAt > MAX_CACHE_AGE_MS
                ) {
                    resolve(null);
                    return;
                }

                memoryCacheByUser.set(userId, record);
                resolve(record);
            };

            getReq.onerror = () => {
                db.close();
                resolve(null);
            };
        } catch {
            db.close();
            resolve(null);
        }
    });
}

/**
 * Persiste o estado patrimonial e extrato enriquecido no IndexedDB isolado do usuário (`kitsune_${userId}_db`).
 */
export async function writeUserPortfolioCache(
    userId: string,
    payload: CachedPortfolioPayload
): Promise<void> {
    if (!userId) return;

    const snapshot: CachedPortfolioSnapshot = {
        ...payload,
        key: PRIMARY_RECORD_KEY,
        userId,
        schemaVersion: CACHE_SCHEMA_VERSION,
        cachedAt: Date.now(),
    };

    memoryCacheByUser.set(userId, snapshot);

    const db = await openUserDatabase(userId);
    if (!db) return;

    await new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(snapshot);

            tx.oncomplete = () => {
                db.close();
                resolve();
            };

            tx.onerror = () => {
                db.close();
                resolve();
            };

            tx.onabort = () => {
                db.close();
                resolve();
            };
        } catch {
            db.close();
            resolve();
        }
    });
}

function deleteDatabaseByName(dbName: string): Promise<void> {
    if (!isIndexedDbSupported() || !dbName) return Promise.resolve();
    knownUserDbNames.delete(dbName);

    return new Promise((resolve) => {
        try {
            const req = window.indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
        } catch {
            resolve();
        }
    });
}

/**
 * Remove completamente o banco IndexedDB do usuário no logout ou troca de sessão,
 * impedindo vazamento residual entre diferentes contas no mesmo navegador.
 */
export async function clearUserPortfolioCache(
    targetUserId?: string | null,
    wipeAllUsers = false
): Promise<void> {
    if (wipeAllUsers) {
        memoryCacheByUser.clear();
    } else if (targetUserId) {
        memoryCacheByUser.delete(targetUserId);
    }

    if (!isIndexedDbSupported()) return;

    const dbsToDelete = new Set<string>();
    if (targetUserId) {
        dbsToDelete.add(getUserDbName(targetUserId));
    }

    if (wipeAllUsers) {
        for (const name of knownUserDbNames) {
            dbsToDelete.add(name);
        }

        const idbWithDatabases = window.indexedDB as IDBFactory & {
            databases?: () => Promise<Array<{ name?: string }>>;
        };

        if (typeof idbWithDatabases.databases === 'function') {
            try {
                const allDbs = await idbWithDatabases.databases();
                for (const info of allDbs) {
                    if (
                        info?.name &&
                        info.name.startsWith(DB_PREFIX) &&
                        info.name.endsWith(DB_SUFFIX)
                    ) {
                        dbsToDelete.add(info.name);
                    }
                }
            } catch {
                // Alguns navegadores restritos não expõem indexedDB.databases()
            }
        }
    }

    await Promise.all(Array.from(dbsToDelete).map((name) => deleteDatabaseByName(name)));
}
