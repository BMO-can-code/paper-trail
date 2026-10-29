# DEMO.md — 3:00 shot list

**Target length: 2:55.** Record at 1440px wide, 100% zoom, light-on-dark UI. The point of the video is the **rejection → retry → verified** sequence, plus on-screen proof that the live app is calling Nemotron and Tavily.

## Pre-flight (not filmed)

- [ ] Deployment is in live mode: `curl -s https://<host>/api/health | jq` shows `"mode":"live"` and `"model":"nvidia/nemotron-3-super-120b-a12b"`.
- [ ] One successful run already completed, so the page is warm and the sources are cached.
- [ ] DevTools → Network → filter box contains `tavily`, but the panel is closed until 2:20.
- [ ] Backup: a screen recording of a successful full run, plus a terminal ready with `MOCK_MODE=1 npm run dev`.
- [ ] Terminal font ≥ 16pt; browser notifications off; `.env` never visible.

## Shot list

| Time | On screen | Exact action | Voiceover |
| --- | --- | --- | --- |
| 0:00–0:15 | Landing hero, "Research that shows its receipts." | Slow scroll from headline to the input. Cursor rests on "receipts." | "Every AI research brief is one confident sentence away from a lie. Paper Trail is a Nemotron agent that refuses to assert anything it can't quote." |
| 0:15–0:30 | Input card | Click the **EU AI Act** example chip, then **Run investigation**. | "I'll ask something where a wrong citation is worse than no answer." |
| 0:30–0:55 | Trace panel filling | Point at `web_search`, then `read_source`. Let the narration stream. | "Nemotron plans the search, calls Tavily, then stores the full page before it is allowed to cite it." |
| 0:55–1:15 | **Red step** "Claim rejected: quote not found" | Pause. Hover the red verdict, then the `record_claim` step above it. | "There it is. It tried a paraphrase. The server searched the stored text, didn't find the quote, and rejected the claim. The model gets the rejection and has to try again." |
| 1:15–1:35 | Second `read_source`, green "Claim verified" | Point at the green verdict, then the claim count pill. | "Second source, exact sentence, verified. That gap — rejected to verified — is the whole product." |
| 1:35–2:00 | Verified brief | Scroll to **Claims & receipts**. Click the first source chip; the source opens. Return to the brief. | "Every claim carries the sentence it came from. Click the receipt and you're on the page." |
| 2:00–2:20 | `/api/health` in a new tab, then run metadata | Open `https://<host>/api/health`. Highlight `"mode":"live"` and `"model":"nvidia/nemotron-3-super-120b-a12b"`. Switch back and point at latency/tokens. | "This is the model the deployment is actually calling, and the run metadata: latency, tokens in and out, tool calls." |
| 2:20–2:40 | DevTools Network filtered to `tavily` | Open DevTools, click the preserved `search` and `extract` requests. Show `Request URL: https://api.tavily.com/...` and status 200. | "Tavily isn't mocked. These are the runtime calls from that run — search, then extract, both 200." |
| 2:40–2:55 | Permalink page | Click **Permalink ↗**. Show the `/brief/<id>` URL and the same claims. | "And the whole thing is shareable down to the receipts. Paper Trail: research that shows its receipts." |
| 2:55–3:00 | End card | Static card: repo URL, `MIT`, model ID. | "Repo and setup are in the description." |

## If a live call fails on camera

Never pretend a mock is live. Say what happened, show the failure state, then continue with the labelled fallback.

| Failure | What to do | What to say |
| --- | --- | --- |
| Nemotron 429 / 5xx | Keep the in-app error visible for 3 seconds. Show the trace's last completed step. | "Nebius rate-limited the run. The app retried with backoff and surfaced the failure instead of hanging. Here's the same loop from the backup recording." |
| Nemotron 401 / 404 | Show the error and the `/api/health` model ID. | "That's an auth or model-ID failure, and the app names it. I'll switch to the backup recording." |
| Tavily fails | Show the red tool step and its hint. | "Tavily is down upstream; the agent stopped rather than cite a snippet it couldn't read." |
| Network / deploy down | Run locally with `npm run dev`, same question. | "The deployment is unreachable, so this is the same app running locally with the same keys." |
| No keys at all | Start `MOCK_MODE=1 npm run dev`. Keep the amber **MOCK MODE** banner and `MOCK` source tags on screen. | "This is the labelled mock: scripted trace, zero API calls. It demonstrates the interaction, not a live result." |

## Do not say

- Any benchmark, accuracy percentage, user count, or "faster than X" claim. None were measured.
- "Production-ready" or "secure" without qualification. There is no rate limiting and storage is ephemeral on Vercel.
- That the summary is independently verified. Only the **claims and quotes** are quote-checked.

## Post-record

- [ ] Trim to ≤ 3:00, 1080p, captions on.
- [ ] Confirm the model ID is readable at 2:00 in the exported file.
- [ ] Confirm the Tavily request URL is readable at 2:20.
- [ ] Upload, then paste the URL into `SUBMISSION.md` and the README.
