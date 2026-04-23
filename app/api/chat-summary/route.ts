import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PreferredLanguage = "English" | "Português" | "Español";
type SummaryTrigger = "ai" | "apply" | "schedule" | "contact";

type LeadPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: PreferredLanguage;
  loanOfficer?: string;
  assignedEmail?: string;
  assistantEmail?: string;
  realtorName?: string;
  realtorEmail?: string;
  realtorPhone?: string;
};

type SummaryPayload = {
  borrowerSummary: string;
  likelyDirection: string;
  strengths: string[];
  openQuestions: string[];
  provisionalPrograms: string[];
  recommendedNextStep: string;
  loanOfficerActionPlan: string[];
};

const loanOfficerMap: Record<string, string> = {
  finley: "finley@beyondfinancing.com",
  sandro: "pansini@beyondfinancing.com",
  warren: "warren@beyondfinancing.com",
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatTriggerLabel(trigger: SummaryTrigger): string {
  if (trigger === "apply") return "Apply Now";
  if (trigger === "schedule") return "Schedule";
  if (trigger === "contact") return "Contact";
  return "AI Conversation";
}

function buildRecommendedNextStep(trigger: SummaryTrigger): string {
  if (trigger === "apply") {
    return "Borrower proceeded to the application flow. Review promptly, confirm documentation strategy, and follow up while engagement is high.";
  }

  if (trigger === "schedule") {
    return "Borrower proceeded to scheduling. Review the transcript before the consultation and be prepared to confirm next steps, documentation, and timing.";
  }

  if (trigger === "contact") {
    return "Borrower requested direct contact. Reach out promptly and confirm the best path forward based on the conversation and stated scenario.";
  }

  return "Borrower engaged with Finley Beyond and appears ready for licensed review and timely follow-up.";
}

function buildBorrowerConfirmationCopy(
  preferredLanguage: string,
  loanOfficer: string,
  trigger: SummaryTrigger
) {
  if (preferredLanguage === "Português") {
    return {
      subject: "Sua consulta hipotecária foi recebida",
      title: "Recebemos sua solicitação",
      body:
        trigger === "apply"
          ? `Sua solicitação foi recebida com sucesso. ${loanOfficer} já foi notificado(a) e deverá revisar seu cenário e acompanhar os próximos passos após o envio da aplicação.`
          : trigger === "schedule"
          ? `Seu agendamento ou intenção de agendamento foi registrado. ${loanOfficer} já foi notificado(a) e acompanhará seu cenário hipotecário.`
          : `Sua solicitação de contato foi recebida. ${loanOfficer} já foi notificado(a) e deverá acompanhar seu cenário hipotecário em breve.`,
      footer:
        "Esta comunicação confirma o recebimento da sua solicitação. Todas as opções permanecem sujeitas à revisão de um loan officer licenciado, documentação e diretrizes aplicáveis.",
    };
  }

  if (preferredLanguage === "Español") {
    return {
      subject: "Su consulta hipotecaria ha sido recibida",
      title: "Hemos recibido su solicitud",
      body:
        trigger === "apply"
          ? `Su solicitud fue recibida correctamente. ${loanOfficer} ya fue notificado(a) y deberá revisar su escenario y dar seguimiento a los próximos pasos después del envío de la solicitud.`
          : trigger === "schedule"
          ? `Su cita o intención de agendar fue registrada. ${loanOfficer} ya fue notificado(a) y dará seguimiento a su escenario hipotecario.`
          : `Su solicitud de contacto fue recibida. ${loanOfficer} ya fue notificado(a) y deberá dar seguimiento a su escenario hipotecario en breve.`,
      footer:
        "Esta comunicación confirma la recepción de su solicitud. Todas las opciones siguen sujetas a revisión por un loan officer con licencia, documentación y guías aplicables.",
    };
  }

  return {
    subject: "Your mortgage consultation has been received",
    title: "Your request has been received",
    body:
      trigger === "apply"
        ? `${loanOfficer} has already been notified and will review your scenario and follow up after your application is submitted.`
        : trigger === "schedule"
        ? `${loanOfficer} has already been notified and will follow up regarding your mortgage scenario and consultation.`
        : `${loanOfficer} has already been notified and will follow up regarding your mortgage scenario shortly.`,
    footer:
      "This message confirms receipt of your request. All options remain subject to licensed loan officer review, documentation, and applicable guidelines.",
  };
}

function buildRealtorConfirmationCopy(
  preferredLanguage: string,
  borrowerName: string,
  loanOfficer: string
) {
  if (preferredLanguage === "Português") {
    return {
      subject: "Seu cliente já está sendo assistido",
      title: "Seu cliente está sendo atendido",
      body: `${borrowerName || "Seu cliente"} já está sendo assistido(a) pelo sistema Beyond Intelligence™. ${loanOfficer} já foi notificado(a) para revisar o cenário hipotecário e acompanhar os próximos passos.`,
      footer:
        "Esta mensagem é uma confirmação de acompanhamento inicial e não constitui aprovação de financiamento.",
    };
  }

  if (preferredLanguage === "Español") {
    return {
      subject: "Su cliente ya está siendo asistido",
      title: "Su cliente está siendo atendido",
      body: `${borrowerName || "Su cliente"} ya está siendo asistido(a) por el sistema Beyond Intelligence™. ${loanOfficer} ya fue notificado(a) para revisar el escenario hipotecario y dar seguimiento a los próximos pasos.`,
      footer:
        "Este mensaje es una confirmación de atención inicial y no constituye aprobación de financiamiento.",
    };
  }

  return {
    subject: "Your borrower is already being assisted",
    title: "Your borrower is now being assisted",
    body: `${borrowerName || "Your borrower"} is already being assisted through Beyond Intelligence™. ${loanOfficer} has already been notified to review the mortgage scenario and follow up on next steps.`,
    footer:
      "This message is an initial service confirmation and does not constitute loan approval.",
  };
}

function buildTranscriptHtml(messages: ChatMessage[]): string {
  return messages
    .map((msg, index) => {
      const roleLabel =
        msg.role === "user" ? "Borrower" : "Finley Beyond Advisor";

      return `
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:12px;background:${
          msg.role === "user" ? "#DCEAFE" : "#F3F4F6"
        };color:#263366;">
          <div style="font-weight:700;margin-bottom:6px;">${roleLabel} ${index + 1}</div>
          <div style="line-height:1.6;">${nl2br(msg.content)}</div>
        </div>
      `;
    })
    .join("");
}

function buildFallbackSummary(
  lead: LeadPayload,
  messages: ChatMessage[],
  trigger: SummaryTrigger
): SummaryPayload {
  const borrowerMessages = messages
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content)
    .join(" ");

  const hasRealtor = !!String(lead.realtorName || "").trim();

  return {
    borrowerSummary:
      borrowerMessages ||
      "The borrower engaged with Finley Beyond and requested mortgage guidance.",
    likelyDirection:
      "Borrower appears to be exploring a home financing scenario and may be ready for prompt live review.",
    strengths: [
      "Lead submitted with contact details.",
      "Borrower engaged in a mortgage-focused conversation.",
      `Preferred language: ${lead.preferredLanguage || "Not provided"}.`,
      hasRealtor
        ? `Borrower indicated realtor involvement: ${lead.realtorName}.`
        : "No realtor name was provided.",
    ],
    openQuestions: [
      "Confirm documentation strategy.",
      "Confirm property details, occupancy, and source of funds if still pending.",
    ],
    provisionalPrograms: [
      "Conventional review",
      "FHA review if needed",
      "Alternative income review if applicable",
    ],
    recommendedNextStep: buildRecommendedNextStep(trigger),
    loanOfficerActionPlan: [
      "Review the transcript and borrower profile.",
      "Contact the borrower promptly.",
      "Confirm credit, income, assets, liabilities, and documentation strategy.",
      "Coordinate with realtor if appropriate and authorized.",
      "Move borrower toward application, consultation, or structured pre-approval review as appropriate.",
    ],
  };
}

