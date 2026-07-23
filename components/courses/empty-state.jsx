export default function EmptyState({ title, description, dark = false }) {
  return (
    <div
      className={[
        "rounded-3xl border p-8 text-center",
        dark ? "border-white/10 bg-white/5 text-white" : "border-slate-200 bg-slate-50 text-slate-900",
      ].join(" ")}
    >
      <h3 className={["text-xl font-bold", dark ? "text-white" : "text-[#1B2B50]"].join(" ")}>{title}</h3>
      <p className={["mt-3 text-sm leading-7", dark ? "text-slate-300" : "text-slate-600"].join(" ")}>
        {description}
      </p>
    </div>
  );
}
