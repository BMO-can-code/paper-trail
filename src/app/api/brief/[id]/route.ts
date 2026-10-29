import { getBrief } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) {
    return Response.json(
      { error: "Brief not found. On Vercel, run history is ephemeral." },
      { status: 404 },
    );
  }
  return Response.json(brief, {
    headers: { "Cache-Control": "no-store" },
  });
}
