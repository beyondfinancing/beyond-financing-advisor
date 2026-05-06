// app/api/cron/daily-workflow-update/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BF_TENANT_UUID_FALLBACK } from '@/lib/team-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COMPANY_TZ = 'America/New_York';
const FROM_ADDRESS = 'Beyond Intelligence <finley@beyondfinancing.com>';
const BRAND_PRIMARY = '#1E3A8A';
const BRAND_ACCENT = '#0EA5E9';

// ---------- helpers ----------

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { timeZone: COMPANY_TZ, month: 'short', day: 'numeric', year: 'numeric' });
}

type Employee = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  is_branch_manager: boolean | null;
  is_active: boolean | null;
  roles: string[];
};

type WorkflowFile = {
  id: string;
  tenant_id: string;
  file_number: string | null;
  borrower_name: string | null;
  property_address: string | null;
  purpose: string | null;
  amount: number | null;
  status: string | null;
  urgency: string | null;
  loan_officer: string | null;
  loan_officer_id: string | null;
  processor: string | null;
  processor_id: string | null;
  target_close: string | null;
  file_age_days: number | null;
  blocker: string | null;
  latest_update: string | null;
  created_at: string;
  archived_at: string | null;
  last_activity_at: string | null;
};

// ---------- core ----------

export async function GET(req: Request) {
  // 1) Cron auth
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const url = new URL(req.url);
  const isDryRun = url.searchParams.get('dryRun') === '1';
  // Allow either Bearer header OR ?secret= query (for dryRun via Hoppscotch convenience)
  const querySecret = url.searchParams.get('secret');
  const queryAuthOk = querySecret && querySecret === (process.env.CRON_SECRET ?? '');
  if (authHeader !== expected && !queryAuthOk) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 2) Discover all tenants that have at least one active employee
  const { data: tenantRows, error: tenantErr } = await supabase
    .from('employees')
    .select('tenant_id')
    .eq('is_active', true);
  if (tenantErr) {
    return NextResponse.json({ ok: false, where: 'tenants', error: tenantErr.message }, { status: 500 });
  }
  const tenantIds = Array.from(new Set((tenantRows ?? []).map((r: any) => r.tenant_id))).filter(Boolean) as string[];

  const perTenantSummaries: any[] = [];
  let totalSent = 0;
  let totalSkippedDuplicate = 0;
  let totalErrors = 0;

  for (const tenantId of tenantIds) {
    try {
      const summary = await processTenant(supabase, tenantId, isDryRun);
      perTenantSummaries.push(summary);
      totalSent += summary.sent;
      totalSkippedDuplicate += summary.skippedDuplicate;
    } catch (e: any) {
      totalErrors++;
      perTenantSummaries.push({ tenantId, error: e?.message ?? String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun: isDryRun,
    tenants: tenantIds.length,
    totalSent,
    totalSkippedDuplicate,
    totalErrors,
    perTenant: perTenantSummaries,
  });
}

async function processTenant(supabase: any, tenantId: string, isDryRun: boolean) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayKey = today.toLocaleDateString('en-CA', { timeZone: COMPANY_TZ }); // YYYY-MM-DD in ET

  // 1) Pull active employees + roles for this tenant
  const { data: empRows, error: empErr } = await supabase
    .from('employees')
    .select('id, tenant_id, email, full_name, is_branch_manager, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (empErr) throw new Error('employees: ' + empErr.message);

  const empIds = (empRows ?? []).map((e: any) => e.id);
  let roleRows: any[] = [];
  if (empIds.length > 0) {
    const { data: rRows, error: rErr } = await supabase
      .from('employee_roles')
      .select('employee_id, role')
      .in('employee_id', empIds);
    if (rErr) throw new Error('employee_roles: ' + rErr.message);
    roleRows = rRows ?? [];
  }
  const rolesByEmp = new Map<string, string[]>();
  for (const r of roleRows) {
    const arr = rolesByEmp.get(r.employee_id) ?? [];
    arr.push(r.role);
    rolesByEmp.set(r.employee_id, arr);
  }
  const employees: Employee[] = (empRows ?? []).map((e: any) => ({
    id: e.id,
    tenant_id: e.tenant_id,
    email: e.email,
    full_name: e.full_name,
    is_branch_manager: e.is_branch_manager,
    is_active: e.is_active,
    roles: rolesByEmp.get(e.id) ?? [],
  }));

  // 2) Pull all non-archived files for this tenant
  const { data: fileRows, error: fileErr } = await supabase
    .from('workflow_files')
    .select('id, tenant_id, file_number, borrower_name, property_address, purpose, amount, status, urgency, loan_officer, loan_officer_id, processor, processor_id, target_close, file_age_days, blocker, latest_update, created_at, archived_at, last_activity_at')
    .eq('tenant_id', tenantId)
    .is('archived_at', null);
  if (fileErr) throw new Error('workflow_files: ' + fileErr.message);

  const allFiles: WorkflowFile[] = (fileRows ?? []) as WorkflowFile[];

  // 3) Pull files closed since yesterday for "wins"
  const { data: winsRows } = await supabase
    .from('workflow_files')
    .select('id, tenant_id, file_number, borrower_name, property_address, amount, status, archived_at, loan_officer, loan_officer_id')
    .eq('tenant_id', tenantId)
    .ilike('status', '%Closed%')
    .gte('archived_at', yesterday.toISOString());
  const wins = (winsRows ?? []) as any[];

  // 4) Build per-recipient packets
  const packets = buildPackets(employees, allFiles, wins, sevenDaysOut, yesterday);

  // 5) Idempotency: skip if already sent to this email today for this tenant
  const { data: alreadySent } = await supabase
    .from('workflow_notifications')
    .select('recipient_email, sent_at')
    .eq('tenant_id', tenantId)
    .eq('notification_type', 'daily_workflow_update')
    .gte('sent_at', new Date(todayKey + 'T00:00:00-05:00').toISOString());
  const alreadySentEmails = new Set<string>((alreadySent ?? []).map((r: any) => (r.recipient_email ?? '').toLowerCase()));

  let sent = 0;
  let skippedDuplicate = 0;
  const previewPackets: any[] = [];

  for (const pkt of packets) {
    const lc = pkt.recipientEmail.toLowerCase();
    if (alreadySentEmails.has(lc)) {
      skippedDuplicate++;
      continue;
    }
    if (pkt.kpis.totalActive === 0 && pkt.attention.length === 0 && pkt.closingSoon.length === 0 && pkt.newToday.length === 0 && pkt.wins.length === 0) {
      // nothing to say to this person today
      continue;
    }
    const subject = `Mortgage Workflow Update — ${today.toLocaleDateString('en-US', { timeZone: COMPANY_TZ, month: 'short', day: 'numeric' })}`;
    const html = renderEmail(pkt, subject);

    if (isDryRun) {
      previewPackets.push({
        to: pkt.recipientEmail,
        cc: pkt.cc,
        subject,
        roles: pkt.recipientRoles,
        view: pkt.viewMode,
        kpis: pkt.kpis,
        counts: {
          attention: pkt.attention.length,
          closingSoon: pkt.closingSoon.length,
          newToday: pkt.newToday.length,
          wins: pkt.wins.length,
        },
      });
      continue;
    }

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [pkt.recipientEmail],
        cc: pkt.cc.length ? pkt.cc : undefined,
        subject,
        html,
      }),
    });
    const resendOk = resendRes.ok;

    // Record notification (idempotency)
    await supabase.from('workflow_notifications').insert({
      workflow_file_id: null,
      tenant_id: tenantId,
      notification_type: 'daily_workflow_update',
      event_type: 'daily_workflow_update',
      recipient_role: pkt.recipientRoles.join(','),
      recipient_email: pkt.recipientEmail,
      delivery_channel: 'email',
      delivery_status: resendOk ? 'sent' : 'failed',
      message_subject: subject,
      file_number: null,
      borrower_name: null,
      property_address: null,
      sent_at: new Date().toISOString(),
    });

    if (resendOk) sent++;
  }

  return {
    tenantId,
    employees: employees.length,
    files: allFiles.length,
    packets: packets.length,
    sent,
    skippedDuplicate,
    ...(isDryRun ? { previewPackets } : {}),
  };
}

