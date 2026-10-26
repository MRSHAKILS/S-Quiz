/**
 * One behavioural contract, run against every LiveStore implementation.
 * Memory always runs; Redis runs when REDIS_URL is set (CI uses a service container).
 * A new adapter (e.g. Durable Objects) only has to pass this file to be trusted.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { MemoryLiveStore } from "@/adapters/memory";
import { RedisLiveStore } from "@/adapters/redis";
import type { Session } from "@/core/types";
import type { LiveStore } from "@/ports";

const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;
afterAll(async () => { await redis?.quit(); });

const impls: [string, () => LiveStore, boolean][] = [
  ["memory", () => new MemoryLiveStore(), true],
  ["redis", () => new RedisLiveStore(redis!, `t${randomUUID().slice(0, 8)}`), Boolean(redis)],
];

const base = (code: string, over: Partial<Session> = {}): Session => ({
  code, quizId: "q", hostId: "h", status: "lobby", currentIndex: -1,
  questionStartedAt: 0, maxPlayers: 3, locked: false, ...over,
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const [name, make, enabled] of impls) {
  describe.skipIf(!enabled)(`LiveStore contract: ${name}`, () => {
    it("creates a session once and round-trips its fields", async () => {
      const s = make();
      expect(await s.createSession(base("AAAAAA"))).toBe(true);
      expect(await s.createSession(base("AAAAAA"))).toBe(false);
      expect(await s.getSession("AAAAAA")).toEqual(base("AAAAAA"));
      expect(await s.getSession("NOPE")).toBeNull();
    });

    it("enforces caps, unique names and idempotent rejoin", async () => {
      const s = make();
      await s.createSession(base("BBBBBB"));
      expect(await s.join("BBBBBB", "p1", "Ann", 4)).toBe("joined");
      expect(await s.join("BBBBBB", "p1", "Ann", 4)).toBe("rejoined");
      expect(await s.join("BBBBBB", "p2", "ann", 4)).toBe("name_taken");
      expect(await s.join("BBBBBB", "p2", "Bob", 4)).toBe("joined");
      expect(await s.join("BBBBBB", "p3", "Cy", 4)).toBe("joined");
      expect(await s.join("BBBBBB", "p4", "Di", 4)).toBe("session_full");
      expect(await s.playerCount("BBBBBB")).toBe(3);
    });

    it("applies a global budget across sessions and frees it on release", async () => {
      const s = make();
      await s.createSession(base("CCCCCC"));
      await s.createSession(base("DDDDDD"));
      await s.join("CCCCCC", "a", "A", 2);
      await s.join("CCCCCC", "b", "B", 2);
      expect(await s.join("DDDDDD", "c", "C", 2)).toBe("server_full");
      await s.release("CCCCCC");
      expect(await s.join("DDDDDD", "c", "C", 2)).toBe("joined");
    });

    it("kicking frees the nickname and a slot", async () => {
      const s = make();
      await s.createSession(base("EEEEEE", { maxPlayers: 1 }));
      await s.join("EEEEEE", "a", "A", 10);
      await s.kick("EEEEEE", "a");
      expect(await s.join("EEEEEE", "b", "A", 10)).toBe("joined");
    });

    it("accepts one answer per player and exactly one first-correct under concurrency", async () => {
      const s = make();
      const start = await s.now();
      await s.createSession(base("FFFFFF", { maxPlayers: 30 }));
      const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
      for (const id of ids) await s.join("FFFFFF", id, id, 100);
      await s.saveSession(base("FFFFFF", { maxPlayers: 30, status: "question", currentIndex: 0, questionStartedAt: start }));

      const answer = (playerId: string) =>
        s.recordAnswer({ code: "FFFFFF", index: 0, playerId, optionId: "a", correct: true, timeLimitMs: 10_000 });
      const results = await Promise.all(ids.map(answer));
      expect(results.every((r) => r.status === "accepted")).toBe(true);
      expect(results.filter((r) => r.status === "accepted" && r.firstCorrect)).toHaveLength(1);
      expect((await answer("p0")).status).toBe("duplicate");
    });

    it("rejects answers for the wrong question, strangers and late arrivals", async () => {
      const s = make();
      await s.createSession(base("GGGGGG"));
      await s.join("GGGGGG", "p", "P", 10);
      const input = { code: "GGGGGG", index: 0, playerId: "p", optionId: "a", correct: true, timeLimitMs: 50 };
      expect((await s.recordAnswer(input)).status).toBe("closed"); // still in lobby
      await s.saveSession(base("GGGGGG", { status: "question", currentIndex: 0, questionStartedAt: await s.now() }));
      expect((await s.recordAnswer({ ...input, playerId: "ghost" })).status).toBe("closed");
      expect((await s.recordAnswer({ ...input, index: 1 })).status).toBe("closed");
      await sleep(450); // 50ms limit + 300ms grace
      expect((await s.recordAnswer(input)).status).toBe("late");
    });

    it("ranks by score, highest first", async () => {
      const s = make();
      await s.createSession(base("HHHHHH"));
      for (const [id, n] of [["a", "Ann"], ["b", "Bob"], ["c", "Cy"]] as const) await s.join("HHHHHH", id, n, 10);
      await s.addScore("HHHHHH", "b", 300);
      await s.addScore("HHHHHH", "c", 500);
      await s.addScore("HHHHHH", "a", 100);
      const lb = await s.leaderboard("HHHHHH");
      expect(lb.map((e) => [e.nickname, e.score, e.rank])).toEqual([["Cy", 500, 1], ["Bob", 300, 2], ["Ann", 100, 3]]);
      expect(await s.leaderboard("HHHHHH", 1)).toHaveLength(1);
    });

    it("reports player state, roster and answer counts", async () => {
      const s = make();
      const start = await s.now();
      await s.createSession(base("JJJJJJ"));
      await s.join("JJJJJJ", "a", "Ann", 10);
      await s.join("JJJJJJ", "b", "Bob", 10);
      await s.saveSession(base("JJJJJJ", { status: "question", currentIndex: 0, questionStartedAt: start }));
      await s.recordAnswer({ code: "JJJJJJ", index: 0, playerId: "a", optionId: "opt1", correct: true, timeLimitMs: 10_000 });
      await s.addScore("JJJJJJ", "a", 900);
      await s.addScore("JJJJJJ", "b", 400);
      expect(await s.answerCount("JJJJJJ", 0)).toBe(1);
      expect(await s.playerState("JJJJJJ", "a", 0)).toEqual({ nickname: "Ann", score: 900, rank: 1, choice: "opt1" });
      expect(await s.playerState("JJJJJJ", "b", 0)).toEqual({ nickname: "Bob", score: 400, rank: 2, choice: null });
      expect(await s.playerState("JJJJJJ", "ghost", 0)).toBeNull();
      expect((await s.players("JJJJJJ")).map((p) => p.nickname).sort()).toEqual(["Ann", "Bob"]);
    });
  });
}
