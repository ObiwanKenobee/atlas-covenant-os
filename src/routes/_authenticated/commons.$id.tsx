import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMission, castVote, contribute } from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/commons/$id")({
  component: MissionDetail,
});

const STATUS_LABEL: Record<string, string> = {
  open: "In deliberation",
  approved: "Approved by covenant",
  rejected: "Declined by covenant",
  closed: "Closed",
};

function MissionDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchMission = useServerFn(getMission);
  const voteFn = useServerFn(castVote);
  const contributeFn = useServerFn(contribute);

  const { data } = useQuery({
    queryKey: ["mission", id],
    queryFn: () => fetchMission({ data: { id } }),
  });

  const [amount, setAmount] = useState("25");
  const [causeId, setCauseId] = useState<string>("");

  const vote = useMutation({
    mutationFn: (v: "approve" | "reject") => voteFn({ data: { mission_id: id, vote: v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mission", id] });
      qc.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Your vote is cast.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not vote"),
  });

  const contrib = useMutation({
    mutationFn: () =>
      contributeFn({
        data: {
          mission_id: id,
          amount_cents: Math.round(Number(amount) * 100),
          cause_id: causeId || null,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["mission", id] });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      const matched = (res.matched_amount_cents ?? 0) / 100;
      toast.success(
        matched > 0
          ? `Contribution inscribed. Matched with $${matched.toFixed(2)}.`
          : "Contribution inscribed.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not contribute"),
  });

  if (!data) {
    return (
      <div className="min-h-screen bg-parchment text-ink font-mono">
        <SanctumNav />
        <main className="max-w-3xl mx-auto px-6 py-24 text-center text-sm text-ink/50">Loading mission…</main>
      </div>
    );
  }

  const { mission, myVote, matchingCauses, contributions } = data;
  const total = mission.approve_count + mission.reject_count;
  const quorumPct = Math.min(100, (total / mission.quorum) * 100);
  const fundingPct =
    mission.funding_goal_cents > 0
      ? Math.min(100, (mission.funding_current_cents / mission.funding_goal_cents) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        <header className="space-y-4">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest">
            <span className="text-copper">{mission.module}</span>
            <span className="text-ink/40">·</span>
            <span className="text-ink/60">{STATUS_LABEL[mission.status] ?? mission.status}</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight max-w-[28ch]">{mission.title}</h1>
          <p className="text-sm text-ink/70 leading-relaxed max-w-[64ch] whitespace-pre-wrap">
            {mission.summary}
          </p>
        </header>

        <section className="grid lg:grid-cols-[1fr_1fr] gap-12">
          {/* Governance */}
          <div className="space-y-6 bg-stone-base/40 border border-ink/10 rounded-xl p-8">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Covenant Governance</span>
              <h2 className="font-serif text-2xl mt-2">Deliberate the proposal</h2>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink/50">
                <span>Quorum</span>
                <span>{total}/{mission.quorum}</span>
              </div>
              <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                <div className="h-full bg-copper" style={{ width: `${quorumPct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-parchment rounded-lg border border-ink/5 text-center">
                <div className="text-3xl font-serif">{mission.approve_count}</div>
                <div className="text-[10px] uppercase tracking-widest text-ink/50 mt-1">Approve</div>
              </div>
              <div className="p-4 bg-parchment rounded-lg border border-ink/5 text-center">
                <div className="text-3xl font-serif">{mission.reject_count}</div>
                <div className="text-[10px] uppercase tracking-widest text-ink/50 mt-1">Reject</div>
              </div>
            </div>

            {mission.status === "open" ? (
              <div className="flex gap-3">
                <button
                  disabled={vote.isPending}
                  onClick={() => vote.mutate("approve")}
                  className={
                    "flex-1 py-2.5 rounded-full text-xs uppercase tracking-widest border transition-colors " +
                    (myVote?.vote === "approve"
                      ? "bg-copper border-copper text-parchment"
                      : "border-ink/15 hover:border-copper hover:text-copper")
                  }
                >
                  Approve
                </button>
                <button
                  disabled={vote.isPending}
                  onClick={() => vote.mutate("reject")}
                  className={
                    "flex-1 py-2.5 rounded-full text-xs uppercase tracking-widest border transition-colors " +
                    (myVote?.vote === "reject"
                      ? "bg-ink border-ink text-parchment"
                      : "border-ink/15 hover:border-ink hover:text-ink")
                  }
                >
                  Reject
                </button>
              </div>
            ) : (
              <p className="text-xs text-ink/50">
                Deliberation is closed. This proposal was {mission.status}.
              </p>
            )}
            <p className="text-[11px] text-ink/50 border-l border-copper/40 pl-3 leading-relaxed">
              Rule: at least {mission.quorum} votes cast, majority approve to pass.
            </p>
          </div>

          {/* Contribute + matching */}
          <div className="space-y-6 bg-stone-base/40 border border-ink/10 rounded-xl p-8">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Philanthropic Matching</span>
              <h2 className="font-serif text-2xl mt-2">Contribute & pair a cause</h2>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink/50">
                <span>Funding</span>
                <span>
                  ${(mission.funding_current_cents / 100).toLocaleString()} of $
                  {(mission.funding_goal_cents / 100).toLocaleString()}
                </span>
              </div>
              <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                <div className="h-full bg-copper" style={{ width: `${fundingPct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-3">
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={causeId}
                onChange={(e) => setCauseId(e.target.value)}
                className="bg-parchment border border-ink/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">No matching cause</option>
                {matchingCauses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {Number(c.match_ratio).toFixed(2)}× match
                  </option>
                ))}
              </select>
            </div>

            <button
              disabled={contrib.isPending || Number(amount) < 1}
              onClick={() => contrib.mutate()}
              className="w-full bg-ink text-parchment py-2.5 rounded-full text-xs uppercase tracking-widest hover:-translate-y-px transition-transform disabled:opacity-50"
            >
              {contrib.isPending ? "…" : "Inscribe contribution"}
            </button>

            {causeId ? (
              (() => {
                const c = matchingCauses.find((x) => x.id === causeId);
                if (!c) return null;
                const amt = Number(amount) || 0;
                const matched = amt * Number(c.match_ratio);
                return (
                  <div className="border-l border-copper/40 pl-4 space-y-1 text-xs text-ink/70">
                    <p className="font-serif text-base text-ink">{c.name}</p>
                    <p>{c.description}</p>
                    {c.expected_impact && (
                      <p className="text-ink/50">Expected impact: {c.expected_impact}</p>
                    )}
                    <p className="text-copper">
                      Your ${amt.toFixed(2)} pairs with ${matched.toFixed(2)} matched — ${(amt + matched).toFixed(2)} total to the mission.
                    </p>
                  </div>
                );
              })()
            ) : (
              <p className="text-[11px] text-ink/50 border-l border-ink/10 pl-3">
                Pair with a cause to multiply your contribution's impact.
              </p>
            )}
          </div>
        </section>

        {/* Impact dashboard */}
        {(() => {
          const pledgeCents = contributions.reduce((s, c) => s + c.amount_cents, 0);
          const matchedCents = contributions.reduce((s, c) => s + c.matched_amount_cents, 0);
          const totalCents = pledgeCents + matchedCents;
          const contributors = new Set(contributions.map((c) => c.contributor_id)).size;
          const milestones = [25, 50, 75, 100];
          const currentPct = mission.funding_goal_cents > 0
            ? Math.min(100, ((mission.funding_current_cents) / mission.funding_goal_cents) * 100)
            : 0;
          return (
            <section className="space-y-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Impact Dashboard</span>
                <h2 className="font-serif text-2xl mt-1">Expected matched impact</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/5 ring-1 ring-ink/5 rounded-xl overflow-hidden">
                {[
                  { label: "Pledged", value: `$${(pledgeCents / 100).toLocaleString()}` },
                  { label: "Matched", value: `$${(matchedCents / 100).toLocaleString()}` },
                  { label: "Total impact", value: `$${(totalCents / 100).toLocaleString()}` },
                  { label: "Contributors", value: String(contributors) },
                ].map((s) => (
                  <div key={s.label} className="bg-parchment p-6">
                    <div className="text-[10px] uppercase tracking-widest text-copper">{s.label}</div>
                    <div className="font-serif text-3xl mt-1">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-stone-base/40 border border-ink/10 rounded-xl p-6 space-y-4">
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink/50">
                  <span>Milestones toward goal</span>
                  <span>{currentPct.toFixed(0)}% funded</span>
                </div>
                <div className="relative h-2 bg-ink/5 rounded-full">
                  <div className="absolute inset-y-0 left-0 bg-copper rounded-full transition-all" style={{ width: `${currentPct}%` }} />
                  {milestones.map((m) => {
                    const reached = currentPct >= m;
                    return (
                      <div
                        key={m}
                        className="absolute -top-1"
                        style={{ left: `calc(${m}% - 8px)` }}
                      >
                        <div className={"size-4 rounded-full border-2 " + (reached ? "bg-copper border-copper" : "bg-parchment border-ink/20")} />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-4 gap-3 pt-2">
                  {milestones.map((m) => {
                    const reached = currentPct >= m;
                    const dollars = (mission.funding_goal_cents * m) / 100 / 100;
                    return (
                      <div key={m} className={"text-center p-3 rounded-lg border " + (reached ? "border-copper/40 bg-copper/5" : "border-ink/10")}>
                        <div className={"font-serif text-lg " + (reached ? "text-copper" : "text-ink/60")}>{m}%</div>
                        <div className="text-[10px] uppercase tracking-widest text-ink/50 mt-0.5">
                          ${dollars.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-ink/40 mt-1">
                          {reached ? "reached" : "pending"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {matchingCauses.length > 0 && (
                <div className="border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
                  <div className="px-4 py-2 bg-ink/5 text-[10px] uppercase tracking-widest text-ink/50">
                    Matched impact projections
                  </div>
                  {matchingCauses.slice(0, 4).map((c) => {
                    const projected = pledgeCents * Number(c.match_ratio);
                    return (
                      <div key={c.id} className="px-4 py-3 flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <div className="font-serif text-base truncate">{c.name}</div>
                          <div className="text-[11px] text-ink/50 truncate">{c.expected_impact ?? c.description}</div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="font-serif text-lg text-copper">
                            +${(projected / 100).toLocaleString()}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-ink/40">
                            {Number(c.match_ratio).toFixed(2)}× match
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {/* Contribution log */}
        <section className="space-y-4">
          <h3 className="font-serif text-2xl">Ledger of contributions</h3>
          <div className="border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
            {contributions.length === 0 && (
              <div className="p-6 text-sm text-ink/50 text-center">No contributions yet.</div>
            )}
            {contributions.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-serif text-lg">
                    ${(c.amount_cents / 100).toFixed(2)}
                    {c.matched_amount_cents > 0 && (
                      <span className="text-copper text-xs ml-2">
                        + ${(c.matched_amount_cents / 100).toFixed(2)} matched
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-ink/50">
                    {c.philanthropic_causes?.name ?? "Direct contribution"}
                  </div>
                </div>
                <span className="text-[10px] text-ink/40">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
