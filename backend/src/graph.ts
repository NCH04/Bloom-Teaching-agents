import { StateGraph, START, END, MemorySaver, interrupt } from "@langchain/langgraph";
import { GraphAnnotation, type GraphState } from "./types.js";
import { orchestratorPlan, orchestratorAdvance } from "./agents/orchestrator.js";
import { assessorAsk, assessorGrade } from "./agents/assessor.js";
import { tutorRemediate } from "./agents/tutor.js";
import { engagementCoach } from "./agents/coach.js";

// Human-in-the-loop pause point. interrupt() suspends the graph until it is resumed
// with `new Command({ resume: answer })`; on resume this node re-runs and interrupt()
// returns the student's answer. Earlier nodes (plan, ask) do NOT re-run.
function humanInput(state: GraphState): Partial<GraphState> {
  const answer = interrupt({ prompt: state.currentQuestion?.prompt ?? "", skillId: state.currentSkillId });
  return { pendingAnswer: String(answer ?? "") };
}

// Conditional edges.
function routeAfterGrade(state: GraphState): "advance" | "remediate" {
  return state.lastResult?.correct ? "advance" : "remediate";
}
function routeAfterAdvance(state: GraphState): "ask" | "done" {
  return state.phase === "done" ? "done" : "ask";
}

export function buildGraph() {
  const workflow = new StateGraph(GraphAnnotation)
    .addNode("orchestrator_plan", orchestratorPlan)
    .addNode("assessor_ask", assessorAsk)
    .addNode("human_input", humanInput)
    .addNode("assessor_grade", assessorGrade)
    .addNode("tutor_remediate", tutorRemediate)
    .addNode("orchestrator_advance", orchestratorAdvance)
    .addNode("engagement_coach", engagementCoach)
    // START → plan → ask → (pause for answer) → grade
    .addEdge(START, "orchestrator_plan")
    .addEdge("orchestrator_plan", "assessor_ask")
    .addEdge("assessor_ask", "human_input")
    .addEdge("human_input", "assessor_grade")
    // grade → mastered ? advance : remediate
    .addConditionalEdges("assessor_grade", routeAfterGrade, {
      advance: "orchestrator_advance",
      remediate: "tutor_remediate",
    })
    // remediate → back to ask (with a different question)  [the cycle]
    .addEdge("tutor_remediate", "assessor_ask")
    // advance → more skills ? ask : coach → END
    .addConditionalEdges("orchestrator_advance", routeAfterAdvance, {
      ask: "assessor_ask",
      done: "engagement_coach",
    })
    .addEdge("engagement_coach", END);

  // MemorySaver = in-memory persistent checkpointer (one thread_id per session).
  return workflow.compile({ checkpointer: new MemorySaver() });
}

export type BloomGraph = ReturnType<typeof buildGraph>;
