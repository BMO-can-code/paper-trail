import { LIMITS } from "./config";
import { tavilyExtract, tavilySearch, TavilyError } from "./tavily";
import type { Claim, Source, TraceStep } from "./types";

export type ToolEmitter = {
  step: (step: TraceStep) => void;
  update: (id: string, patch: Partial<TraceStep>) => void;
  delta: (text: string) => void;
  phase: (label: string) => void;
};

export type RunState = {
  id: string;
  question: string;
  sources: Source[];
  sourceText: Map<string, string>;
  claims: Claim[];
  searches: number;
  reads: number;
  toolCalls: number;
  tavilyCalls: number;
  stepIndex: number;
  modelMs: number;
  tokensIn: number;
  tokensOut: number;
  tokensEstimated: boolean;
  fallbackTitle: string;
};

export class AgentError extends Error {
  hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "AgentError";
    this.hint = hint;
  }
}

export class FatalToolError extends Error {
  hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.hint = hint;
  }
}

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?|.*\.local|.*\.internal)$/i;

function assertSafeUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs can be read.");
  }
  if (PRIVATE_HOST.test(url.hostname) || url.hostname.endsWith(".localhost")) {
    throw new Error("Private and loopback hosts are blocked.");
  }
  return url;
}

export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function newStep(
  state: RunState,
  kind: TraceStep["kind"],
  title: string,
  detail?: string,
): TraceStep {
  state.stepIndex += 1;
  return {
    id: `s${state.stepIndex}-${crypto.randomUUID().slice(0, 6)}`,
    index: state.stepIndex,
    kind,
    title,
    detail,
    status: "running",
  };
}

function short(value: unknown, max = 220) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the live web with Tavily. Returns titles, URLs and short snippets. Snippets are NOT citable: you must call read_source first.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Specific search query, 3-12 words." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_source",
      description:
        "Fetch and store the full text of one URL with Tavily extract. Returns a preview starting at `offset`. Source text is cached for quote verification.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "http(s) URL from web_search results." },
          offset: {
            type: "integer",
            description: "Character offset to read from. Default 0.",
            minimum: 0,
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_claim",
      description:
        "Record one factual claim with a verbatim quote from a stored source. The server checks the quote character-for-character (whitespace and case normalized). Paraphrases are rejected.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The claim, one sentence, no citation markers." },
          source_id: { type: "string", description: "ID returned by read_source." },
          quote: {
            type: "string",
            description:
              "Exact sentence copied from the stored source, 12-600 characters. No ellipses.",
          },
        },
        required: ["text", "source_id", "quote"],
      },
    },
  },
];

type ToolResult = { forModel: string };

