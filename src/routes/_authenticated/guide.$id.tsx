import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReflection } from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/guide/$id")({
  component: ReflectionDetail,
});

const MODULE_LABEL: Record<string, string> = {
  learning: "Learning",
  commons: "Community",
  earth: "Ecology",
  arts: "Arts",
  sports: "Sports",
  health: "Health",
};

function ReflectionDetail() {
  const { id } = Route.useParams();
  const fetchOne = useServerFn(getReflection);
  const { data, isLoading, error } = useQuery({
    queryKey: ["reflection", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <Link to="/guide" className="text-[10px] uppercase tracking-widest text-copper hover:text-ink">
          ← Back to the journal
        </Link>

        {isLoading && <p className="text-sm text-ink/50">Opening the page…</p>}
        {error && <p className="text-sm text-ink/60">This reflection could not be opened.</p>}

        {data && (
          <>
            <header className="space-y-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-copper">
                Atlas Guide · {new Date(data.reflection.created_at).toLocaleString()}
              </span>
              <h1 className="font-serif text-3xl md:text-4xl leading-snug">
                {data.reflection.prompt}
              </h1>
            </header>

            <section className="space-y-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Reflection</span>
              {data.reflection.reflection ? (
                <div className="border-l border-copper/40 pl-6 py-2 whitespace-pre-wrap leading-relaxed text-ink/80">
                  {data.reflection.reflection}
                </div>
              ) : (
                <p className="text-sm text-ink/50 italic">Not yet answered.</p>
              )}
            </section>

            <section className="space-y-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-copper">
                Linked learning units & ledger effect
              </span>
              {data.ledger.length === 0 ? (
                <p className="text-sm text-ink/50">
                  No ledger entries were inscribed alongside this reflection.
                </p>
              ) : (
                <div className="border border-ink/10 rounded-xl overflow-hidden divide-y divide-ink/5">
                  {data.ledger.map((row) => (
                    <div key={row.id} className="p-4 flex items-center justify-between text-sm">
                      <div>
                        <div className="text-ink">{row.kind}</div>
                        <div className="text-[10px] uppercase tracking-widest text-copper">
                          {MODULE_LABEL[row.module] ?? row.module}
                          {row.note && <span className="text-ink/40 normal-case tracking-normal ml-2">· {row.note}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-serif text-lg">+{Number(row.value).toFixed(1)}</div>
                        <div className="text-[10px] text-ink/40">
                          {new Date(row.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-ink/50 border-l border-ink/10 pl-3">
                Each inscribed reflection adds one Learning unit to the Living Ledger.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
