// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/workflow-notify/route.ts
//
// =============================================================================
//
// CHANGE FROM PRIOR VERSION
//
// The internal-team email body now ends with a clear "Open This File in
// Workflow Intelligence" call-to-action button that deep-links to the
// specific workflow file:
//
//     ${APP_URL}/workflow/{workflowFileId}
//
// If the visitor isn't logged in when they click, /workflow now renders the
// shared TeamLoginCard component inline so they can sign in without the
// detour to /team.
//
// The deep-link target is built from process.env.NEXT_PUBLIC_APP_URL with a
// safe default of https://beyondintelligence.io. This means preview deploys
// can override and you don't ship a hardcoded URL into a non-production
// environment.
//
// Realtor courtesy emails are unchanged — no internal links are ever sent
// to listing agents or buyer agents.
//
// Everything else (recipient lookup, Phase 1 hardcoded email maps, audit
// logging into workflow_notifications, Twilio SMS branch, final-close
// deactivation logic) is byte-identical to the prior working version.
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type WorkflowStatus =
  | "new_scenario"
  | "pre_approval_review"
  | "sent_to_processing"
  | "processing_active"
  | "submitted_to_lender"
  | "conditional_approval"
  | "clear_to_close"
  | "closed";

type NotificationEventType =
  | "created"
  | "status_change"
  | "file_change"
  | "internal_update";

type WorkflowFileRecord = {
  id: string;
  file_number?: string | null;
  borrower_name?: string | null;
  purpose?: string | null;
  amount?: number | string | null;
  status?: WorkflowStatus | null;
  urgency?: string | null;
  loan_officer?: string | null;
  processor?: string | null;
  production_manager?: string | null;
  requested_processor_note?: string | null;
  target_close?: string | null;
  occupancy?: string | null;
  blocker?: string | null;
  next_internal_action?: string | null;
  next_borrower_action?: string | null;
  latest_update?: string | null;
  property_address?: string | null;
  listing_agent_name?: string | null;
  listing_agent_email?: string | null;
  listing_agent_phone?: string | null;
  buyer_agent_name?: string | null;
  buyer_agent_email?: string | null;
  buyer_agent_phone?: string | null;
  notification_active?: boolean | null;
  final_notification_sent?: boolean | null;
};

type RequestBody = {
  workflowFileId?: string;
  eventType?: NotificationEventType;
  actorName?: string;
  actorRole?: string;
  actorEmail?: string;
  changeDetails?: string;
  changedFields?: string[];
  noteText?: string;
};

// ---- App URL for deep links (env-configurable, safe default) ----

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "https://beyondintelligence.io"
).replace(/\/+$/, ""); // strip any trailing slash

function buildWorkflowDeepLink(workflowFileId: string): string {
  // Always link to the file-specific workflow record. /workflow/[id] handles
  // unauthenticated visitors by routing them through the shared login card
  // and then back to the requested file.
  return `${APP_URL}/workflow/${encodeURIComponent(workflowFileId)}`;
}

// ---- Internal team email lookup (Phase 1: hardcoded; Phase 2: query team_users) ----

const PROCESSOR_EMAIL_MAP: Record<string, string> = {
  "Amarilis Santos": "amarilis@beyondfinancing.com",
  "Kyle Nicholson": "kyle@beyondfinancing.com",
  "Bia Marques": "bia@beyondfinancing.com",
};

const LOAN_OFFICER_EMAIL_MAP: Record<string, string> = {
  "Sandro Pansini Souza": "pansini@beyondfinancing.com",
  "Warren Wendt": "warren@beyondfinancing.com",
  "Finley Beyond": "finley@beyondfinancing.com",
};

const LOAN_OFFICER_FALLBACK_EMAIL = "pansini@beyondfinancing.com";
const PRODUCTION_MANAGER_NAME = "Amarilis Santos";
const PRODUCTION_MANAGER_EMAIL = "amarilis@beyondfinancing.com";

type InternalRecipient = {
  role: "loan_officer" | "production_manager" | "processor";
  name: string;
  email: string;
};

type RealtorRecipient = {
  role: "listing_agent" | "buyer_agent";
  name: string;
  email: string;
  phone: string;
};

