import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefView } from "@/components/brief-view";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { decodeBrief } from "@/lib/permalink";
import { isEphemeralStore, getBrief } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ b?: string | string[] }>;
}) {
  const { id } = await params;
  const { b } = await searchParams;
  const payload = typeof b === "string" ? b : undefined;

  // A self-contained link survives Vercel's per-instance /tmp; prefer the
  // server copy when it exists, since that one is authoritative.
  const stored = await getBrief(id);
  const carried = payload ? decodeBrief(payload) : null;
  const brief = stored ?? (carried?.id === id ? carried : null);
  if (!brief) notFound();

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 pb-10 sm:px-8">
        <Link href="/" className="btn-ghost mb-8">
          ← New investigation
        </Link>

        <BriefView brief={brief} permalink={false} />

        {isEphemeralStore() && !carried ? (
          <p className="mt-8 rounded-lg border border-line bg-panel px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
            Storage note: this deployment keeps briefs in /tmp, so this link can
            expire on a cold start. Links copied from a run carry a compressed
            copy of the brief and survive a cold start. Set PAPERTRAIL_DATA_DIR
            to a mounted volume for durable server-side history.
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
