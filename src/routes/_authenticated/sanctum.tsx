import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getMyProfile,
  listMyLedger,
  addLedgerEntry,
} from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/sanctum")({
  component: SanctumPage,
});

const MODULES = [
  { key: "learning", label: "Learning", weight: 0.2 },
  { key: "commons", label: "Community", weight: 0.2 },
  { key: "earth", label: "Ecology", weight: 0.2 },
  { key: "arts", label: "Arts", weight: 0.15 },
  { key: "health", label: "Health", weight: 0.15 },
  { key: "sports", label: "Sports", weight: 0.1 },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

function SanctumPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchLedger = useServerFn(listMyLedger);
  const addEntry = useServerFn(addLedgerEntry);

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const { data: ledger } = useQuery({ queryKey: ["ledger"], queryFn: () => fetchLedger() });

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, navigate]);

  const [module, setModule] = useState<ModuleKey>("learning");
  const [kind, setKind] = useState("");
  const [value, setValue] = useState("1");

  const log = useMutation({
    mutationFn: (input: { module: ModuleKey; kind: string; value: number }) =>
      addEntry({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setKind("");
      setValue("1");
      toast.success("Inscribed in the ledger.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log"),
  });

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const m of MODULES) t[m.key] = 0;
    for (const row of ledger ?? []) {
      if (row.module in t) t[row.module] += Number(row.value);
    }
    return t;
  }, [ledger]);

  // Human Flourishing Index — normalize each module against a soft target of 20 units, weighted.
  const index = useMemo(() => {
    let score = 0;
    for (const m of MODULES) {
      const normalized = Math.min(1, totals[m.key] / 20);
      score += normalized * m.weight;
    }
    return Math.round(score * 1000) / 10; // 0–100
  }, [totals]);

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-copper">The Living Ledger</span>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <h1 className="font-serif text-4xl md:text-5xl leading-tight max-w-[22ch]">
              {profile?.display_name ? `Welcome, ${profile.display_name}.` : "Welcome, steward."}
            </h1>
            <div className="text-right">
              <div className="text-6xl font-serif text-copper leading-none">{index.toFixed(1)}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink/50 mt-2">
                Human Flourishing Index
              </div>
            </div>
          </div>
        </header>

        {/* Metrics grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/5 ring-1 ring-ink/5 rounded-xl overflow-hidden">
          {MODULES.map((m) => {
            const raw = totals[m.key] ?? 0;
            const pct = Math.min(100, (raw / 20) * 100);
            return (
              <div key={m.key} className="bg-parchment p-8 space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-widest text-copper">
                    {m.label}
                  </span>
                  <span className="text-[10px] text-ink/40">weight {(m.weight * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-4xl">{raw.toFixed(1)}</span>
                  <span className="text-[10px] uppercase tracking-widest text-ink/40">units</span>
                </div>
                <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                  <div className="h-full bg-copper transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>

        {/* Log form + recent */}
        <section className="grid lg:grid-cols-[1fr_1fr] gap-12">
          <div className="space-y-6">
            <h2 className="font-serif text-2xl">Inscribe an act of stewardship</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(value);
                if (!kind.trim() || !(v >= 0) || v > 10000) {
                  toast.error("A kind and a positive value.");
                  return;
                }
                log.mutate({ module, kind: kind.trim(), value: v });
              }}
              className="space-y-4 bg-stone-base/40 border border-ink/10 rounded-xl p-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-ink/50">Module</span>
                  <select
                    value={module}
                    onChange={(e) => setModule(e.target.value as ModuleKey)}
                    className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                  >
                    {MODULES.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-ink/50">Units</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10000"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-ink/50">What did you do?</span>
                <input
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  placeholder="Planted seedlings · Read Aristotle · Visited neighbor"
                  maxLength={60}
                  className="w-full bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end">
                <button
                  disabled={log.isPending}
                  className="bg-ink text-parchment px-5 py-2 rounded-full text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  {log.isPending ? "…" : "Inscribe"}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <h2 className="font-serif text-2xl">Recent inscriptions</h2>
            <div className="space-y-px bg-ink/5 rounded-xl overflow-hidden border border-ink/5">
              {(ledger ?? []).slice(0, 8).map((row) => (
                <div key={row.id} className="bg-parchment px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-ink">{row.kind}</div>
                    <div className="text-[10px] uppercase tracking-widest text-copper">{row.module}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-lg">{Number(row.value).toFixed(1)}</div>
                    <div className="text-[10px] text-ink/40">
                      {new Date(row.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              {(!ledger || ledger.length === 0) && (
                <div className="bg-parchment px-4 py-8 text-center text-sm text-ink/50">
                  The ledger awaits your first inscription.
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-ink/5 text-sm text-ink/60">
              <Link to="/guide" className="text-copper hover:underline">Consult the Atlas Guide →</Link>
              <span className="mx-3 text-ink/20">·</span>
              <Link to="/commons" className="text-copper hover:underline">Join a mission in the Commons →</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