// ---- Helpers ----

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(value || "").startsWith("+")) return String(value || "").trim();
  return `+${digits}`;
}

function getStatusLabel(status: WorkflowStatus): string {
  switch (status) {
    case "new_scenario": return "New Scenario";
    case "pre_approval_review": return "Pre-Approval Review";
    case "sent_to_processing": return "Sent to Processing";
    case "processing_active": return "Processing Active";
    case "submitted_to_lender": return "Submitted to Lender";
    case "conditional_approval": return "Conditional Approval";
    case "clear_to_close": return "Clear to Close";
    case "closed": return "Closed / Funded";
    default: return String(status);
  }
}

function getRealtorMilestone(
  status: WorkflowStatus,
  eventType: NotificationEventType
): string {
  if (eventType === "created" || status === "new_scenario") return "Loan Registered";
  if (status === "closed") return "Loan Funded";
  if (status === "clear_to_close") return "Clear to Close";
  if (status === "conditional_approval") return "Conditionally Approved";
  if (status === "submitted_to_lender") return "Underwriting";
  if (status === "sent_to_processing" || status === "processing_active") return "Processing";
  if (status === "pre_approval_review") return "Pre-Approval Review";
  return "Loan Update";
}

function formatCurrency(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "Not provided";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatTargetClose(value: string | null | undefined): string {
  if (!value) return "No date set";
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  if (!isoMatch) return String(value);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US").format(date);
}

// ---- Recipient builders ----

function buildInternalRecipients(file: WorkflowFileRecord): InternalRecipient[] {
  const recipients: InternalRecipient[] = [];

  // Loan Officer (lookup with fallback)
  const loanOfficerName = String(file.loan_officer || "").trim();
  if (loanOfficerName) {
    recipients.push({
      role: "loan_officer",
      name: loanOfficerName,
      email: LOAN_OFFICER_EMAIL_MAP[loanOfficerName] || LOAN_OFFICER_FALLBACK_EMAIL,
    });
  }

  // Production Manager (always Amarilis for now)
  recipients.push({
    role: "production_manager",
    name: PRODUCTION_MANAGER_NAME,
    email: PRODUCTION_MANAGER_EMAIL,
  });

  // Processor (only if assigned and in map)
  const processorName = String(file.processor || "").trim();
  if (
    processorName &&
    processorName !== "Unassigned" &&
    PROCESSOR_EMAIL_MAP[processorName]
  ) {
    recipients.push({
      role: "processor",
      name: processorName,
      email: PROCESSOR_EMAIL_MAP[processorName],
    });
  }

  // Dedupe by email
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const key = r.email.toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRealtorRecipients(file: WorkflowFileRecord): RealtorRecipient[] {
  const list: RealtorRecipient[] = [
    {
      role: "listing_agent",
      name: String(file.listing_agent_name || "").trim(),
      email: String(file.listing_agent_email || "").trim(),
      phone: normalizePhone(String(file.listing_agent_phone || "")),
    },
    {
      role: "buyer_agent",
      name: String(file.buyer_agent_name || "").trim(),
      email: String(file.buyer_agent_email || "").trim(),
      phone: normalizePhone(String(file.buyer_agent_phone || "")),
    },
  ];
  return list.filter((r) => Boolean(r.email || r.phone));
}

// ---- Message builders ----

function buildRealtorMessage(params: {
  eventType: NotificationEventType;
  status: WorkflowStatus;
  file: WorkflowFileRecord;
}): {
  subject: string;
  emailTitle: string;
  emailBody: string;
  smsBody: string;
  isFinal: boolean;
} {
  const { eventType, status, file } = params;
  const propertyAddress = String(file.property_address || "the subject property").trim();
  const borrowerName = String(file.borrower_name || "the borrower").trim();
  const milestone = getRealtorMilestone(status, eventType);

  if (eventType === "created" || status === "new_scenario") {
    return {
      subject: `Loan registered for ${propertyAddress}`,
      emailTitle: "Loan file registered",
      emailBody: `This is a courtesy notification that financing activity has been registered for ${borrowerName} regarding ${propertyAddress}. The file is now active within the Beyond Financing workflow.`,
      smsBody: `Beyond Financing update: financing activity has been registered for ${propertyAddress}.`,
      isFinal: false,
    };
  }

  if (status === "closed") {
    return {
      subject: `Final funding update for ${propertyAddress}`,
      emailTitle: "Final funding update",
      emailBody: `This is a final courtesy notification that the loan for ${propertyAddress} has been completed and funded. No further automated workflow notifications will be sent for this file.`,
      smsBody: `Beyond Financing final update: the loan for ${propertyAddress} has been funded.`,
      isFinal: true,
    };
  }

  if (eventType === "status_change") {
    return {
      subject: `${milestone} update for ${propertyAddress}`,
      emailTitle: `${milestone} update`,
      emailBody: `This is a courtesy notification that the loan for ${propertyAddress} has reached the ${milestone} stage and continues moving through the mortgage process.`,
      smsBody: `Beyond Financing update: ${propertyAddress} is now at ${milestone}.`,
      isFinal: false,
    };
  }

  // file_change or internal_update — generic activity ping, no detail content
  return {
    subject: `Activity update for ${propertyAddress}`,
    emailTitle: "There has been activity on this file",
    emailBody: `This is a courtesy notification that there has been activity on the loan file for ${propertyAddress}. The file remains active within the Beyond Financing workflow. The current stage is ${milestone}.`,
    smsBody: `Beyond Financing update: there has been activity on the loan file for ${propertyAddress}.`,
    isFinal: false,
  };
}

function buildInternalEmailHtml(params: {
  eventType: NotificationEventType;
  file: WorkflowFileRecord;
  recipientName: string;
  actorName: string;
  actorRole: string;
  changeDetails: string;
  changedFields: string[];
  noteText: string;
  workflowFileId: string;
}): string {
  const {
    eventType, file, recipientName, actorName, actorRole,
    changeDetails, changedFields, noteText, workflowFileId,
  } = params;

  const status = (file.status || "new_scenario") as WorkflowStatus;
  const statusLabel = getStatusLabel(status);
  const propertyAddress = String(file.property_address || "Not provided");
  const borrowerName = String(file.borrower_name || "Not provided");
  const loanNumber = String(file.file_number || "Not assigned");
  const purpose = String(file.purpose || "Not specified");
  const loanOfficer = String(file.loan_officer || "Not assigned");
  const processor = String(file.processor || "Unassigned");
  const targetClose = formatTargetClose(file.target_close);
  const amount = formatCurrency(file.amount);
  const latestUpdate = String(file.latest_update || "");

  const deepLinkUrl = buildWorkflowDeepLink(workflowFileId);

  let eventTitle = "Workflow File Update";
  let eventNarrative = "";

  if (eventType === "created") {
    eventTitle = "Workflow file created";
    eventNarrative = `${actorName || "Team member"} (${actorRole || "Professional"}) registered this file in Workflow Intelligence.`;
  } else if (eventType === "status_change") {
    eventTitle = `Status changed to ${statusLabel}`;
    eventNarrative = `${actorName || "Team member"} (${actorRole || "Professional"}) advanced this file. ${changeDetails || ""}`.trim();
  } else if (eventType === "file_change") {
    eventTitle = "File details updated";
    eventNarrative = `${actorName || "Team member"} (${actorRole || "Professional"}) updated this file. ${changeDetails || ""}`.trim();
  } else {
    eventTitle = "Internal note posted";
    eventNarrative = `${actorName || "Team member"} (${actorRole || "Professional"}) posted an internal update on this file.`;
  }

  const changedFieldsHtml = changedFields.length > 0
    ? `<h3 style="margin:18px 0 8px 0;">Changed Fields</h3>
       <ul style="line-height:1.8;">${changedFields
         .map((f) => `<li>${escapeHtml(f)}</li>`)
         .join("")}</ul>`
    : "";

  const noteTextHtml = noteText
    ? `<h3 style="margin:18px 0 8px 0;">Internal Note</h3>
       <div style="margin-top:8px;padding:14px 16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fafc;line-height:1.7;">
         ${escapeHtml(noteText).replace(/\n/g, "<br />")}
       </div>`
    : "";

  // Deep-link CTA block. Uses table-based button markup so it renders
  // consistently across Gmail, Outlook, Apple Mail, and mobile clients
  // (table is the most reliable email-button structure).
  const ctaBlockHtml = `
    <div style="margin:24px 0 8px 0;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td align="center" bgcolor="#263366" style="border-radius:14px;">
            <a href="${escapeHtml(deepLinkUrl)}"
               style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;background-color:#263366;">
              Open This File in Workflow Intelligence
            </a>
          </td>
        </tr>
      </table>
      <div style="margin-top:12px;font-size:13px;color:#64748B;line-height:1.6;">
        Sign-in is required. If you are not currently logged in, you will be prompted to sign in directly on the workflow page.
      </div>
      <div style="margin-top:8px;font-size:12px;color:#94A3B8;line-height:1.6;word-break:break-all;">
        Direct link: <a href="${escapeHtml(deepLinkUrl)}" style="color:#64748B;text-decoration:underline;">${escapeHtml(deepLinkUrl)}</a>
      </div>
    </div>
  `;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">${escapeHtml(eventTitle)}</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <p style="line-height:1.8;margin-top:0;">Hello ${escapeHtml(recipientName || "Team")},</p>
        <p style="line-height:1.8;">${escapeHtml(eventNarrative)}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:18px;">Loan Details</h2>
        <p style="margin:6px 0;line-height:1.7;"><strong>Loan Number:</strong> ${escapeHtml(loanNumber)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Borrower:</strong> ${escapeHtml(borrowerName)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Property Address:</strong> ${escapeHtml(propertyAddress)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Loan Purpose:</strong> ${escapeHtml(purpose)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Amount:</strong> ${escapeHtml(amount)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Target Close:</strong> ${escapeHtml(targetClose)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Loan Officer:</strong> ${escapeHtml(loanOfficer)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Processor:</strong> ${escapeHtml(processor)}</p>
        ${latestUpdate ? `<p style="margin:6px 0;line-height:1.7;"><strong>Latest Update:</strong> ${escapeHtml(latestUpdate)}</p>` : ""}
      </div>

      ${changedFieldsHtml}
      ${noteTextHtml}

      ${ctaBlockHtml}

      <div style="margin-top:18px;color:#64748B;font-size:13px;line-height:1.6;">
        Internal team notification from Beyond Intelligence Workflow Intelligence. Realtor agents receive a separate courtesy update without internal note content.
      </div>
    </div>
  `;
}

function buildRealtorEmailHtml(params: {
  emailTitle: string;
  emailBody: string;
  recipientName: string;
  propertyAddress: string;
  borrowerName: string;
  loanNumber: string;
  purpose: string;
  amount: string;
  loanOfficer: string;
  statusLabel: string;
  targetClose: string;
}): string {
  const {
    emailTitle, emailBody, recipientName,
    propertyAddress, borrowerName, loanNumber,
    purpose, amount, loanOfficer, statusLabel, targetClose,
  } = params;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">${escapeHtml(emailTitle)}</h1>
      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <p style="line-height:1.8;">Hello ${escapeHtml(recipientName || "Agent")},</p>
        <p style="line-height:1.8;">${escapeHtml(emailBody)}</p>

        <h3 style="margin:18px 0 8px 0;">File Details</h3>
        <p style="margin:6px 0;line-height:1.7;"><strong>Loan Number:</strong> ${escapeHtml(loanNumber)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Borrower:</strong> ${escapeHtml(borrowerName)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Loan Purpose:</strong> ${escapeHtml(purpose)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Amount:</strong> ${escapeHtml(amount)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Loan Officer:</strong> ${escapeHtml(loanOfficer)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Current Status:</strong> ${escapeHtml(statusLabel)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Target Close:</strong> ${escapeHtml(targetClose)}</p>
        <p style="margin:6px 0;line-height:1.7;"><strong>Property:</strong> ${escapeHtml(propertyAddress)}</p>

        <p style="line-height:1.8;margin-top:18px;color:#64748B;font-size:13px;">This courtesy update does not disclose internal processing details and does not constitute loan approval.</p>
      </div>
    </div>
  `;
}

// ---- Senders ----

async function sendResendEmail(params: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, skipped: true, providerMessageId: "" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Beyond Intelligence <finley@beyondfinancing.com>",
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    skipped: false,
    providerMessageId: String(data?.id || ""),
  };
}

async function sendTwilioSms(params: { to: string; body: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from || !params.to) {
    return { ok: false, skipped: true, providerMessageId: "" };
  }

  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("From", from);
  form.set("Body", params.body);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    skipped: false,
    providerMessageId: String(data?.sid || ""),
  };
}

async function logNotification(params: {
  workflowFileId: string;
  fileNumber: string;
  borrowerName: string;
  propertyAddress: string;
  eventType: string;
  workflowStatus: string;
  recipientRole: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  deliveryChannel: "email" | "sms";
  deliveryStatus: string;
  providerMessageId: string;
  messageSubject: string;
  messageBody: string;
}) {
  // Set BOTH notification_type and event_type to the same value so this
  // works whether the schema treats notification_type or event_type as
  // canonical. notification_type is NOT NULL in the current schema.
  await supabaseAdmin.from("workflow_notifications").insert({
    workflow_file_id: params.workflowFileId,
    file_number: params.fileNumber || null,
    borrower_name: params.borrowerName || null,
    property_address: params.propertyAddress || null,
    notification_type: params.eventType,
    event_type: params.eventType,
    workflow_status: params.workflowStatus,
    recipient_role: params.recipientRole,
    recipient_name: params.recipientName || null,
    recipient_email: params.recipientEmail || null,
    recipient_phone: params.recipientPhone || null,
    delivery_channel: params.deliveryChannel,
    delivery_status: params.deliveryStatus,
    provider_message_id: params.providerMessageId || null,
    message_subject: params.messageSubject || null,
    message_body: params.messageBody || null,
  });
}

// ---- Handler ----

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const workflowFileId = String(body.workflowFileId || "").trim();
    const eventType = (body.eventType || "status_change") as NotificationEventType;
    const actorName = String(body.actorName || "").trim();
    const actorRole = String(body.actorRole || "").trim();
    const changeDetails = String(body.changeDetails || "").trim();
    const changedFields = Array.isArray(body.changedFields)
      ? body.changedFields.map((f) => String(f || "").trim()).filter(Boolean)
      : [];
    const noteText = String(body.noteText || "").trim();

    if (!workflowFileId) {
      return NextResponse.json(
        { success: false, error: "Missing workflowFileId." },
        { status: 400 }
      );
    }

    const { data: file, error } = await supabaseAdmin
      .from("workflow_files")
      .select("*")
      .eq("id", workflowFileId)
      .single<WorkflowFileRecord>();

    if (error || !file) {
      return NextResponse.json(
        { success: false, error: "Workflow file not found." },
        { status: 404 }
      );
    }

    const status = (file.status || "new_scenario") as WorkflowStatus;

    if (file.notification_active === false && status !== "closed") {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Notifications are inactive for this file.",
      });
    }

    if (status === "closed" && file.final_notification_sent) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Final notification already sent.",
      });
    }

    const realtorMessage = buildRealtorMessage({ eventType, status, file });
    const realtorRecipients = buildRealtorRecipients(file);
    const internalRecipients = buildInternalRecipients(file);

    const propertyAddress = String(file.property_address || "").trim();
    const borrowerName = String(file.borrower_name || "").trim();
    const fileNumber = String(file.file_number || "").trim();
    const purpose = String(file.purpose || "").trim();
    const loanOfficer = String(file.loan_officer || "").trim();
    const statusLabel = getStatusLabel(status);
    const targetClose = formatTargetClose(file.target_close);
    const amount = formatCurrency(file.amount);

    const results: Array<Record<string, string | boolean>> = [];

    // ---- INTERNAL TEAM (always full content + deep-link CTA) ----
    for (const recipient of internalRecipients) {
      const html = buildInternalEmailHtml({
        eventType,
        file,
        recipientName: recipient.name,
        actorName,
        actorRole,
        changeDetails,
        changedFields,
        noteText,
        workflowFileId,
      });

      let internalSubject = "";
      if (eventType === "created") {
        internalSubject = `[Workflow] New file created: ${borrowerName || "Borrower"} — ${propertyAddress || fileNumber || "No address"}`;
      } else if (eventType === "status_change") {
        internalSubject = `[Workflow] Status: ${statusLabel} — ${borrowerName || fileNumber}`;
      } else if (eventType === "file_change") {
        internalSubject = `[Workflow] File updated: ${borrowerName || fileNumber}`;
      } else {
        internalSubject = `[Workflow] Internal note: ${borrowerName || fileNumber}`;
      }

      const emailResult = await sendResendEmail({
        to: recipient.email,
        subject: internalSubject,
        html,
      });

      await logNotification({
        workflowFileId,
        fileNumber,
        borrowerName,
        propertyAddress,
        eventType,
        workflowStatus: status,
        recipientRole: recipient.role,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientPhone: "",
        deliveryChannel: "email",
        deliveryStatus: emailResult.ok
          ? "sent"
          : emailResult.skipped
          ? "skipped"
          : "failed",
        providerMessageId: emailResult.providerMessageId,
        messageSubject: internalSubject,
        messageBody: `Internal team notification — ${eventType}`,
      });

      results.push({
        audience: "internal",
        recipientRole: recipient.role,
        channel: "email",
        recipient: recipient.email,
        success: emailResult.ok,
      });
    }

    // ---- REALTORS (courtesy summary, no internal note content, no deep link) ----
    for (const recipient of realtorRecipients) {
      if (recipient.email) {
        const html = buildRealtorEmailHtml({
          emailTitle: realtorMessage.emailTitle,
          emailBody: realtorMessage.emailBody,
          recipientName: recipient.name,
          propertyAddress,
          borrowerName,
          loanNumber: fileNumber || "Not assigned",
          purpose: purpose || "Not specified",
          amount,
          loanOfficer: loanOfficer || "Not assigned",
          statusLabel,
          targetClose,
        });

        const emailResult = await sendResendEmail({
          to: recipient.email,
          subject: realtorMessage.subject,
          html,
        });

        await logNotification({
          workflowFileId,
          fileNumber,
          borrowerName,
          propertyAddress,
          eventType,
          workflowStatus: status,
          recipientRole: recipient.role,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientPhone: recipient.phone,
          deliveryChannel: "email",
          deliveryStatus: emailResult.ok
            ? "sent"
            : emailResult.skipped
            ? "skipped"
            : "failed",
          providerMessageId: emailResult.providerMessageId,
          messageSubject: realtorMessage.subject,
          messageBody: realtorMessage.emailBody,
        });

        results.push({
          audience: "realtor",
          recipientRole: recipient.role,
          channel: "email",
          recipient: recipient.email,
          success: emailResult.ok,
        });
      }

      if (recipient.phone) {
        const smsResult = await sendTwilioSms({
          to: recipient.phone,
          body: realtorMessage.smsBody,
        });

        await logNotification({
          workflowFileId,
          fileNumber,
          borrowerName,
          propertyAddress,
          eventType,
          workflowStatus: status,
          recipientRole: recipient.role,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientPhone: recipient.phone,
          deliveryChannel: "sms",
          deliveryStatus: smsResult.ok
            ? "sent"
            : smsResult.skipped
            ? "skipped"
            : "failed",
          providerMessageId: smsResult.providerMessageId,
          messageSubject: realtorMessage.subject,
          messageBody: realtorMessage.smsBody,
        });

        results.push({
          audience: "realtor",
          recipientRole: recipient.role,
          channel: "sms",
          recipient: recipient.phone,
          success: smsResult.ok,
        });
      }
    }

    if (realtorMessage.isFinal) {
      await supabaseAdmin
        .from("workflow_files")
        .update({
          notification_active: false,
          final_notification_sent: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflowFileId);
    }

    return NextResponse.json({
      success: true,
      workflowFileId,
      eventType,
      status,
      internalRecipientCount: internalRecipients.length,
      realtorRecipientCount: realtorRecipients.length,
      results,
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
