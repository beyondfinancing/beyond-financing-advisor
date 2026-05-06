// app/api/cron/daily-workflow-update/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FROM_ADDRESS = 'Beyond Intelligence <finley@beyondfinancing.com>';

function esc(s: any): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(n: any): string {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isDryRun = url.searchParams.get('dryRun') === '1';
  const secret = process.env.CRON_SECRET ?? '';
  const headerOk = (req.headers.get('authorization') ?? '') === ('Bearer ' + secret);
  const queryOk = secret && url.searchParams.get('secret') === secret;
  if (!headerOk && !queryOk) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: tenantRows } = await supabase
    .from('employees').select('tenant_id').eq('is_active', true);
  const tenantIds = Array.from(new Set((tenantRows ?? []).map((r: any) => r.tenant_id))).filter(Boolean) as string[];

  const results: any[] = [];
  for (const tenantId of tenantIds) {
    try {
      const r = await processTenant(supabase, tenantId, isDryRun);
      results.push(r);
    } catch (e: any) {
      results.push({ tenantId, error: e?.message ?? String(e) });
    }
  }

  return NextResponse.json({ ok: true, dryRun: isDryRun, tenants: tenantIds.length, results });
}

async function processTenant(supabase: any, tenantId: string, isDryRun: boolean) {
  const { data: empRows } = await supabase
    .from('employees')
    .select('id, email, full_name, is_branch_manager')
    .eq('tenant_id', tenantId).eq('is_active', true);
  const empIds = (empRows ?? []).map((e: any) => e.id);

  let roleRows: any[] = [];
  if (empIds.length) {
    const { data } = await supabase
      .from('employee_roles').select('employee_id, role').in('employee_id', empIds);
    roleRows = data ?? [];
  }
  const rolesByEmp = new Map<string, string[]>();
  for (const r of roleRows) {
    const arr = rolesByEmp.get(r.employee_id) ?? [];
    arr.push(r.role);
    rolesByEmp.set(r.employee_id, arr);
  }
  const employees = (empRows ?? []).map((e: any) => ({
    ...e, roles: rolesByEmp.get(e.id) ?? [],
  }));

  const { data: fileRows } = await supabase
    .from('workflow_files')
    .select('id, file_number, borrower_name, property_address, purpose, amount, status, urgency, loan_officer, loan_officer_id, processor_id, target_close, blocker, created_at')
    .eq('tenant_id', tenantId).is('archived_at', null);
  const allFiles = fileRows ?? [];

  const now = Date.now();
  const sevenDays = now + 7 * 86400000;
  const oneDayAgo = now - 86400000;
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const { data: alreadySent } = await supabase
    .from('workflow_notifications').select('recipient_email')
    .eq('tenant_id', tenantId).eq('notification_type', 'daily_workflow_update')
    .gte('sent_at', new Date(todayKey + 'T00:00:00-05:00').toISOString());
  const sentSet = new Set((alreadySent ?? []).map((r: any) => (r.recipient_email ?? '').toLowerCase()));

  const assistantsCc = employees
    .filter((e: any) => e.roles.includes('Loan Officer Assistant'))
    .map((e: any) => e.email);

  const packets: any[] = [];
  for (const e of employees) {
    const isFull = e.is_branch_manager === true || e.roles.includes('Production Manager') || e.roles.includes('Branch Manager');
    const isLO = e.roles.includes('Loan Officer');
    const isProc = e.roles.includes('Processor');

    let files: any[] = [];
    let view = '';
    let cc: string[] = [];
    if (isFull) { files = allFiles; view = 'Full pipeline view'; }
    else if (isLO) { files = allFiles.filter((f: any) => f.loan_officer_id === e.id); view = 'Your assigned files'; cc = assistantsCc; }
    else if (isProc) { files = allFiles.filter((f: any) => f.processor_id === e.id); view = 'Your processing queue'; }
    else continue;

    packets.push({ e, files, view, cc: cc.filter((a: string) => a && a.toLowerCase() !== e.email.toLowerCase()), sevenDays, oneDayAgo });
  }

  let sent = 0, skipped = 0;
  const previews: any[] = [];

  for (const p of packets) {
    if (sentSet.has(p.e.email.toLowerCase())) { skipped++; continue; }
    const attention = p.files.filter((f: any) => (f.blocker && !/^none/i.test(f.blocker)) || /Rush/i.test(f.urgency ?? ''));
    const closing = p.files.filter((f: any) => f.target_close && new Date(f.target_close).getTime() >= now && new Date(f.target_close).getTime() <= p.sevenDays);
    const newFiles = p.files.filter((f: any) => new Date(f.created_at).getTime() >= p.oneDayAgo);
    if (!p.files.length && !attention.length && !closing.length && !newFiles.length) continue;

    const subject = 'Mortgage Workflow Update — ' + new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
    const html = renderEmail(p.e, p.view, p.files, attention, closing, newFiles);

    if (isDryRun) {
      previews.push({ to: p.e.email, cc: p.cc, view: p.view, total: p.files.length, attention: attention.length, closing: closing.length, newFiles: newFiles.length });
      continue;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [p.e.email], cc: p.cc.length ? p.cc : undefined, subject, html }),
    });

    await supabase.from('workflow_notifications').insert({
      tenant_id: tenantId,
      notification_type: 'daily_workflow_update',
      event_type: 'daily_workflow_update',
      recipient_role: p.e.roles.join(','),
      recipient_email: p.e.email,
      delivery_channel: 'email',
      delivery_status: res.ok ? 'sent' : 'failed',
      message_subject: subject,
      sent_at: new Date().toISOString(),
    });

    if (res.ok) sent++;
  }

  return { tenantId, employees: employees.length, files: allFiles.length, packets: packets.length, sent, skipped, ...(isDryRun ? { previews } : {}) };
}

