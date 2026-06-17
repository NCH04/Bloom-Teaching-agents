import { Annotation } from "@langchain/langgraph";

// ---------- Public contract (exactly as specified) ----------

export type SkillStatus = "not_started" | "in_progress" | "mastered";

export interface SkillState {
  id: string;
  name: string;
  status: SkillStatus;
  attempts: number;
  lastErrors: string[];
}

export type AgentName = "orchestrator" | "assessor" | "tutor" | "coach";

export interface AgentEvent {
  agent: AgentName;
  type: string;
  message: string;
  timestamp: number;
}

export interface Question {
  prompt: string;
  expected: string;
}

export type Phase = "planning" | "assessing" | "remediating" | "advancing" | "done";

export interface BloomState {
  goal: string;
  skills: SkillState[];
  currentSkillId: string | null;
  phase: Phase;
  currentQuestion: Question | null;
  log: AgentEvent[]; // feeds the UI activity feed
  preTestScore: number | null;
  postTestScore: number | null;
}

// Internal grading result passed from the grade node to the router / tutor.
// Not part of the public BloomState.
export interface GradeResult {
  correct: boolean;
  score: number; // 0..100
  misconception: string | null;
}

// ---------- LangGraph channels ----------
// Superset of BloomState plus two internal-only channels (pendingAnswer, lastResult).

function replace<T>(def: () => T) {
  return { reducer: (_prev: T, next: T) => next, default: def };
}

export const GraphAnnotation = Annotation.Root({
  goal: Annotation<string>(replace<string>(() => "")),
  skills: Annotation<SkillState[]>(replace<SkillState[]>(() => [])),
  currentSkillId: Annotation<string | null>(replace<string | null>(() => null)),
  phase: Annotation<Phase>(replace<Phase>(() => "planning")),
  currentQuestion: Annotation<Question | null>(replace<Question | null>(() => null)),
  // The log is the one append-only channel: each node returns only ITS new events.
  log: Annotation<AgentEvent[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  preTestScore: Annotation<number | null>(replace<number | null>(() => null)),
  postTestScore: Annotation<number | null>(replace<number | null>(() => null)),
  // internal-only:
  pendingAnswer: Annotation<string | null>(replace<string | null>(() => null)),
  lastResult: Annotation<GradeResult | null>(replace<GradeResult | null>(() => null)),
});

export type GraphState = typeof GraphAnnotation.State;

// Project the internal graph state down to the public BloomState contract.
export function toPublicState(s: GraphState): BloomState {
  return {
    goal: s.goal,
    skills: s.skills,
    currentSkillId: s.currentSkillId,
    phase: s.phase,
    currentQuestion: s.currentQuestion,
    log: s.log,
    preTestScore: s.preTestScore,
    postTestScore: s.postTestScore,
  };
}
