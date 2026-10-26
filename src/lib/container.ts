import { Redis } from "ioredis";
import { MongoClient } from "mongodb";
import { AblyRealtimePublisher } from "@/adapters/ably";
import {
  MemoryLiveStore, MemoryQuizRepository, MemoryRealtimePublisher, MemoryResultsRepository,
} from "@/adapters/memory";
import { MongoQuizRepository, MongoResultsRepository } from "@/adapters/mongo";
import { RedisLiveStore } from "@/adapters/redis";
import { GameService } from "@/services/game";
import { QuizService } from "@/services/quizzes";
import { loadEnv, type Env } from "./env";

/**
 * Composition root: the ONLY place that knows which adapter backs which port.
 * Swapping a technology = a new adapter + one line here. See docs/INTEGRATIONS.md.
 */
export interface Container {
  game: GameService;
  quizzes: QuizService;
  results: MemoryResultsRepository | MongoResultsRepository;
  realtime: MemoryRealtimePublisher | AblyRealtimePublisher;
}

export function buildContainer(env: Env): Container {
  const db = env.PERSISTENCE === "mongo"
    ? new MongoClient(env.MONGODB_URI!, { maxPoolSize: 5 }).db()
    : null;
  const quizzes = db ? new MongoQuizRepository(db) : new MemoryQuizRepository();
  const results = db ? new MongoResultsRepository(db) : new MemoryResultsRepository();

  const live = env.LIVE_STORE === "redis"
    ? new RedisLiveStore(new Redis(env.REDIS_URL!, { maxRetriesPerRequest: 2 }))
    : new MemoryLiveStore();

  const realtime = env.REALTIME === "ably"
    ? new AblyRealtimePublisher(env.ABLY_API_KEY!)
    : new MemoryRealtimePublisher();

  const game = new GameService({
    quizzes, results, live, realtime,
    limits: { maxPlayersPerSession: env.MAX_PLAYERS_PER_SESSION, maxPlayersGlobal: env.MAX_PLAYERS_GLOBAL },
  });
  return { game, quizzes: new QuizService(quizzes), results, realtime };
}

// Survive Next.js dev hot-reload without leaking connections or losing memory-mode state.
const g = globalThis as unknown as { __squiz?: Container };
export function container(): Container {
  return (g.__squiz ??= buildContainer(loadEnv()));
}
