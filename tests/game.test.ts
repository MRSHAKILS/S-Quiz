import { beforeEach, describe, expect, it } from "vitest";
import {
  MemoryLiveStore, MemoryQuizRepository, MemoryRealtimePublisher, MemoryResultsRepository,
} from "@/adapters/memory";
import { GameService } from "@/services/game";
import type { Quiz } from "@/core/types";

const quiz: Quiz = {
  id: "quiz1", ownerId: "host1", title: "Capitals", createdAt: 0,
  questions: [
    { id: "q1", type: "multiple_choice", text: "Capital of France?", timeLimitSec: 10, points: 1000,
      options: [{ id: "a", text: "Paris" }, { id: "b", text: "Rome" }], correctOptionId: "a" },
    { id: "q2", type: "multiple_choice", text: "Capital of Italy?", timeLimitSec: 10, points: 1000,
      options: [{ id: "a", text: "Paris" }, { id: "b", text: "Rome" }], correctOptionId: "b" },
  ],
};

let now = 1_000_000;
let game: GameService;
let realtime: MemoryRealtimePublisher;
let results: MemoryResultsRepository;

beforeEach(async () => {
  now = 1_000_000;
  const quizzes = new MemoryQuizRepository();
  await quizzes.save(quiz);
  realtime = new MemoryRealtimePublisher();
  results = new MemoryResultsRepository();
  game = new GameService({
    quizzes, results, realtime, live: new MemoryLiveStore(() => now),
    limits: { maxPlayersPerSession: 3, maxPlayersGlobal: 4 },
  });
});

describe("full game", () => {
  it("ranks the faster correct player first and persists results", async () => {
    const s = await game.createSession("host1", "quiz1");
    const fast = (await game.join(s.code, "Fast")).playerId;
    const slow = (await game.join(s.code, "Slow")).playerId;
    const wrong = (await game.join(s.code, "Wrong")).playerId;

    await game.hostAction(s.code, "host1", "start");
    now += 1000; await game.submitAnswer(s.code, fast, "a");
    now += 4000; await game.submitAnswer(s.code, slow, "a");
    await game.submitAnswer(s.code, wrong, "b");
    await game.hostAction(s.code, "host1", "reveal");
    await game.hostAction(s.code, "host1", "next");
    now += 500; await game.submitAnswer(s.code, slow, "b");
    await game.hostAction(s.code, "host1", "reveal");
    await game.hostAction(s.code, "host1", "next"); // last question -> ended

    const saved = (await results.listByHost("host1"))[0]!;
    expect(saved.ranking.map((r) => r.nickname)).toEqual(["Slow", "Fast", "Wrong"]);
    expect(saved.ranking[0]!.score).toBeGreaterThan(saved.ranking[1]!.score);
    expect(realtime.events.at(-1)?.event.type).toBe("ended");
  });

  it("never leaks the correct answer in the question broadcast", async () => {
    const s = await game.createSession("host1", "quiz1");
    await game.hostAction(s.code, "host1", "start");
    const ev = realtime.events.find((e) => e.event.type === "question")!.event;
    expect(JSON.stringify(ev)).not.toContain("correctOptionId");
  });
});

describe("rules", () => {
  it("accepts only the first answer per player", async () => {
    const s = await game.createSession("host1", "quiz1");
    const p = (await game.join(s.code, "A")).playerId;
    await game.hostAction(s.code, "host1", "start");
    expect((await game.submitAnswer(s.code, p, "a")).status).toBe("accepted");
    expect((await game.submitAnswer(s.code, p, "b")).status).toBe("duplicate");
  });

  it("rejects answers after the deadline", async () => {
    const s = await game.createSession("host1", "quiz1");
    const p = (await game.join(s.code, "A")).playerId;
    await game.hostAction(s.code, "host1", "start");
    now += 11_000;
    expect((await game.submitAnswer(s.code, p, "a")).status).toBe("late");
  });

  it("enforces the per-session cap, global cap and unique nicknames", async () => {
    const s = await game.createSession("host1", "quiz1", 99); // clamped to 3
    expect(s.maxPlayers).toBe(3);
    await game.join(s.code, "A"); await game.join(s.code, "B"); await game.join(s.code, "C");
    expect((await game.join(s.code, "D")).outcome).toBe("session_full");
    expect((await game.join(s.code, "a")).outcome).toBe("name_taken");
    const s2 = await game.createSession("host1", "quiz1");
    await game.join(s2.code, "E");
    expect((await game.join(s2.code, "F")).outcome).toBe("server_full"); // 4 global
  });

  it("lets a returning player keep their identity", async () => {
    const s = await game.createSession("host1", "quiz1");
    const { playerId } = await game.join(s.code, "A");
    expect((await game.join(s.code, "A", playerId)).outcome).toBe("rejoined");
  });

  it("blocks non-hosts and honours lobby lock", async () => {
    const s = await game.createSession("host1", "quiz1");
    await expect(game.hostAction(s.code, "intruder", "start")).rejects.toThrow(/host/);
    await game.setLocked(s.code, "host1", true);
    await expect(game.join(s.code, "A")).rejects.toThrow(/locked/);
  });

  it("frees global capacity when a session ends", async () => {
    const s = await game.createSession("host1", "quiz1");
    await game.join(s.code, "A"); await game.join(s.code, "B"); await game.join(s.code, "C");
    await game.hostAction(s.code, "host1", "end");
    const s2 = await game.createSession("host1", "quiz1");
    expect((await game.join(s2.code, "X")).outcome).toBe("joined");
  });
});

describe("snapshot", () => {
  it("hides the correct answer until reveal and exposes host data only to the host", async () => {
    const s = await game.createSession("host1", "quiz1");
    const { playerId } = await game.join(s.code, "Ann");
    await game.hostAction(s.code, "host1", "start");

    const during = await game.snapshot(s.code, { playerId });
    expect(during.correctOptionId).toBeNull();
    expect(JSON.stringify(during)).not.toContain("correctOptionId\":\"a");
    expect(during.me).toMatchObject({ nickname: "Ann", choice: null });
    expect(during.host).toBeUndefined();

    await game.submitAnswer(s.code, playerId, "a");
    const hostView = await game.snapshot(s.code, { hostId: "host1" });
    expect(hostView.host).toMatchObject({ answeredCount: 1, players: [{ nickname: "Ann" }] });
    expect((await game.snapshot(s.code, { hostId: "someone-else" })).host).toBeUndefined();

    await game.hostAction(s.code, "host1", "reveal");
    expect((await game.snapshot(s.code, { playerId })).correctOptionId).toBe("a");
  });
});
