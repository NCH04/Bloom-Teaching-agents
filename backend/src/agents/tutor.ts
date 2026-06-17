import type { RunnableConfig } from "@langchain/core/runnables";
import type { GraphState, Question, SkillState } from "../types.js";
import { createLogger } from "../util.js";
import { isMockMode, chatJSON } from "../llm.js";
import { bankHint } from "../seed.js";

// The Socratic Tutor reacts to a failure: from the extracted misconception it produces
// a GRADED hint that guides the student WITHOUT revealing the answer, plus a short
// targeted explanation.

async function generateHint(
  skill: SkillState,
  misconception: string,
  question: Question,
): Promise<{ hint: string; explanation: string }> {
  if (isMockMode()) return { hint: bankHint(skill.id), explanation: "" };

  const system =
    "You are a Socratic tutor. Given the student's misconception, produce ONE graded hint that guides them " +
    "toward the fix WITHOUT revealing the final/numeric answer, plus a one-sentence targeted explanation. " +
    'Never state the answer. Return ONLY JSON: {"hint":"...","explanation":"..."}.';
  const user = `Skill: ${skill.name}\nQuestion: ${question.prompt}\nMisconception: ${misconception}`;
  const parsed = await chatJSON<{ hint: string; explanation: string }>(system, user, {
    temperature: 0.4,
    maxTokens: 250,
  });
  return parsed?.hint ? { hint: parsed.hint, explanation: parsed.explanation ?? "" } : { hint: bankHint(skill.id), explanation: "" };
}

// REMEDIATE node: emit a hint, then the graph loops back to ASK with a new question.
export async function tutorRemediate(state: GraphState, config?: RunnableConfig): Promise<Partial<GraphState>> {
  const log = createLogger(config);
  const skill = state.skills.find((s) => s.id === state.currentSkillId)!;
  const misconception =
    state.lastResult?.misconception ??
    skill.lastErrors[skill.lastErrors.length - 1] ??
    "general confusion on this step";

  await log.note("tutor", "analyzing", `Diagnosing ${skill.id}: ${misconception}`);
  const { hint, explanation } = await generateHint(skill, misconception, state.currentQuestion!);
  await log.note("tutor", "hint", `Hint → ${hint}`);
  if (explanation) await log.note("tutor", "explanation", explanation);

  return { phase: "remediating", log: log.events };
}
