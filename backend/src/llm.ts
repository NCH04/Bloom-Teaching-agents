import { ChatAnthropic } from "@langchain/anthropic";

// Provider-agnostic LLM access. To swap providers, change ONLY this file:
// replace ChatAnthropic with another @langchain/* chat model that exposes `.invoke`.

const DEFAULT_MODEL = "claude-sonnet-4-6";

// Mock mode runs the whole loop deterministically with no network — used for the
// terminal loop test and as a live-demo safety net when the API is unavailable.
export function isMockMode(): boolean {
  if (String(process.env.USE_MOCK_LLM) === "1") return true;
  return !process.env.ANTHROPIC_API_KEY;
}

function makeModel(temperature: number, maxTokens: number) {
  return new ChatAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.MODEL || DEFAULT_MODEL,
    temperature,
    maxTokens,
  });
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === "string" ? b : ((b as { text?: string })?.text ?? "")))
      .join("");
  }
  return String(content ?? "");
}

export interface ChatOpts {
  temperature?: number;
  maxTokens?: number;
}

export async function chat(system: string, user: string, opts: ChatOpts = {}): Promise<string> {
  const model = makeModel(opts.temperature ?? 0.3, opts.maxTokens ?? 700);
  const res = await model.invoke([
    ["system", system],
    ["human", user],
  ]);
  return textOf(res.content).trim();
}

// Strip ```json ... ``` (or bare ``` ... ```) fences a model may wrap JSON in.
export function stripFences(s: string): string {
  const t = s.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : t;
}

// Defensive JSON call: returns null on any chat/parse failure so callers can fall back.
export async function chatJSON<T>(system: string, user: string, opts: ChatOpts = {}): Promise<T | null> {
  try {
    const raw = await chat(system, user, opts);
    return JSON.parse(stripFences(raw)) as T;
  } catch (err) {
    console.warn("[llm] chat/JSON failed, falling back to deterministic logic:", (err as Error).message);
    return null;
  }
}
