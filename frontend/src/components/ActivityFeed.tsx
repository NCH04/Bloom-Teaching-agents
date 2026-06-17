import { useEffect, useRef } from "react";
import type { AgentEvent, AgentName } from "../types";

// Each agent gets a restrained tint so viewers can instantly see WHO is acting —
// the core differentiator of the project.
const AGENT_META: Record<AgentName, { label: string; chip: string; bar: string }> = {
  orchestrator: { label: "Orchestrator", chip: "bg-indigo-50 text-indigo-700 ring-indigo-200", bar: "bg-indigo-400" },
  assessor: { label: "Assessor", chip: "bg-sky-50 text-sky-700 ring-sky-200", bar: "bg-sky-400" },
  tutor: { label: "Tutor", chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-400" },
  coach: { label: "Coach", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-400" },
};

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" });
}

export function ActivityFeed({ events }: { events: AgentEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Agent activity</h2>
        <span className="ml-auto text-xs font-medium text-slate-400">{events.length} steps</span>
      </div>

      <div className="feed-scroll flex-1 overflow-y-auto px-4 py-3">
        {events.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-400">Waiting for the agents to start reasoning…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e, i) => {
              const meta = AGENT_META[e.agent];
              return (
                <li
                  key={`${e.timestamp}-${i}`}
                  className="flex animate-slide-in gap-3 rounded-lg p-2 hover:bg-slate-50"
                >
                  <span className={`mt-1 w-1 shrink-0 self-stretch rounded-full ${meta.bar}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.chip}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-300">{e.type}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-slate-300">{time(e.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-slate-700">{e.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
