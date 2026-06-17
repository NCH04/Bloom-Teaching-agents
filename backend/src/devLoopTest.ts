// Terminal verification of the full mastery loop in deterministic MOCK mode:
//   plan → ask → wrong answer → tutor → re-ask → right answer → advance → … → done
// Run with:  npm run loop:test  -w backend
import "./polyfill.js";
import dotenv from "dotenv";
dotenv.config();
process.env.USE_MOCK_LLM = "1"; // force deterministic mock for the test
process.env.PACE_MS = "0"; // no artificial delay in the test

import { Command } from "@langchain/langgraph";
import { buildGraph } from "./graph.js";
import type { AgentEvent, GraphState } from "./types.js";

const graph = buildGraph();
const config = {
  configurable: {
    thread_id: "loop-test",
    emit: (e: AgentEvent) => console.log(`   · [${e.agent}] ${e.message}`),
  },
};

async function values(): Promise<GraphState> {
  const snap = await graph.getState(config);
  return snap.values as GraphState;
}

function showSkills(s: GraphState) {
  console.log("   skills:", s.skills.map((k) => `${k.id}:${k.status}(${k.attempts})`).join("  "));
}

async function answer(label: string, text: string) {
  console.log(`\n▶ answering ${label}: "${text}"`);
  await graph.invoke(new Command({ resume: text }), config);
  const v = await values();
  showSkills(v);
  if (v.currentQuestion) console.log("   next Q:", v.currentQuestion.prompt);
  console.log("   phase:", v.phase, "| pre:", v.preTestScore, "| post:", v.postTestScore);
}

console.log("=== BloomLoop mock loop test ===\n");
console.log("▶ planning…");
await graph.invoke({ goal: "Solving a quadratic equation ax²+bx+c=0" }, config);
let v = await values();
showSkills(v);
console.log("   first Q:", v.currentQuestion?.prompt);

// S1 — correct first try
await answer("S1", "a=2, b=-3, c=1");
// S2 — WRONG (sign error) → tutor → re-ask with a new question
await answer("S2 (wrong)", "Δ = 9 + 8 = 17");
// S2 — correct on the new (variant) question: x²+4x+4 → Δ = 0
await answer("S2 (retry)", "Δ = 16 - 16 = 0");
// S3 — correct
await answer("S3", "two real roots because Δ > 0");
// S4 — correct
await answer("S4", "x = 1 or x = 1/2");

v = await values();
console.log("\n=== RESULT ===");
console.log("phase:", v.phase);
showSkills(v);
console.log("preTestScore:", v.preTestScore, " postTestScore:", v.postTestScore);

const allMastered = v.skills.every((s) => s.status === "mastered");
const s2 = v.skills.find((s) => s.id === "S2");
const ok = v.phase === "done" && allMastered && (s2?.attempts ?? 0) >= 2;
console.log(ok ? "\n✅ LOOP TEST PASSED" : "\n❌ LOOP TEST FAILED");
process.exit(ok ? 0 : 1);
