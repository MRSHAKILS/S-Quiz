import type { PublicQuestion, Question } from "./types";

/** The ONLY way a question should reach a player: correct answer removed. */
export function toPublicQuestion(q: Question, index: number, total: number): PublicQuestion {
  return {
    index,
    total,
    text: q.text,
    options: q.options,
    timeLimitSec: q.timeLimitSec,
    points: q.points,
  };
}
