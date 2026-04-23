import { NextResponse } from "next/server";

type PreferredLanguage = "English" | "Português" | "Español";

type ChatMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type SummaryTrigger = "ai" | "apply" | "schedule" | "contact" | "call";

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

const assistantMapByOfficerName: Record<string, string> = {
  "sandro pansini souza": "amarilis@beyondfinancing.com",
  "warren wendt": "amarilis@beyondfinancing.com",
  "finley beyond": "amarilis@beyondfinancing.com",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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
          <div style="line-height:1.6;">${nl2br(msg.content || "")}</div>
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
    .map((msg) => msg.content || "")
    .join(" ");

  return {
    borrowerSummary:
      borrowerMessages ||
      "The borrower engaged with Finley Beyond and requested mortgage guidance.",
    likelyDirection:
      "Borrower appears to be exploring a home financing scenario and may be ready for licensed review.",
    strengths: [
      "Lead submitted with direct contact details.",
      "Borrower engaged in a meaningful mortgage interaction.",
      `Preferred language: ${lead.preferredLanguage || "Not provided"}.`,
    ],
    openQuestions: [
      "Confirm final documentation package.",
      "Confirm property details, occupancy, and down payment funds if still pending.",
    ],
    provisionalPrograms: [
      "Conventional financing review",
      "FHA review if needed",
      "Alternative/self-employed review if applicable",
    ],
    recommendedNextStep:
      trigger === "apply"
        ? "Borrower started the application path after interaction with Finley Beyond."
        : trigger === "schedule"
        ? "Borrower moved toward consultation scheduling."
        : trigger === "contact"
        ? "Borrower moved toward direct email contact."
        : trigger === "call"
        ? "Borrower moved toward direct phone contact."
        : "Borrower appears ready for a licensed loan officer to review and follow up.",
    loanOfficerActionPlan: [
      "Review the borrower summary and transcript.",
      "Contact the borrower promptly.",
      "Confirm income, credit, assets, timeline, and documentation strategy.",
      "Move borrower toward application, pre-approval, or consultation as appropriate.",
    ],
  };
}

async function sendResendEmail(args: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  if (!process.env.RESEND_API_KEY || args.to.length === 0) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Finley Beyond <finley@beyondfinancing.com>",
      to: args.to,
      reply_to: args.replyTo,
      subject: args.subject,
      html: args.html,
    }),
  });
}

async function sendTwilioSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) return;

  const digits = to.replace(/\D/g, "");
  if (!digits) return;

  const normalizedTo = digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams();
  params.set("From", from);
  params.set("To", normalizedTo);
  params.set("Body", body);

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

function getBorrowerActionLabel(trigger: SummaryTrigger): string {
  switch (trigger) {
    case "apply":
      return "application start";
    case "schedule":
      return "consultation scheduling request";
    case "contact":
      return "email contact request";
    case "call":
      return "phone contact request";
    default:
      return "mortgage interaction";
  }
}

function buildInternalSummaryHtml(args: {
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: string;
  loanOfficer: string;
  selectedEmail: string;
  assistantEmail?: string;
  trigger: SummaryTrigger;
  realtorName?: string;
  realtorEmail?: string;
  realtorPhone?: string;
  summary: SummaryPayload;
  transcriptHtml: string;
}) {
  const {
    fullName,
    email,
    phone,
    preferredLanguage,
    loanOfficer,
    selectedEmail,
    assistantEmail,
    trigger,
    realtorName,
    realtorEmail,
    realtorPhone,
    summary,
    transcriptHtml,
  } = args;

  return `
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
        ${
          assistantEmail
            ? `<p><strong>Assistant Email:</strong> ${escapeHtml(assistantEmail)}</p>`
            : ""
        }
        <p><strong>Trigger:</strong> ${escapeHtml(trigger)}</p>
        ${
          realtorName || realtorEmail || realtorPhone
            ? `<p><strong>Realtor:</strong> ${escapeHtml(
                [realtorName, realtorEmail, realtorPhone].filter(Boolean).join(" · ")
              )}</p>`
            : ""
        }
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
          ${summary.openQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Recommended Next Step</h3>
        <p style="line-height:1.7;">${nl2br(summary.recommendedNextStep)}</p>

        <h3 style="margin:18px 0 8px 0;">Loan Officer Action Plan</h3>
        <ul style="line-height:1.8;">
          ${summary.loanOfficerActionPlan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Full Conversation Transcript</h2>
        ${transcriptHtml || "<p>No transcript available.</p>"}
      </div>
    </div>
  `;
}

