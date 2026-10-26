import type { LeaderboardEntry } from "@/core/types";

/** Final standings: top three emphasised, everyone else as a plain ranked list. */
export function Podium({ ranking, meId }: { ranking: LeaderboardEntry[]; meId?: string }) {
  const top = ranking.slice(0, 3);
  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {top.map((e) => (
          <li key={e.playerId} className={`rounded-(--radius-card) border p-4 text-center ${e.rank === 1 ? "border-accent" : "border-line"} bg-surface`}>
            <p className="text-sm font-medium text-muted">{["1st", "2nd", "3rd"][e.rank - 1]}</p>
            <p className="mt-1 truncate text-xl font-bold">{e.nickname}{e.playerId === meId && " (you)"}</p>
            <p className="tnum text-lg">{e.score.toLocaleString()}</p>
          </li>
        ))}
      </ol>
      <Leaderboard entries={ranking.slice(3)} meId={meId} startAt={4} />
    </div>
  );
}

export function Leaderboard({ entries, meId, startAt = 1, large = false }:
  { entries: LeaderboardEntry[]; meId?: string; startAt?: number; large?: boolean }) {
  if (entries.length === 0) return null;
  return (
    <ol start={startAt} className={`mt-3 flex flex-col gap-1.5 ${large ? "text-xl" : "text-base"}`}>
      {entries.map((e) => (
        <li key={e.playerId}
          className={`flex items-center gap-3 rounded-(--radius-control) border px-3 py-2 ${e.playerId === meId ? "border-accent bg-surface" : "border-line bg-surface"}`}>
          <span className="tnum w-7 text-right text-muted">{e.rank}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{e.nickname}</span>
          <span className="tnum font-semibold">{e.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
