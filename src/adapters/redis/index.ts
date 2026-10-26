import type { Redis } from "ioredis";
import { LATE_GRACE_MS } from "@/core/scoring";
import type { LeaderboardEntry, Session } from "@/core/types";
import type { AnswerOutcome, JoinOutcome, LiveStore, RecordAnswerInput } from "@/ports";

/**
 * Redis implementation of LiveStore.
 *
 * Why Redis here: sessions are short-lived, write-heavy and need atomic
 * check-and-set (join caps, answer dedupe, "first correct" bonus) plus a
 * ranked leaderboard. Lua scripts give atomicity; sorted sets give the
 * leaderboard for free. All keys expire, so abandoned sessions clean up.
 *
 * Key layout (per session {CODE}):
 *   {prefix}:{CODE}            hash   session fields
 *   {prefix}:{CODE}:players    hash   playerId -> nickname
 *   {prefix}:{CODE}:names      hash   lower(nickname) -> playerId   (uniqueness)
 *   {prefix}:{CODE}:scores     zset   playerId -> score             (leaderboard)
 *   {prefix}:{CODE}:a:{i}      hash   playerId -> optionId          (answer dedupe)
 *   {prefix}:{CODE}:first:{i}  string playerId of fastest correct   (SET NX)
 *   {prefix}:budget            hash   CODE -> player count          (global cap)
 *   {prefix}:budget:exp        zset   CODE -> expiry ms             (self-healing)
 */
const TTL_SEC = 6 * 60 * 60;

// KEYS: session, players, names, scores, budget, budgetExp
// ARGV: playerId, nickname, lowerNickname, globalMax, ttlSec, code
const JOIN = `
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
if redis.call('EXISTS', KEYS[1]) == 0 then return 'no_session' end
if redis.call('HEXISTS', KEYS[2], ARGV[1]) == 1 then return 'rejoined' end
if redis.call('HEXISTS', KEYS[3], ARGV[3]) == 1 then return 'name_taken' end
if redis.call('HLEN', KEYS[2]) >= tonumber(redis.call('HGET', KEYS[1], 'maxPlayers')) then return 'session_full' end
-- Drop budget entries of sessions that expired without being released.
for _, code in ipairs(redis.call('ZRANGEBYSCORE', KEYS[6], '-inf', now)) do
  redis.call('HDEL', KEYS[5], code)
  redis.call('ZREM', KEYS[6], code)
end
local total = 0
for _, n in ipairs(redis.call('HVALS', KEYS[5])) do total = total + tonumber(n) end
if total >= tonumber(ARGV[4]) then return 'server_full' end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
redis.call('HSET', KEYS[3], ARGV[3], ARGV[1])
redis.call('ZADD', KEYS[4], 0, ARGV[1])
redis.call('HINCRBY', KEYS[5], ARGV[6], 1)
redis.call('ZADD', KEYS[6], now + tonumber(ARGV[5]) * 1000, ARGV[6])
for i = 1, 4 do redis.call('EXPIRE', KEYS[i], ARGV[5]) end
return 'joined'
`;

// KEYS: session, players, answers, first
// ARGV: index, playerId, optionId, correct(1/0), limitMs, graceMs, ttlSec
// Time comes from Redis itself, so client clocks can never be gamed.
const ANSWER = `
if redis.call('HGET', KEYS[1], 'status') ~= 'question'
   or redis.call('HGET', KEYS[1], 'currentIndex') ~= ARGV[1]
   or redis.call('HEXISTS', KEYS[2], ARGV[2]) == 0 then return {'closed'} end
if redis.call('HEXISTS', KEYS[3], ARGV[2]) == 1 then return {'duplicate'} end
local t = redis.call('TIME')
local elapsed = (t[1] * 1000 + math.floor(t[2] / 1000)) - tonumber(redis.call('HGET', KEYS[1], 'questionStartedAt'))
if elapsed > tonumber(ARGV[5]) + tonumber(ARGV[6]) then return {'late'} end
redis.call('HSET', KEYS[3], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[3], ARGV[7])
local first = 0
if ARGV[4] == '1' and redis.call('SET', KEYS[4], ARGV[2], 'NX', 'EX', ARGV[7]) then first = 1 end
return {'accepted', elapsed, first}
`;

// KEYS: players, names, scores, budget ; ARGV: playerId, code
const KICK = `
local nick = redis.call('HGET', KEYS[1], ARGV[1])
if not nick then return 0 end
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], string.lower(nick))
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('HINCRBY', KEYS[4], ARGV[2], -1)
return 1
`;

