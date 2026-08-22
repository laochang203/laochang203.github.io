import type { CoachNote, Light } from "../lib/types";

const LABELS: { key: keyof CoachNote["lights"]; label: string }[] = [
  { key: "fluency", label: "流利" },
  { key: "lexical", label: "词汇" },
  { key: "grammar", label: "语法" },
  { key: "pronunciation", label: "发音" },
];

function color(l: Light): string {
  if (l === "green") return "chip good";
  if (l === "red") return "chip bad";
  return "chip mid";
}

function mark(l: Light): string {
  if (l === "green") return "绿";
  if (l === "red") return "红";
  return "黄";
}

export function Lights({ coach }: { coach: CoachNote }) {
  if (!coach.lights) return null;
  return (
    <div className="chips">
      {LABELS.map(({ key, label }) => (
        <span key={key} className={color(coach.lights[key])}>
          {label} {mark(coach.lights[key])}
        </span>
      ))}
    </div>
  );
}
