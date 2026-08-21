import type { AttemptMetrics, TranscriptToken } from "./types";
import { pauseStats, type EnergyFrame } from "./audio";

const FILLERS = ["uh", "um", "er", "ah", "like", "you know", "then then", "那个", "然后", "嗯"];

function tokenize(transcript: string): TranscriptToken[] {
  if (!transcript.trim()) return [];
  return transcript
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const text = raw.toLowerCase().replace(/[.,!?]/g, "");
      const filler = FILLERS.some((f) => text === f || text === `${f},`);
      return { text: raw, kind: filler ? "filler" : "word" } as TranscriptToken;
    });
}

export function analyzeAttempt(
  transcript: string,
  durationSec: number,
  frames: EnergyFrame[],
): AttemptMetrics {
  const pauses = pauseStats(frames);
  const tokens = tokenize(transcript);
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const lower = transcript.toLowerCase();
  const sentenceLike = Math.max(transcript.split(/[.!?]+/).filter((s) => s.trim().length > 8).length, words ? 1 : 0);

  return {
    durationSec,
    wordCount: words,
    fillerCount: tokens.filter((t) => t.kind === "filler").length,
    longPauseCount: pauses.longPauseCount,
    longestPauseSec: pauses.longestPauseSec,
    hasBecause: /\bbecause\b|\bthat's why\b|\bso that\b/.test(lower),
    hasExample: /\bfor example\b|\bfor instance\b|\bsuch as\b|\blast (week|month|year|night)\b/.test(lower),
    sentenceLike,
    transcript,
    tokens,
  };
}

export function secondPassBetter(a: AttemptMetrics, b: AttemptMetrics, checks: string[]): boolean {
  const usedHandle = checks.some((c) => b.transcript.toLowerCase().includes(c.toLowerCase()));
  const longer = b.wordCount >= a.wordCount + 6 || b.wordCount >= 18;
  const fewerPauses = b.longestPauseSec + 0.3 < a.longestPauseSec || b.longPauseCount < a.longPauseCount;
  return usedHandle || (longer && fewerPauses) || (longer && b.sentenceLike >= 3);
}
