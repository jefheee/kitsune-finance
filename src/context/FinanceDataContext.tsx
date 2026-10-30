"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { BankIdentitySource } from '@/utils/pluggy/identity-consolidator';

export interface FamilyMemberItem {
    id: string;
    user_id?: string;
    name: string;
    role: string;
    avatar_url?: string | null;
    created_at?: string;
}

export interface UserProfileData {
    id: string;
    full_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    financial_goal?: string | null;
    monthly_income?: number | null;
    onboarding_completed: boolean;
    birth_date?: string | null;
    document_mask?: string | null;
    job_title?: string | null;
    emails?: string[];
    phones?: string[];
    addresses?: Array<{
        fullAddress: string;
        city: string | null;
        state: string | null;
        postalCode: string | null;
        sourceBank: string;
    }>;
    bank_sources?: BankIdentitySource[];
    consolidated_identity?: Record<string, any> | null;
}

export interface ChatMessageItem {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    modelUsed?: string;
}

interface FinanceDataContextValue {
    user: User | null;
    userProfile: UserProfileData | null;
    accounts: any[];
    investments: any[];
    loans: any[];
    transactions: any[];
    connections: any[];
    familyMembers: FamilyMemberItem[];
    aiInsight: { text: string; updatedAt: string } | null;
    isInitialLoading: boolean;
    isRevalidating: boolean;
    lastFetchedAt: number | null;
    // Multi-bank global filter ('all' or institution_slug like 'nubank', 'itau', 'santander', 'inter', 'caixa', 'mercadopago')
    selectedBankSlug: string;
    setSelectedBankSlug: (slug: string) => void;
    // Privacy / Masking sensitive values across the app (default true per user requirement)
    isPrivacyMode: boolean;
    setIsPrivacyMode: (val: boolean) => void;
    togglePrivacyMode: () => void;
    formatSensitiveCurrency: (val: number) => string;
    // Shared view toggle (optional Family Aggregation)
    isFamilyModeEnabled: boolean;
    setIsFamilyModeEnabled: (enabled: boolean) => void;
    activePartner: { id: string; full_name?: string; display_name?: string; avatar_url?: string } | null;
    sharedConnection: any | null;
    // Chat state persisted across tab switches
    chatMessages: ChatMessageItem[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;
    selectedAiModel: string;
    setSelectedAiModel: (model: string) => void;
    reasoningLevel: 'fast' | 'standard' | 'deep';
    setReasoningLevel: (level: 'fast' | 'standard' | 'deep') => void;
    // Actions & SWR revalidation
    revalidate: (force?: boolean) => Promise<void>;
    setAiInsightState: (insight: { text: string; updatedAt: string } | null) => void;
    updateUserProfileLocal: (partial: Partial<UserProfileData>) => void;
    addFamilyMemberLocal: (member: FamilyMemberItem) => void;
    removeFamilyMemberLocal: (memberId: string) => void;
    removeConnectionLocal: (connectionIdOrItemId: string) => void;
}

const FinanceDataContext = createContext<FinanceDataContextValue | undefined>(undefined);

const STALE_TIME_MS = 60 * 1000;

const DEFAULT_WELCOME_MESSAGE: ChatMessageItem = {
    id: 'welcome-msg',
    role: 'assistant',
    content:
        'Olá! Sou a **Kitsune AI**, sua estrategista patrimonial pessoal. Seus dados Open Finance estão sincronizados e conciliados com proteção multi-tenant. Deseja realizar um Raio-X do mês, auditar faturas de cartão ou analisar seus investimentos?',
    timestamp: new Date().toISOString(),
    modelUsed: 'auto',
};

function clearBrowserCacheForUser(targetUserId?: string | null, wipeAllKitsuneKeys = false) {
    if (typeof window === 'undefined') return;
    try {
        // Sempre remover chaves globais legadas sem escopo de user.id
        const legacyKeys = [
            'kitsune_ai_chat_v2',
            'kitsune_ai_threads_v3',
            'kitsune_ai_active_thread_v3',
            'kitsune_family_mode',
        ];
        legacyKeys.forEach((k) => {
            window.localStorage.removeItem(k);
            window.sessionStorage.removeItem(k);
        });

        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!key) continue;
            if (wipeAllKitsuneKeys && key.startsWith('kitsune_')) {
                keysToRemove.push(key);
            } else if (targetUserId && key.startsWith(`kitsune_${targetUserId}_`)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));

        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (!key) continue;
            if (wipeAllKitsuneKeys && key.startsWith('kitsune_')) {
                sessionKeysToRemove.push(key);
            } else if (targetUserId && key.startsWith(`kitsune_${targetUserId}_`)) {
                sessionKeysToRemove.push(key);
            }
        }
        sessionKeysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
        // Ignore storage errors
    }
}

