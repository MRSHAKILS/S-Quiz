"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TokenRequest } from "ably";
import type { GameSnapshot } from "@/services/game";
import { ApiError, request } from "./client";

const POLL_MS_NO_PUSH = 2500;
const POLL_MS_WITH_PUSH = 15_000; // safety net only; push drives updates

export interface SessionView {
  snap: GameSnapshot | null;
  error: ApiError | null;
  /** Add to Date.now() to approximate the server clock. */
  clockOffset: number;
  push: boolean;
  refresh: () => Promise<void>;
}

type PushEvent =
  | { type: "lobby"; playerCount: number }
  | { type: "question"; question: NonNullable<GameSnapshot["question"]>; startedAt: number }
  | { type: "reveal" | "ended" };

/**
 * Single source of live session state for host and player screens.
 *
 * The server snapshot is the truth. Push events (Ably) either patch the
 * snapshot directly when the event carries everything needed (lobby count,
 * new question), or trigger a refetch. Polling is the fallback when push is
 * unavailable and a slow safety net when it is: this is what makes
 * reconnects and a provider outage harmless.
 */
export function useSession(code: string): SessionView {
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [push, setPush] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    inFlight.current ??= (async () => {
      const sent = Date.now();
      try {
        const next = await request<GameSnapshot>(`/api/sessions/${code}`);
        // Assume symmetric latency: the server stamped `serverNow` mid-flight.
        setClockOffset(next.serverNow - (sent + Date.now()) / 2);
        setSnap(next);
        setError(null);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [code]);

  useEffect(() => {
    let stopped = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { token } = await request<{ token: unknown }>(`/api/sessions/${code}/token`);
        if (!token || stopped) return;
        const Ably = await import("ably");
        const client = new Ably.Realtime({
          authCallback: (_params, cb) => {
            request<{ token: TokenRequest }>(`/api/sessions/${code}/token`)
              .then((r) => cb(null, r.token))
              .catch((e) => cb(e, null));
          },
        });
        const channel = client.channels.get(`session:${code}`);
        await channel.subscribe((msg) => {
          const ev = msg.data as PushEvent;
          if (ev.type === "lobby") setSnap((s) => (s ? { ...s, playerCount: ev.playerCount } : s));
          else if (ev.type === "question") {
            setSnap((s) => s && {
              ...s, status: "question", question: ev.question, startedAt: ev.startedAt,
              correctOptionId: null, me: s.me && { ...s.me, choice: null },
              host: s.host && { ...s.host, answeredCount: 0 },
            });
          } else void refresh();
        });
        client.connection.on("connected", () => { setPush(true); void refresh(); });
        client.connection.on(["disconnected", "suspended", "failed", "closed"], () => setPush(false));
        cleanup = () => client.close();
        if (stopped) cleanup();
      } catch {
        /* push is optional: polling keeps working */
      }
    })();

    return () => { stopped = true; cleanup?.(); };
  }, [code, refresh]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, push ? POLL_MS_WITH_PUSH : POLL_MS_NO_PUSH);
    return () => clearInterval(id);
  }, [refresh, push]);

  return { snap, error, clockOffset, push, refresh };
}

/** Seconds remaining for the current question, ticking every 100 ms. */
export function useRemaining(startedAt: number | null, limitSec: number | null, clockOffset: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startedAt]);
  if (startedAt === null || limitSec === null) return null;
  return Math.max(0, limitSec - (now + clockOffset - startedAt) / 1000);
}
