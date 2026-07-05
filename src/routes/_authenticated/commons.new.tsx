import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createMission } from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/commons/new")({
  component: NewMissionPage,
});

const MODULES = ["learning", "commons", "earth", "arts", "sports", "health"] as const;
type ModuleKey = (typeof MODULES)[number];

function NewMissionPage() {
  const navigate = useNavigate();
  const create = useServerFn(createMission);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [module, setModule] = useState<ModuleKey>("earth");
  const [goal, setGoal] = useState("1000");
  const [quorum, setQuorum] = useState("5");

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          title: title.trim(),
          summary: summary.trim(),
          module,
          funding_goal_cents: Math.round(Number(goal) * 100),
          quorum: Number(quorum),
        },
      }),
    onSuccess: (row) => {
      toast.success("Mission proposed.");
      navigate({ to: "/commons/$id", params: { id: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not propose"),
  });

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Propose a mission</span>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">
            A shared endeavor worth stewarding.
          </h1>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length < 4 || summary.trim().length < 20) {
              toast.error("A clearer title and summary.");
              return;
            }
            mut.mutate();
          }}
          className="space-y-6"
        >
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-ink/50">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-copper"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-ink/50">Summary</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={6}
              maxLength={2000}
              className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-copper resize-none leading-relaxed"
            />
            <span className="text-[10px] text-ink/40">{summary.length}/2000</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Module</span>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value as ModuleKey)}
                className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-3 py-2.5 text-sm"
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Funding goal (USD)</span>
              <input
                type="number"
                min="0"
                max="1000000"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-3 py-2.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Quorum</span>
              <input
                type="number"
                min="1"
                max="200"
                value={quorum}
                onChange={(e) => setQuorum(e.target.value)}
                className="w-full bg-stone-base/40 border border-ink/10 rounded-lg px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <p className="text-xs text-ink/50 leading-relaxed border-l border-copper/40 pl-4">
            Governance: a proposal passes when at least <span className="text-ink">{quorum}</span> members
            have voted and more approve than reject.
          </p>

          <div className="flex justify-end">
            <button
              disabled={mut.isPending}
              className="bg-ink text-parchment px-6 py-2.5 rounded-full text-sm font-medium hover:-translate-y-px transition-transform disabled:opacity-50"
            >
              {mut.isPending ? "…" : "Submit to the Commons →"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
