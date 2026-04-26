# Video UX Analyzer

An AI-powered tool that analyzes product demo videos and identifies UX issues using a multi-agent LangGraph pipeline backed by Google Gemini's native video understanding.

## Walkthroughs

Before diving into the code, these three resources give a 5-minute orientation:

| Resource | Link |
| --- | --- |
| **Project Walkthrough · Part 1** (UI tour, what the tool does, demo upload → analysis) | [Watch on Loom](https://www.loom.com/share/14ea2e84cc144686a2614625174ad5af) |
| **Project Walkthrough · Part 2** (architecture deep-dive, code tour, design choices) | [Watch on Loom](https://www.loom.com/share/70c2d050f575498183700f4fec579199) |
| **Architecture Flowchart** (LangGraph pipeline + SSE event flow, visual) | [Open in Eraser](https://app.eraser.io/workspace/SbRiNSwTRJO6Mjgag2Yg?origin=share&diagram=QnqX4mVepOdzFOF_Cpydx) |

---

## What it does

You drop in a 1–5 minute product demo video. The app sends it to Gemini, walks two AI agents through the footage (a UX Researcher and a Critic), and streams findings back to the UI in real time. Each finding is categorized, severity-rated, validated, and one click away from becoming a Jira ticket.

**Highlights**

- **Two-agent pipeline** — a Researcher identifies all potential UX issues, then a Critic *independently validates* each one (`genuine_bug` / `stylistic_choice` / `needs_investigation`). This dramatically reduces false-positive noise vs. a single LLM pass.
- **Parallel fan-out via LangGraph `Send`** — every finding gets its own critic invocation running concurrently, with a `Synthesizer` barrier node producing the executive summary at the end.
- **Progressive streaming UI** — `streamMode: "updates"` over Server-Sent Events. Skeleton cards render the moment the researcher finishes; each card swaps to its validated version live as critics complete. No blank loading screen.
- **Timestamp video sync** — every issue is tagged with a video timestamp; clicking it seeks the player to that exact moment.
- **Jira-style ticket modal** — review/edit the auto-generated ticket (Summary, Issue Type, Priority, Labels, Description in Jira wiki markup), then Create opens Jira's `CreateIssueDetails` URL with everything pre-filled.

---

## Tech stack

- **Next.js 15** (App Router) + TypeScript
- **LangGraph 0.2** for the multi-agent orchestration (`Annotation.Root` state, `Send` fan-out, append reducers)
- **Google Gemini** (`gemini-2.5-flash`) via `@google/generative-ai` — native video understanding through the Files API
- **Tailwind CSS** + **shadcn/ui** (Dialog, Tabs, Button) on Radix primitives
- **Lucide** icons
- **Server-Sent Events** for progressive streaming

---

## Setup & Run

### Prerequisites

- Node.js 18 or newer
- A Google Gemini API key — get one free at [Google AI Studio](https://aistudio.google.com)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.local.example .env.local

# 3. Open .env.local and add your Gemini API key
#    GEMINI_API_KEY=your_key_here
#
#    Optional: for the Jira ticket modal's deep-link
#    NEXT_PUBLIC_JIRA_BASE_URL=https://your-company.atlassian.net
#    NEXT_PUBLIC_JIRA_PROJECT_ID=10000

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>, drag in a 1–5 minute product demo (MP4 / MOV / WebM), and click **Analyze UX**. Findings start streaming in roughly 30–90 seconds depending on video length.

### Production build (optional)

```bash
npm run build
npm start
```

---

## Architecture in 30 seconds

```
Browser ──(POST FormData)──► /api/analyze ──► uploadVideoToGemini()
                                  │              │ buffer → temp file → Gemini Files API
                                  │              └ poll until FileState.ACTIVE
                                  │
                                  └──► LangGraph (graph.stream, streamMode: "updates")
                                         │
                                         ├─ researcher (1×)         ─► returns all findings
                                         │
                                         ├─ Send fan-out ─► critic × N (parallel)
                                         │                      └ each emits one validated issue
                                         │
                                         └─ synthesizer (barrier)   ─► overall assessment
                                                  │
                                                  ▼
                                            SSE events back to browser
                                            (one event per node completion)
```

Every node completion fires an SSE event the browser uses to update the UI progressively — see the [Eraser flowchart](https://app.eraser.io/workspace/SbRiNSwTRJO6Mjgag2Yg?origin=share&diagram=QnqX4mVepOdzFOF_Cpydx) for the full picture.

For the full design rationale, prompt strategy, frontend stack details, and production concerns (queue offload, structured output, auth, prompt versioning, real Jira POST integration), see [`NOTES.md`](./NOTES.md).

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # main UI shell, SSE consumer
│   └── api/analyze/route.ts        # SSE streaming endpoint
├── components/
│   ├── VideoUploader.tsx           # drag-drop + native HTML5 player
│   ├── AnalysisResults.tsx         # progress stepper + issue cards + stats
│   ├── JiraTicketModal.tsx         # shadcn Dialog with Details / Attachments tabs
│   └── ui/                         # shadcn primitives (button, dialog, tabs)
├── lib/
│   ├── gemini.ts                   # Files API upload + poll helper
│   ├── utils.ts                    # cn() class merger
│   └── langgraph/
│       ├── state.ts                # Annotation.Root state + reducers
│       ├── graph.ts                # StateGraph with Send fan-out
│       └── nodes/
│           ├── researcher.ts       # NN/g UX Researcher persona
│           ├── critic.ts           # VP of Design validator (parallel)
│           ├── synthesizer.ts      # Executive summary (barrier)
│           └── gemini-utils.ts     # Retry + concurrency limiter
└── types/analysis.ts               # shared types (UXIssue, ValidatedIssue, AnalysisStage)
```
