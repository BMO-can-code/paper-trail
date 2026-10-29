/**
 * Local contract-test stub. NOT part of the app and never deployed.
 * Emulates the OpenAI-compatible Nebius endpoint (SSE + tool calls) and the
 * two Tavily endpoints so the real agent loop can be exercised without keys.
 *
 * Run: node scripts/stub-upstream.mjs
 * Then: NEBIUS_API_KEY=test TAVILY_API_KEY=test \
 *       NEBIUS_BASE_URL=http://127.0.0.1:4010/v1 \
 *       TAVILY_BASE_URL=http://127.0.0.1:4010 npm run dev
 */
import http from "node:http";

const TEXT =
  "The test source states that verification requires an exact quote. " +
  "A paraphrase must be rejected by the checker before a claim is stored.";

const log = (...args) => console.log(new Date().toISOString(), ...args);

function sse(res, chunks) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const chunk of chunks) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function delta(content) {
  return {
    id: "chatcmpl-stub",
    object: "chat.completion.chunk",
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  };
}

function toolDelta(call) {
  return {
    id: "chatcmpl-stub",
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.args) },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

function finish(reason = "stop") {
  return {
    id: "chatcmpl-stub",
    object: "chat.completion.chunk",
    choices: [{ index: 0, delta: {}, finish_reason: reason }],
    usage: { prompt_tokens: 420, completion_tokens: 48 },
  };
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const payload = body ? JSON.parse(body) : {};
    log(req.method, req.url);

    if (req.url === "/v1/chat/completions") {
      const messages = payload.messages ?? [];
      const assists = messages.filter((m) => m.role === "assistant").length;
      let sourceId = "src_stub";
      const reads = messages.filter(
        (m) => m.role === "tool" && m.content.includes("source_id"),
      );
      if (reads.length) {
        try {
          sourceId = JSON.parse(reads[reads.length - 1].content).source_id;
        } catch {
          /* ignore */
        }
      }

      if (assists === 0) {
        return sse(res, [
          toolDelta({ id: "call_1", name: "web_search", args: { query: "test source" } }),
          finish("tool_calls"),
        ]);
      }
      if (assists === 1) {
        return sse(res, [
          toolDelta({
            id: "call_2",
            name: "read_source",
            args: { url: "https://example.org/test-source" },
          }),
          finish("tool_calls"),
        ]);
      }
      if (assists === 2) {
        return sse(res, [
          toolDelta({
            id: "call_3",
            name: "record_claim",
            args: {
              text: "Verification requires an exact quote.",
              source_id: sourceId,
              quote: "verification requires a quote that is close enough",
            },
          }),
          finish("tool_calls"),
        ]);
      }
      if (assists === 3) {
        return sse(res, [
          toolDelta({
            id: "call_4",
            name: "record_claim",
            args: {
              text: "Verification requires an exact quote.",
              source_id: sourceId,
              quote: TEXT,
            },
          }),
          finish("tool_calls"),
        ]);
      }
      return sse(res, [
        delta("The stub source supports one verified claim"),
        delta(": verification requires an exact quote."),
        finish("stop"),
      ]);
    }

    if (req.url === "/search") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          results: [
            {
              title: "Stub test source",
              url: "https://example.org/test-source",
              content: TEXT,
              score: 1,
            },
          ],
        }),
      );
    }

    if (req.url === "/extract") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          results: [{ url: "https://example.org/test-source", raw_content: TEXT }],
        }),
      );
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
});

server.listen(4010, "127.0.0.1", () => log("stub listening on 4010"));
