export function canListen(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listenWhileSpeaking(onText: (finalText: string, interim: string) => void): { stop: () => void } {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return { stop: () => undefined };

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  let finals = "";

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finals += `${piece} `;
      else interim += piece;
    }
    onText(finals.trim(), interim.trim());
  };
  rec.onerror = () => undefined;
  rec.onend = () => {
    try {
      rec.start();
    } catch {
      /* stopped on purpose */
    }
  };

  try {
    rec.start();
  } catch {
    /* Safari sometimes throws if started twice */
  }

  return {
    stop: () => {
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        rec.abort();
      }
    },
  };
}
