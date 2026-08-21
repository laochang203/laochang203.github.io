import type { ScaffoldSlot } from "../lib/types";
import { slotHits } from "../lib/scaffold";

type Props = {
  slots: ScaffoldSlot[];
  transcript?: string;
  title: string;
};

export function Scaffold({ slots, transcript, title }: Props) {
  const hits = transcript ? slotHits(transcript, slots) : slots.map((slot) => ({ slot, hit: false }));
  return (
    <div className="scaffold">
      <div className="kicker">{title}</div>
      {hits.map(({ slot, hit }) => (
        <div key={slot.label} className={`scaffold-slot${transcript ? (hit ? " on" : " off") : ""}`}>
          <div>
            <b>{slot.label}</b>
            {transcript && <span className="hit">{hit ? "用上了" : "还没有"}</span>}
          </div>
          <div className="en cue">{slot.cue}</div>
        </div>
      ))}
    </div>
  );
}