export async function executeTool(
  name: string,
  rawArgs: string,
  state: RunState,
  emit: ToolEmitter,
): Promise<ToolResult> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
  } catch {
    return { forModel: JSON.stringify({ error: "Arguments were not valid JSON." }) };
  }

  state.toolCalls += 1;
  if (state.toolCalls > LIMITS.maxToolCalls) {
    return {
      forModel: JSON.stringify({
        error: `Tool-call cap (${LIMITS.maxToolCalls}) reached. Stop calling tools and write the summary now.`,
      }),
    };
  }

  const started = performance.now();
  const step = newStep(state, "tool", `${name}`, short(args));
  step.tool = name;
  step.args = args;
  emit.step(step);
  const finish = (patch: Partial<TraceStep>) =>
    emit.update(step.id, { ...patch, ms: Math.round(performance.now() - started) });

  try {
    if (name === "web_search") {
      if (state.searches >= LIMITS.maxSearches) {
        finish({ status: "error", result: "Search cap reached" });
        return {
          forModel: JSON.stringify({
            error: `Search cap (${LIMITS.maxSearches}) reached. Read an existing result or record claims from sources you already have.`,
          }),
        };
      }
      state.searches += 1;
      const query = String(args.query ?? "").trim();
      if (query.length < 3) throw new Error("Query is too short.");
      const { data, ms } = await tavilySearch(query, 5);
      state.tavilyCalls += 1;
      finish({
        status: "ok",
        result: `${data.results.length} results in ${ms}ms`,
      });
      return {
        forModel: JSON.stringify({
          results: data.results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: short(r.content, 420),
          })),
          next: "Call read_source on the most authoritative URL before citing anything.",
        }),
      };
    }

    if (name === "read_source") {
      if (state.reads >= LIMITS.maxSourceReads) {
        finish({ status: "error", result: "Source-read cap reached" });
        return {
          forModel: JSON.stringify({
            error: `Source-read cap (${LIMITS.maxSourceReads}) reached. Use stored sources and record claims, then finish.`,
          }),
        };
      }
      const url = assertSafeUrl(String(args.url ?? "").trim());
      const offset = Math.max(0, Number(args.offset ?? 0) | 0);
      let source = state.sources.find((s) => s.url === url.toString());
      let elapsed = 0;

      if (!source) {
        state.reads += 1;
        const { data, ms } = await tavilyExtract(url.toString());
        state.tavilyCalls += 1;
        elapsed = ms;
        const item = data.results?.[0];
        if (!item?.raw_content) {
          const reason = data.failed_results?.[0]?.error ?? "No text extracted.";
          finish({ status: "error", result: reason });
          return {
            forModel: JSON.stringify({
              error: `Could not extract that URL: ${reason}. Try another result.`,
            }),
          };
        }
        source = {
          id: `src_${crypto.randomUUID().slice(0, 8)}`,
          url: url.toString(),
          title: item.title || url.hostname,
          chars: item.raw_content.length,
          fetchedAt: new Date().toISOString(),
        };
        state.sources.push(source);
        state.sourceText.set(source.id, item.raw_content);
        finish({
          status: "ok",
          result: `${source.chars.toLocaleString()} chars in ${elapsed}ms → ${source.id}`,
        });
      } else {
        finish({ status: "ok", result: `cached ${source.chars.toLocaleString()} chars → ${source.id}` });
      }

      const text = state.sourceText.get(source.id) ?? "";
      const preview = text.slice(offset, offset + 2000);
      return {
        forModel: JSON.stringify({
          source_id: source.id,
          title: source.title,
          url: source.url,
          total_chars: text.length,
          offset,
          preview,
          note:
            text.length > offset + 2000
              ? `Preview truncated. Call read_source again with offset=${offset + 2000} for more.`
              : "Full text is now stored. Copy quotes exactly.",
        }),
      };
    }

    if (name === "record_claim") {
      const claimText = String(args.text ?? "").trim();
      const quote = String(args.quote ?? "").trim();
      const sourceId = String(args.source_id ?? "").trim();
      const source = state.sources.find((s) => s.id === sourceId);
      const body = state.sourceText.get(sourceId);

      const reject = (reason: string, title: string) => {
        state.stepIndex += 1;
        const verdict: TraceStep = {
          id: `s${state.stepIndex}-${crypto.randomUUID().slice(0, 6)}`,
          index: state.stepIndex,
          kind: "verdict",
          title,
          detail: short(claimText, 180),
          status: "rejected",
          ms: Math.round(performance.now() - started),
        };
        emit.step(verdict);
        finish({ status: "ok", result: "verdict emitted" });
        return {
          forModel: JSON.stringify({
            accepted: false,
            reason,
            hint:
              "Find a sentence in the source preview and copy it exactly, or read a different source. The quote must appear verbatim.",
          }),
        };
      };

      if (!source || !body) {
        return reject("Unknown source_id. Call read_source first.", "Claim rejected: unknown source");
      }
      if (claimText.length < 8) {
        return reject("Claim text is too short.", "Claim rejected: empty claim");
      }
      if (quote.length < LIMITS.quoteMinChars || quote.length > LIMITS.quoteMaxChars) {
        return reject(
          `Quote must be ${LIMITS.quoteMinChars}-${LIMITS.quoteMaxChars} characters.`,
          "Claim rejected: quote length",
        );
      }
      if (state.claims.length >= LIMITS.maxClaims) {
        return reject(
          `Claim cap (${LIMITS.maxClaims}) reached.`,
          "Claim rejected: cap reached",
        );
      }
      if (state.claims.some((c) => normalize(c.quote) === normalize(quote))) {
        return reject("Duplicate quote.", "Claim rejected: duplicate");
      }

      const exactAt = body.indexOf(quote);
      const normBody = normalize(body);
      const normQuote = normalize(quote);
      const normAt = normBody.toLowerCase().indexOf(normQuote.toLowerCase());

      if (exactAt === -1 && normAt === -1) {
        return reject(
          `Quote not found verbatim in ${sourceId} (${body.length.toLocaleString()} chars searched).`,
          "Claim rejected: quote not found",
        );
      }

      const context =
        exactAt >= 0
          ? normalize(body.slice(Math.max(0, exactAt - 180), exactAt + quote.length + 180))
          : normalize(normBody.slice(Math.max(0, normAt - 180), normAt + normQuote.length + 180));

      const claim: Claim = {
        id: `claim_${crypto.randomUUID().slice(0, 8)}`,
        text: claimText,
        sourceId,
        quote,
        context,
        verifiedAt: new Date().toISOString(),
      };
      state.claims.push(claim);
      finish({ status: "ok", result: `verified → ${claim.id}` });

      state.stepIndex += 1;
      emit.step({
        id: `s${state.stepIndex}-${crypto.randomUUID().slice(0, 6)}`,
        index: state.stepIndex,
        kind: "verdict",
        title: "Claim verified",
        detail: short(claimText, 180),
        status: "ok",
        ms: Math.round(performance.now() - started),
      });

      return {
        forModel: JSON.stringify({
          accepted: true,
          claim_id: claim.id,
          verified_claims: state.claims.length,
          remaining: LIMITS.maxClaims - state.claims.length,
        }),
      };
    }

    finish({ status: "error", result: "Unknown tool" });
    return { forModel: JSON.stringify({ error: `Unknown tool: ${name}` }) };
  } catch (error) {
    if (error instanceof TavilyError) {
      finish({ status: "error", result: error.message });
      if (error.status === 401 || error.status === 403) {
        throw new FatalToolError(error.message, error.hint);
      }
      return {
        forModel: JSON.stringify({
          error: error.message,
          hint: "Try another URL or skip this source.",
        }),
      };
    }
    const message = error instanceof Error ? error.message : "Tool failed.";
    finish({ status: "error", result: message });
    return {
      forModel: JSON.stringify({
        error: message,
        hint: "Adjust the arguments and try again, or finish with the claims you have.",
      }),
    };
  }
}
