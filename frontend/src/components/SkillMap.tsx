import type { SkillState } from "../types";

const STATUS: Record<SkillState["status"], { dot: string; ring: string; label: string }> = {
  not_started: { dot: "bg-slate-300", ring: "border-slate-200 bg-white", label: "Not started" },
  in_progress: { dot: "bg-blue-500 animate-pulse", ring: "border-blue-300 bg-blue-50", label: "In progress" },
  mastered: { dot: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50/60", label: "Mastered" },
};

interface Props {
  skills: SkillState[];
  currentSkillId: string | null;
}

export function SkillMap({ skills, currentSkillId }: Props) {
  const mastered = skills.filter((s) => s.status === "mastered").length;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Skill map</h2>
        <span className="text-xs font-medium text-slate-400">
          {mastered}/{skills.length} mastered
        </span>
      </div>

      <ol className="flex flex-1 flex-col gap-3">
        {skills.map((skill) => {
          const s = STATUS[skill.status];
          const active = skill.id === currentSkillId;
          return (
            <li
              key={skill.id}
              className={`rounded-xl border p-3 transition-all ${s.ring} ${
                active ? "ring-2 ring-accent-ring" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                <span className="text-xs font-bold text-slate-400">{skill.id}</span>
                <span className="flex-1 text-sm font-medium leading-snug text-slate-700">{skill.name}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-[1.4rem] text-[11px] text-slate-400">
                <span>{s.label}</span>
                {skill.attempts > 0 && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                    {skill.attempts} {skill.attempts === 1 ? "attempt" : "attempts"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
