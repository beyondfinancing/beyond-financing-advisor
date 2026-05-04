// app/api/cron/stale-check/route.ts
//
// Cron endpoint for stale workflow file notifications.
// - Triggered by Vercel Cron at multiple UTC times (see vercel.json)
// - Self-gates on company-time hour (10 or 15 ET) so DST and weekday
//   bookkeeping is handled in code, not cron syntax.
// - Skips weekends and holidays (in company timezone)
// - Sends one email per file per ~5h window; repeats until file is touched

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BF_TENANT_UUID_FALLBACK } from '@/lib/team-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COMPANY_TZ = 'America/New_York';
const NOTIFY_HOURS = [10, 15];            // 10am and 3pm company time
const STALE_THRESHOLD_HOURS = 48;         // business hours
const MIN_GAP_HOURS = 4;                  // dedupes within same window

type StaleFile = {
  id: string;
  file_number: string | null;
  borrower_name: string | null;
  property_address: string | null;
  loan_officer: string | null;
  loan_officer_email: string | null;
  loan_officer_assistant_email: string | null;
  processor: string | null;
  processor_email: string | null;
  status: string | null;
  last_activity_at: string;
  business_hours_stale: number;
  tenant_id: string | null;
};

function getCompanyTimeParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: COMPANY_TZ,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return {
    hour: Number(parts.hour),
    weekday: parts.weekday as string,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function escapeHtml(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function GET(req: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const now = new Date();
  const { hour, weekday, isoDate } = getCompanyTimeParts(now);

  // Gate 1: weekday in company time
  if (weekday === 'Sat' || weekday === 'Sun') {
    return NextResponse.json({
      skipped: 'weekend',
      companyTime: { hour, weekday, isoDate },
    });
  }

  // Gate 2: not a holiday in company time
  const { data: holiday } = await supabase
    .from('company_holidays')
    .select('holiday_date,name')
    .eq('holiday_date', isoDate)
    .maybeSingle();

  if (holiday) {
    return NextResponse.json({
      skipped: 'holiday',
      date: isoDate,
      name: holiday.name,
    });
  }

  // Gate 3: only fire during the 10am or 3pm hour
  if (!NOTIFY_HOURS.includes(hour)) {
    return NextResponse.json({
      skipped: 'outside_window',
      companyTime: { hour, weekday, isoDate },
    });
  }

  // Find stale files via RPC
  const { data: staleFiles, error } = await supabase.rpc(
    'find_stale_workflow_files',
    {
      threshold_hours: STALE_THRESHOLD_HOURS,
      min_gap_hours: MIN_GAP_HOURS,
    },
  );

  if (error) {
    return NextResponse.json(
      { error: 'rpc_failed', detail: error.message },
      { status: 500 },
    );
  }

  const files = (staleFiles ?? []) as StaleFile[];
  const results: Array<{ file_id: string; status: string; error?: string }> = [];

  for (const file of files) {
    try {
      const recipients = [
        file.loan_officer_email,
        file.loan_officer_assistant_email,
        file.processor_email,
      ].filter((e): e is string => Boolean(e && e.includes('@')));

      if (recipients.length === 0) {
        results.push({ file_id: file.id, status: 'no_recipients' });
        continue;
      }

      await sendStaleEmail(file, recipients);

      // Update file bookkeeping (does NOT bump last_activity_at;
      // the BEFORE UPDATE trigger only bumps on real-field changes)
      await supabase
        .from('workflow_files')
        .update({ last_stale_notified_at: now.toISOString() })
        .eq('id', file.id)
        .eq('tenant_id', file.tenant_id ?? BF_TENANT_UUID_FALLBACK);

      // Log the notification
      await supabase.from('workflow_notifications').insert({
        workflow_file_id: file.id,
        tenant_id: file.tenant_id ?? BF_TENANT_UUID_FALLBACK,
        notification_type: 'stale_48h',
        event_type: 'stale_48h',
        recipient_role: 'team',
        recipient_email: recipients.join(','),
        file_number: file.file_number,
        borrower_name: file.borrower_name,
        property_address: file.property_address,
        delivery_channel: 'email',
        delivery_status: 'sent',
        message_subject: `[Stale 48h] ${file.file_number ?? file.borrower_name ?? 'Workflow file'}`,
      });

      results.push({ file_id: file.id, status: 'notified' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';

      await supabase.from('workflow_notifications').insert({
        workflow_file_id: file.id,
        tenant_id: file.tenant_id ?? BF_TENANT_UUID_FALLBACK,
        notification_type: 'stale_48h',
        event_type: 'stale_48h',
        recipient_role: 'team',
        file_number: file.file_number,
        borrower_name: file.borrower_name,
        delivery_channel: 'email',
        delivery_status: `error: ${msg}`,
      });

      results.push({ file_id: file.id, status: 'error', error: msg });
    }
  }

  return NextResponse.json({
    ran_at: now.toISOString(),
    company_time: { hour, weekday, isoDate },
    candidates: files.length,
    results,
  });
}

async function sendStaleEmail(file: StaleFile, recipients: string[]) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const stale = file.business_hours_stale.toFixed(1);
  const subject = `[Stale 48h] ${file.file_number ?? file.borrower_name ?? 'Workflow file'}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#1f2937;padding:20px;">
      <h2 style="color:#263366;margin:0 0 12px 0;">
        Stale File Alert â No internal activity for 48 business hours
      </h2>
      <p style="line-height:1.6;">
        The following file has had no internal team activity for
        <strong>${escapeHtml(stale)} business hours</strong>
        (weekends and company holidays excluded, Eastern time).
      </p>
      <table style="border-collapse:collapse;margin-top:12px;font-size:14px;">
        <tr><td style="padding:6px 12px;color:#475569;"><strong>File #</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.file_number ?? 'â')}</td></tr>
        <tr><td style="padding:6px 12px;color:#475569;"><strong>Borrower</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.borrower_name ?? 'â')}</td></tr>
        <tr><td style="padding:6px 12px;color:#475569;"><strong>Property</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.property_address ?? 'â')}</td></tr>
        <tr><td style="padding:6px 12px;color:#475569;"><strong>Loan Officer</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.loan_officer ?? 'â')}</td></tr>
        <tr><td style="padding:6px 12px;color:#475569;"><strong>Processor</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.processor ?? 'â')}</td></tr>
        <tr><td style="padding:6px 12px;color:#475569;"><strong>Status</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.status ?? 'â')}</td></tr>
        <tr><td style="padding:6px 12px;color:#475569;"><strong>Last activity</strong></td>
            <td style="padding:6px 12px;">${escapeHtml(file.last_activity_at)}</td></tr>
      </table>
      <p style="line-height:1.6;margin-top:16px;">
        Please update the file or document why no action is needed.
        Notifications will continue at <strong>10:00 AM</strong> and
        <strong>3:00 PM ET</strong> each business day until the file is touched.
      </p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Beyond Intelligence <finley@beyondfinancing.com>',
      to: recipients,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}
