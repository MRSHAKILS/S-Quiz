"use client";

import { useState } from "react";
import { ApiError, request } from "@/lib/client";
import { useRemaining, useSession } from "@/lib/use-session";
import { CountdownBar } from "./countdown-bar";
import { Leaderboard, Podium } from "./podium";
import { Button, Card, inputClass, LinkButton } from "./ui";

const LETTERS = ["A", "B", "C", "D"];
const SHAPES = ["▲", "◆", "●", "■"]; // second cue besides the letter: never rely on colour

const JOIN_MESSAGES: Record<string, string> = {
  name_taken: "That nickname is taken. Try another.",
  session_full: "This quiz is full.",
  server_full: "SQuiz is busy right now. Try again in a minute.",
};

export function PlayerConsole({ code }: { code: string }) {
  const { snap, error, clockOffset, refresh } = useSession(code);
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Optimistic tap, scoped to a question so it can never leak into the next one.
  const [pending, setPending] = useState<{ index: number; id: string } | null>(null);
  // Score going into the current question, so the reveal can show the gain.
  const [base, setBase] = useState({ index: -1, score: 0 });

  const q = snap?.question ?? null;
  const remaining = useRemaining(snap?.status === "question" ? snap.startedAt : null, q?.timeLimitSec ?? null, clockOffset);

  // Derived-state update during render (React's documented alternative to an effect).
  if (snap?.status === "question" && q && base.index !== q.index) setBase({ index: q.index, score: snap.me?.score ?? 0 });

  const choice = snap?.me?.choice ?? (pending && q && pending.index === q.index ? pending.id : null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setJoinError(null);
    try {
      await request(`/api/sessions/${code}/join`, { body: { nickname } });
      await refresh();
    } catch (err) {
      const apiErr = err as ApiError;
      setJoinError(apiErr.status === 409 ? "That nickname is taken, or the quiz is full. Try another nickname." : apiErr.message);
    } finally { setBusy(false); }
  }

  async function answer(optionId: string) {
    if (!q || choice) return;
    setPending({ index: q.index, id: optionId });
    try { await request(`/api/sessions/${code}/answer`, { body: { optionId } }); await refresh(); }
    catch { setPending(null); }
  }

  if (error?.status === 404) return <Shell><Message title="Session not found" body="Check the code with your host." /></Shell>;
  if (!snap) return <Shell><Message title="Connecting…" /></Shell>;

  const me = snap.me;

  if (!me) {
    if (snap.status === "ended") return <Shell><Message title="This quiz has ended" /><LinkButton href={`/results/${code}`} variant="secondary" className="mt-4">See results</LinkButton></Shell>;
    return (
      <Shell>
        <p className="text-sm text-muted">Joining</p>
        <p className="tnum font-mono text-3xl tracking-[0.25em]">{code}</p>
        <p className="mb-5 mt-1 text-muted">{snap.quizTitle}</p>
        <form onSubmit={join} className="flex flex-col gap-3" noValidate>
          <label htmlFor="nick" className="text-sm font-medium">Pick a nickname</label>
          <input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} autoComplete="off" autoFocus
            className={`${inputClass} h-14 text-lg`} aria-invalid={!!joinError} aria-describedby="nick-err" />
          <p id="nick-err" role="alert" className="min-h-5 text-sm text-wrong">{joinError}</p>
          <Button size="lg" type="submit" disabled={busy || !nickname.trim()}>{busy ? "Joining…" : "Join quiz"}</Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-semibold">{me.nickname}</span>
        <span className="tnum text-muted">{me.score.toLocaleString()} pts{me.rank ? ` · #${me.rank}` : ""}</span>
      </div>

      <div aria-live="polite" className="sr-only">
        {snap.status === "question" && q ? `Question ${q.index + 1}: ${q.text}` : snap.status === "reveal" ? "Answer revealed" : ""}
      </div>

      {snap.status === "lobby" && (
        <Message title="You're in!" body={`Waiting for the host to start. ${snap.playerCount} player${snap.playerCount === 1 ? "" : "s"} here.`} />
      )}

      {snap.status === "question" && q && (
        <div className="flex flex-1 flex-col">
          <p className="tnum mb-2 text-sm text-muted">Question {q.index + 1} of {q.total}</p>
          {remaining !== null && <CountdownBar remaining={remaining} total={q.timeLimitSec} />}
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-balance">{q.text}</h1>
          <ul className="mt-auto grid gap-3 pt-6">
            {q.options.map((o, i) => {
              const picked = choice === o.id;
              const locked = !!choice || (remaining ?? 1) <= 0;
              return (
                <li key={o.id}>
                  <button type="button" disabled={locked} onClick={() => answer(o.id)} aria-pressed={picked}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-(--radius-card) border-2 bg-surface px-4 py-3 text-left text-lg font-semibold transition-colors ${
                      picked ? "border-accent" : "border-line"} ${locked && !picked ? "opacity-50" : "active:border-accent"}`}>
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-base">{SHAPES[i]}</span>
                    <span className="sr-only">{LETTERS[i]}:</span>
                    <span className="min-w-0 flex-1">{o.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {choice && <p className="mt-4 text-center text-muted" role="status">Answer locked in. Waiting for the round to end…</p>}
          {!choice && (remaining ?? 1) <= 0 && <p className="mt-4 text-center text-muted" role="status">Time&apos;s up.</p>}
        </div>
      )}

      {snap.status === "reveal" && q && (
        <RevealView snap={snap} gain={me.score - base.score} choice={choice} />
      )}

      {snap.status === "ended" && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{me.rank ? `You finished #${me.rank}` : "Quiz complete"}</h1>
          <p className="tnum mb-4 text-muted">{me.score.toLocaleString()} points</p>
          <Podium ranking={snap.leaderboard} />
        </div>
      )}
    </Shell>
  );
}

function RevealView({ snap, gain, choice }: { snap: NonNullable<ReturnType<typeof useSession>["snap"]>; gain: number; choice: string | null }) {
  const q = snap.question!;
  const correct = choice !== null && choice === snap.correctOptionId;
  const correctText = q.options.find((o) => o.id === snap.correctOptionId)?.text;
  return (
    <div>
      <Card className={`p-5 ${correct ? "border-correct" : "border-wrong"}`}>
        <p className={`text-2xl font-bold ${correct ? "text-correct" : "text-wrong"}`}>
          {correct ? "✓ Correct" : choice ? "✗ Not quite" : "No answer"}
        </p>
        {gain > 0 && <p className="tnum mt-1 text-lg font-semibold">+{gain.toLocaleString()} points</p>}
        {!correct && correctText && <p className="mt-2 text-muted">Answer: <span className="font-medium text-ink">{correctText}</span></p>}
      </Card>
      <h2 className="mt-6 font-semibold">Leaderboard</h2>
      <Leaderboard entries={snap.leaderboard.slice(0, 5)} />
      <p className="mt-4 text-center text-sm text-muted">Waiting for the next question…</p>
    </div>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`mx-auto flex min-h-dvh w-full flex-col px-4 py-6 ${wide ? "max-w-xl" : "max-w-sm justify-center"}`}>{children}</main>;
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div className="my-auto text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {body && <p className="mt-2 text-muted">{body}</p>}
    </div>
  );
}
