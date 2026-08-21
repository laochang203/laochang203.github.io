import type { AttemptMetrics } from "../lib/types";

export function TranscriptView({ metrics, extraPauses }: { metrics: AttemptMetrics; extraPauses?: number }) {
  if (!metrics.transcript.trim()) {
    return <div className="transcript">还没有听清内容。请再听一遍自己的录音，第二遍说慢一点、离麦克风近一点。</div>;
  }
  return (
    <div className="transcript">
      {metrics.tokens.map((t, i) =>
        t.kind === "filler" ? (
          <span key={i} className="filler">{t.text} </span>
        ) : (
          <span key={i}>{t.text} </span>
        ),
      )}
      {(metrics.longPauseCount > 0 || extraPauses) ? (
        <span className="pause">停顿 {metrics.longestPauseSec}s ×{metrics.longPauseCount || extraPauses}</span>
      ) : null}
    </div>
  );
}
