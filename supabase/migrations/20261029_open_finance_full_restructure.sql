-- Migration: Open Finance Full Restructure, Rich Reconciliation, Investments/Loans, Consolidated Identity & AI Session Context
-- Date: 2026-10-29

-- 1. Unificação e Limpeza: migrar eventual resíduo de public.accounts e remover tabela morta
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
  ) THEN
    INSERT INTO public.bank_accounts (
      user_id, item_id, pluggy_account_id, bank_name, type, balance, currency, created_at, updated_at
    )
    SELECT
      a.user_id,
      COALESCE(pc.item_id, a.connection_id::text),
      a.pluggy_account_id,
      a.name,
      COALESCE(a.type, 'BANK'),
      COALESCE(a.balance, 0),
      COALESCE(a.currency, 'BRL'),
      COALESCE(a.created_at, now()),
      COALESCE(a.updated_at, now())
    FROM public.accounts a
    LEFT JOIN public.pluggy_connections pc ON pc.id = a.connection_id
    WHERE pc.item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.bank_accounts ba WHERE ba.pluggy_account_id = a.pluggy_account_id
      )
    ON CONFLICT (pluggy_account_id) DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS public.accounts CASCADE;

-- 2. Expansão de pluggy_connections
ALTER TABLE public.pluggy_connections
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_slug TEXT,
  ADD COLUMN IF NOT EXISTS institution_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_identity JSONB,
  ADD COLUMN IF NOT EXISTS raw_connector JSONB,
  ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMPTZ;

-- 3. Expansão de bank_accounts (Contas Correntes, Poupanças e Cartões de Crédito)
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS institution_name TEXT NOT NULL DEFAULT 'Instituição Conectada',
  ADD COLUMN IF NOT EXISTS institution_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS subtype TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS agency_number TEXT,
  ADD COLUMN IF NOT EXISTS transfer_number TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS available_credit_limit NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS balance_close_date DATE,
  ADD COLUMN IF NOT EXISTS balance_due_date DATE,
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS card_brand TEXT;

-- 4. Expansão de transactions (Conciliação Rica)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS clean_description TEXT,
  ADD COLUMN IF NOT EXISTS raw_description TEXT,
  ADD COLUMN IF NOT EXISTS category_pt TEXT,
  ADD COLUMN IF NOT EXISTS category_original TEXT,
  ADD COLUMN IF NOT EXISTS operation_type TEXT,
  ADD COLUMN IF NOT EXISTS is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_refund BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installment_number INT,
  ADD COLUMN IF NOT EXISTS total_installments INT,
  ADD COLUMN IF NOT EXISTS total_purchase_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS merchant_name TEXT,
  ADD COLUMN IF NOT EXISTS merchant_business_name TEXT,
  ADD COLUMN IF NOT EXISTS merchant_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS receiver_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_reason TEXT,
  ADD COLUMN IF NOT EXISTS bill_id TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- 5. Expansão de investments e Criação de loans & expansão de users_profile
ALTER TABLE public.investments
  ALTER COLUMN connection_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS item_id TEXT,
  ADD COLUMN IF NOT EXISTS subtype TEXT,
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_slug TEXT,
  ADD COLUMN IF NOT EXISTS issuer TEXT,
  ADD COLUMN IF NOT EXISTS rate NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS rate_type TEXT,
  ADD COLUMN IF NOT EXISTS annual_rate NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS amount_original NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS amount_profit NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS taxes NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.pluggy_connections(id) ON DELETE CASCADE,
  item_id TEXT,
  pluggy_loan_id TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  type TEXT,
  institution_name TEXT,
  institution_slug TEXT,
  contracted_amount NUMERIC(14,2) DEFAULT 0,
  outstanding_balance NUMERIC(14,2) DEFAULT 0,
  paid_installments INT,
  total_installments INT,
  interest_rate NUMERIC(10,4),
  currency TEXT DEFAULT 'BRL',
  contract_date DATE,
  due_date DATE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS consolidated_identity JSONB,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS document_mask TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_sources JSONB DEFAULT '[]'::jsonb;

-- 6. Tabelas de Contexto por Sessão na Kitsune AI
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova Conversa',
  context_snapshot JSONB,
  system_prompt_cached TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_slug ON public.bank_accounts(user_id, institution_slug);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);

-- 7. Hardening Total: ENABLE + FORCE ROW LEVEL SECURITY e Revogação de 'anon'
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_profile FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pluggy_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights FORCE ROW LEVEL SECURITY;

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages FORCE ROW LEVEL SECURITY;

