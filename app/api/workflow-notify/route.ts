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

type NotificationEventType = "created" | "status_change";

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
};

type NotificationRecipient = {
  role: "listing_agent" | "buyer_agent";
  name: string;
  email: string;
  phone: string;
};

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

function getStatusDisplay(status: WorkflowStatus, eventType: NotificationEventType) {
  if (eventType === "created") {
    return "Loan Registered";
  }

  switch (status) {
    case "new_scenario":
      return "Loan Registered";
    case "pre_approval_review":
      return "Pre-Approval Review";
    case "sent_to_processing":
      return "Processing";
    case "processing_active":
      return "Processing";
    case "submitted_to_lender":
      return "Underwriting";
    case "conditional_approval":
      return "Conditionally Approved";
    case "clear_to_close":
      return "Clear to Close";
    case "closed":
      return "Loan Funded";
    default:
      return "Loan Update";
  }
}

function buildAgentMessage(params: {
  eventType: NotificationEventType;
  status: WorkflowStatus;
  propertyAddress: string;
  borrowerName: string;
}) {
  const propertyAddress = params.propertyAddress || "the subject property";
  const borrowerName = params.borrowerName || "the borrower";
  const milestone = getStatusDisplay(params.status, params.eventType);

  if (params.eventType === "created" || params.status === "new_scenario") {
    return {
      subject: `Loan registered for ${propertyAddress}`,
      emailTitle: "Loan file registered",
      emailBody: `This is a courtesy notification that financing activity has been registered for ${borrowerName} regarding ${propertyAddress}. The file is now active within the Beyond Financing workflow.`,
      smsBody: `Beyond Financing update: financing activity has been registered for ${propertyAddress}.`,
      isFinal: false,
    };
  }

  if (params.status === "closed") {
    return {
      subject: `Final funding update for ${propertyAddress}`,
      emailTitle: "Final funding update",
      emailBody: `This is a final courtesy notification that the loan for ${propertyAddress} has been completed and funded. No further automated workflow notifications will be sent for this file.`,
      smsBody: `Beyond Financing final update: the loan for ${propertyAddress} has been funded. No further automated updates will be sent.`,
      isFinal: true,
    };
  }

  if (params.status === "clear_to_close") {
    return {
      subject: `Clear to Close update for ${propertyAddress}`,
      emailTitle: "Clear to Close update",
      emailBody: `This is a courtesy notification that the loan for ${propertyAddress} has reached the Clear to Close stage and continues moving toward closing.`,
      smsBody: `Beyond Financing update: ${propertyAddress} has reached Clear to Close.`,
      isFinal: false,
    };
  }

  return {
    subject: `Financing update for ${propertyAddress}`,
    emailTitle: milestone,
    emailBody: `This is a courtesy notification that financing activity has advanced for ${propertyAddress}. The loan file continues progressing through the mortgage process.`,
    smsBody: `Beyond Financing update: the loan file for ${propertyAddress} has advanced in the mortgage process.`,
    isFinal: false,
  };
}

async function sendResendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
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
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    skipped: false,
    providerMessageId: String(data?.id || ""),
    raw: data,
  };
}

async function sendTwilioSms({
  to,
  body,
}: {
  to: string;
  body: string;
}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from || !to) {
    return { ok: false, skipped: true, providerMessageId: "" };
  }

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body);

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
    raw: data,
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
  providerMessageId?: string;
  messageSubject: string;
  messageBody: string;
}) {
  await supabaseAdmin.from("workflow_notifications").insert({
    workflow_file_id: params.workflowFileId,
    file_number: params.fileNumber || null,
    borrower_name: params.borrowerName || null,
    property_address: params.propertyAddress || null,
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const workflowFileId = String(body.workflowFileId || "").trim();
    const eventType = (body.eventType || "status_change") as NotificationEventType;

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

    const rawRecipients: NotificationRecipient[] = [
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

const recipients: NotificationRecipient[] = rawRecipients.filter(
  (item) => Boolean(item.email || item.phone)
);

const recipients = rawRecipients.filter(
  (item) => Boolean(item.email || item.phone)
);

    if (recipients.length === 0) {
      if (status === "closed") {
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
        skipped: true,
        reason: "No agent recipients were found on this workflow file.",
      });
    }

    const propertyAddress = String(file.property_address || "").trim();
    const borrowerName = String(file.borrower_name || "").trim();
    const fileNumber = String(file.file_number || "").trim();

    const message = buildAgentMessage({
      eventType,
      status,
      propertyAddress,
      borrowerName,
    });

    const results: Array<Record<string, string | boolean>> = [];

    for (const recipient of recipients) {
      if (recipient.email) {
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:760px;margin:0 auto;padding:24px;">
            <h1 style="margin:0 0 18px 0;color:#263366;">${escapeHtml(message.emailTitle)}</h1>
            <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
              <p style="line-height:1.8;">Hello ${escapeHtml(recipient.name || "Agent")},</p>
              <p style="line-height:1.8;">${escapeHtml(message.emailBody)}</p>
              <p style="line-height:1.8;"><strong>Property:</strong> ${escapeHtml(propertyAddress || "Not provided")}</p>
              <p style="line-height:1.8;"><strong>Borrower:</strong> ${escapeHtml(borrowerName || "Not provided")}</p>
              <p style="line-height:1.8;"><strong>Workflow Reference:</strong> ${escapeHtml(fileNumber || "Not assigned")}</p>
              <p style="line-height:1.8;">This courtesy update does not disclose internal processing details and does not constitute loan approval.</p>
            </div>
          </div>
        `;

        const emailResult = await sendResendEmail({
          to: recipient.email,
          subject: message.subject,
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
          messageSubject: message.subject,
          messageBody: message.emailBody,
        });

        results.push({
          recipientRole: recipient.role,
          channel: "email",
          recipient: recipient.email,
          success: emailResult.ok,
        });
      }

      if (recipient.phone) {
        const smsResult = await sendTwilioSms({
          to: recipient.phone,
          body: message.smsBody,
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
          messageSubject: message.subject,
          messageBody: message.smsBody,
        });

        results.push({
          recipientRole: recipient.role,
          channel: "sms",
          recipient: recipient.phone,
          success: smsResult.ok,
        });
      }
    }

    if (message.isFinal) {
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
