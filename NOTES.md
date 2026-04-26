# Video UX Analyzer — Notes

A Next.js + LangGraph + Gemini app that analyzes product demo videos for UX issues. A two-stage AI pipeline (UX Researcher → parallel Critic validators → Synthesizer) streams findings progressively to a polished light-theme UI inspired by the Twisty dashboard reference.

---

## High-Level Design

```
Browser
  │  FormData (video file)
  ▼
Next.js API Route (/api/analyze)
  │  SSE stream (stage updates + per-issue events)
  │
  ├── 1. uploadVideoToGemini()
  │       └── Buffer → temp file → GoogleAIFileManager.uploadFile()
  │           Poll until FileState.ACTIVE
  │
  └── 2. LangGraph (graph.stream, streamMode: "updates")
          │
          ├── Node: researcher
          │     └── gemini-2.5-flash + video URI
          │         System prompt: "Senior UX Researcher at NN/g"
          │         Output: UXIssue[] (JSON, one batch)
          │
          ├── Send fan-out — one critic invocation per finding
          │
          ├── Node: critic × N (parallel)
          │     └── gemini-2.5-flash + single issue
          │         System prompt: "VP of Design"
          │         Output: ValidatedIssue (verdict + reasoning)
          │     Reducer: validatedIssues = [...left, ...right]  // append
          │
          └── Node: synthesizer (barrier, runs once after all critics)
                └── gemini-2.5-flash + all validated issues
                    Output: overallAssessment (plain text)
```

### Why LangGraph (and why this shape)

UX feedback is subjective. A single LLM pass over-reports rough edges as critical bugs. The graph separates concerns:

- **Researcher** simulates a first-time user mentally walking through the demo, returns *all* findings in one batch.
- **Critic** (fan-out) evaluates *each* finding independently — `genuine_bug` / `stylistic_choice` / `needs_investigation`. Running them in parallel via `Send` is faster and keeps each critic call focused on one finding.
- **Synthesizer** is a barrier — LangGraph waits for all critic invocations to converge before producing the executive summary.

State uses `Annotation.Root` with explicit reducers — `validatedIssues` uses an append reducer so parallel critic outputs merge correctly into the parent state.

### Real-time UX (SSE)

The API route consumes `graph.stream(..., { streamMode: "updates" })` and emits Server-Sent Events as each node completes:

| Stage | Trigger | Frontend behavior |
| --- | --- | --- |
| `uploading` | Form data received | Spinner |
| `processing` | Uploading + polling Gemini Files API | Spinner |
| `researching` | Researcher node started | Stepper highlights research |
| `validating` (researcher_complete) | Researcher returned N findings | Skeleton cards render with shimmer for each finding |
| `validating` (issue_validated × N) | Each critic completes | Skeleton swaps to validated card with verdict; stat counters tick up |
| `synthesizing` | All critics done, synthesizer running | Spinner |
| `complete` | Synthesizer returned overall assessment | Gradient assessment card fades in |

The user never stares at a blank loading screen — content materializes progressively.

### Frontend stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (Dialog, Tabs, Button) backed by Radix primitives
- Light theme tuned to match a Twisty-style dashboard: white cards on a soft off-white background, generous radii, soft pastel pill colors, large stat numbers, gradient Overall Assessment card
- Lucide icons throughout
- Per-category icon chips (Compass / MousePointer2 / Workflow / Accessibility / Clock / MessageSquare) for visual scanability

### Key features

- **Drag-drop video upload** with native HTML5 player
- **Live progress stepper** (4 phases) with stage-specific messaging
- **Skeleton-fill cards** — researcher findings render immediately, then each card swaps to the validated version as the critic resolves it
- **Timestamp video sync** — clicking a timestamp on any issue card seeks the video player to that moment and plays
- **Jira ticket modal** (shadcn Dialog) with two tabs:
  - *Details* — Summary, Issue Type, dynamic-color Priority badge, Labels (chip input), Description (Jira wiki markup pre-filled), Reporter/Assignee
  - *Attachments* — Mock video-snippet clipper centered on the issue's timestamp (UI scaffolds the eventual real feature)
- **URL-template Jira creation** — opens `/secure/CreateIssueDetails!init.jspa?pid=…&issuetype=…&summary=…&description=…&priority=…&labels=…` in a new tab; configurable via `NEXT_PUBLIC_JIRA_BASE_URL` and `NEXT_PUBLIC_JIRA_PROJECT_ID`
- **Severity / Verdict mapping** — defaults are editable in the modal (critical→Highest, genuine_bug→Bug, etc.)

