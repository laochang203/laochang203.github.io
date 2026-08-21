import { getApiKey } from "./storage";
import type { AttemptMetrics, CoachNote, Question } from "./types";

function localCoach(q: Question, m: AttemptMetrics, attempt: number): CoachNote {
  const short = m.wordCount < 12 || m.durationSec < 12;
  const noBecause = !m.hasBecause && !m.hasExample;
  const pauseHeavy = m.longestPauseSec >= 1.2 || m.longPauseCount >= 2;

  let mainIssue = "内容还太短，考官会觉得你只答了一句。";
  let handle = "第二遍先说答案，再说 because，再补一个例子。";
  if (!short && noBecause) {
    mainIssue = "有句子，但缺原因和例子，听起来像翻译完就停。";
    handle = q.handleHint;
  } else if (!short && pauseHeavy) {
    mainIssue = `句中停得偏长，最长大约 ${m.longestPauseSec} 秒，像在脑子里先写中文。`;
    handle = "想到哪个词先说完这一句，because 放到下一句再补。";
  } else if (m.fillerCount >= 3) {
    mainIssue = "口头禅有点多，流利度会被拖住。";
    handle = "第二遍允许慢，但少说 um / uh，用停半拍代替。";
  } else if (attempt === 2) {
    mainIssue = "方向对了，还要再自然一点，别只堆句型。";
    handle = "保留 because，把例子换成你自己上周或昨天做过的事。";
  }

  const strength =
    m.wordCount === 0
      ? "你把录音完成了，这比对着空气空想更重要。"
      : m.sentenceLike >= 2
        ? "已经不只一句，开头能听出你在答题。"
        : "你开口了，机器也录到了，下一步只加长一点。";

  return {
    mainIssue,
    handle,
    handleCheck: q.handleCheck,
    band7: q.band7,
    learnLine: q.band7.split(/(?<=\.)\s+/)[1] || q.shadow,
    strength,
    rangeNote: "这段更接近 5 而不是 7。这不是官方分数，大概可能差一整档。",
  };
}

function coachPrompt(q: Question, m: AttemptMetrics, attempt: number, previousTranscript?: string): string {
  return `You are an IELTS Speaking coach for a Band 5 Chinese learner aiming toward 7.
Return ONLY JSON with keys:
mainIssue (Chinese, one specific problem in this attempt),
handle (Chinese, the ONE thing to change on the immediate retry),
handleCheck (array of 1-3 lowercase English words/phrases that should appear next time, e.g. ["because","for example"]),
band7 (English, 2-4 sentences: SAME life facts as the student, upgraded toward Band 7; do not invent a new job/story),
learnLine (ONE short English sentence from band7, easy to shadow),
strength (Chinese, one concrete good point; if the answer is tiny, praise showing up / finishing the recording),
rangeNote (Chinese, very wide, e.g. "更接近 5 而不是 7；这不是官方分数，大约可能差一整档")

Rules:
- Do NOT give a precise band like 6.5.
- One issue only. Prefer: too short, mid-sentence pauses, no because/example, translating from Chinese, not answering the question.
- Attempt ${attempt}. Question: ${q.prompt} (${q.promptZh})
- Duration ${m.durationSec}s, long pauses ${m.longPauseCount}, longest pause ${m.longestPauseSec}s, fillers ${m.fillerCount}.
- Transcript: """${m.transcript || "(empty)"}"""
- Previous transcript if any: """${previousTranscript || ""}"""`;
}

function parseCoach(raw: string, fallbackCheck: string[]): CoachNote | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as CoachNote;
    if (!parsed.mainIssue || !parsed.band7) return null;
    return {
      ...parsed,
      handleCheck: parsed.handleCheck?.length ? parsed.handleCheck : fallbackCheck,
    };
  } catch {
    return null;
  }
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

async function xaiTranscribe(audio: Blob, mime: string): Promise<string> {
  const key = getApiKey();
  if (!key) return "";
  const ext = mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : "webm";
  const form = new FormData();
  form.append("language", "en");
  form.append("format", "true");
  form.append("file", audio, `take.${ext}`);
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}

async function xaiCoach(
  q: Question,
  m: AttemptMetrics,
  attempt: number,
  previousTranscript?: string,
): Promise<CoachNote | null> {
  const key = getApiKey();
  if (!key) return null;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4.6",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You write terse IELTS speaking coaching JSON. No markdown." },
        { role: "user", content: coachPrompt(q, m, attempt, previousTranscript) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseCoach(data.choices?.[0]?.message?.content || "", q.handleCheck);
}

let hasServerKey: boolean | null = null;

async function serverHasKey(): Promise<boolean> {
  if (hasServerKey !== null) return hasServerKey;
  try {
    const res = await fetch("/api/status");
    const data = (await res.json()) as { hasKey?: boolean };
    hasServerKey = Boolean(data.hasKey);
  } catch {
    hasServerKey = false;
  }
  return hasServerKey;
}

export async function requestCoach(input: {
  question: Question;
  metrics: AttemptMetrics;
  attempt: number;
  audio?: Blob;
  audioBase64?: string;
  mime?: string;
  previousTranscript?: string;
}): Promise<{ coach: CoachNote; transcript: string; usedAi: boolean }> {
  let transcript = input.metrics.transcript;
  try {
    if (getApiKey() && wordCount(transcript) < 4 && input.audio) {
      const heard = await xaiTranscribe(input.audio, input.mime || input.audio.type || "audio/webm");
      if (heard) transcript = heard;
    }
    const metrics = { ...input.metrics, transcript };

    const fromXai = await xaiCoach(input.question, metrics, input.attempt, input.previousTranscript);
    if (fromXai) {
      return { usedAi: true, transcript, coach: fromXai };
    }

    const useAi = await serverHasKey();
    if (useAi) {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          audioBase64: input.audioBase64,
          mime: input.mime,
          durationSec: input.metrics.durationSec,
          longPauseCount: input.metrics.longPauseCount,
          longestPauseSec: input.metrics.longestPauseSec,
          fillerCount: input.metrics.fillerCount,
          question: input.question.prompt,
          questionZh: input.question.promptZh,
          attempt: input.attempt,
          previousTranscript: input.previousTranscript,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        transcript?: string;
        coach?: CoachNote;
      };
      if (data.ok && data.coach?.mainIssue && data.coach?.band7) {
        return {
          usedAi: true,
          transcript: data.transcript || transcript,
          coach: {
            ...data.coach,
            handleCheck: data.coach.handleCheck?.length ? data.coach.handleCheck : input.question.handleCheck,
          },
        };
      }
    }
  } catch {
    /* local fallback */
  }

  return {
    usedAi: false,
    transcript,
    coach: localCoach(input.question, { ...input.metrics, transcript }, input.attempt),
  };
}

export function compareText(a: AttemptMetrics, b: AttemptMetrics, handleCheck: string[]): string {
  const words = b.wordCount - a.wordCount;
  const pause = a.longestPauseSec - b.longestPauseSec;
  const used = handleCheck.filter((c) => b.transcript.toLowerCase().includes(c.toLowerCase()));
  const bits = [];
  bits.push(words > 0 ? `后面这遍多了 ${words} 个词` : words < 0 ? "后面这遍更短一点" : "长度差不多");
  if (pause >= 0.3) bits.push(`最长停顿短了 ${pause.toFixed(1)} 秒`);
  if (used.length) bits.push(`用上了 ${used.join(" / ")}`);
  else bits.push("建议的词还没出现，明天还练这个把手");
  return bits.join("；") + "。";
}
