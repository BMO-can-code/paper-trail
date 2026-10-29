import { LIMITS, NEBIUS_BASE_URL, NEBIUS_MODEL } from "./config";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  estimated?: boolean;
};

export type ChatResult = {
  content: string;
  calls: ToolCall[];
  usage?: TokenUsage;
  ms: number;
  finishReason: string;
  attempts: number;
};

export class NemotronError extends Error {
  status?: number;
  hint: string;
  constructor(message: string, hint: string, status?: number) {
    super(message);
    this.name = "NemotronError";
    this.hint = hint;
    this.status = status;
  }
}

type StreamHandler = (event:
  | { type: "content"; text: string }
  | { type: "usage"; usage: TokenUsage }) => void;

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

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

function describe(status: number, body: string): NemotronError {
  const snippet = body.replace(/\s+/g, " ").slice(0, 300);
  if (status === 401 || status === 403) {
    return new NemotronError(
      `Nebius rejected the API key (HTTP ${status}).`,
      "Check NEBIUS_API_KEY in .env — it must be a Token Factory key from https://tokenfactory.nebius.com.",
      status,
    );
  }
  if (status === 404) {
    return new NemotronError(
      `Model not found on Nebius (HTTP 404).`,
      `NEBIUS_MODEL is "${NEBIUS_MODEL}". Confirm the exact ID at https://tokenfactory.nebius.com/model-catalog.md and set it in .env.`,
      status,
    );
  }
  if (status === 429) {
    return new NemotronError(
      "Nebius rate-limited the request (HTTP 429).",
      "Wait a moment and run again. The client already retried with backoff.",
      status,
    );
  }
  return new NemotronError(
    `Nebius request failed (HTTP ${status}).`,
    snippet ? `Upstream said: ${snippet}` : "Check your network and the Nebius status page.",
    status,
  );
}

/**
 * Streams one OpenAI-compatible chat completion.
 *
 * - retries 429/5xx with exponential backoff before any bytes are read
 * - forwards content deltas as they arrive
 * - accumulates streamed tool calls
 * - logs model, latency and token usage for every call
 */
export async function streamChat(
  input: {
    messages: ChatMessage[];
    tools?: ToolDef[];
    temperature?: number;
    maxTokens?: number;
    signal: AbortSignal;
  },
  onEvent?: StreamHandler,
): Promise<ChatResult> {
  const url = `${NEBIUS_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: NEBIUS_MODEL,
    messages: input.messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 1600,
    ...(input.tools ? { tools: input.tools, tool_choice: "auto" } : {}),
  };

  let attempt = 0;
  let res: Response | undefined;
  let lastBody = "";

  while (attempt < 3) {
    attempt += 1;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([
          input.signal,
          AbortSignal.timeout(LIMITS.modelTimeoutMs),
        ]),
      });
    } catch (error) {
      if (input.signal.aborted) throw error;
      if (attempt >= 3) {
        throw new NemotronError(
          "Could not reach Nebius Token Factory.",
          `Network error talking to ${NEBIUS_BASE_URL}. Check connectivity, then retry.`,
        );
      }
      await sleep(500 * 3 ** (attempt - 1) + Math.random() * 250, input.signal);
      continue;
    }

    if (res.ok) break;

    lastBody = await res.text().catch(() => "");
    if (!RETRYABLE.has(res.status) || attempt >= 3) {
      throw describe(res.status, lastBody);
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 600 * 3 ** (attempt - 1) + Math.random() * 300;
    console.warn(
      JSON.stringify({
        event: "nemotron_retry",
        status: res.status,
        attempt,
        waitMs: Math.round(wait),
      }),
    );
    await sleep(wait, input.signal);
  }

  if (!res || !res.ok || !res.body) {
    throw describe(res?.status ?? 500, lastBody);
  }

  const started = performance.now();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason = "";
  let usage: TokenUsage | undefined;
  const calls = new Map<number, { id: string; name: string; args: string }>();

  const consume = (payload: string) => {
    if (payload === "[DONE]") return;
    let chunk: {
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finish_reason?: string | null;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }
    if (chunk.usage?.prompt_tokens != null) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens,
        completion_tokens: chunk.usage.completion_tokens ?? 0,
      };
      onEvent?.({ type: "usage", usage });
    }
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta;
    if (delta?.content) {
      content += delta.content;
      onEvent?.({ type: "content", text: delta.content });
    }
    for (const tc of delta?.tool_calls ?? []) {
      const current =
        calls.get(tc.index) ?? { id: "", name: "", args: "" };
      if (tc.id) current.id = tc.id;
      if (tc.function?.name) current.name += tc.function.name;
      if (tc.function?.arguments) current.args += tc.function.arguments;
      calls.set(tc.index, current);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          consume(line.slice(5).trim());
        }
      }
    }
    for (const line of buffer.split(/\r?\n/)) {
      if (line.startsWith("data:")) consume(line.slice(5).trim());
    }
  } catch (error) {
    if (input.signal.aborted) throw error;
    throw new NemotronError(
      "The Nemotron stream was interrupted.",
      "Partial output was kept. Run again — the request is retried automatically before streaming starts.",
    );
  }

  const ms = Math.round(performance.now() - started);
  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, c]) => ({
      id: c.id || `call_${crypto.randomUUID().slice(0, 8)}`,
      type: "function" as const,
      function: { name: c.name, arguments: c.args || "{}" },
    }));

  const estimated = !usage;
  if (!usage) {
    usage = {
      prompt_tokens: Math.ceil(JSON.stringify(input.messages).length / 4),
      completion_tokens: Math.ceil(content.length / 4),
      estimated: true,
    };
  }

  console.log(
    JSON.stringify({
      event: "nemotron_call",
      model: NEBIUS_MODEL,
      provider: "nebius-token-factory",
      baseUrl: NEBIUS_BASE_URL,
      latencyMs: ms,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      tokensEstimated: estimated,
      toolCalls: toolCalls.length,
      attempts: attempt,
      finishReason: finishReason || "stop",
    }),
  );

  return {
    content,
    calls: toolCalls,
    usage,
    ms,
    finishReason: finishReason || "stop",
    attempts: attempt,
  };
}
