import { NextResponse } from "next/server";

type PreferredLanguage = "English" | "Português" | "Español";

type ChatMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type LeadPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: PreferredLanguage;
  loanOfficer?: string;
  assignedOfficerName?: string;
  estimatedLoanAmount?: string;
  assignedEmail?: string;
  recipientEmail?: string;
  professionalName?: string;
  professionalRole?: string;
  mode?: "borrower" | "professional";
};

type SummaryTrigger = "ai" | "apply" | "schedule" | "contact" | "professional";

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
  "finley-beyond": "finley@beyondfinancing.com",
  sandro: "pansini@beyondfinancing.com",
  "sandro-pansini-souza": "pansini@beyondfinancing.com",
  warren: "warren@beyondfinancing.com",
  "warren-wendt": "warren@beyondfinancing.com",
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
      const roleLabel = msg.role === "user" ? "User" : "Finley Beyond";

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

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getTriggerLabel(trigger: SummaryTrigger): string {
  if (trigger === "apply") return "Apply Now";
  if (trigger === "schedule") return "Schedule";
  if (trigger === "contact") return "Contact";
  if (trigger === "professional") return "Professional Session";
  return "AI Conversation";
}

function buildFallbackSummary(
  lead: LeadPayload,
  messages: ChatMessage[],
  trigger: SummaryTrigger
): SummaryPayload {
  const userMessages = messages
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content || "")
    .join(" ");

  const isProfessional = lead.mode === "professional" || trigger === "professional";

  return {
    borrowerSummary: isProfessional
      ? userMessages ||
        "A professional user engaged with Finley Beyond for internal mortgage analysis."
      : userMessages ||
        "The borrower engaged with Finley Beyond and requested mortgage guidance.",
    likelyDirection: isProfessional
      ? "Professional review suggests the file should be refined through guideline-based coaching and documented next steps."
      : "Borrower appears to be exploring a mortgage scenario and should receive licensed loan officer follow-up.",
    strengths: [
      "Conversation record captured successfully.",
      isProfessional
        ? "Professional user engaged in internal mortgage analysis."
        : "Borrower engaged in a meaningful mortgage conversation.",
      `Preferred language: ${lead.preferredLanguage || "Not provided"}.`,
    ],
    openQuestions: [
      "Confirm occupancy and timeline.",
      "Confirm funds source, reserves, and compensating factors.",
      "Confirm documentation strategy and final program direction.",
    ],
    provisionalPrograms: [
      "Conventional review",
      "FHA review if needed",
      "Alternative documentation review if applicable",
    ],
    recommendedNextStep:
      trigger === "apply"
        ? "Borrower selected Apply Now. Review the file promptly, confirm application completion, validate the strongest program direction, and move the borrower into document collection and licensing-compliant follow-up."
        : trigger === "schedule"
        ? "Borrower selected Schedule. Prepare for the consultation by reviewing the conversation, likely direction, missing items, and the most important qualification questions to address during the meeting."
        : trigger === "contact"
        ? "Borrower selected direct contact. Respond promptly, confirm the borrower’s main objective, and move the conversation toward the strongest next step based on the scenario."
        : trigger === "professional"
        ? "Professional should retain this record, continue refining the file, confirm missing documentation, and validate final fit directly against the applicable lender or investor guide."
        : "Loan officer should review the conversation, confirm the scenario structure, and follow up with the borrower promptly.",
    loanOfficerActionPlan:
      trigger === "apply"
        ? [
            "Review the transcript and summary immediately.",
            "Confirm whether the borrower completed the application successfully.",
            "Validate the strongest program direction and identify required supporting documents.",
            "Reach out promptly to move the file into active application and processing workflow.",
          ]
        : trigger === "schedule"
        ? [
            "Review the transcript and summary before the appointment.",
            "Prepare the most important qualification and documentation questions.",
            "Use the consultation to confirm structure, timeline, and program direction.",
            "Document the post-call next step and follow-up commitment.",
          ]
        : trigger === "contact"
        ? [
            "Review the transcript and summary promptly.",
            "Respond to the borrower directly by email or phone.",
            "Clarify the borrower’s immediate objective and missing qualification details.",
            "Move the borrower toward the strongest next action based on the scenario.",
          ]
        : trigger === "professional"
        ? [
            "Review the transcript and internal summary.",
            "Confirm the strongest remaining program direction.",
            "Validate missing items, compensating factors, and reserves requirements.",
            "Document the next internal action and confirm fit against the applicable guide.",
          ]
        : [
            "Review the transcript.",
            "Review strongest and conditional program directions.",
            "Confirm the missing qualification details and compensating factors.",
            "Document the next move for the file.",
          ],
  };
}

