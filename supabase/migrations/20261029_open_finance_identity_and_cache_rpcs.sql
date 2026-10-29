-- Migration: RPCs for Consolidated Open Finance Identity and AI Cache Invalidation
-- Date: 2026-10-29

CREATE OR REPLACE FUNCTION public.upsert_user_consolidated_identity(
    p_user_id UUID,
    p_full_name TEXT DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_document_mask TEXT DEFAULT NULL,
    p_job_title TEXT DEFAULT NULL,
    p_emails JSONB DEFAULT '[]'::jsonb,
    p_phones JSONB DEFAULT '[]'::jsonb,
    p_addresses JSONB DEFAULT '[]'::jsonb,
    p_bank_sources JSONB DEFAULT '[]'::jsonb,
    p_consolidated_identity JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id is required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    -- Se chamado via webhook (auth.uid() IS NULL), garante que o usuário possui conexões registradas
    IF auth.uid() IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.pluggy_connections pc WHERE pc.user_id = v_effective_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: user has no verified connections';
    END IF;

    INSERT INTO public.users_profile (
        id,
        full_name,
        birth_date,
        document_mask,
        job_title,
        emails,
        phones,
        addresses,
        bank_sources,
        consolidated_identity,
        updated_at
    )
    VALUES (
        v_effective_user_id,
        p_full_name,
        p_birth_date,
        p_document_mask,
        p_job_title,
        COALESCE(p_emails, '[]'::jsonb),
        COALESCE(p_phones, '[]'::jsonb),
        COALESCE(p_addresses, '[]'::jsonb),
        COALESCE(p_bank_sources, '[]'::jsonb),
        COALESCE(p_consolidated_identity, '{}'::jsonb),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.users_profile.full_name),
        birth_date = COALESCE(EXCLUDED.birth_date, public.users_profile.birth_date),
        document_mask = COALESCE(NULLIF(EXCLUDED.document_mask, ''), public.users_profile.document_mask),
        job_title = COALESCE(NULLIF(EXCLUDED.job_title, ''), public.users_profile.job_title),
        emails = CASE WHEN jsonb_array_length(COALESCE(EXCLUDED.emails, '[]'::jsonb)) > 0 THEN EXCLUDED.emails ELSE public.users_profile.emails END,
        phones = CASE WHEN jsonb_array_length(COALESCE(EXCLUDED.phones, '[]'::jsonb)) > 0 THEN EXCLUDED.phones ELSE public.users_profile.phones END,
        addresses = CASE WHEN jsonb_array_length(COALESCE(EXCLUDED.addresses, '[]'::jsonb)) > 0 THEN EXCLUDED.addresses ELSE public.users_profile.addresses END,
        bank_sources = CASE WHEN jsonb_array_length(COALESCE(EXCLUDED.bank_sources, '[]'::jsonb)) > 0 THEN EXCLUDED.bank_sources ELSE public.users_profile.bank_sources END,
        consolidated_identity = COALESCE(EXCLUDED.consolidated_identity, public.users_profile.consolidated_identity),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_user_ai_caches(
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user_id is required';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    -- Limpa o system_prompt_cached das sessões de chat para que a próxima mensagem reconstrua o dossiê atualizado
    UPDATE public.ai_chat_sessions
    SET system_prompt_cached = NULL,
        context_snapshot = NULL,
        updated_at = now()
    WHERE user_id = v_effective_user_id;

    -- Remove insights antigos para regeneração com os novos dados sincronizados
    DELETE FROM public.ai_insights
    WHERE user_id = v_effective_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_pluggy_connections_for_sync(
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    item_id TEXT,
    provider_name TEXT,
    institution_name TEXT,
    institution_slug TEXT,
    raw_identity JSONB,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_user_id UUID;
BEGIN
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: session user_id mismatch';
    END IF;

    RETURN QUERY
    SELECT
        pc.id,
        pc.item_id,
        pc.provider_name,
        pc.institution_name,
        pc.institution_slug,
        pc.raw_identity,
        pc.updated_at
    FROM public.pluggy_connections pc
    WHERE pc.user_id = v_effective_user_id
    ORDER BY pc.updated_at DESC;
END;
$$;