---

## How to Run

### Prerequisites
- Node.js 18+
- A Google Gemini API key — [Google AI Studio](https://aistudio.google.com)

### Setup

```bash
cd video_ux_analyzer

npm install

cp .env.local.example .env.local
# edit .env.local — add GEMINI_API_KEY (required)
# optionally set NEXT_PUBLIC_JIRA_BASE_URL and NEXT_PUBLIC_JIRA_PROJECT_ID
#   for the Jira modal's "Create Issue" deep-link

npm run dev
```

Open [http://localhost:3000](http://localhost:3000), drop in a 1–5 min product demo, click **Analyze UX**. Findings stream in within ~30–90 seconds depending on video length.

---

## Production Concerns

### 1. Video upload size & latency
Video flows browser → Next.js → Gemini, doubling bandwidth. Vercel serverless has a ~4.5 MB body limit; we set `bodySizeLimit: 200mb` for local dev but that won't survive deployment.

**Fix:** Generate a short-lived upload token server-side and have the browser upload directly to Gemini's Files API (or to S3 with a presigned URL, then trigger processing via a background queue).

### 2. Serverless timeout
Gemini video processing + a researcher pass + N parallel critic passes + synthesizer can exceed 60 s for longer videos. Vercel's default is 60 s (300 s on Pro).

**Fix:** Move to a background queue (Inngest, BullMQ, Cloud Tasks). Return a job ID immediately; SSE re-attaches via job ID for resume. Or run on a long-running container.

### 3. Gemini Files API retention
Files auto-delete after 48 h. Any history / re-analysis feature requires storing the original video elsewhere (S3) and re-uploading.

### 4. JSON parsing brittleness
Both nodes ask Gemini for raw JSON and parse with regex + `JSON.parse`. Under unusual content the model may produce malformed output.

**Fix:** Use Gemini's structured output (response schema / function calling) to enforce JSON at the API level — eliminates string parsing.

### 5. No auth or rate limiting
`/api/analyze` is open. Each request burns Gemini quota and is expensive.

**Fix:** Add NextAuth / Clerk + per-user rate limits via Upstash Redis.

### 6. Error recovery in the graph
A failed critic currently fills in a `needs_investigation` fallback; a failed researcher kills the entire run. There's no resume capability.

**Fix:** Persist node outputs to Redis keyed by job ID so a critic retry resumes from saved researcher findings without re-processing the video.

### 7. Prompt versioning
Prompts and model IDs are hardcoded in node files. Tuning requires a deploy.

**Fix:** Store prompts in a database / CMS with versioning + A/B testing.

### 8. Real Jira integration
The "Create Issue" button uses a URL template — the user lands on Jira's create form pre-filled but still has to click Create. A logged-in user with Jira API access expects one-click creation.

**Fix:** Add OAuth → POST to `/rest/api/3/issue`. Map verdict/severity/category to real Jira issue type IDs and priority IDs (currently we send name strings).

### 9. Mock video snippet attachment
The Attachments tab in the Jira modal is UI-only. Wiring it up requires:
- Server-side ffmpeg to clip the original video by timestamp range
- Upload the clip as a Jira attachment via the REST API
- Show progress / handle failures

### 10. Single-tenant / single-session
No persistence — refresh loses the analysis. No way to share or revisit results.

**Fix:** Database-backed analysis records keyed by a UUID, shareable URL, optional public/private visibility.

---

## Decisions worth noting

- **Native Gemini video understanding** over frame extraction — Gemini handles temporal context (interaction delays, animations, flow) much better than picking 10 frames.
- **Two-persona graph** (Researcher + Critic) instead of one prompt — keeps each LLM call focused; the Critic's verdict is the differentiator vs. a generic "list issues" tool.
- **Parallel fan-out (`Send`)** over sequential validation — the researcher returns all findings at once; there's no reason to validate them sequentially. N parallel calls cost the same as N serial calls but finish in ~1× wall time instead of ~N×.
- **SSE over polling** — analysis is long-running; SSE gives smooth progressive UI without holding a connection-per-issue and without round-trip overhead.
- **shadcn/ui** for primitives, custom design system for the rest — Dialog/Tabs/Button benefit from Radix accessibility; the rest of the visual language is tuned by hand to match the Twisty reference.
- **URL-template Jira creation** instead of API integration — zero-config for reviewers, no OAuth dance, demonstrates the user flow end-to-end.
