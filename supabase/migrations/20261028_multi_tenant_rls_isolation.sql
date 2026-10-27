-- Migration: Multi-Tenant Isolation, Strict RLS, Decoupled Family Aggregation & Cascade Cleanup
-- Date: 2026-10-28

-- 1. Ensure user_id NOT NULL and ON DELETE CASCADE on core tables
DELETE FROM public.pluggy_connections WHERE user_id IS NULL;
DELETE FROM public.bank_accounts WHERE user_id IS NULL;
DELETE FROM public.transactions WHERE user_id IS NULL;

ALTER TABLE public.pluggy_connections
    ALTER COLUMN user_id SET NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.bank_accounts
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN family_member_id DROP NOT NULL;

ALTER TABLE public.transactions
    ALTER COLUMN user_id SET NOT NULL;

-- 2. Decouple family_members from mandatory cascade deletion on bank_accounts and transactions
ALTER TABLE public.bank_accounts
    DROP CONSTRAINT IF EXISTS bank_accounts_family_member_id_fkey;

ALTER TABLE public.bank_accounts
    ADD CONSTRAINT bank_accounts_family_member_id_fkey
    FOREIGN KEY (family_member_id)
    REFERENCES public.family_members(id)
    ON DELETE SET NULL;

ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_family_member_id_fkey;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_family_member_id_fkey
    FOREIGN KEY (family_member_id)
    REFERENCES public.family_members(id)
    ON DELETE SET NULL;

-- 3. Clean up ghost/duplicate pluggy_connections before adding FK from bank_accounts(item_id)
DELETE FROM public.pluggy_connections pc
WHERE NOT EXISTS (
    SELECT 1 FROM public.bank_accounts ba WHERE ba.item_id = pc.item_id
)
AND EXISTS (
    SELECT 1 FROM public.bank_accounts ba2 WHERE ba2.user_id = pc.user_id
);

-- Update generic provider_name ('pluggy' / 'Meu Pluggy') from linked bank_accounts where available
UPDATE public.pluggy_connections pc
SET provider_name = CASE
    WHEN EXISTS (
        SELECT 1 FROM public.bank_accounts ba
        WHERE ba.item_id = pc.item_id AND ba.bank_name ILIKE '%Nu Pagamentos%'
    ) THEN 'Nubank'
    ELSE COALESCE(
        (SELECT ba.bank_name FROM public.bank_accounts ba WHERE ba.item_id = pc.item_id AND ba.type = 'BANK' LIMIT 1),
        (SELECT ba.bank_name FROM public.bank_accounts ba WHERE ba.item_id = pc.item_id LIMIT 1),
        pc.provider_name
    )
END,
updated_at = now()
WHERE pc.provider_name ILIKE 'pluggy' OR pc.provider_name ILIKE 'Meu Pluggy';

-- Ensure every bank_account.item_id has a parent pluggy_connection before adding FK
INSERT INTO public.pluggy_connections (user_id, family_member_id, item_id, provider_name, status, updated_at)
SELECT DISTINCT ba.user_id, ba.family_member_id, ba.item_id, ba.bank_name, 'CONNECTED', now()
FROM public.bank_accounts ba
WHERE NOT EXISTS (
    SELECT 1 FROM public.pluggy_connections pc WHERE pc.item_id = ba.item_id
)
ON CONFLICT (item_id) DO NOTHING;

ALTER TABLE public.bank_accounts
    DROP CONSTRAINT IF EXISTS bank_accounts_item_id_fkey;

ALTER TABLE public.bank_accounts
    ADD CONSTRAINT bank_accounts_item_id_fkey
    FOREIGN KEY (item_id)
    REFERENCES public.pluggy_connections(item_id)
    ON DELETE CASCADE;

