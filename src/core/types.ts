/** Domain model. Pure data: no I/O, no framework imports. */

export type QuestionType = "multiple_choice"; // extend: "true_false" | "poll" | "free_text"

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: Option[];
  correctOptionId: string;
  timeLimitSec: number;
  points: number;
}

export interface Quiz {
  id: string;
  ownerId: string;
  title: string;
  questions: Question[];
  createdAt: number;
}

export type SessionStatus = "lobby" | "question" | "reveal" | "ended";

export interface Session {
  code: string;
  quizId: string;
  hostId: string;
  status: SessionStatus;
  /** -1 while in the lobby. */
  currentIndex: number;
  /** Authoritative store time (ms) at which the current question opened. */
  questionStartedAt: number;
  maxPlayers: number;
  locked: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

/** What players are allowed to see: the correct answer is stripped. */
export interface PublicQuestion {
  index: number;
  total: number;
  text: string;
  options: Option[];
  timeLimitSec: number;
  points: number;
}

export interface SessionResult {
  code: string;
  quizId: string;
  hostId: string;
  quizTitle: string;
  endedAt: number;
  ranking: LeaderboardEntry[];
}
