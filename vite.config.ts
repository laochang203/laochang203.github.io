import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function coachPlugin(apiKey: string): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/api/status") {
      sendJson(res, 200, { hasKey: Boolean(apiKey) });
      return;
    }

    if (req.method !== "POST" || req.url !== "/api/coach") {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (!apiKey) {
      sendJson(res, 200, { ok: false, reason: "no_key" });
      return;
    }

    try {
      const body = JSON.parse(await readBody(req)) as {
        transcript?: string;
        audioBase64?: string;
        mime?: string;
        durationSec?: number;
        longPauseCount?: number;
        longestPauseSec?: number;
        fillerCount?: number;
        question?: string;
        questionZh?: string;
        attempt?: number;
        previousTranscript?: string;
      };

      let transcript = (body.transcript || "").trim();

      if (body.audioBase64) {
        const buf = Buffer.from(body.audioBase64, "base64");
        const mime = body.mime || "audio/webm";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : "webm";
        const form = new FormData();
        form.append("filler_words", "true");
        form.append("language", "en");
        form.append("file", new Blob([buf], { type: mime }), `take.${ext}`);
        const stt = await fetch("https://api.x.ai/v1/stt", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
        if (stt.ok) {
          const sttJson = (await stt.json()) as {
            text?: string;
            words?: { text: string; start: number; end: number }[];
          };
          if (sttJson.text) transcript = sttJson.text;
          const words = sttJson.words || [];
          let longPauseCount = 0;
          let longestPauseSec = 0;
          for (let i = 1; i < words.length; i++) {
            const gap = words[i].start - words[i - 1].end;
            if (gap > longestPauseSec) longestPauseSec = gap;
            if (gap >= 0.8) longPauseCount += 1;
          }
          body.longPauseCount = longPauseCount;
          body.longestPauseSec = Number(longestPauseSec.toFixed(2));
        }
      }

      const prompt = `You are an IELTS Speaking coach for a Band 5 Chinese learner aiming toward 7.
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
- Attempt ${body.attempt ?? 1}. Question: ${body.question} (${body.questionZh || ""})
- Duration ${body.durationSec ?? 0}s, long pauses ${body.longPauseCount ?? 0}, longest pause ${body.longestPauseSec ?? 0}s, fillers ${body.fillerCount ?? 0}.
- Transcript: """${transcript || "(empty)"}"""
- Previous transcript if any: """${body.previousTranscript || ""}"""`;

      const chat = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: "You write terse IELTS speaking coaching JSON. No markdown.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!chat.ok) {
        sendJson(res, 200, { ok: false, reason: "llm_error", transcript });
        return;
      }

      const chatJson = (await chat.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = chatJson.choices?.[0]?.message?.content || "";
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      sendJson(res, 200, {
        ok: true,
        transcript,
        longPauseCount: body.longPauseCount,
        longestPauseSec: body.longestPauseSec,
        coach: parsed,
      });
    } catch (error) {
      sendJson(res, 200, {
        ok: false,
        reason: error instanceof Error ? error.message : "error",
      });
    }
  };

  return {
    name: "coach-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        void handler(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        void handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const key = env.XAI_API_KEY || process.env.XAI_API_KEY || "";
  return {
    base: "./",
    plugins: [react(), coachPlugin(key)],
    server: { host: true, port: 5173 },
    preview: { host: true, port: 5173 },
  };
});
