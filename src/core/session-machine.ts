import type { Session } from "./types";

export type HostAction = "start" | "reveal" | "next" | "end";

export class InvalidTransitionError extends Error {
  constructor(from: string, action: string) {
    super(`Cannot "${action}" while session is "${from}"`);
  }
}

/**
 * lobby --start--> question --reveal--> reveal --next--> question ... --end--> ended
 * `next` after the last question ends the session. `end` is allowed any time.
 */
export function transition(
  session: Session,
  action: HostAction,
  totalQuestions: number,
  now: number,
): Session {
  if (session.status === "ended") throw new InvalidTransitionError("ended", action);

  if (action === "end") return { ...session, status: "ended" };

  if (action === "start" && session.status === "lobby") {
    if (totalQuestions === 0) throw new Error("Quiz has no questions");
    return { ...session, status: "question", currentIndex: 0, questionStartedAt: now, locked: true };
  }
  if (action === "reveal" && session.status === "question") {
    return { ...session, status: "reveal" };
  }
  if (action === "next" && session.status === "reveal") {
    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= totalQuestions) return { ...session, status: "ended" };
    return { ...session, status: "question", currentIndex: nextIndex, questionStartedAt: now };
  }
  throw new InvalidTransitionError(session.status, action);
}
