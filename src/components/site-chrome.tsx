import Link from "next/link";

export const REPO_URL = "https://github.com/BMO-can-code/paper-trail";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="group flex items-baseline gap-2">
        <span className="font-serif text-2xl tracking-tight text-ink">
          Paper Trail
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        <a className="btn-ghost" href="#how-it-works">
          How it works
        </a>
        <a
          className="btn-ghost"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-5 pb-12 sm:px-8">
      <div className="hairline flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          <span className="font-serif text-base text-ink">Paper Trail</span> —
          a verification-first research agent.
        </p>
        <p className="font-mono text-[11px] text-muted">
          Built for the Nebius Token Factory × NVIDIA Nemotron hackathon · MIT
        </p>
      </div>
    </footer>
  );
}