async function callOpenAIJson<T>(args: {
  system: string;
  user: string;
}): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) return null;

    return parseJsonSafely<T>(raw);
  } catch {
    return null;
  }
}

function buildHtml(args: {
  lead: LeadPayload;
  selectedEmail: string;
  trigger: SummaryTrigger;
  summary: SummaryPayload;
  messages: ChatMessage[];
}) {
  const { lead, selectedEmail, trigger, summary, messages } = args;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Finley Beyond Conversation Record</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Session Details</h2>
        <p><strong>Mode:</strong> ${escapeHtml(lead.mode || "borrower")}</p>
        <p><strong>Full Name:</strong> ${escapeHtml(lead.fullName || "Not provided")}</p>
        <p><strong>Email:</strong> ${escapeHtml(lead.email || "Not provided")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(lead.phone || "Not provided")}</p>
        <p><strong>Language:</strong> ${escapeHtml(lead.preferredLanguage || "Not provided")}</p>
        <p><strong>Loan Officer / User ID:</strong> ${escapeHtml(lead.loanOfficer || "Not provided")}</p>
        <p><strong>Assigned Loan Officer:</strong> ${escapeHtml(lead.assignedOfficerName || "Not provided")}</p>
        <p><strong>Estimated Loan Amount:</strong> ${escapeHtml(lead.estimatedLoanAmount || "Not provided")}</p>
        <p><strong>Professional Name:</strong> ${escapeHtml(lead.professionalName || "Not provided")}</p>
        <p><strong>Professional Role:</strong> ${escapeHtml(lead.professionalRole || "Not provided")}</p>
        <p><strong>Recipient Email:</strong> ${escapeHtml(selectedEmail)}</p>
        <p><strong>Action Selected:</strong> ${escapeHtml(getTriggerLabel(trigger))}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Summary</h2>
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

        <h3 style="margin:18px 0 8px 0;">Action Plan</h3>
        <ul style="line-height:1.8;">
          ${summary.loanOfficerActionPlan
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}
        </ul>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Full Conversation Transcript</h2>
        ${messages.length > 0 ? buildTranscriptHtml(messages) : "<p>No transcript available.</p>"}
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
    const loanOfficer = String(lead.loanOfficer || "").trim().toLowerCase();
    const assignedOfficerName = String(lead.assignedOfficerName || "").trim();
    const estimatedLoanAmount = String(lead.estimatedLoanAmount || "").trim();
    const recipientEmail = String(lead.recipientEmail || "").trim();
    const mode = lead.mode || "borrower";

    if (!preferredLanguage) {
      return NextResponse.json(
        { success: false, error: "Missing preferred language." },
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
      recipientEmail ||
      String(lead.assignedEmail || "").trim() ||
      loanOfficerMap[loanOfficer] ||
      "finley@beyondfinancing.com";

    if (!selectedEmail) {
      return NextResponse.json(
        { success: false, error: "No recipient email was resolved." },
        { status: 400 }
      );
    }

   const providedSummary =
  body?.summary &&
  typeof body.summary === "object"
    ? (body.summary as SummaryPayload)
    : null;

const fallback = buildFallbackSummary(lead, messages, trigger);

const aiSummary = providedSummary
  ? null
  : await callOpenAIJson<SummaryPayload>({
      system: `
You create concise internal mortgage briefing emails.

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
- write for a mortgage professional
- be practical and concise
- use only information actually present in the provided details and transcript
- do not promise approval
- provisional programs should be directional only
- if this is professional mode, frame the summary as internal file coaching and record keeping
      `.trim(),
      user: `
Lead details:
- Mode: ${mode}
- Full Name: ${fullName || "Not provided"}
- Email: ${email || "Not provided"}
- Phone: ${phone || "Not provided"}
- Preferred Language: ${preferredLanguage}
- Loan Officer / User ID: ${loanOfficer || "Not provided"}
- Professional Name: ${lead.professionalName || "Not provided"}
- Professional Role: ${lead.professionalRole || "Not provided"}
- Assigned Email: ${selectedEmail}
- Trigger: ${trigger}

Conversation transcript:
${messages
  .map((msg, index) => {
    const who = msg.role === "user" ? "User" : "Finley";
    return `${index + 1}. ${who}: ${msg.content || ""}`;
  })
  .join("\n")}
      `.trim(),
    });
const summary: SummaryPayload = providedSummary
  ? {
      borrowerSummary:
        providedSummary.borrowerSummary || fallback.borrowerSummary,
      likelyDirection:
        providedSummary.likelyDirection || fallback.likelyDirection,
      strengths:
        Array.isArray(providedSummary.strengths) &&
        providedSummary.strengths.length > 0
          ? providedSummary.strengths
          : fallback.strengths,
      openQuestions:
        Array.isArray(providedSummary.openQuestions) &&
        providedSummary.openQuestions.length > 0
          ? providedSummary.openQuestions
          : fallback.openQuestions,
      provisionalPrograms:
        Array.isArray(providedSummary.provisionalPrograms) &&
        providedSummary.provisionalPrograms.length > 0
          ? providedSummary.provisionalPrograms
          : fallback.provisionalPrograms,
      recommendedNextStep:
        providedSummary.recommendedNextStep || fallback.recommendedNextStep,
      loanOfficerActionPlan:
        Array.isArray(providedSummary.loanOfficerActionPlan) &&
        providedSummary.loanOfficerActionPlan.length > 0
          ? providedSummary.loanOfficerActionPlan
          : fallback.loanOfficerActionPlan,
    }
  : aiSummary
  ? {
      borrowerSummary: aiSummary.borrowerSummary || fallback.borrowerSummary,
      likelyDirection: aiSummary.likelyDirection || fallback.likelyDirection,
      strengths:
        Array.isArray(aiSummary.strengths) && aiSummary.strengths.length > 0
          ? aiSummary.strengths
          : fallback.strengths,
      openQuestions:
        Array.isArray(aiSummary.openQuestions) &&
        aiSummary.openQuestions.length > 0
          ? aiSummary.openQuestions
          : fallback.openQuestions,
      provisionalPrograms:
        Array.isArray(aiSummary.provisionalPrograms) &&
        aiSummary.provisionalPrograms.length > 0
          ? aiSummary.provisionalPrograms
          : fallback.provisionalPrograms,
      recommendedNextStep:
        aiSummary.recommendedNextStep || fallback.recommendedNextStep,
      loanOfficerActionPlan:
        Array.isArray(aiSummary.loanOfficerActionPlan) &&
        aiSummary.loanOfficerActionPlan.length > 0
          ? aiSummary.loanOfficerActionPlan
          : fallback.loanOfficerActionPlan,
    }
  : fallback;

    const html = buildHtml({
      lead,
      selectedEmail,
      trigger,
      summary,
      messages,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Finley Beyond <noreply@beyondfinancing.com>",
        to: [selectedEmail],
        reply_to: email || selectedEmail,
        subject:
          mode === "professional"
            ? `Finley Professional Session — ${getTriggerLabel(trigger)}${
                estimatedLoanAmount ? ` — ${estimatedLoanAmount}` : ""
              }${fullName ? ` — ${fullName}` : ""}${
                assignedOfficerName ? ` — ${assignedOfficerName}` : ""
              }`
            : `${getTriggerLabel(trigger)}${
                estimatedLoanAmount ? ` — ${estimatedLoanAmount}` : ""
              } — ${fullName || "Borrower Session"}${
                assignedOfficerName ? ` — ${assignedOfficerName}` : ""
              }`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      summary,
      sentTo: selectedEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
