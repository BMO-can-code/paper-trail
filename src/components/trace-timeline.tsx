import type { TraceStep } from "@/lib/types";

function dotClass(step: TraceStep) {
  if (step.status === "rejected") return "border-red bg-red";
  if (step.status === "error") return "border-red bg-red/70";
  if (step.status === "running") return "border-amber bg-amber animate-pulse";
  if (step.kind === "verdict") return "border-green bg-green";
  if (step.kind === "model") return "border-amber bg-amber";
  return "border-muted bg-panel2";
}

function statusText(step: TraceStep) {
  if (step.status === "rejected") return "text-red";
  if (step.status === "error") return "text-red";
  if (step.status === "running") return "text-amber";
  return "text-muted";
}

export function TraceTimeline({
  steps,
  live,
}: {
  steps: TraceStep[];
  live: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="eyebrow">Tool trace</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-amber animate-pulse" : "bg-line"}`}
            aria-hidden
          />
          {live ? "live" : `${steps.length} steps`}
        </span>
      </div>

      <ol className="max-h-[560px] space-y-4 overflow-y-auto px-4 py-4">
        {steps.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted">
            Waiting for the first step…
          </li>
        ) : null}

        {steps.map((step) => (
          <li key={step.id} className="trace-line relative pl-7">
            <span
              className={`absolute left-0 top-1 flex h-[1.1rem] w-[1.1rem] items-center justify-center rounded-full border ${dotClass(step)}`}
              aria-hidden
            >
              <span className="h-1 w-1 rounded-full bg-paper" />
            </span>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11.5px] leading-snug text-ink">
                  <span className="mr-1.5 text-muted">
                    {String(step.index).padStart(2, "0")}
                  </span>
                  {step.title}
                </p>
                {step.detail ? (
                  <p className="mt-1 line-clamp-2 break-words font-mono text-[10.5px] leading-relaxed text-muted">
                    {step.detail}
                  </p>
                ) : null}
              </div>
              <span className={`shrink-0 font-mono text-[10px] ${statusText(step)}`}>
                {step.status === "rejected"
                  ? "rejected"
                  : step.status === "running"
                    ? "…"
                    : step.ms != null
                      ? `${step.ms}ms`
                      : ""}
              </span>
            </div>

            {step.result ? (
              <p className="mt-1.5 rounded border border-line/70 bg-black/25 px-2 py-1 font-mono text-[10px] leading-relaxed text-muted">
                → {step.result}
              </p>
            ) : null}

            {step.tokensIn != null || step.tokensOut != null ? (
              <p className="mt-1 font-mono text-[10px] text-muted">
                tokens {step.tokensEstimated ? "~" : ""}
                {step.tokensIn ?? 0} in / {step.tokensOut ?? 0} out
              </p>
            ) : null}

            {step.args ? (
              <details className="mt-1.5">
                <summary className="cursor-pointer font-mono text-[10px] text-muted hover:text-ink">
                  args
                </summary>
                <pre className="mt-1 overflow-x-auto rounded border border-line/70 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-muted">
                  {JSON.stringify(step.args, null, 2)}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="border-t border-line px-4 py-2.5 font-mono text-[10px] text-muted">
        model → tool → result → model · capped at 8 turns
      </div>
    </div>
  );
}
