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
