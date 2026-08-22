import { speakEnglish } from "../lib/audio";
import type { ScaffoldSlot } from "../lib/types";

type Props = {
  complete: boolean;
  missing: ScaffoldSlot[];
  line: string;
};

export function NextGuide({ complete, missing, line }: Props) {
  const slot = missing[0];
  if (complete || !slot) {
    return (
      <div className="band7">
        <div className="kicker" style={{ color: "var(--good)" }}>三格都有了，下一遍换更具体的例子</div>
        <p className="en">{line}</p>
        <button className="btn ghost" type="button" onClick={() => speakEnglish(line)}>再听一句</button>
      </div>
    );
  }
  return (
    <>
      <div className="issue">
        <strong>这一遍缺的</strong>
        缺「{slot.label}」。下一遍开口先说：<span className="en">{slot.cue}</span>
      </div>
      <div className="band7">
        <div className="kicker" style={{ color: "var(--good)" }}>下一遍就说这一句，内容换成你自己的</div>
        <p className="en" style={{ marginBottom: 8 }}>{line}</p>
        <button className="btn ghost" type="button" onClick={() => speakEnglish(line)}>听要补的那一句</button>
      </div>
    </>
  );
}
