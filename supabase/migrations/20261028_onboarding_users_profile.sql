-- Migration: Onboarding & Profile Fields on users_profile
-- Date: 2026-10-28

ALTER TABLE public.users_profile
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS financial_goal TEXT,
    ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Ensure all existing auth.users have a corresponding users_profile row
INSERT INTO public.users_profile (id, full_name, display_name, avatar_url, onboarding_completed)
SELECT
    u.id,
    u.raw_user_meta_data->>'full_name',
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.raw_user_meta_data->>'avatar_url',
    false
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.users_profile up WHERE up.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Update trigger function for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (
    id,
    full_name,
    display_name,
    avatar_url,
    onboarding_completed
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
