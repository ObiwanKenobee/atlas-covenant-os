
-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'steward', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles readable self" ON public.user_roles;
CREATE POLICY "roles readable self" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Admin policies for philanthropic causes
DROP POLICY IF EXISTS "causes admin insert" ON public.philanthropic_causes;
CREATE POLICY "causes admin insert" ON public.philanthropic_causes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "causes admin update" ON public.philanthropic_causes;
CREATE POLICY "causes admin update" ON public.philanthropic_causes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "causes admin delete" ON public.philanthropic_causes;
CREATE POLICY "causes admin delete" ON public.philanthropic_causes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admins may update quorum on any mission
DROP POLICY IF EXISTS "missions admin update" ON public.missions;
CREATE POLICY "missions admin update" ON public.missions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Governance settings (single row)
CREATE TABLE IF NOT EXISTS public.governance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_quorum integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.governance_settings TO authenticated;
GRANT ALL ON public.governance_settings TO service_role;
ALTER TABLE public.governance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gov readable" ON public.governance_settings;
CREATE POLICY "gov readable" ON public.governance_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gov admin insert" ON public.governance_settings;
CREATE POLICY "gov admin insert" ON public.governance_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "gov admin update" ON public.governance_settings;
CREATE POLICY "gov admin update" ON public.governance_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.governance_settings (default_quorum)
SELECT 5 WHERE NOT EXISTS (SELECT 1 FROM public.governance_settings);
