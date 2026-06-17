# 🌱 BloomLoop — a multi-agent mastery-learning tutor

> Benjamin Bloom's "2 sigma problem": one-on-one tutoring + mastery learning makes the
> average student outperform 98% of a classroom — but it doesn't scale, because it needs
> one human per student. **BloomLoop removes the human.** A team of agents — each
> embodying a high-effect-size pedagogical variable — *owns* the learning trajectory and
> **loops until mastery**, with no human in the driver's seat.

This is **not** a Q&A chatbot. It is a stateful, agentic system: a LangGraph state machine
with an explicit graph, conditional edges, a **cycle**, an `interrupt()` for the student's
answer, and a persistent checkpointer. Every agent decision is streamed to the UI in real
time — **you watch the agents reason live.**

---

## The agent team (graph nodes)

| Agent | Role | Bloom variable |
|------|------|----------------|
| **Orchestrator** | Decomposes the goal into an *ordered* list of prerequisite skills; maintains the student model; decides test / remediate / advance / finish. The autonomous brain. | Mastery sequencing |
| **Assessor** | Generates a question for the current skill, grades the answer against a mastery threshold, and on failure **extracts the precise misconception** (e.g. "sign error on −4ac"). | The mastery gate |
| **Socratic Tutor** | From the misconception, emits a **graded hint that never reveals the answer**, plus a short targeted explanation. | One-on-one remediation |
| **Engagement Coach** | A short contextual encouragement once every skill is mastered. | Affective engagement |

### The loop

```
            ┌─────────────────────────────────────────────────┐
            │                                                  │
START ─► orchestrator_plan ─► assessor_ask ─► [interrupt: wait for answer]
                                   ▲                  │
                                   │                  ▼
                          tutor_remediate ◄── assessor_grade
                          (not mastered)          │ mastered
                                                   ▼
                                        orchestrator_advance ─► (more skills? back to ask)
                                                   │ done
                                                   ▼
                                          engagement_coach ─► END
```

- **`interrupt()`** suspends the graph after a question is posed; the API resumes it with
  `new Command({ resume: answer })`. A `MemorySaver` checkpointer + one `thread_id` per
  session give persistent, resumable memory.
- Every node transition appends a typed `AgentEvent` to the state **and** pushes it onto
  the SSE stream — that live activity feed is the heart of the demo.

---

## Stack

- **TypeScript** everywhere, one repo (`/backend`, `/frontend`), npm workspaces.
- **LangGraph.js** (`@langchain/langgraph`) for orchestration — explicit `StateGraph`,
  conditional edges, a cycle, `interrupt()`/`Command`, `MemorySaver`.
- **Anthropic** via `@langchain/anthropic`. Model + key from `.env`. LLM access is isolated
  in [`backend/src/llm.ts`](backend/src/llm.ts) — swap providers by editing that one file.
- **Backend**: Node + Express with **SSE** streaming of agent steps.
- **Frontend**: React + Vite + Tailwind. Single page, projector-friendly.
- **State is in-memory only.** No database, no auth, no accounts.

---

## Project structure

```
backend/src
  index.ts            Express: POST /session, POST /session/:id/answer, GET /session/:id/events (SSE)
  graph.ts            LangGraph StateGraph — nodes, conditional edges, cycle, interrupt(), MemorySaver
  types.ts            SkillState / AgentEvent / BloomState + the graph Annotation
  sessions.ts         In-memory session registry + per-session SSE event bus
  llm.ts              Provider-agnostic LLM, defensive JSON parsing, mock-mode toggle
  seed.ts             Fixed quadratic skills S1–S4, question bank, deterministic mock grader
  scoring.ts          Pre-test / post-test scoring
  polyfill.ts         globalThis.crypto polyfill (Node 18)
  agents/             orchestrator.ts · assessor.ts · tutor.ts · coach.ts
frontend/src
  App.tsx             Single page: header scores · skill map · question · activity feed
  api.ts              fetch helpers + SSE subscription
  components/         SkillMap · QuestionPanel · ActivityFeed · ScoreBadges
```

---

