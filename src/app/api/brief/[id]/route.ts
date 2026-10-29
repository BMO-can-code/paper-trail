import { decodeBrief } from "@/lib/permalink";
import { getBrief } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = new URL(request.url).searchParams.get("b") ?? undefined;

  const stored = await getBrief(id);
  const carried = payload ? decodeBrief(payload) : null;
  const brief = stored ?? (carried?.id === id ? carried : null);

  if (!brief) {
    return Response.json(
      {
        error: "Brief not found.",
        hint: "Copied permalink URLs include ?b=… so they work without the server copy.",
      },
      { status: 404 },
    );
  }
  return Response.json(brief, {
    headers: { "Cache-Control": "no-store" },
  });
}