-- Policies para loans, ai_chat_sessions e ai_chat_messages
DROP POLICY IF EXISTS "Users can only access their own loans" ON public.loans;
CREATE POLICY "Users can only access their own loans"
ON public.loans FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own ai chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can only access their own ai chat sessions"
ON public.ai_chat_sessions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own ai chat messages" ON public.ai_chat_messages;
CREATE POLICY "Users can only access their own ai chat messages"
ON public.ai_chat_messages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Revogar permissões desnecessárias do role anon nas tabelas financeiras
REVOKE ALL ON TABLE public.pluggy_connections FROM anon;
REVOKE ALL ON TABLE public.bank_accounts FROM anon;
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.investments FROM anon;
REVOKE ALL ON TABLE public.loans FROM anon;
REVOKE ALL ON TABLE public.ai_insights FROM anon;
REVOKE ALL ON TABLE public.family_members FROM anon;
REVOKE ALL ON TABLE public.users_profile FROM anon;
REVOKE ALL ON TABLE public.ai_chat_sessions FROM anon;
REVOKE ALL ON TABLE public.ai_chat_messages FROM anon;

-- 8. RPCs Seguras e Enriquecidas para Sincronização
CREATE OR REPLACE FUNCTION public.upsert_pluggy_connection_sync(
    p_user_id UUID,
    p_family_member_id UUID DEFAULT NULL,
    p_item_id TEXT DEFAULT NULL,
    p_provider_name TEXT DEFAULT 'Instituição Conectada',
    p_status TEXT DEFAULT 'CONNECTED',
    p_institution_name TEXT DEFAULT NULL,
    p_institution_slug TEXT DEFAULT NULL,
    p_institution_logo_url TEXT DEFAULT NULL,
    p_raw_identity JSONB DEFAULT NULL,
    p_raw_connector JSONB DEFAULT NULL,
    p_consent_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conn_id UUID;
    v_effective_user_id UUID;
    v_clean_inst TEXT;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL OR p_item_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id and item_id are required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    IF auth.uid() IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.pluggy_connections pc
        WHERE pc.item_id = p_item_id AND pc.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: webhook cannot upsert unverified item_id';
    END IF;

    v_clean_inst := COALESCE(NULLIF(p_institution_name, ''), NULLIF(p_provider_name, ''), 'Instituição Conectada');

    INSERT INTO public.pluggy_connections (
        user_id,
        family_member_id,
        item_id,
        provider_name,
        institution_name,
        institution_slug,
        institution_logo_url,
        raw_identity,
        raw_connector,
        consent_expires_at,
        status,
        updated_at
    )
    VALUES (
        v_effective_user_id,
        p_family_member_id,
        p_item_id,
        v_clean_inst,
        v_clean_inst,
        p_institution_slug,
        p_institution_logo_url,
        p_raw_identity,
        p_raw_connector,
        p_consent_expires_at,
        COALESCE(p_status, 'CONNECTED'),
        now()
    )
    ON CONFLICT (item_id) DO UPDATE SET
        family_member_id = COALESCE(EXCLUDED.family_member_id, public.pluggy_connections.family_member_id),
        provider_name = CASE
            WHEN EXCLUDED.provider_name NOT ILIKE 'pluggy' AND EXCLUDED.provider_name NOT ILIKE 'MeuPluggy' AND EXCLUDED.provider_name NOT ILIKE 'Meu Pluggy'
            THEN EXCLUDED.provider_name
            ELSE public.pluggy_connections.provider_name
        END,
        institution_name = COALESCE(EXCLUDED.institution_name, public.pluggy_connections.institution_name),
        institution_slug = COALESCE(EXCLUDED.institution_slug, public.pluggy_connections.institution_slug),
        institution_logo_url = COALESCE(EXCLUDED.institution_logo_url, public.pluggy_connections.institution_logo_url),
        raw_identity = COALESCE(EXCLUDED.raw_identity, public.pluggy_connections.raw_identity),
        raw_connector = COALESCE(EXCLUDED.raw_connector, public.pluggy_connections.raw_connector),
        consent_expires_at = COALESCE(EXCLUDED.consent_expires_at, public.pluggy_connections.consent_expires_at),
        status = EXCLUDED.status,
        updated_at = now()
    WHERE public.pluggy_connections.user_id = v_effective_user_id
    RETURNING id INTO v_conn_id;

    RETURN v_conn_id;
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
    p_currency TEXT DEFAULT 'BRL',
    p_institution_name TEXT DEFAULT NULL,
    p_institution_slug TEXT DEFAULT NULL,
    p_product_name TEXT DEFAULT NULL,
    p_subtype TEXT DEFAULT NULL,
    p_account_number TEXT DEFAULT NULL,
    p_agency_number TEXT DEFAULT NULL,
    p_transfer_number TEXT DEFAULT NULL,
    p_credit_limit NUMERIC DEFAULT NULL,
    p_available_credit_limit NUMERIC DEFAULT NULL,
    p_balance_close_date DATE DEFAULT NULL,
    p_balance_due_date DATE DEFAULT NULL,
    p_minimum_payment NUMERIC DEFAULT NULL,
    p_card_brand TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account_id UUID;
    v_effective_user_id UUID;
    v_inst_name TEXT;
    v_prod_name TEXT;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id is required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pluggy_connections pc
        WHERE pc.item_id = p_item_id AND pc.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: item_id % does not belong to user %', p_item_id, v_effective_user_id;
    END IF;

    v_inst_name := COALESCE(NULLIF(p_institution_name, ''), NULLIF(p_bank_name, ''), 'Instituição Financeira');
    v_prod_name := COALESCE(NULLIF(p_product_name, ''), NULLIF(p_bank_name, ''), 'Conta Bancária');

    -- Localiza estritamente por pluggy_account_id (ou mesma instituição + subtipo + número de conta/cartão)
    SELECT ba.id INTO v_account_id
    FROM public.bank_accounts ba
    WHERE ba.user_id = v_effective_user_id
      AND (
          ba.pluggy_account_id = p_pluggy_account_id
          OR (
              p_institution_slug IS NOT NULL
              AND ba.institution_slug = p_institution_slug
              AND COALESCE(ba.subtype, ba.type) = COALESCE(p_subtype, p_type)
              AND p_account_number IS NOT NULL
              AND ba.account_number = p_account_number
          )
      )
    ORDER BY (ba.pluggy_account_id = p_pluggy_account_id) DESC, ba.updated_at DESC
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts
        SET family_member_id = COALESCE(p_family_member_id, family_member_id),
            item_id = p_item_id,
            pluggy_account_id = p_pluggy_account_id,
            bank_name = v_inst_name,
            institution_name = v_inst_name,
            institution_slug = COALESCE(p_institution_slug, institution_slug),
            product_name = v_prod_name,
            type = p_type,
            subtype = COALESCE(p_subtype, subtype),
            balance = p_balance,
            currency = COALESCE(p_currency, 'BRL'),
            account_number = COALESCE(p_account_number, account_number),
            agency_number = COALESCE(p_agency_number, agency_number),
            transfer_number = COALESCE(p_transfer_number, transfer_number),
            credit_limit = COALESCE(p_credit_limit, credit_limit),
            available_credit_limit = COALESCE(p_available_credit_limit, available_credit_limit),
            balance_close_date = COALESCE(p_balance_close_date, balance_close_date),
            balance_due_date = COALESCE(p_balance_due_date, balance_due_date),
            minimum_payment = COALESCE(p_minimum_payment, minimum_payment),
            card_brand = COALESCE(p_card_brand, card_brand),
            updated_at = now()
        WHERE id = v_account_id AND user_id = v_effective_user_id;
    ELSE
        INSERT INTO public.bank_accounts (
            family_member_id,
            user_id,
            item_id,
            pluggy_account_id,
            bank_name,
            institution_name,
            institution_slug,
            product_name,
            type,
            subtype,
            balance,
            currency,
            account_number,
            agency_number,
            transfer_number,
            credit_limit,
            available_credit_limit,
            balance_close_date,
            balance_due_date,
            minimum_payment,
            card_brand,
            updated_at
        )
        VALUES (
            p_family_member_id,
            v_effective_user_id,
            p_item_id,
            p_pluggy_account_id,
            v_inst_name,
            v_inst_name,
            p_institution_slug,
            v_prod_name,
            p_type,
            p_subtype,
            p_balance,
            COALESCE(p_currency, 'BRL'),
            p_account_number,
            p_agency_number,
            p_transfer_number,
            p_credit_limit,
            p_available_credit_limit,
            p_balance_close_date,
            p_balance_due_date,
            p_minimum_payment,
            p_card_brand,
            now()
        )
        RETURNING id INTO v_account_id;
    END IF;

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
    p_date DATE DEFAULT CURRENT_DATE,
    p_clean_description TEXT DEFAULT NULL,
    p_raw_description TEXT DEFAULT NULL,
    p_category_pt TEXT DEFAULT NULL,
    p_category_original TEXT DEFAULT NULL,
    p_operation_type TEXT DEFAULT NULL,
    p_is_internal_transfer BOOLEAN DEFAULT false,
    p_is_refund BOOLEAN DEFAULT false,
    p_is_subscription BOOLEAN DEFAULT false,
    p_installment_number INT DEFAULT NULL,
    p_total_installments INT DEFAULT NULL,
    p_total_purchase_amount NUMERIC DEFAULT NULL,
    p_merchant_name TEXT DEFAULT NULL,
    p_merchant_business_name TEXT DEFAULT NULL,
    p_merchant_cnpj TEXT DEFAULT NULL,
    p_payer_name TEXT DEFAULT NULL,
    p_receiver_name TEXT DEFAULT NULL,
    p_payment_reason TEXT DEFAULT NULL,
    p_bill_id TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT NULL
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
        clean_description,
        raw_description,
        amount,
        type,
        category,
        category_pt,
        category_original,
        operation_type,
        is_internal_transfer,
        is_refund,
        is_subscription,
        installment_number,
        total_installments,
        total_purchase_amount,
        merchant_name,
        merchant_business_name,
        merchant_cnpj,
        payer_name,
        receiver_name,
        payment_reason,
        bill_id,
        raw_payload,
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
        COALESCE(p_clean_description, p_description, 'Transação'),
        COALESCE(p_clean_description, p_description, 'Transação'),
        COALESCE(p_raw_description, p_description),
        p_amount,
        p_type,
        COALESCE(p_category_pt, p_category, 'Outros'),
        COALESCE(p_category_pt, p_category, 'Outros'),
        p_category_original,
        p_operation_type,
        COALESCE(p_is_internal_transfer, false),
        COALESCE(p_is_refund, false),
        COALESCE(p_is_subscription, false),
        p_installment_number,
        p_total_installments,
        p_total_purchase_amount,
        p_merchant_name,
        p_merchant_business_name,
        p_merchant_cnpj,
        p_payer_name,
        p_receiver_name,
        p_payment_reason,
        p_bill_id,
        p_raw_payload,
        p_executed_at,
        p_date,
        now()
    )
    ON CONFLICT (pluggy_transaction_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        description = EXCLUDED.description,
        clean_description = EXCLUDED.clean_description,
        raw_description = EXCLUDED.raw_description,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        category = EXCLUDED.category,
        category_pt = EXCLUDED.category_pt,
        category_original = EXCLUDED.category_original,
        operation_type = EXCLUDED.operation_type,
        is_internal_transfer = EXCLUDED.is_internal_transfer,
        is_refund = EXCLUDED.is_refund,
        is_subscription = EXCLUDED.is_subscription,
        installment_number = EXCLUDED.installment_number,
        total_installments = EXCLUDED.total_installments,
        total_purchase_amount = EXCLUDED.total_purchase_amount,
        merchant_name = EXCLUDED.merchant_name,
        merchant_business_name = EXCLUDED.merchant_business_name,
        merchant_cnpj = EXCLUDED.merchant_cnpj,
        payer_name = EXCLUDED.payer_name,
        receiver_name = EXCLUDED.receiver_name,
        payment_reason = EXCLUDED.payment_reason,
        bill_id = EXCLUDED.bill_id,
        raw_payload = EXCLUDED.raw_payload,
        executed_at = EXCLUDED.executed_at,
        date = EXCLUDED.date,
        updated_at = now()
    WHERE public.transactions.user_id = v_effective_user_id
    RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_pluggy_investment(
    p_user_id UUID,
    p_connection_id UUID,
    p_item_id TEXT,
    p_pluggy_investment_id TEXT,
    p_name TEXT,
    p_type TEXT,
    p_subtype TEXT DEFAULT NULL,
    p_balance NUMERIC DEFAULT 0,
    p_currency TEXT DEFAULT 'BRL',
    p_institution_name TEXT DEFAULT NULL,
    p_institution_slug TEXT DEFAULT NULL,
    p_issuer TEXT DEFAULT NULL,
    p_rate NUMERIC DEFAULT NULL,
    p_rate_type TEXT DEFAULT NULL,
    p_annual_rate NUMERIC DEFAULT NULL,
    p_amount_original NUMERIC DEFAULT NULL,
    p_amount_profit NUMERIC DEFAULT NULL,
    p_taxes NUMERIC DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_issue_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT 'ACTIVE',
    p_raw_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv_id UUID;
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);
    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    INSERT INTO public.investments (
        user_id, connection_id, item_id, pluggy_investment_id, name, type, subtype,
        balance, currency, institution_name, institution_slug, issuer, rate, rate_type,
        annual_rate, amount_original, amount_profit, taxes, due_date, issue_date, status,
        raw_payload, updated_at
    )
    VALUES (
        v_effective_user_id, p_connection_id, p_item_id, p_pluggy_investment_id, p_name, p_type, p_subtype,
        p_balance, COALESCE(p_currency, 'BRL'), p_institution_name, p_institution_slug, p_issuer, p_rate, p_rate_type,
        p_annual_rate, p_amount_original, p_amount_profit, p_taxes, p_due_date, p_issue_date, COALESCE(p_status, 'ACTIVE'),
        p_raw_payload, now()
    )
    ON CONFLICT (pluggy_investment_id) DO UPDATE SET
        connection_id = COALESCE(EXCLUDED.connection_id, public.investments.connection_id),
        item_id = EXCLUDED.item_id,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        subtype = EXCLUDED.subtype,
        balance = EXCLUDED.balance,
        institution_name = EXCLUDED.institution_name,
        institution_slug = EXCLUDED.institution_slug,
        issuer = EXCLUDED.issuer,
        rate = EXCLUDED.rate,
        rate_type = EXCLUDED.rate_type,
        annual_rate = EXCLUDED.annual_rate,
        amount_original = EXCLUDED.amount_original,
        amount_profit = EXCLUDED.amount_profit,
        taxes = EXCLUDED.taxes,
        due_date = EXCLUDED.due_date,
        issue_date = EXCLUDED.issue_date,
        status = EXCLUDED.status,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = now()
    WHERE public.investments.user_id = v_effective_user_id
    RETURNING id INTO v_inv_id;

    RETURN v_inv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_pluggy_loan(
    p_user_id UUID,
    p_connection_id UUID,
    p_item_id TEXT,
    p_pluggy_loan_id TEXT,
    p_product_name TEXT,
    p_type TEXT DEFAULT NULL,
    p_institution_name TEXT DEFAULT NULL,
    p_institution_slug TEXT DEFAULT NULL,
    p_contracted_amount NUMERIC DEFAULT 0,
    p_outstanding_balance NUMERIC DEFAULT 0,
    p_paid_installments INT DEFAULT NULL,
    p_total_installments INT DEFAULT NULL,
    p_interest_rate NUMERIC DEFAULT NULL,
    p_currency TEXT DEFAULT 'BRL',
    p_contract_date DATE DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_raw_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loan_id UUID;
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);
    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    INSERT INTO public.loans (
        user_id, connection_id, item_id, pluggy_loan_id, product_name, type,
        institution_name, institution_slug, contracted_amount, outstanding_balance,
        paid_installments, total_installments, interest_rate, currency,
        contract_date, due_date, raw_payload, updated_at
    )
    VALUES (
        v_effective_user_id, p_connection_id, p_item_id, p_pluggy_loan_id, p_product_name, p_type,
        p_institution_name, p_institution_slug, p_contracted_amount, p_outstanding_balance,
        p_paid_installments, p_total_installments, p_interest_rate, COALESCE(p_currency, 'BRL'),
        p_contract_date, p_due_date, p_raw_payload, now()
    )
    ON CONFLICT (pluggy_loan_id) DO UPDATE SET
        connection_id = COALESCE(EXCLUDED.connection_id, public.loans.connection_id),
        item_id = EXCLUDED.item_id,
        product_name = EXCLUDED.product_name,
        type = EXCLUDED.type,
        institution_name = EXCLUDED.institution_name,
        institution_slug = EXCLUDED.institution_slug,
        contracted_amount = EXCLUDED.contracted_amount,
        outstanding_balance = EXCLUDED.outstanding_balance,
        paid_installments = EXCLUDED.paid_installments,
        total_installments = EXCLUDED.total_installments,
        interest_rate = EXCLUDED.interest_rate,
        contract_date = EXCLUDED.contract_date,
        due_date = EXCLUDED.due_date,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = now()
    WHERE public.loans.user_id = v_effective_user_id
    RETURNING id INTO v_loan_id;

    RETURN v_loan_id;
END;
$$;
