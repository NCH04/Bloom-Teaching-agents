interface Props {
  pre: number | null;
  post: number | null;
}

function Badge({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-2 ${
        highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${highlight ? "text-emerald-600" : "text-slate-800"}`}>
        {value === null ? "—" : `${value}%`}
      </span>
    </div>
  );
}

// Header badges contrasting the "cold" pre-test with the post-loop mastery score —
// the visible "2 sigma" jump.
export function ScoreBadges({ pre, post }: Props) {
  return (
    <div className="flex items-center gap-3">
      <Badge label="Pre-test" value={pre} />
      <span className="text-slate-300">→</span>
      <Badge label="Post-test" value={post} highlight={post !== null} />
    </div>
  );
}
