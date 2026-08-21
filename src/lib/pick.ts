import { QUESTIONS } from "../data/questions";
import type { AppState, Question } from "./types";
import { hoursSince } from "./storage";

export function pickToday(state: AppState): { question: Question; reason: string; reduced: boolean } {
  const gap = hoursSince(state.lastPracticeAt);
  const reduced = gap >= 48;
  const current = QUESTIONS.find((q) => q.id === state.currentQuestionId);

  if (state.stage === 0) {
    return {
      question: QUESTIONS[0],
      reason: "第一题先固定，练完开口再换。",
      reduced,
    };
  }

  if (current) {
    const st = state.questions[current.id];
    if (st && (st.status === "tried" || st.status === "passed-once")) {
      return {
        question: current,
        reason: st.status === "tried" ? "这题还没过关，继续改同一点。" : "过了一次，隔天再过一次才算稳。",
        reduced,
      };
    }
  }

  if (gap >= 48) {
    const easy =
      QUESTIONS.find((q) => state.questions[q.id]?.status === "stable" && q.part === 1) || QUESTIONS[0];
    return {
      question: easy,
      reason: gap >= 168 ? "几天没开口，先用熟题热身，量减半。" : "超过两天没来，今天只热身一题。",
      reduced: true,
    };
  }

  const pool = QUESTIONS.filter((q) => {
    if (state.stage < 2) return q.part === 1;
    if (state.stage < 3) return q.part === 1 || q.part === 2;
    return true;
  });

  const next = pool.find((q) => !state.questions[q.id] || state.questions[q.id].status === "unseen") || pool[0];
  return {
    question: next,
    reason: "今天的新开口。",
    reduced: false,
  };
}

export function stageLabel(stage: number): string {
  return ["阶段 0 · 开口", "阶段 1 · 说满", "阶段 2 · 说圆", "阶段 3 · 说深", "阶段 4 · 往 7+"][stage] || "";
}
