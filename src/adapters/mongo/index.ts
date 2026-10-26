import type { Collection, Db } from "mongodb";
import type { Quiz, SessionResult } from "@/core/types";
import type { QuizRepository, ResultsRepository } from "@/ports";

/**
 * MongoDB implementation of the durable stores.
 *
 * Why MongoDB here: a quiz is naturally ONE document (title + an ordered
 * array of questions whose shape varies by question type), always read and
 * written whole. No joins, and new question types need no migration.
 * Results are append-only snapshots, also a single document each.
 */
type QuizDoc = Omit<Quiz, "id"> & { _id: string };
type ResultDoc = SessionResult & { _id: string };

export class MongoQuizRepository implements QuizRepository {
  private col: Collection<QuizDoc>;
  private ready: Promise<unknown>;

  constructor(db: Db) {
    this.col = db.collection<QuizDoc>("quizzes");
    this.ready = this.col.createIndex({ ownerId: 1, createdAt: -1 });
  }

  async save(quiz: Quiz) {
    await this.ready;
    const { id, ...rest } = quiz;
    await this.col.replaceOne({ _id: id }, rest, { upsert: true });
  }

  async get(id: string) {
    await this.ready;
    const doc = await this.col.findOne({ _id: id });
    return doc ? toQuiz(doc) : null;
  }

  async listByOwner(ownerId: string) {
    await this.ready;
    const docs = await this.col.find({ ownerId }).sort({ createdAt: -1 }).limit(100).toArray();
    return docs.map(toQuiz);
  }
}

export class MongoResultsRepository implements ResultsRepository {
  private col: Collection<ResultDoc>;
  private ready: Promise<unknown>;

  constructor(db: Db) {
    this.col = db.collection<ResultDoc>("results");
    this.ready = this.col.createIndex({ hostId: 1, endedAt: -1 });
  }

  async save(result: SessionResult) {
    await this.ready;
    // Keyed by session code + end time so a retried save is idempotent.
    await this.col.replaceOne(
      { _id: `${result.code}:${result.endedAt}` },
      result,
      { upsert: true },
    );
  }

  async listByHost(hostId: string) {
    await this.ready;
    const docs = await this.col.find({ hostId }).sort({ endedAt: -1 }).limit(100).toArray();
    return docs.map(({ _id, ...rest }) => { void _id; return rest; });
  }
}

function toQuiz({ _id, ...rest }: QuizDoc): Quiz {
  return { id: _id, ...rest };
}
