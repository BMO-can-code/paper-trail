import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefView } from "@/components/brief-view";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { isEphemeralStore, getBrief } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) notFound();

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 pb-10 sm:px-8">
        <Link href="/" className="btn-ghost mb-8">
          ← New investigation
        </Link>

        <BriefView brief={brief} permalink={false} />

        {isEphemeralStore() ? (
          <p className="mt-8 rounded-lg border border-line bg-panel px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
            Storage note: this deployment keeps briefs in /tmp, so this link can
            expire on a cold start. Set PAPERTRAIL_DATA_DIR to a mounted volume for
            durable history.
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
