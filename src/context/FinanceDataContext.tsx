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
  transactions: any[];
  connections: any[];
  familyMembers: FamilyMemberItem[];
  aiInsight: { text: string; updatedAt: string } | null;
  isInitialLoading: boolean;
  isRevalidating: boolean;
  lastFetchedAt: number | null;
  // Shared view toggle (optional Family Aggregation)
  isFamilyModeEnabled: boolean;
  setIsFamilyModeEnabled: (enabled: boolean) => void;
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

export function FinanceDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>([]);
  const [aiInsight, setAiInsightState] = useState<{ text: string; updatedAt: string } | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [isFamilyModeEnabled, setIsFamilyModeEnabledState] = useState<boolean>(false);

  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-3.5-flash-lite');
  const [reasoningLevel, setReasoningLevel] = useState<'fast' | 'standard' | 'deep'>('standard');
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Olá! Sou a **Kitsune AI**, sua estrategista patrimonial pessoal. Estou conectada diretamente aos seus dados isolados no Supabase. Quer analisar seu fluxo de caixa do mês, auditar despesas por categoria ou planejar sua alocação?',
      timestamp: new Date().toISOString(),
      modelUsed: 'gemini-3.5-flash-lite',
    },
  ]);

  const supabaseRef = useRef(createClient());
  const isFetchingRef = useRef(false);
  const lastFetchedRef = useRef<number | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const setIsFamilyModeEnabled = useCallback((enabled: boolean) => {
    setIsFamilyModeEnabledState(enabled);
    if (typeof window !== 'undefined' && currentUserIdRef.current) {
      window.localStorage.setItem(
        `kitsune_family_mode_${currentUserIdRef.current}`,
        enabled ? '1' : '0'
      );
    }
  }, []);

  const resetState = useCallback(() => {
    setUser(null);
    setUserProfile(null);
    setAccounts([]);
    setInvestments([]);
    setTransactions([]);
    setConnections([]);
    setFamilyMembers([]);
    setAiInsightState(null);
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
          resetState();
          setIsInitialLoading(false);
          setIsRevalidating(false);
          isFetchingRef.current = false;
          return;
        }

        if (currentUserIdRef.current && currentUserIdRef.current !== authUser.id) {
          resetState();
        }

        currentUserIdRef.current = authUser.id;
        setUser(authUser);

        if (typeof window !== 'undefined') {
          const savedFamilyPref = window.localStorage.getItem(
            `kitsune_family_mode_${authUser.id}`
          );
          if (savedFamilyPref !== null) {
            setIsFamilyModeEnabledState(savedFamilyPref === '1');
          }
        }

        const [
          profileRes,
          membersRes,
          bankAccRes,
          invRes,
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
            .eq('user_id', authUser.id)
            .order('updated_at', { ascending: false }),
          supabase
            .from('investments')
            .select('*')
            .eq('user_id', authUser.id),
          supabase
            .from('transactions')
            .select('*, bank_accounts(bank_name, type), family_members(id, name, role)')
            .eq('user_id', authUser.id)
            .order('executed_at', { ascending: false })
            .limit(150),
          supabase
            .from('pluggy_connections')
            .select('*')
            .eq('user_id', authUser.id)
            .order('updated_at', { ascending: false }),
          supabase
            .from('ai_insights')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),
        ]);

        if (profileRes.data) {
          setUserProfile({
            id: profileRes.data.id,
            full_name: profileRes.data.full_name,
            display_name: profileRes.data.display_name,
            avatar_url: profileRes.data.avatar_url,
            financial_goal: profileRes.data.financial_goal,
            monthly_income: profileRes.data.monthly_income
              ? Number(profileRes.data.monthly_income)
              : null,
            onboarding_completed: Boolean(profileRes.data.onboarding_completed),
          });
        } else {
          // Cria registro inicial se não existir
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
            });
          }
        }

        if (membersRes.data) {
          setFamilyMembers(membersRes.data);
        }

        let resolvedAccounts = bankAccRes.data || [];
        if (resolvedAccounts.length === 0) {
          const { data: legacyAcc } = await supabase
            .from('accounts')
            .select('*, pluggy_connections(provider_name)')
            .eq('user_id', authUser.id);
          if (legacyAcc && legacyAcc.length > 0) {
            resolvedAccounts = legacyAcc.map((a: any) => ({
              ...a,
              bank_name: a.name,
              type: a.type || 'BANK',
            }));
          }
        }
        setAccounts(resolvedAccounts);

        if (invRes.data) {
          setInvestments(invRes.data);
        }

        if (txnRes.data) {
          setTransactions(txnRes.data);
        }

        if (connRes.data) {
          setConnections(connRes.data);
        }

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

  useEffect(() => {
    revalidate(false);

    const supabase = supabaseRef.current;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        resetState();
        setIsInitialLoading(false);
      } else if (session.user.id !== currentUserIdRef.current) {
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
        transactions,
        connections,
        familyMembers,
        aiInsight,
        isInitialLoading,
        isRevalidating,
        lastFetchedAt,
        isFamilyModeEnabled,
        setIsFamilyModeEnabled,
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
