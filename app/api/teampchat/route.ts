import { NextResponse } from "next/server";

type TeamChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SuggestionItem = {
  program: string;
  strength: string;
  notes: string[];
};

type TeamScenario = {
  borrowerName?: string;
  professionalName?: string;
  professionalEmail?: string;
  role?: string;
  borrowerCurrentState?: string;
  borrowerTargetState?: string;
  loanPurpose?: string;
  credit?: string;
  income?: string;
  debt?: string;
  homePrice?: string;
  downPayment?: string;
  occupancy?: string;
  incomeType?: string;
  units?: string;
  dscr?: string;
};

type TeamRequestBody = {
  action?: "chat" | "complete";
  scenario?: TeamScenario;
  messages?: TeamChatMessage[];
  suggestions?: SuggestionItem[];
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

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildTranscriptHtml(messages: TeamChatMessage[]): string {
  return messages
    .map((msg, index) => {
      const roleLabel = msg.role === "user" ? "Professional" : "Finley Beyond";

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

async function callOpenAIChat(args: {
  system: string;
  user: string;
}): Promise<string | null> {
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
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.25,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : null;
  } catch {
    return null;
  }
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

function buildFallbackReply(
  latestMessage: string,
  suggestions: SuggestionItem[]
): string {
  const lower = latestMessage.toLowerCase();

  if (
    lower.includes("what else") ||
    lower.includes("next") ||
    lower.includes("narrow")
  ) {
    return `Based on the current scenario, I would narrow the review around occupancy, income stability, funds to close, and whether a cleaner agency execution is available before considering broader alternatives.

The strongest next step is to confirm the borrower structure more precisely and compare the top on-screen program directions against documentation quality and risk layering.`;
  }

  if (suggestions.length > 0) {
    return `The current scenario is already pointing toward a few preliminary program directions on screen. I would continue by confirming the borrower’s occupancy, documentation path, and whether there are any compensating or weakening factors that could shift execution.`;
  }

  return `I’ve recorded the scenario. Continue adding borrower structure, occupancy, income type, and documentation context so I can help narrow the likely program direction more effectively.`;
}

function buildSummaryHtml(args: {
  scenario: TeamScenario;
  messages: TeamChatMessage[];
  suggestions: SuggestionItem[];
  summary: {
    executiveSummary: string;
    likelyDirection: string;
    strengths: string[];
    riskFlags: string[];
    missingItems: string[];
    recommendedNextStep: string;
    actionItems: string[];
  };
}) {
  const { scenario, messages, suggestions, summary } = args;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:920px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Beyond Intelligence Professional Review Summary</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Scenario Details</h2>
        <p><strong>Borrower Scenario Name:</strong> ${escapeHtml(scenario.borrowerName || "Not provided")}</p>
        <p><strong>Professional:</strong> ${escapeHtml(scenario.professionalName || "Not provided")}</p>
        <p><strong>Role:</strong> ${escapeHtml(scenario.role || "Not provided")}</p>
        <p><strong>Loan Purpose:</strong> ${escapeHtml(scenario.loanPurpose || "Not provided")}</p>
        <p><strong>Borrower Current State:</strong> ${escapeHtml(scenario.borrowerCurrentState || "Not provided")}</p>
        <p><strong>Borrower Target State:</strong> ${escapeHtml(scenario.borrowerTargetState || "Not provided")}</p>
        <p><strong>Credit Score:</strong> ${escapeHtml(scenario.credit || "Not provided")}</p>
        <p><strong>Gross Monthly Income:</strong> ${escapeHtml(scenario.income || "Not provided")}</p>
        <p><strong>Monthly Debt:</strong> ${escapeHtml(scenario.debt || "Not provided")}</p>
        <p><strong>Estimated Home Price:</strong> ${escapeHtml(scenario.homePrice || "Not provided")}</p>
        <p><strong>Estimated Down Payment:</strong> ${escapeHtml(scenario.downPayment || "Not provided")}</p>
        <p><strong>Occupancy:</strong> ${escapeHtml(scenario.occupancy || "Not provided")}</p>
        <p><strong>Income Type:</strong> ${escapeHtml(scenario.incomeType || "Not provided")}</p>
        <p><strong>Units:</strong> ${escapeHtml(scenario.units || "Not provided")}</p>
        <p><strong>DSCR:</strong> ${escapeHtml(scenario.dscr || "Not provided")}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Executive Summary</h2>
        <p style="line-height:1.7;">${nl2br(summary.executiveSummary)}</p>

        <h3 style="margin:18px 0 8px 0;">Likely Direction</h3>
        <p style="line-height:1.7;">${nl2br(summary.likelyDirection)}</p>

        <h3 style="margin:18px 0 8px 0;">On-Screen Suggestions</h3>
        <ul style="line-height:1.8;">
          ${
            suggestions.length > 0
              ? suggestions
                  .map(
                    (item) =>
                      `<li><strong>${escapeHtml(item.program)}</strong> — ${escapeHtml(
                        item.strength.toUpperCase()
                      )}<br /><span style="color:#475569;">${escapeHtml(
                        (item.notes || []).join(" | ")
                      )}</span></li>`
                  )
                  .join("")
              : "<li>No structured suggestions were available.</li>"
          }
        </ul>

        <h3 style="margin:18px 0 8px 0;">Strengths</h3>
        <ul style="line-height:1.8;">
          ${summary.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Risk Flags</h3>
        <ul style="line-height:1.8;">
          ${summary.riskFlags.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Missing Items</h3>
        <ul style="line-height:1.8;">
          ${summary.missingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Recommended Next Step</h3>
        <p style="line-height:1.7;">${nl2br(summary.recommendedNextStep)}</p>

        <h3 style="margin:18px 0 8px 0;">Action Items</h3>
        <ul style="line-height:1.8;">
          ${summary.actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Conversation Transcript</h2>
        ${buildTranscriptHtml(messages)}
      </div>
    </div>
  `;
}

async function sendProfessionalEmail(args: {
  scenario: TeamScenario;
  messages: TeamChatMessage[];
  suggestions: SuggestionItem[];
  summary: {
    executiveSummary: string;
    likelyDirection: string;
    strengths: string[];
    riskFlags: string[];
    missingItems: string[];
    recommendedNextStep: string;
    actionItems: string[];
  };
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom =
    process.env.RESEND_FROM_EMAIL ||
    "Beyond Intelligence <noreply@beyondfinancing.com>";

  if (!resendApiKey) {
    return { success: false, error: "Missing RESEND_API_KEY." };
  }

  const to = String(args.scenario.professionalEmail || "").trim();
  if (!to) {
    return { success: false, error: "Professional email is required." };
  }

  const subject = `Beyond Intelligence Professional Review — ${
    args.scenario.borrowerName || "Scenario"
  }`;

  const html = buildSummaryHtml(args);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject,
      html,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    return { success: false, error: text };
  }

  return { success: true, raw: text };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TeamRequestBody;
    const action = body.action || "chat";
    const scenario = body.scenario || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const suggestions = Array.isArray(body.suggestions) ? body.suggestions : [];

    if (!scenario.borrowerName || !String(scenario.borrowerName).trim()) {
      return NextResponse.json(
        { success: false, error: "Borrower Scenario Name is required." },
        { status: 400 }
      );
    }

    if (action === "chat") {
      const latestUserMessage =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";

      const system = `
You are Finley Beyond inside the Beyond Intelligence professional workspace.

You are speaking to a mortgage professional such as a loan officer, loan officer assistant, or processor.

Your job:
- collaborate like a sharp mortgage operations assistant
- help narrow likely program direction
- ask practical follow-up questions
- discuss risk layering, missing items, occupancy, documentation path, reserves, and underwriting relevance
- do not sound like a consumer chatbot
- keep answers concise, practical, and professional
- do not promise loan approval
- do not make final underwriting decisions
- speak like an intelligent mortgage scenario analyst
      `.trim();

      const user = `
Professional scenario details:
- Borrower scenario name: ${scenario.borrowerName || "Not provided"}
- Professional name: ${scenario.professionalName || "Not provided"}
- Role: ${scenario.role || "Not provided"}
- Loan purpose: ${scenario.loanPurpose || "Not provided"}
- Borrower current state: ${scenario.borrowerCurrentState || "Not provided"}
- Borrower target state: ${scenario.borrowerTargetState || "Not provided"}
- Credit score: ${scenario.credit || "Not provided"}
- Income: ${scenario.income || "Not provided"}
- Debt: ${scenario.debt || "Not provided"}
- Home price: ${scenario.homePrice || "Not provided"}
- Down payment: ${scenario.downPayment || "Not provided"}
- Occupancy: ${scenario.occupancy || "Not provided"}
- Income type: ${scenario.incomeType || "Not provided"}
- Units: ${scenario.units || "Not provided"}
- DSCR: ${scenario.dscr || "Not provided"}

On-screen suggestions:
${
  suggestions.length > 0
    ? suggestions
        .map(
          (item) =>
            `- ${item.program} | ${item.strength} | ${(item.notes || []).join("; ")}`
        )
        .join("\n")
    : "No suggestions available yet."
}

Latest professional message:
${latestUserMessage}

Respond as Finley Beyond for professionals.
      `.trim();

      const aiReply = await callOpenAIChat({ system, user });

      return NextResponse.json({
        success: true,
        reply: aiReply || buildFallbackReply(latestUserMessage, suggestions),
      });
    }

    const fallbackSummary = {
      executiveSummary:
        "The professional used Finley Beyond to review a borrower scenario and narrow likely program direction based on the data entered and the professional conversation.",
      likelyDirection:
        suggestions.length > 0
          ? "The scenario currently points toward one or more preliminary loan directions that should be validated against full documentation, borrower structure, and guideline interpretation."
          : "The scenario needs further clarification before a stronger program direction can be selected.",
      strengths: [
        scenario.credit ? `Credit score entered: ${scenario.credit}.` : "Scenario naming is in place.",
        scenario.homePrice && scenario.downPayment
          ? "Purchase structure was entered with price and down payment."
          : "Initial scenario structure is underway.",
        scenario.occupancy ? `Occupancy entered: ${scenario.occupancy}.` : "Occupancy still needs confirmation.",
      ],
      riskFlags: [
        !scenario.occupancy ? "Occupancy not fully confirmed." : "",
        !scenario.incomeType ? "Income type not fully confirmed." : "",
        !scenario.borrowerTargetState ? "Move-to state not yet entered." : "",
      ].filter(Boolean),
      missingItems: [
        !scenario.incomeType ? "Income type" : "",
        !scenario.occupancy ? "Occupancy" : "",
        !scenario.professionalEmail ? "Professional email" : "",
      ].filter(Boolean),
      recommendedNextStep:
        "Validate borrower structure, confirm documentation path, and compare the leading on-screen program directions against full underwriting and investor requirements.",
      actionItems: [
        "Confirm borrower occupancy and documentation path.",
        "Review reserves, assets, and income continuity.",
        "Compare top preliminary program directions against file strength and risk layering.",
      ],
    };

    const aiSummary = await callOpenAIJson<{
      executiveSummary: string;
      likelyDirection: string;
      strengths: string[];
      riskFlags: string[];
      missingItems: string[];
      recommendedNextStep: string;
      actionItems: string[];
    }>({
      system: `
Return valid JSON only with this exact shape:
{
  "executiveSummary": "string",
  "likelyDirection": "string",
  "strengths": ["string"],
  "riskFlags": ["string"],
  "missingItems": ["string"],
  "recommendedNextStep": "string",
  "actionItems": ["string"]
}

You are creating an internal summary for a mortgage professional who used Finley Beyond.
Be practical, concise, and specific.
Do not promise approval.
      `.trim(),
      user: `
Scenario:
${JSON.stringify(scenario, null, 2)}

Suggestions:
${JSON.stringify(suggestions, null, 2)}

Conversation:
${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}
      `.trim(),
    });

    const summary = aiSummary || fallbackSummary;

    const result = await sendProfessionalEmail({
      scenario,
      messages,
      suggestions,
      summary,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Email send failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error processing professional request." },
      { status: 500 }
    );
  }
}
