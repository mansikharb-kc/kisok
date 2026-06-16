export default function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-10 text-center">
        <p className="text-slate-500 text-sm">
          {note ?? "This module is part of the build plan and is coming next."}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Categories is the reference module — the rest follow the same pattern.
        </p>
      </div>
    </div>
  );
}
