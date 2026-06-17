// Mirrors the backend's public BloomState contract.
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
  sessionId: string;
  goal: string;
  skills: SkillState[];
  currentSkillId: string | null;
  phase: Phase;
  currentQuestion: Question | null;
  log: AgentEvent[];
  preTestScore: number | null;
  postTestScore: number | null;
}
