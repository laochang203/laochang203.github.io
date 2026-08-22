import { getApiKey, getTtsXai } from "./storage";

export type EnergyFrame = { t: number; rms: number };

export type RecordingResult = {
  blob: Blob;
  mime: string;
  durationSec: number;
  frames: EnergyFrame[];
  url: string;
};

function pickMime(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function pauseStats(frames: EnergyFrame[]): { longPauseCount: number; longestPauseSec: number } {
  if (frames.length < 4) return { longPauseCount: 0, longestPauseSec: 0 };
  const peak = Math.max(...frames.map((f) => f.rms), 0.01);
  const silence = peak * 0.12;
  let longest = 0;
  let longCount = 0;
  let run = 0;
  let heard = false;
  for (const frame of frames) {
    if (frame.rms >= silence) {
      heard = true;
      if (run >= 0.8) longCount += 1;
      if (run > longest) longest = run;
      run = 0;
    } else if (heard) {
      run += 0.05;
    }
  }
  if (run > longest) longest = run;
  if (run >= 0.8) longCount += 1;
  return { longPauseCount: longCount, longestPauseSec: Number(longest.toFixed(2)) };
}

export async function recordAudio(
  onLevel: (level: number) => void,
  signal: AbortSignal,
): Promise<RecordingResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const frames: EnergyFrame[] = [];
  const started = performance.now();

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);

  let timer = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) {
      const n = (v - 128) / 128;
      sum += n * n;
    }
    const rms = Math.sqrt(sum / data.length);
    frames.push({ t: (performance.now() - started) / 1000, rms });
    onLevel(Math.min(1, rms * 4));
    timer = window.setTimeout(tick, 50);
  };
  tick();

  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<RecordingResult>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("录音失败"));
    recorder.onstop = async () => {
      window.clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => undefined);
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
      resolve({
        blob,
        mime: blob.type,
        durationSec: Number(((performance.now() - started) / 1000).toFixed(2)),
        frames,
        url: URL.createObjectURL(blob),
      });
    };
  });

  recorder.start();
  const abort = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  signal.addEventListener("abort", abort, { once: true });
  return done;
}

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    const voices = window.speechSynthesis.getVoices();
    const en =
      voices.find((v) => /en-US/i.test(v.lang) && /google|samantha|daniel|karen|moira/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (en) u.voice = en;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function speakXai(text: string): Promise<boolean> {
  const key = getApiKey();
  if (!key) return false;
  const res = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice_id: "eve", language: "en" }),
  });
  if (!res.ok) return false;
  const buf = await res.arrayBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: res.headers.get("content-type") || "audio/mpeg" }));
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve(true);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    void audio.play().catch(() => {
      URL.revokeObjectURL(url);
      resolve(false);
    });
  });
}

export async function speakEnglish(text: string): Promise<void> {
  if (getApiKey() && getTtsXai()) {
    try {
      if (await speakXai(text)) return;
    } catch {
      /* fall through */
    }
  }
  return speakBrowser(text);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
