import { NextResponse } from "next/server";

type PreferredLanguage = "English" | "Português" | "Español";
type FollowUpTrigger = "ai" | "apply" | "schedule" | "contact";

type BorrowerFollowUpPayload = {
  fullName?: string;
  email?: string;
  preferredLanguage?: PreferredLanguage;
  loanOfficerName?: string;
  loanOfficerEmail?: string;
  applyUrl?: string;
  scheduleUrl?: string;
  trigger?: FollowUpTrigger;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getBorrowerEmailContent(params: {
  fullName: string;
  preferredLanguage: PreferredLanguage;
  loanOfficerName: string;
  loanOfficerEmail: string;
  applyUrl: string;
  scheduleUrl: string;
  trigger: FollowUpTrigger;
}) {
  const {
    fullName,
    preferredLanguage,
    loanOfficerName,
    loanOfficerEmail,
    applyUrl,
    scheduleUrl,
    trigger,
  } = params;

  if (preferredLanguage === "Português") {
    const subject =
      trigger === "apply"
        ? "Recebemos suas informações"
        : trigger === "schedule"
        ? "Próximo passo para agendar sua conversa"
        : trigger === "contact"
        ? "Obrigado por entrar em contato"
        : "Obrigado por falar com a Finley Beyond";

    const ctaText =
      trigger === "schedule"
        ? "Agendar conversa"
        : "Continuar aplicação";

    const ctaUrl = trigger === "schedule" ? scheduleUrl : applyUrl;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">Olá ${escapeHtml(fullName)},</h1>

        <p style="line-height:1.7;">
          Obrigado por compartilhar suas informações com a Beyond Financing.
        </p>

        <p style="line-height:1.7;">
          Sua solicitação será analisada por um profissional licenciado, e o próximo passo será orientado de acordo com o seu cenário.
        </p>

        <p style="line-height:1.7;">
          Seu advisor designado: <strong>${escapeHtml(loanOfficerName)}</strong><br />
          Contato: ${escapeHtml(loanOfficerEmail)}
        </p>

        <p style="line-height:1.7;">
          Lembrete importante: qualquer direcionamento de financiamento continua sujeito à análise completa, documentação e diretrizes aplicáveis do investidor.
        </p>

        <div style="margin:26px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:#263366;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">
            ${ctaText}
          </a>
        </div>

        <p style="line-height:1.7;">
          Agradecemos a oportunidade de ajudar você.
        </p>

        <p style="line-height:1.7;">
          Beyond Financing<br />
          Finley Beyond Powered by Beyond Intelligence™
        </p>
      </div>
    `;

    return { subject, html };
  }

  if (preferredLanguage === "Español") {
    const subject =
      trigger === "apply"
        ? "Hemos recibido su información"
        : trigger === "schedule"
        ? "Siguiente paso para agendar su conversación"
        : trigger === "contact"
        ? "Gracias por contactarnos"
        : "Gracias por hablar con Finley Beyond";

    const ctaText =
      trigger === "schedule"
        ? "Agendar conversación"
        : "Continuar aplicación";

    const ctaUrl = trigger === "schedule" ? scheduleUrl : applyUrl;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">Hola ${escapeHtml(fullName)},</h1>

        <p style="line-height:1.7;">
          Gracias por compartir su información con Beyond Financing.
        </p>

        <p style="line-height:1.7;">
          Su escenario será revisado por un profesional hipotecario con licencia, y el siguiente paso será orientado según su situación.
        </p>

        <p style="line-height:1.7;">
          Su advisor asignado: <strong>${escapeHtml(loanOfficerName)}</strong><br />
          Contacto: ${escapeHtml(loanOfficerEmail)}
        </p>

        <p style="line-height:1.7;">
          Recordatorio importante: cualquier dirección de financiamiento sigue sujeta a revisión completa, documentación y guías aplicables del inversionista.
        </p>

        <div style="margin:26px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:#263366;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">
            ${ctaText}
          </a>
        </div>

        <p style="line-height:1.7;">
          Agradecemos la oportunidad de asistirle.
        </p>

        <p style="line-height:1.7;">
          Beyond Financing<br />
          Finley Beyond Powered by Beyond Intelligence™
        </p>
      </div>
    `;

    return { subject, html };
  }

  const subject =
    trigger === "apply"
      ? "We received your information"
      : trigger === "schedule"
      ? "Your next step to schedule a conversation"
      : trigger === "contact"
      ? "Thank you for contacting us"
      : "Thank you for speaking with Finley Beyond";

  const ctaText =
    trigger === "schedule"
      ? "Schedule Conversation"
      : "Continue Application";

  const ctaUrl = trigger === "schedule" ? scheduleUrl : applyUrl;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Hello ${escapeHtml(fullName)},</h1>

      <p style="line-height:1.7;">
        Thank you for sharing your information with Beyond Financing.
      </p>

      <p style="line-height:1.7;">
        Your scenario will be reviewed by a licensed mortgage professional, and the next step will be guided according to your file.
      </p>

      <p style="line-height:1.7;">
        Your assigned advisor: <strong>${escapeHtml(loanOfficerName)}</strong><br />
        Contact: ${escapeHtml(loanOfficerEmail)}
      </p>

      <p style="line-height:1.7;">
        Important reminder: any financing direction remains subject to full review, documentation, and applicable investor guidelines.
      </p>

      <div style="margin:26px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#263366;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">
          ${ctaText}
        </a>
      </div>

      <p style="line-height:1.7;">
        We appreciate the opportunity to assist you.
      </p>

      <p style="line-height:1.7;">
        Beyond Financing<br />
        Finley Beyond Powered by Beyond Intelligence™
      </p>
    </div>
  `;

  return { subject, html };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BorrowerFollowUpPayload;

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const preferredLanguage = (body.preferredLanguage ||
      "English") as PreferredLanguage;
    const loanOfficerName = String(body.loanOfficerName || "Beyond Financing").trim();
    const loanOfficerEmail = String(body.loanOfficerEmail || "myloan@beyondfinancing.com").trim();
    const applyUrl = String(
      body.applyUrl || "https://www.beyondfinancing.com/apply-now"
    ).trim();
    const scheduleUrl = String(
      body.scheduleUrl || "https://www.beyondfinancing.com"
    ).trim();
    const trigger = (body.trigger || "ai") as FollowUpTrigger;

    if (!fullName || !email) {
      return NextResponse.json(
        { success: false, error: "Missing borrower details." },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const { subject, html } = getBorrowerEmailContent({
      fullName,
      preferredLanguage,
      loanOfficerName,
      loanOfficerEmail,
      applyUrl,
      scheduleUrl,
      trigger,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Beyond Financing <finley@beyondfinancing.com>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
