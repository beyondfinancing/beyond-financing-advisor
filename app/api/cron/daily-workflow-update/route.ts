// app/api/cron/daily-workflow-update/route.ts
// Daily Mortgage Workflow Update email - Beyond Financing tenant.
// Sends a per-recipient summary at 14:15 UTC each weekday.
// Recipients (resolved via employee_roles join table, BF tenant only):
//   - Branch Manager (full pipeline view, all files)
//   - Production Manager (full pipeline view, all files)
//   - Each Loan Officer (their own files only) with their LOAs CC'd
// Master Admin (no tenant_id) is NEVER included.
// Style-1 branded hero + per-file CTA buttons via @/lib/email-template.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  brandedHero,
  ctaButton,
  outerShell,
  commandCenterUrl,
  workflowFileUrl,
  escapeHtml,
  formatCurrency,
  COLORS,
} from "@/lib/email-template";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BF_TENANT_ID = "b7fbd7b2-dca6-4669-abd6-c27769c4b7f3";
const FROM_ADDRESS = "Beyond Intelligence <finley@beyondfinancing.com>";
const NOTIFICATION_TYPE = "daily_workflow_update";

type WorkflowFile = {
  id: string;
  file_number: string | null;
  borrower_name: string | null;
  property_address: string | null;
  purpose: string | null;
  amount: number | null;
  status: string | null;
  target_close: string | null;
  loan_officer_id: string | null;
  created_at: string | null;
  last_activity_at: string | null;
};

type Employee = {
  id: string;
  email: string;
  full_name: string | null;
  is_branch_manager: boolean | null;
  tenant_id: string | null;
};

