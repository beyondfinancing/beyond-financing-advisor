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
import { CONSENT } from "@/lib/finley-consent";

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
// The front door (owner 2026-10-26): who are you, how do we send your code, consent, then the code (or Duo).
const GATE: Record<Lang, Record<string, string>> = {
  en: { who: "Before we talk, let me know who you are.", iam: "I am a", client: "Client or home buyer", partner: "Business partner (realtor, attorney, title…)", employee: "Beyond Financing employee",
    name: "Full name", email: "Email", phone: "Mobile phone", via: "Send my code by", email_c: "Email", wa: "WhatsApp", text: "Text (soon)", call: "Call (soon)",
    send: "Send my code", duoBtn: "Verify with Duo", codeTitle: "Enter the 6-digit code", sentTo: "We sent it to", onFile: "(your contact on file with us)", verify: "Verify", back: "Back",
    duoTitle: "Approve the Duo push on your phone", duoNum: "Enter this number in Duo Mobile:", duoWait: "Waiting for your approval…",
    e_name: "Please enter your name.", e_email: "Please enter a valid email.", e_phone: "Please enter a 10-digit mobile number.", e_agree: "Please check the box to continue.",
    e_limit: "Too many attempts. Please try again in an hour.", e_send: "We couldn't send the code. Please try the other option.", e_code: "That code doesn't match. Please try again.",
    e_expired: "That code expired. Please start again.", e_tries: "Too many tries. Please start again.", e_employee_email: "Use your @beyondfinancing.com email.",
    e_employee_unknown: "That email isn't a Beyond Financing login.", e_denied: "Duo denied the request.", e_generic: "Something went wrong. Please try again." },
  pt: { who: "Antes de conversarmos, diga quem você é.", iam: "Eu sou", client: "Cliente ou comprador", partner: "Parceiro de negócios (corretor, advogado, título…)", employee: "Funcionário da Beyond Financing",
    name: "Nome completo", email: "E-mail", phone: "Celular", via: "Enviar meu código por", email_c: "E-mail", wa: "WhatsApp", text: "Texto (em breve)", call: "Ligação (em breve)",
    send: "Enviar meu código", duoBtn: "Verificar com Duo", codeTitle: "Digite o código de 6 dígitos", sentTo: "Enviamos para", onFile: "(seu contato cadastrado conosco)", verify: "Verificar", back: "Voltar",
    duoTitle: "Aprove o Duo no seu celular", duoNum: "Digite este número no Duo Mobile:", duoWait: "Aguardando sua aprovação…",
    e_name: "Por favor, digite seu nome.", e_email: "Digite um e-mail válido.", e_phone: "Digite um celular de 10 dígitos.", e_agree: "Marque a caixa para continuar.",
    e_limit: "Muitas tentativas. Tente novamente em uma hora.", e_send: "Não conseguimos enviar o código. Tente a outra opção.", e_code: "O código não confere. Tente novamente.",
    e_expired: "O código expirou. Comece de novo.", e_tries: "Muitas tentativas. Comece de novo.", e_employee_email: "Use seu e-mail @beyondfinancing.com.",
    e_employee_unknown: "Esse e-mail não é um acesso da Beyond Financing.", e_denied: "O Duo recusou o pedido.", e_generic: "Algo deu errado. Tente novamente." },
  es: { who: "Antes de hablar, dígame quién es usted.", iam: "Soy", client: "Cliente o comprador", partner: "Socio de negocios (agente, abogado, título…)", employee: "Empleado de Beyond Financing",
    name: "Nombre completo", email: "Correo electrónico", phone: "Celular", via: "Enviar mi código por", email_c: "Correo", wa: "WhatsApp", text: "Texto (pronto)", call: "Llamada (pronto)",
    send: "Enviar mi código", duoBtn: "Verificar con Duo", codeTitle: "Ingrese el código de 6 dígitos", sentTo: "Lo enviamos a", onFile: "(su contacto registrado con nosotros)", verify: "Verificar", back: "Volver",
    duoTitle: "Apruebe Duo en su teléfono", duoNum: "Ingrese este número en Duo Mobile:", duoWait: "Esperando su aprobación…",
    e_name: "Ingrese su nombre.", e_email: "Ingrese un correo válido.", e_phone: "Ingrese un celular de 10 dígitos.", e_agree: "Marque la casilla para continuar.",
    e_limit: "Demasiados intentos. Inténtelo en una hora.", e_send: "No pudimos enviar el código. Pruebe la otra opción.", e_code: "El código no coincide. Inténtelo de nuevo.",
    e_expired: "El código venció. Empiece de nuevo.", e_tries: "Demasiados intentos. Empiece de nuevo.", e_employee_email: "Use su correo @beyondfinancing.com.",
    e_employee_unknown: "Ese correo no es un acceso de Beyond Financing.", e_denied: "Duo rechazó la solicitud.", e_generic: "Algo salió mal. Inténtelo de nuevo." },
};
type Step = "who" | "code" | "duo" | "chat";
const DETACH: Record<Lang, string> = { en: "Detach", pt: "Destacar", es: "Separar" };
const PASS_KEY = "bf-finley-pass";

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
  const g = GATE[lang];
  const [step, setStep] = useState<Step>("who");
  const [pass, setPass] = useState("");
  const [visitor, setVisitor] = useState("");
  const [role, setRole] = useState<"client" | "partner" | "employee">("client");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [agree, setAgree] = useState(false);
  const [gid, setGid] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [onFile, setOnFile] = useState(false);
  const [code, setCode] = useState("");
  const [duoCode, setDuoCode] = useState("");
  const [gateErr, setGateErr] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [detached, setDetached] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setEmbedded(q.get("embed") === "1");
    const l = q.get("lang");
    if (l === "en" || l === "pt" || l === "es") setLang(l);
    setMicOk(!!makeRecognizer());
    // Detached window (owner 2026-10-26): the pass arrives in the #fragment (never sent to a server), then leaves the URL.
    const h = new URLSearchParams(window.location.hash.slice(1));
    if (h.get("pass")) {
      try { window.sessionStorage.setItem(PASS_KEY, JSON.stringify({ pass: h.get("pass"), name: h.get("name") || "" })); } catch { /* fine */ }
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setDetached(window.name === "finley-detached");
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(PASS_KEY) || "null") as { pass?: string; name?: string } | null;
      if (saved?.pass) { setPass(saved.pass); setVisitor(saved.name || ""); setStep("chat"); }
    } catch { /* storage blocked: they verify again */ }
    const onMsg = (e: MessageEvent) => {
      const v = (e.data as { bfLang?: string } | null)?.bfLang;
      if (v === "en" || v === "pt" || v === "es") setLang(v);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  // Her natural voice (same as the Beyond phone app); the device voice only if that can't be reached.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  async function speak(text: string) {
    try {
      audioRef.current?.pause();
      const r = await fetch("/api/finley-voice", { method: "POST", headers: { "Content-Type": "application/json", "x-finley-pass": pass }, body: JSON.stringify({ text, lang }) });
      if (r.ok) {
        const a = new Audio(URL.createObjectURL(await r.blob()));
        audioRef.current = a;
        await a.play();
        return;
      }
    } catch { /* fall back to the device voice */ }
    speakDevice(text);
  }
  function speakDevice(text: string) {
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

  function gateError(e?: string) { setGateErr(g["e_" + (e || "generic")] || g.e_generic); }
  function admit(p: string, name: string) {
    setPass(p); setVisitor(name); setStep("chat"); setGateErr("");
    try { window.sessionStorage.setItem(PASS_KEY, JSON.stringify({ pass: p, name })); } catch { /* fine */ }
  }
  async function gateCall(body: Record<string, unknown>) {
    const r = await fetch("/api/finley-gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await r.json().catch(() => ({}))) as Record<string, any>;
  }
  async function startGate() {
    if (gateBusy) return;
    if (form.name.trim().length < 2) return gateError("name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return gateError("email");
    if (role !== "employee" && form.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length !== 10) return gateError("phone");
    if (role !== "employee" && !agree) return gateError("agree");
    setGateBusy(true); setGateErr("");
    try {
      const r = await gateCall({ action: "start", role, name: form.name, email: form.email, phone: form.phone, channel, lang, agree });
      if (r.error) return gateError(r.error);
      if (r.pass) return admit(r.pass, r.name || form.name);
      setGid(r.id);
      if (r.duo) { setDuoCode(r.duo.code || ""); setStep("duo"); pollDuo(r.id); return; }
      setSentTo(r.sent_to || ""); setOnFile(!!r.on_file); setCode(""); setStep("code");
    } catch { gateError(); } finally { setGateBusy(false); }
  }
  async function verifyCode() {
    if (gateBusy || code.replace(/\D/g, "").length !== 6) return;
    setGateBusy(true); setGateErr("");
    try {
      const r = await gateCall({ action: "verify", id: gid, code });
      if (r.pass) return admit(r.pass, r.name);
      gateError(r.error);
      if (r.error === "expired" || r.error === "tries") setStep("who");
    } catch { gateError(); } finally { setGateBusy(false); }
  }
  function pollDuo(id: string, n = 0) {
    if (n > 45) { gateError("expired"); setStep("who"); return; }
    setTimeout(async () => {
      try {
        const r = await gateCall({ action: "duo_status", id });
        if (r.pass) return admit(r.pass, r.name);
        if (r.error) { gateError(r.error); setStep("who"); return; }
      } catch { /* keep waiting */ }
      pollDuo(id, n + 1);
    }, 2000);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json", "x-finley-pass": pass },
        body: JSON.stringify({ stage: "quick_question", routing: { language: lang, conversation: next, source: "website-ask" }, messages: next.slice(-12) }),
      });
      if (r.status === 401) {   // pass expired: back to the door
        try { window.sessionStorage.removeItem(PASS_KEY); } catch { /* fine */ }
        setPass(""); setStep("who"); setMsgs(next.slice(0, -1)); setInput(q); return;
      }
      const data = (await r.json().catch(() => ({}))) as { reply?: string; message?: string; text?: string; content?: string };
      const text = (data.reply || data.message || data.text || data.content || "").trim();
      if (!r.ok || !text) throw new Error("no answer");
      setMsgs((m) => [...m, { role: "assistant", content: text }]);
      if (aloud || spokeRef.current) void speak(text);
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
    audioRef.current?.pause();
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

  /** Her own window: stays open after the website (or BIS) is closed. */
  function detach() {
    const url = "/ask?lang=" + lang + "#pass=" + encodeURIComponent(pass) + "&name=" + encodeURIComponent(visitor);
    const w = window.open(url, "finley-detached", "popup,width=440,height=720");
    if (w) w.focus();
  }

  const fullHref = `/borrower?${embedded ? "embed=1&" : ""}lang=${lang}`;

  return (
    <main className="ask-page">
      <style>{CSS}</style>
      {!embedded && (
        <header className="ask-head">
          <img src="/finley-face.jpg?v=2" alt="" style={S.face} />
          <div className="ask-who"><div style={S.title}>{t.title}</div><div style={S.sub}>{t.sub}</div></div>
          <div className="ask-langs">{(["en", "pt", "es"] as Lang[]).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={lang === l ? "on" : ""}>{l === "pt" ? "PT" : l.toUpperCase()}</button>
          ))}</div>
        </header>
      )}

      {step !== "chat" && (
        <div className="ask-gate">
          {step === "who" && (
            <form onSubmit={(e) => { e.preventDefault(); void startGate(); }}>
              <p className="ask-gate-lead">{g.who}</p>
              <label className="ask-f">{g.iam}
                <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  <option value="client">{g.client}</option><option value="partner">{g.partner}</option><option value="employee">{g.employee}</option>
                </select></label>
              <label className="ask-f">{g.name}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
              <label className="ask-f">{g.email}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" inputMode="email" /></label>
              {role !== "employee" && <>
                <label className="ask-f">{g.phone}<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" placeholder="(617) 555-0123" /></label>
                <fieldset className="ask-via"><legend>{g.via}</legend>
                  <label><input type="radio" name="via" checked={channel === "email"} onChange={() => setChannel("email")} /> {g.email_c}</label>
                  <label><input type="radio" name="via" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} /> {g.wa}</label>
                  <label className="off"><input type="radio" name="via" disabled /> {g.text}</label>
                  <label className="off"><input type="radio" name="via" disabled /> {g.call}</label>
                </fieldset>
                <label className="ask-agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{CONSENT[lang]}</span></label>
              </>}
              {gateErr && <p className="ask-err">{gateErr}</p>}
              <button type="submit" className="ask-go" disabled={gateBusy}>{role === "employee" ? g.duoBtn : g.send}</button>
            </form>
          )}
          {step === "code" && (
            <form onSubmit={(e) => { e.preventDefault(); void verifyCode(); }}>
              <p className="ask-gate-lead">{g.codeTitle}</p>
              <p className="ask-small">{g.sentTo} <b>{sentTo}</b> {onFile ? g.onFile : ""}</p>
              <input className="ask-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-label={g.codeTitle} autoFocus />
              {gateErr && <p className="ask-err">{gateErr}</p>}
              <button type="submit" className="ask-go" disabled={gateBusy || code.length !== 6}>{g.verify}</button>
              <button type="button" className="ask-link" onClick={() => { setStep("who"); setGateErr(""); }}>{g.back}</button>
            </form>
          )}
          {step === "duo" && (
            <div>
              <p className="ask-gate-lead">{g.duoTitle}</p>
              {duoCode && <p className="ask-small">{g.duoNum} <b className="ask-duo">{duoCode}</b></p>}
              <p className="ask-small">{g.duoWait}</p>
              {gateErr && <p className="ask-err">{gateErr}</p>}
              <button type="button" className="ask-link" onClick={() => { setStep("who"); setGateErr(""); }}>{g.back}</button>
            </div>
          )}
        </div>
      )}

      {step === "chat" && <>
      <div className="ask-thread" aria-live="polite">
        <div className="ask-bubble a">{visitor ? t.hello.replace(/^(Hi|Oi|¡Hola)!/, "$1, " + visitor.split(" ")[0] + "!") : t.hello}</div>
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
          {!detached && <button type="button" className="ask-link" onClick={detach} title="Keep Finley in her own window">{DETACH[lang]} ⧉</button>}
          <a href={fullHref}>{t.full} →</a>
        </div>
        <p style={S.note}>{t.note}</p>
      </div>
      </>}
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
.ask-gate{flex:1;overflow-y:auto;padding:16px}
.ask-gate form,.ask-gate>div{display:flex;flex-direction:column;gap:12px;max-width:480px;margin:0 auto}
.ask-gate-lead{margin:0;font-size:17px;font-weight:600}
.ask-small{margin:0;font-size:14px;color:#4A5B72}
.ask-f{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:#04182E}
.ask-f input,.ask-f select{height:48px;border:1px solid #AEB9C8;border-radius:10px;padding:0 12px;font-size:16px;background:#fff;color:#04182E;width:100% !important}
.ask-via{border:0;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ask-via legend{font-size:14px;font-weight:600;margin-bottom:6px}
.ask-via label{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid #D3DAE4;border-radius:10px;background:#fff;font-size:15px;cursor:pointer}
.ask-via label.off{color:#8296AE;cursor:default;background:#F3F5F8}
.ask-via input{width:20px !important;height:20px;accent-color:#04182E}
.ask-agree{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;line-height:1.45;color:#4A5B72;padding:10px 12px;border:2px solid #04182E;border-radius:10px;background:#fff;cursor:pointer}
.ask-agree input{width:22px !important;min-width:22px;height:22px;margin-top:2px;accent-color:#04182E}
.ask-go{height:50px;border:0;border-radius:25px;background:#C9A35C;color:#04182E;font-weight:700;font-size:16px;cursor:pointer;width:100% !important}
.ask-go:disabled{opacity:.6}
.ask-link{background:none;border:0;color:#8A6A2E;text-decoration:underline;font-size:14px;cursor:pointer;align-self:center;width:auto !important}
.ask-code{height:56px;font-size:28px;letter-spacing:10px;text-align:center;border:1px solid #AEB9C8;border-radius:12px;width:100% !important}
.ask-duo{font-size:26px;letter-spacing:4px;color:#04182E}
.ask-langs{display:flex;gap:4px}
.ask-langs button{height:32px;min-width:38px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;font-weight:700;font-size:13px;cursor:pointer}
.ask-langs button.on{background:#C9A35C;border-color:#C9A35C;color:#04182E}
`;