async function createAiSummary(
  lead: LeadPayload,
  messages: ChatMessage[],
  trigger: SummaryTrigger,
  selectedEmail: string
): Promise<SummaryPayload | null> {
  if (!process.env.OPENAI_API_KEY || messages.length === 0) {
    return null;
  }

  const summaryPrompt = `
You are preparing an internal loan-officer briefing email for Beyond Financing.

Return valid JSON only with this exact shape:
{
  "borrowerSummary": "string",
  "likelyDirection": "string",
  "strengths": ["string"],
  "openQuestions": ["string"],
  "provisionalPrograms": ["string"],
  "recommendedNextStep": "string",
  "loanOfficerActionPlan": ["string"]
}

Rules:
- Write for an internal mortgage loan officer
- Be practical and concise
- Use only information actually present in the conversation and lead details
- Include realtor context only if actually provided
- "provisionalPrograms" should be directional only, not lender-specific guarantees
- Do not promise approval
- Assume this is an internal pre-brief before full underwriting

Lead details:
- Full Name: ${String(lead.fullName || "").trim()}
- Email: ${String(lead.email || "").trim()}
- Phone: ${String(lead.phone || "").trim()}
- Preferred Language: ${String(lead.preferredLanguage || "").trim()}
- Selected Loan Officer: ${String(lead.loanOfficer || "").trim()}
- Assigned Email: ${selectedEmail}
- Realtor Name: ${String(lead.realtorName || "").trim() || "Not provided"}
- Realtor Email: ${String(lead.realtorEmail || "").trim() || "Not provided"}
- Realtor Phone: ${String(lead.realtorPhone || "").trim() || "Not provided"}
- Trigger: ${trigger}

Conversation transcript:
${messages
  .map((msg, index) => {
    const who = msg.role === "user" ? "Borrower" : "Finley";
    return `${index + 1}. ${who}: ${msg.content}`;
  })
  .join("\n")}
`;

  const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create concise internal mortgage advisor briefings in strict JSON.",
        },
        {
          role: "user",
          content: summaryPrompt,
        },
      ],
    }),
  });

  if (!summaryResponse.ok) {
    return null;
  }

  const summaryData = await summaryResponse.json();
  const rawContent = summaryData?.choices?.[0]?.message?.content;
  const parsed = rawContent ? parseJsonSafely<SummaryPayload>(rawContent) : null;

  if (!parsed) return null;

  return {
    borrowerSummary: parsed.borrowerSummary || "",
    likelyDirection: parsed.likelyDirection || "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
    provisionalPrograms: Array.isArray(parsed.provisionalPrograms)
      ? parsed.provisionalPrograms
      : [],
    recommendedNextStep: parsed.recommendedNextStep || "",
    loanOfficerActionPlan: Array.isArray(parsed.loanOfficerActionPlan)
      ? parsed.loanOfficerActionPlan
      : [],
  };
}

