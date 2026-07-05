import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  generateReflectionPrompt,
  listReflections,
  saveReflection,
} from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/guide")({
  component: GuidePage,
});

function GuidePage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listReflections);
  const genPrompt = useServerFn(generateReflectionPrompt);
  const save = useServerFn(saveReflection);

  const { data: reflections } = useQuery({
    queryKey: ["reflections"],
    queryFn: () => fetchList(),
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const generate = useMutation({
    mutationFn: () => genPrompt(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reflections"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "The Guide is silent"),
  });

  const commit = useMutation({
    mutationFn: (input: { id: string; reflection: string }) => save({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reflections"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      toast.success("Reflection inscribed.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-copper">II. The Atlas Guide</span>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight max-w-[22ch]">
            A companion for wisdom, not for attention.
          </h1>
          <p className="text-sm text-ink/60 max-w-[52ch]">
            The Guide offers one small prompt at a time. Sit with it. Answer honestly when you're ready.
          </p>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="bg-ink text-parchment px-5 py-2.5 rounded-full text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {generate.isPending ? "The Guide is listening…" : "Request a new prompt"}
          </button>
        </header>

        <section className="space-y-6">
          {(reflections ?? []).map((r) => {
            const draft = drafts[r.id] ?? r.reflection ?? "";
            return (
              <article
                key={r.id}
                className="bg-stone-base/40 border border-ink/10 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <span className="size-2 rounded-full bg-copper" />
                  <span className="text-[10px] uppercase tracking-widest text-ink/50">
                    Atlas Guide · {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-serif text-2xl leading-snug text-ink">{r.prompt}</p>

                {r.reflection ? (
                  <div className="border-l border-copper/40 pl-4 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">
                    {r.reflection}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      rows={4}
                      maxLength={4000}
                      placeholder="Reflect here…"
                      className="w-full bg-parchment border border-ink/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-copper resize-none leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          if (!draft.trim()) return;
                          commit.mutate({ id: r.id, reflection: draft.trim() });
                        }}
                        disabled={commit.isPending || !draft.trim()}
                        className="text-[10px] uppercase tracking-widest text-copper hover:text-ink disabled:opacity-40"
                      >
                        Inscribe reflection →
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {(!reflections || reflections.length === 0) && (
            <div className="text-center py-16 border border-dashed border-ink/10 rounded-xl">
              <p className="text-sm text-ink/50">No prompts yet. Request the first one above.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