function buildBorrowerConfirmationEmailHtml(args: {
  borrowerName: string;
  loanOfficerName: string;
  trigger: SummaryTrigger;
}) {
  const borrowerName = escapeHtml(args.borrowerName || "Borrower");
  const loanOfficerName = escapeHtml(args.loanOfficerName || "your assigned loan officer");
  const actionLabel = escapeHtml(getBorrowerActionLabel(args.trigger));

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Acknowledgment from Beyond Intelligence™</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <p style="line-height:1.7;margin-top:0;">Hello ${borrowerName},</p>

        <p style="line-height:1.7;">
          This message confirms that your ${actionLabel} has been received after your interaction with Finley Beyond.
        </p>

        <p style="line-height:1.7;">
          ${loanOfficerName} will review your file, analyze the scenario, and continue the next stage of the pre-approval or consultation process as appropriate.
        </p>

        <p style="line-height:1.7;margin-bottom:0;">
          This notice is an acknowledgment of your request and should not be interpreted as a loan approval, underwriting decision, or commitment to lend.
        </p>
      </div>
    </div>
  `;
}

function buildAssistantAcknowledgmentEmailHtml(args: {
  borrowerName: string;
  loanOfficerName: string;
  trigger: SummaryTrigger;
}) {
  const borrowerName = escapeHtml(args.borrowerName || "Borrower");
  const loanOfficerName = escapeHtml(args.loanOfficerName || "Assigned loan officer");
  const actionLabel = escapeHtml(getBorrowerActionLabel(args.trigger));

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Action Acknowledgment - Beyond Intelligence™</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <p style="line-height:1.7;margin-top:0;">
          ${borrowerName} has triggered a ${actionLabel} through Finley Beyond.
        </p>

        <p style="line-height:1.7;">
          The assigned loan officer is ${loanOfficerName}. This message is intended as a same-moment acknowledgment for team continuity.
        </p>

        <p style="line-height:1.7;margin-bottom:0;">
          The internal summary has also been routed for professional review.
        </p>
      </div>
    </div>
  `;
}

