/** Time remaining as a bar plus a number: visible from across a room, readable by screen readers once. */
export function CountdownBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const urgent = remaining <= 5;
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full ${urgent ? "bg-wrong" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tnum w-10 text-right text-lg font-semibold" role="timer" aria-live="off">{Math.ceil(remaining)}</span>
    </div>
  );
}
