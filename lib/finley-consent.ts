// The website consent sentence (shared by /ask and /api/finley-gate). Changing it changes what new visitors agree to;
// every verification stores the exact wording it showed.
/** The exact sentence the visitor agrees to (shown next to the checkbox on /ask, stored with every verification). */
export const CONSENT: Record<string, string> = {
  en: "By checking this box and verifying my code, I agree that Beyond Financing and its AI assistant Finley may contact me at the phone number and email I entered, by calls (including automated or AI voice), text messages, WhatsApp and email, about my inquiry and Beyond Financing's services. Consent is not a condition of any purchase or loan. Message and data rates may apply. I can opt out anytime (reply STOP, or tell Finley).",
  pt: "Ao marcar esta caixa e confirmar meu código, concordo que a Beyond Financing e sua assistente de IA Finley podem me contatar no telefone e e-mail informados, por ligações (inclusive voz automática ou de IA), mensagens de texto, WhatsApp e e-mail, sobre minha consulta e os serviços da Beyond Financing. O consentimento não é condição para nenhuma compra ou empréstimo. Podem ser cobradas tarifas de mensagens e dados. Posso cancelar a qualquer momento (responda STOP ou diga à Finley).",
  es: "Al marcar esta casilla y verificar mi código, acepto que Beyond Financing y su asistente de IA Finley me contacten al teléfono y correo que ingresé, por llamadas (incluida voz automatizada o de IA), mensajes de texto, WhatsApp y correo electrónico, sobre mi consulta y los servicios de Beyond Financing. El consentimiento no es condición para ninguna compra o préstamo. Pueden aplicarse tarifas de mensajes y datos. Puedo cancelar en cualquier momento (responda STOP o dígaselo a Finley).",
};

