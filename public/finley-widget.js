/* Finley on beyondfinancing.com (2026-10-26).
 * Owner: "Lets replace website Finley to our Finley." The old chat on the site was the loanofficer.ai
 * widget, a separate bot with none of our memory, guardrails or consent records. This puts OUR Finley
 * there: the borrower intake + chat at beyondintelligence.io/borrower, which shares the one Finley memory
 * with WhatsApp, the phone line and Beyond AI.
 *
 * Embed (LenderHomePage global footer):  <script src="https://beyondintelligence.io/finley-widget.js" defer></script>
 * The page's language comes from the URL (/portuguese..., /espanol...) or <html lang>.
 * Only a session flag (cleared when the tab closes) remembers that Finley already greeted this visit; consent is never pre-ticked:
 * the visitor's own tap on "Yes, call me now" under the full consent text is the consent (logged by bf-landing). */
(function () {
  if (window.__bfFinleyWidget) return;
  window.__bfFinleyWidget = true;
  var ORIGIN = "https://beyondintelligence.io";

  var path = (location.pathname || "").toLowerCase(), htmlLang = (document.documentElement.lang || "").toLowerCase();
  var lang = /portugu|brasil|financiamento|\/pt/.test(path) || htmlLang.indexOf("pt") === 0 ? "pt"
    : /espa[nñ]ol|prestamos|\/es/.test(path) || htmlLang.indexOf("es") === 0 ? "es" : "en";
  var T = {
    en: { open: "Talk to Finley", hi: "Hi, I'm Finley!", ask: "Tap my photo for a live video, or here to chat.", live: "Live video with Finley", sub: "Beyond Financing's AI assistant", close: "Close", reach: "How Finley may reach me" },
    pt: { open: "Fale com a Finley", hi: "Oi, eu sou a Finley!", ask: "Toque na minha foto para vídeo ao vivo, ou aqui para conversar.", live: "Vídeo ao vivo com a Finley", sub: "Assistente de IA da Beyond Financing", close: "Fechar", reach: "Como a Finley pode me contatar" },
    es: { open: "Hable con Finley", hi: "¡Hola, soy Finley!", ask: "Toque mi foto para video en vivo, o aquí para chatear.", live: "Video en vivo con Finley", sub: "Asistente de IA de Beyond Financing", close: "Cerrar", reach: "Cómo Finley puede contactarme" },
  }[lang];

  // FINLEY ON DEMAND (owner 2026-11-18): "Finley on the website introduces herself when someone comes in ... offers to speak over
  // the phone ... they either tell her by voice or type to have her calling them ... and she can keep them company during the
  // application while she stays on the phone with them in their language." Goal: the application, gently, never pushy.
  // The consent text is the owner-approved website wording (same as bf-landing CONSENT); the tap is the consent, logged server-side.
  var G = {
    en: { h: "Hi, I'm Finley 👋", p: "Beyond Financing's AI assistant. Questions about buying or refinancing? I can call you right now, and if you like, stay on the phone with you while you fill out your application, in English, Português or Español.",
      call: "📞 Call me now", live: "🎥 Talk live", chat: "💬 Type to me", name: "Your name", phone: "Mobile phone", go: "Yes, call me now", back: "Back",
      pre: "By tapping the button, I agree: ", bad: "Please type your name and a 10-digit US mobile number.", err: "Something went wrong. Please call (857) 380-7618.",
      now: "Thank you! Finley is calling you now at ", next: "Thank you! Finley calls Monday to Saturday, 9 AM to 7 PM Eastern. She'll call you at the start of her next calling hours at ",
      consent: "I agree that Beyond Financing, Inc. (NMLS #2394496), its loan officers, its AI assistant Finley and its other AI agents may contact me at the phone number and email above about my inquiry, my mortgage application and loan status, updates, mortgage options, rate alerts, and advertising, marketing and promotional offers. Contact may be by phone call, text message (SMS/MMS), WhatsApp or email, including telemarketing. It may use automated technology, an autodialer, prerecorded messages, or artificial or AI-generated voice, and calls may be recorded. My consent is not a condition of any purchase or loan. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. I can take back my consent at any time by any reasonable means. See our Privacy Policy and Terms." },
    pt: { h: "Oi, eu sou a Finley 👋", p: "Assistente de IA da Beyond Financing. Dúvidas sobre comprar ou refinanciar? Posso ligar para você agora e, se quiser, ficar no telefone com você enquanto preenche a sua aplicação, em português, inglês ou espanhol.",
      call: "📞 Me ligue agora", live: "🎥 Falar ao vivo", chat: "💬 Escrever", name: "Seu nome", phone: "Celular", go: "Sim, me ligue agora", back: "Voltar",
      pre: "Ao tocar no botão, eu concordo: ", bad: "Digite seu nome e um celular americano de 10 dígitos.", err: "Algo deu errado. Ligue para (857) 380-7618.",
      now: "Obrigado! A Finley está ligando para você agora no ", next: "Obrigado! A Finley liga de segunda a sábado, das 9h às 19h (horário de Boston). Ela vai ligar no início do próximo horário para o ",
      consent: "Autorizo a Beyond Financing, Inc. (NMLS #2394496), seus loan officers, sua assistente de IA Finley e seus demais agentes de IA a entrarem em contato comigo pelo telefone e e-mail acima sobre minha consulta, meu pedido de financiamento e o status do meu empréstimo, atualizações, opções de financiamento, alertas de taxas e ofertas de publicidade, marketing e promoções. O contato pode ser por ligação, mensagem de texto (SMS/MMS), WhatsApp ou e-mail, incluindo telemarketing. Pode usar tecnologia automatizada, discador automático, mensagens pré-gravadas ou voz artificial/gerada por IA, e as ligações podem ser gravadas. Meu consentimento não é condição para nenhuma compra ou empréstimo. A frequência das mensagens varia. Tarifas de mensagens e dados podem ser cobradas. Responda STOP para cancelar ou HELP para ajuda. Posso revogar meu consentimento a qualquer momento, por qualquer meio razoável. Veja nossa Política de Privacidade e Termos." },
    es: { h: "¡Hola, soy Finley 👋", p: "Asistente de IA de Beyond Financing. ¿Preguntas sobre comprar o refinanciar? Puedo llamarle ahora mismo y, si quiere, quedarme al teléfono con usted mientras llena su solicitud, en español, inglés o portugués.",
      call: "📞 Llámeme ahora", live: "🎥 Hablar en vivo", chat: "💬 Escribir", name: "Su nombre", phone: "Celular", go: "Sí, llámeme ahora", back: "Volver",
      pre: "Al tocar el botón, acepto: ", bad: "Escriba su nombre y un celular de EE. UU. de 10 dígitos.", err: "Algo salió mal. Llame al (857) 380-7618.",
      now: "¡Gracias! Finley le está llamando ahora al ", next: "¡Gracias! Finley llama de lunes a sábado, de 9 AM a 7 PM (hora del Este). Le llamará al inicio de su próximo horario al ",
      consent: "Autorizo a Beyond Financing, Inc. (NMLS #2394496), a sus oficiales de préstamos, a su asistente de IA Finley y a sus demás agentes de IA a comunicarse conmigo al teléfono y correo electrónico indicados arriba sobre mi consulta, mi solicitud de hipoteca y el estado de mi préstamo, actualizaciones, opciones hipotecarias, alertas de tasas y ofertas de publicidad, mercadeo y promociones. El contacto puede ser por llamada, mensaje de texto (SMS/MMS), WhatsApp o correo electrónico, incluido el telemercadeo. Puede usar tecnología automatizada, marcador automático, mensajes pregrabados o voz artificial o generada por IA, y las llamadas pueden grabarse. Mi consentimiento no es condición para ninguna compra o préstamo. La frecuencia de los mensajes varía. Pueden aplicarse tarifas de mensajes y datos. Responda STOP para cancelar o HELP para obtener ayuda. Puedo retirar mi consentimiento en cualquier momento por cualquier medio razonable. Consulte nuestra Política de Privacidad y Términos." }
  };
  var FN = "https://snqbznqhenomgdoqqbms.supabase.co/functions/v1/bf-landing";
  // On a loan officer's own page (/loan-officer/<name>), Finley is THAT loan officer's assistant (owner 2026-11-18) and the
  // call request goes to them (bf-landing matches the slug to the licensed loan officer). New hires work automatically.
  var loSlugM = path.match(/^\/loan-officer\/([a-z0-9-]+)/), loSlug = loSlugM ? loSlugM[1] : "";
  var loWho = loSlug ? loSlug.split("-").filter(Boolean).map(function (w) { return w.length === 1 ? w.toUpperCase() + "." : w.charAt(0).toUpperCase() + w.slice(1); }).join(" ") : "";
  if (loWho) {
    G.en.p = G.en.p.replace("Beyond Financing's AI assistant.", loWho + "'s AI assistant at Beyond Financing.");
    G.pt.p = G.pt.p.replace("Assistente de IA da Beyond Financing.", "Assistente de IA de " + loWho + " na Beyond Financing.");
    G.es.p = G.es.p.replace("Asistente de IA de Beyond Financing.", "Asistente de IA de " + loWho + " en Beyond Financing.");
  }

  // Owner 2026-11-17: clicking HER (the photo) opens the live video page (Tavus); the speech bubble still opens the text chat.
  var LIVE = "https://br.beyondfinancing.com/apply?lang=";
  var FACE = ORIGIN + "/finley-face.jpg?v=4";
  var VID_IDLE = ORIGIN + "/finley-idle.mp4", VID_TALK = ORIGIN + "/finley-talk.mp4";
  function faceHtml(size) {
    return "<span class='bf-face' data-state='idle'><img src='" + FACE + "' alt='' style='width:" + size + "px;height:" + size + "px'>"
      + "<video muted loop playsinline preload='auto' aria-hidden='true'></video></span>";
  }
  var css = ""
    // Owner 2026-10-26: on the LEFT (the BBB seal and accessibility button live on the right), a large, likeable face.
    + "#bf-finley-btn{position:fixed;left:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:12px;padding:0;border:0;background:transparent;cursor:pointer;font-family:'Public Sans','Segoe UI',system-ui,sans-serif}"
    + "#bf-finley-btn img{width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #C9A35C;box-shadow:0 6px 22px rgba(4,24,46,.35);background:#04182E;transition:transform .2s ease}"
    + "#bf-finley-btn:hover img{transform:scale(1.05)}#bf-finley-btn:focus-visible{outline:none}#bf-finley-btn:focus-visible img{outline:3px solid #1F5FA8;outline-offset:3px}"
    // FINLEY ALIVE (owner 2026-10-26, "a speaking Finley experience" — option A, then B video loops):
    // idle = she breathes with a soft gold glow; listening = green pulse; thinking = a gold arc circles her;
    // speaking = her ring moves with her voice. Talking/idle video loops (finley-idle.mp4 / finley-talk.mp4)
    // replace the photo automatically once they exist. Reduced-motion users get the still photo.
    + "@keyframes bfBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}"
    + "@keyframes bfGlow{0%,100%{box-shadow:0 0 0 0 rgba(201,163,92,.55),0 6px 22px rgba(4,24,46,.35)}50%{box-shadow:0 0 0 9px rgba(201,163,92,0),0 6px 22px rgba(4,24,46,.35)}}"
    + "@keyframes bfTalk{0%,100%{box-shadow:0 0 0 2px rgba(201,163,92,.9)}25%{box-shadow:0 0 0 7px rgba(201,163,92,.45)}50%{box-shadow:0 0 0 3px rgba(201,163,92,.8)}75%{box-shadow:0 0 0 9px rgba(201,163,92,.3)}}"
    + "@keyframes bfListen{0%,100%{box-shadow:0 0 0 0 rgba(46,158,91,.65)}50%{box-shadow:0 0 0 11px rgba(46,158,91,0)}}"
    + "@keyframes bfSpin{to{transform:rotate(360deg)}}"
    + ".bf-face{position:relative;display:inline-block;border-radius:50%;line-height:0}"
    + ".bf-face img,.bf-face video{border-radius:50%;object-fit:cover;display:block}"
    + ".bf-face video{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .3s}.bf-face.vid video{opacity:1}"
    + ".bf-face[data-state=idle] img,.bf-face[data-state=idle] video{animation:bfBreath 4.5s ease-in-out infinite,bfGlow 4.5s ease-in-out infinite}"
    + ".bf-face[data-state=speaking] img,.bf-face[data-state=speaking] video{animation:bfTalk .9s ease-in-out infinite}"
    + ".bf-face[data-state=listening] img,.bf-face[data-state=listening] video{animation:bfListen 1.2s ease-out infinite}"
    + ".bf-face[data-state=thinking]::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:3px solid transparent;border-top-color:#C9A35C;border-right-color:#C9A35C;animation:bfSpin 1s linear infinite}"
    + "@media (prefers-reduced-motion:reduce){.bf-face img,.bf-face video,.bf-face::after{animation:none!important}.bf-face video{display:none}}"
    + "#bf-finley-btn .dot{position:absolute;left:66px;bottom:6px;width:16px;height:16px;border-radius:50%;background:#2E9E5B;border:3px solid #fff}"
    + "#bf-finley-btn .bub{background:#fff;color:#04182E;border:1px solid #D3DAE4;border-radius:14px 14px 14px 4px;padding:10px 14px;box-shadow:0 6px 20px rgba(4,24,46,.18);text-align:left;max-width:220px}"
    + "#bf-finley-btn .bub b{display:block;font-size:15px;font-weight:700}#bf-finley-btn .bub span{display:block;font-size:13px;color:#4A5B72;margin-top:2px}"
    + "#bf-finley-panel{position:fixed;left:20px;bottom:116px;z-index:2147483001;width:440px;height:min(720px,calc(100vh - 140px));"
    + "background:#fff;border:1px solid #D3DAE4;border-radius:12px;box-shadow:0 16px 48px rgba(4,24,46,.25);display:none;flex-direction:column;overflow:hidden}"
    + "#bf-finley-panel.open{display:flex}"
    + "#bf-finley-head{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#04182E;color:#fff;font-family:'Public Sans','Segoe UI',system-ui,sans-serif}"
    + "#bf-finley-head img,#bf-finley-head video{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #C9A35C}#bf-finley-btn video{border:3px solid #C9A35C;box-sizing:border-box}"
    + "#bf-finley-head b{font-size:16px;font-weight:600;display:block}#bf-finley-head span{font-size:12px;color:#C9D3E0}"
    + "#bf-finley-head .who{min-width:0;flex:1}"
    + "#bf-finley-head .langs{display:flex;gap:4px}#bf-finley-head .langs button{margin:0;min-width:36px;padding:0 8px}"
    + "#bf-finley-head .langs button[aria-pressed=true]{background:#C9A35C;border-color:#C9A35C;color:#04182E}"
    + "#bf-finley-head button{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:8px;height:32px;padding:0 12px;cursor:pointer;font:600 13px 'Public Sans','Segoe UI',sans-serif}"
    + "#bf-finley-panel iframe{flex:1;border:0;width:100%}"
    + "#bf-finley-foot{padding:8px 14px;border-top:1px solid #D3DAE4;font:13px 'Public Sans','Segoe UI',sans-serif;background:#F3F5F8}"
    + "#bf-finley-foot a{color:#8A6A2E;text-decoration:underline}"
    + "@media (max-width:600px){#bf-finley-panel{left:0;bottom:0;width:100%;height:100%;border-radius:0;border:0}"
    + "#bf-finley-head{padding-top:max(12px,env(safe-area-inset-top))}#bf-finley-head .who span{display:none}#bf-finley-btn{left:12px;bottom:max(12px,env(safe-area-inset-bottom))}"
    + "#bf-finley-btn .bf-face img{width:68px!important;height:68px!important}#bf-finley-btn .dot{left:52px}#bf-finley-btn .bub{max-width:170px;padding:8px 12px}#bf-finley-btn .bub span{display:block;font-size:12px}}"
    // FINLEY ON DEMAND greeter card (owner 2026-11-18): she introduces herself and offers to call the visitor now.
    + "#bf-finley-greet{position:fixed;left:20px;bottom:120px;z-index:2147483002;width:360px;max-width:calc(100vw - 32px);background:#fff;color:#04182E;border:1px solid #D3DAE4;border-radius:14px;"
    + "box-shadow:0 16px 44px rgba(4,24,46,.28);font-family:'Public Sans','Segoe UI',system-ui,sans-serif;padding:16px 16px 14px;display:none;opacity:0;transform:translateY(8px);transition:opacity .25s ease,transform .25s ease}"
    + "#bf-finley-greet.show{display:block}#bf-finley-greet.in{opacity:1;transform:none}"
    + "#bf-finley-greet .x{position:absolute;right:8px;top:6px;border:0;background:transparent;font-size:22px;line-height:1;color:#6B7A90;cursor:pointer;padding:6px}"
    + "#bf-finley-greet h3{margin:0 24px 4px 0;font-size:17px;font-weight:700}#bf-finley-greet p{margin:0 0 12px;font-size:14px;line-height:1.45;color:#33445C}"
    + "#bf-finley-greet .acts{display:flex;flex-direction:column;gap:8px}"
    + "#bf-finley-greet .acts button{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:10px;font:600 15px 'Public Sans','Segoe UI',sans-serif;cursor:pointer;border:1px solid #D3DAE4;background:#fff;color:#04182E}"
    + "#bf-finley-greet .acts button.call{background:#C9A35C;border-color:#C9A35C;color:#04182E}#bf-finley-greet .acts .row{display:flex;gap:8px}#bf-finley-greet .acts .row button{flex:1}"
    + "#bf-finley-greet form{display:none;flex-direction:column;gap:8px}#bf-finley-greet.form form{display:flex}#bf-finley-greet.form .acts{display:none}"
    + "#bf-finley-greet label{font-size:13px;font-weight:600}#bf-finley-greet input[type=text],#bf-finley-greet input[type=tel]{height:42px;border:1px solid #C3CCD8;border-radius:8px;padding:0 10px;font:15px 'Public Sans','Segoe UI',sans-serif}"
    + "#bf-finley-greet .consent{font-size:11px;line-height:1.4;color:#5A6A80;max-height:92px;overflow:auto;border:1px solid #E3E8EF;border-radius:8px;padding:6px 8px;background:#F7F9FC}"
    + "#bf-finley-greet .hp{position:absolute;left:-9999px}#bf-finley-greet .msg{font-size:14px;min-height:0}#bf-finley-greet .msg.err{color:#B3261E}"
    + "@media (max-width:600px){#bf-finley-greet{left:16px;right:16px;width:auto;bottom:104px}}"
    + "@media (prefers-reduced-motion:reduce){#bf-finley-greet{transition:none}}";

  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; }

  function mount() {
    document.head.appendChild(el("style", {}, css));
    var btn = el("button", { id: "bf-finley-btn", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": T.open },
      faceHtml(84) + "<i class='dot'></i><span class='bub'><b>" + T.hi + "</b><span>" + T.ask + "</span></span>");
    var panel = el("div", { id: "bf-finley-panel", role: "dialog", "aria-label": "Finley" },
      "<div id='bf-finley-head'>" + faceHtml(40) + "<div class='who'><b>Finley</b><span>" + T.sub + "</span></div>"
      + "<div class='langs' role='group' aria-label='Language'><button type='button' data-l='en'>EN</button><button type='button' data-l='pt'>PT</button><button type='button' data-l='es'>ES</button></div>"
      + "<button type='button' class='x'>" + T.close + "</button></div>"
      + "<div id='bf-finley-frame'></div>"
      + "<div id='bf-finley-foot'><a href='https://link.beyondfinancing.com/consent' target='_blank' rel='noopener'>" + T.reach + "</a></div>");
    document.body.appendChild(panel);
    document.body.appendChild(btn);
    var loaded = false;
    /* Finley's state, from the Ask Finley page inside the panel (postMessage {bfState}). */
    var faces = [].slice.call(document.querySelectorAll(".bf-face"));
    var talkOk = false;
    faces.forEach(function (f) {
      var v = f.querySelector("video");
      if (!v || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
      v.addEventListener("loadeddata", function () { f.classList.add("vid"); v.play().catch(function () {}); });
      v.src = VID_IDLE;   // a missing video simply leaves her photo in place
    });
    var probe = document.createElement("video"); probe.preload = "metadata"; probe.muted = true;
    probe.addEventListener("loadedmetadata", function () { talkOk = true; }); probe.src = VID_TALK;
    function setState(st) {
      faces.forEach(function (f) {
        f.setAttribute("data-state", st);
        var v = f.querySelector("video");
        if (v && f.classList.contains("vid") && talkOk) {
          var want = st === "speaking" ? VID_TALK : VID_IDLE;
          if (v.src.indexOf(want) < 0) { v.src = want; v.play().catch(function () {}); }
        }
      });
    }
    window.addEventListener("message", function (e) {
      if (e.origin !== ORIGIN || !e.data || typeof e.data.bfState !== "string") return;
      if (/^(idle|listening|thinking|speaking)$/.test(e.data.bfState)) setState(e.data.bfState);
    });

    function setOpen(open) {
      if (open && !loaded) {
        // Loaded on first open only, so the website itself stays as fast as before.
        panel.querySelector("#bf-finley-frame").outerHTML = "<iframe title='Finley' src='" + ORIGIN + "/ask?embed=1&lang=" + lang + "' allow='clipboard-write; microphone; autoplay'></iframe>";
        loaded = true;
      }
      panel.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.style.display = open && window.innerWidth <= 600 ? "none" : "";
      var bub = btn.querySelector(".bub"); if (bub) bub.style.display = open ? "none" : "";
    }
    // EN / PT / ES in the panel header (owner 2026-10-26): switches the conversation's language in place.
    function paintLang() { Array.prototype.forEach.call(panel.querySelectorAll(".langs button"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-l") === lang)); }); }
    Array.prototype.forEach.call(panel.querySelectorAll(".langs button"), function (b) {
      b.addEventListener("click", function () {
        lang = b.getAttribute("data-l"); paintLang();
        var f = panel.querySelector("iframe"); if (f && f.contentWindow) f.contentWindow.postMessage({ bfLang: lang }, ORIGIN);
      });
    });
    paintLang();
    var face = btn.querySelector(".bf-face"); if (face) { face.setAttribute("title", T.live); }
    btn.addEventListener("click", function (e) {
      var gc = document.getElementById("bf-finley-greet"); if (gc && gc.classList.contains("show")) { gc.classList.remove("in"); gc.classList.remove("show"); try { sessionStorage.setItem("bfFinleyGreet", "1"); } catch (x) {} }
      if (e.target && e.target.closest && e.target.closest(".bf-face") && !panel.classList.contains("open")) {
        window.open(LIVE + lang, "_blank", "noopener"); return;
      }
      setOpen(!panel.classList.contains("open"));
    });
    panel.querySelector("#bf-finley-head .x").addEventListener("click", function () { setOpen(false); btn.focus(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) setOpen(false); });

    /* ---------- FINLEY ON DEMAND: greeter card ---------- */
    var g = G[lang];
    var card = el("div", { id: "bf-finley-greet", role: "dialog", "aria-label": "Finley" },
      "<button type='button' class='x' aria-label='" + T.close + "'>×</button><h3>" + g.h + "</h3><p>" + g.p + "</p>"
      + "<div class='acts'><button type='button' class='call'>" + g.call + "</button><div class='row'><button type='button' class='live'>" + g.live + "</button><button type='button' class='chat'>" + g.chat + "</button></div></div>"
      + "<form novalidate><label for='bf-g-name'>" + g.name + "</label><input id='bf-g-name' type='text' autocomplete='name' maxlength='120'>"
      + "<label for='bf-g-phone'>" + g.phone + "</label><input id='bf-g-phone' type='tel' inputmode='tel' autocomplete='tel-national' maxlength='20'>"
      + "<input class='hp' type='text' name='website' tabindex='-1' autocomplete='off' aria-hidden='true'>"
      + "<div class='consent'>" + g.pre + g.consent + "</div>"
      + "<div class='acts' style='display:flex'><button type='submit' class='call'>" + g.go + "</button><button type='button' class='back'>" + g.back + "</button></div>"
      + "<div class='msg' role='status' aria-live='polite'></div></form>");
    document.body.appendChild(card);
    function showCard() {
      if (panel.classList.contains("open")) return;
      var bb = btn.querySelector(".bub"); if (bb) bb.style.visibility = "hidden";
      card.classList.add("show"); requestAnimationFrame(function () { card.classList.add("in"); });
    }
    function hideCard() { card.classList.remove("in"); card.classList.remove("show"); var bb = btn.querySelector(".bub"); if (bb) bb.style.visibility = ""; try { sessionStorage.setItem("bfFinleyGreet", "1"); } catch (e) {} }
    card.querySelector(".x").addEventListener("click", hideCard);
    card.querySelector(".live").addEventListener("click", function () { hideCard(); window.open(LIVE + lang, "_blank", "noopener"); });
    card.querySelector(".chat").addEventListener("click", function () { hideCard(); setOpen(true); });
    card.querySelector(".call").addEventListener("click", function () { card.classList.add("form"); var n = card.querySelector("#bf-g-name"); if (n) n.focus(); });
    card.querySelector("form .back").addEventListener("click", function () { card.classList.remove("form"); });
    var sent = false;
    card.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault(); if (sent) return;
      var msg = card.querySelector(".msg"), go = card.querySelector("form button[type=submit]");
      var name = card.querySelector("#bf-g-name").value.trim();
      var digits = card.querySelector("#bf-g-phone").value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (!name || digits.length !== 10) { msg.className = "msg err"; msg.textContent = g.bad; return; }
      go.disabled = true; msg.className = "msg"; msg.textContent = "…";
      fetch(FN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finley_live", door: "website", name: name, phone: digits, lang: lang, consent: true,
        website: card.querySelector(".hp").value, page: location.pathname.slice(0, 120), lo_slug: loSlug }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) throw new Error("x");
          sent = true;
          var pretty = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
          msg.className = "msg"; msg.textContent = "✓ " + (j.calling === "next" ? g.next : g.now) + pretty + ".";
          go.textContent = "✓";
          try { sessionStorage.setItem("bfFinleyGreet", "1"); } catch (x) {}
        })
        .catch(function () { go.disabled = false; msg.className = "msg err"; msg.textContent = g.err; });
    });
    // Once per visit (session only; nothing stays on the device after the tab closes), a few seconds after arrival.
    var seen = false; try { seen = sessionStorage.getItem("bfFinleyGreet") === "1"; } catch (e) {}
    if (!seen) setTimeout(showCard, 4000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
