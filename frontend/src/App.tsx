import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, BloomState } from "./types";
import { createSession, sendAnswer, subscribeEvents } from "./api";
import { SkillMap } from "./components/SkillMap";
import { QuestionPanel } from "./components/QuestionPanel";
import { ActivityFeed } from "./components/ActivityFeed";
import { ScoreBadges } from "./components/ScoreBadges";

const DEFAULT_GOAL = "Solving a quadratic equation ax²+bx+c=0";

export default function App() {
  const [goalInput, setGoalInput] = useState(DEFAULT_GOAL);
  const [state, setState] = useState<BloomState | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const closeRef = useRef<(() => void) | null>(null);

  const pushEvent = useCallback((e: AgentEvent) => {
    const key = `${e.timestamp}|${e.agent}|${e.type}|${e.message}`;
    if (seenRef.current.has(key)) return; // dedupe SSE replay on reconnect
    seenRef.current.add(key);
    setEvents((prev) => [...prev, e]);
  }, []);

  const teardown = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
  }, []);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    teardown();
    setEvents([]);
    seenRef.current.clear();
    try {
      const s = await createSession(goalInput.trim());
      sessionRef.current = s.sessionId;
      setState(s);
      closeRef.current = subscribeEvents(s.sessionId, pushEvent);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(answer: string) {
    if (!sessionRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await sendAnswer(sessionRef.current, answer);
      setState(s);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    teardown();
    sessionRef.current = null;
    seenRef.current.clear();
    setState(null);
    setEvents([]);
    setError(null);
    setGoalInput(DEFAULT_GOAL);
  }

  useEffect(() => () => teardown(), [teardown]);

  const coachMessage = [...events].reverse().find((e) => e.agent === "coach")?.message;

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col px-6 py-5">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
            B
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-slate-900">BloomLoop</h1>
            <p className="text-xs text-slate-500">A team of agents that loops until you master the goal.</p>
          </div>
        </div>
        {state && <ScoreBadges pre={state.preTestScore} post={state.postTestScore} />}
      </header>

      {/* Goal bar */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {!state ? (
          <>
            <input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="Enter a learning goal…"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
            />
            <button
              onClick={start}
              disabled={!goalInput.trim() || busy}
              className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Planning…" : "Start learning"}
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Goal</span>
            <span className="flex-1 truncate text-sm font-medium text-slate-700">{state.goal}</span>
            <button
              onClick={reset}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              New goal
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {/* Main three-zone layout */}
      {state ? (
        <main className="grid min-h-0 flex-1 grid-cols-12 gap-5">
          <div className="col-span-12 min-h-0 md:col-span-3">
            <SkillMap skills={state.skills} currentSkillId={state.currentSkillId} />
          </div>
          <div className="col-span-12 min-h-0 md:col-span-5">
            <QuestionPanel state={state} busy={busy} onSubmit={submit} coachMessage={coachMessage} />
          </div>
          <div className="col-span-12 min-h-0 md:col-span-4">
            <ActivityFeed events={events} />
          </div>
        </main>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 text-center">
          <div className="max-w-md p-8">
            <div className="text-4xl">🌱</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-700">Start a mastery loop</h2>
            <p className="mt-2 text-sm text-slate-500">
              The Orchestrator will decompose your goal into prerequisite skills. The Assessor tests each one, the Tutor
              remediates misconceptions, and the loop repeats until every skill is mastered.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