function todayStr(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function statusLabel(s: string | null | undefined): string {
  return escapeHtml(s || "—");
}

async function sendResend(payload: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `Resend ${resp.status}: ${txt}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

function fileRow(f: WorkflowFile, opts: { showCta?: boolean } = {}): string {
  const loanNum = f.file_number ? `Loan #${escapeHtml(f.file_number)}` : "Loan #—";
  const purpose = escapeHtml(f.purpose || "Loan");
  const amount = formatCurrency(f.amount);
  const borrower = escapeHtml(f.borrower_name || "—");
  const property = escapeHtml(f.property_address || "—");
  const status = statusLabel(f.status);
  const closeDate = f.target_close
    ? new Date(f.target_close).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const link = workflowFileUrl(f.id);

  const ctaCell = opts.showCta
    ? `<div style="margin-top:10px;">${ctaButton({ label: "Open File", href: link })}</div>`
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin:0 0 12px 0;border:1px solid ${COLORS.BORDER};border-radius:10px;background:#FAFBFD;">
      <tr>
        <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;color:${COLORS.TEXT_PRIMARY};">
          <div style="font-weight:700;font-size:15px;">${borrower}</div>
          <div style="font-size:13px;color:${COLORS.TEXT_MUTED};margin-top:2px;">${loanNum} · ${purpose} · ${amount}</div>
          <div style="font-size:13px;color:${COLORS.TEXT_MUTED};margin-top:2px;">${property}</div>
          <div style="font-size:12px;color:${COLORS.TEXT_MUTED};margin-top:6px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#EEF2FF;color:${COLORS.BRAND_NAVY};font-weight:600;">${status}</span>
            <span style="margin-left:8px;">Close ${escapeHtml(closeDate)}</span>
          </div>
          ${ctaCell}
        </td>
      </tr>
    </table>`;
}

function sectionHeader(title: string): string {
  return `<h2 style="margin:24px 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:0.6px;text-transform:uppercase;color:${COLORS.BRAND_NAVY};">${escapeHtml(title)}</h2>`;
}

function emptyNote(text: string): string {
  return `<div style="margin:0 0 12px 0;padding:14px 16px;border:1px dashed ${COLORS.BORDER};border-radius:10px;background:#FAFBFD;color:${COLORS.TEXT_MUTED};font-size:13px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(text)}</div>`;
}

function buildEmailHtml(opts: {
  recipientName: string;
  recipientRoleLabel: string;
  filesNeedingAttention: WorkflowFile[];
  closingWithin7: WorkflowFile[];
  newFilesLast24h: WorkflowFile[];
  allActiveFiles: WorkflowFile[];
}): string {
  const hero = brandedHero({
    pill: "TEAM COMMAND CENTER",
    title: `Mortgage Workflow Update — ${todayStr()}`,
    subtitle: `Daily snapshot for ${escapeHtml(opts.recipientName)} (${escapeHtml(opts.recipientRoleLabel)}). Files in execution, closings within 7 days, and new files from the last 24 hours.`,
  });

  const topCta = ctaButton({
    label: "Open Command Center",
    href: commandCenterUrl(),
  });

  const fnaSection =
    sectionHeader("Files Needing Attention") +
    (opts.filesNeedingAttention.length === 0
      ? emptyNote("No urgent oversight items right now.")
      : opts.filesNeedingAttention.map((f) => fileRow(f, { showCta: true })).join(""));

  const closingSection =
    sectionHeader("Closing Within 7 Days") +
    (opts.closingWithin7.length === 0
      ? emptyNote("No closings in the next 7 days.")
      : opts.closingWithin7.map((f) => fileRow(f, { showCta: true })).join(""));

  const newSection =
    sectionHeader("New Files (Last 24 Hours)") +
    (opts.newFilesLast24h.length === 0
      ? emptyNote("No new files in the last 24 hours.")
      : opts.newFilesLast24h.map((f) => fileRow(f, { showCta: true })).join(""));

  const allSection =
    sectionHeader("All Active Files") +
    (opts.allActiveFiles.length === 0
      ? emptyNote("No active files in the pipeline.")
      : opts.allActiveFiles.map((f) => fileRow(f, { showCta: true })).join(""));

  const bodyHtml = `
    ${topCta}
    ${fnaSection}
    ${closingSection}
    ${newSection}
    ${allSection}
  `;

  return outerShell({
    preheader: `Daily mortgage workflow update for ${opts.recipientName}`,
    hero,
    bodyHtml,
    footerNote:
      "Internal team notification from Beyond Intelligence Workflow Intelligence. Sign-in is required. Direct links open the file in your browser.",
  });
}

export async function GET(req: Request) {
  // Auth: Bearer CRON_SECRET via Authorization header OR ?secret= query param fallback
  const url = new URL(req.url);
  const isDryRun = url.searchParams.get("dryRun") === "1";
  const querySecret = url.searchParams.get("secret") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (bearer !== expected && querySecret !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing" },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- 1. Resolve recipients via employee_roles join table (BF tenant only) ----
  const { data: rolesData, error: rolesErr } = await supabase
    .from("employee_roles")
    .select(
      "employee_id, role, employees!inner(id, email, full_name, is_branch_manager, tenant_id)",
    )
    .eq("employees.tenant_id", BF_TENANT_ID);

  if (rolesErr) {
    return NextResponse.json(
      { ok: false, error: `employee_roles query: ${rolesErr.message}` },
      { status: 500 },
    );
  }

  type RoleRow = { employee_id: string; role: string; employees: Employee };
  const rows = (rolesData || []) as unknown as RoleRow[];

  const byRole = new Map<string, Employee[]>();
  for (const r of rows) {
    const e = r.employees;
    if (!e || !e.tenant_id || e.tenant_id !== BF_TENANT_ID) continue;
    const list = byRole.get(r.role) || [];
    if (!list.find((x) => x.id === e.id)) list.push(e);
    byRole.set(r.role, list);
  }

  const productionManagers = byRole.get("Production Manager") || [];
  const loanOfficers = byRole.get("Loan Officer") || [];
  const loanOfficerAssistants = byRole.get("Loan Officer Assistant") || [];
  const branchManagers = (byRole.get("Loan Officer") || []).filter(
    (e) => e.is_branch_manager === true,
  );

  // ---- 2. Pull all active workflow_files for BF tenant ----
  const { data: filesData, error: filesErr } = await supabase
    .from("workflow_files")
    .select(
      "id, file_number, borrower_name, property_address, purpose, amount, status, target_close, loan_officer_id, created_at, last_activity_at",
    )
    .eq("tenant_id", BF_TENANT_ID)
    .neq("status", "closed")
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });

  if (filesErr) {
    return NextResponse.json(
      { ok: false, error: `workflow_files query: ${filesErr.message}` },
      { status: 500 },
    );
  }

  const allFiles = (filesData || []) as WorkflowFile[];

  // ---- 3. Derive sections ----
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const filesNeedingAttentionAll = allFiles.filter((f) => {
    if (!f.status) return false;
    return ["processing_active", "submitted_to_lender", "rush", "priority"].includes(
      f.status,
    );
  });

  const closingWithin7All = allFiles.filter((f) => {
    if (!f.target_close) return false;
    const t = new Date(f.target_close).getTime();
    if (Number.isNaN(t)) return false;
    return t >= now && t - now <= SEVEN_DAYS_MS;
  });

  const newFilesLast24hAll = allFiles.filter((f) => {
    if (!f.created_at) return false;
    const t = new Date(f.created_at).getTime();
    if (Number.isNaN(t)) return false;
    return now - t <= ONE_DAY_MS;
  });

  // ---- 4. Build the recipient list ----
  type Plan = {
    to: string[];
    cc: string[];
    name: string;
    roleLabel: string;
    files: WorkflowFile[];
  };
  const plans: Plan[] = [];

  const seenFullPipeline = new Set<string>();
  for (const e of [...branchManagers, ...productionManagers]) {
    if (seenFullPipeline.has(e.email)) continue;
    seenFullPipeline.add(e.email);
    const isBM = branchManagers.find((x) => x.email === e.email);
    const isPM = productionManagers.find((x) => x.email === e.email);
    const labels = [
      isBM ? "Branch Manager" : null,
      isPM ? "Production Manager" : null,
    ].filter(Boolean) as string[];
    plans.push({
      to: [e.email],
      cc: [],
      name: e.full_name || e.email,
      roleLabel: labels.join(" + ") || "Manager",
      files: allFiles,
    });
  }

  const loaEmails = loanOfficerAssistants.map((e) => e.email);
  for (const lo of loanOfficers) {
    if (seenFullPipeline.has(lo.email)) continue;
    const myFiles = allFiles.filter((f) => f.loan_officer_id === lo.id);
    plans.push({
      to: [lo.email],
      cc: loaEmails,
      name: lo.full_name || lo.email,
      roleLabel: "Loan Officer",
      files: myFiles,
    });
  }

  // ---- 5. Send / dryRun ----
  const sendResults: Array<{
    to: string;
    ok: boolean;
    error?: string;
    insertError?: string;
  }> = [];

  for (const plan of plans) {
    const planFnA = plan.files.filter((f) =>
      filesNeedingAttentionAll.find((x) => x.id === f.id),
    );
    const planClosing = plan.files.filter((f) =>
      closingWithin7All.find((x) => x.id === f.id),
    );
    const planNew = plan.files.filter((f) =>
      newFilesLast24hAll.find((x) => x.id === f.id),
    );

    const html = buildEmailHtml({
      recipientName: plan.name,
      recipientRoleLabel: plan.roleLabel,
      filesNeedingAttention: planFnA,
      closingWithin7: planClosing,
      newFilesLast24h: planNew,
      allActiveFiles: plan.files,
    });

    const subject = `Mortgage Workflow Update — ${todayStr()}`;

    if (isDryRun) {
      sendResults.push({ to: plan.to.join(","), ok: true });
      continue;
    }

    const sent = await sendResend({
      from: FROM_ADDRESS,
      to: plan.to,
      cc: plan.cc.length > 0 ? plan.cc : undefined,
      subject,
      html,
    });

    // Log to workflow_notifications. workflow_file_id is now nullable (Fix-A migration).
    const { error: insertErr } = await supabase
      .from("workflow_notifications")
      .insert({
        tenant_id: BF_TENANT_ID,
        notification_type: NOTIFICATION_TYPE,
        recipient_email: plan.to[0],
        sent_at: new Date().toISOString(),
        payload: {
          cc: plan.cc,
          file_count: plan.files.length,
          ok: sent.ok,
          error: sent.error || null,
        },
      });

    sendResults.push({
      to: plan.to.join(","),
      ok: sent.ok,
      error: sent.error,
      insertError: insertErr?.message,
    });
  }

  const okCount = sendResults.filter((r) => r.ok).length;
  const errCount = sendResults.length - okCount;
  return NextResponse.json({
    ok: errCount === 0,
    dryRun: isDryRun,
    sent: okCount,
    failed: errCount,
    plans: plans.length,
    results: sendResults,
  });
}
