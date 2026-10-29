import { runAgent, AgentError } from "@/lib/agent";
import { LIMITS, MOCK_MODE, NEBIUS_MODEL } from "@/lib/config";
import { runMock } from "@/lib/mock";
import type { RunEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Body must be JSON: {\"question\":\"...\"}", 400);
  }

  const question =
    typeof payload === "object" && payload !== null && "question" in payload
      ? String((payload as { question: unknown }).question ?? "").trim()
      : "";

  if (question.length < 8) {
    return jsonError("Ask a question of at least 8 characters.", 400);
  }
  if (question.length > 500) {
    return jsonError("Keep the question under 500 characters.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const controllerAbort = new AbortController();
      const onAbort = () => controllerAbort.abort(new Error("client disconnected"));
      request.signal.addEventListener("abort", onAbort);

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controllerAbort.abort(new Error("run timeout"));
      }, LIMITS.runTimeoutMs);

      const runner = MOCK_MODE ? runMock : runAgent;

      void (async () => {
        try {
          await runner(question, send, controllerAbort.signal);
        } catch (error) {
          if (controllerAbort.signal.aborted && !timedOut) {
            // The browser went away; nobody is listening.
            return;
          }
          if (timedOut) {
            send({
              type: "error",
              message: `The run exceeded ${LIMITS.runTimeoutMs / 1000}s and was stopped.`,
              hint: "Narrow the question, or raise LIMITS.runTimeoutMs and the route's maxDuration together.",
            });
          } else if (error instanceof AgentError) {
            send({ type: "error", message: error.message, hint: error.hint });
          } else {
            const message =
              error instanceof Error ? error.message : "Unexpected server error.";
            console.error(
              JSON.stringify({ event: "run_error", message, model: NEBIUS_MODEL }),
            );
            send({
              type: "error",
              message: "The run failed unexpectedly.",
              hint: "Check the server log for the run_error entry, then retry.",
            });
          }
        } finally {
          clearTimeout(timer);
          request.signal.removeEventListener("abort", onAbort);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // already closed by the client
            }
          }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Paper-Trail-Mock": MOCK_MODE ? "1" : "0",
      "X-Paper-Trail-Model": NEBIUS_MODEL,
    },
  });
}
