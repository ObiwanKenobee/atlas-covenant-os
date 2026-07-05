import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, saveMyProfile } from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const VALUE_SUGGESTIONS = [
  "Stewardship",
  "Wisdom",
  "Regeneration",
  "Craft",
  "Kinship",
  "Beauty",
  "Justice",
  "Wonder",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(saveMyProfile);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const [displayName, setDisplayName] = useState("");
  const [lifeMission, setLifeMission] = useState("");
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setLifeMission(profile.life_mission ?? "");
      setValues(profile.mission_values ?? []);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: (input: { display_name: string; life_mission: string; mission_values: string[] }) =>
      saveProfile({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Your covenant journal is inscribed.");
      navigate({ to: "/sanctum" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const toggle = (v: string) =>
    setValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].slice(0, 8)));

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-copper">I. The Life Mission Journal</span>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">
            Inscribe the mission you carry into the Sanctum.
          </h1>
          <p className="text-sm text-ink/60 max-w-[52ch]">
            The Atlas Guide reads this journal to offer prompts that meet you where you actually stand. Speak honestly.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!displayName.trim() || lifeMission.trim().length < 10) {
              toast.error("A name and a mission of at least a sentence.");
              return;
            }
            save.mutate({
              display_name: displayName.trim(),
              life_mission: lifeMission.trim(),
              mission_values: values,
            });
          }}
          className="space-y-8"
        >
          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-widest text-ink/50">How you are known</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-copper"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-widest text-ink/50">Your life mission</span>
            <textarea
              value={lifeMission}
              onChange={(e) => setLifeMission(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Toward what horizon are you moving your one life?"
              className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-copper resize-none leading-relaxed"
            />
            <span className="block text-[10px] text-ink/40">{lifeMission.length}/2000</span>
          </label>

          <div className="space-y-3">
            <span className="text-[10px] uppercase tracking-widest text-ink/50 block">Values you steward</span>
            <div className="flex flex-wrap gap-2">
              {VALUE_SUGGESTIONS.map((v) => {
                const active = values.includes(v);
                return (
                  <button
                    type="button"
                    key={v}
                    onClick={() => toggle(v)}
                    className={
                      "px-3 py-1.5 rounded-full text-xs border transition-colors " +
                      (active
                        ? "bg-ink text-parchment border-ink"
                        : "border-ink/15 text-ink/60 hover:border-copper hover:text-copper")
                    }
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={save.isPending}
              className="bg-ink text-parchment px-6 py-2.5 rounded-full text-sm font-medium hover:-translate-y-px transition-transform disabled:opacity-50"
            >
              {save.isPending ? "Inscribing…" : "Enter the Sanctum →"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
