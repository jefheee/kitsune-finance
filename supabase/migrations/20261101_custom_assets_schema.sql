-- Migration: Custom & Physical Assets Schema (Vehicles FIPE, Land & Real Estate Models A/B/C, FGTS & Alternatives)
-- Date: 2026-11-01
-- Multi-Tenant with strict Row-Level Security (FORCE RLS)

-- ============================================================================
-- 1. Criação da Tabela public.custom_assets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.custom_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('vehicle', 'real_estate', 'land', 'fgts', 'other')),
    name text NOT NULL,
    acquisition_date date NULL,
    acquisition_value numeric(15, 2) NOT NULL DEFAULT 0.00,
    current_value numeric(15, 2) NOT NULL DEFAULT 0.00,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comentários descritivos de governança de dados
COMMENT ON TABLE public.custom_assets IS 'Ativos físicos, patrimônio imobilizado e contas especiais (Veículos FIPE, Terrenos/Imóveis, FGTS e Ativos Alternativos)';
COMMENT ON COLUMN public.custom_assets.category IS 'Categoria do ativo: vehicle (FIPE), real_estate, land, fgts (Caixa) ou other';
COMMENT ON COLUMN public.custom_assets.metadata IS 'Metadados flexíveis: fipe_code, ano_modelo, placa, area_m2, cep, coordenadas, radar_score, indice_correcao, etc.';

-- ============================================================================
-- 2. Índices Otimizados de Consulta
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_custom_assets_user_category
    ON public.custom_assets(user_id, category);

CREATE INDEX IF NOT EXISTS idx_custom_assets_user_updated
    ON public.custom_assets(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_assets_metadata_gin
    ON public.custom_assets USING gin(metadata);

-- ============================================================================
-- 3. Trigger para Atualização Automática de updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_custom_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_assets_updated_at ON public.custom_assets;

CREATE TRIGGER trg_custom_assets_updated_at
    BEFORE UPDATE ON public.custom_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_custom_assets_updated_at();

-- ============================================================================
-- 4. Isolamento Multi-Tenant & RLS Estrito (Force RLS)
-- ============================================================================
ALTER TABLE public.custom_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_assets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own custom assets" ON public.custom_assets;

CREATE POLICY "Users can only access their own custom assets"
    ON public.custom_assets FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Revoga explicitamente permissões anônimas públicas
REVOKE ALL ON public.custom_assets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_assets TO authenticated;
