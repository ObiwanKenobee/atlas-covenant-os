import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/sanctum", label: "Ledger" },
  { to: "/guide", label: "Guide" },
  { to: "/commons", label: "Commons" },
] as const;

export function SanctumNav() {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 bg-parchment/85 backdrop-blur border-b border-ink/5">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/sanctum" className="font-serif text-xl tracking-tight text-ink">
          Atlas <span className="text-copper">Sanctum</span>
        </Link>
        <nav className="flex items-center gap-8 text-[11px] uppercase tracking-widest text-ink/60">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "text-ink" }}
              className="hover:text-copper transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/" });
            }}
            className="text-ink/40 hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
