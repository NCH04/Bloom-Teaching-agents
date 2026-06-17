import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { AgentEvent } from "./types.js";

// In-memory session registry. Each session owns a LangGraph thread_id, a live event
// buffer (for SSE replay), and an emitter that SSE clients subscribe to.
export interface Session {
  id: string;
  emitter: EventEmitter;
  events: AgentEvent[]; // every event so far — replayed to late-connecting SSE clients
  emit: (e: AgentEvent) => void;
  createdAt: number;
}

const sessions = new Map<string, Session>();

export function createSession(): Session {
  const id = randomUUID();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);
  const events: AgentEvent[] = [];

  const session: Session = {
    id,
    emitter,
    events,
    createdAt: Date.now(),
    // Single source of truth: buffer for replay + push to live subscribers.
    emit(e: AgentEvent) {
      events.push(e);
      emitter.emit("event", e);
    },
  };

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
