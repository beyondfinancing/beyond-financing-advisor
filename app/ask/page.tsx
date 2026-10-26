// =============================================================================
// app/ask/page.tsx — "Ask Finley": the quick-question door (2026-10-26).
//
// Owner: "most of the times, they just want to have some questions answered, so lets give them a box for
// questions and a microphone should they click to voice it out and she can voice out to them or type if they
// prefer.... and it must be smartphone friendly as well."
//
// - One question box. Type, or tap the microphone and speak (browser speech recognition, EN/PT/ES).
// - Answers appear as text; when the visitor spoke, or turned on "Read answers aloud", Finley reads them out.
// - Same Finley brain and guardrails as the full intake (/api/chat, stage "quick_question").
// - "Start full pre-qualification" opens the existing /borrower intake for those who want it.
// - ?embed=1 (inside the beyondfinancing.com widget): the widget header owns the language switch and sends
//   { bfLang } by postMessage; ?lang= sets the starting language.
// =============================================================================
"use client";

import React, { useEffect, useRef, useState } from "react";

type Lang = "en" | "pt" | "es";
type Msg = { role: "user" | "assistant"; content: string };

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Ask Finley", sub: "Beyond Financing's AI assistant",
    hello: "Hi! I'm Finley. Ask me anything about buying, refinancing or your mortgage options. Type below, or tap the microphone and talk to me.",
    placeholder: "Type your question…", send: "Send", listening: "Listening… speak now", thinking: "Finley is thinking…",
    mic: "Speak your question", stopMic: "Stop listening", aloud: "Read answers aloud",
    full: "Start a full pre-qualification", note: "Finley is an AI assistant. Answers are general guidance, not a loan approval, rate quote or commitment. A licensed loan officer confirms everything.",
    err: "Sorry, I couldn't answer just now. Please try again in a moment.", noMic: "Voice isn't available in this browser. Please type your question.",
  },
  pt: {
    title: "Pergunte à Finley", sub: "Assistente de IA da Beyond Financing",
    hello: "Oi! Eu sou a Finley. Pergunte o que quiser sobre comprar, refinanciar ou suas opções de financiamento. Escreva abaixo ou toque no microfone e fale comigo.",
    placeholder: "Escreva sua pergunta…", send: "Enviar", listening: "Ouvindo… pode falar", thinking: "A Finley está pensando…",
    mic: "Falar a pergunta", stopMic: "Parar de ouvir", aloud: "Ler as respostas em voz alta",
    full: "Começar a pré-qualificação completa", note: "A Finley é uma assistente de IA. As respostas são orientações gerais, não uma aprovação, cotação de taxa ou compromisso. Um loan officer licenciado confirma tudo.",
    err: "Desculpe, não consegui responder agora. Tente novamente em instantes.", noMic: "A voz não está disponível neste navegador. Por favor, escreva sua pergunta.",
  },
  es: {
    title: "Pregúntele a Finley", sub: "Asistente de IA de Beyond Financing",
    hello: "¡Hola! Soy Finley. Pregúnteme lo que quiera sobre comprar, refinanciar o sus opciones de préstamo. Escriba abajo o toque el micrófono y hábleme.",
    placeholder: "Escriba su pregunta…", send: "Enviar", listening: "Escuchando… hable ahora", thinking: "Finley está pensando…",
    mic: "Decir su pregunta", stopMic: "Dejar de escuchar", aloud: "Leer las respuestas en voz alta",
    full: "Comenzar la precalificación completa", note: "Finley es una asistente de IA. Las respuestas son orientación general, no una aprobación, cotización de tasa ni compromiso. Un oficial de préstamos con licencia confirma todo.",
    err: "Lo siento, no pude responder ahora. Inténtelo de nuevo en un momento.", noMic: "La voz no está disponible en este navegador. Por favor, escriba su pregunta.",
  },
};
const SPEECH_LANG: Record<Lang, string> = { en: "en-US", pt: "pt-BR", es: "es-US" };

