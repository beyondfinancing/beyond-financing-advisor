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
    en: { open: "Talk to Finley", sub: "Beyond Financing's AI assistant", close: "Close", reach: "How Finley may reach me" },
    pt: { open: "Fale com a Finley", sub: "Assistente de IA da Beyond Financing", close: "Fechar", reach: "Como a Finley pode me contatar" },
    es: { open: "Hable con Finley", sub: "Asistente de IA de Beyond Financing", close: "Cerrar", reach: "Cómo Finley puede contactarme" },
  }[lang];

  var css = ""
    + "#bf-finley-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;"
    + "height:52px;padding:0 20px 0 16px;border:0;border-radius:26px;background:#04182E;color:#fff;cursor:pointer;"
    + "font:600 15px/1 'Public Sans','Segoe UI',system-ui,sans-serif;box-shadow:0 6px 20px rgba(4,24,46,.28)}"
    + "#bf-finley-btn:hover{background:#0B2644}#bf-finley-btn:focus-visible{outline:2px solid #C9A35C;outline-offset:3px}"
    + "#bf-finley-btn i{width:10px;height:10px;border-radius:50%;background:#C9A35C;display:block}"
    + "#bf-finley-panel{position:fixed;right:20px;bottom:84px;z-index:2147483001;width:440px;height:min(720px,calc(100vh - 110px));"
    + "background:#fff;border:1px solid #D3DAE4;border-radius:12px;box-shadow:0 16px 48px rgba(4,24,46,.25);display:none;flex-direction:column;overflow:hidden}"
    + "#bf-finley-panel.open{display:flex}"
    + "#bf-finley-head{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#04182E;color:#fff;font-family:'Public Sans','Segoe UI',system-ui,sans-serif}"
    + "#bf-finley-head b{font-size:16px;font-weight:600;display:block}#bf-finley-head span{font-size:12px;color:#C9D3E0}"
    + "#bf-finley-head button{margin-left:auto;background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:8px;height:32px;padding:0 12px;cursor:pointer;font:600 13px 'Public Sans','Segoe UI',sans-serif}"
    + "#bf-finley-panel iframe{flex:1;border:0;width:100%}"
    + "#bf-finley-foot{padding:8px 14px;border-top:1px solid #D3DAE4;font:13px 'Public Sans','Segoe UI',sans-serif;background:#F3F5F8}"
    + "#bf-finley-foot a{color:#8A6A2E;text-decoration:underline}"
    + "@media (max-width:600px){#bf-finley-panel{right:0;bottom:0;width:100%;height:100%;border-radius:0;border:0}"
    + "#bf-finley-head{padding-top:max(12px,env(safe-area-inset-top))}#bf-finley-btn{right:16px;bottom:max(16px,env(safe-area-inset-bottom))}}";

  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; }

  function mount() {
    document.head.appendChild(el("style", {}, css));
    var btn = el("button", { id: "bf-finley-btn", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" }, "<i></i>" + T.open);
    var panel = el("div", { id: "bf-finley-panel", role: "dialog", "aria-label": "Finley" },
      "<div id='bf-finley-head'><div><b>Finley</b><span>" + T.sub + "</span></div><button type='button'>" + T.close + "</button></div>"
      + "<div id='bf-finley-frame'></div>"
      + "<div id='bf-finley-foot'><a href='https://link.beyondfinancing.com/consent' target='_blank' rel='noopener'>" + T.reach + "</a></div>");
    document.body.appendChild(panel);
    document.body.appendChild(btn);
    var loaded = false;
    function setOpen(open) {
      if (open && !loaded) {
        // Loaded on first open only, so the website itself stays as fast as before.
        panel.querySelector("#bf-finley-frame").outerHTML = "<iframe title='Finley' src='" + ORIGIN + "/borrower?embed=1&lang=" + lang + "' allow='clipboard-write; microphone'></iframe>";
        loaded = true;
      }
      panel.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.style.display = open && window.innerWidth <= 600 ? "none" : "";
    }
    btn.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
    panel.querySelector("#bf-finley-head button").addEventListener("click", function () { setOpen(false); btn.focus(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) setOpen(false); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
