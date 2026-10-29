# SUBMISSION.md

## What / why / how

**Paper Trail** is a research agent that will not assert what it cannot quote. Nemotron investigates a question with a real tool loop (Tavily search → Tavily extract → `record_claim`), and a deterministic verifier checks every quote against the stored source text. A paraphrase is rejected, the rejection is fed back to the model, and the retry is visible in the UI. The final brief is built only from claims that passed.

**Why:** the expensive part of using an AI research brief is not reading it — it is re-checking it. Paper Trail moves that check into the loop, where it is cheap, and makes the failure visible instead of hiding it.

**How:** Next.js 15 route handler streams an OpenAI-compatible Nemotron chat completion over SSE; the model picks tools; the backend executes them with timeouts and caps; every `record_claim` is quote-matched against text fetched at runtime by Tavily; the brief is persisted and shareable.

- Track: **Best apps & agents**
- New or existing: **NEW** — fresh repository, no prior code.
- Model: `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory ([catalog](https://tokenfactory.nebius.com/model-catalog.md)).

## Links

| Item | URL |
| --- | --- |
| Repository | https://github.com/BMO-can-code/paper-trail |
| Live demo | `https://paper-trail-taupe-pi.vercel.app` — **MOCK mode** until keys are attached |
| Video (≤ 3:00) | _[TODO: mine — record from [DEMO.md](./DEMO.md)]_ |
| Model catalog (verified) | https://tokenfactory.nebius.com/model-catalog.md |
| Base URL docs | https://docs.tokenfactory.nebius.com/quickstart |

## Hackathon checklist

Legend: `[x]` verified in this repo / on the deployment · `[ ]` blocked, with the exact blocker named.

### Repo and docs
- [x] One repository with MIT `LICENSE` at the root (visible on the landing page).
- [x] README has the one-paragraph pitch, hero screenshot, license badge, and live URL.
- [x] README sections titled exactly **"How we used Nemotron / NVIDIA models"** and **"Where Nebius Token Factory helped"**.
- [x] README setup steps, environment table, deploy steps.
- [x] `.env.example` with `NEBIUS_API_KEY`, `TAVILY_API_KEY`, `NEBIUS_MODEL`.
- [x] `.gitignore` covers `.env*`; no key in the client bundle.
- [x] Mermaid architecture diagram.
- [x] Three screenshots in `docs/screenshots/` (landing, trace with rejection, verified brief).
- [x] `DEMO.md` shot list capped at 3:00 with timestamps, clicks, voiceover, failure fallback.
- [x] `DRAFT_ANSWERS.md` drafted from the code, with every subjective claim marked `[TODO: mine]`.

### Nemotron on Nebius
- [x] Exact base URL and model ID fetched from Nebius docs/catalog, not guessed; cited in README.
- [x] Model ID isolated in one config constant (`src/lib/config.ts`).
- [x] Token streaming to the UI over SSE.
- [x] Retry with exponential backoff + jitter on 429/5xx and network errors, honouring `Retry-After`.
- [x] Per-request latency and token logging (`event:"nemotron_call"`).
- [x] Readable failure states for 401/404/429/network/mid-stream/timeout.
- [x] Nemotron is load-bearing: it plans, selects tools, extracts claims, and synthesizes; the verifier cannot research on its own.

### Agentic surface
- [x] Genuine tool loop: model → tool → result → model, max 8 turns.
- [x] Three tools that touch real state: Tavily search, Tavily extract + stored text, quote-verified claim store.
- [x] Full trace in the UI, including rejected verdicts.
- [x] Timeouts: 45s per model call, 20s per Tavily call, 55s per run.
- [x] No model-authored code execution, so no unsandboxed execution path.

### Tavily
- [x] Runtime call in `src/lib/tavily.ts`, reachable only via `POST /api/research` → `src/lib/agent.ts` → `src/lib/tools.ts`.
- [x] Source URLs rendered and clickable in the UI.
- [x] README names the exact file and route for a 30-second verification.

### Definition of done
- [x] `npm run typecheck`, `npm run lint`, `npm run build` pass locally.
- [x] Real agent loop exercised end-to-end against a local OpenAI/Tavily contract stub: search → read → **rejected paraphrase** → retry → verified claim → persisted brief (see README "Contract test without keys").
- [x] Deployed public demo reachable (mock mode).
- [x] Secret scan before first push.
- [ ] **Live Nemotron request logged with model ID and latency** — blocked: no `NEBIUS_API_KEY` in the build environment. Add it with `vercel env add NEBIUS_API_KEY production`, redeploy, then run the curl in README "Proof it's real".
- [ ] **Live Tavily call visible in the network log** — blocked for the same reason (`TAVILY_API_KEY`).
- [ ] **Deployed demo in live mode** — blocked on the two keys above.
- [ ] **Demo video** — blocked: needs a screen recording following `DEMO.md`.
- [ ] **Ratings and first-person answers** — blocked: `DRAFT_ANSWERS.md` marks them `[TODO: mine]` rather than inventing them.

## What is deliberately not claimed

- No benchmarks, accuracy percentages, user counts, or cost-per-run figures. None were measured.
- No "production-ready" claim: there is no rate limiting, and server-side brief storage is per-instance `/tmp` on Vercel (copied links carry the brief, but there is no account, history list, or durable store).
- The prose summary is model-written from verified claims; only the **claims and their quotes** are machine-checked.

## Next three commands

```bash
git clone https://github.com/BMO-can-code/paper-trail.git && cd paper-trail
cp .env.example .env   # paste both keys
npm run dev            # then run one question; watch the red rejection
```
