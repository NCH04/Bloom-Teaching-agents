import type { AgentEvent, BloomState } from "./types";

async function postJSON(url: string, body: unknown): Promise<BloomState> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function createSession(goal: string): Promise<BloomState> {
  return postJSON("/session", { goal });
}

export function sendAnswer(sessionId: string, answer: string): Promise<BloomState> {
  return postJSON(`/session/${sessionId}/answer`, { answer });
}

// Subscribe to the live agent-activity stream. Returns an unsubscribe function.
export function subscribeEvents(sessionId: string, onEvent: (e: AgentEvent) => void): () => void {
  const es = new EventSource(`/session/${sessionId}/events`);
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as AgentEvent);
    } catch {
      /* ignore keep-alive / malformed frames */
    }
  };
  // EventSource reconnects automatically; the backend replays buffered events on connect.
  return () => es.close();
}
