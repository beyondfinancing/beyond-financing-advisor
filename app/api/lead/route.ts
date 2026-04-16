import { NextResponse } from "next/server";

type PreferredLanguage = "English" | "Português" | "Español";
type LeadTrigger = "apply" | "schedule" | "contact";

type LeadPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: PreferredLanguage;
  loanOfficer?: string;
  assignedEmail?: string;
  notes?: string;
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

function buildLeadHtml(args: {
  lead: LeadPayload;
  trigger: LeadTrigger;
  assignedEmail: string;
}) {
  const { lead, trigger, assignedEmail } = args;

  const triggerLabel =
    trigger === "apply"
      ? "Borrower clicked Apply Now"
      : trigger === "schedule"
      ? "Borrower clicked Schedule with Loan Officer"
      : "Borrower clicked Email / Contact";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:860px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">New Beyond Intelligence Lead Event</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <p><strong>Trigger:</strong> ${escapeHtml(triggerLabel)}</p>
        <p><strong>Full Name:</strong> ${escapeHtml(lead.fullName || "Not provided")}</p>
        <p><strong>Email:</strong> ${escapeHtml(lead.email || "Not provided")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(lead.phone || "Not provided")}</p>
        <p><strong>Preferred Language:</strong> ${escapeHtml(
          lead.preferredLanguage || "Not provided"
        )}</p>
        <p><strong>Selected Loan Officer:</strong> ${escapeHtml(
          lead.loanOfficer || "Not provided"
        )}</p>
        <p><strong>Assigned Email:</strong> ${escapeHtml(assignedEmail)}</p>
        <p><strong>Notes:</strong><br />${nl2br(lead.notes || "No notes provided.")}</p>
      </div>
    </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const lead = (body?.lead || {}) as LeadPayload;
    const trigger = (body?.trigger || "contact") as LeadTrigger;

    const fullName = String(lead.fullName || "").trim();
    const email = String(lead.email || "").trim();
    const preferredLanguage = String(lead.preferredLanguage || "").trim();
    const loanOfficer = String(lead.loanOfficer || "").trim().toLowerCase();

    if (!fullName || !email || !preferredLanguage || !loanOfficer) {
      return NextResponse.json(
        { success: false, error: "Missing required lead details." },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const assignedEmail =
      String(lead.assignedEmail || "").trim() ||
      loanOfficerMap[loanOfficer] ||
      "finley@beyondfinancing.com";

    const html = buildLeadHtml({
      lead,
      trigger,
      assignedEmail,
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
        to: [assignedEmail],
        subject: `Lead Event: ${fullName} - ${trigger}`,
        reply_to: email,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assignedEmail,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
