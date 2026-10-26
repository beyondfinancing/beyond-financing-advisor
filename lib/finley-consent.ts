// The website consent sentence (shared by /ask and /api/finley-gate). Changing it changes what new visitors agree to;
// every verification stores the exact wording it showed.
/** The exact sentence the visitor agrees to (shown next to the checkbox on /ask, stored with every verification). */
export const CONSENT: Record<string, string> = {
  en: "By checking this box and verifying my code, I agree that Beyond Financing and its AI assistant Finley may contact me at the phone number and email I entered, by calls (including automated or AI voice), text messages, WhatsApp and email, about my inquiry and Beyond Financing's services. Consent is not a condition of any purchase or loan. Message and data rates may apply. I can opt out anytime (reply STOP, or tell Finley).",
  pt: "Ao marcar esta caixa e confirmar meu código, concordo que a Beyond Financing e sua assistente de IA Finley podem me contatar no telefone e e-mail informados, por ligações (inclusive voz automática ou de IA), mensagens de texto, WhatsApp e e-mail, sobre minha consulta e os serviços da Beyond Financing. O consentimento não é condição para nenhuma compra ou empréstimo. Podem ser cobradas tarifas de mensagens e dados. Posso cancelar a qualquer momento (responda STOP ou diga à Finley).",
  es: "Al marcar esta casilla y verificar mi código, acepto que Beyond Financing y su asistente de IA Finley me contacten al teléfono y correo que ingresé, por llamadas (incluida voz automatizada o de IA), mensajes de texto, WhatsApp y correo electrónico, sobre mi consulta y los servicios de Beyond Financing. El consentimiento no es condición para ninguna compra o préstamo. Pueden aplicarse tarifas de mensajes y datos. Puedo cancelar en cualquier momento (responda STOP o dígaselo a Finley).",
};


/* PER-CHANNEL CONSENT (owner 2026-10-26): "Where is the consent request for Calls, WhatsApp, text, emails ...
 * communications from Finley now and in the future? Those questions should come on the form already". Each channel is
 * its own box, nothing pre-ticked; the exact sentence for each ticked box is stored with the verification. */
export type ConsentChannel = "calls" | "whatsapp" | "sms" | "email";
export const CONSENT_CH: Record<string, Record<ConsentChannel, { label: string; text: string }>> = {
  en: {
    calls: { label: "Calls from Finley", text: "Beyond Financing and its AI assistant Finley may call me at the number above, including with an automated or AI voice. Calls may be recorded." },
    whatsapp: { label: "WhatsApp messages", text: "Beyond Financing and Finley may message me on WhatsApp at the number above." },
    sms: { label: "Text messages", text: "Beyond Financing and Finley may send me text messages at the number above. Message and data rates may apply; reply STOP to stop." },
    email: { label: "Emails", text: "Beyond Financing and Finley may email me at the address above." },
  },
  pt: {
    calls: { label: "Ligações da Finley", text: "A Beyond Financing e sua assistente de IA Finley podem me ligar no número acima, inclusive com voz automática ou de IA. As ligações podem ser gravadas." },
    whatsapp: { label: "Mensagens no WhatsApp", text: "A Beyond Financing e a Finley podem me enviar mensagens no WhatsApp no número acima." },
    sms: { label: "Mensagens de texto", text: "A Beyond Financing e a Finley podem me enviar mensagens de texto no número acima. Podem ser cobradas tarifas; responda STOP para parar." },
    email: { label: "E-mails", text: "A Beyond Financing e a Finley podem me enviar e-mails no endereço acima." },
  },
  es: {
    calls: { label: "Llamadas de Finley", text: "Beyond Financing y su asistente de IA Finley pueden llamarme al número de arriba, incluso con voz automatizada o de IA. Las llamadas pueden grabarse." },
    whatsapp: { label: "Mensajes de WhatsApp", text: "Beyond Financing y Finley pueden escribirme por WhatsApp al número de arriba." },
    sms: { label: "Mensajes de texto", text: "Beyond Financing y Finley pueden enviarme mensajes de texto al número de arriba. Pueden aplicarse tarifas; responda STOP para detener." },
    email: { label: "Correos electrónicos", text: "Beyond Financing y Finley pueden enviarme correos a la dirección de arriba." },
  },
};
export const CONSENT_FOOT: Record<string, string> = {
  en: "About my inquiry, my loan and Beyond Financing's services, now and in the future. Consent is not a condition of any purchase or loan, and I can turn any of these off anytime (reply STOP or tell Finley).",
  pt: "Sobre minha consulta, meu financiamento e os serviços da Beyond Financing, agora e no futuro. O consentimento não é condição para nenhuma compra ou empréstimo, e posso desligar qualquer um a qualquer momento (responda STOP ou diga à Finley).",
  es: "Sobre mi consulta, mi préstamo y los servicios de Beyond Financing, ahora y en el futuro. El consentimiento no es condición para ninguna compra o préstamo, y puedo desactivar cualquiera en cualquier momento (responda STOP o dígaselo a Finley).",
};
