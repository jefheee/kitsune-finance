-- Migration: Family Financial Aggregation Layer
-- Tables: family_members, bank_accounts, transactions updates

-- 1. Create family_members table
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Membro',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'family_members' 
        AND policyname = 'Users can manage their family members'
    ) THEN
        CREATE POLICY "Users can manage their family members"
        ON public.family_members
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);

-- 2. Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    pluggy_account_id TEXT UNIQUE,
    bank_name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'bank_accounts' 
        AND policyname = 'Users can manage their bank accounts'
    ) THEN
        CREATE POLICY "Users can manage their bank accounts"
        ON public.bank_accounts
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_family_member_id ON public.bank_accounts(family_member_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_item_id ON public.bank_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_pluggy_id ON public.bank_accounts(pluggy_account_id);

-- 3. Upgrade transactions table
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS idempotency_hash TEXT,
    ADD COLUMN IF NOT EXISTS type TEXT,
    ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

-- Unique constraint on idempotency_hash
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'transactions_idempotency_hash_key'
    ) THEN
        ALTER TABLE public.transactions ADD CONSTRAINT transactions_idempotency_hash_key UNIQUE (idempotency_hash);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_family_member_id ON public.transactions(family_member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_hash ON public.transactions(idempotency_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_executed_at ON public.transactions(executed_at);

-- 4. Pluggy Connections relationship
ALTER TABLE public.pluggy_connections
    ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pluggy_connections_family_member ON public.pluggy_connections(family_member_id);

-- 5. Helper RPC functions for background/webhook sync
CREATE OR REPLACE FUNCTION public.sync_pluggy_account(
    p_family_member_id UUID,
    p_user_id UUID,
    p_item_id TEXT,
    p_pluggy_account_id TEXT,
    p_bank_name TEXT,
    p_type TEXT,
    p_balance NUMERIC,
    p_currency TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
BEGIN
    INSERT INTO public.bank_accounts (
        family_member_id,
        user_id,
        item_id,
        pluggy_account_id,
        bank_name,
        type,
        balance,
        currency,
        updated_at
    )
    VALUES (
        p_family_member_id,
        p_user_id,
        p_item_id,
        p_pluggy_account_id,
        p_bank_name,
        p_type,
        p_balance,
        COALESCE(p_currency, 'BRL'),
        now()
    )
    ON CONFLICT (pluggy_account_id) DO UPDATE SET
        family_member_id = EXCLUDED.family_member_id,
        item_id = EXCLUDED.item_id,
        bank_name = EXCLUDED.bank_name,
        type = EXCLUDED.type,
        balance = EXCLUDED.balance,
        currency = EXCLUDED.currency,
        updated_at = now()
    RETURNING id INTO v_account_id;

    RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_pluggy_transaction(
    p_account_id UUID,
    p_family_member_id UUID,
    p_user_id UUID,
    p_pluggy_tx_id TEXT,
    p_idempotency_hash TEXT,
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_executed_at TIMESTAMPTZ,
    p_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx_id UUID;
BEGIN
    INSERT INTO public.transactions (
        account_id,
        family_member_id,
        user_id,
        pluggy_transaction_id,
        idempotency_hash,
        description,
        amount,
        type,
        category,
        executed_at,
        date,
        updated_at
    )
    VALUES (
        p_account_id,
        p_family_member_id,
        p_user_id,
        p_pluggy_tx_id,
        p_idempotency_hash,
        p_description,
        p_amount,
        p_type,
        p_category,
        p_executed_at,
        p_date,
        now()
    )
    ON CONFLICT (idempotency_hash) DO UPDATE SET
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        category = EXCLUDED.category,
        executed_at = EXCLUDED.executed_at,
        date = EXCLUDED.date,
        updated_at = now()
    RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_or_create_connection_for_webhook(
    p_item_id TEXT,
    p_client_user_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    family_member_id UUID,
    provider_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_member_id UUID;
    v_provider_name TEXT := 'Meu Pluggy';
BEGIN
    SELECT pc.user_id, pc.family_member_id, pc.provider_name
    INTO v_user_id, v_member_id, v_provider_name
    FROM public.pluggy_connections pc
    WHERE pc.item_id = p_item_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT v_user_id, v_member_id, v_provider_name;
        RETURN;
    END IF;

    IF p_client_user_id IS NOT NULL AND p_client_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT fm.user_id, fm.id
        INTO v_user_id, v_member_id
        FROM public.family_members fm
        WHERE fm.id = p_client_user_id::uuid
        LIMIT 1;

        IF v_user_id IS NOT NULL THEN
            INSERT INTO public.pluggy_connections (user_id, family_member_id, item_id, provider_name, status)
            VALUES (v_user_id, v_member_id, p_item_id, v_provider_name, 'CONNECTED')
            ON CONFLICT (item_id) DO UPDATE SET
                family_member_id = EXCLUDED.family_member_id,
                user_id = EXCLUDED.user_id,
                status = 'CONNECTED';

            RETURN QUERY SELECT v_user_id, v_member_id, v_provider_name;
            RETURN;
        END IF;
    END IF;

    SELECT u.id, fm.id
    INTO v_user_id, v_member_id
    FROM auth.users u
    JOIN public.family_members fm ON fm.user_id = u.id
    ORDER BY fm.created_at ASC
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.pluggy_connections (user_id, family_member_id, item_id, provider_name, status)
        VALUES (v_user_id, v_member_id, p_item_id, v_provider_name, 'CONNECTED')
        ON CONFLICT (item_id) DO UPDATE SET
            family_member_id = EXCLUDED.family_member_id,
            status = 'CONNECTED';

        RETURN QUERY SELECT v_user_id, v_member_id, v_provider_name;
        RETURN;
    END IF;
END;
$$;
