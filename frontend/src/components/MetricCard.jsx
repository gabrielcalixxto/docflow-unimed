const toneStyles = {
  green: "border-unimed-100 bg-unimed-50 text-unimed-800",
  citrus: "border-lime-200 bg-lime-50 text-lime-900",
  orange: "border-amber-200 bg-amber-50 text-amber-900",
  dark: "border-slate-200 bg-slate-950 text-white",
};

export default function MetricCard({ metric }) {
  return (
    <article className={`rounded-[24px] border px-4 py-4 ${toneStyles[metric.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-80">{metric.label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-3xl font-semibold">{metric.value}</span>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          {metric.kicker}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 opacity-80">{metric.detail}</p>
    </article>
  );
}