function buildRealtorEmailHtml(args: {
  realtorName: string;
  borrowerName: string;
  loanOfficerName: string;
}) {
  const realtorName = escapeHtml(args.realtorName || "Real Estate Professional");
  const borrowerName = escapeHtml(args.borrowerName || "your client");
  const loanOfficerName = escapeHtml(args.loanOfficerName || "the assigned loan officer");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Application Confirmation - Beyond Intelligence™</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <p style="line-height:1.7;margin-top:0;">Hello ${realtorName},</p>

        <p style="line-height:1.7;">
          This is a courtesy update to let you know that ${borrowerName} completed a successful interaction with Finley Beyond, the AI Loan Officer Assistant powered by Beyond Intelligence™, and has now started the loan application process.
        </p>

        <p style="line-height:1.7;">
          The conversation itself remains private and is not shared in this notification. The assigned loan officer, ${loanOfficerName}, will review the file, analyze the scenario, and begin the pre-approval process as appropriate.
        </p>

        <p style="line-height:1.7;margin-bottom:0;">
          This message is intended as a professional workflow confirmation so all parties remain aligned as the financing process moves forward.
        </p>
      </div>
    </div>
  `;
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
    const email = String(lead.email || "").trim();
    const phone = String(lead.phone || "").trim();
    const preferredLanguage = String(lead.preferredLanguage || "").trim();
    const loanOfficer = String(lead.loanOfficer || "").trim();
    const realtorName = String(lead.realtorName || "").trim();
    const realtorEmail = String(lead.realtorEmail || "").trim();
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
      String(lead.assignedEmail || "").trim() ||
      loanOfficerMap[normalizeKey(loanOfficer)] ||
      "finley@beyondfinancing.com";

    const assistantEmail =
      String(lead.assistantEmail || "").trim() ||
      assistantMapByOfficerName[normalizeKey(loanOfficer)] ||
      "";

    let summary: SummaryPayload = buildFallbackSummary(lead, messages, trigger);

    if (process.env.OPENAI_API_KEY && messages.length > 0) {
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
- "provisionalPrograms" should be directional only, not lender-specific guarantees
- Do not promise approval
- Assume this is an internal pre-brief before full underwriting

Lead details:
- Full Name: ${fullName}
- Email: ${email}
- Phone: ${phone}
- Preferred Language: ${preferredLanguage}
- Selected Loan Officer: ${loanOfficer}
- Assigned Email: ${selectedEmail}
- Trigger: ${trigger}

Conversation transcript:
${messages
  .map((msg, index) => {
    const who = msg.role === "user" ? "Borrower" : "Finley";
    return `${index + 1}. ${who}: ${msg.content || ""}`;
  })
  .join("\n")}
`;

      const summaryResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
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
        }
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        const rawContent = summaryData?.choices?.[0]?.message?.content;
        const parsed = rawContent
          ? parseJsonSafely<SummaryPayload>(rawContent)
          : null;

        if (parsed) {
          summary = {
            borrowerSummary: parsed.borrowerSummary || summary.borrowerSummary,
            likelyDirection: parsed.likelyDirection || summary.likelyDirection,
            strengths:
              Array.isArray(parsed.strengths) && parsed.strengths.length > 0
                ? parsed.strengths
                : summary.strengths,
            openQuestions:
              Array.isArray(parsed.openQuestions) &&
              parsed.openQuestions.length > 0
                ? parsed.openQuestions
                : summary.openQuestions,
            provisionalPrograms:
              Array.isArray(parsed.provisionalPrograms) &&
              parsed.provisionalPrograms.length > 0
                ? parsed.provisionalPrograms
                : summary.provisionalPrograms,
            recommendedNextStep:
              parsed.recommendedNextStep || summary.recommendedNextStep,
            loanOfficerActionPlan:
              Array.isArray(parsed.loanOfficerActionPlan) &&
              parsed.loanOfficerActionPlan.length > 0
                ? parsed.loanOfficerActionPlan
                : summary.loanOfficerActionPlan,
          };
        }
      }
    }

    const transcriptHtml = buildTranscriptHtml(messages);

    const internalHtml = buildInternalSummaryHtml({
      fullName,
      email,
      phone,
      preferredLanguage,
      loanOfficer,
      selectedEmail,
      assistantEmail,
      trigger,
      realtorName,
      realtorEmail,
      realtorPhone,
      summary,
      transcriptHtml,
    });

    const tasks: Promise<unknown>[] = [];

    // Internal summary to loan officer
    tasks.push(
      sendResendEmail({
        to: [selectedEmail],
        subject: `Conversation Summary: ${fullName}`,
        html: internalHtml,
        replyTo: email,
      })
    );

    // Borrower confirmation email
    tasks.push(
      sendResendEmail({
        to: [email],
        subject: `Acknowledgment from Beyond Intelligence™`,
        html: buildBorrowerConfirmationEmailHtml({
          borrowerName: fullName,
          loanOfficerName: loanOfficer,
          trigger,
        }),
        replyTo: selectedEmail,
      })
    );

    // Borrower confirmation SMS
    tasks.push(
      sendTwilioSms(
        phone,
        `${fullName}, your ${getBorrowerActionLabel(
          trigger
        )} was received by Beyond Intelligence. ${loanOfficer} will review your file and continue the next step as appropriate.`
      )
    );

    // Assistant acknowledgment email
    if (assistantEmail && assistantEmail !== selectedEmail) {
      tasks.push(
        sendResendEmail({
          to: [assistantEmail],
          subject: `Borrower Action Acknowledgment: ${fullName}`,
          html: buildAssistantAcknowledgmentEmailHtml({
            borrowerName: fullName,
            loanOfficerName: loanOfficer,
            trigger,
          }),
          replyTo: selectedEmail,
        })
      );
    }

    // Realtor apply notifications only
    if (trigger === "apply" && realtorEmail) {
      tasks.push(
        sendResendEmail({
          to: [realtorEmail],
          subject: `Application Started: ${fullName}`,
          html: buildRealtorEmailHtml({
            realtorName,
            borrowerName: fullName,
            loanOfficerName: loanOfficer,
          }),
          replyTo: selectedEmail,
        })
      );
    }

    if (trigger === "apply" && realtorPhone) {
      tasks.push(
        sendTwilioSms(
          realtorPhone,
          `${fullName} has started a mortgage application through Finley Beyond. ${loanOfficer} will review the file and begin pre-approval analysis as appropriate.`
        )
      );
    }

    await Promise.allSettled(tasks);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
