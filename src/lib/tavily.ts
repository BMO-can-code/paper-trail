// Production default. TAVILY_BASE_URL exists only for local contract tests;
// leave it unset in any deployed environment so calls go to api.tavily.com.
const TAVILY_BASE = process.env.TAVILY_BASE_URL ?? "https://api.tavily.com";

export class TavilyError extends Error {
  status?: number;
  hint: string;
  constructor(message: string, hint: string, status?: number) {
    super(message);
    this.name = "TavilyError";
    this.status = status;
    this.hint = hint;
  }
}

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

async function request<T>(
  path: "/search" | "/extract",
  payload: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<{ data: T; ms: number }> {
  const started = performance.now();
  let attempt = 0;
  let lastError: TavilyError | undefined;

  while (attempt < 2) {
    attempt += 1;
    let res: Response;
    try {
      res = await fetch(`${TAVILY_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      lastError = new TavilyError(
        "Could not reach Tavily.",
        "Network error calling api.tavily.com. Check connectivity and retry.",
      );
      if (attempt >= 2) throw lastError;
      continue;
    }

    const text = await res.text();
    if (!res.ok) {
      const detail = text.replace(/\s+/g, " ").slice(0, 240);
      lastError = new TavilyError(
        res.status === 401
          ? "Tavily rejected the API key."
          : `Tavily request failed (HTTP ${res.status}).`,
        res.status === 401
          ? "Check TAVILY_API_KEY in .env — it must start with tvly-."
          : detail || "Retry in a moment.",
        res.status,
      );
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw lastError;
    }

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new TavilyError(
        "Tavily returned unparseable JSON.",
        "This is upstream; retry the run.",
      );
    }

    const ms = Math.round(performance.now() - started);
    console.log(
      JSON.stringify({
        event: "tavily_call",
        endpoint: path,
        latencyMs: ms,
        attempts: attempt,
        ...(path === "/search"
          ? { results: (data as { results?: unknown[] }).results?.length ?? 0 }
          : { chars: ((data as { results?: { raw_content?: string }[] }).results?.[0]?.raw_content ?? "").length }),
      }),
    );
    return { data, ms };
  }

  throw lastError ?? new TavilyError("Tavily failed.", "Retry the run.");
}

export function tavilySearch(query: string, maxResults = 5) {
  return request<{ results: TavilySearchResult[] }>("/search", {
    query,
    search_depth: "basic",
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
  });
}

export function tavilyExtract(url: string) {
  return request<{
    results: Array<{ url: string; raw_content: string; title?: string }>;
    failed_results?: Array<{ url: string; error: string }>;
  }>("/extract", {
    urls: [url],
    extract_depth: "basic",
    format: "markdown",
    include_images: false,
  });
}
