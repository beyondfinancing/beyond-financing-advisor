// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/workflow/file-change/route.ts
//
// =============================================================================
//
// CHANGES FROM PRIOR VERSION
//
// 1. FIX A — STATUS-CHANGE DETECTION
//    The route scans `changedFields` for any entry that begins with "Status:"
//    (which is the format the workflow detail page emits — e.g.,
//    "Status: New Scenario → Pre-Approval Review"). When found, the
//    fan-out call to /api/workflow-notify uses eventType: "status_change"
//    instead of "file_change". This routes realtors to the meaningful
//    milestone subject line (e.g., "Pre-Approval Review update for
//    1 Test Street") instead of the generic "Activity update" ping.
//
//    All other field edits continue to use eventType: "file_change".
//
// 2. Added a "Do Not Reply" disclaimer block to the footer of both legacy
//    emails (the change notification and the sender receipt). Same visual
//    style as the dispatcher emails for consistency.
//
// 3. Removed the `reply_to` headers from both Resend sends. Since we are
//    explicitly telling people not to reply, we no longer pre-fill a reply
//    address that would invite them to do so.
//
// Everything else — Supabase audit insert, two legacy emails, the basic
// fan-out structure — is byte-identical to the prior working version.
//
// =============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type WorkflowRole =
  | "loan_officer"
  | "processing"
  | "underwriting"
  | "closer"
  | "assistant";

