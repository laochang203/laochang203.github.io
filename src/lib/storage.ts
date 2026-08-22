import type { AppState, SessionRecap, Stage } from "./types";
import { FIRST_QUESTION_ID } from "../data/questions";

const KEY = "kaikou-v1";
const API_KEY = "kaikou-xai-key";
const TTS_KEY = "kaikou-tts-xai";

const empty = (): AppState => ({
  lessonDone: false,
  stage: 0,
  lastPracticeAt: null,
  consecutiveDays: 0,
  currentQuestionId: FIRST_QUESTION_ID,
  questions: {},
  lastRecap: null,
});

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) } as AppState;
  } catch {
    return empty();
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getApiKey(): string {
  try {
    return (localStorage.getItem(API_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setApiKey(value: string) {
  const next = value.trim();
  if (!next) localStorage.removeItem(API_KEY);
  else localStorage.setItem(API_KEY, next);
}

export function getTtsXai(): boolean {
  try {
    const raw = localStorage.getItem(TTS_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function setTtsXai(on: boolean) {
  localStorage.setItem(TTS_KEY, on ? "1" : "0");
}

export async function testApiKey(): Promise<string> {
  const key = getApiKey();
  if (!key) return "还没贴钥匙。";
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.6",
        temperature: 0,
        messages: [{ role: "user", content: "Reply with only: ok" }],
      }),
    });
    if (res.ok) return "钥匙通了。第一遍点评会走模型，大约不到 1 分钱。";
    if (res.status === 401 || res.status === 403) return "钥匙无效，重新贴一次。";
    if (res.status === 429) return "额度或频率不够了，先走规则也行。";
    return `连不上（${res.status}）。检查 VPN 后再测。`;
  } catch {
    return "连不上 api.x.ai。检查 VPN 后再测。";
  }
}

function dayStamp(iso: string): string {
  return iso.slice(0, 10);
}

export function hoursSince(iso: string | null): number {
  if (!iso) return 999;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

export function applySession(state: AppState, recap: SessionRecap, passed: boolean): AppState {
  const prev = state.questions[recap.questionId] || { status: "unseen" as const, lastHandle: "" };
  let status = prev.status;
  if (passed) {
    if (prev.status === "passed-once" || prev.status === "stable") status = "stable";
    else status = "passed-once";
  } else {
    status = prev.status === "unseen" ? "tried" : prev.status;
  }

  const today = recap.at.slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  let consecutive = 1;
  if (state.lastPracticeAt) {
    const last = dayStamp(state.lastPracticeAt);
    if (last === today) consecutive = state.consecutiveDays || 1;
    else if (last === yesterday) consecutive = (state.consecutiveDays || 0) + 1;
  }

  const stableCount = Object.values({
    ...state.questions,
    [recap.questionId]: { ...prev, status, lastHandle: recap.gap, passedAt: passed ? recap.at : prev.passedAt },
  }).filter((q) => q.status === "stable").length;

  let stage: Stage = state.stage;
  if (stage === 0 && (status === "passed-once" || status === "stable")) stage = 1;
  if (stableCount >= 8 && stage < 2) stage = 2;
  if (stableCount >= 11 && stage < 3) stage = 3;
  if (stableCount >= 14 && stage < 4) stage = 4;

  return {
    ...state,
    lessonDone: true,
    stage,
    lastPracticeAt: recap.at,
    consecutiveDays: consecutive,
    currentQuestionId: recap.questionId,
    lastRecap: recap,
    questions: {
      ...state.questions,
      [recap.questionId]: {
        status,
        lastHandle: recap.gap,
        passedAt: passed ? recap.at : prev.passedAt,
      },
    },
  };
}
