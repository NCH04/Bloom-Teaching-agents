import type { RunnableConfig } from "@langchain/core/runnables";
import type { GraphState } from "../types.js";
import { createLogger } from "../util.js";
import { isMockMode, chat } from "../llm.js";

// The Engagement Coach (optional fourth agent) closes the loop with a short, contextual
// encouragement once every skill is mastered.

async function coachMessage(state: GraphState): Promise<string> {
  const pre = state.preTestScore ?? 0;
  const post = state.postTestScore ?? 100;
  const fallback = `Outstanding work — you went from a ${pre}% cold start to ${post}% mastery across all ${state.skills.length} skills. That's the 2-sigma jump in action. 🎓`;

  if (isMockMode()) return fallback;

  const system =
    "You are an encouraging learning coach. Write ONE upbeat sentence (<= 25 words) celebrating the student's " +
    "mastery. Plain text only — no preamble.";
  const user = `Goal: ${state.goal}. Skills mastered: ${state.skills.length}. Pre-test: ${pre}%. Post-test: ${post}%.`;
  try {
    const txt = await chat(system, user, { temperature: 0.7, maxTokens: 80 });
    return txt || fallback;
  } catch {
    return fallback;
  }
}

export async function engagementCoach(state: GraphState, config?: RunnableConfig): Promise<Partial<GraphState>> {
  const log = createLogger(config);
  const message = await coachMessage(state);
  await log.note("coach", "encouragement", message);
  return { log: log.events };
}
