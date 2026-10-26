/**
 * Capacity check against real Redis (runs when REDIS_URL is set).
 * 120 players across two sessions answer simultaneously; the global budget must
 * hold exactly, every answer must be scored once, and the leaderboard must stay consistent.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { MemoryQuizRepository, MemoryRealtimePublisher, MemoryResultsRepository } from "@/adapters/memory";
import { RedisLiveStore } from "@/adapters/redis";
import { GameService } from "@/services/game";
import type { Quiz } from "@/core/types";

const url = process.env.REDIS_URL;
const redis = url ? new Redis(url) : null;
afterAll(async () => { await redis?.quit(); });

const quiz: Quiz = {
  id: "q", ownerId: "h", title: "Load", createdAt: 0,
  questions: [{ id: "1", type: "multiple_choice", text: "?", timeLimitSec: 30, points: 1000,
    options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a" }],
};

describe.skipIf(!redis)("capacity under load (Redis)", () => {
  it("enforces the global budget and scores concurrent answers exactly once", async () => {
    const quizzes = new MemoryQuizRepository();
    await quizzes.save(quiz);
    const game = new GameService({
      quizzes, results: new MemoryResultsRepository(), realtime: new MemoryRealtimePublisher(),
      live: new RedisLiveStore(redis!, `load${randomUUID().slice(0, 6)}`),
      limits: { maxPlayersPerSession: 100, maxPlayersGlobal: 120 },
    });

    const s1 = await game.createSession("h", "q", 100);
    const s2 = await game.createSession("h", "q", 100);
    const joins = await Promise.all([
      ...Array.from({ length: 100 }, (_, i) => game.join(s1.code, `a${i}`)),
      ...Array.from({ length: 40 }, (_, i) => game.join(s2.code, `b${i}`)),
    ]);
    const joined = joins.filter((j) => j.outcome === "joined");
    expect(joined).toHaveLength(120); // exactly the budget, never over
    expect(joins.filter((j) => j.outcome === "server_full")).toHaveLength(20);

    await game.hostAction(s1.code, "h", "start");
    const t0 = performance.now();
    const latencies: number[] = [];
    const s1Players = joins.slice(0, 100).filter((j) => j.outcome === "joined");
    await Promise.all(s1Players.map(async (p, i) => {
      const t = performance.now();
      const r = await game.submitAnswer(s1.code, p.playerId, i % 2 === 0 ? "a" : "b");
      latencies.push(performance.now() - t);
      expect(r.status).toBe("accepted");
    }));
    const total = performance.now() - t0;

    const lb = await game.snapshot(s1.code);
    expect(lb.leaderboard).toHaveLength(10);
    // exactly one first-correct bonus was awarded among the 50 correct answers
    const scores = (await (game as unknown as { d: { live: RedisLiveStore } }).d.live.leaderboard(s1.code, 100)).map((e) => e.score);
    expect(scores.filter((x) => x > 1000)).toHaveLength(1);
    expect(scores.filter((x) => x > 0)).toHaveLength(50);

    latencies.sort((a, b) => a - b);
    console.log(`100 concurrent answers: total ${total.toFixed(0)} ms, p95 ${latencies[94]!.toFixed(0)} ms`);
  });
});
