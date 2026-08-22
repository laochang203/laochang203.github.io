import { speakEnglish } from "../lib/audio";
import type { CoachNote } from "../lib/types";
import { Lights } from "./Lights";

export function PinnedCoach({ coach, usedAi }: { coach: CoachNote; usedAi: boolean }) {
  return (
    <>
      <div className="chips">
        <span className={usedAi ? "chip good" : "chip"}>{usedAi ? "评语来自模型" : "评语来自规则"}</span>
      </div>
      <Lights coach={coach} />
      <div className="issue">
        <strong>主要问题</strong>
        {coach.mainIssue}
        {coach.handle ? <p style={{ margin: "8px 0 0", color: "var(--ink)" }}>下一遍只改这一件：{coach.handle}</p> : null}
      </div>
      {coach.pronunciationNote && (
        <p className="note" style={{ color: "var(--ink)" }}>发音：{coach.pronunciationNote}</p>
      )}
      {coach.traps?.length ? (
        <ul>
          {coach.traps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      <div className="band7">
        <div className="kicker" style={{ color: "var(--good)" }}>偷这个架子，不要整段背</div>
        <p className="en" style={{ marginBottom: 8 }}>{coach.band7}</p>
        <p className="en" style={{ marginBottom: 8 }}><strong>只跟读这一句：</strong> {coach.learnLine}</p>
        <button className="btn ghost" type="button" onClick={() => void speakEnglish(coach.learnLine)}>听要学的那一句</button>
      </div>
      {coach.rangeNote ? <p className="note">{coach.rangeNote}</p> : null}
    </>
  );
}
