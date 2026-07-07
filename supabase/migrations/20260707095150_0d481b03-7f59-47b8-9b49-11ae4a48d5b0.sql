
-- ============ Notifications ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications read" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);

-- Track which milestones have been announced per mission (idempotent notifications)
CREATE TABLE public.mission_milestones_reached (
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  milestone INT NOT NULL,
  reached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, milestone)
);

GRANT SELECT ON public.mission_milestones_reached TO authenticated;
GRANT ALL ON public.mission_milestones_reached TO service_role;

ALTER TABLE public.mission_milestones_reached ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones readable" ON public.mission_milestones_reached
  FOR SELECT TO authenticated USING (true);

-- Trigger: after a contribution, check for newly-crossed milestones and notify contributors.
CREATE OR REPLACE FUNCTION public.announce_mission_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.missions%ROWTYPE;
  pct NUMERIC;
  ms INT;
  contributor UUID;
BEGIN
  SELECT * INTO m FROM public.missions WHERE id = NEW.mission_id;
  IF NOT FOUND OR m.funding_goal_cents <= 0 THEN
    RETURN NEW;
  END IF;

  pct := (m.funding_current_cents::NUMERIC / m.funding_goal_cents::NUMERIC) * 100;

  FOREACH ms IN ARRAY ARRAY[25, 50, 75, 100] LOOP
    IF pct >= ms THEN
      BEGIN
        INSERT INTO public.mission_milestones_reached(mission_id, milestone)
        VALUES (m.id, ms);

        -- new milestone: notify all distinct contributors + the proposer
        FOR contributor IN
          SELECT DISTINCT contributor_id FROM public.mission_contributions WHERE mission_id = m.id
          UNION
          SELECT m.proposer_id
        LOOP
          INSERT INTO public.notifications(user_id, kind, title, body, link, mission_id)
          VALUES (
            contributor,
            'mission_milestone',
            m.title || ' reached ' || ms || '% funded',
            'Pledged $' || round(m.funding_current_cents / 100.0, 2)
              || ' toward the $' || round(m.funding_goal_cents / 100.0, 2) || ' goal.',
            '/commons/' || m.id::text,
            m.id
          );
        END LOOP;
      EXCEPTION WHEN unique_violation THEN
        -- already announced
        NULL;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_announce_mission_milestones
AFTER INSERT ON public.mission_contributions
FOR EACH ROW EXECUTE FUNCTION public.announce_mission_milestones();

-- ============ Admin Invitations ============
CREATE TABLE public.admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invitations TO authenticated;
GRANT ALL ON public.admin_invitations TO service_role;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins may list/create/revoke invitations.
CREATE POLICY "admins read invites" ON public.admin_invitations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create invites" ON public.admin_invitations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND invited_by = auth.uid());
CREATE POLICY "admins delete invites" ON public.admin_invitations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Function: accept an admin invitation (verifies token, email match, not expired/used)
CREATE OR REPLACE FUNCTION public.accept_admin_invitation(_token TEXT)
RETURNS TABLE (ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.admin_invitations%ROWTYPE;
  my_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'Not signed in'; RETURN;
  END IF;

  SELECT email INTO my_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO inv FROM public.admin_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invitation not found'; RETURN;
  END IF;
  IF inv.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Invitation already used'; RETURN;
  END IF;
  IF inv.expires_at < now() THEN
    RETURN QUERY SELECT false, 'Invitation expired'; RETURN;
  END IF;
  IF lower(inv.email) <> lower(my_email) THEN
    RETURN QUERY SELECT false, 'This invitation was issued to a different email'; RETURN;
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.admin_invitations
     SET used_at = now(), used_by = auth.uid()
   WHERE id = inv.id;

  RETURN QUERY SELECT true, 'Admin access granted';
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(TEXT) TO authenticated;
