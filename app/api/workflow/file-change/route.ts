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
        reply_to: changedByEmail,
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
        reply_to: notifyEmail,
        subject: `[Workflow Receipt] File change logged for ${loanId}`,
        html: receiptHtml,
      }),
    });

    const notifyResult = await notifySend.json().catch(() => null);
    const receiptResult = await receiptSend.json().catch(() => null);

    return NextResponse.json({
      success: true,
      activity: data,
      notifyEmailSent: notifySend.ok,
      receiptEmailSent: receiptSend.ok,
      notifyResult,
      receiptResult,
    });
  } catch (error) {
    console.error("WORKFLOW FILE CHANGE ROUTE ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
