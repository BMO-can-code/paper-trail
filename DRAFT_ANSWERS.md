# DRAFT_ANSWERS.md

> Drafted from what is actually in the code. Every subjective statement, rating, and first-person claim is marked **[TODO: mine]** instead of being guessed. Ratings are left unnumbered on purpose.
>
> At draft time, no live `NEBIUS_API_KEY` or `TAVILY_API_KEY` was available in the build environment. The full agent loop was exercised against a local contract stub, not against Nebius/Tavily production. Any sentence about live quality, speed, or reliability therefore stays **[TODO: mine]** until one live run is recorded.

## Model chosen and why

**Facts (safe to submit):**

- Chosen model: `nvidia/nemotron-3-super-120b-a12b`.
- Nebius Token Factory catalog lists it as a text-to-text model with a 256K-token context window, in `us-central1`, at `$0.30` per 1M input tokens and `$0.90` per 1M output tokens (`$0.06` cached input). Verified 2026-10-29 at https://tokenfactory.nebius.com/model-catalog.md.
- The app uses the OpenAI-compatible chat-completions API with streaming and tool calls: https://docs.tokenfactory.nebius.com/quickstart.
- The model ID is one constant in `src/lib/config.ts` and is overridable with `NEBIUS_MODEL`.
- `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` is documented as the cheaper fallback (262K context, `$0.06`/`$0.24`); it is not auto-swapped.

**Why this one (write in your own words):**
[TODO: mine — 2–3 sentences. e.g. what trade-off between Super / Nano / Ultra you were optimizing for. Do not claim a benchmark you did not run.]

## The approach

**Facts:**

- The agent is a bounded loop (max 8 turns): Nemotron chooses a tool, the backend executes it, the result goes back as a tool message, repeat.
- Tools: `web_search` and `read_source` call Tavily at runtime; `record_claim` verifies a verbatim quote against the stored source before storing the claim.
- The verifier normalizes whitespace/case and rejects paraphrases; the rejection reason is sent back to the model and rendered as a red trace step.
- The final summary is synthesized only from accepted claims; the brief is persisted and shareable at `/brief/<id>`.
- Failure states (401/404/429/network/mid-stream/timeout) are mapped to readable messages with hints.

**In your own words:**
[TODO: mine — why a verification gate inside the loop, rather than a post-hoc fact-checker or a "chat with sources" UI.]

## How it compared to alternatives

**Facts / honesty constraints:** No benchmark, head-to-head eval, or side-by-side quality test was run. The following is a paper comparison only, based on the live catalog and docs:

| Option | Catalog facts | Trade-off |
| --- | --- | --- |
| `nvidia/nemotron-3-super-120b-a12b` (chosen) | 256K context, $0.30 / $0.90 | Mid-tier price and context; used for every turn |
| `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | 262K context, $0.06 / $0.24 | Cheapest; fallback, not evaluated for tool reliability here |
| `nvidia/Nemotron-3-Ultra-550b-a55b` | 1M context, $1 / $3 | Most expensive; not evaluated |
| `nvidia/Nemotron-3_5-Lightning` | 1M context, $0.06 / $0.24 | Cheapest long-context option; not evaluated |
| A generic "chat with your docs" RAG app | n/a | Would not need a tool loop or a verifier, and would not demonstrate agentic behaviour |

**Your comparison:**
[TODO: mine — what you personally weighed. If you did not test an alternative, say so.]

## What specifically worked on Nebius

**Facts:**

- The OpenAI-compatible base URL `https://api.tokenfactory.nebius.com/v1/` accepted the standard `chat.completions` request shape, including `stream: true`, OpenAI-format `tools`, streamed `tool_calls`, and `stream_options.include_usage`.
- The published model catalog (plus `/api/public/models_info`) made the exact model ID and pricing checkable instead of guessed.
- HTTP error codes (401/404/429) mapped cleanly to distinct user-facing states.
- The server-side integration is one key and one endpoint; no SDK or GPU infrastructure was needed.

**Your experience:**
[TODO: mine — what worked in practice on your live run. Include the model ID and latency from the log. Do not generalize from the contract stub.]

## Ratings (1–10, one-line reason each)

Leave these unnumbered until you have actually used the thing. A one-line reason is required for each.

- Overall hackathon project: [TODO: mine]
- Nemotron answer quality on this task: [TODO: mine]
- Nemotron tool-calling reliability: [TODO: mine]
- Latency / responsiveness: [TODO: mine]
- Cost efficiency: [TODO: mine]
- Nebius Token Factory docs and API: [TODO: mine]
- Tavily result quality: [TODO: mine]
- Tavily extract completeness: [TODO: mine]
- Demo impact: [TODO: mine]
- Originality: [TODO: mine]
- Developer experience (build/deploy): [TODO: mine]

## AI tools used

[TODO: mine — list every assistant/tool you actually used (e.g. Claude Code, Cursor, Copilot, ChatGPT, Codex) and what each was used for. Do not include tools you did not use.]

## Two learning questions

1. [TODO: mine — the question as worded by the hackathon.]
   [TODO: mine — your answer.]
2. [TODO: mine — the question as worded by the hackathon.]
   [TODO: mine — your answer.]

## Eligibility checkboxes

- Age / eligibility confirmation: [TODO: mine — select the true option; do not guess.]
- Employee / affiliated-person checkbox: [TODO: mine — select the true option; do not guess.]

## Builders & Brews city

[TODO: mine — the city you actually attended / are submitting for.]
