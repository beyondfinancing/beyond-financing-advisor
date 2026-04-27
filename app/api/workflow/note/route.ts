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
  fromRole?: WorkflowRole;
  fromName?: string;
  fromEmail?: string;
  toRole?: WorkflowRole;
  toName?: string;
  toEmail?: string;
  noteType?: string;
  message?: string;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const loanId = String(body.loanId || "").trim();
    const fileId = String(body.fileId || "").trim();
    const fromRole = String(body.fromRole || "").trim();
    const fromName = String(body.fromName || "").trim();
    const fromEmail = String(body.fromEmail || "").trim();
    const toRole = String(body.toRole || "").trim();
    const toName = String(body.toName || "").trim();
    const toEmail = String(body.toEmail || "").trim();
    const noteType = String(body.noteType || "note").trim();
    const message = String(body.message || "").trim();

    if (!loanId || !fromRole || !fromEmail || !toRole || !toEmail || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required workflow note fields." },
        { status: 400 }
      );
    }

    const insertPayload = {
      loan_id: loanId,
      file_id: fileId || null,
      from_role: fromRole,
      from_name: fromName || null,
      from_email: fromEmail,
      to_role: toRole,
      to_name: toName || null,
      to_email: toEmail,
      note_type: noteType,
      message,
      status: "sent",
    };

    const { data, error } = await supabaseAdmin
      .from("workflow_activity")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("WORKFLOW ACTIVITY INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: "Unable to save workflow note." },
        { status: 500 }
      );
    }

    const subjectToRecipient = `[Workflow] New note from ${fromName || fromEmail}`;
    const subjectReceipt = `[Workflow Receipt] Your note was delivered`;

    const recipientHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:720px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin-bottom:16px;">New Workflow Note</h1>
        <p><strong>Loan ID:</strong> ${escapeHtml(loanId)}</p>
        <p><strong>From:</strong> ${escapeHtml(fromName || fromEmail)}</p>
        <p><strong>Role:</strong> ${escapeHtml(fromRole)}</p>
        <p><strong>To:</strong> ${escapeHtml(toName || toEmail)}</p>
        <p><strong>Type:</strong> ${escapeHtml(noteType)}</p>
        <div style="margin-top:18px;padding:16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fafc;">
          ${escapeHtml(message).replace(/\n/g, "<br />")}
        </div>
      </div>
    `;

    const receiptHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:720px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin-bottom:16px;">Workflow Receipt</h1>
        <p>Your note has been logged and delivered.</p>
        <p><strong>Loan ID:</strong> ${escapeHtml(loanId)}</p>
        <p><strong>Sent To:</strong> ${escapeHtml(toName || toEmail)}</p>
        <p><strong>Type:</strong> ${escapeHtml(noteType)}</p>
        <div style="margin-top:18px;padding:16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fafc;">
          ${escapeHtml(message).replace(/\n/g, "<br />")}
        </div>
      </div>
    `;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: true,
        warning: "Workflow note saved, but RESEND_API_KEY is missing.",
        activity: data,
      });
    }

    const resendHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    };

    const recipientSend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({
        from: "Beyond Intelligence <finley@beyondfinancing.com>",
        to: [toEmail],
        reply_to: fromEmail,
        subject: subjectToRecipient,
        html: recipientHtml,
      }),
    });

    const receiptSend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({
        from: "Beyond Intelligence <finley@beyondfinancing.com>",
        to: [fromEmail],
        reply_to: toEmail,
        subject: subjectReceipt,
        html: receiptHtml,
      }),
    });

    const recipientResult = await recipientSend.json().catch(() => null);
    const receiptResult = await receiptSend.json().catch(() => null);

    // Trigger comprehensive workflow notification (internal team full content + realtor activity ping)
    let comprehensiveNotifyResult: unknown = null;
    if (fileId) {
      try {
        const url = new URL(req.url);
        const origin = url.origin;
        const notifyResponse = await fetch(`${origin}/api/workflow-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowFileId: fileId,
            eventType: "internal_update",
            actorName: fromName,
            actorRole: fromRole,
            actorEmail: fromEmail,
            noteText: message,
          }),
        });
        comprehensiveNotifyResult = await notifyResponse.json().catch(() => null);
      } catch (notifyError) {
        console.error("WORKFLOW NOTE COMPREHENSIVE NOTIFY ERROR:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      activity: data,
      recipientEmailSent: recipientSend.ok,
      senderReceiptSent: receiptSend.ok,
      recipientResult,
      receiptResult,
      comprehensiveNotifyResult,
    });
  } catch (error) {
    console.error("WORKFLOW NOTE ROUTE ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
