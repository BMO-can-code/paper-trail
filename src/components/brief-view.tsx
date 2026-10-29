import Link from "next/link";
import type { Brief, Source } from "@/lib/types";

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ms(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function num(value: number) {
  return value.toLocaleString("en-US");
}

function sourceFor(brief: Brief, id: string): Source | undefined {
  return brief.sources.find((s) => s.id === id);
}

export function BriefView({
  brief,
  permalink = true,
}: {
  brief: Brief;
  permalink?: boolean;
}) {
  const { meta } = brief;
  return (
    <article className="min-w-0">
      {meta.mock ? (
        <div className="mb-5 rounded-lg border border-amber/50 bg-amber/10 px-4 py-3 text-sm text-amber">
          <strong className="font-semibold">MOCK RUN.</strong> Scripted trace,
          example.com sources, zero Nemotron and zero Tavily requests.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow text-amber">Verified brief</span>
        <span className="h-px w-8 bg-line" aria-hidden />
        <span className="eyebrow">{new Date(meta.createdAt).toUTCString()}</span>
      </div>

      <h2 className="mt-4 font-serif text-3xl leading-[1.12] tracking-tight sm:text-4xl">
        {brief.question}
      </h2>

      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink/90">
        {brief.summary}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="pill">
          <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden />
          {brief.claims.length} verified claim{brief.claims.length === 1 ? "" : "s"}
        </span>
        <span className="pill">{brief.sources.length} stored source{brief.sources.length === 1 ? "" : "s"}</span>
        <span className="pill">{ms(meta.totalMs)} end-to-end</span>
        {permalink ? (
          <Link className="pill hover:border-amber hover:text-ink" href={`/brief/${brief.id}`}>
            Permalink ↗
          </Link>
        ) : null}
      </div>

      <section className="mt-10" aria-labelledby="claims-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="claims-heading" className="eyebrow">
            Claims &amp; receipts
          </h3>
          <span className="text-[11px] text-muted">
            quote checked server-side
          </span>
        </div>

        <ol className="mt-4 space-y-4">
          {brief.claims.map((claim, i) => {
            const source = sourceFor(brief, claim.sourceId);
            return (
              <li key={claim.id} className="card p-5">
                <div className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber/40 font-mono text-xs text-amber">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15.5px] leading-relaxed text-ink">
                      {claim.text}
                    </p>
                    <blockquote className="mt-3 border-l-2 border-amber/60 bg-black/20 px-4 py-3 font-serif text-[17px] leading-snug text-ink/85">
                      “{claim.quote}”
                    </blockquote>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-muted">
                      {source ? (
                        <a
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3 py-1 font-mono text-[11px] text-ink/80 transition-colors hover:border-amber hover:text-amber"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <span className="h-1 w-1 rounded-full bg-green" aria-hidden />
                          <span className="truncate">{host(source.url)}</span>
                          <span aria-hidden>↗</span>
                        </a>
                      ) : null}
                      <a
                        className="font-mono text-[11px] text-muted underline decoration-line underline-offset-4 hover:text-ink"
                        href={`#source-${claim.sourceId}`}
                      >
                        jump to stored text
                      </a>
                      {source?.mock ? (
                        <span className="rounded bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] text-amber">
                          MOCK
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="sources-heading">
        <h3 id="sources-heading" className="eyebrow">
          Stored sources
        </h3>
        <p className="mt-2 text-sm text-muted">
          Full text was fetched at runtime with Tavily extract and kept for quote
          checks. Search snippets were never treated as evidence.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {brief.sources.map((source, i) => (
            <li key={source.id}>
              <a
                id={`source-${source.id}`}
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="source-card card block h-full p-4 transition-colors hover:border-amber/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    Source {i + 1}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {num(source.chars)} chars
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-snug text-ink">
                  {source.title}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-amber/90">
                  {host(source.url)} ↗
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t border-line pt-5">
        <h3 className="eyebrow">Run metadata</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-[11px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">model</dt>
            <dd className="mt-0.5 break-all text-ink">{meta.model}</dd>
          </div>
          <div>
            <dt className="text-muted">provider</dt>
            <dd className="mt-0.5 text-ink">{meta.provider}</dd>
          </div>
          <div>
            <dt className="text-muted">tokens in / out</dt>
            <dd className="mt-0.5 text-ink">
              {meta.mock ? "—" : `${meta.tokensEstimated ? "~" : ""}${num(meta.tokensIn)} / ${num(meta.tokensOut)}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted">model latency</dt>
            <dd className="mt-0.5 text-ink">{meta.mock ? "—" : ms(meta.modelMs)}</dd>
          </div>
          <div>
            <dt className="text-muted">tool calls</dt>
            <dd className="mt-0.5 text-ink">{meta.toolCalls}</dd>
          </div>
          <div>
            <dt className="text-muted">tavily calls</dt>
            <dd className="mt-0.5 text-ink">{meta.tavilyCalls}</dd>
          </div>
          <div>
            <dt className="text-muted">turns</dt>
            <dd className="mt-0.5 text-ink">{meta.iterations}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">run id</dt>
            <dd className="mt-0.5 break-all text-ink">{brief.id}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
