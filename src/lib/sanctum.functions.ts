import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// ---------- Profile ----------

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const ProfileInput = z.object({
  display_name: z.string().min(1).max(80),
  life_mission: z.string().min(10).max(2000),
  mission_values: z.array(z.string().min(1).max(60)).max(8),
});

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      display_name: data.display_name,
      life_mission: data.life_mission,
      mission_values: data.mission_values,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Reflection prompts / journal ----------

export const listReflections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reflection_prompts")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data;
  });

export const generateReflectionPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name,life_mission,mission_values")
      .eq("id", context.userId)
      .maybeSingle();

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are the Atlas Guide, a companion for human flourishing inside Atlas Sanctum. You do not chase attention — you cultivate wisdom.
Offer ONE short ethical reflection prompt (2–3 sentences) for the member to journal on today. Draw quietly from stewardship, community, ecology, learning, arts, or health. Never preach. Never mention that you are an AI. Return only the prompt, no preface.`;

    const user = profile?.life_mission
      ? `Member: ${profile.display_name ?? "friend"}. Life mission: "${profile.life_mission}". Values: ${(profile.mission_values ?? []).join(", ") || "unspoken"}.`
      : `Member: a new steward without a stated mission yet. Offer a foundational prompt.`;

    try {
      const { text } = await generateText({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const prompt = text.trim().replace(/^["']|["']$/g, "");

      const { data, error } = await context.supabase
        .from("reflection_prompts")
        .insert({ user_id: context.userId, prompt, module: "guide" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Guide unavailable";
      throw new Error(message);
    }
  });

const ReflectionInput = z.object({
  id: z.string().uuid(),
  reflection: z.string().min(1).max(4000),
});

export const saveReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReflectionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reflection_prompts")
      .update({ reflection: data.reflection })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    // Log a small ledger entry for reflection.
    await context.supabase.from("ledger_metrics").insert({
      user_id: context.userId,
      module: "learning",
      kind: "reflection",
      value: 1,
      note: "Journal reflection",
    });
    return { ok: true };
  });

// ---------- Living Ledger ----------

export const listMyLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ledger_metrics")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  });

const LedgerInput = z.object({
  module: z.enum(["learning", "commons", "earth", "arts", "sports", "health"]),
  kind: z.string().min(1).max(60),
  value: z.number().min(0).max(10000),
  note: z.string().max(300).optional(),
});

export const addLedgerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LedgerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ledger_metrics").insert({
      user_id: context.userId,
      module: data.module,
      kind: data.kind,
      value: data.value,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Missions ----------

export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("missions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  });

export const getMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [mission, votes, contribs, causes] = await Promise.all([
      context.supabase.from("missions").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("mission_votes").select("*").eq("mission_id", data.id),
      context.supabase
        .from("mission_contributions")
        .select("*, philanthropic_causes(name,module,match_ratio)")
        .eq("mission_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase.from("philanthropic_causes").select("*"),
    ]);
    if (mission.error) throw new Error(mission.error.message);
    if (!mission.data) throw new Error("Mission not found");

    const myVote = (votes.data ?? []).find((v) => v.voter_id === context.userId) ?? null;
    const matches = (causes.data ?? [])
      .filter((c) => c.module === mission.data!.module || c.module === "commons")
      .sort((a, b) => Number(b.match_ratio) - Number(a.match_ratio));

    return {
      mission: mission.data,
      votes: votes.data ?? [],
      myVote,
      contributions: contribs.data ?? [],
      matchingCauses: matches,
      allCauses: causes.data ?? [],
    };
  });

const CreateMissionInput = z.object({
  title: z.string().min(4).max(120),
  summary: z.string().min(20).max(2000),
  module: z.enum(["learning", "commons", "earth", "arts", "sports", "health"]),
  funding_goal_cents: z.number().int().min(0).max(100_000_000),
  quorum: z.number().int().min(1).max(200),
});

export const createMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateMissionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("missions")
      .insert({
        proposer_id: context.userId,
        title: data.title,
        summary: data.summary,
        module: data.module,
        funding_goal_cents: data.funding_goal_cents,
        quorum: data.quorum,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const VoteInput = z.object({
  mission_id: z.string().uuid(),
  vote: z.enum(["approve", "reject"]),
});

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VoteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mission_votes")
      .upsert(
        {
          mission_id: data.mission_id,
          voter_id: context.userId,
          vote: data.vote,
        },
        { onConflict: "mission_id,voter_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ContributeInput = z.object({
  mission_id: z.string().uuid(),
  amount_cents: z.number().int().min(100).max(100_000_000),
  cause_id: z.string().uuid().nullable(),
});

export const contribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ContributeInput.parse(input))
  .handler(async ({ data, context }) => {
    let matched = 0;
    if (data.cause_id) {
      const { data: cause } = await context.supabase
        .from("philanthropic_causes")
        .select("match_ratio")
        .eq("id", data.cause_id)
        .maybeSingle();
      if (cause) {
        matched = Math.round(data.amount_cents * Number(cause.match_ratio));
      }
    }

    const { error } = await context.supabase.from("mission_contributions").insert({
      mission_id: data.mission_id,
      contributor_id: context.userId,
      amount_cents: data.amount_cents,
      cause_id: data.cause_id,
      matched_amount_cents: matched,
    });
    if (error) throw new Error(error.message);

    // Log ledger for the contribution.
    const { data: mission } = await context.supabase
      .from("missions")
      .select("module")
      .eq("id", data.mission_id)
      .maybeSingle();
    if (mission) {
      await context.supabase.from("ledger_metrics").insert({
        user_id: context.userId,
        module: mission.module,
        kind: "contribution",
        value: data.amount_cents / 100,
        note: "Mission contribution",
      });
    }
    return { ok: true, matched_amount_cents: matched };
  });

export const listCauses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("philanthropic_causes")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Admin ----------

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

const CauseInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  description: z.string().min(4).max(2000),
  module: z.enum(["learning", "commons", "earth", "arts", "sports", "health"]),
  match_ratio: z.number().min(0).max(10),
  expected_impact: z.string().max(500).nullable().optional(),
});

export const upsertCause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CauseInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      description: data.description,
      module: data.module,
      match_ratio: data.match_ratio,
      expected_impact: data.expected_impact ?? null,
    };
    const q = data.id
      ? context.supabase.from("philanthropic_causes").update(payload).eq("id", data.id)
      : context.supabase.from("philanthropic_causes").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("philanthropic_causes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGovernanceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("governance_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateGovernanceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), default_quorum: z.number().int().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("governance_settings")
      .update({ default_quorum: data.default_quorum, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Reflection detail ----------

export const getReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: reflection, error } = await context.supabase
      .from("reflection_prompts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reflection) throw new Error("Reflection not found");

    // Ledger entries created around the reflection save (± 2 minutes) count as linked.
    const created = new Date(reflection.updated_at ?? reflection.created_at);
    const start = new Date(created.getTime() - 2 * 60 * 1000).toISOString();
    const end = new Date(created.getTime() + 2 * 60 * 1000).toISOString();
    const { data: ledger } = await context.supabase
      .from("ledger_metrics")
      .select("*")
      .eq("user_id", context.userId)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });

    return { reflection, ledger: ledger ?? [] };
  });

// ---------- Notifications ----------

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const q = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    const { error } = data.ids && data.ids.length ? await q.in("id", data.ids) : await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin invitations ----------

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listAdminInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_invitations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAdminInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email().max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const token =
      globalThis.crypto?.randomUUID?.().replaceAll("-", "") +
      Math.random().toString(36).slice(2, 10);
    const { data: row, error } = await context.supabase
      .from("admin_invitations")
      .insert({
        email: data.email.toLowerCase(),
        token,
        invited_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeAdminInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("admin_invitations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptAdminInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("accept_admin_invitation", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.ok) throw new Error(row?.message ?? "Could not accept invitation");
    return { ok: true, message: row.message };
  });

export const updateMissionQuorum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), quorum: z.number().int().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("missions")
      .update({ quorum: data.quorum })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

