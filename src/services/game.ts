import { randomBytes, randomUUID } from "node:crypto";
import { computeScore } from "@/core/scoring";
import { transition, type HostAction } from "@/core/session-machine";
import { toPublicQuestion } from "@/core/public-view";
import type { LeaderboardEntry, PublicQuestion, Question, Quiz, Session } from "@/core/types";
import type {
  JoinOutcome, LiveStore, PlayerState, QuizRepository, RealtimePublisher, ResultsRepository,
} from "@/ports";

export interface GameDeps {
  quizzes: QuizRepository;
  results: ResultsRepository;
  live: LiveStore;
  realtime: RealtimePublisher;
  limits: { maxPlayersPerSession: number; maxPlayersGlobal: number };
}

export class GameError extends Error {
  constructor(public code: "not_found" | "forbidden" | "locked" | "bad_request", message: string) {
    super(message);
  }
}

// No 0/O/1/I so codes survive being read aloud or typed on a phone.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () =>
  Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

export interface GameSnapshot {
  code: string;
  status: Session["status"];
  quizTitle: string;
  playerCount: number;
  question: PublicQuestion | null;
  startedAt: number | null;
  /** Store clock at response time; clients use it to align their countdown. */
  serverNow: number;
  leaderboard: LeaderboardEntry[];
  /** Only populated once the round is revealed (or the quiz ended). */
  correctOptionId: string | null;
  /** Present for the requesting player. */
  me: PlayerState | null;
  /** Host-only extras. */
  host?: { players: { id: string; nickname: string }[]; answeredCount: number; locked: boolean; maxPlayers: number };
}

export class GameService {
  constructor(private d: GameDeps) {}

  /** Cheap round-trip through both stores, used by the deep health check. */
  async ping() {
    await Promise.all([this.d.live.now(), this.d.quizzes.get("__ping__")]);
  }

  async createSession(hostId: string, quizId: string, maxPlayers?: number): Promise<Session> {
    const quiz = await this.requireQuiz(quizId);
    if (quiz.ownerId !== hostId) throw new GameError("forbidden", "Not your quiz");
    const cap = Math.min(maxPlayers ?? 50, this.d.limits.maxPlayersPerSession);
    for (let attempt = 0; attempt < 5; attempt++) {
      const session: Session = {
        code: makeCode(), quizId, hostId, status: "lobby", currentIndex: -1,
        questionStartedAt: 0, maxPlayers: Math.max(1, cap), locked: false,
      };
      if (await this.d.live.createSession(session)) return session;
    }
    throw new Error("Could not allocate a session code");
  }

  async join(code: string, nickname: string, playerId: string = randomUUID()) {
    const session = await this.requireSession(code);
    const name = nickname.trim().slice(0, 20);
    if (!name) throw new GameError("bad_request", "Nickname required");
    if (session.status === "ended") throw new GameError("locked", "This quiz has ended");
    if (session.locked) throw new GameError("locked", "The host locked this lobby");
    const outcome: JoinOutcome = await this.d.live.join(code, playerId, name, this.d.limits.maxPlayersGlobal);
    if (outcome === "joined") {
      await this.d.realtime.publish(code, { type: "lobby", playerCount: await this.d.live.playerCount(code) });
    }
    return { outcome, playerId };
  }

  async hostAction(code: string, hostId: string, action: HostAction): Promise<Session> {
    const session = await this.requireSession(code);
    if (session.hostId !== hostId) throw new GameError("forbidden", "Only the host can do that");
    const quiz = await this.requireQuiz(session.quizId);
    const now = await this.d.live.now();
    const next = transition(session, action, quiz.questions.length, now);
    await this.d.live.saveSession(next);

    if (next.status === "question") {
      const q = this.questionAt(quiz, next.currentIndex);
      await this.d.realtime.publish(code, {
        type: "question",
        question: toPublicQuestion(q, next.currentIndex, quiz.questions.length),
        startedAt: next.questionStartedAt,
      });
    } else if (next.status === "reveal") {
      const q = this.questionAt(quiz, next.currentIndex);
      await this.d.realtime.publish(code, {
        type: "reveal", correctOptionId: q.correctOptionId, leaderboard: await this.d.live.leaderboard(code, 10),
      });
    } else if (next.status === "ended") {
      await this.finish(next, quiz);
    }
    return next;
  }

