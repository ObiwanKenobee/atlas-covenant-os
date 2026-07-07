import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

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
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [focus, setFocus] = useState<ModuleKey | "all">("all");

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

  const index = useMemo(() => {
    let score = 0;
    for (const m of MODULES) {
      const normalized = Math.min(1, totals[m.key] / 20);
      score += normalized * m.weight;
    }
    return Math.round(score * 1000) / 10;
  }, [totals]);

  // Build daily time series over the window; running totals for HFI trend.
  const series = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(dayKey(d));
    }
    const perDay = new Map<string, Record<string, number>>();
    for (const d of days) {
      perDay.set(d, Object.fromEntries(MODULES.map((m) => [m.key, 0])));
    }
    for (const row of ledger ?? []) {
      const d = dayKey(new Date(row.created_at));
      const bucket = perDay.get(d);
      if (bucket && row.module in bucket) bucket[row.module] += Number(row.value);
    }
    // Running totals across the whole ledger, projected onto the window.
    const running: Record<string, number> = Object.fromEntries(MODULES.map((m) => [m.key, 0]));
    const startCutoff = days[0];
    for (const row of [...(ledger ?? [])].sort(
      (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
    )) {
      const d = dayKey(new Date(row.created_at));
      if (d < startCutoff && row.module in running) running[row.module] += Number(row.value);
    }
    return days.map((d) => {
      const bucket = perDay.get(d)!;
      for (const m of MODULES) running[m.key] += bucket[m.key];
      let hfi = 0;
      for (const m of MODULES) hfi += Math.min(1, running[m.key] / 20) * m.weight;
      const row: Record<string, number | string> = {
        date: d.slice(5),
        hfi: Math.round(hfi * 1000) / 10,
      };
      for (const m of MODULES) row[m.key] = Math.round(running[m.key] * 10) / 10;
      return row;
    });
  }, [ledger, rangeDays]);

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

        {/* Trend chart */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Time Series</span>
              <h2 className="font-serif text-2xl mt-1">
                {focus === "all"
                  ? "Trajectory of the Flourishing Index"
                  : `${MODULES.find((m) => m.key === focus)?.label} · running units`}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value as ModuleKey | "all")}
                className="bg-parchment border border-ink/10 rounded-lg px-3 py-1.5 text-xs"
              >
                <option value="all">HFI (composite)</option>
                {MODULES.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setRangeDays(d)}
                  className={
                    "text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border " +
                    (rangeDays === d
                      ? "bg-ink text-parchment border-ink"
                      : "border-ink/15 text-ink/60 hover:text-ink")
                  }
                >
                  {d}d
                </button>
              ))}
              <button
                onClick={() => {
                  const header = ["date", "hfi", ...MODULES.map((m) => m.key)];
                  const rows = series.map((r) => header.map((h) => r[h]).join(","));
                  const csv = [header.join(","), ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `flourishing-index-${rangeDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-copper/40 text-copper hover:bg-copper hover:text-parchment transition-colors"
              >
                Export CSV ↓
              </button>
            </div>
          </div>
          <div className="bg-stone-base/40 border border-ink/10 rounded-xl p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              {focus === "all" ? (
                <AreaChart data={series} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hfiFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4a6762" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#4a6762" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1c1c1a" strokeOpacity={0.05} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#1c1c1a", fillOpacity: 0.5, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#1c1c1a", fillOpacity: 0.5, fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: "#f8f7f2", border: "1px solid rgba(28,28,26,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#4a6762" }}
                  />
                  <Area type="monotone" dataKey="hfi" stroke="#4a6762" strokeWidth={2} fill="url(#hfiFill)" name="HFI" />
                </AreaChart>
              ) : (
                <LineChart data={series} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1c1c1a" strokeOpacity={0.05} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#1c1c1a", fillOpacity: 0.5, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#1c1c1a", fillOpacity: 0.5, fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: "#f8f7f2", border: "1px solid rgba(28,28,26,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#4a6762" }}
                  />
                  <Line
                    type="monotone"
                    dataKey={focus}
                    stroke="#4a6762"
                    strokeWidth={2}
                    dot={false}
                    name={MODULES.find((m) => m.key === focus)?.label}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* Metrics grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/5 ring-1 ring-ink/5 rounded-xl overflow-hidden">
          {MODULES.map((m) => {
            const raw = totals[m.key] ?? 0;
            const pct = Math.min(100, (raw / 20) * 100);
            const spark = series.map((s) => ({ v: s[m.key] as number }));
            return (
              <button
                key={m.key}
                onClick={() => setFocus(m.key)}
                className={
                  "bg-parchment p-8 space-y-4 text-left transition-colors " +
                  (focus === m.key ? "ring-1 ring-copper/40" : "hover:bg-stone-base/40")
                }
              >
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
                <div className="h-8 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spark}>
                      <Line type="monotone" dataKey="v" stroke="#4a6762" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </button>
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