type RequestBody = {
  loanId?: string;
  fileId?: string;
  changedByRole?: WorkflowRole;
  changedByName?: string;
  changedByEmail?: string;
  notifyName?: string;
  notifyEmail?: string;
  receiptEmail?: string;
  changeSummary?: string;
  changedFields?: string[];
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDoNotReplyHtml(): string {
  return `
    <div style="margin-top:22px;padding:14px 16px;border:1px solid #FCD34D;background:#FFFBEB;border-radius:14px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;font-weight:700;color:#92400E;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:6px;">
        Do Not Reply
      </div>
      <div style="font-size:13px;line-height:1.6;color:#78350F;">
        This is an automated notification from an unmonitored inbox. Please do not reply to this email. To respond or take action, use Workflow Intelligence or contact the assigned loan officer directly.
      </div>
    </div>
  `;
}

// FIX A — status-change detector. The workflow detail page emits entries
// like "Status: New Scenario → Pre-Approval Review" via buildChangedFieldsSummary().
// We do a tolerant prefix check (case-insensitive, leading whitespace stripped)
// so it still works if the field-summary format ever shifts slightly.
function changedFieldsContainStatus(changedFields: string[]): boolean {
  return changedFields.some((entry) => {
    const normalized = String(entry || "").trimStart().toLowerCase();
    return normalized.startsWith("status:");
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const loanId = String(body.loanId || "").trim();
    const fileId = String(body.fileId || "").trim();
    const changedByRole = String(body.changedByRole || "").trim();
    const changedByName = String(body.changedByName || "").trim();
    const changedByEmail = String(body.changedByEmail || "").trim();
    const notifyName = String(body.notifyName || "").trim();
    const notifyEmail = String(body.notifyEmail || "").trim();
    const receiptEmail = String(body.receiptEmail || changedByEmail).trim();
    const changeSummary = String(body.changeSummary || "").trim();
    const changedFields = Array.isArray(body.changedFields)
      ? body.changedFields.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (
      !loanId ||
      !changedByRole ||
      !changedByEmail ||
      !notifyEmail ||
      !changeSummary
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required file-change fields." },
        { status: 400 }
      );
    }

    const activityInsert = {
      loan_id: loanId,
      file_id: fileId || null,
      from_role: changedByRole,
      from_name: changedByName || null,
      from_email: changedByEmail,
      to_role: "processing",
      to_name: notifyName || null,
      to_email: notifyEmail,
      note_type: "file_change",
      message: changeSummary,
      status: "sent",
    };

    const { data, error } = await supabaseAdmin
      .from("workflow_activity")
      .insert(activityInsert)
      .select("*")
      .single();

    if (error) {
      console.error("WORKFLOW FILE CHANGE INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: "Unable to save file change activity." },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: true,
        warning: "File change saved, but RESEND_API_KEY is missing.",
        activity: data,
      });
    }

    const changedFieldsHtml =
      changedFields.length > 0
        ? `<ul style="line-height:1.8;">${changedFields
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : "<p>No structured field list was provided.</p>";

    const notifyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:720px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin-bottom:16px;">Workflow File Change</h1>
        <p><strong>Loan ID:</strong> ${escapeHtml(loanId)}</p>
        <p><strong>Changed By:</strong> ${escapeHtml(changedByName || changedByEmail)}</p>
        <p><strong>Role:</strong> ${escapeHtml(changedByRole)}</p>
        <p><strong>Recipient:</strong> ${escapeHtml(notifyName || notifyEmail)}</p>

        <h3 style="margin-top:18px;">Change Summary</h3>
        <div style="margin-top:8px;padding:16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fafc;">
          ${escapeHtml(changeSummary).replace(/\n/g, "<br />")}
        </div>

        <h3 style="margin-top:18px;">Changed Fields</h3>
        ${changedFieldsHtml}

        ${buildDoNotReplyHtml()}
      </div>
    `;

    const receiptHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:720px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin-bottom:16px;">Workflow Change Receipt</h1>
        <p>Your file update has been logged and notification has been sent.</p>
        <p><strong>Loan ID:</strong> ${escapeHtml(loanId)}</p>
        <p><strong>Recipient:</strong> ${escapeHtml(notifyName || notifyEmail)}</p>

        <h3 style="margin-top:18px;">Change Summary</h3>
        <div style="margin-top:8px;padding:16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fafc;">
          ${escapeHtml(changeSummary).replace(/\n/g, "<br />")}
        </div>

        ${buildDoNotReplyHtml()}
      </div>
    `;

    const resendHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    };

    const notifySend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({
        from: "Beyond Intelligence <finley@beyondfinancing.com>",
        to: [notifyEmail],
        subject: `[Workflow File Change] ${loanId}`,
        html: notifyHtml,
      }),
    });

    const receiptSend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({
        from: "Beyond Intelligence <finley@beyondfinancing.com>",
        to: [receiptEmail],
        subject: `[Workflow Receipt] File change logged for ${loanId}`,
        html: receiptHtml,
      }),
    });

    const notifyResult = await notifySend.json().catch(() => null);
    const receiptResult = await receiptSend.json().catch(() => null);

    // FIX A — status-change detection.
    // If any of the changed fields is a Status delta, send eventType
    // "status_change" to the dispatcher so realtors get the meaningful
    // milestone subject. Otherwise stay on "file_change".
    const dispatcherEventType = changedFieldsContainStatus(changedFields)
      ? "status_change"
      : "file_change";

    // Trigger comprehensive workflow notification (internal team full content + realtor activity ping)
    let comprehensiveNotifyResult: unknown = null;
    if (fileId) {
      try {
        const url = new URL(req.url);
        const origin = url.origin;
        const compNotifyResponse = await fetch(`${origin}/api/workflow-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowFileId: fileId,
            eventType: dispatcherEventType,
            actorName: changedByName,
            actorRole: changedByRole,
            actorEmail: changedByEmail,
            changeDetails: changeSummary,
            changedFields,
          }),
        });
        comprehensiveNotifyResult = await compNotifyResponse.json().catch(() => null);
      } catch (notifyError) {
        console.error("WORKFLOW FILE CHANGE COMPREHENSIVE NOTIFY ERROR:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      activity: data,
      notifyEmailSent: notifySend.ok,
      receiptEmailSent: receiptSend.ok,
      dispatcherEventType,
      notifyResult,
      receiptResult,
      comprehensiveNotifyResult,
    });
  } catch (error) {
    console.error("WORKFLOW FILE CHANGE ROUTE ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
