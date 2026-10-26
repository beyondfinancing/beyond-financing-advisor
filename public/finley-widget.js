/* Finley on beyondfinancing.com (2026-10-26).
 * Owner: "Lets replace website Finley to our Finley." The old chat on the site was the loanofficer.ai
 * widget, a separate bot with none of our memory, guardrails or consent records. This puts OUR Finley
 * there: the borrower intake + chat at beyondintelligence.io/borrower, which shares the one Finley memory
 * with WhatsApp, the phone line and Beyond AI.
 *
 * Embed (LenderHomePage global footer):  <script src="https://beyondintelligence.io/finley-widget.js" defer></script>
 * The page's language comes from the URL (/portuguese..., /espanol...) or <html lang>.
 * Nothing is stored on the visitor's device; consent is asked inside Finley, never pre-ticked here. */
(function () {
  if (window.__bfFinleyWidget) return;
  window.__bfFinleyWidget = true;
  var ORIGIN = "https://beyondintelligence.io";

  var path = (location.pathname || "").toLowerCase(), htmlLang = (document.documentElement.lang || "").toLowerCase();
  var lang = /portugu|brasil|financiamento|\/pt/.test(path) || htmlLang.indexOf("pt") === 0 ? "pt"
    : /espa[nñ]ol|prestamos|\/es/.test(path) || htmlLang.indexOf("es") === 0 ? "es" : "en";
  var T = {
    en: { open: "Talk to Finley", hi: "Hi, I'm Finley!", ask: "Questions about a home loan? Ask me.", sub: "Beyond Financing's AI assistant", close: "Close", reach: "How Finley may reach me" },
    pt: { open: "Fale com a Finley", hi: "Oi, eu sou a Finley!", ask: "Dúvidas sobre financiamento? Pergunte.", sub: "Assistente de IA da Beyond Financing", close: "Fechar", reach: "Como a Finley pode me contatar" },
    es: { open: "Hable con Finley", hi: "¡Hola, soy Finley!", ask: "¿Preguntas sobre su préstamo? Pregúnteme.", sub: "Asistente de IA de Beyond Financing", close: "Cerrar", reach: "Cómo Finley puede contactarme" },
  }[lang];

  var FACE = ORIGIN + "/finley-face.jpg?v=2";
  var css = ""
    // Owner 2026-10-26: on the LEFT (the BBB seal and accessibility button live on the right), a large, likeable face.
    + "#bf-finley-btn{position:fixed;left:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:12px;padding:0;border:0;background:transparent;cursor:pointer;font-family:'Public Sans','Segoe UI',system-ui,sans-serif}"
    + "#bf-finley-btn img{width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #C9A35C;box-shadow:0 6px 22px rgba(4,24,46,.35);background:#04182E;transition:transform .2s ease}"
    + "#bf-finley-btn:hover img{transform:scale(1.05)}#bf-finley-btn:focus-visible{outline:none}#bf-finley-btn:focus-visible img{outline:3px solid #1F5FA8;outline-offset:3px}"
    + "#bf-finley-btn .dot{position:absolute;left:66px;bottom:6px;width:16px;height:16px;border-radius:50%;background:#2E9E5B;border:3px solid #fff}"
    + "#bf-finley-btn .bub{background:#fff;color:#04182E;border:1px solid #D3DAE4;border-radius:14px 14px 14px 4px;padding:10px 14px;box-shadow:0 6px 20px rgba(4,24,46,.18);text-align:left;max-width:220px}"
    + "#bf-finley-btn .bub b{display:block;font-size:15px;font-weight:700}#bf-finley-btn .bub span{display:block;font-size:13px;color:#4A5B72;margin-top:2px}"
    + "#bf-finley-panel{position:fixed;left:20px;bottom:116px;z-index:2147483001;width:440px;height:min(720px,calc(100vh - 140px));"
    + "background:#fff;border:1px solid #D3DAE4;border-radius:12px;box-shadow:0 16px 48px rgba(4,24,46,.25);display:none;flex-direction:column;overflow:hidden}"
    + "#bf-finley-panel.open{display:flex}"
    + "#bf-finley-head{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#04182E;color:#fff;font-family:'Public Sans','Segoe UI',system-ui,sans-serif}"
    + "#bf-finley-head img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #C9A35C}"
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
    + "#bf-finley-btn img{width:68px;height:68px}#bf-finley-btn .dot{left:52px}#bf-finley-btn .bub{max-width:170px;padding:8px 12px}#bf-finley-btn .bub span{display:none}}";

  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; }

  function mount() {
    document.head.appendChild(el("style", {}, css));
    var btn = el("button", { id: "bf-finley-btn", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": T.open },
      "<img src='" + FACE + "' alt=''><i class='dot'></i><span class='bub'><b>" + T.hi + "</b><span>" + T.ask + "</span></span>");
    var panel = el("div", { id: "bf-finley-panel", role: "dialog", "aria-label": "Finley" },
      "<div id='bf-finley-head'><img src='" + FACE + "' alt=''><div class='who'><b>Finley</b><span>" + T.sub + "</span></div>"
      + "<div class='langs' role='group' aria-label='Language'><button type='button' data-l='en'>EN</button><button type='button' data-l='pt'>PT</button><button type='button' data-l='es'>ES</button></div>"
      + "<button type='button' class='x'>" + T.close + "</button></div>"
      + "<div id='bf-finley-frame'></div>"
      + "<div id='bf-finley-foot'><a href='https://link.beyondfinancing.com/consent' target='_blank' rel='noopener'>" + T.reach + "</a></div>");
    document.body.appendChild(panel);
    document.body.appendChild(btn);
    var loaded = false;
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
    btn.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
    panel.querySelector("#bf-finley-head .x").addEventListener("click", function () { setOpen(false); btn.focus(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) setOpen(false); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
