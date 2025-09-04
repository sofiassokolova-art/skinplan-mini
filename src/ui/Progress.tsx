
type ProgressProps = { idx: number; total: number };

export default function Progress({ idx, total }: ProgressProps) {
  const pct = Math.round(((idx + 1) / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1 text-zinc-500">
        <span>Шаг {idx + 1}/{total}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-3 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

