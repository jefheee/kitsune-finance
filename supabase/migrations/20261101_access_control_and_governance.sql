-- Migration: Access Control, Whitelist and System Governance
-- Description: Cria tabela de membros autorizados e logs de governança

CREATE TABLE IF NOT EXISTS public.allowed_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ativar FORCE RLS
ALTER TABLE public.allowed_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_members FORCE ROW LEVEL SECURITY;

-- Popula os membros pré-autorizados
INSERT INTO public.allowed_members (email, role, status, notes, created_by)
VALUES 
    ('jnnebu@gmail.com', 'owner', 'active', 'Master Owner & Administrador Supremo', 'system_bootstrap'),
    ('fabianadecastro3@gmail.com', 'member', 'active', 'Membro Autorizado', 'jnnebu@gmail.com'),
    ('jacsonph79@gmail.com', 'member', 'active', 'Membro Autorizado', 'jnnebu@gmail.com')
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- Função auxiliar segura para checar se o usuário atual é Master Owner ou Admin
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.allowed_members am
        JOIN auth.users u ON lower(u.email) = lower(am.email)
        WHERE u.id = auth.uid()
          AND am.role IN ('owner', 'admin')
          AND am.status = 'active'
    );
$$;

-- Função auxiliar para checar se qualquer e-mail está na lista de autorizados
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.allowed_members
        WHERE lower(email) = lower(trim(check_email))
          AND status = 'active'
    );
$$;

-- Políticas de RLS para allowed_members
DROP POLICY IF EXISTS "allowed_members_select" ON public.allowed_members;
CREATE POLICY "allowed_members_select"
ON public.allowed_members
FOR SELECT
TO authenticated
USING (
    public.is_app_admin() OR lower(email) = lower(auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "allowed_members_insert" ON public.allowed_members;
CREATE POLICY "allowed_members_insert"
ON public.allowed_members
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_app_admin()
);

DROP POLICY IF EXISTS "allowed_members_update" ON public.allowed_members;
CREATE POLICY "allowed_members_update"
ON public.allowed_members
FOR UPDATE
TO authenticated
USING (
    public.is_app_admin()
)
WITH CHECK (
    public.is_app_admin()
);

DROP POLICY IF EXISTS "allowed_members_delete" ON public.allowed_members;
CREATE POLICY "allowed_members_delete"
ON public.allowed_members
FOR DELETE
TO authenticated
USING (
    public.is_app_admin() AND role <> 'owner'
);

