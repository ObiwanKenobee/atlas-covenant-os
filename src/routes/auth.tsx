import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Enter the Sanctum — Atlas Sanctum OS" },
      { name: "description", content: "Sign in to Atlas Sanctum to begin your journey of stewardship and flourishing." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const afterSignIn = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", data.user.id)
      .maybeSingle();
    navigate({ to: profile?.onboarded ? "/sanctum" : "/onboarding" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome. A profile has been prepared.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await afterSignIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await afterSignIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-parchment text-ink font-mono flex flex-col">
      <div className="px-6 py-6">
        <Link to="/" className="text-[10px] uppercase tracking-widest text-ink/50 hover:text-copper">
          ← Return to the cathedral
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center space-y-3">
            <span className="text-[10px] tracking-[0.3em] uppercase text-copper">Covenant Threshold</span>
            <h1 className="font-serif text-4xl leading-tight">
              {mode === "signin" ? "Return to the Sanctum" : "Take the covenant"}
            </h1>
            <p className="text-sm text-ink/60">
              {mode === "signin"
                ? "Sign in to continue your journey of stewardship."
                : "Create your covenant account to begin."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-base/50 border border-ink/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-copper transition-colors"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/50">Passphrase</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-base/50 border border-ink/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-copper transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-ink text-parchment py-3 rounded-full text-sm font-medium hover:-translate-y-px transition-transform disabled:opacity-50"
            >
              {busy ? "…" : mode === "signin" ? "Enter" : "Take the covenant"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-ink/40">
            <span className="flex-1 h-px bg-ink/10" />
            or
            <span className="flex-1 h-px bg-ink/10" />
          </div>

          <button
            onClick={onGoogle}
            disabled={busy}
            className="w-full border border-ink/15 py-3 rounded-full text-sm font-medium hover:border-copper hover:text-copper transition-colors disabled:opacity-50"
          >
            Continue with Google
          </button>

          <p className="text-center text-xs text-ink/50">
            {mode === "signin" ? "New here? " : "Already a member? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-copper hover:underline"
            >
              {mode === "signin" ? "Take the covenant" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