-- 4. Enable and Enforce Strict Row Level Security (RLS) on ALL tables
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- bank_accounts policies
DROP POLICY IF EXISTS "Users can manage their bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can only access their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can only access their own bank accounts"
ON public.bank_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- transactions policies
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can only access their own transactions" ON public.transactions;
CREATE POLICY "Users can only access their own transactions"
ON public.transactions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- pluggy_connections policies
DROP POLICY IF EXISTS "Users can view their own pluggy connections" ON public.pluggy_connections;
DROP POLICY IF EXISTS "Users can insert their own pluggy connections" ON public.pluggy_connections;
DROP POLICY IF EXISTS "Users can update their own pluggy connections" ON public.pluggy_connections;
DROP POLICY IF EXISTS "Users can delete their own pluggy connections" ON public.pluggy_connections;
DROP POLICY IF EXISTS "Users can only access their own pluggy connections" ON public.pluggy_connections;
CREATE POLICY "Users can only access their own pluggy connections"
ON public.pluggy_connections FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- accounts (legacy) policies
DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts"
ON public.accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- investments policies
DROP POLICY IF EXISTS "Users can manage their own investments" ON public.investments;
CREATE POLICY "Users can manage their own investments"
ON public.investments FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ai_insights policies
DROP POLICY IF EXISTS "Users can select their own ai insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can insert their own ai insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can update their own ai insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can only access their own ai insights" ON public.ai_insights;
CREATE POLICY "Users can only access their own ai insights"
ON public.ai_insights FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- family_members policies
DROP POLICY IF EXISTS "Users can manage their family members" ON public.family_members;
CREATE POLICY "Users can manage their family members"
ON public.family_members FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- users_profile policies
DROP POLICY IF EXISTS "Users can view their own profile." ON public.users_profile;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.users_profile;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.users_profile;
DROP POLICY IF EXISTS "Users can only access their own profile" ON public.users_profile;
CREATE POLICY "Users can only access their own profile"
ON public.users_profile FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Secure RPCs (Multi-Tenant Validated)
DROP FUNCTION IF EXISTS public.sync_pluggy_account(uuid, uuid, text, text, text, text, numeric, text);
DROP FUNCTION IF EXISTS public.upsert_pluggy_transaction(uuid, uuid, uuid, text, text, text, numeric, text, text, timestamptz, date);
DROP FUNCTION IF EXISTS public.get_or_create_connection_for_webhook(text, text);

