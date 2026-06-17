import type { RunnableConfig } from "@langchain/core/runnables";
import type { GradeResult, GraphState, Question, SkillState } from "../types.js";
import { createLogger, truncate } from "../util.js";
import { isMockMode, chatJSON } from "../llm.js";
import { bankGrade, bankMisconception, bankQuestion } from "../seed.js";
import { preTestScore } from "../scoring.js";

// The Assessor is the mastery gate: it poses a question, grades the answer against a
// threshold, and — on failure — extracts the precise misconception.

async function generateQuestion(skill: SkillState): Promise<Question> {
  // Seed skills always use the fixed bank (reliable demo); attempts pick a NEW variant.
  const banked = bankQuestion(skill.id, skill.attempts);
  if (banked) return banked;

  if (isMockMode()) {
    return { prompt: `In your own words, demonstrate: ${skill.name}.`, expected: "" };
  }

  const system =
    "You are an assessment author. Write ONE short question (answerable in one line) that tests the skill. " +
    'Return ONLY JSON: {"prompt":"...","expected":"..."}.';
  const user =
    `Skill: ${skill.name}\nAttempt #${skill.attempts + 1}.` +
    (skill.attempts > 0
      ? ` Make it DIFFERENT from previous attempts and target these misconceptions: ${skill.lastErrors.join("; ")}.`
      : "");
  const parsed = await chatJSON<Question>(system, user, { temperature: 0.6, maxTokens: 300 });
  return parsed?.prompt ? parsed : { prompt: `Demonstrate the skill: ${skill.name}.`, expected: "" };
}

async function gradeAnswer(skill: SkillState, question: Question, answer: string): Promise<GradeResult> {
  if (!answer.trim()) return { correct: false, score: 0, misconception: "No answer was provided." };
  if (isMockMode()) return bankGrade(skill.id, question.prompt, question.expected, answer);

  const system =
    "You are a strict but fair grader. Decide whether the student's answer is essentially correct. " +
    'Return ONLY JSON: {"correct":boolean,"score":0-100,"misconception":string|null}. ' +
    "Mastery means score >= 70. If wrong, `misconception` must name the precise conceptual error in <= 12 words " +
    "(e.g. 'sign error on -4ac'); use null when correct.";
  const user =
    `Skill: ${skill.name}\nQuestion: ${question.prompt}\n` +
    `Reference answer: ${question.expected || "(use your own knowledge)"}\nStudent answer: ${answer}`;
  const parsed = await chatJSON<{ correct: boolean; score: number; misconception: string | null }>(
    system,
    user,
    { temperature: 0, maxTokens: 200 },
  );
  if (!parsed) return bankGrade(skill.id, question.prompt, question.expected, answer);

  const score = typeof parsed.score === "number" ? parsed.score : parsed.correct ? 100 : 0;
  const correct = parsed.correct ?? score >= 70;
  return {
    correct,
    score,
    misconception: correct ? null : (parsed.misconception ?? bankMisconception(skill.id)),
  };
}

// ASK node: generate (or re-generate) the question for the current skill.
export async function assessorAsk(state: GraphState, config?: RunnableConfig): Promise<Partial<GraphState>> {
  const log = createLogger(config);
  const skills = state.skills.map((s) => ({ ...s }));
  const skill = skills.find((s) => s.id === state.currentSkillId)!;
  const isReask = skill.attempts > 0;
  skill.status = "in_progress";

  const question = await generateQuestion(skill);

  if (isReask) {
    await log.note("assessor", "question", `Re-testing ${skill.id} with a NEW question (attempt ${skill.attempts + 1}).`);
  } else {
    await log.note("assessor", "question", `Testing ${skill.id}: ${skill.name}.`);
  }

  return { skills, currentQuestion: question, phase: "assessing", log: log.events };
}

// GRADE node (runs after the student's answer resumes the graph).
export async function assessorGrade(state: GraphState, config?: RunnableConfig): Promise<Partial<GraphState>> {
  const log = createLogger(config);
  const skills = state.skills.map((s) => ({ ...s }));
  const skill = skills.find((s) => s.id === state.currentSkillId)!;
  const answer = (state.pendingAnswer ?? "").trim();
  skill.attempts += 1;

  await log.note("assessor", "grading", `Grading ${skill.id} — student answered: "${truncate(answer)}".`);
  const result = await gradeAnswer(skill, state.currentQuestion!, answer);

  if (result.correct) {
    skill.status = "mastered";
    await log.note("assessor", "mastery_update", `${skill.id} mastered ✓ (score ${result.score}/100).`);
  } else {
    skill.status = "in_progress";
    if (result.misconception) skill.lastErrors = [...skill.lastErrors, result.misconception];
    await log.note(
      "assessor",
      "mastery_update",
      `${skill.id} not mastered (score ${result.score}/100). Misconception: ${result.misconception ?? "unclear"}.`,
    );
  }

  return {
    skills,
    lastResult: result,
    pendingAnswer: null,
    preTestScore: preTestScore(skills),
    log: log.events,
  };
}
