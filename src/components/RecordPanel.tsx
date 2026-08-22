import { useEffect, useRef, useState } from "react";
import { recordAudio, type RecordingResult } from "../lib/audio";
import { listenWhileSpeaking } from "../lib/speech";

type Props = {
  labelStart: string;
  labelStop: string;
  onFinished: (result: RecordingResult, transcript: string) => void;
};

export function RecordPanel({ labelStart, labelStop, onFinished }: Props) {
  const [live, setLive] = useState(false);
  const [sec, setSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const listenRef = useRef<{ stop: () => Promise<string> } | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  async function start() {
    setError("");
    setHeard("");
    transcriptRef.current = "";
    setSec(0);
    const abort = new AbortController();
    abortRef.current = abort;
    setLive(true);
    listenRef.current = listenWhileSpeaking((text) => {
      transcriptRef.current = text;
      setHeard(text);
    });
    try {
      const result = await recordAudio((rms) => setLevel(rms), abort.signal);
      const flushed = await listenRef.current.stop();
      const text = flushed || transcriptRef.current;
      setLive(false);
      setLevel(0);
      onFinished(result, text);
    } catch (e) {
      await listenRef.current?.stop();
      setLive(false);
      setError(e instanceof Error && /NotAllowed|Permission/i.test(e.message)
        ? "请允许麦克风。iPhone 请用 Safari。"
        : "录音失败，请检查麦克风权限。");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="record-wrap">
      <div className="timer">{String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}</div>
      <button className={`record${live ? " live" : ""}`} type="button" onClick={live ? stop : start}>
        {live ? labelStop : labelStart}
      </button>
      <div className="level"><i style={{ width: `${Math.round(level * 100)}%` }} /></div>
      {heard && <p className="en note">{heard}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
