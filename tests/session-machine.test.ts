import { describe, expect, it } from "vitest";
import { transition } from "@/core/session-machine";
import type { Session } from "@/core/types";

const lobby: Session = {
  code: "ABC123", quizId: "q", hostId: "h", status: "lobby",
  currentIndex: -1, questionStartedAt: 0, maxPlayers: 50, locked: false,
};

describe("session state machine", () => {
  it("walks lobby -> question -> reveal -> ended for a one-question quiz", () => {
    const q = transition(lobby, "start", 1, 1000);
    expect(q).toMatchObject({ status: "question", currentIndex: 0, questionStartedAt: 1000, locked: true });
    const r = transition(q, "reveal", 1, 2000);
    expect(r.status).toBe("reveal");
    expect(transition(r, "next", 1, 3000).status).toBe("ended");
  });
  it("advances to the next question and resets the clock", () => {
    const r = transition(transition(lobby, "start", 2, 1000), "reveal", 2, 2000);
    expect(transition(r, "next", 2, 3000)).toMatchObject({ status: "question", currentIndex: 1, questionStartedAt: 3000 });
  });
  it("rejects illegal transitions", () => {
    expect(() => transition(lobby, "reveal", 1, 0)).toThrow();
    expect(() => transition({ ...lobby, status: "ended" }, "start", 1, 0)).toThrow();
  });
  it("refuses to start an empty quiz", () => {
    expect(() => transition(lobby, "start", 0, 0)).toThrow(/no questions/);
  });
  it("lets the host end early from any live state", () => {
    expect(transition(lobby, "end", 1, 0).status).toBe("ended");
  });
});
