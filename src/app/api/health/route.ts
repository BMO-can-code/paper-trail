import { BASE_URL_DOC_URL, MOCK_MODE, NEBIUS_BASE_URL, NEBIUS_MODEL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      ok: true,
      mode: MOCK_MODE ? "mock" : "live",
      model: NEBIUS_MODEL,
      baseUrl: NEBIUS_BASE_URL,
      docs: BASE_URL_DOC_URL,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
