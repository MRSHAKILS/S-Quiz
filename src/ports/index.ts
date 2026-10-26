/**
 * Ports: the only things the game logic knows about the outside world.
 * Every adapter (memory, Redis, MongoDB, Ably, and any future one) implements
 * one of these. See docs/INTEGRATIONS.md for how to add another.
 */
import type {
  LeaderboardEntry, PublicQuestion, Quiz, Session, SessionResult,
} from "@/core/types";

/** Durable, document-shaped data. Adapter: MongoDB (future: Postgres, DynamoDB). */
export interface QuizRepository {
  save(quiz: Quiz): Promise<void>;
  get(id: string): Promise<Quiz | null>;
  listByOwner(ownerId: string): Promise<Quiz[]>;
}

export interface ResultsRepository {
  save(result: SessionResult): Promise<void>;
  listByHost(hostId: string): Promise<SessionResult[]>;
}

export type JoinOutcome = "joined" | "rejoined" | "session_full" | "server_full" | "name_taken";

export type AnswerOutcome =
  | { status: "accepted"; elapsedMs: number; firstCorrect: boolean }
  | { status: "duplicate" | "closed" | "late" };

export interface RecordAnswerInput {
  code: string;
  index: number;
  playerId: string;
  optionId: string;
  correct: boolean;
  timeLimitMs: number;
}

/**
 * Ephemeral, high-churn state for running sessions. Every method that must be
 * race-free (join cap, answer dedupe, fastest bonus) is atomic in the adapter.
 * Adapter: Redis (future: Cloudflare Durable Objects, Memcached+DB).
 */
export interface LiveStore {
  /** Authoritative clock. Redis TIME in prod, so client clocks never matter. */
  now(): Promise<number>;
  createSession(session: Session): Promise<boolean>;
  getSession(code: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  join(code: string, playerId: string, nickname: string, globalMax: number): Promise<JoinOutcome>;
  playerCount(code: string): Promise<number>;
  kick(code: string, playerId: string): Promise<void>;
  recordAnswer(input: RecordAnswerInput): Promise<AnswerOutcome>;
  addScore(code: string, playerId: string, points: number): Promise<void>;
  leaderboard(code: string, limit?: number): Promise<LeaderboardEntry[]>;
  /** Frees the global capacity budget and schedules cleanup. */
  release(code: string): Promise<void>;
}

export type RealtimeEvent =
  | { type: "lobby"; playerCount: number }
  | { type: "question"; question: PublicQuestion; startedAt: number }
  | { type: "reveal"; correctOptionId: string; leaderboard: LeaderboardEntry[] }
  | { type: "ended"; ranking: LeaderboardEntry[] };

export type ClientRole = "host" | "player";

/** Push channel to browsers. Adapter: Ably (future: Pusher, Supabase Realtime, Socket.IO). */
export interface RealtimePublisher {
  publish(code: string, event: RealtimeEvent): Promise<void>;
  /** Short-lived, subscribe-only credential scoped to one session channel. */
  issueToken(code: string, clientId: string, role: ClientRole): Promise<unknown>;
}
