/**
 * Scoring rules. Pure functions so they are trivially unit-testable and
 * identical no matter which adapter stores the data.
 *
 * - Wrong or late answers score 0.
 * - A correct answer earns between 50% and 100% of the question's points,
 *   decaying linearly with response time.
 * - The first correct answer of a round also earns a fixed bonus.
 */
export const FASTEST_BONUS = 100;
export const MIN_POINT_FRACTION = 0.5;
/** Network jitter allowance when deciding whether an answer was late. */
export const LATE_GRACE_MS = 300;

export interface ScoreInput {
  correct: boolean;
  elapsedMs: number;
  timeLimitMs: number;
  basePoints: number;
  firstCorrect?: boolean;
}

export function isLate(elapsedMs: number, timeLimitMs: number): boolean {
  return elapsedMs > timeLimitMs + LATE_GRACE_MS;
}

export function computeScore(input: ScoreInput): number {
  const { correct, elapsedMs, timeLimitMs, basePoints, firstCorrect } = input;
  if (!correct || elapsedMs < 0 || isLate(elapsedMs, timeLimitMs)) return 0;
  const used = Math.min(1, Math.max(0, elapsedMs / timeLimitMs));
  const fraction = 1 - (1 - MIN_POINT_FRACTION) * used;
  return Math.round(basePoints * fraction) + (firstCorrect ? FASTEST_BONUS : 0);
}
