import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentEvent, AgentName } from "./types.js";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// A small, deliberate delay between agent events so the live feed is legible on a
// projector. LLM latency already paces real mode; PACE_MS keeps mock mode watchable.
export function pace(): Promise<void> {
  const ms = Number(process.env.PACE_MS ?? 350);
  return ms > 0 ? sleep(ms) : Promise.resolve();
}

export function truncate(s: string, n = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

type EmitFn = (e: AgentEvent) => void;

// Each node creates a logger, records its events, and returns `logger.events` so they
// are appended to the persisted log. `note()` also pushes the event live to SSE.
export function createLogger(config?: RunnableConfig) {
  const emit = config?.configurable?.emit as EmitFn | undefined;
  const events: AgentEvent[] = [];
  return {
    events,
    async note(agent: AgentName, type: string, message: string): Promise<void> {
      const event: AgentEvent = { agent, type, message, timestamp: Date.now() };
      events.push(event);
      emit?.(event);
      await pace();
    },
  };
}
