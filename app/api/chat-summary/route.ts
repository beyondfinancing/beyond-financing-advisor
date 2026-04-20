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
  realtorName?: string;
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

function buildTranscriptHtml(messages: ChatMessage[]): string {
  return messages
    .map((msg, index) => {
      const roleLabel = msg.role === "user" ? "Borrower" : "Finley Beyond Advisor";

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

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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

  return {
    borrowerSummary:
      borrowerMessages ||
      "The borrower engaged with Finley Beyond Advisor and requested mortgage guidance.",
    likelyDirection:
      "Borrower appears to be exploring a home financing scenario and may be ready for live review.",
    strengths: [
      "Lead submitted with full contact details.",
      "Borrower engaged in a meaningful mortgage conversation.",
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
        ? "Borrower clicked or was directed toward the application flow."
        : trigger === "schedule"
        ? "Borrower clicked or was directed toward consultation scheduling."
        : trigger === "contact"
        ? "Borrower clicked or was directed toward Beyond Financing contact page."
        : "Borrower appears ready for a licensed loan officer to review and follow up.",
    loanOfficerActionPlan: [
      "Review the transcript.",
      "Contact the borrower promptly.",
      "Confirm income, credit, assets, and documentation strategy.",
      "Move borrower toward application, pre-approval, or consultation as appropriate.",
    ],
  };
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
      loanOfficerMap[loanOfficer] ||
      "finley@beyondfinancing.com";

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
- If the borrower is self-employed, employed, immigrant, green card holder, conventional candidate, FHA fallback candidate, etc., note that only if supported by the transcript
- "provisionalPrograms" should be directional only, not lender-specific guarantees
- Include realistic possible directions like Conventional, FHA, HomeReady/Home Possible style review, self-employed review, etc., only when supported by the scenario
- Do not promise approval
- Do not mention that no lender folder exists
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
    return `${index + 1}. ${who}: ${msg.content}`;
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

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">Conversation Summary - Finley Beyond Advisor</h1>

        <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Lead Details</h2>
          <p><strong>Full Name:</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Realtor Name:</strong> ${escapeHtml(realtorName || 'Not provided')}</p>
          <p><strong>Realtor Phone:</strong> ${escapeHtml(realtorPhone || 'Not provided')}</p>
          <p><strong>Language:</strong> ${escapeHtml(preferredLanguage)}</p>
          <p><strong>Selected Loan Officer:</strong> ${escapeHtml(loanOfficer)}</p>
          <p><strong>Assigned Email:</strong> ${escapeHtml(selectedEmail)}</p>
          <p><strong>Trigger:</strong> ${escapeHtml(trigger)}</p>
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
            ${summary.strengths
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}
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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Finley Beyond <finley@beyondfinancing.com>",
        to: [selectedEmail],
        reply_to: email,
        subject: `Conversation Summary: ${fullName}`,
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
