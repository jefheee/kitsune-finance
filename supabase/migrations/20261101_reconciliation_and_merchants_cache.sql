-- Migration: Open Finance v2 Reconciliation Pipeline (Maybe Finance pattern) & Global Merchant Cache (BrasilAPI CNPJ/CNAE)
-- Date: 2026-11-01

-- ============================================================================
-- 1. Evolução da tabela public.transactions
-- ============================================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS matched_transfer_id uuid NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled_from_pending_id text NULL,
  ADD COLUMN IF NOT EXISTS merchant_cnpj text NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'POSTED';

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_kind_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_kind_check
  CHECK (kind IN ('standard', 'funds_movement', 'cc_payment', 'loan_payment', 'one_time'));

-- Backfill determinístico de transações históricas já sincronizadas
UPDATE public.transactions
SET kind = CASE
  WHEN operation_type = 'BILL_PAYMENT'
    OR category_pt = 'Pagamento de Fatura'
    OR raw_description ILIKE '%pagamento de fatura%'
    OR raw_description ILIKE '%pagto fatura%'
    OR raw_description ILIKE '%fatura cart%'
    OR clean_description ILIKE '%pagamento de fatura%'
    THEN 'cc_payment'
  WHEN is_internal_transfer = true
    OR operation_type = 'INTERNAL_TRANSFER'
    OR raw_description ILIKE '%aplicacao rdb%'
    OR raw_description ILIKE '%aplicação rdb%'
    OR raw_description ILIKE '%resgate rdb%'
    OR raw_description ILIKE '%aplicacao cdb%'
    OR raw_description ILIKE '%aplicação cdb%'
    OR raw_description ILIKE '%resgate cdb%'
    OR raw_description ILIKE '%guardar dinheiro%'
    THEN 'funds_movement'
  WHEN category_pt IN ('Empréstimos e Financiamentos', 'Financiamentos')
    OR raw_description ILIKE '%parcela emprestimo%'
    OR raw_description ILIKE '%parcela empréstimo%'
    OR raw_description ILIKE '%parcela financiamento%'
    THEN 'loan_payment'
  ELSE 'standard'
END
WHERE kind = 'standard';

-- Índices otimizados para reconciliação, curvas históricas e filtragem operacional
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_kind
  ON public.transactions(user_id, kind);

CREATE INDEX IF NOT EXISTS idx_transactions_user_internal_transfer
  ON public.transactions(user_id, is_internal_transfer);

CREATE INDEX IF NOT EXISTS idx_transactions_matched_transfer_id
  ON public.transactions(matched_transfer_id)
  WHERE matched_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account_status
  ON public.transactions(account_id, status);

