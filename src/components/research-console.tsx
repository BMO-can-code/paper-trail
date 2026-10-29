"use client";

import { useEffect, useRef, useState } from "react";
import type { Brief, RunEvent, TraceStep } from "@/lib/types";
import { BriefView } from "./brief-view";
import { TraceTimeline } from "./trace-timeline";

const EXAMPLES = [
  "What does the EU AI Act require from providers of general-purpose AI models?",
  "How does the Node.js permission model restrict filesystem access?",
  "What is the current federal status of PFAS limits in US drinking water?",
];

type Status = "idle" | "running" | "done" | "error";

export function ResearchConsole({
  mock,
  model,
}: {
  mock: boolean;
  model: string;
}) {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [phase, setPhase] = useState("");
  const [narration, setNarration] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [isMockRun, setIsMockRun] = useState(mock);

  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const running = status === "running";

  function applyEvent(event: RunEvent, saw: { terminal: boolean }) {
    switch (event.type) {
      case "start":
        setIsMockRun(event.mock);
        setPhase("Starting");
        break;
      case "phase":
        setPhase(event.label);
        break;
      case "delta":
        setNarration((prev) => prev + event.text);
        break;
      case "step":
        setSteps((prev) =>
          prev.some((s) => s.id === event.step.id) ? prev : [...prev, event.step],
        );
        break;
      case "step_update":
        setSteps((prev) =>
          prev.map((s) => (s.id === event.id ? { ...s, ...event.patch } : s)),
        );
        break;
      case "brief":
        setBrief(event.brief);
        setStatus("done");
        saw.terminal = true;
        break;
      case "error":
        setError({ message: event.message, hint: event.hint });
        setStatus("error");
        saw.terminal = true;
        break;
    }
  }

  async function run() {
    const q = question.trim();
    if (q.length < 8 || running) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    stoppedRef.current = false;

    setSteps([]);
    setNarration("");
    setBrief(null);
    setError(null);
    setPhase("Connecting");
    setStatus("running");

    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    const saw = { terminal: false };

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Request failed (HTTP ${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              applyEvent(JSON.parse(payload) as RunEvent, saw);
            } catch {
              // Ignore a malformed frame; the stream continues.
            }
          }
        }
      }

      if (!saw.terminal && !stoppedRef.current) {
        setError({
          message: "The stream ended before a brief arrived.",
          hint: "The function may have hit its time limit. Retry, or narrow the question.",
        });
        setStatus("error");
      }
    } catch (err) {
      if (stoppedRef.current || controller.signal.aborted) {
        setStatus("idle");
        return;
      }
      setError({
        message: err instanceof Error ? err.message : "Request failed.",
        hint: "Check the server log and retry.",
      });
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function stop() {
    stoppedRef.current = true;
    abortRef.current?.abort();
    setStatus("idle");
    setPhase("Stopped by you");
  }

  return (
    <div>
      {isMockRun ? (
        <div className="mb-4 rounded-lg border border-amber/50 bg-amber/10 px-4 py-3 text-sm text-amber">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-amber px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper">
              MOCK MODE
            </span>
            <span>
              No API keys in this environment. The console runs a scripted trace
              with example.com sources and makes <strong>zero</strong> Nemotron or
              Tavily requests.
            </span>
          </div>
          <p className="mt-2 font-mono text-[11px] text-amber/80">
            Live mode: add both keys to <code>.env</code> and restart —{" "}
            <code>cp .env.example .env</code>
          </p>
        </div>
      ) : null}

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="question" className="eyebrow">
            Investigate
          </label>
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden />
            {model}
          </span>
        </div>

        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
          }}
          rows={3}
          maxLength={500}
          placeholder="What should the agent verify? Ask something with checkable, public evidence."
          className="mt-3 w-full resize-none rounded-lg border border-line bg-black/25 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted/60 focus:border-amber/70 focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuestion(example)}
              className="max-w-full truncate rounded-full border border-line px-3 py-1 text-left text-[11px] text-muted transition-colors hover:border-amber/60 hover:text-ink"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="font-mono text-[10.5px] leading-relaxed text-muted">
            max 8 turns · 10 tool calls · 55s wall clock · quotes checked
            server-side
          </p>
          <div className="flex items-center gap-2">
            {running ? (
              <button type="button" onClick={stop} className="btn-ghost">
                Stop
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void run()}
              disabled={running || question.trim().length < 8}
              className="btn-primary text-sm"
            >
              {running ? "Working…" : "Run investigation"}
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-6" />

      {(steps.length > 0 || brief || error || narration) && (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[350px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-6">
            {phase || status === "running" ? (
              <div className="flex items-center gap-2 px-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-amber" : "bg-line"}`}
                  aria-hidden
                />
                <span className="font-mono text-[11px] text-muted">
                  {phase || "Working"}
                </span>
              </div>
            ) : null}

            <TraceTimeline steps={steps} live={running} />

            {narration ? (
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">
                    {isMockRun ? "Narration (mock)" : "Nemotron · live"}
                  </span>
                  {running ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
                  ) : null}
                </div>
                <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink/80">
                  {narration}
                  {running ? <span className="text-amber">▍</span> : null}
                </p>
              </div>
            ) : null}
          </aside>

          <div className="min-w-0">
            {error ? (
              <div className="card border-red/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red" aria-hidden />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-red">
                    Run failed
                  </span>
                </div>
                <p className="mt-2 text-[15px] text-ink">{error.message}</p>
                {error.hint ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{error.hint}</p>
                ) : null}
                <p className="mt-3 text-sm text-muted">
                  The trace on the left shows the last step that completed. Nothing
                  was presented as verified fact.
                </p>
                <button
                  type="button"
                  onClick={() => void run()}
                  className="btn-primary mt-4 text-sm"
                >
                  Retry
                </button>
              </div>
            ) : brief ? (
              <BriefView brief={brief} />
            ) : (
              <div className="card p-6">
                <p className="font-serif text-2xl text-ink/80">
                  {running ? "Reading, checking, rejecting…" : "No brief yet."}
                </p>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
                  The agent is collecting sources. A claim only appears here after
                  the server finds its quote in the stored text — expect to see red
                  rejections in the trace before anything is accepted.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
