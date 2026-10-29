import { ResearchConsole } from "@/components/research-console";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { MOCK_MODE, NEBIUS_MODEL } from "@/lib/config";

const SPECIMEN = [
  { label: "web_search", meta: "5 results · 412ms", tone: "text-ink" },
  { label: "read_source", meta: "18,204 chars stored · 631ms", tone: "text-ink" },
  { label: "claim rejected", meta: "quote not found in stored text", tone: "text-red" },
  { label: "read_source", meta: "second source · 588ms", tone: "text-ink" },
  { label: "claim verified", meta: "verbatim match · 3ms", tone: "text-green" },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <section className="grid gap-10 pb-12 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-16">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
              Best apps &amp; agents · Nemotron on Nebius
            </p>
            <h1 className="mt-5 font-serif text-[3.35rem] leading-[0.98] tracking-tight sm:text-7xl">
              Research that shows its{" "}
              <em className="text-amber">receipts.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-ink/80">
              Paper Trail is a Nemotron agent that reads the sources, then refuses
              to state anything it cannot quote. Every claim carries a verbatim
              receipt and a link. Rejected claims stay visible in the trace.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="pill">
                <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden />
                Nemotron 3 Super · Nebius Token Factory
              </span>
              <span className="pill">Tavily at runtime</span>
              <span className="pill">Full tool trace</span>
              <span className="pill">MIT</span>
            </div>
          </div>

          <div className="card relative overflow-hidden p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Trace specimen</span>
              <span className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-muted">
                STATIC
              </span>
            </div>
            <ol className="mt-4 space-y-3">
              {SPECIMEN.map((row, i) => (
                <li key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[10px] text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      row.tone === "text-red"
                        ? "bg-red"
                        : row.tone === "text-green"
                          ? "bg-green"
                          : "bg-amber"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className={`font-mono text-[11.5px] ${row.tone}`}>
                      {row.label}
                    </p>
                    <p className="font-mono text-[10px] text-muted">{row.meta}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-muted">
              The demo is built around the red step: the model cites a paraphrase,
              the server rejects it, the model retries with a real source.
            </p>
          </div>
        </section>

        <section aria-label="Run the agent" className="pb-4">
          <ResearchConsole mock={MOCK_MODE} model={NEBIUS_MODEL} />
        </section>

        <section id="how-it-works" className="scroll-mt-8 pt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">
                A claim has to survive the loop.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              The model is not trusted to grade its own homework. Tool results go
              back into the loop; a deterministic checker decides what counts.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Search real pages",
                body: "Nemotron calls Tavily /search. Snippets are leads only — never cited.",
              },
              {
                n: "02",
                title: "Store the full text",
                body: "Tavily /extract fetches the page. The backend keeps the text and returns a source id.",
              },
              {
                n: "03",
                title: "Check every quote",
                body: "The server looks for the quote in the stored text. Paraphrases are rejected and fed back.",
              },
              {
                n: "04",
                title: "Write from receipts",
                body: "The brief is synthesized only from accepted claims. The trace shows the rest.",
              },
            ].map((card) => (
              <div key={card.n} className="card p-5">
                <span className="font-mono text-[10px] text-amber">{card.n}</span>
                <h3 className="mt-3 font-serif text-xl tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-16 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="eyebrow">Why the model is load-bearing</p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight">
              Remove Nemotron and the loop has no planner.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
              There is no keyword pipeline hidden underneath. The model chooses
              every query, decides which pages to read, turns text into atomic
              claims, and writes the final brief. The checker only says yes or no
              to a quote; it cannot research on its own.
            </p>
          </div>
          <ul className="space-y-3 border-l border-line pl-6 text-sm">
            {[
              ["Planner", "decomposes the question and picks the next tool"],
              ["Extractor", "turns stored source text into candidate claims"],
              ["Synthesizer", "writes the brief strictly from accepted claims"],
            ].map(([term, def]) => (
              <li key={term}>
                <span className="font-mono text-[11px] text-amber">{term}</span>
                <p className="mt-1 text-muted">{def}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
