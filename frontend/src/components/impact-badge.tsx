const config = {
  high: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400", label: "High impact" },
  medium: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400", label: "Medium" },
  low: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400", label: "Low" },
} as const;

export function ImpactBadge({ impact }: { impact: "high" | "medium" | "low" }) {
  const c = config[impact];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
