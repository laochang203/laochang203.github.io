import { useState } from "react";
import { pickToday, stageLabel } from "../lib/pick";
import { getApiKey, hoursSince, setApiKey } from "../lib/storage";
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
  const [draft, setDraft] = useState("");
  const [hasKey, setHasKey] = useState(() => Boolean(getApiKey()));
  const [note, setNote] = useState("");

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

      <div className="card" style={{ padding: 22, marginTop: 16 }}>
        <div className="kicker">模型点评（可选）</div>
        <h3>{hasKey ? "这台设备已保存钥匙" : "不贴钥匙也能练，评语走规则"}</h3>
        <p>
          SuperGrok 会员到不了这个网页。要让模型按你刚才说的话改写成 7 分说法，去
          {" "}
          <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a>
          {" "}
          创建 API Key，可选先充 $5，然后贴在下面。钥匙只存在这台手机/电脑，不会上传到 GitHub。
        </p>
        <input
          className="key-input"
          type="password"
          autoComplete="off"
          placeholder="xai- 开头的钥匙"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="row">
          <button
            className="btn accent"
            type="button"
            onClick={() => {
              if (!draft.trim()) {
                setNote("先粘贴钥匙。");
                return;
              }
              setApiKey(draft);
              setDraft("");
              setHasKey(true);
              setNote("已保存在这台设备。第一遍录音后，评语会写成「来自模型」。");
            }}
          >
            保存钥匙
          </button>
          {hasKey && (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setApiKey("");
                setDraft("");
                setHasKey(false);
                setNote("已清除。之后评语走规则。");
              }}
            >
              清除
            </button>
          )}
        </div>
        {note && <p className="note">{note}</p>}
        <p className="note">别把钥匙发截图。换手机或清浏览器缓存要重新贴。额度用完或连不上，会自动退回规则。</p>
      </div>
    </>
  );
}
