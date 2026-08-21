import { useState } from "react";
import { speakEnglish } from "../lib/audio";

const PARTS = [
  {
    title: "Part 1 · 熟悉话题短问答",
    time: "4–5 分钟",
    body: "考官问工作、学习、住处、日常。答 2–4 句就行，不要背稿。目标是自然、直接。",
    demo: "I'm a student at the moment, and I usually spend weekdays on campus.",
  },
  {
    title: "Part 2 · 卡片独白",
    time: "1 分钟准备 + 1–2 分钟说",
    body: "一张卡片上有要点。先写关键词，再说一个完整小故事。宁可具体，不要空。",
    demo: "I'd like to talk about a small park near my home, where I go when I want to slow down.",
  },
  {
    title: "Part 3 · 相关讨论",
    time: "4–5 分钟",
    body: "和 Part 2 有关，但更抽象：比较、原因、社会现象。先表态，再补另一面和例子。",
    demo: "I think both can work. A teacher helps at the start, but you still have to practise alone.",
  },
];

type Props = { onDone: () => void; onSkip: () => void };

export function Lesson({ onDone, onSkip }: Props) {
  const [playing, setPlaying] = useState<number | null>(null);

  async function play(i: number, text: string) {
    setPlaying(i);
    await speakEnglish(text);
    setPlaying(null);
  }

  return (
    <>
      <header className="hero">
        <div className="kicker">90 秒看懂考试</div>
        <h1>口语只有三截，考官听四件事。</h1>
        <p>流利连贯、词汇、语法、发音各占 1/4。第一期我们先抓：说满、少停、用 because 加例子。</p>
      </header>
      <div className="lesson-grid" style={{ marginTop: 16 }}>
        {PARTS.map((p, i) => (
          <article className="card lesson-item" key={p.title}>
            <div className="time">{p.time}</div>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
            <p className="en">{p.demo}</p>
            <button className="btn ghost" type="button" onClick={() => play(i, p.demo)} disabled={playing !== null}>
              {playing === i ? "正在读…" : "听 10 秒节奏"}
            </button>
          </article>
        ))}
      </div>
      <div className="row">
        <button className="btn accent" type="button" onClick={onDone}>听完了，去开口</button>
        <button className="btn ghost" type="button" onClick={onSkip}>跳过，直接练</button>
      </div>
    </>
  );
}