async function sendEmail({
  to,
  cc,
  replyTo,
  subject,
  html,
}: {
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
}) {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Finley Beyond <finley@beyondfinancing.com>",
      to,
      cc,
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const error = await resendResponse.text();
    throw new Error(error || "Unable to send email.");
  }

  return resendResponse.json().catch(() => null);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const lead = (body?.lead || {}) as LeadPayload;
    const messages = Array.isArray(body?.messages)
      ? (body.messages as ChatMessage[])
      : [];
    const trigger = (body?.trigger || "ai") as SummaryTrigger;

    const fullName = String(lead.fullName || "").trim();
    const email = normalizeEmail(lead.email || "");
    const phone = String(lead.phone || "").trim();
    const preferredLanguage = String(lead.preferredLanguage || "").trim();
    const loanOfficer = String(lead.loanOfficer || "").trim();
    const assignedEmailFromLead = normalizeEmail(lead.assignedEmail || "");
    const assistantEmail = normalizeEmail(lead.assistantEmail || "");
    const realtorName = String(lead.realtorName || "").trim();
    const realtorEmail = normalizeEmail(lead.realtorEmail || "");
    const realtorPhone = String(lead.realtorPhone || "").trim();

    if (!fullName || !email || !phone || !preferredLanguage || !loanOfficer) {
      return NextResponse.json(
        { success: false, error: "Missing lead details." },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const selectedEmail =
      assignedEmailFromLead ||
      loanOfficerMap[loanOfficer.toLowerCase()] ||
      "finley@beyondfinancing.com";

    let summary = buildFallbackSummary(lead, messages, trigger);

    const aiSummary = await createAiSummary(lead, messages, trigger, selectedEmail);

    if (aiSummary) {
      summary = {
        borrowerSummary: aiSummary.borrowerSummary || summary.borrowerSummary,
        likelyDirection: aiSummary.likelyDirection || summary.likelyDirection,
        strengths:
          Array.isArray(aiSummary.strengths) && aiSummary.strengths.length > 0
            ? aiSummary.strengths
            : summary.strengths,
        openQuestions:
          Array.isArray(aiSummary.openQuestions) && aiSummary.openQuestions.length > 0
            ? aiSummary.openQuestions
            : summary.openQuestions,
        provisionalPrograms:
          Array.isArray(aiSummary.provisionalPrograms) &&
          aiSummary.provisionalPrograms.length > 0
            ? aiSummary.provisionalPrograms
            : summary.provisionalPrograms,
        recommendedNextStep:
          aiSummary.recommendedNextStep || summary.recommendedNextStep,
        loanOfficerActionPlan:
          Array.isArray(aiSummary.loanOfficerActionPlan) &&
          aiSummary.loanOfficerActionPlan.length > 0
            ? aiSummary.loanOfficerActionPlan
            : summary.loanOfficerActionPlan,
      };
    }

    const transcriptHtml = buildTranscriptHtml(messages);

    const internalHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">Conversation Summary - Finley Beyond</h1>

        <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Lead Details</h2>
          <p><strong>Full Name:</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Language:</strong> ${escapeHtml(preferredLanguage)}</p>
          <p><strong>Selected Loan Officer:</strong> ${escapeHtml(loanOfficer)}</p>
          <p><strong>Assigned Email:</strong> ${escapeHtml(selectedEmail)}</p>
          <p><strong>Assistant Email:</strong> ${escapeHtml(assistantEmail || "Not provided")}</p>
          <p><strong>Trigger:</strong> ${escapeHtml(formatTriggerLabel(trigger))}</p>
          <p><strong>Realtor Name:</strong> ${escapeHtml(realtorName || "Not provided")}</p>
          <p><strong>Realtor Email:</strong> ${escapeHtml(realtorEmail || "Not provided")}</p>
          <p><strong>Realtor Phone:</strong> ${escapeHtml(realtorPhone || "Not provided")}</p>
        </div>

        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Borrower Summary</h2>
          <p style="line-height:1.7;">${nl2br(summary.borrowerSummary)}</p>

          <h3 style="margin:18px 0 8px 0;">Likely Direction</h3>
          <p style="line-height:1.7;">${nl2br(summary.likelyDirection)}</p>

          <h3 style="margin:18px 0 8px 0;">Provisional Program Directions</h3>
          <ul style="line-height:1.8;">
            ${summary.provisionalPrograms
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Strengths</h3>
          <ul style="line-height:1.8;">
            ${summary.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Open Questions</h3>
          <ul style="line-height:1.8;">
            ${summary.openQuestions
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Recommended Next Step</h3>
          <p style="line-height:1.7;">${nl2br(summary.recommendedNextStep)}</p>

          <h3 style="margin:18px 0 8px 0;">Loan Officer Action Plan</h3>
          <ul style="line-height:1.8;">
            ${summary.loanOfficerActionPlan
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}
          </ul>
        </div>

        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Full Conversation Transcript</h2>
          ${transcriptHtml || "<p>No transcript available.</p>"}
        </div>
      </div>
    `;

    const borrowerCopy = buildBorrowerConfirmationCopy(
      preferredLanguage,
      loanOfficer,
      trigger
    );

    const borrowerHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">${escapeHtml(borrowerCopy.title)}</h1>
        <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
          <p style="line-height:1.8;">Hello ${escapeHtml(fullName)},</p>
          <p style="line-height:1.8;">${escapeHtml(borrowerCopy.body)}</p>
          <p style="line-height:1.8;">${escapeHtml(borrowerCopy.footer)}</p>
        </div>
      </div>
    `;

    const realtorCopy = buildRealtorConfirmationCopy(
      preferredLanguage,
      fullName,
      loanOfficer
    );

    const realtorHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">${escapeHtml(realtorCopy.title)}</h1>
        <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
          <p style="line-height:1.8;">Hello ${escapeHtml(realtorName || "Realtor")},</p>
          <p style="line-height:1.8;">${escapeHtml(realtorCopy.body)}</p>
          <p style="line-height:1.8;">${escapeHtml(realtorCopy.footer)}</p>
        </div>
      </div>
    `;

    const internalTo = [selectedEmail];
    const internalCc = assistantEmail && assistantEmail !== selectedEmail ? [assistantEmail] : undefined;

    await sendEmail({
      to: internalTo,
      cc: internalCc,
      replyTo: email,
      subject: `Conversation Summary: ${fullName} (${formatTriggerLabel(trigger)})`,
      html: internalHtml,
    });

    await sendEmail({
      to: [email],
      subject: borrowerCopy.subject,
      html: borrowerHtml,
    });

    if (realtorEmail) {
      await sendEmail({
        to: [realtorEmail],
        subject: realtorCopy.subject,
        html: realtorHtml,
      });
    }

    return NextResponse.json({
      success: true,
      internalSentTo: selectedEmail,
      assistantSentTo: internalCc || [],
      borrowerSentTo: email,
      realtorSentTo: realtorEmail || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
