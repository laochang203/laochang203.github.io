import type { AttemptMetrics, Question, ScaffoldSlot } from "./types";

export const KNOWLEDGE = "答案 + because + For example";

export function slotsFor(question: Question): ScaffoldSlot[] {
  if (question.part === 3) {
    return [
      { label: "1. 先表态", cue: "I think …" },
      { label: "2. 原因", cue: "because …", check: "because" },
      { label: "3. 另一面", cue: "On the other hand, …", check: "on the other hand" },
    ];
  }
  if (question.part === 2) {
    return [
      { label: "1. 是什么", cue: "I'd like to talk about …" },
      { label: "2. 原因", cue: "because …", check: "because" },
      { label: "3. 例子", cue: "For example, …", check: "for example" },
    ];
  }
  return [
    { label: "1. 先答问题", cue: "I …" },
    { label: "2. 再讲原因", cue: "because …", check: "because" },
    { label: "3. 再举例子", cue: "For example, …", check: "for example" },
  ];
}

export function slotHits(transcript: string, slots: ScaffoldSlot[]): { slot: ScaffoldSlot; hit: boolean }[] {
  const lower = transcript.toLowerCase();
  return slots.map((slot) => ({
    slot,
    hit: slot.check ? lower.includes(slot.check.toLowerCase()) : transcript.trim().split(/\s+/).length >= 8,
  }));
}

export function knowledgeUsed(metrics: AttemptMetrics, slots: ScaffoldSlot[]): boolean {
  const hits = slotHits(metrics.transcript, slots);
  const required = hits.filter((h) => h.slot.check);
  const got = required.filter((h) => h.hit).length;
  return got >= Math.min(2, required.length) || (metrics.hasBecause && metrics.hasExample);
}

export function knowledgeTitle(question: Question): string {
  if (question.part === 3) return "表态 + because + On the other hand";
  return KNOWLEDGE;
}

export function missingSlots(transcript: string, slots: ScaffoldSlot[]): ScaffoldSlot[] {
  return slotHits(transcript, slots).filter((h) => !h.hit).map((h) => h.slot);
}

export function nextSpeakLine(
  transcript: string,
  slots: ScaffoldSlot[],
  coach: { learnLine: string; band7: string },
): string {
  const miss = missingSlots(transcript, slots)[0];
  const parts = coach.band7.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  if (!miss) return coach.learnLine;
  if (miss.check) {
    const needle = miss.check.toLowerCase();
    const fromBand = parts.find((s) => s.toLowerCase().includes(needle));
    if (fromBand) return fromBand;
    if (coach.learnLine.toLowerCase().includes(needle)) return coach.learnLine;
  } else if (parts[0]) {
    return parts[0];
  }
  return miss.cue;
}
