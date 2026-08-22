import { getApiKey } from "./storage";
import type { AttemptMetrics, CoachNote, Light, Question } from "./types";

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function ruleLights(m: AttemptMetrics): CoachNote["lights"] {
  const fluency: Light = m.durationSec < 8 || m.wordCount < 8 ? "red" : m.longestPauseSec >= 1.2 || m.longPauseCount >= 2 ? "yellow" : "green";
  const lexical: Light = m.hasBecause && m.hasExample ? "green" : m.hasBecause || m.hasExample ? "yellow" : "red";
  const grammar: Light = m.sentenceLike >= 2 ? "green" : m.wordCount >= 8 ? "yellow" : "red";
  const pronunciation: Light = m.wordCount === 0 ? "red" : m.wordCount < 8 ? "yellow" : "green";
  return { fluency, lexical, grammar, pronunciation };
}

function rulePronunciation(m: AttemptMetrics): string {
  if (m.wordCount === 0) return "机器没听清词。靠近麦克风，一个词说完再停。";
  if (m.longestPauseSec >= 1.2) return "词中间停太长，听起来像卡在发音上。想到哪个音先说完这个词。";
  return "发音先求能听懂，不要为了快而吞音。";
}

function ruleTraps(m: AttemptMetrics): string[] {
  const traps = [];
  if (!m.hasBecause) traps.push("下一遍必须说出 because，再接一个原因。");
  if (!m.hasExample) traps.push("例子要用 For example + 上周/昨天做过的一件具体事。");
  if (m.longestPauseSec >= 1.2) traps.push("别在句子中间停去想中文。");
  if (traps.length === 0) traps.push("保留 because 和 For example，把例子换成更具体的一件事。");
  return traps.slice(0, 2);
}

function ensureMarkers(note: CoachNote, q: Question, transcript: string): CoachNote {
  let band7 = note.band7.trim();
  const lower = band7.toLowerCase();
  const checks = q.handleCheck.length ? q.handleCheck : ["because", "for example"];
  for (const c of checks) {
    const n = c.toLowerCase();
    if (n === "because" && !/\bbecause\b/.test(lower)) {
      band7 += " I chose this because it fits my real life.";
    }
    if ((n === "for example" || n === "for instance") && !/for example|for instance/.test(lower)) {
      band7 += transcript.trim()
        ? " For example, I can talk about a specific class or day last week."
        : " For example, last week I did this in class.";
    }
    if (n.includes("other hand") && !/on the other hand/.test(lower)) {
      band7 += " On the other hand, you still have to practise alone.";
    }
  }
  let learnLine = (note.learnLine || "").trim();
  const miss = checks.find((c) => !learnLine.toLowerCase().includes(c.toLowerCase()));
  if (miss) {
    const parts = band7.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
    learnLine = parts.find((s) => s.toLowerCase().includes(miss.toLowerCase())) || parts[parts.length - 1] || learnLine;
  }
  return {
    ...note,
    band7,
    learnLine,
    traps: (note.traps || []).filter(Boolean).slice(0, 2),
    pronunciationNote: note.pronunciationNote || "发音先求能听懂，一个词说完再停。",
    lights: note.lights || {
      fluency: "yellow",
      lexical: "yellow",
      grammar: "yellow",
      pronunciation: "yellow",
    },
    handleCheck: note.handleCheck?.length ? note.handleCheck : q.handleCheck,
  };
}

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
  } else if (attempt >= 2) {
    mainIssue = "方向对了，还要再自然一点，别只堆句型。";
    handle = "保留 because，把例子换成你自己上周或昨天做过的事。";
  }

  const strength =
    m.wordCount === 0
      ? "你把录音完成了，这比对着空气空想更重要。"
      : m.sentenceLike >= 2
        ? "已经不只一句，开头能听出你在答题。"
        : "你开口了，机器也录到了，下一步只加长一点。";

  const raw: CoachNote = {
    mainIssue,
    handle,
    handleCheck: q.handleCheck,
    band7: q.band7,
    learnLine: q.band7.split(/(?<=\.)\s+/).find((s) => /for example|because/i.test(s)) || q.shadow,
    strength,
    rangeNote: "这段更接近 5 而不是 7。这不是官方分数，大概可能差一整档。",
    traps: ruleTraps(m),
    pronunciationNote: rulePronunciation(m),
    lights: ruleLights(m),
  };
  return ensureMarkers(raw, q, m.transcript);
}

function coachPrompt(q: Question, m: AttemptMetrics, attempt: number, previousTranscript?: string): string {
  const marks = q.handleCheck.join(", ");
  return `You are an IELTS Speaking coach for a Band 5 Chinese learner aiming toward 7.
Return ONLY JSON with keys:
mainIssue (Chinese, one specific problem),
handle (Chinese, the ONE thing to change next),
handleCheck (array of 1-3 lowercase English phrases that MUST appear, e.g. ["because","for example"]),
band7 (English, 2-4 sentences: SAME life facts as the student; MUST include these markers: ${marks}. Do not invent a new school/job/story),
learnLine (ONE short English sentence from band7 that contains the missing marker, easy to shadow),
strength (Chinese, one concrete good point),
rangeNote (Chinese, wide, e.g. "更接近 5 而不是 7；不是官方分数"),
traps (array of exactly 2 short Chinese warnings for the NEXT takes, e.g. pause mid-word / missing For example),
pronunciationNote (Chinese, one line: what was hard to hear / how to land sounds; not a band score),
lights (object fluency, lexical, grammar, pronunciation each "green"|"yellow"|"red"; never invent 6.5)

Rules:
- Do NOT give a precise band like 6.5.
- Attempt ${attempt}. Question: ${q.prompt} (${q.promptZh})
- Duration ${m.durationSec}s, long pauses ${m.longPauseCount}, longest pause ${m.longestPauseSec}s, fillers ${m.fillerCount}.
- Transcript: """${m.transcript || "(empty)"}"""
- Previous transcript if any: """${previousTranscript || ""}"""
- If attempt is 2, keep the same life facts as the previous transcript.`;
}

function parseCoach(raw: string, q: Question, transcript: string): CoachNote | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as CoachNote;
    if (!parsed.mainIssue || !parsed.band7) return null;
    return ensureMarkers(parsed, q, transcript);
  } catch {
    return null;
  }
}

export async function xaiTranscribe(audio: Blob, mime: string): Promise<string> {
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
  return parseCoach(data.choices?.[0]?.message?.content || "", q, m.transcript);
}

export async function requestCoach(input: {
  question: Question;
  metrics: AttemptMetrics;
  attempt: number;
  audio?: Blob;
  mime?: string;
  previousTranscript?: string;
  allowModel?: boolean;
}): Promise<{ coach: CoachNote; transcript: string; usedAi: boolean }> {
  let transcript = input.metrics.transcript;
  const allowModel = input.allowModel !== false;
  try {
    if (getApiKey() && wordCount(transcript) < 4 && input.audio) {
      const heard = await xaiTranscribe(input.audio, input.mime || input.audio.type || "audio/webm");
      if (heard) transcript = heard;
    }
    const metrics = { ...input.metrics, transcript };

    if (allowModel && wordCount(transcript) >= 4 && input.attempt <= 2) {
      const fromXai = await xaiCoach(input.question, metrics, input.attempt, input.previousTranscript);
      if (fromXai) {
        return { usedAi: true, transcript, coach: fromXai };
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
