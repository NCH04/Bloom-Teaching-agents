import type { RunnableConfig } from "@langchain/core/runnables";
import type { GraphState, SkillState } from "../types.js";
import { createLogger } from "../util.js";
import { isMockMode, chatJSON } from "../llm.js";
import { SEED_SKILLS, isQuadraticGoal, genericMockSkills } from "../seed.js";
import { preTestScore, postTestScore } from "../scoring.js";

// The Orchestrator is the autonomous brain: it decomposes the goal into an ordered
// list of prerequisite skills, then later decides whether to advance or finish.

function makeSkill(s: { id: string; name: string }): SkillState {
  return { id: s.id, name: s.name, status: "not_started", attempts: 0, lastErrors: [] };
}

async function planSkills(goal: string): Promise<SkillState[]> {
  // Fixed seed for the demo goal — deterministic and reliable.
  if (isQuadraticGoal(goal)) return SEED_SKILLS.map(makeSkill);
  if (isMockMode()) return genericMockSkills(goal).map(makeSkill);

  const system =
    "You are an expert curriculum planner. Decompose the learning goal into 3-6 ORDERED " +
    "prerequisite skills (earliest first). Return ONLY JSON: " +
    '{"skills":[{"id":"S1","name":"..."}]}. Names are short imperative phrases.';
  const parsed = await chatJSON<{ skills: { id?: string; name: string }[] }>(
    system,
    `Goal: ${goal}`,
    { temperature: 0.4, maxTokens: 400 },
  );
  if (parsed?.skills?.length) {
    return parsed.skills.map((s, i) => makeSkill({ id: s.id || `S${i + 1}`, name: s.name }));
  }
  return genericMockSkills(goal).map(makeSkill);
}

// START node: build the skill map and select the first skill.
export async function orchestratorPlan(state: GraphState, config?: RunnableConfig): Promise<Partial<GraphState>> {
  const log = createLogger(config);
  await log.note("orchestrator", "planning", `New goal: "${state.goal}". Decomposing into prerequisite skills…`);

  const skills = await planSkills(state.goal);
  await log.note(
    "orchestrator",
    "planning",
    `Planned ${skills.length} skills: ${skills.map((s) => s.id).join(", ")}.`,
  );

  const first = skills[0];
  await log.note("orchestrator", "planning", `Mastery path ready. Starting with ${first.id}: ${first.name}.`);

  return { skills, currentSkillId: first.id, phase: "assessing", log: log.events };
}

// After a skill is mastered: mark it, then pick the next unstarted skill or finish.
export async function orchestratorAdvance(state: GraphState, config?: RunnableConfig): Promise<Partial<GraphState>> {
  const log = createLogger(config);
  const skills = state.skills.map((s) => ({ ...s }));
  const current = skills.find((s) => s.id === state.currentSkillId);
  if (current) current.status = "mastered";

  const next = skills.find((s) => s.status === "not_started");

  if (next) {
    await log.note(
      "orchestrator",
      "advance",
      `${current?.id} mastered ✓ — advancing to ${next.id}: ${next.name}.`,
    );
    return {
      skills,
      currentSkillId: next.id,
      currentQuestion: null,
      phase: "assessing",
      preTestScore: preTestScore(skills),
      log: log.events,
    };
  }

  await log.note("orchestrator", "advance", `${current?.id} mastered ✓ — that was the last skill.`);
  await log.note("orchestrator", "done", "🎉 Goal achieved — every prerequisite skill is mastered.");
  return {
    skills,
    currentSkillId: null,
    currentQuestion: null,
    phase: "done",
    preTestScore: preTestScore(skills),
    postTestScore: postTestScore(skills),
    log: log.events,
  };
}