-- ============================================================================
-- 2. Tabela de Cache Global de Estabelecimentos (public.known_merchants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.known_merchants (
  cnpj text PRIMARY KEY,
  razao_social text,
  nome_fantasia text,
  cnae_fiscal integer,
  cnae_descricao text,
  mapped_category_pt text NOT NULL,
  clean_brand_name text NOT NULL,
  simple_icon_slug text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_known_merchants_cnae_fiscal
  ON public.known_merchants(cnae_fiscal);

ALTER TABLE public.known_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.known_merchants FORCE ROW LEVEL SECURITY;

-- Revoga qualquer permissão do role anônimo e concede SELECT/INSERT/UPDATE apenas para authenticated
REVOKE ALL ON TABLE public.known_merchants FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.known_merchants TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can select known_merchants" ON public.known_merchants;
CREATE POLICY "Authenticated users can select known_merchants"
  ON public.known_merchants
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert known_merchants" ON public.known_merchants;
CREATE POLICY "Authenticated users can insert known_merchants"
  ON public.known_merchants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update known_merchants" ON public.known_merchants;
CREATE POLICY "Authenticated users can update known_merchants"
  ON public.known_merchants
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. RPCs Seguras para Sync v2 (Reconciliação In-Place & Pareamento 72h)
-- ============================================================================
DROP FUNCTION IF EXISTS public.upsert_pluggy_transaction(
  uuid, uuid, uuid, text, text, text, numeric, text, text, timestamptz, date,
  text, text, text, text, text, boolean, boolean, boolean, integer, integer, numeric,
  text, text, text, text, text, text, text, jsonb
);

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
    p_raw_payload JSONB DEFAULT NULL,
    p_kind TEXT DEFAULT 'standard',
    p_matched_transfer_id UUID DEFAULT NULL,
    p_reconciled_from_pending_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'POSTED'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx_id UUID;
    v_effective_user_id UUID;
    v_safe_kind TEXT;
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

    v_safe_kind := CASE
        WHEN p_kind IN ('standard', 'funds_movement', 'cc_payment', 'loan_payment', 'one_time') THEN p_kind
        ELSE 'standard'
    END;

    -- Reconciliação In-Place: se esta transação POSTED reconciliou uma PENDING anterior com ID distinto,
    -- atualiza o registro existente sem gerar duplicata no extrato.
    IF p_reconciled_from_pending_id IS NOT NULL AND p_reconciled_from_pending_id <> p_pluggy_tx_id THEN
        UPDATE public.transactions
        SET pluggy_transaction_id = p_pluggy_tx_id,
            idempotency_hash = p_idempotency_hash,
            description = COALESCE(p_clean_description, p_description, 'Transação'),
            clean_description = COALESCE(p_clean_description, p_description, 'Transação'),
            raw_description = COALESCE(p_raw_description, p_description),
            amount = p_amount,
            type = p_type,
            category = COALESCE(p_category_pt, p_category, 'Outros'),
            category_pt = COALESCE(p_category_pt, p_category, 'Outros'),
            category_original = p_category_original,
            operation_type = p_operation_type,
            is_internal_transfer = COALESCE(p_is_internal_transfer, false),
            is_refund = COALESCE(p_is_refund, false),
            is_subscription = COALESCE(p_is_subscription, false),
            installment_number = p_installment_number,
            total_installments = p_total_installments,
            total_purchase_amount = p_total_purchase_amount,
            merchant_name = p_merchant_name,
            merchant_business_name = p_merchant_business_name,
            merchant_cnpj = p_merchant_cnpj,
            payer_name = p_payer_name,
            receiver_name = p_receiver_name,
            payment_reason = p_payment_reason,
            bill_id = p_bill_id,
            raw_payload = p_raw_payload,
            kind = v_safe_kind,
            matched_transfer_id = COALESCE(p_matched_transfer_id, matched_transfer_id),
            reconciled_from_pending_id = p_reconciled_from_pending_id,
            status = COALESCE(p_status, 'POSTED'),
            executed_at = p_executed_at,
            date = p_date,
            updated_at = now()
        WHERE user_id = v_effective_user_id
          AND account_id = p_account_id
          AND pluggy_transaction_id = p_reconciled_from_pending_id
          AND NOT EXISTS (
              SELECT 1 FROM public.transactions t2
              WHERE t2.pluggy_transaction_id = p_pluggy_tx_id
          )
        RETURNING id INTO v_tx_id;

        IF v_tx_id IS NOT NULL THEN
            RETURN v_tx_id;
        END IF;
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
        kind,
        matched_transfer_id,
        reconciled_from_pending_id,
        status,
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
        v_safe_kind,
        p_matched_transfer_id,
        p_reconciled_from_pending_id,
        COALESCE(p_status, 'POSTED'),
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
        is_internal_transfer = EXCLUDED.is_internal_transfer OR public.transactions.is_internal_transfer,
        is_refund = EXCLUDED.is_refund,
        is_subscription = EXCLUDED.is_subscription,
        installment_number = EXCLUDED.installment_number,
        total_installments = EXCLUDED.total_installments,
        total_purchase_amount = EXCLUDED.total_purchase_amount,
        merchant_name = COALESCE(EXCLUDED.merchant_name, public.transactions.merchant_name),
        merchant_business_name = COALESCE(EXCLUDED.merchant_business_name, public.transactions.merchant_business_name),
        merchant_cnpj = COALESCE(EXCLUDED.merchant_cnpj, public.transactions.merchant_cnpj),
        payer_name = COALESCE(EXCLUDED.payer_name, public.transactions.payer_name),
        receiver_name = COALESCE(EXCLUDED.receiver_name, public.transactions.receiver_name),
        payment_reason = COALESCE(EXCLUDED.payment_reason, public.transactions.payment_reason),
        bill_id = COALESCE(EXCLUDED.bill_id, public.transactions.bill_id),
        raw_payload = COALESCE(EXCLUDED.raw_payload, public.transactions.raw_payload),
        kind = CASE
            WHEN public.transactions.matched_transfer_id IS NOT NULL AND EXCLUDED.kind = 'standard'
                THEN public.transactions.kind
            ELSE EXCLUDED.kind
        END,
        matched_transfer_id = COALESCE(EXCLUDED.matched_transfer_id, public.transactions.matched_transfer_id),
        reconciled_from_pending_id = COALESCE(EXCLUDED.reconciled_from_pending_id, public.transactions.reconciled_from_pending_id),
        status = EXCLUDED.status,
        executed_at = EXCLUDED.executed_at,
        date = EXCLUDED.date,
        updated_at = now()
    WHERE public.transactions.user_id = v_effective_user_id
    RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_matched_internal_transfers(
    p_user_id UUID,
    p_tx_out_id UUID,
    p_tx_in_id UUID,
    p_kind TEXT DEFAULT 'funds_movement'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_user_id UUID;
    v_safe_kind TEXT;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL OR p_tx_out_id IS NULL OR p_tx_in_id IS NULL OR p_tx_out_id = p_tx_in_id THEN
        RAISE EXCEPTION 'Invalid parameters for internal transfer pairing';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    IF auth.uid() IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.pluggy_connections pc WHERE pc.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: unverified webhook user';
    END IF;

    v_safe_kind := CASE
        WHEN p_kind IN ('funds_movement', 'cc_payment') THEN p_kind
        ELSE 'funds_movement'
    END;

    UPDATE public.transactions
    SET matched_transfer_id = p_tx_in_id,
        kind = v_safe_kind,
        is_internal_transfer = true,
        updated_at = now()
    WHERE id = p_tx_out_id AND user_id = v_effective_user_id;

    UPDATE public.transactions
    SET matched_transfer_id = p_tx_out_id,
        kind = v_safe_kind,
        is_internal_transfer = true,
        updated_at = now()
    WHERE id = p_tx_in_id AND user_id = v_effective_user_id;
END;
$$;