// ---------- recipient logic ----------

type Packet = {
  recipientEmail: string;
  recipientName: string;
  recipientRoles: string[];
  cc: string[];
  viewMode: 'full' | 'lo' | 'processor' | 'assistant';
  kpis: { processingActive: number; nearingClose: number; rushFiles: number; totalActive: number };
  pipeline: Record<string, number>;
  attention: WorkflowFile[];
  closingSoon: WorkflowFile[];
  newToday: WorkflowFile[];
  wins: any[];
};

function buildPackets(employees: Employee[], allFiles: WorkflowFile[], wins: any[], sevenDaysOut: Date, yesterday: Date): Packet[] {
  const packets: Packet[] = [];

  // Build LO -> assistant CC map: every LO Assistant gets CC'd on every LO email in their tenant
  const assistantsCc = employees
    .filter(e => e.roles.includes('Loan Officer Assistant'))
    .map(e => e.email);

  for (const e of employees) {
    const isFullView = (e.is_branch_manager === true) || e.roles.includes('Production Manager') || e.roles.includes('Branch Manager');
    const isLO = e.roles.includes('Loan Officer');
    const isProcessor = e.roles.includes('Processor');
    const isAssistantOnly = !isFullView && !isLO && !isProcessor && e.roles.includes('Loan Officer Assistant');

    let visibleFiles: WorkflowFile[] = [];
    let viewMode: Packet['viewMode'] = 'lo';
    let cc: string[] = [];

    if (isFullView) {
      visibleFiles = allFiles;
      viewMode = 'full';
    } else if (isLO) {
      visibleFiles = allFiles.filter(f => f.loan_officer_id === e.id);
      viewMode = 'lo';
      cc = assistantsCc;
    } else if (isProcessor) {
      visibleFiles = allFiles.filter(f => f.processor_id === e.id);
      viewMode = 'processor';
    } else if (isAssistantOnly) {
      // Pure assistants without an LO of their own only get the daily as CC, not as a primary recipient
      continue;
    } else {
      // No recognized role -> skip
      continue;
    }

    const pipeline: Record<string, number> = {};
    for (const f of visibleFiles) {
      const k = (f.status ?? 'Unknown').trim();
      pipeline[k] = (pipeline[k] ?? 0) + 1;
    }

    const processingActive = visibleFiles.filter(f => /Processing Active/i.test(f.status ?? '')).length;
    const nearingClose     = visibleFiles.filter(f => /(Conditional Approval|Clear to Close)/i.test(f.status ?? '')).length;
    const rushFiles        = visibleFiles.filter(f => /(Rush|Priority)/i.test(f.urgency ?? '')).length;

    const attention = visibleFiles.filter(f => (f.blocker && f.blocker.trim() && !/^none/i.test(f.blocker)) || /Rush/i.test(f.urgency ?? ''));

    const closingSoon = visibleFiles.filter(f => {
      if (!f.target_close) return false;
      const tc = new Date(f.target_close);
      return tc >= new Date() && tc <= sevenDaysOut;
    }).sort((a, b) => (a.target_close ?? '').localeCompare(b.target_close ?? ''));

    const newToday = visibleFiles.filter(f => new Date(f.created_at) >= yesterday);

    const winsForRecipient = isFullView
      ? wins
      : wins.filter((w: any) => w.loan_officer_id === e.id);

    packets.push({
      recipientEmail: e.email,
      recipientName: e.full_name,
      recipientRoles: e.roles,
      cc: cc.filter(addr => addr && addr.toLowerCase() !== e.email.toLowerCase()),
      viewMode,
      kpis: { processingActive, nearingClose, rushFiles, totalActive: visibleFiles.length },
      pipeline,
      attention,
      closingSoon,
      newToday,
      wins: winsForRecipient,
    });
  }

  return packets;
}

