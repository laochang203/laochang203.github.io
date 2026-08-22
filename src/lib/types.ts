export type Stage = 0 | 1 | 2 | 3 | 4;

export type QuestionStatus = "unseen" | "tried" | "passed-once" | "stable";

export type Question = {
  id: string;
  part: 1 | 2 | 3;
  topic: string;
  prompt: string;
  promptZh: string;
  bullets?: string[];
  shadow: string;
  band7: string;
  handleHint: string;
  handleCheck: string[];
  targetSeconds: number;
};

export type ScaffoldSlot = {
  label: string;
  cue: string;
  check?: string;
};

export type TranscriptToken = {
  text: string;
  kind: "word" | "filler" | "pause";
  pauseSec?: number;
};

export type AttemptMetrics = {
  durationSec: number;
  wordCount: number;
  fillerCount: number;
  longPauseCount: number;
  longestPauseSec: number;
  hasBecause: boolean;
  hasExample: boolean;
  sentenceLike: number;
  transcript: string;
  tokens: TranscriptToken[];
};

export type Light = "green" | "yellow" | "red";

export type CoachNote = {
  mainIssue: string;
  handle: string;
  handleCheck: string[];
  band7: string;
  learnLine: string;
  strength: string;
  rangeNote: string;
  traps: string[];
  pronunciationNote: string;
  lights: { fluency: Light; lexical: Light; grammar: Light; pronunciation: Light };
};

export type QuestionProgress = {
  status: QuestionStatus;
  lastHandle: string;
  passedAt?: string;
};

export type SessionRecap = {
  at: string;
  questionId: string;
  prompt: string;
  learned: string;
  strength: string;
  gap: string;
  effect: string;
  tomorrow: string;
  learnLine: string;
  passed: boolean;
};

export type AppState = {
  lessonDone: boolean;
  stage: Stage;
  lastPracticeAt: string | null;
  consecutiveDays: number;
  currentQuestionId: string | null;
  questions: Record<string, QuestionProgress>;
  lastRecap: SessionRecap | null;
};