export class RedisLiveStore implements LiveStore {
  constructor(private redis: Redis, private prefix = "sq") {}

  private k(code: string, suffix = "") { return `${this.prefix}:${code}${suffix}`; }
  private get budget() { return `${this.prefix}:budget`; }
  private get budgetExp() { return `${this.prefix}:budget:exp`; }

  async now() {
    const [sec, usec] = await this.redis.time();
    return Number(sec) * 1000 + Math.floor(Number(usec) / 1000);
  }

  async createSession(s: Session) {
    const key = this.k(s.code);
    if (!(await this.redis.hsetnx(key, "code", s.code))) return false;
    await this.redis.multi().hset(key, serialize(s)).expire(key, TTL_SEC).exec();
    return true;
  }

  async getSession(code: string): Promise<Session | null> {
    const h = await this.redis.hgetall(this.k(code));
    return h.code ? deserialize(h) : null;
  }

  async saveSession(s: Session) {
    await this.redis.multi().hset(this.k(s.code), serialize(s)).expire(this.k(s.code), TTL_SEC).exec();
  }

  async join(code: string, playerId: string, nickname: string, globalMax: number): Promise<JoinOutcome> {
    const res = await this.redis.eval(
      JOIN, 6,
      this.k(code), this.k(code, ":players"), this.k(code, ":names"), this.k(code, ":scores"),
      this.budget, this.budgetExp,
      playerId, nickname, nickname.toLowerCase(), globalMax, TTL_SEC, code,
    );
    if (res === "no_session") throw new Error("Unknown session");
    return res as JoinOutcome;
  }

  playerCount(code: string) { return this.redis.hlen(this.k(code, ":players")); }

  async kick(code: string, playerId: string) {
    await this.redis.eval(
      KICK, 4,
      this.k(code, ":players"), this.k(code, ":names"), this.k(code, ":scores"), this.budget,
      playerId, code,
    );
  }

  async recordAnswer(i: RecordAnswerInput): Promise<AnswerOutcome> {
    const [status, elapsed, first] = (await this.redis.eval(
      ANSWER, 4,
      this.k(i.code), this.k(i.code, ":players"), this.k(i.code, `:a:${i.index}`), this.k(i.code, `:first:${i.index}`),
      i.index, i.playerId, i.optionId, i.correct ? "1" : "0", i.timeLimitMs, LATE_GRACE_MS, TTL_SEC,
    )) as [string, number?, number?];
    if (status === "accepted") return { status, elapsedMs: Number(elapsed), firstCorrect: first === 1 };
    return { status: status as "duplicate" | "closed" | "late" };
  }

  async addScore(code: string, playerId: string, points: number) {
    await this.redis.zincrby(this.k(code, ":scores"), points, playerId);
  }

  async leaderboard(code: string, limit = 100): Promise<LeaderboardEntry[]> {
    const rows = await this.redis.zrevrange(this.k(code, ":scores"), 0, limit - 1, "WITHSCORES");
    const ids: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i < rows.length; i += 2) { ids.push(rows[i]!); scores.push(Number(rows[i + 1])); }
    if (ids.length === 0) return [];
    const names = await this.redis.hmget(this.k(code, ":players"), ...ids);
    return ids.map((playerId, i) => ({ playerId, nickname: names[i] ?? "?", score: scores[i]!, rank: i + 1 }));
  }

  async release(code: string) {
    await this.redis.multi()
      .hdel(this.budget, code)
      .zrem(this.budgetExp, code)
      // Keep final data briefly so late reconnects can still read the ending.
      .expire(this.k(code), 3600)
      .expire(this.k(code, ":players"), 3600)
      .expire(this.k(code, ":scores"), 3600)
      .exec();
  }
}

function serialize(s: Session): Record<string, string> {
  return {
    code: s.code, quizId: s.quizId, hostId: s.hostId, status: s.status,
    currentIndex: String(s.currentIndex), questionStartedAt: String(s.questionStartedAt),
    maxPlayers: String(s.maxPlayers), locked: s.locked ? "1" : "0",
  };
}

function deserialize(h: Record<string, string>): Session {
  return {
    code: h.code!, quizId: h.quizId!, hostId: h.hostId!, status: h.status as Session["status"],
    currentIndex: Number(h.currentIndex), questionStartedAt: Number(h.questionStartedAt),
    maxPlayers: Number(h.maxPlayers), locked: h.locked === "1",
  };
}
