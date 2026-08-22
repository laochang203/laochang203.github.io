import { useMemo, useState } from "react";
import { NextGuide } from "../components/NextGuide";
import { RecordPanel } from "../components/RecordPanel";
import { Scaffold } from "../components/Scaffold";
import { TranscriptView } from "../components/TranscriptView";
import { blobToBase64, speakEnglish, type RecordingResult } from "../lib/audio";
import { analyzeAttempt } from "../lib/analyze";
import { compareText, requestCoach } from "../lib/coach";
import { pickToday } from "../lib/pick";
import { knowledgeTitle, knowledgeUsed, missingSlots, nextSpeakLine, slotsFor } from "../lib/scaffold";
import type { AppState, AttemptMetrics, CoachNote, SessionRecap } from "../lib/types";

type Step = "shadow" | "speak1" | "wait" | "feedback" | "drill" | "check" | "recap";

type Take = { rec: RecordingResult; metrics: AttemptMetrics };

const MAX_TAKES = 4;

type Props = {
  state: AppState;
  onFinished: (recap: SessionRecap, passed: boolean) => void;
  onHome: () => void;
};

export function Practice({ state, onFinished, onHome }: Props) {
  const { question, reduced, reason } = useMemo(() => pickToday(state), [state]);
  const slots = useMemo(() => slotsFor(question), [question]);
  const point = knowledgeTitle(question);
  const target = reduced ? Math.max(12, Math.round(question.targetSeconds / 2)) : question.targetSeconds;
  const [step, setStep] = useState<Step>("shadow");
  const [takes, setTakes] = useState<Take[]>([]);
  const [coach, setCoach] = useState<CoachNote | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [busy, setBusy] = useState("");
  const [recap, setRecap] = useState<SessionRecap | null>(null);

  const last = takes[takes.length - 1];
  const first = takes[0];
  const n = takes.length;

  async function afterRecord(rec: RecordingResult, transcript: string) {
    const metrics = analyzeAttempt(transcript, rec.durationSec, rec.frames);
    setBusy("正在听你这一遍…");
    setStep("wait");
    let audioBase64: string | undefined;
    try {
      audioBase64 = await blobToBase64(rec.blob);
    } catch {
      audioBase64 = undefined;
    }

    if (takes.length === 0) {
      const out = await requestCoach({
        question,
        metrics,
        attempt: 1,
        audio: rec.blob,
        audioBase64,
        mime: rec.mime,
      });
      const text = out.transcript || metrics.transcript;
      const merged = { ...analyzeAttempt(text, rec.durationSec, rec.frames), transcript: text };
      setUsedAi(out.usedAi);
      setCoach(out.coach);
      setTakes([{ rec, metrics: merged }]);
      setStep("feedback");
    } else {
      setTakes((prev) => [...prev, { rec, metrics }]);
      setStep("check");
    }
    setBusy("");
  }

  function finish() {
    if (!first || !last || !coach) return;
    const usedCount = takes.filter((t) => knowledgeUsed(t.metrics, slots)).length;
    const passed = usedCount >= 1 && (knowledgeUsed(last.metrics, slots) || n >= 3);
    const recapNote: SessionRecap = {
      at: new Date().toISOString(),
      questionId: question.id,
      prompt: question.prompt,
      learned: `今天只练一个结构：${point}。一共说了 ${n} 遍，其中 ${usedCount} 遍用上了。`,
      strength: coach.strength,
      gap: knowledgeUsed(last.metrics, slots) ? "结构用上了，下次换你自己的具体例子。" : coach.mainIssue,
      effect: compareText(first.metrics, last.metrics, coach.handleCheck),
      tomorrow: passed ? `下一题继续用：${point}` : `还是这题，还是这个结构：${point}`,
      learnLine: coach.learnLine,
      passed,
    };
    setRecap(recapNote);
    onFinished(recapNote, passed);
    setStep("recap");
  }

  function canStop() {
    if (n >= MAX_TAKES) return true;
    if (n >= 3 && last && knowledgeUsed(last.metrics, slots)) return true;
    return false;
  }

  function drillLabel() {
    if (n === 1) return "第二遍 · 照着结构说";
    if (n === 2) return "第三遍 · 巩固，换你自己的例子";
    return "第四遍 · 再把缺的那一格补上";
  }

  return (
    <>
      <p className="note">
        {reason} · 目标约 {target} 秒 · 同一知识点练到第 {Math.max(n, 1)}/{MAX_TAKES} 遍
        {coach ? (usedAi ? " · 评语来自模型" : " · 评语来自规则") : ""}
      </p>

      {step === "shadow" && (
        <header className="hero">
          <div className="kicker">先跟读</div>
          <h1 className="en prompt">{question.prompt}</h1>
          <p>{question.promptZh}</p>
          {question.bullets && <ul>{question.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
          <p className="en">{question.shadow}</p>
          <div className="row">
            <button className="btn ghost" type="button" onClick={() => speakEnglish(question.shadow)}>听示范</button>
            <button className="btn accent" type="button" onClick={() => setStep("speak1")}>跟读过了，自己说</button>
          </div>
        </header>
      )}

      {step === "speak1" && (
        <header className="hero">
          <div className="kicker">第一遍 · 先暴露问题</div>
          <h1 className="en prompt">{question.prompt}</h1>
          <p>这遍可以随便说，用来看你缺哪一块。后面几遍会把结构钉在屏幕上。</p>
          <RecordPanel labelStart="开始说" labelStop="说完了" onFinished={(r, t) => void afterRecord(r, t)} />
        </header>
      )}

      {step === "wait" && (
        <header className="hero">
          <h1>{busy || "请稍等"}</h1>
          <p>在对这一遍和那个结构。</p>
        </header>
      )}

      {step === "feedback" && first && coach && (
        <div className="hero">
          <div className="kicker">锁定今天的知识点</div>
          <h1>今天只练这一句结构，后面还要再说两到三遍。</h1>
          <Scaffold slots={slots} transcript={first.metrics.transcript} title={point} />
          <div className="chips">
            <span className={usedAi ? "chip good" : "chip"}>{usedAi ? "评语来自模型" : "评语来自规则"}</span>
            <span className="chip">{first.metrics.wordCount} 词</span>
            <span className="chip">{first.metrics.durationSec}s</span>
            <span className="chip">最长停顿 {first.metrics.longestPauseSec}s</span>
          </div>
          <audio controls src={first.rec.url} style={{ width: "100%", margin: "8px 0 12px" }} />
          <TranscriptView metrics={first.metrics} />
          <div className="issue">
            <strong>主要问题</strong>
            {coach.mainIssue}
            {coach.handle ? <p style={{ margin: "8px 0 0", color: "var(--ink)" }}>下一遍只改这一件：{coach.handle}</p> : null}
          </div>
          <div className="band7">
            <div className="kicker" style={{ color: "var(--good)" }}>照这个架子说，内容换成你自己的</div>
            <p className="en" style={{ marginBottom: 8 }}>{coach.band7}</p>
            <p className="en" style={{ marginBottom: 8 }}><strong>先跟读这一句：</strong> {coach.learnLine}</p>
            <button className="btn ghost" type="button" onClick={() => speakEnglish(coach.learnLine)}>听要学的那一句</button>
          </div>
          {coach.rangeNote ? <p className="note">{coach.rangeNote}</p> : null}
          <div className="row">
            <button className="btn accent block" type="button" onClick={() => setStep("drill")}>
              看着三格再说一遍
            </button>
          </div>
        </div>
      )}

      {step === "drill" && coach && (
        <div className="hero">
          <div className="kicker">{drillLabel()}</div>
          <p className="zh">{question.promptZh}</p>
          <h2 className="en prompt" style={{ fontSize: 22 }}>{question.prompt}</h2>
          <Scaffold slots={slots} transcript={last?.metrics.transcript} title={`开口时盯着这三格 · ${point}`} />
          <NextGuide
            complete={Boolean(last && knowledgeUsed(last.metrics, slots))}
            missing={last ? missingSlots(last.metrics.transcript, slots) : slots}
            line={last ? nextSpeakLine(last.metrics.transcript, slots, coach) : coach.learnLine}
          />
          <p className="note">录音时三格还在上面。缺的那一格这一遍必须说出来。</p>
          <RecordPanel
            labelStart={n === 1 ? "开始第二遍" : n === 2 ? "开始第三遍" : "开始第四遍"}
            labelStop="说完了"
            onFinished={(r, t) => void afterRecord(r, t)}
          />
        </div>
      )}

      {step === "check" && last && coach && first && (
        <div className="hero">
          <div className="kicker">第 {n} 遍对过没有</div>
          <h1>{knowledgeUsed(last.metrics, slots) ? "结构用上了。" : "结构还没齐，再来。"}</h1>
          <Scaffold slots={slots} transcript={last.metrics.transcript} title={point} />
          <p>{compareText(first.metrics, last.metrics, coach.handleCheck)}</p>
          <audio controls src={last.rec.url} style={{ width: "100%", margin: "8px 0 12px" }} />
          <TranscriptView metrics={last.metrics} />
          <NextGuide
            complete={knowledgeUsed(last.metrics, slots)}
            missing={missingSlots(last.metrics.transcript, slots)}
            line={nextSpeakLine(last.metrics.transcript, slots, coach)}
          />
          <div className="row">
            {canStop() ? (
              <button className="btn accent" type="button" onClick={finish}>看今天小结</button>
            ) : (
              <button className="btn accent" type="button" onClick={() => setStep("drill")}>
                {knowledgeUsed(last.metrics, slots)
                  ? "再用自己的例子巩固一遍"
                  : `再说一遍，先开口 ${missingSlots(last.metrics.transcript, slots)[0]?.cue ?? "缺的那一格"}`}
              </button>
            )}
            {n >= 3 && !canStop() && (
              <button className="btn ghost" type="button" onClick={finish}>先收住，明天继续</button>
            )}
          </div>
        </div>
      )}

      {step === "recap" && recap && (
        <div className="hero recap-list">
          <div className="kicker">今天收住</div>
          <h1>{recap.passed ? "这个结构今天练过了。" : "结构还没稳住，明天还练它。"}</h1>
          <Scaffold slots={slots} transcript={last?.metrics.transcript} title={point} />
          <section>
            <h3>今天练成了什么</h3>
            <p style={{ color: "var(--ink)" }}>{recap.learned}</p>
          </section>
          <section>
            <h3>优点</h3>
            <p style={{ color: "var(--ink)" }}>{recap.strength}</p>
          </section>
          <section>
            <h3>还不够</h3>
            <p style={{ color: "var(--ink)" }}>{recap.gap}</p>
          </section>
          <section>
            <h3>效果</h3>
            <p style={{ color: "var(--ink)" }}>{recap.effect}</p>
          </section>
          <section>
            <h3>一句跟读</h3>
            <p className="en">{recap.learnLine}</p>
            <button className="btn ghost" type="button" onClick={() => speakEnglish(recap.learnLine)}>再听</button>
          </section>
          <section>
            <h3>明天就做这一件</h3>
            <p style={{ color: "var(--ink)" }}>{recap.tomorrow}</p>
          </section>
          <div className="row">
            <button className="btn accent" type="button" onClick={onHome}>回首页</button>
          </div>
        </div>
      )}
    </>
  );
}
