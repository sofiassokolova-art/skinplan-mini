// src/ui/Progress.tsx
type Props = { value: number };

export default function Progress({ value }: Props) {
  return (
    <div className="w-full h-2 rounded bg-neutral-200/60">
      <div
        className="h-2 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
