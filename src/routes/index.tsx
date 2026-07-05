import { createFileRoute, Link } from "@tanstack/react-router";
import sacredGeometry from "@/assets/sacred-geometry.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const modules = [
  {
    num: "01. Learning",
    title: "Wisdom Mentors",
    body: "AI companions designed to foster long-term ethical reflection rather than instant task completion.",
  },
  {
    num: "02. Commons",
    title: "Shared Stewardship",
    body: "Tools for collective ownership and mission-driven governance beyond corporate structures.",
  },
  {
    num: "03. Earth",
    title: "Ecological Vows",
    body: "Direct participation in regenerative landscapes, mapped and verified by the Living Ledger.",
  },
  {
    num: "04. Arts",
    title: "Cultural Memory",
    body: "Patronage for the enduring beautiful, preserving the artifacts of human creativity.",
  },
  {
    num: "05. Health",
    title: "Vitality Networks",
    body: "Shared care models that view wellbeing as a communal asset rather than an individual burden.",
  },
  {
    num: "06. Sports",
    title: "Embodied Spirit",
    body: "Cultivating physical discipline and collective movement as a form of ritual.",
  },
];

const metrics = [
  { label: "Learning Growth", delta: "+12%", width: "88%" },
  { label: "Ecology Restoration", delta: "+4%", width: "72%" },
  { label: "Communal Participation", delta: "+22%", width: "94%" },
  { label: "Shared Ownership", delta: "+2%", width: "33%" },
];