// The browser's speech recognition (Chrome, Edge, Safari incl. iPhone) — typed loosely, it isn't in lib.dom.
type Recognizer = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void;
};
function makeRecognizer(): Recognizer | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export default function AskFinleyPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [embedded, setEmbedded] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [aloud, setAloud] = useState(false);
  const [micOk, setMicOk] = useState(true);
  const [error, setError] = useState("");
  const recRef = useRef<Recognizer | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const spokeRef = useRef(false);
  const t = COPY[lang];

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setEmbedded(q.get("embed") === "1");
    const l = q.get("lang");
    if (l === "en" || l === "pt" || l === "es") setLang(l);
    setMicOk(!!makeRecognizer());
    const onMsg = (e: MessageEvent) => {
      const v = (e.data as { bfLang?: string } | null)?.bfLang;
      if (v === "en" || v === "pt" || v === "es") setLang(v);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[lang];
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(SPEECH_LANG[lang].slice(0, 2)) && /female|samantha|luciana|paulina|zira|aria|jenny|francisca/i.test(x.name))
      || window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(SPEECH_LANG[lang].slice(0, 2)));
    if (v) u.voice = v;
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "quick_question", routing: { language: lang, conversation: next, source: "website-ask" }, messages: next.slice(-12) }),
      });
      const data = (await r.json().catch(() => ({}))) as { reply?: string; message?: string; text?: string; content?: string };
      const text = (data.reply || data.message || data.text || data.content || "").trim();
      if (!r.ok || !text) throw new Error("no answer");
      setMsgs((m) => [...m, { role: "assistant", content: text }]);
      if (aloud || spokeRef.current) speak(text);
    } catch {
      setError(t.err);
    } finally {
      setBusy(false); spokeRef.current = false;
    }
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const rec = makeRecognizer();
    if (!rec) { setMicOk(false); setError(t.noMic); return; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    rec.lang = SPEECH_LANG[lang]; rec.interimResults = true; rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) { spokeRef.current = true; void ask(finalText); }
    };
    recRef.current = rec; setListening(true); setError("");
    try { rec.start(); } catch { setListening(false); }
  }

  const fullHref = `/borrower?${embedded ? "embed=1&" : ""}lang=${lang}`;

  return (
    <main className="ask-page">
      <style>{CSS}</style>
      {!embedded && (
        <header className="ask-head">
          <img src="/finley-face.jpg" alt="" style={S.face} />
          <div className="ask-who"><div style={S.title}>{t.title}</div><div style={S.sub}>{t.sub}</div></div>
          <div className="ask-langs">{(["en", "pt", "es"] as Lang[]).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={lang === l ? "on" : ""}>{l === "pt" ? "PT" : l.toUpperCase()}</button>
          ))}</div>
        </header>
      )}

      <div className="ask-thread" aria-live="polite">
        <div className="ask-bubble a">{t.hello}</div>
        {msgs.map((m, i) => <div key={i} className={"ask-bubble " + (m.role === "user" ? "u" : "a")}>{m.content}</div>)}
        {busy && <div className="ask-bubble a ask-dim">{t.thinking}</div>}
        {error && <div className="ask-err">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="ask-bottom">
        <form className="ask-row" onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
          {micOk && (
            <button type="button" className={"ask-mic" + (listening ? " live" : "")} onClick={toggleMic} aria-label={listening ? t.stopMic : t.mic} title={listening ? t.stopMic : t.mic}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>
            </button>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? t.listening : t.placeholder} aria-label={t.placeholder} enterKeyHint="send" />
          <button type="submit" className="ask-send" disabled={busy || !input.trim()}>{t.send}</button>
        </form>
        <div className="ask-tools">
          <label><input type="checkbox" checked={aloud} onChange={(e) => { setAloud(e.target.checked); if (!e.target.checked && "speechSynthesis" in window) window.speechSynthesis.cancel(); }} /> {t.aloud}</label>
          <a href={fullHref}>{t.full} →</a>
        </div>
        <p style={S.note}>{t.note}</p>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  face: { width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #C9A35C" },
  title: { fontSize: 17, fontWeight: 700 },
  sub: { fontSize: 12, color: "#C9D3E0" },
  note: { margin: "8px 0 0", fontSize: 12, lineHeight: 1.45, color: "#56677D" },
};

const CSS = `
/* Layout lives in classes: the site's global mobile layer rewrites any inline display:flex into a column. */
.ask-page{min-height:100dvh;height:100dvh;display:flex;flex-direction:column;background:#F3F5F8;color:#04182E;font-family:'Public Sans','Segoe UI',system-ui,sans-serif}
.ask-head{display:flex;flex-direction:row;align-items:center;gap:12px;padding:12px 16px;padding-top:max(12px,env(safe-area-inset-top));background:#04182E;color:#fff}
.ask-who{flex:1;min-width:0}
.ask-thread{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.ask-bottom{border-top:1px solid #D3DAE4;background:#fff;padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
.ask-row input{width:auto !important;flex:1 1 auto}
.ask-mic,.ask-send,.ask-langs button{width:auto !important}
.ask-bubble{max-width:86%;padding:12px 14px;border-radius:14px;font-size:16px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
.ask-bubble.a{align-self:flex-start;background:#fff;border:1px solid #D3DAE4;border-bottom-left-radius:4px}
.ask-bubble.u{align-self:flex-end;background:#04182E;color:#fff;border-bottom-right-radius:4px}
.ask-dim{color:#56677D;font-style:italic}
.ask-err{align-self:center;color:#A3261E;font-size:14px}
.ask-row{display:flex;flex-direction:row;gap:8px;align-items:center}
.ask-row input{flex:1;min-width:0;height:48px;border:1px solid #AEB9C8;border-radius:24px;padding:0 16px;font-size:16px;color:#04182E;background:#fff}
.ask-row input:focus{outline:2px solid #1F5FA8;outline-offset:1px}
.ask-mic{width:48px;height:48px;flex:0 0 48px;border-radius:50%;border:2px solid #C9A35C;background:#fff;color:#04182E;display:grid;place-items:center;cursor:pointer}
.ask-mic.live{background:#A3261E;border-color:#A3261E;color:#fff;animation:askPulse 1.2s ease-in-out infinite}
@keyframes askPulse{0%,100%{box-shadow:0 0 0 0 rgba(163,38,30,.45)}50%{box-shadow:0 0 0 8px rgba(163,38,30,0)}}
@media (prefers-reduced-motion:reduce){.ask-mic.live{animation:none}}
.ask-send{height:48px;padding:0 18px;border-radius:24px;border:0;background:#C9A35C;color:#04182E;font-weight:700;font-size:15px;cursor:pointer}
.ask-send:disabled{opacity:.5;cursor:default}
.ask-tools{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:14px}
.ask-tools label{display:flex;align-items:center;gap:8px;cursor:pointer}
.ask-tools input{width:20px;height:20px;accent-color:#04182E}
.ask-tools a{color:#8A6A2E;font-weight:600}
.ask-langs{display:flex;gap:4px}
.ask-langs button{height:32px;min-width:38px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;font-weight:700;font-size:13px;cursor:pointer}
.ask-langs button.on{background:#C9A35C;border-color:#C9A35C;color:#04182E}
`;
