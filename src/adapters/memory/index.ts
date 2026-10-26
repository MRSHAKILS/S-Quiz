import type {
  LeaderboardEntry, Quiz, Session, SessionResult,
} from "@/core/types";
import { isLate } from "@/core/scoring";
import type {
  AnswerOutcome, ClientRole, JoinOutcome, LiveStore, QuizRepository,
  RealtimeEvent, RealtimePublisher, RecordAnswerInput, ResultsRepository,
} from "@/ports";

export class MemoryQuizRepository implements QuizRepository {
  private quizzes = new Map<string, Quiz>();
  async save(quiz: Quiz) { this.quizzes.set(quiz.id, structuredClone(quiz)); }
  async get(id: string) { const q = this.quizzes.get(id); return q ? structuredClone(q) : null; }
  async listByOwner(ownerId: string) {
    return [...this.quizzes.values()].filter((q) => q.ownerId === ownerId).map((q) => structuredClone(q));
  }
}

export class MemoryResultsRepository implements ResultsRepository {
  private results: SessionResult[] = [];
  async save(result: SessionResult) { this.results.push(structuredClone(result)); }
  async listByHost(hostId: string) { return this.results.filter((r) => r.hostId === hostId); }
}

interface SessionState {
  session: Session;
  players: Map<string, string>; // playerId -> nickname
  scores: Map<string, number>;
  answers: Map<number, Set<string>>; // question index -> playerIds who answered
  firstCorrect: Set<number>;
}

/** Zero-dependency LiveStore: powers tests and `LIVE_STORE=memory` demos. */
export class MemoryLiveStore implements LiveStore {
  private sessions = new Map<string, SessionState>();
  private globalPlayers = 0;
  constructor(private clock: () => number = Date.now) {}

  async now() { return this.clock(); }

  async createSession(session: Session) {
    if (this.sessions.has(session.code)) return false;
    this.sessions.set(session.code, {
      session: { ...session }, players: new Map(), scores: new Map(),
      answers: new Map(), firstCorrect: new Set(),
    });
    return true;
  }
  async getSession(code: string) { const s = this.sessions.get(code); return s ? { ...s.session } : null; }
  async saveSession(session: Session) {
    const s = this.sessions.get(session.code);
    if (s) s.session = { ...session };
  }

  async join(code: string, playerId: string, nickname: string, globalMax: number): Promise<JoinOutcome> {
    const s = this.sessions.get(code);
    if (!s) throw new Error("Unknown session");
    if (s.players.has(playerId)) return "rejoined";
    if ([...s.players.values()].some((n) => n.toLowerCase() === nickname.toLowerCase())) return "name_taken";
    if (s.players.size >= s.session.maxPlayers) return "session_full";
    if (this.globalPlayers >= globalMax) return "server_full";
    s.players.set(playerId, nickname);
    s.scores.set(playerId, 0);
    this.globalPlayers++;
    return "joined";
  }
  async playerCount(code: string) { return this.sessions.get(code)?.players.size ?? 0; }
  async kick(code: string, playerId: string) {
    const s = this.sessions.get(code);
    if (s?.players.delete(playerId)) { s.scores.delete(playerId); this.globalPlayers--; }
  }

  async recordAnswer(input: RecordAnswerInput): Promise<AnswerOutcome> {
    const s = this.sessions.get(input.code);
    if (!s || s.session.status !== "question" || s.session.currentIndex !== input.index || !s.players.has(input.playerId)) {
      return { status: "closed" };
    }
    const answered = s.answers.get(input.index) ?? new Set<string>();
    if (answered.has(input.playerId)) return { status: "duplicate" };
    const elapsedMs = this.clock() - s.session.questionStartedAt;
    if (isLate(elapsedMs, input.timeLimitMs)) return { status: "late" };
    answered.add(input.playerId);
    s.answers.set(input.index, answered);
    const firstCorrect = input.correct && !s.firstCorrect.has(input.index);
    if (firstCorrect) s.firstCorrect.add(input.index);
    return { status: "accepted", elapsedMs, firstCorrect };
  }

  async addScore(code: string, playerId: string, points: number) {
    const s = this.sessions.get(code);
    if (s?.scores.has(playerId)) s.scores.set(playerId, (s.scores.get(playerId) ?? 0) + points);
  }

  async leaderboard(code: string, limit = 100): Promise<LeaderboardEntry[]> {
    const s = this.sessions.get(code);
    if (!s) return [];
    return [...s.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([playerId, score], i) => ({ playerId, nickname: s.players.get(playerId) ?? "?", score, rank: i + 1 }));
  }

  async release(code: string) {
    const s = this.sessions.get(code);
    if (!s) return;
    this.globalPlayers -= s.players.size;
    s.players.clear();
  }
}

/** Records events instead of sending them. Used by tests and `REALTIME=none`. */
export class MemoryRealtimePublisher implements RealtimePublisher {
  readonly events: { code: string; event: RealtimeEvent }[] = [];
  async publish(code: string, event: RealtimeEvent) { this.events.push({ code, event }); }
  async issueToken(_code: string, _clientId: string, _role: ClientRole) { return null; }
}