function Index() {
  return (
    <main className="min-h-screen bg-parchment text-ink font-mono selection:bg-copper/20">
      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 sacred-gradient">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-8">
            <span className="text-[10px] tracking-[0.3em] uppercase text-copper font-medium">
              Anno Domini MMXXVI
            </span>
            <h1 className="font-serif text-5xl md:text-7xl leading-none text-balance max-w-[20ch]">
              A digital cathedral for human flourishing.
            </h1>
            <p className="font-mono text-sm sm:text-base text-ink/70 max-w-[56ch] text-pretty">
              Atlas Sanctum OS is a living institution for stewardship, wisdom,
              and regenerative prosperity. Beyond the extraction of attention
              lies the cultivation of the soul.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <button className="bg-ink text-parchment px-6 py-2.5 rounded-full text-sm font-medium transition-transform hover:-translate-y-px ring-1 ring-ink">
                Enter the Sanctum
              </button>
              <button className="flex items-center gap-2 py-2 pr-3 pl-2 text-sm font-medium text-ink/60 hover:text-ink transition-colors">
                <span className="size-4 shrink-0 rounded-full border border-ink/20 flex items-center justify-center">
                  <span className="size-1 bg-ink rounded-full" />
                </span>
                Read the Covenant
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* The Cathedral Blueprint */}
      <section className="py-24 px-6 border-y border-ink/5 bg-stone-base/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-[10px] uppercase tracking-widest text-copper mb-4 block">
              I. The Blueprint
            </span>
            <h2 className="font-serif text-3xl leading-tight mb-4">
              The Cathedral Blueprint
            </h2>
            <p className="text-sm text-ink/60 max-w-[48ch]">
              Six modules engineered for permanence and communal vitality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/5 ring-1 ring-ink/5 rounded-xl overflow-hidden">
            {modules.map((m) => (
              <div key={m.num} className="bg-parchment p-8 space-y-4">
                <span className="text-[10px] uppercase tracking-widest text-copper">
                  {m.num}
                </span>
                <h3 className="font-serif text-2xl">{m.title}</h3>
                <p className="text-sm text-ink/70 leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Atlas Guide */}
      <section className="py-32 px-6 border-b border-ink/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-8">
            <span className="text-[10px] uppercase tracking-widest text-copper block">
              II. The Atlas Guide
            </span>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight text-balance max-w-[22ch]">
              An AI companion for human flourishing, not for attention.
            </h2>
            <p className="text-sm text-ink/60 max-w-[52ch] leading-relaxed">
              A guide, not an assistant. The Atlas Guide offers personalized
              learning journeys, ethical reflection prompts, community
              opportunities, stewardship recommendations, and life-mission
              journals.
            </p>
          </div>

          <div className="bg-stone-base/60 rounded-xl outline-1 -outline-offset-1 outline-black/5 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-ink/5 pb-4">
              <span className="size-2 rounded-full bg-copper animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-ink/50">
                Atlas Guide · Session 042
              </span>
            </div>
            <div className="space-y-4 text-sm leading-relaxed">
              <p className="text-ink/50">
                <span className="text-copper mr-2">›</span>What is one act of
                stewardship you might carry into this week?
              </p>
              <p className="pl-6 text-ink/80">
                Reviewing the Meadowvale restoration proposal with my
                neighborhood circle.
              </p>
              <p className="text-ink/50">
                <span className="text-copper mr-2">›</span>Three community
                initiatives align with that intention. Shall we walk them
                together?
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 border-t border-ink/5">
              <input
                type="text"
                placeholder="Ask the Guide…"
                className="flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-ink/30"
              />
              <button className="text-[10px] uppercase tracking-widest text-copper hover:text-ink transition-colors">
                Offer →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Living Ledger */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-start">
            <div className="space-y-12">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-copper mb-4 block">
                  III. The Living Ledger
                </span>
                <h2 className="font-serif text-4xl md:text-5xl leading-tight text-balance max-w-[24ch]">
                  A new measure for a new civilization.
                </h2>
              </div>

              <div className="space-y-8">
                <div className="border-l border-ink/10 pl-8 space-y-2">
                  <h4 className="text-sm font-medium">Beyond Financial Return</h4>
                  <p className="text-sm text-ink/60 max-w-[40ch]">
                    We track the growth of wisdom, the restoration of soils,
                    and the strength of social bonds.
                  </p>
                </div>
                <div className="border-l border-ink/10 pl-8 space-y-2">
                  <h4 className="text-sm font-medium">The Flourishing Index</h4>
                  <p className="text-sm text-ink/60 max-w-[40ch]">
                    A real-time reflection of communal health, transparently
                    anchored in the ledger.
                  </p>
                </div>
                <div className="border-l border-ink/10 pl-8 space-y-2">
                  <h4 className="text-sm font-medium">Intergenerational Time</h4>
                  <p className="text-sm text-ink/60 max-w-[40ch]">
                    Every metric is scored against a seven-generation horizon,
                    not a quarterly one.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-stone-base rounded-xl outline-1 -outline-offset-1 outline-black/5 p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-ink/5 pb-4">
                <span className="text-[10px] font-medium">
                  HUMAN FLOURISHING INDEX
                </span>
                <span className="text-[10px] text-copper">STABLE · 84.2</span>
              </div>

              <div className="space-y-4">
                {metrics.map((m) => (
                  <div key={m.label} className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase">
                      <span>{m.label}</span>
                      <span>{m.delta}</span>
                    </div>
                    <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                      <div className="h-full bg-copper" style={{ width: m.width }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-parchment/50 rounded-lg border border-ink/5">
                  <span className="block text-[9px] text-ink/50 mb-1">
                    TOTAL IMPACT
                  </span>
                  <span className="text-lg font-serif">1,402 Units</span>
                </div>
                <div className="p-3 bg-parchment/50 rounded-lg border border-ink/5">
                  <span className="block text-[9px] text-ink/50 mb-1">
                    MEMBERSHIP
                  </span>
                  <span className="text-lg font-serif">8,291</span>
                </div>
              </div>

              <div className="w-full aspect-[2/1] rounded-lg overflow-hidden outline-1 -outline-offset-1 outline-black/5">
                <img
                  src={sacredGeometry}
                  alt="Sacred geometry visualization of community data"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="py-32 bg-ink text-parchment">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-[56ch] mx-auto text-center space-y-12">
            <div className="flex justify-center">
              <div className="size-12 border border-parchment/20 rotate-45 flex items-center justify-center">
                <div className="size-4 bg-copper" />
              </div>
            </div>
            <h3 className="font-serif text-3xl md:text-5xl leading-tight">
              Technology is treated as cathedral architecture: every interface
              must communicate wonder, trust, and permanence.
            </h3>
            <div className="space-y-6 pt-8">
              <p className="text-sm text-parchment/60 leading-relaxed">
                We do not build for the next quarter. We build for the next
                century. Atlas Sanctum is a covenant between those who seek
                wisdom and those who build the tools to house it.
              </p>
              <div className="h-px w-24 bg-copper/40 mx-auto" />
              <p className="text-sm text-parchment/60 leading-relaxed">
                Join the institution of the future. Stewardship is no longer
                optional.
              </p>
            </div>
            <div className="pt-4">
              <button className="bg-parchment text-ink px-6 py-2.5 rounded-full text-sm font-medium hover:-translate-y-px transition-transform">
                Request Covenant Membership
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-ink/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-serif text-xl">Atlas Sanctum</p>
            <p className="text-[10px] text-ink/40 uppercase tracking-widest">
              A Digital Cathedral Project
            </p>
          </div>

          <nav className="flex gap-12 text-xs uppercase tracking-widest text-ink/60">
            <a href="#" className="hover:text-copper transition-colors">
              The Modules
            </a>
            <a href="#" className="hover:text-copper transition-colors">
              The Ledger
            </a>
            <a href="#" className="hover:text-copper transition-colors">
              Covenant
            </a>
          </nav>

          <div className="text-[10px] text-ink/30">
            Established MMXXVI · All Rights Reserved
          </div>
        </div>
      </footer>
    </main>
  );
}
