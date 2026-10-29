import { NEBIUS_MODEL } from "./config";
import { saveBrief } from "./store";
import type { Brief, Claim, RunEvent, Source, TraceStep } from "./types";

/**
 * Scripted, deterministic run used ONLY when a key is missing (or MOCK_MODE=1).
 * It performs zero network calls, uses example.com sources, and every surface
 * is labelled MOCK. It exists so the UI and trace are reviewable without keys.
 */
const MOCK_SOURCE_A = `MOCK SOURCE - this text is synthetic and is not a real publication.
The mock agent rejects a claim when its quote is not found verbatim in the stored source.
Rejected claims are sent back to the model so it can correct the citation.
This run used zero Nemotron and zero Tavily requests.`;

const MOCK_SOURCE_B = `MOCK SOURCE - this text is synthetic and is not a real publication.
A verification-first agent records a claim only after the server finds the exact quote in a stored source.
Every citation chip in the interface points at the sentence that was checked, not at a search snippet.`;

const MOCK_CLAIMS: Array<{ text: string; quote: string; source: "a" | "b" }> = [
  {
    text: "The mock agent rejects a claim when its quote is not found verbatim in the stored source.",
    quote:
      "The mock agent rejects a claim when its quote is not found verbatim in the stored source.",
    source: "a",
  },
  {
    text: "Rejected claims are sent back to the model so it can correct the citation.",
    quote: "Rejected claims are sent back to the model so it can correct the citation.",
    source: "a",
  },
  {
    text: "A verification-first agent records a claim only after the server finds the exact quote in a stored source.",
    quote:
      "A verification-first agent records a claim only after the server finds the exact quote in a stored source.",
    source: "b",
  },
];

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function runMock(
  question: string,
  emit: (event: RunEvent) => void,
  signal: AbortSignal,
): Promise<Brief> {
  const started = performance.now();
  const runId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const trace: TraceStep[] = [];
  let index = 0;

  const push = (step: Omit<TraceStep, "id" | "index">) => {
    index += 1;
    const full: TraceStep = {
      ...step,
      id: `mock-${index}`,
      index,
    };
    trace.push(full);
    emit({ type: "step", step: full });
    return full;
  };

  const sources: Source[] = [
    {
      id: "src_mock_a",
      url: "https://example.com/mock-source-a",
      title: "MOCK — synthetic source A",
      chars: MOCK_SOURCE_A.length,
      fetchedAt: new Date().toISOString(),
      mock: true,
    },
    {
      id: "src_mock_b",
      url: "https://example.com/mock-source-b",
      title: "MOCK — synthetic source B",
      chars: MOCK_SOURCE_B.length,
      fetchedAt: new Date().toISOString(),
      mock: true,
    },
  ];

  emit({ type: "start", runId, mock: true, model: NEBIUS_MODEL });
  emit({ type: "phase", label: "MOCK — scripted trace, no API calls" });
  await sleep(420, signal);

  push({
    kind: "tool",
    title: "web_search",
    detail: '{"query":"mock verification run"}',
    status: "ok",
    tool: "web_search",
    args: { query: "mock verification run" },
    result: "2 MOCK results",
    ms: 380,
  });
  await sleep(520, signal);

  push({
    kind: "tool",
    title: "read_source",
    detail: '{"url":"https://example.com/mock-source-a"}',
    status: "ok",
    tool: "read_source",
    args: { url: "https://example.com/mock-source-a" },
    result: `${MOCK_SOURCE_A.length} chars → src_mock_a`,
    ms: 540,
  });
  await sleep(380, signal);

  push({
    kind: "verdict",
    title: "Claim rejected: quote not found",
    detail: "Paraphrased quote — the demo's failure path.",
    status: "rejected",
    ms: 3,
  });
  await sleep(640, signal);

  push({
    kind: "tool",
    title: "read_source",
    detail: '{"url":"https://example.com/mock-source-b"}',
    status: "ok",
    tool: "read_source",
    args: { url: "https://example.com/mock-source-b" },
    result: `${MOCK_SOURCE_B.length} chars → src_mock_b`,
    ms: 500,
  });
  await sleep(360, signal);

  const claims: Claim[] = [];
  for (const [i, item] of MOCK_CLAIMS.entries()) {
    const source = item.source === "a" ? sources[0] : sources[1];
    const body = item.source === "a" ? MOCK_SOURCE_A : MOCK_SOURCE_B;
    const at = body.indexOf(item.quote);
    if (at === -1) continue;
    const claim: Claim = {
      id: `claim_mock_${i + 1}`,
      text: item.text,
      sourceId: source.id,
      quote: item.quote,
      context: body.slice(Math.max(0, at - 40), at + item.quote.length + 40),
      verifiedAt: new Date().toISOString(),
    };
    claims.push(claim);
    push({
      kind: "verdict",
      title: "Claim verified",
      detail: item.text,
      status: "ok",
      ms: 2,
    });
    await sleep(260, signal);
  }

  const summary =
    "This is a scripted mock run, not a live research result. It shows the shape of the trace: search, source read, a rejected paraphrase, a retry, then verified claims. Add NEBIUS_API_KEY and TAVILY_API_KEY to run the real agent.";

  emit({ type: "phase", label: "Writing the brief (MOCK)" });
  for (const word of summary.split(" ")) {
    emit({ type: "delta", text: `${word} ` });
    await sleep(18, signal);
  }

  const brief: Brief = {
    id: runId,
    question,
    title: "MOCK RUN — how Paper Trail verifies a claim",
    summary,
    claims,
    sources,
    trace,
    meta: {
      model: "MOCK — no model called",
      provider: "Nebius Token Factory (not called in mock mode)",
      baseUrl: "",
      iterations: 0,
      toolCalls: 2,
      tavilyCalls: 0,
      modelMs: 0,
      totalMs: Math.round(performance.now() - started),
      tokensIn: 0,
      tokensOut: 0,
      tokensEstimated: false,
      mock: true,
      createdAt: new Date().toISOString(),
    },
  };

  await saveBrief(brief);
  emit({ type: "brief", brief });
  return brief;
}
