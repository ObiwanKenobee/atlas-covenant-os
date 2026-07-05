
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  life_mission TEXT,
  mission_values TEXT[] DEFAULT '{}',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reflection prompts / journal
CREATE TABLE public.reflection_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  module TEXT NOT NULL DEFAULT 'guide',
  prompt TEXT NOT NULL,
  reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflection_prompts TO authenticated;
GRANT ALL ON public.reflection_prompts TO service_role;
ALTER TABLE public.reflection_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reflection own" ON public.reflection_prompts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Ledger metrics
CREATE TABLE public.ledger_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  module TEXT NOT NULL,
  kind TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_user_module_idx ON public.ledger_metrics(user_id, module);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_metrics TO authenticated;
GRANT ALL ON public.ledger_metrics TO service_role;
ALTER TABLE public.ledger_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger own" ON public.ledger_metrics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Philanthropic causes
CREATE TABLE public.philanthropic_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  module TEXT NOT NULL,
  match_ratio NUMERIC NOT NULL DEFAULT 1.0,
  expected_impact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.philanthropic_causes TO authenticated;
GRANT ALL ON public.philanthropic_causes TO service_role;
ALTER TABLE public.philanthropic_causes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "causes readable" ON public.philanthropic_causes FOR SELECT TO authenticated USING (true);

-- Missions
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  module TEXT NOT NULL,
  funding_goal_cents INTEGER NOT NULL DEFAULT 0,
  funding_current_cents INTEGER NOT NULL DEFAULT 0,
  quorum INTEGER NOT NULL DEFAULT 5,
  approve_count INTEGER NOT NULL DEFAULT 0,
  reject_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions readable" ON public.missions FOR SELECT TO authenticated USING (true);
CREATE POLICY "missions insert own" ON public.missions FOR INSERT TO authenticated WITH CHECK (auth.uid() = proposer_id);
CREATE POLICY "missions update own" ON public.missions FOR UPDATE TO authenticated USING (auth.uid() = proposer_id) WITH CHECK (auth.uid() = proposer_id);

-- Mission votes
CREATE TABLE public.mission_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('approve','reject')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mission_id, voter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_votes TO authenticated;
GRANT ALL ON public.mission_votes TO service_role;
ALTER TABLE public.mission_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes readable" ON public.mission_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes insert own" ON public.mission_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "votes update own" ON public.mission_votes FOR UPDATE TO authenticated USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

-- Governance: tally + status update
CREATE OR REPLACE FUNCTION public.recalc_mission_governance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.missions%ROWTYPE;
  approve_n INTEGER;
  reject_n INTEGER;
  total_n INTEGER;
  target_mission UUID;
BEGIN
  target_mission := COALESCE(NEW.mission_id, OLD.mission_id);
  SELECT * INTO m FROM public.missions WHERE id = target_mission;
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COUNT(*) FILTER (WHERE vote='approve'),
         COUNT(*) FILTER (WHERE vote='reject'),
         COUNT(*)
    INTO approve_n, reject_n, total_n
    FROM public.mission_votes WHERE mission_id = target_mission;

  UPDATE public.missions
     SET approve_count = approve_n,
         reject_count = reject_n,
         status = CASE
           WHEN m.status IN ('approved','rejected','closed') THEN m.status
           WHEN total_n >= m.quorum AND approve_n > reject_n THEN 'approved'
           WHEN total_n >= m.quorum AND reject_n >= approve_n THEN 'rejected'
           ELSE 'open'
         END
   WHERE id = target_mission;

  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER mission_votes_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.mission_votes
  FOR EACH ROW EXECUTE FUNCTION public.recalc_mission_governance();

-- Mission contributions
CREATE TABLE public.mission_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  cause_id UUID REFERENCES public.philanthropic_causes ON DELETE SET NULL,
  matched_amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_contributions TO authenticated;
GRANT ALL ON public.mission_contributions TO service_role;
ALTER TABLE public.mission_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contribs readable" ON public.mission_contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "contribs insert own" ON public.mission_contributions FOR INSERT TO authenticated WITH CHECK (auth.uid() = contributor_id);

-- Update mission funding total on contribution
CREATE OR REPLACE FUNCTION public.update_mission_funding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.missions
     SET funding_current_cents = funding_current_cents + NEW.amount_cents + NEW.matched_amount_cents
   WHERE id = NEW.mission_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER contribs_update_funding
  AFTER INSERT ON public.mission_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_mission_funding();
