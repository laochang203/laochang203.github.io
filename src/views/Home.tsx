import { pickToday, stageLabel } from "../lib/pick";
import { hoursSince } from "../lib/storage";
import type { AppState } from "../lib/types";

type Props = {
  state: AppState;
  onLesson: () => void;
  onPractice: () => void;
};

export function Home({ state, onLesson, onPractice }: Props) {
  const today = pickToday(state);
  const gap = hoursSince(state.lastPracticeAt);
  const gapHint =
    gap >= 168 ? "好几天没开口了，今天只做一题热身。" : gap >= 48 ? "两天多没来，先用熟题开口。" : today.reason;

  return (
    <>
      <header className="hero">
        <div className="kicker">{stageLabel(state.stage)}</div>
        <h1>今天开口，说完再改一遍。</h1>
        <p>{gapHint} 不打精确分数。过关看你有没有说满、停顿有没有短、有没有用上 because 和例子。</p>
        <div className="chips">
          <span className="chip">连续 {state.consecutiveDays} 天</span>
          {state.lastPracticeAt && <span className="chip">上次 {state.lastPracticeAt.slice(5, 16).replace("T", " ")}</span>}
        </div>
        <div className="row">
          <button className="btn accent" type="button" onClick={onPractice}>
            今天开口
          </button>
          <button className="btn ghost" type="button" onClick={onLesson}>
            {state.lessonDone ? "再看题型" : "先看题型课"}
          </button>
        </div>
      </header>

      <div className="card" style={{ padding: 22, marginTop: 16 }}>
        <div className="kicker">今日题目</div>
        <h2 className="en prompt" style={{ fontSize: 22 }}>{today.question.prompt}</h2>
        <p>{today.question.promptZh}</p>
        <p className="note">目标大约 {today.reduced ? Math.round(today.question.targetSeconds / 2) : today.question.targetSeconds} 秒。同一结构要说 3～4 遍，录音时三格（答案 / because / 例子）会钉在屏幕上。</p>
      </div>

      {state.lastRecap && (
        <div className="card" style={{ padding: 22, marginTop: 16 }}>
          <div className="kicker">上次带走的</div>
          <p style={{ color: "var(--ink)" }}>{state.lastRecap.learned}</p>
          <p className="en">{state.lastRecap.learnLine}</p>
          <p className="note">明天：{state.lastRecap.tomorrow}</p>
        </div>
      )}
    </>
  );
}
