import type { GradeResult, Question } from "./types.js";

// ---------------------------------------------------------------------------
// Seed content for the demo goal. For the quadratic goal the skills AND the
// questions are fixed (hardcoded) so the live demo is 100% reliable. The LLM is
// still used for grading, misconception extraction, and hints — that is where the
// agentic intelligence shows. Free-form goals fall back to LLM planning.
// ---------------------------------------------------------------------------

export const SEED_SKILLS: { id: string; name: string }[] = [
  { id: "S1", name: "Identify the coefficients a, b, c" },
  { id: "S2", name: "Compute the discriminant Δ = b² − 4ac" },
  { id: "S3", name: "Interpret the sign of Δ (two / one / zero real roots)" },
  { id: "S4", name: "Apply the roots formula x = (−b ± √Δ) / 2a" },
];

interface BankQuestion extends Question {
  keys: string[]; // tokens that must all appear in a correct answer (mock grader)
}

export const QUESTION_BANK: Record<string, BankQuestion[]> = {
  S1: [
    {
      prompt: "For the equation 2x² − 3x + 1 = 0, identify the coefficients a, b, and c.",
      expected: "a = 2, b = -3, c = 1",
      keys: ["a=2", "b=-3", "c=1"],
    },
    {
      prompt: "For the equation x² + 5x − 6 = 0, identify the coefficients a, b, and c.",
      expected: "a = 1, b = 5, c = -6",
      keys: ["a=1", "b=5", "c=-6"],
    },
    {
      prompt: "For the equation 3x² − 12 = 0, identify the coefficients a, b, and c.",
      expected: "a = 3, b = 0, c = -12",
      keys: ["a=3", "b=0", "c=-12"],
    },
  ],
  S2: [
    {
      prompt: "Compute the discriminant Δ = b² − 4ac for 2x² − 3x + 1 = 0.",
      expected: "Δ = (−3)² − 4·2·1 = 9 − 8 = 1",
      keys: ["1"],
    },
    {
      prompt: "Compute the discriminant Δ = b² − 4ac for x² + 4x + 4 = 0.",
      expected: "Δ = 16 − 16 = 0",
      keys: ["0"],
    },
    {
      prompt: "Compute the discriminant Δ = b² − 4ac for x² + x + 1 = 0.",
      expected: "Δ = 1 − 4 = -3",
      keys: ["-3"],
    },
  ],
  S3: [
    {
      prompt: "A quadratic has discriminant Δ = 1. How many real roots does it have, and why?",
      expected: "Two distinct real roots, because Δ > 0.",
      keys: ["two"],
    },
    {
      prompt: "A quadratic has discriminant Δ = 0. How many real roots does it have?",
      expected: "One real (double) root, because Δ = 0.",
      keys: ["one"],
    },
    {
      prompt: "A quadratic has discriminant Δ = -3. How many real roots does it have?",
      expected: "No real roots, because Δ < 0.",
      keys: ["no"],
    },
  ],
  S4: [
    {
      prompt: "Use x = (−b ± √Δ) / 2a to solve 2x² − 3x + 1 = 0 (you found Δ = 1).",
      expected: "x = 1 or x = 1/2",
      keys: ["1", "1/2"],
    },
    {
      prompt: "Use the quadratic formula to solve x² − 5x + 6 = 0.",
      expected: "x = 2 or x = 3",
      keys: ["2", "3"],
    },
    {
      prompt: "Use the quadratic formula to solve x² − 2x + 1 = 0.",
      expected: "x = 1 (a double root)",
      keys: ["1"],
    },
  ],
};

export const MISCONCEPTIONS: Record<string, string> = {
  S1: "Sign error: b is the signed coefficient (here b = -3, not 3); a missing term means a 0 coefficient.",
  S2: "Sign error on the −4ac term — you likely computed b² + 4ac instead of b² − 4ac.",
  S3: "Cases mixed up — recall: Δ > 0 → two roots, Δ = 0 → one root, Δ < 0 → none.",
  S4: "Forgot the ± (so only one root), or divided by a instead of 2a.",
};

export const HINTS: Record<string, string> = {
  S1: "Look carefully at the sign in front of each term — a coefficient carries its own sign. What number multiplies x, including its sign?",
  S2: "Re-check the operation in b² − 4ac. Is it a plus or a minus before 4ac? Recompute just that one term.",
  S3: "You only need the SIGN of Δ here, not the roots. Sort the three cases: what does a positive Δ tell you about the number of roots?",
  S4: "The formula has a ± — that produces two values. Compute the '+' branch and the '−' branch separately, and remember to divide by 2a.",
};

export function isQuadraticGoal(goal: string): boolean {
  const g = goal.toLowerCase();
  return (
    g.includes("quadratic") ||
    g.includes("ax²") ||
    g.includes("ax^2") ||
    (g.includes("x²") && g.includes("=")) ||
    (g.includes("x^2") && g.includes("="))
  );
}

export function bankQuestion(skillId: string, attemptIndex: number): Question | null {
  const list = QUESTION_BANK[skillId];
  if (!list || list.length === 0) return null;
  const q = list[attemptIndex % list.length];
  return { prompt: q.prompt, expected: q.expected };
}

export function bankHint(skillId: string): string {
  return HINTS[skillId] ?? "Break the problem into smaller steps and re-check the step where you were unsure.";
}

export function bankMisconception(skillId: string): string {
  return MISCONCEPTIONS[skillId] ?? "Conceptual error — revisit the definition for this step.";
}

// Generic decomposition for free-form goals when running in mock mode.
export function genericMockSkills(goal: string): { id: string; name: string }[] {
  const g = goal.trim();
  return [
    { id: "S1", name: `Understand the core concepts behind: ${g}` },
    { id: "S2", name: `Apply ${g} to a simple case` },
    { id: "S3", name: `Solve a complete ${g} problem end to end` },
  ];
}

// ---------------- Deterministic mock grader ----------------

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole-token match: avoids "1" matching inside "17" or "1/2".
export function hasToken(haystack: string, token: string): boolean {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9/])${esc}([^a-z0-9/]|$)`);
  return re.test(haystack);
}

export function bankGrade(skillId: string, prompt: string, _expected: string, answer: string): GradeResult {
  const norm = normalize(answer);
  const entry = QUESTION_BANK[skillId]?.find((q) => q.prompt === prompt);
  const keys = entry?.keys ?? [];

  if (keys.length === 0) {
    // Free-form goal: be lenient so the mock loop can still progress.
    const correct = norm.replace(/[^a-z0-9]/g, "").length >= 8;
    return {
      correct,
      score: correct ? 80 : 30,
      misconception: correct ? null : "Answer too vague — state the key idea explicitly.",
    };
  }

  const allPresent = keys.every((k) => hasToken(norm, normalize(k)));
  return allPresent
    ? { correct: true, score: 100, misconception: null }
    : { correct: false, score: 25, misconception: bankMisconception(skillId) };
}
