import "./polyfill.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load the repo-root .env first (canonical), then any backend-local .env as fallback.
// npm workspaces run this script with cwd = backend/, so we resolve the root explicitly.
const here = path.dirname(fileURLToPath(import.meta.url)); // backend/src
dotenv.config({ path: path.resolve(here, "../../.env") }); // repo-root .env
dotenv.config(); // backend/.env or cwd .env (does not override already-set vars)

import express, { type Request, type Response } from "express";
import cors from "cors";
import { Command } from "@langchain/langgraph";
import { buildGraph } from "./graph.js";
import { createSession, getSession, type Session } from "./sessions.js";
import { toPublicState, type GraphState } from "./types.js";
import { isMockMode } from "./llm.js";

// Optional LangSmith tracing — enabled automatically if a key is present, never fatal.
function maybeEnableLangSmith() {
  try {
    const hasKey = !!process.env.LANGCHAIN_API_KEY;
    const notDisabled = String(process.env.LANGCHAIN_TRACING_V2).toLowerCase() !== "false";
    if (hasKey && notDisabled) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
      console.log(`[langsmith] tracing enabled (project: ${process.env.LANGCHAIN_PROJECT ?? "default"})`);
    }
  } catch {
    /* never crash on observability setup */
  }
}
maybeEnableLangSmith();

const graph = buildGraph();
const app = express();
app.use(cors());
app.use(express.json());

// Build the per-request config: same thread_id pins the checkpoint; emit streams events.
function cfg(session: Session) {
  return { configurable: { thread_id: session.id, emit: session.emit } };
}

async function publicState(session: Session) {
  const snap = await graph.getState(cfg(session));
  return toPublicState(snap.values as GraphState);
}

// Whether the graph is paused at an interrupt (waiting for an answer).
async function isWaitingForAnswer(session: Session): Promise<boolean> {
  const snap = await graph.getState(cfg(session));
  return (snap.tasks ?? []).some((t) => (t.interrupts ?? []).length > 0);
}

app.get("/session/health", (_req, res) => res.json({ ok: true, mock: isMockMode() }));

// Create a session, run the planner + first question (up to the interrupt).
app.post("/session", async (req: Request, res: Response) => {
  try {
    const goal = String(req.body?.goal ?? "").trim();
    if (!goal) return res.status(400).json({ error: "goal is required" });

    const session = createSession();
    await graph.invoke({ goal }, cfg(session));
    const state = await publicState(session);
    res.json({ sessionId: session.id, ...state });
  } catch (err) {
    console.error("[/session]", err);
    res.status(500).json({ error: String(err) });
  }
});

// Submit an answer: resume the graph → grade → (tutor → re-ask) | (advance → next | done).
app.post("/session/:id/answer", async (req: Request, res: Response) => {
  try {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "unknown session" });

    if (!(await isWaitingForAnswer(session))) {
      // Already finished (or not awaiting input) — return current state unchanged.
      return res.json({ sessionId: session.id, ...(await publicState(session)) });
    }

    const answer = String(req.body?.answer ?? "");
    await graph.invoke(new Command({ resume: answer }), cfg(session));
    res.json({ sessionId: session.id, ...(await publicState(session)) });
  } catch (err) {
    console.error("[/session/:id/answer]", err);
    res.status(500).json({ error: String(err) });
  }
});

// Convenience: fetch the current public state (used by the UI to resync).
app.get("/session/:id/state", async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "unknown session" });
  res.json({ sessionId: session.id, ...(await publicState(session)) });
});

// SSE stream of AgentEvents. Replays everything buffered so far, then streams live.
app.get("/session/:id/events", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).end();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable proxy buffering so events flush immediately
  });
  res.write("retry: 3000\n\n");

  // Replay buffered events (so the planning burst is never missed).
  for (const e of session.events) res.write(`data: ${JSON.stringify(e)}\n\n`);

  const onEvent = (e: unknown) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  session.emitter.on("event", onEvent);

  const ping = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(ping);
    session.emitter.off("event", onEvent);
  });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`BloomLoop backend → http://localhost:${port}  (LLM mode: ${isMockMode() ? "MOCK" : "Anthropic"})`);
});
