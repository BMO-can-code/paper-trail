import { LIMITS, NEBIUS_BASE_URL, NEBIUS_MODEL } from "./config";
import { streamChat, type ChatMessage, type NemotronError } from "./nemotron";
import { newRunId, saveBrief } from "./store";
import {
  AgentError,
  executeTool,
  FatalToolError,
  newStep,
  TOOL_DEFS,
  type RunState,
  type ToolEmitter,
} from "./tools";
import type { Brief, RunEvent, TraceStep } from "./types";

const SYSTEM_PROMPT = `You are Paper Trail, a verification-first research agent.

Your job: answer the user's question with a small set of claims that are each backed by an exact quote from a source you actually read.

Rules:
1. Break the question into 2-4 sub-questions. Start with web_search.
2. Search snippets are leads, not evidence. You MUST call read_source before citing a URL.
3. Record every factual claim with record_claim. The quote must be copied EXACTLY from the stored source preview - no paraphrase, no ellipses, 12-600 characters. Quotes are checked character-for-character server-side.
4. If a claim is rejected, do not resend the same quote. Read more of the source (increase offset) or use a different source.
5. Prefer primary sources (regulator, company filing, official docs, paper) over aggregators. Never invent numbers, dates, names or quotes.
6. Aim for 3-6 verified claims. Quality beats quantity.
7. When you have enough, STOP calling tools and reply with 2-3 plain sentences summarising ONLY what the verified claims say. No citations, no headings, no markdown.

If the web does not support the premise of the question, say so instead of manufacturing support.`;

type Emit = (event: RunEvent) => void;

function indexTrace(trace: TraceStep[], step: TraceStep) {
  if (!trace.some((s) => s.id === step.id)) trace.push(step);
}

export async function runAgent(
  question: string,
  emit: Emit,
  signal: AbortSignal,
): Promise<Brief> {
  const started = performance.now();
  const runId = newRunId();
  const trace: TraceStep[] = [];

  const state: RunState = {
    id: runId,
    question,
    sources: [],
    sourceText: new Map(),
    claims: [],
    searches: 0,
    reads: 0,
    toolCalls: 0,
    tavilyCalls: 0,
    stepIndex: 0,
    modelMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    tokensEstimated: false,
    fallbackTitle: question.replace(/\s+/g, " ").trim().slice(0, 90),
  };

  const emitter: ToolEmitter = {
    step: (step) => {
      indexTrace(trace, step);
      emit({ type: "step", step });
    },
    update: (id, patch) => {
      const existing = trace.find((s) => s.id === id);
      if (existing) Object.assign(existing, patch);
      emit({ type: "step_update", id, patch });
    },
    delta: (text) => emit({ type: "delta", text }),
    phase: (label) => emit({ type: "phase", label }),
  };

  emit({ type: "start", runId, mock: false, model: NEBIUS_MODEL });
  emitter.phase("Plan → search → read → verify");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  let summary = "";
  let turns = 0;

  try {
    for (; turns < LIMITS.maxTurns; turns += 1) {
      if (signal.aborted) throw signal.reason;

      const step = newStep(state, "model", `Nemotron · turn ${turns + 1}`);
      emitter.step(step);

      const result = await streamChat(
        { messages, tools: TOOL_DEFS, signal },
        (event) => {
          if (event.type === "content") emitter.delta(event.text);
        },
      );

      state.modelMs += result.ms;
      if (result.usage) {
        state.tokensIn += result.usage.prompt_tokens;
        state.tokensOut += result.usage.completion_tokens;
        if (result.usage.estimated) state.tokensEstimated = true;
      }

      emitter.update(step.id, {
        status: "ok",
        ms: result.ms,
        tokensIn: result.usage?.prompt_tokens,
        tokensOut: result.usage?.completion_tokens,
        tokensEstimated: result.usage?.estimated,
        detail: result.calls.length
          ? `${result.calls.length} tool call${result.calls.length > 1 ? "s" : ""}`
          : "message",
      });

      if (result.calls.length > 0) {
        messages.push({
          role: "assistant",
          content: result.content || null,
          tool_calls: result.calls,
        });

        for (const call of result.calls) {
          if (state.toolCalls >= LIMITS.maxToolCalls) break;
          const outcome = await executeTool(
            call.function.name,
            call.function.arguments,
            state,
            emitter,
          );
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: outcome.forModel,
          });
        }
        continue;
      }

      summary = result.content.trim();
      break;
    }

    if (state.claims.length === 0) {
      throw new AgentError(
        "The agent stopped without a claim that passed verification.",
        "Nothing was shown as fact. Try a narrower question, or check that the sources it found actually contain the needed evidence.",
      );
    }

    if (!summary) {
      emitter.phase("Writing the brief from verified claims only");
      const claimsForPrompt = state.claims
        .map((c, i) => `[${i + 1}] ${c.text}`)
        .join("\n");
      const synthMessages: ChatMessage[] = [
        {
          role: "system",
          content:
            "Write a 2-3 sentence decision brief. Use ONLY the verified claims supplied. Do not add facts, numbers, dates, names or causal claims that are not in them. No citation markers, no markdown, no headings.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nVerified claims:\n${claimsForPrompt}`,
        },
      ];
      const step = newStep(state, "model", "Nemotron · synthesis");
      emitter.step(step);
      const synth = await streamChat({ messages: synthMessages, signal }, (event) => {
        if (event.type === "content") emitter.delta(event.text);
      });
      state.modelMs += synth.ms;
      if (synth.usage) {
        state.tokensIn += synth.usage.prompt_tokens;
        state.tokensOut += synth.usage.completion_tokens;
        if (synth.usage.estimated) state.tokensEstimated = true;
      }
      emitter.update(step.id, {
        status: "ok",
        ms: synth.ms,
        tokensIn: synth.usage?.prompt_tokens,
        tokensOut: synth.usage?.completion_tokens,
        tokensEstimated: synth.usage?.estimated,
        detail: "synthesis",
      });
      summary = synth.content.trim();
    }

    if (!summary) {
      summary =
        "The verified claims are listed below. Each quote was checked against the stored source text.";
    }

    const brief: Brief = {
      id: runId,
      question,
      title: state.fallbackTitle || "Untitled investigation",
      summary,
      claims: state.claims,
      sources: state.sources,
      trace,
      meta: {
        model: NEBIUS_MODEL,
        provider: "Nebius Token Factory",
        baseUrl: NEBIUS_BASE_URL,
        iterations: turns + 1,
        toolCalls: state.toolCalls,
        tavilyCalls: state.tavilyCalls,
        modelMs: state.modelMs,
        totalMs: Math.round(performance.now() - started),
        tokensIn: state.tokensIn,
        tokensOut: state.tokensOut,
        tokensEstimated: state.tokensEstimated,
        mock: false,
        createdAt: new Date().toISOString(),
      },
    };

    await saveBrief(brief);
    emit({ type: "brief", brief });
    return brief;
  } catch (error) {
    if (error instanceof FatalToolError) {
      throw new AgentError(error.message, error.hint);
    }
    const nemotron = error as NemotronError;
    if (nemotron?.name === "NemotronError") {
      throw new AgentError(nemotron.message, nemotron.hint);
    }
    throw error;
  }
}

export { AgentError };
