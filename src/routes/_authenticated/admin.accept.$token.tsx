import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { acceptAdminInvitation } from "@/lib/sanctum.functions";
import { SanctumNav } from "@/components/SanctumNav";

export const Route = createFileRoute("/_authenticated/admin/accept/$token")({
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const accept = useServerFn(acceptAdminInvitation);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  const mutate = useMutation({
    mutationFn: () => accept({ data: { token } }),
    onSuccess: (res) => {
      setStatus("ok");
      setMsg(res.message);
      qc.invalidateQueries({ queryKey: ["is-admin"] });
      setTimeout(() => navigate({ to: "/admin" }), 1200);
    },
    onError: (e) => {
      setStatus("err");
      setMsg(e instanceof Error ? e.message : "Could not accept invitation");
    },
  });

  useEffect(() => {
    mutate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-parchment text-ink font-mono">
      <SanctumNav />
      <main className="max-w-xl mx-auto px-6 py-24 text-center space-y-6">
        <span className="text-[10px] uppercase tracking-[0.3em] text-copper">Council invitation</span>
        <h1 className="font-serif text-3xl">
          {status === "idle" && "Verifying invitation…"}
          {status === "ok" && "Welcome to the council."}
          {status === "err" && "Invitation could not be accepted"}
        </h1>
        <p className="text-sm text-ink/60">{msg || "One moment."}</p>
        {status === "err" && (
          <Link to="/sanctum" className="text-copper hover:text-ink text-xs uppercase tracking-widest">
            Return to the ledger →
          </Link>
        )}
      </main>
    </div>
  );
}
