import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMissions } from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/commons/")({
  component: CommonsIndex,
});

const STATUS_LABEL: Record<string, string> = {
  open: "In deliberation",
  approved: "Approved by covenant",
  rejected: "Declined by covenant",
  closed: "Closed",
};

function CommonsIndex() {
  const fetchMissions = useServerFn(listMissions);
  const { data: missions } = useQuery({ queryKey: ["missions"], queryFn: () => fetchMissions() });

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-4">
            <span className="text-[10px] uppercase tracking-[0.3em] text-copper">III. The Commons</span>
            <h1 className="font-serif text-4xl md:text-5xl leading-tight max-w-[24ch]">
              What are we building together?
            </h1>
            <p className="text-sm text-ink/60 max-w-[52ch]">
              Propose missions, deliberate through covenant voting, and pair contributions with matched philanthropic causes.
            </p>
          </div>
          <Link
            to="/commons/new"
            className="bg-ink text-parchment px-6 py-2.5 rounded-full text-sm font-medium hover:-translate-y-px transition-transform whitespace-nowrap"
          >
            Propose a mission →
          </Link>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink/5 ring-1 ring-ink/5 rounded-xl overflow-hidden">
          {(missions ?? []).map((m) => {
            const goal = m.funding_goal_cents;
            const cur = m.funding_current_cents;
            const pct = goal > 0 ? Math.min(100, (cur / goal) * 100) : 0;
            const total = m.approve_count + m.reject_count;
            return (
              <Link
                key={m.id}
                to="/commons/$id"
                params={{ id: m.id }}
                className="bg-parchment p-8 space-y-4 hover:bg-stone-base/40 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-copper">{m.module}</span>
                  <span className="text-[10px] uppercase tracking-widest text-ink/40">
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                </div>
                <h3 className="font-serif text-2xl group-hover:text-copper transition-colors">{m.title}</h3>
                <p className="text-sm text-ink/60 leading-relaxed line-clamp-3">{m.summary}</p>
                <div className="space-y-2 pt-2">
                  <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                    <div className="h-full bg-copper" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink/50">
                    <span>${(cur / 100).toLocaleString()} of ${(goal / 100).toLocaleString()}</span>
                    <span>
                      {total}/{m.quorum} votes · ✓{m.approve_count} ✕{m.reject_count}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {(!missions || missions.length === 0) && (
            <div className="bg-parchment p-16 text-center text-sm text-ink/50 col-span-full">
              No missions yet. Propose the first.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
