import type { SkillState } from "./types.js";

// Pre-test proxy: the share of skills the student got right on the VERY FIRST attempt
// (i.e. what they already knew "cold"). Returns null until at least one skill is graded.
export function preTestScore(skills: SkillState[]): number | null {
  if (!skills.some((s) => s.attempts > 0)) return null;
  const firstTry = skills.filter((s) => s.attempts === 1 && s.status === "mastered").length;
  return Math.round((firstTry / skills.length) * 100);
}

// Post-test: share of skills mastered (100% once the loop reaches `done`).
export function postTestScore(skills: SkillState[]): number {
  if (skills.length === 0) return 0;
  const mastered = skills.filter((s) => s.status === "mastered").length;
  return Math.round((mastered / skills.length) * 100);
}
