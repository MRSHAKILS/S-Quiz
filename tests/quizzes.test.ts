import { describe, expect, it } from "vitest";
import { MemoryQuizRepository } from "@/adapters/memory";
import { quizInputSchema } from "@/lib/schemas";
import { QuizService } from "@/services/quizzes";

const input = quizInputSchema.parse({
  title: "  Geography ",
  questions: [{ text: "Capital of France?", options: [{ text: "Paris" }, { text: "Rome" }], correctIndex: 0, timeLimitSec: 20, points: 1000 }],
});

describe("quizInputSchema", () => {
  it("trims text and rejects an out-of-range correct option", () => {
    expect(input.title).toBe("Geography");
    const bad = { ...input, questions: [{ ...input.questions[0]!, correctIndex: 5 }] };
    expect(quizInputSchema.safeParse(bad).success).toBe(false);
  });
  it("requires at least one question and 2-4 options", () => {
    expect(quizInputSchema.safeParse({ title: "x", questions: [] }).success).toBe(false);
    const one = { ...input.questions[0]!, options: [{ text: "only" }] };
    expect(quizInputSchema.safeParse({ title: "x", questions: [one] }).success).toBe(false);
  });
});

describe("QuizService", () => {
  const make = () => new QuizService(new MemoryQuizRepository());

  it("generates ids server-side and maps correctIndex to an option id", async () => {
    const quiz = await make().create("u1", input);
    const q = quiz.questions[0]!;
    expect(q.correctOptionId).toBe(q.options[0]!.id);
    expect(new Set(q.options.map((o) => o.id)).size).toBe(2);
  });

  it("only lets the owner read, change or delete a quiz", async () => {
    const svc = make();
    const quiz = await svc.create("u1", input);
    await expect(svc.get(quiz.id, "u2")).rejects.toThrow(/Not your quiz/);
    await expect(svc.update(quiz.id, "u2", input)).rejects.toThrow(/Not your quiz/);
    await expect(svc.remove(quiz.id, "u2")).rejects.toThrow();
    await svc.remove(quiz.id, "u1");
    expect(await svc.list("u1")).toHaveLength(0);
  });

  it("keeps id and ownership on update", async () => {
    const svc = make();
    const quiz = await svc.create("u1", input);
    const updated = await svc.update(quiz.id, "u1", { ...input, title: "Renamed" });
    expect(updated).toMatchObject({ id: quiz.id, ownerId: "u1", title: "Renamed", createdAt: quiz.createdAt });
  });
});
