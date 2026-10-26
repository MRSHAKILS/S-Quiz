import { describe, expect, it } from "vitest";
import { computeScore, FASTEST_BONUS, LATE_GRACE_MS } from "@/core/scoring";

const base = { timeLimitMs: 10_000, basePoints: 1000 };

describe("computeScore", () => {
  it("gives full points for an instant correct answer", () => {
    expect(computeScore({ ...base, correct: true, elapsedMs: 0 })).toBe(1000);
  });
  it("decays linearly to 50% at the deadline", () => {
    expect(computeScore({ ...base, correct: true, elapsedMs: 5000 })).toBe(750);
    expect(computeScore({ ...base, correct: true, elapsedMs: 10_000 })).toBe(500);
  });
  it("scores wrong answers as zero", () => {
    expect(computeScore({ ...base, correct: false, elapsedMs: 1 })).toBe(0);
  });
  it("tolerates network jitter but rejects clearly late answers", () => {
    expect(computeScore({ ...base, correct: true, elapsedMs: 10_000 + LATE_GRACE_MS })).toBe(500);
    expect(computeScore({ ...base, correct: true, elapsedMs: 10_000 + LATE_GRACE_MS + 1 })).toBe(0);
  });
  it("adds the bonus only for the first correct answer", () => {
    const withBonus = computeScore({ ...base, correct: true, elapsedMs: 0, firstCorrect: true });
    expect(withBonus).toBe(1000 + FASTEST_BONUS);
  });
  it("never awards a bonus for a wrong answer", () => {
    expect(computeScore({ ...base, correct: false, elapsedMs: 0, firstCorrect: true })).toBe(0);
  });
});
