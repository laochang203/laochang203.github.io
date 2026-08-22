export function canListen(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listenWhileSpeaking(onText: (text: string) => void): { stop: () => Promise<string> } {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return { stop: async () => "" };

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  let finals = "";
  let interim = "";
  let stopped = false;

  const combined = () => [finals, interim].filter(Boolean).join(" ").trim();
  const emit = () => onText(combined());

  rec.onresult = (event) => {
    interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finals += `${piece} `;
      else interim += piece;
    }
    emit();
  };
  rec.onerror = () => undefined;
  rec.onend = () => {
    if (stopped) return;
    try {
      rec.start();
    } catch {
      /* already running or stopped */
    }
  };

  try {
    rec.start();
  } catch {
    /* Safari sometimes throws if started twice */
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        stopped = true;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve(combined());
        };
        rec.onend = () => finish();
        try {
          rec.stop();
        } catch {
          try {
            rec.abort();
          } catch {
            /* ignore */
          }
          finish();
          return;
        }
        window.setTimeout(finish, 700);
      }),
  };
}