export function FinanceDataProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [investments, setInvestments] = useState<any[]>([]);
    const [loans, setLoans] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [connections, setConnections] = useState<any[]>([]);
    const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>([]);
    const [aiInsight, setAiInsightState] = useState<{ text: string; updatedAt: string } | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
    const [selectedBankSlug, setSelectedBankSlugState] = useState<string>('all');
    const [isFamilyModeEnabled, setIsFamilyModeEnabledState] = useState<boolean>(false);
    const [activePartner, setActivePartner] = useState<{ id: string; full_name?: string; display_name?: string; avatar_url?: string } | null>(null);
    const [sharedConnection, setSharedConnection] = useState<any | null>(null);
    // Modo Privacidade: Sempre ativado por padrão conforme solicitado
    const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(true);

    const togglePrivacyMode = useCallback(() => {
        setIsPrivacyMode((prev) => !prev);
    }, []);

    const formatSensitiveCurrency = useCallback((val: number) => {
        if (isPrivacyMode) {
            return "R$ ••••••";
        }
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(val);
    }, [isPrivacyMode]);

    const [selectedAiModel, setSelectedAiModel] = useState<string>('auto');
    const [reasoningLevel, setReasoningLevel] = useState<'fast' | 'standard' | 'deep'>('standard');
    const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([DEFAULT_WELCOME_MESSAGE]);

    const supabaseRef = useRef(createClient());
    const isFetchingRef = useRef(false);
    const lastFetchedRef = useRef<number | null>(null);
    const currentUserIdRef = useRef<string | null>(null);
    const revalidateRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

    const setSelectedBankSlug = useCallback((slug: string) => {
        setSelectedBankSlugState(slug);
        if (typeof window !== 'undefined' && currentUserIdRef.current) {
            window.localStorage.setItem(
                `kitsune_${currentUserIdRef.current}_selected_bank`,
                slug
            );
        }
    }, []);

    const setIsFamilyModeEnabled = useCallback((enabled: boolean) => {
        setIsFamilyModeEnabledState(enabled);
        if (typeof window !== 'undefined' && currentUserIdRef.current) {
            window.localStorage.setItem(
                `kitsune_${currentUserIdRef.current}_family_mode`,
                enabled ? '1' : '0'
            );
        }
        // Força revalidação imediata com bypass de cache para agregar/desagregar dados do parceiro
        lastFetchedRef.current = null;
        setTimeout(() => {
            revalidateRef.current(true);
        }, 50);
    }, []);

    const resetState = useCallback((wipeStorage = false) => {
        if (wipeStorage) {
            clearBrowserCacheForUser(currentUserIdRef.current, true);
        } else {
            clearBrowserCacheForUser(null, false);
        }
        setUser(null);
        setUserProfile(null);
        setAccounts([]);
        setInvestments([]);
        setLoans([]);
        setTransactions([]);
        setConnections([]);
        setFamilyMembers([]);
        setActivePartner(null);
        setSharedConnection(null);
        setAiInsightState(null);
        setSelectedBankSlugState('all');
        setChatMessages([DEFAULT_WELCOME_MESSAGE]);
        setLastFetchedAt(null);
        lastFetchedRef.current = null;
        currentUserIdRef.current = null;
    }, []);

    const revalidate = useCallback(
        async (force = false) => {
            if (isFetchingRef.current) return;

            const now = Date.now();
            if (
                !force &&
                lastFetchedRef.current &&
                now - lastFetchedRef.current < STALE_TIME_MS &&
                currentUserIdRef.current
            ) {
                return;
            }

            isFetchingRef.current = true;
            if (lastFetchedRef.current) {
                setIsRevalidating(true);
            }

            try {
                const supabase = supabaseRef.current;
                const {
                    data: { user: authUser },
                } = await supabase.auth.getUser();

                if (!authUser) {
                    resetState(true);
                    setIsInitialLoading(false);
                    setIsRevalidating(false);
                    isFetchingRef.current = false;
                    return;
                }

                // Se trocou de usuário na mesma aba, limpa todo o estado e cache do usuário anterior
                if (currentUserIdRef.current && currentUserIdRef.current !== authUser.id) {
                    clearBrowserCacheForUser(currentUserIdRef.current, false);
                    resetState(false);
                } else {
                    clearBrowserCacheForUser(null, false);
                }

                currentUserIdRef.current = authUser.id;
                setUser(authUser);

                let isFamilyActive = false;
                if (typeof window !== 'undefined') {
                    const savedFamilyPref = window.localStorage.getItem(
                        `kitsune_${authUser.id}_family_mode`
                    );
                    if (savedFamilyPref !== null) {
                        isFamilyActive = savedFamilyPref === '1';
                        setIsFamilyModeEnabledState(isFamilyActive);
                    }
                    const savedBankSlug = window.localStorage.getItem(
                        `kitsune_${authUser.id}_selected_bank`
                    );
                    if (savedBankSlug) {
                        setSelectedBankSlugState(savedBankSlug);
                    }
                }

                // Busca todas as conexões de Espaço Compartilhado ativas com consentimento mútuo
                let activeConn: any = null;
                let partnerProfile: any = null;
                const partnerProfiles: any[] = [];
                try {
                    const { data: conns } = await supabase
                        .from('shared_connections')
                        .select('*')
                        .or(`requester_id.eq.${authUser.id},recipient_id.eq.${authUser.id}`)
                        .eq('status', 'accepted');

                    if (conns && conns.length > 0) {
                        activeConn = conns[0];
                        for (const conn of conns) {
                            const partnerId =
                                conn.requester_id === authUser.id
                                    ? conn.recipient_id
                                    : conn.requester_id;
                            if (partnerId) {
                                const { data: pData } = await supabase
                                    .from('users_profile')
                                    .select('id, full_name, display_name, avatar_url')
                                    .eq('id', partnerId)
                                    .maybeSingle();
                                const prof = pData || { id: partnerId };
                                partnerProfiles.push(prof);
                                if (!partnerProfile) partnerProfile = prof;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[FinanceDataContext] Consulta shared_connections:', e);
                }

                setSharedConnection(activeConn);
                setActivePartner(partnerProfile);

                // Multi-tenant: Isolamento rigoroso para o painel pessoal do usuário.
                // Contas, investimentos e transações das telas pessoais pertencem exclusivamente ao usuário autenticado.
                // O Espaço Compartilhado possui sua página própria (/shared) com agregação e transparência por integrante.
                const targetUserIds = [authUser.id];

                const [
                    profileRes,
                    membersRes,
                    bankAccRes,
                    invRes,
                    loansRes,
                    txnRes,
                    connRes,
                    insightRes,
                ] = await Promise.all([
                    supabase
                        .from('users_profile')
                        .select('*')
                        .eq('id', authUser.id)
                        .maybeSingle(),
                    supabase
                        .from('family_members')
                        .select('*')
                        .eq('user_id', authUser.id)
                        .order('created_at', { ascending: true }),
                    supabase
                        .from('bank_accounts')
                        .select('*, family_members(id, name, role)')
                        .in('user_id', targetUserIds)
                        .order('updated_at', { ascending: false }),
                    supabase
                        .from('investments')
                        .select('*')
                        .in('user_id', targetUserIds)
                        .order('balance', { ascending: false }),
                    supabase
                        .from('loans')
                        .select('*')
                        .in('user_id', targetUserIds)
                        .order('updated_at', { ascending: false }),
                    supabase
                        .from('transactions')
                        .select(
                            '*, bank_accounts(bank_name, institution_name, institution_slug, product_name, type, subtype, card_brand), family_members(id, name, role)'
                        )
                        .in('user_id', targetUserIds)
                        .order('date', { ascending: false })
                        .limit(3000),
                    supabase
                        .from('pluggy_connections')
                        .select('*')
                        .in('user_id', targetUserIds)
                        .order('updated_at', { ascending: false }),
                    supabase
                        .from('ai_insights')
                        .select('*')
                        .eq('user_id', authUser.id)
                        .maybeSingle(),
                ]);

                if (profileRes.data) {
                    const p = profileRes.data;
                    setUserProfile({
                        id: p.id,
                        full_name: p.full_name,
                        display_name: p.display_name,
                        avatar_url: p.avatar_url,
                        financial_goal: p.financial_goal,
                        monthly_income: p.monthly_income ? Number(p.monthly_income) : null,
                        onboarding_completed: Boolean(p.onboarding_completed),
                        birth_date: p.birth_date || null,
                        document_mask: p.document_mask || null,
                        job_title: p.job_title || null,
                        emails: Array.isArray(p.emails) ? p.emails : [],
                        phones: Array.isArray(p.phones) ? p.phones : [],
                        addresses: Array.isArray(p.addresses) ? p.addresses : [],
                        bank_sources: Array.isArray(p.bank_sources) ? p.bank_sources : [],
                        consolidated_identity: p.consolidated_identity || null,
                    });
                } else {
                    const defaultDisplay =
                        authUser.user_metadata?.full_name ||
                        authUser.email?.split('@')[0] ||
                        'Investidor';
                    const { data: createdProfile } = await supabase
                        .from('users_profile')
                        .upsert(
                            {
                                id: authUser.id,
                                full_name: authUser.user_metadata?.full_name || defaultDisplay,
                                display_name: defaultDisplay,
                                onboarding_completed: false,
                            },
                            { onConflict: 'id' }
                        )
                        .select('*')
                        .maybeSingle();

                    if (createdProfile) {
                        setUserProfile({
                            id: createdProfile.id,
                            full_name: createdProfile.full_name,
                            display_name: createdProfile.display_name,
                            avatar_url: createdProfile.avatar_url,
                            financial_goal: createdProfile.financial_goal,
                            monthly_income: createdProfile.monthly_income
                                ? Number(createdProfile.monthly_income)
                                : null,
                            onboarding_completed: Boolean(createdProfile.onboarding_completed),
                            birth_date: createdProfile.birth_date || null,
                            document_mask: createdProfile.document_mask || null,
                            job_title: createdProfile.job_title || null,
                            emails: [],
                            phones: [],
                            addresses: [],
                            bank_sources: [],
                            consolidated_identity: null,
                        });
                    }
                }

                if (membersRes.data) {
                    setFamilyMembers(membersRes.data);
                }

                setAccounts(bankAccRes.data || []);
                setInvestments(invRes.data || []);
                setLoans(loansRes.data || []);

                // Reconciliação inteligente: Transações e Pix mútuos entre o casal são marcados como remanejamento interno
                const rawTxns = txnRes.data || [];
                const partnerName = (partnerProfile?.display_name || partnerProfile?.full_name || '').toLowerCase();
                const userName = (profileRes.data?.display_name || profileRes.data?.full_name || '').toLowerCase();

                const reconciledTxns = rawTxns.map((t: any) => {
                    if (targetUserIds.length > 1 && partnerName && partnerName.length >= 3) {
                        const desc = (t.description || '').toLowerCase();
                        if (
                            (desc.includes(partnerName) || (userName && desc.includes(userName)) || desc.includes('transferência') || desc.includes('pix')) &&
                            (desc.includes('enviad') || desc.includes('recebid') || desc.includes('entre contas') || desc.includes('mesma titularidade'))
                        ) {
                            return { ...t, is_internal_transfer: true };
                        }
                    }
                    return t;
                });

                setTransactions(reconciledTxns);
                setConnections(connRes.data || []);

                if (insightRes.data) {
                    setAiInsightState({
                        text: insightRes.data.last_analysis_text,
                        updatedAt: insightRes.data.updated_at,
                    });
                } else {
                    setAiInsightState(null);
                }

                const fetchedTimestamp = Date.now();
                lastFetchedRef.current = fetchedTimestamp;
                setLastFetchedAt(fetchedTimestamp);
            } catch (err) {
                console.error('[FinanceDataContext] Erro ao carregar dados:', err);
            } finally {
                setIsInitialLoading(false);
                setIsRevalidating(false);
                isFetchingRef.current = false;
            }
        },
        [resetState]
    );

    revalidateRef.current = revalidate;

    useEffect(() => {
        revalidate(false);

        const supabase = supabaseRef.current;
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session?.user) {
                resetState(true);
                setIsInitialLoading(false);
            } else if (session.user.id !== currentUserIdRef.current) {
                clearBrowserCacheForUser(currentUserIdRef.current, false);
                revalidate(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [revalidate, resetState]);

    const updateUserProfileLocal = useCallback((partial: Partial<UserProfileData>) => {
        setUserProfile((prev) => (prev ? { ...prev, ...partial } : null));
    }, []);

    const addFamilyMemberLocal = useCallback((member: FamilyMemberItem) => {
        setFamilyMembers((prev) => [...prev, member]);
    }, []);

    const removeFamilyMemberLocal = useCallback((memberId: string) => {
        setFamilyMembers((prev) => prev.filter((m) => m.id !== memberId));
    }, []);

    const removeConnectionLocal = useCallback((connectionIdOrItemId: string) => {
        setConnections((prev) => {
            const target = prev.find(
                (c) => c.id === connectionIdOrItemId || c.item_id === connectionIdOrItemId
            );
            const targetItemId = target?.item_id || connectionIdOrItemId;

            setAccounts((prevAcc) => {
                const removedAccountIds = new Set(
                    prevAcc.filter((a) => a.item_id === targetItemId).map((a) => a.id)
                );
                setTransactions((prevTx) =>
                    prevTx.filter((t) => !removedAccountIds.has(t.account_id))
                );
                return prevAcc.filter((a) => a.item_id !== targetItemId);
            });

            setInvestments((prevInv) => prevInv.filter((i) => i.item_id !== targetItemId));
            setLoans((prevLoans) => prevLoans.filter((l) => l.item_id !== targetItemId));

            return prev.filter(
                (c) => c.id !== connectionIdOrItemId && c.item_id !== connectionIdOrItemId
            );
        });
    }, []);

    return (
        <FinanceDataContext.Provider
            value={{
                user,
                userProfile,
                accounts,
                investments,
                loans,
                transactions,
                connections,
                familyMembers,
                aiInsight,
                isInitialLoading,
                isRevalidating,
                lastFetchedAt,
                selectedBankSlug,
                setSelectedBankSlug,
                isPrivacyMode,
                setIsPrivacyMode,
                togglePrivacyMode,
                formatSensitiveCurrency,
                isFamilyModeEnabled,
                setIsFamilyModeEnabled,
                activePartner,
                sharedConnection,
                chatMessages,
                setChatMessages,
                selectedAiModel,
                setSelectedAiModel,
                reasoningLevel,
                setReasoningLevel,
                revalidate,
                setAiInsightState,
                updateUserProfileLocal,
                addFamilyMemberLocal,
                removeFamilyMemberLocal,
                removeConnectionLocal,
            }}
        >
            {children}
        </FinanceDataContext.Provider>
    );
}

export function useFinanceData() {
    const ctx = useContext(FinanceDataContext);
    if (!ctx) {
        throw new Error('useFinanceData deve ser usado dentro de um FinanceDataProvider');
    }
    return ctx;
}