// ---------- email rendering ----------

function renderEmail(p: Packet, subject: string): string {
  const tile = (label: string, value: string | number, color: string) => `
    <td style="padding:14px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;text-align:center;width:25%;">
      <div style="font-size:12px;color:#475569;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(label)}</div>
      <div style="font-size:28px;color:${color};font-weight:700;line-height:1.1;margin-top:4px;">${escapeHtml(String(value))}</div>
    </td>`;

  const stageBadge = (label: string, count: number) => `
    <td style="padding:8px 10px;border:1px solid #E2E8F0;border-radius:8px;background:#FFFFFF;text-align:center;font-size:12px;color:#0F172A;">
      <div style="font-weight:600;">${escapeHtml(label)}</div>
      <div style="font-size:18px;font-weight:700;margin-top:2px;color:${BRAND_PRIMARY};">${count}</div>
    </td>`;

  const fileRow = (f: WorkflowFile) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0F172A;">
        <div style="font-weight:600;">${escapeHtml(f.borrower_name ?? '—')}</div>
        <div style="color:#64748B;font-size:12px;">Loan #${escapeHtml(f.file_number ?? '—')} · ${escapeHtml(f.purpose ?? '—')} · ${fmtCurrency(f.amount)}</div>
        <div style="color:#64748B;font-size:12px;">${escapeHtml(f.property_address ?? '—')}</div>
        ${f.blocker && !/^none/i.test(f.blocker) ? `<div style="color:#B91C1C;font-size:12px;margin-top:2px;">⚠ ${escapeHtml(f.blocker)}</div>` : ''}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#475569;text-align:right;white-space:nowrap;">
        <div>${escapeHtml(f.status ?? '—')}</div>
        ${f.target_close ? `<div style="color:#0EA5E9;">Close ${fmtDate(f.target_close)}</div>` : ''}
      </td>
    </tr>`;

  const stageOrder = ['New Scenario','Pre-Approval Review','Sent to Processing','Processing Active','Submitted to Lender','Conditional Approval','Clear to Close','Closed'];
  const stagesHtml = stageOrder.map(s => stageBadge(s, p.pipeline[s] ?? 0)).join('');

  const attentionHtml = p.attention.length
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">${p.attention.slice(0,15).map(fileRow).join('')}</table>`
    : `<div style="padding:14px;color:#64748B;font-size:13px;background:#F8FAFC;border-radius:8px;">None currently. 🎯</div>`;

  const closingHtml = p.closingSoon.length
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">${p.closingSoon.slice(0,15).map(fileRow).join('')}</table>`
    : `<div style="padding:14px;color:#64748B;font-size:13px;background:#F8FAFC;border-radius:8px;">No closings in the next 7 days.</div>`;

  const newHtml = p.newToday.length
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">${p.newToday.slice(0,15).map(fileRow).join('')}</table>`
    : `<div style="padding:14px;color:#64748B;font-size:13px;background:#F8FAFC;border-radius:8px;">No new files in the last 24 hours.</div>`;

  const winsHtml = p.wins.length
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">
        ${p.wins.slice(0,15).map((w:any)=>`<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#065F46;font-weight:600;">${escapeHtml(w.borrower_name ?? '—')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#065F46;text-align:right;">Loan #${escapeHtml(w.file_number ?? '—')} · ${fmtCurrency(w.amount)}</td>
        </tr>`).join('')}
      </table>`
    : '';

  const viewLabel = p.viewMode === 'full' ? 'Full pipeline view'
                  : p.viewMode === 'lo' ? 'Your assigned files'
                  : p.viewMode === 'processor' ? 'Files assigned to you for processing'
                  : 'Assistant view';

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F1F5F9;padding:24px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="640" style="background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr><td style="background:linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_ACCENT} 100%);padding:22px 28px;color:#FFFFFF;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Beyond Intelligence</div>
          <div style="font-size:22px;font-weight:700;margin-top:4px;">Mortgage Workflow Update</div>
          <div style="font-size:13px;opacity:.85;margin-top:6px;">${escapeHtml(p.recipientName)} · ${escapeHtml(viewLabel)}</div>
        </td></tr>

        <tr><td style="padding:20px 28px 8px 28px;">
          <table cellpadding="0" cellspacing="6" border="0" width="100%">
            <tr>
              ${tile('Processing Active', p.kpis.processingActive, BRAND_PRIMARY)}
              ${tile('Nearing Close', p.kpis.nearingClose, '#0EA5E9')}
              ${tile('Rush Files', p.kpis.rushFiles, '#B91C1C')}
              ${tile('Total Active', p.kpis.totalActive, '#0F172A')}
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 28px 4px 28px;">
          <div style="font-size:13px;font-weight:700;color:#0F172A;letter-spacing:.04em;text-transform:uppercase;">Pipeline</div>
          <table cellpadding="0" cellspacing="6" border="0" width="100%" style="margin-top:8px;">
            <tr>${stagesHtml}</tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 28px 4px 28px;">
          <div style="font-size:13px;font-weight:700;color:#B91C1C;letter-spacing:.04em;text-transform:uppercase;">🚨 Files needing attention</div>
          ${attentionHtml}
        </td></tr>

        <tr><td style="padding:18px 28px 4px 28px;">
          <div style="font-size:13px;font-weight:700;color:#0EA5E9;letter-spacing:.04em;text-transform:uppercase;">📅 Closing within 7 days</div>
          ${closingHtml}
        </td></tr>

        <tr><td style="padding:18px 28px 4px
