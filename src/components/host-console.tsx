"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/client";
import { useRemaining, useSession } from "@/lib/use-session";
import { CountdownBar } from "./countdown-bar";
import { Leaderboard, Podium } from "./podium";
import { Button, Card, LinkButton } from "./ui";

const LETTERS = ["A", "B", "C", "D"];
const AUTO_REVEAL_DELAY_MS = 800; // let in-flight answers land before closing the round

export function HostConsole({ code }: { code: string }) {
  const { snap, error, clockOffset, refresh } = useSession(code);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const q = snap?.question ?? null;
  const remaining = useRemaining(snap?.status === "question" ? snap.startedAt : null, q?.timeLimitSec ?? null, clockOffset);

  async function act(path: string, body: unknown) {
    setBusy(true); setActionError(null);
    try { await request(`/api/sessions/${code}/${path}`, { body }); await refresh(); }
    catch (e) { setActionError((e as Error).message); }
    finally { setBusy(false); }
  }
  const action = (a: "start" | "reveal" | "next" | "end") => act("action", { action: a });

  // Close the round when time is up, or as soon as everyone has answered.
  const revealedFor = useRef<number | null>(null);
  const everyoneAnswered = !!snap?.host && snap.playerCount > 0 && snap.host.answeredCount >= snap.playerCount;
  const timeUp = remaining !== null && remaining <= 0;
  useEffect(() => {
    if (snap?.status !== "question" || !q || revealedFor.current === q.index) return;
    if (!timeUp && !everyoneAnswered) return;
    const id = setTimeout(() => { revealedFor.current = q.index; void action("reveal"); }, timeUp ? AUTO_REVEAL_DELAY_MS : 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.status, q?.index, timeUp, everyoneAnswered]);

  if (error?.status === 404) return <Notice title="Session not found" body="It may have ended or the code is wrong." />;
  if (!snap) return <Notice title="Loading…" />;
  if (!snap.host) return <Notice title="You're not the host of this session" body="Sign in with the account that created it." />;

  const { host } = snap;
  const isLast = q ? q.index + 1 >= q.total : false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">Hosting</p>
          <h1 className="truncate text-xl font-bold tracking-tight">{snap.quizTitle}</h1>
        </div>
        {snap.status !== "ended" && (
          <Button variant="danger" disabled={busy} onClick={() => { if (confirm("End this quiz for everyone?")) void action("end"); }}>End quiz</Button>
        )}
      </div>

      {actionError && <p role="alert" className="mb-4 text-sm text-wrong">{actionError}</p>}

      {snap.status === "lobby" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <p className="text-sm font-medium text-muted">Join at {typeof window !== "undefined" ? window.location.host : ""} with code</p>
            <p className="tnum mt-1 font-mono text-5xl font-bold tracking-[0.2em] sm:text-6xl" aria-label={`Join code ${code.split("").join(" ")}`}>{code}</p>
            <JoinQr code={code} />
          </Card>

          <Card className="flex flex-col p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Players</h2>
              <p className="tnum text-sm text-muted" aria-live="polite">{snap.playerCount} / {host.maxPlayers}</p>
            </div>
            {host.players.length === 0 ? (
              <p className="mt-4 text-muted">Waiting for players to join…</p>
            ) : (
              <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {host.players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-(--radius-control) border border-line px-3 py-2">
                    <span className="truncate font-medium">{p.nickname}</span>
                    <Button variant="ghost" aria-label={`Remove ${p.nickname}`} disabled={busy} onClick={() => act("kick", { playerId: p.id })}>Remove</Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-center gap-2 pt-6">
              <Button variant="secondary" disabled={busy} onClick={() => act("lock", { locked: !host.locked })}>
                {host.locked ? "Unlock lobby" : "Lock lobby"}
              </Button>
              <Button size="lg" className="flex-1" disabled={busy || snap.playerCount === 0} onClick={() => action("start")}>Start quiz</Button>
            </div>
          </Card>
        </div>
      )}

      {(snap.status === "question" || snap.status === "reveal") && q && (
        <div>
          <div className="mb-3 flex items-baseline justify-between text-sm text-muted">
            <span className="tnum">Question {q.index + 1} of {q.total}</span>
            <span className="tnum" aria-live="polite">{host.answeredCount} / {snap.playerCount} answered</span>
          </div>
          {snap.status === "question" && remaining !== null && <CountdownBar remaining={remaining} total={q.timeLimitSec} />}
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{q.text}</h2>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((o, i) => {
              const state = snap.status === "reveal" ? (o.id === snap.correctOptionId ? "correct" : "dim") : "idle";
              return (
                <li key={o.id} className={`flex items-center gap-3 rounded-(--radius-card) border-2 bg-surface p-4 text-xl ${
                  state === "correct" ? "border-correct" : state === "dim" ? "border-line opacity-50" : "border-line"}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line font-semibold">{LETTERS[i]}</span>
                  <span className="min-w-0 flex-1">{o.text}</span>
                  {state === "correct" && <span className="text-sm font-semibold text-correct">Correct</span>}
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1 md:max-w-sm">
              {snap.status === "reveal" && (<><h3 className="font-semibold">Top players</h3><Leaderboard entries={snap.leaderboard.slice(0, 5)} large /></>)}
            </div>
            {snap.status === "question"
              ? <Button size="lg" disabled={busy} onClick={() => action("reveal")}>Reveal answer</Button>
              : <Button size="lg" disabled={busy} onClick={() => action("next")}>{isLast ? "Show final results" : "Next question"}</Button>}
          </div>
        </div>
      )}

      {snap.status === "ended" && (
        <div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight">Final results</h2>
          <Podium ranking={snap.leaderboard} />
          <div className="mt-8 flex gap-3">
            <LinkButton href={`/results/${code}`} variant="secondary">Shareable results page</LinkButton>
            <LinkButton href="/dashboard">Back to dashboard</LinkButton>
          </div>
        </div>
      )}
    </div>
  );
}

function JoinQr({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/j/${code}`;

  useEffect(() => {
    // Always dark-on-light: QR scanners need that contrast regardless of theme.
    QRCode.toDataURL(`${window.location.origin}/j/${code}`, { margin: 2, width: 480, errorCorrectionLevel: "M" }).then(setDataUrl);
  }, [code]);

  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {dataUrl ? <img src={dataUrl} alt={`QR code to join session ${code}`} className="size-56 rounded-(--radius-control) border border-line sm:size-64" />
        : <div className="size-56 animate-pulse rounded-(--radius-control) bg-line sm:size-64" aria-hidden />}
      <div className="flex w-full items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-(--radius-control) border border-line px-3 py-2 text-sm">{url}</code>
        <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body?: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {body && <p className="text-muted">{body}</p>}
      <Link href="/dashboard" className="mt-2 text-sm font-medium text-accent">Back to dashboard</Link>
    </main>
  );
}