## Setup & run (one command)

```bash
# 1. install (npm workspaces installs backend + frontend)
npm install

# 2. configure — copy the example and add your Anthropic key
cp .env.example .env
#   ANTHROPIC_API_KEY=sk-ant-...
#   MODEL=claude-sonnet-4-6        # fast model, good for a live demo

# 3. run BOTH servers with a single command
npm run dev
```

Then open **http://localhost:5173**. The frontend proxies API + SSE calls to the backend
on port 3001.

> **No API key? It still runs.** With an empty `ANTHROPIC_API_KEY` (or `USE_MOCK_LLM=1`)
> BloomLoop uses a deterministic **mock LLM** — the full loop works offline. This is the
> live-demo safety net if the network or API is flaky.

---

## 🎬 Demo script

1. Open the app. The goal is pre-filled:

   ```
   Solving a quadratic equation ax²+bx+c=0
   ```

   Click **Start learning** → watch the **Orchestrator plan 4 skills (S1–S4)** appear live
   in the Agent Activity feed.

2. **S1 — Identify coefficients.** Question: *"For 2x² − 3x + 1 = 0, identify a, b, c."*

   ✅ Type a **correct** answer:
   ```
   a=2, b=-3, c=1
   ```
   → S1 turns **green**, the Orchestrator advances to **S2**.

3. **S2 — Compute the discriminant.** This is the money moment.

   ❌ Type a **wrong** answer (a sign error):
   ```
   Δ = 9 + 8 = 17
   ```
   → The feed shows: **Assessor: not mastered — misconception: sign error on −4ac** →
   **Tutor: a hint that does *not* give the answer** → **Assessor: re-testing S2 with a
   *new* question** (now `x² + 4x + 4 = 0`).

   ✅ Now answer the new question correctly:
   ```
   Δ = 16 - 16 = 0
   ```
   → S2 turns green, advance to S3.

4. **S3 — Sign of Δ.** ✅ `two real roots because Δ > 0` → advance.

5. **S4 — Roots formula.** Question: *"Solve 2x² − 3x + 1 = 0 (Δ = 1)."*
   ✅ `x = 1 or x = 1/2` → **all skills mastered → 🎓 Goal mastered**, Post-test **100%**.

The **Pre-test vs Post-test** badges in the header tell the 2-sigma story: the pre-test is
the share of skills the student got right cold (first try), the post-test is mastery after
the loop.

---

## API

| Method | Route | Body | Returns |
|--------|-------|------|---------|
| `POST` | `/session` | `{ goal }` | `{ sessionId, ...BloomState }` (plan + first question) |
| `POST` | `/session/:id/answer` | `{ answer }` | `{ sessionId, ...BloomState }` (resumes the graph) |
| `GET`  | `/session/:id/events` | — | **SSE** stream of `AgentEvent` (replays buffered, then live) |
| `GET`  | `/session/:id/state` | — | current `BloomState` (resync helper) |

`AgentEvent` types streamed: `planning`, `question`, `grading`, `mastery_update`, `hint`,
`explanation`, `advance`, `done`, `encouragement`.

A **free-form goal** also works — the Orchestrator decomposes it via the LLM. The quadratic
seed is kept fixed for a 100% reliable demo.

---

## Observability (free)

If `LANGCHAIN_API_KEY` is set (and `LANGCHAIN_TRACING_V2` is not `false`), LangSmith tracing
is enabled automatically. If those vars are absent, nothing breaks.

---

## Verifying the loop

```bash
npm run loop:test -w backend     # deterministic terminal walk-through of the full mastery loop
npx tsx backend/src/httpTest.ts  # HTTP + SSE integration check (needs the backend running)
```

---

## Notes

- **Node 18**: LangGraph 1.x expects a global `crypto`; [`polyfill.ts`](backend/src/polyfill.ts)
  supplies it from `node:crypto`. Node 20+ needs nothing.
- `PACE_MS` (default `350`) adds a small delay between agent events so the live feed is
  legible on a projector. Set `PACE_MS=0` to disable.
- All UI text, code, and comments are in English; state is in memory only.