function renderEmail(e: any, view: string, files: any[], attention: any[], closing: any[], newFiles: any[]): string {
  const row = (f: any) => '<tr>'
    + '<td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;">'
    +   '<div style="font-weight:600;color:#0F172A;">' + esc(f.borrower_name) + '</div>'
    +   '<div style="color:#64748B;font-size:12px;">Loan #' + esc(f.file_number) + ' · ' + esc(f.purpose) + ' · ' + fmtMoney(f.amount) + '</div>'
    +   '<div style="color:#64748B;font-size:12px;">' + esc(f.property_address) + '</div>'
    +   (f.blocker && !/^none/i.test(f.blocker) ? '<div style="color:#B91C1C;font-size:12px;">⚠ ' + esc(f.blocker) + '</div>' : '')
    + '</td>'
    + '<td style="padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:12px;text-align:right;color:#475569;white-space:nowrap;">'
    +   '<div>' + esc(f.status) + '</div>'
    +   (f.target_close ? '<div style="color:#0EA5E9;">Close ' + esc(new Date(f.target_close).toLocaleDateString('en-US')) + '</div>' : '')
    + '</td></tr>';

  const section = (title: string, items: any[], emptyMsg: string) => {
    const head = '<div style="margin-top:18px;font-size:13px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:.04em;">' + esc(title) + '</div>';
    const body = items.length
      ? '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px;">' + items.slice(0, 20).map(row).join('') + '</table>'
      : '<div style="margin-top:6px;padding:10px;background:#F8FAFC;border-radius:6px;color:#64748B;font-size:13px;">' + esc(emptyMsg) + '</div>';
    return head + body;
  };

  const header = '<tr><td style="background:linear-gradient(135deg,#1E3A8A,#0EA5E9);padding:22px 28px;color:#FFFFFF;">'
    + '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Beyond Intelligence</div>'
    + '<div style="font-size:22px;font-weight:700;margin-top:4px;">Mortgage Workflow Update</div>'
    + '<div style="font-size:13px;opacity:.85;margin-top:6px;">' + esc(e.full_name) + ' · ' + esc(view) + ' · ' + files.length + ' active file' + (files.length === 1 ? '' : 's') + '</div>'
    + '</td></tr>';

  const sections = section('🚨 Files needing attention', attention, 'None currently. 🎯')
    + section('📅 Closing within 7 days', closing, 'No closings in the next 7 days.')
    + section('🆕 New files (last 24 hours)', newFiles, 'No new files in the last 24 hours.')
    + section('📂 All active files', files, 'No active files.');

  return '<!doctype html><html><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
    + '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:24px 0;"><tr><td align="center">'
    +   '<table cellpadding="0" cellspacing="0" border="0" width="640" style="background:#FFFFFF;border-radius:12px;overflow:hidden;">'
    +     header
    +     '<tr><td style="padding:18px 28px 26px 28px;">'
    +       sections
    +       '<div style="margin-top:22px;padding-top:14px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;">Beyond Intelligence · beyondintelligence.io</div>'
    +     '</td></tr>'
    +   '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}
