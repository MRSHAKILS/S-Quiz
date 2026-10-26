import { randomUUID } from "node:crypto";
import type { Question, Quiz } from "@/core/types";
import type { QuizRepository } from "@/ports";
import type { QuizInput } from "@/lib/schemas";
import { GameError } from "./game";

/** Quiz authoring use-cases. Ownership is enforced here, not in routes. */
export class QuizService {
  constructor(private quizzes: QuizRepository) {}

  list(ownerId: string) { return this.quizzes.listByOwner(ownerId); }

  async get(id: string, ownerId: string): Promise<Quiz> {
    const quiz = await this.quizzes.get(id);
    if (!quiz) throw new GameError("not_found", "Quiz not found");
    if (quiz.ownerId !== ownerId) throw new GameError("forbidden", "Not your quiz");
    return quiz;
  }

  async create(ownerId: string, input: QuizInput): Promise<Quiz> {
    const quiz: Quiz = { id: randomUUID(), ownerId, createdAt: Date.now(), ...normalize(input) };
    await this.quizzes.save(quiz);
    return quiz;
  }

  async update(id: string, ownerId: string, input: QuizInput): Promise<Quiz> {
    const existing = await this.get(id, ownerId);
    const quiz: Quiz = { ...existing, ...normalize(input) };
    await this.quizzes.save(quiz);
    return quiz;
  }

  async remove(id: string, ownerId: string) {
    if (!(await this.quizzes.delete(id, ownerId))) throw new GameError("not_found", "Quiz not found");
  }
}

/** Assigns stable ids server-side so clients cannot choose or collide them. */
function normalize(input: QuizInput): Pick<Quiz, "title" | "questions"> {
  const questions: Question[] = input.questions.map((q) => {
    const options = q.options.map((o) => ({ id: randomUUID().slice(0, 8), text: o.text }));
    return {
      id: randomUUID().slice(0, 8),
      type: "multiple_choice",
      text: q.text,
      options,
      correctOptionId: options[q.correctIndex]!.id,
      timeLimitSec: q.timeLimitSec,
      points: q.points,
    };
  });
  return { title: input.title, questions };
}