CREATE OR REPLACE FUNCTION public.bulk_insert_transactions(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inserted_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.transactions (
    id, user_id, account_id, pluggy_transaction_id, description, amount, date, category, created_at, updated_at
  )
  SELECT
    COALESCE((elem->>'id')::uuid, gen_random_uuid()),
    auth.uid(),
    (elem->>'account_id')::uuid,
    elem->>'pluggy_transaction_id',
    elem->>'description',
    (elem->>'amount')::numeric,
    (elem->>'date')::date,
    elem->>'category',
    COALESCE((elem->>'created_at')::timestamptz, now()),
    COALESCE((elem->>'updated_at')::timestamptz, now())
  FROM jsonb_array_elements(payload) AS elem
  WHERE EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = (elem->>'account_id')::uuid AND ba.user_id = auth.uid()
  )
  ON CONFLICT (pluggy_transaction_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pluggy_account(
    p_family_member_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_item_id TEXT DEFAULT NULL,
    p_pluggy_account_id TEXT DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_balance NUMERIC DEFAULT 0,
    p_currency TEXT DEFAULT 'BRL'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account_id UUID;
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id is required';
    END IF;

    -- If called from an authenticated client session, enforce session ownership
    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    -- Verify the item_id belongs to v_effective_user_id in pluggy_connections
    IF NOT EXISTS (
        SELECT 1 FROM public.pluggy_connections pc
        WHERE pc.item_id = p_item_id AND pc.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: item_id % does not belong to user %', p_item_id, v_effective_user_id;
    END IF;

    -- Deduplicate: if the same user already has an account with the same bank_name and type (for same member/personal scope),
    -- migrate it to the new item_id and pluggy_account_id instead of creating a duplicate bank account
    SELECT ba.id INTO v_account_id
    FROM public.bank_accounts ba
    WHERE ba.user_id = v_effective_user_id
      AND (
          ba.pluggy_account_id = p_pluggy_account_id
          OR (
              lower(trim(ba.bank_name)) = lower(trim(p_bank_name))
              AND upper(trim(ba.type)) = upper(trim(p_type))
              AND COALESCE(ba.family_member_id, '00000000-0000-0000-0000-000000000000'::uuid) =
                  COALESCE(p_family_member_id, ba.family_member_id, '00000000-0000-0000-0000-000000000000'::uuid)
          )
      )
    ORDER BY (ba.pluggy_account_id = p_pluggy_account_id) DESC, ba.updated_at DESC
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts
        SET family_member_id = COALESCE(p_family_member_id, family_member_id),
            item_id = p_item_id,
            pluggy_account_id = p_pluggy_account_id,
            bank_name = p_bank_name,
            type = p_type,
            balance = p_balance,
            currency = COALESCE(p_currency, 'BRL'),
            updated_at = now()
        WHERE id = v_account_id AND user_id = v_effective_user_id;
    ELSE
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
            v_effective_user_id,
            p_item_id,
            p_pluggy_account_id,
            p_bank_name,
            p_type,
            p_balance,
            COALESCE(p_currency, 'BRL'),
            now()
        )
        RETURNING id INTO v_account_id;
    END IF;

    -- Clean up any older ghost/duplicate connections for the same user that no longer hold any bank_accounts
    DELETE FROM public.pluggy_connections pc
    WHERE pc.user_id = v_effective_user_id
      AND pc.item_id <> p_item_id
      AND NOT EXISTS (
          SELECT 1 FROM public.bank_accounts ba WHERE ba.item_id = pc.item_id
      );

    RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_pluggy_transaction(
    p_account_id UUID,
    p_family_member_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_pluggy_tx_id TEXT DEFAULT NULL,
    p_idempotency_hash TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0,
    p_type TEXT DEFAULT 'DEBIT',
    p_category TEXT DEFAULT 'Outros',
    p_executed_at TIMESTAMPTZ DEFAULT now(),
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx_id UUID;
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id is required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    -- Verify the bank account belongs to v_effective_user_id
    IF NOT EXISTS (
        SELECT 1 FROM public.bank_accounts ba
        WHERE ba.id = p_account_id AND ba.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: account_id % does not belong to user %', p_account_id, v_effective_user_id;
    END IF;

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
        v_effective_user_id,
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
    WHERE public.transactions.user_id = v_effective_user_id
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
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_member_id UUID;
    v_provider_name TEXT := 'Instituição Conectada';
BEGIN
    -- 1. Locate existing registered item_id strictly
    SELECT pc.user_id, pc.family_member_id, pc.provider_name
    INTO v_user_id, v_member_id, v_provider_name
    FROM public.pluggy_connections pc
    WHERE pc.item_id = p_item_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT v_user_id, v_member_id, v_provider_name;
        RETURN;
    END IF;

    -- 2. If not registered yet, only allow binding if p_client_user_id is a valid UUID
    IF p_client_user_id IS NOT NULL AND p_client_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        -- First check if p_client_user_id is directly an auth.users.id
        SELECT u.id INTO v_user_id
        FROM auth.users u
        WHERE u.id = p_client_user_id::uuid
        LIMIT 1;

        IF v_user_id IS NOT NULL THEN
            SELECT fm.id INTO v_member_id
            FROM public.family_members fm
            WHERE fm.user_id = v_user_id
            ORDER BY fm.created_at ASC
            LIMIT 1;
        ELSE
            -- Check if p_client_user_id is a family_members.id
            SELECT fm.user_id, fm.id
            INTO v_user_id, v_member_id
            FROM public.family_members fm
            WHERE fm.id = p_client_user_id::uuid
            LIMIT 1;
        END IF;

        IF v_user_id IS NOT NULL THEN
            INSERT INTO public.pluggy_connections (user_id, family_member_id, item_id, provider_name, status, updated_at)
            VALUES (v_user_id, v_member_id, p_item_id, v_provider_name, 'CONNECTED', now())
            ON CONFLICT (item_id) DO NOTHING;

            RETURN QUERY
            SELECT pc.user_id, pc.family_member_id, pc.provider_name
            FROM public.pluggy_connections pc
            WHERE pc.item_id = p_item_id
            LIMIT 1;
            RETURN;
        END IF;
    END IF;

    -- Zero Data Leak: Never fallback to arbitrary users!
    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_pluggy_connection_sync(
    p_user_id UUID,
    p_family_member_id UUID DEFAULT NULL,
    p_item_id TEXT DEFAULT NULL,
    p_provider_name TEXT DEFAULT 'Instituição Conectada',
    p_status TEXT DEFAULT 'CONNECTED'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conn_id UUID;
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL OR p_item_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id and item_id are required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    -- If called from webhook (auth.uid() IS NULL), item_id must already belong to p_user_id
    IF auth.uid() IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.pluggy_connections pc
        WHERE pc.item_id = p_item_id AND pc.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: webhook cannot upsert unverified item_id';
    END IF;

    INSERT INTO public.pluggy_connections (
        user_id,
        family_member_id,
        item_id,
        provider_name,
        status,
        updated_at
    )
    VALUES (
        v_effective_user_id,
        p_family_member_id,
        p_item_id,
        COALESCE(NULLIF(p_provider_name, ''), 'Instituição Conectada'),
        COALESCE(p_status, 'CONNECTED'),
        now()
    )
    ON CONFLICT (item_id) DO UPDATE SET
        family_member_id = COALESCE(EXCLUDED.family_member_id, public.pluggy_connections.family_member_id),
        provider_name = CASE
            WHEN EXCLUDED.provider_name NOT ILIKE 'pluggy' AND EXCLUDED.provider_name NOT ILIKE 'Meu Pluggy'
            THEN EXCLUDED.provider_name
            ELSE public.pluggy_connections.provider_name
        END,
        status = EXCLUDED.status,
        updated_at = now()
    WHERE public.pluggy_connections.user_id = v_effective_user_id
    RETURNING id INTO v_conn_id;

    RETURN v_conn_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.webhook_update_connection_status(
    p_item_id TEXT,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_item_id IS NULL OR p_status IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.pluggy_connections
    SET status = p_status,
        updated_at = now()
    WHERE item_id = p_item_id;
END;
$$;