  async setLocked(code: string, hostId: string, locked: boolean) {
    const session = await this.requireSession(code);
    if (session.hostId !== hostId) throw new GameError("forbidden", "Only the host can do that");
    await this.d.live.saveSession({ ...session, locked });
  }

  async kick(code: string, hostId: string, playerId: string) {
    const session = await this.requireSession(code);
    if (session.hostId !== hostId) throw new GameError("forbidden", "Only the host can do that");
    await this.d.live.kick(code, playerId);
  }

  async submitAnswer(code: string, playerId: string, optionId: string) {
    const session = await this.requireSession(code);
    if (session.status !== "question") return { status: "closed" as const, points: 0 };
    const quiz = await this.requireQuiz(session.quizId);
    const q = this.questionAt(quiz, session.currentIndex);
    if (!q.options.some((o) => o.id === optionId)) throw new GameError("bad_request", "Unknown option");

    const outcome = await this.d.live.recordAnswer({
      code, index: session.currentIndex, playerId, optionId,
      correct: optionId === q.correctOptionId, timeLimitMs: q.timeLimitSec * 1000,
    });
    if (outcome.status !== "accepted") return { status: outcome.status, points: 0 };

    const points = computeScore({
      correct: optionId === q.correctOptionId, elapsedMs: outcome.elapsedMs,
      timeLimitMs: q.timeLimitSec * 1000, basePoints: q.points, firstCorrect: outcome.firstCorrect,
    });
    if (points > 0) await this.d.live.addScore(code, playerId, points);
    // Deliberately do NOT reveal correctness yet: that would leak the answer to other players.
    return { status: "accepted" as const, points: 0 };
  }

  /**
   * Reconnect/polling fallback: derive everything from the source of truth.
   * The correct answer is only included once the round has been revealed.
   */
  async snapshot(code: string, opts: { playerId?: string; hostId?: string } = {}): Promise<GameSnapshot> {
    const session = await this.requireSession(code);
    const quiz = await this.requireQuiz(session.quizId);
    const inRound = session.status === "question" || session.status === "reveal";
    const q = inRound ? this.questionAt(quiz, session.currentIndex) : null;
    const isHost = opts.hostId !== undefined && opts.hostId === session.hostId;

    const [playerCount, leaderboard, me, serverNow] = await Promise.all([
      this.d.live.playerCount(session.code),
      session.status === "lobby" ? Promise.resolve([]) : this.d.live.leaderboard(session.code, 10),
      opts.playerId ? this.d.live.playerState(session.code, opts.playerId, session.currentIndex) : Promise.resolve(null),
      this.d.live.now(),
    ]);

    const snap: GameSnapshot = {
      code: session.code, status: session.status, quizTitle: quiz.title, playerCount,
      question: q ? toPublicQuestion(q, session.currentIndex, quiz.questions.length) : null,
      startedAt: inRound ? session.questionStartedAt : null,
      serverNow, leaderboard,
      correctOptionId: session.status === "reveal" ? q!.correctOptionId : null,
      me,
    };
    if (isHost) {
      const [players, answeredCount] = await Promise.all([
        this.d.live.players(session.code),
        inRound ? this.d.live.answerCount(session.code, session.currentIndex) : Promise.resolve(0),
      ]);
      snap.host = { players, answeredCount, locked: session.locked, maxPlayers: session.maxPlayers };
    }
    return snap;
  }

  private async finish(session: Session, quiz: Quiz) {
    const ranking = await this.d.live.leaderboard(session.code, 1000);
    await this.d.results.save({
      code: session.code, quizId: quiz.id, hostId: session.hostId, quizTitle: quiz.title,
      endedAt: await this.d.live.now(), ranking,
    });
    await this.d.realtime.publish(session.code, { type: "ended", ranking: ranking.slice(0, 10) });
    await this.d.live.release(session.code);
  }

  private questionAt(quiz: Quiz, index: number): Question {
    const q = quiz.questions[index];
    if (!q) throw new GameError("bad_request", "No such question");
    return q;
  }
  private async requireQuiz(id: string) {
    const quiz = await this.d.quizzes.get(id);
    if (!quiz) throw new GameError("not_found", "Quiz not found");
    return quiz;
  }
  private async requireSession(code: string) {
    const s = await this.d.live.getSession(code.toUpperCase());
    if (!s) throw new GameError("not_found", "Session not found");
    return s;
  }
}
