// HTTP + SSE integration check against a running backend (mock mode).
// Usage: start the backend, then: npx tsx src/httpTest.ts
export {}; // make this a module so top-level await is allowed under tsc

const BASE = process.env.BASE ?? "http://localhost:3001";

const sseEvents: { agent: string; type: string; message: string }[] = [];

async function startSSE(sessionId: string) {
  const res = await fetch(`${BASE}/session/${sessionId}/events`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data:")) {
          try {
            sseEvents.push(JSON.parse(line.slice(5).trim()));
          } catch {
            /* ignore */
          }
        }
      }
    }
  })();
  return reader;
}

async function answer(sessionId: string, text: string) {
  const res = await fetch(`${BASE}/session/${sessionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer: text }),
  });
  return res.json();
}

const created: any = await (
  await fetch(`${BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: "Solving a quadratic equation ax²+bx+c=0" }),
  })
).json();

console.log("sessionId:", created.sessionId);
console.log("planned:", created.skills.map((s: any) => s.id).join(", "));
console.log("first Q:", created.currentQuestion.prompt);

const reader = await startSSE(created.sessionId);
await new Promise((r) => setTimeout(r, 400));

const answers = [
  "a=2, b=-3, c=1",
  "Δ = 9 + 8 = 17", // wrong on purpose → tutor + re-ask
  "Δ = 16 - 16 = 0",
  "two real roots because Δ > 0",
  "x = 1 or x = 1/2",
];

let last: any;
for (const a of answers) {
  last = await answer(created.sessionId, a);
  console.log(`→ "${a}"  phase=${last.phase} pre=${last.preTestScore} post=${last.postTestScore}  [${last.skills
    .map((s: any) => s.id + ":" + s.status)
    .join(" ")}]`);
  await new Promise((r) => setTimeout(r, 200));
}

await new Promise((r) => setTimeout(r, 400));
await reader.cancel().catch(() => {});

console.log("\nSSE events received:", sseEvents.length);
const byAgent = sseEvents.reduce<Record<string, number>>((m, e) => ((m[e.agent] = (m[e.agent] ?? 0) + 1), m), {});
console.log("by agent:", byAgent);
const sawHint = sseEvents.some((e) => e.type === "hint");
const sawReask = sseEvents.some((e) => e.message.includes("Re-testing S2"));
const sawDone = sseEvents.some((e) => e.type === "done");

const ok = last.phase === "done" && last.postTestScore === 100 && sawHint && sawReask && sawDone && sseEvents.length > 10;
console.log(`\n${ok ? "✅ HTTP+SSE TEST PASSED" : "❌ HTTP+SSE TEST FAILED"} (hint=${sawHint} reask=${sawReask} done=${sawDone})`);
process.exit(ok ? 0 : 1);
