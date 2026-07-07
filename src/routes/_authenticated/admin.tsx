import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  amIAdmin,
  listCauses,
  upsertCause,
  deleteCause,
  getGovernanceSettings,
  updateGovernanceSettings,
  listMissions,
  updateMissionQuorum,
  listAdminInvitations,
  createAdminInvitation,
  revokeAdminInvitation,
} from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const MODULES = ["learning", "commons", "earth", "arts", "sports", "health"] as const;
type ModuleKey = (typeof MODULES)[number];

type CauseDraft = {
  id?: string;
  name: string;
  description: string;
  module: ModuleKey;
  match_ratio: string;
  expected_impact: string;
};

const EMPTY: CauseDraft = {
  name: "",
  description: "",
  module: "commons",
  match_ratio: "1.0",
  expected_impact: "",
};

function AdminPage() {
  const qc = useQueryClient();
  const check = useServerFn(amIAdmin);
  const fetchCauses = useServerFn(listCauses);
  const upsert = useServerFn(upsertCause);
  const del = useServerFn(deleteCause);
  const fetchGov = useServerFn(getGovernanceSettings);
  const saveGov = useServerFn(updateGovernanceSettings);
  const fetchMissions = useServerFn(listMissions);
  const setQuorum = useServerFn(updateMissionQuorum);

  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => check(),
  });
  const { data: causes } = useQuery({ queryKey: ["causes"], queryFn: () => fetchCauses() });
  const { data: gov } = useQuery({ queryKey: ["gov"], queryFn: () => fetchGov() });
  const { data: missions } = useQuery({ queryKey: ["missions"], queryFn: () => fetchMissions() });

  const [draft, setDraft] = useState<CauseDraft>(EMPTY);
  const [defaultQ, setDefaultQ] = useState<string>("");
  const [missionQ, setMissionQ] = useState<Record<string, string>>({});

  const saveCause = useMutation({
    mutationFn: (d: CauseDraft) =>
      upsert({
        data: {
          id: d.id,
          name: d.name.trim(),
          description: d.description.trim(),
          module: d.module,
          match_ratio: Number(d.match_ratio),
          expected_impact: d.expected_impact.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["causes"] });
      setDraft(EMPTY);
      toast.success("Cause saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["causes"] });
      toast.success("Cause removed.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const saveDefaultQ = useMutation({
    mutationFn: () =>
      saveGov({ data: { id: gov!.id, default_quorum: Number(defaultQ || gov!.default_quorum) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gov"] });
      toast.success("Default quorum updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const saveMissionQ = useMutation({
    mutationFn: ({ id, quorum }: { id: string; quorum: number }) =>
      setQuorum({ data: { id, quorum } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Quorum updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (adminLoading) return null;
  if (!admin?.isAdmin) return <Navigate to="/sanctum" />;

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Council Chambers</span>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight max-w-[24ch]">
            Steward the covenant.
          </h1>
          <p className="text-sm text-ink/60 max-w-[52ch]">
            Curate philanthropic causes, tune matching ratios, and set the governance rules the Commons live by.
          </p>
        </header>

        {/* Governance */}
        <section className="space-y-6">
          <h2 className="font-serif text-2xl">Governance defaults</h2>
          <div className="bg-stone-base/40 border border-ink/10 rounded-xl p-6 flex flex-col md:flex-row md:items-end gap-4">
            <label className="space-y-1 flex-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Default quorum for new missions</span>
              <input
                type="number"
                min="1"
                max="500"
                value={defaultQ || (gov?.default_quorum ?? "")}
                onChange={(e) => setDefaultQ(e.target.value)}
                className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={() => saveDefaultQ.mutate()}
              disabled={saveDefaultQ.isPending || !gov}
              className="bg-ink text-parchment px-5 py-2 rounded-full text-xs uppercase tracking-widest disabled:opacity-50"
            >
              Save
            </button>
          </div>

          <div className="border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
            <div className="grid grid-cols-[1fr_120px_140px] px-4 py-2 bg-ink/5 text-[10px] uppercase tracking-widest text-ink/50">
              <span>Mission</span>
              <span>Quorum</span>
              <span></span>
            </div>
            {(missions ?? []).map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_120px_140px] items-center px-4 py-3 text-sm gap-2">
                <div className="truncate">
                  <div className="text-ink truncate">{m.title}</div>
                  <div className="text-[10px] uppercase tracking-widest text-copper">{m.module} · {m.status}</div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  defaultValue={m.quorum}
                  onChange={(e) => setMissionQ((s) => ({ ...s, [m.id]: e.target.value }))}
                  className="bg-parchment border border-ink/10 rounded-lg px-2 py-1 text-sm w-24"
                />
                <button
                  onClick={() =>
                    saveMissionQ.mutate({
                      id: m.id,
                      quorum: Number(missionQ[m.id] ?? m.quorum),
                    })
                  }
                  className="text-[10px] uppercase tracking-widest text-copper hover:text-ink justify-self-start"
                >
                  Update →
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Causes */}
        <section className="space-y-6">
          <h2 className="font-serif text-2xl">Philanthropic causes</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim() || !draft.description.trim()) {
                toast.error("Name and description are required.");
                return;
              }
              saveCause.mutate(draft);
            }}
            className="bg-stone-base/40 border border-ink/10 rounded-xl p-6 space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-ink/50">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                  maxLength={120}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-ink/50">Module</span>
                <select
                  value={draft.module}
                  onChange={(e) => setDraft({ ...draft, module: e.target.value as ModuleKey })}
                  className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                >
                  {MODULES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-ink/50">Match ratio</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={draft.match_ratio}
                  onChange={(e) => setDraft({ ...draft, match_ratio: e.target.value })}
                  className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-ink/50">Expected impact</span>
                <input
                  value={draft.expected_impact}
                  onChange={(e) => setDraft({ ...draft, expected_impact: e.target.value })}
                  className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                  maxLength={500}
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Description</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm resize-none"
                maxLength={2000}
              />
            </label>
            <div className="flex justify-end gap-3">
              {draft.id && (
                <button
                  type="button"
                  onClick={() => setDraft(EMPTY)}
                  className="text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink"
                >
                  Cancel edit
                </button>
              )}
              <button
                disabled={saveCause.isPending}
                className="bg-ink text-parchment px-5 py-2 rounded-full text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {draft.id ? "Save changes" : "Add cause"}
              </button>
            </div>
          </form>

          <div className="border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
            {(causes ?? []).map((c) => (
              <div key={c.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-lg">{c.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-copper">{c.module}</span>
                    <span className="text-[10px] text-ink/50">{Number(c.match_ratio).toFixed(2)}× match</span>
                  </div>
                  <p className="text-ink/60 text-xs mt-1 line-clamp-2">{c.description}</p>
                  {c.expected_impact && (
                    <p className="text-[11px] text-ink/50 mt-0.5">Impact: {c.expected_impact}</p>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() =>
                      setDraft({
                        id: c.id,
                        name: c.name,
                        description: c.description,
                        module: c.module as ModuleKey,
                        match_ratio: String(c.match_ratio),
                        expected_impact: c.expected_impact ?? "",
                      })
                    }
                    className="text-[10px] uppercase tracking-widest text-copper hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${c.name}"?`)) remove.mutate(c.id);
                    }}
                    className="text-[10px] uppercase tracking-widest text-ink/40 hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {(!causes || causes.length === 0) && (
              <div className="p-8 text-center text-sm text-ink/50">No causes yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
