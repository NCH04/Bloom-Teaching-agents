import { useEffect, useState } from "react";
import type { BloomState, SkillState } from "../types";

interface Props {
  state: BloomState;
  busy: boolean;
  onSubmit: (answer: string) => void;
  coachMessage?: string;
}

export function QuestionPanel({ state, busy, onSubmit, coachMessage }: Props) {
  const [answer, setAnswer] = useState("");
  const skill: SkillState | undefined = state.skills.find((s) => s.id === state.currentSkillId) ?? undefined;
  const isReattempt = (skill?.attempts ?? 0) > 0;

  // Clear the input whenever a new question arrives.
  useEffect(() => {
    setAnswer("");
  }, [state.currentQuestion?.prompt]);

  if (state.phase === "done") {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 p-10 text-center shadow-sm">
        <div className="text-5xl">🎓</div>
        <h2 className="mt-4 text-2xl font-bold text-slate-800">Goal mastered</h2>
        <p className="mt-1 text-sm text-slate-500">Every prerequisite skill reached the mastery threshold.</p>
        <div className="mt-6 flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Pre-test</div>
            <div className="text-3xl font-bold text-slate-500">{state.preTestScore ?? "—"}%</div>
          </div>
          <div className="text-2xl text-slate-300">→</div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Post-test</div>
            <div className="text-3xl font-bold text-emerald-600">{state.postTestScore ?? 100}%</div>
          </div>
        </div>
        {coachMessage && (
          <p className="mt-6 max-w-md rounded-xl bg-white/70 px-4 py-3 text-sm font-medium text-slate-600">
            {coachMessage}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-bold text-accent">{skill?.id}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{skill?.name}</span>
        {isReattempt && (
          <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
            New question · attempt {(skill?.attempts ?? 0) + 1}
          </span>
        )}
      </div>

      <div className="mt-3 flex-1">
        <p className="text-lg font-medium leading-relaxed text-slate-800">{state.currentQuestion?.prompt}</p>
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (answer.trim() && !busy) onSubmit(answer.trim());
        }}
      >
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (answer.trim() && !busy) onSubmit(answer.trim());
            }
          }}
          rows={2}
          autoFocus
          placeholder="Type your answer…  (Enter to submit)"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">Watch the agents reason on the right →</span>
          <button
            type="submit"
            disabled={!answer.trim() || busy}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Grading…" : "Submit answer"}
          </button>
        </div>
      </form>
    </section>
  );
}
