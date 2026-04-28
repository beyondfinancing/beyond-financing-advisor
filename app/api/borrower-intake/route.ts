// app/api/borrower-intake/route.ts
//
// Fires once when the borrower clicks "Run Preliminary Review" on the
// borrower-facing page. Sends:
//   - A "new lead" notification email to the assigned loan officer
//     (and assistant if available)
//   - A privacy-conservative courtesy email to the borrower's realtor
//     (only if the borrower indicated they have one)
//   - A row in borrower_action_logs for audit
//
// This route deliberately does NOT include borrower credit/income/debt
// in the realtor email. It only confirms a mortgage review is underway
// and gives the realtor a path to reach the loan officer.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type RealtorPayload = {
  hasRealtor?: boolean;
  name?: string;
  email?: string;
  phone?: string;
};

type IntakePayload = {
  borrower: {
    fullName: string;
    email: string;
    phone: string;
    preferredLanguage: 'English' | 'Português' | 'Español';
  };
  loanOfficerId?: string;
  loanOfficerQuery?: string;
  realtor?: RealtorPayload;
  scenario?: {
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
  };
};

type ResolvedOfficerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  assistant_email: string | null;
  nmls: string | null;
  phone: string | null;
  mobile: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function resolveOfficer(
  supabase: ReturnType<typeof createClient>,
  loanOfficerId: string | null,
  loanOfficerQuery: string | null,
) {
  const { data, error } = await supabase.rpc('resolve_loan_officer', {
    officer_id: loanOfficerId,
    officer_query: loanOfficerQuery,
  });
  if (error || !data) return null;
  const rows = (Array.isArray(data) ? data : [data]) as unknown as ResolvedOfficerRow[];
  return rows[0] ?? null;
}

async function sendResendEmail(args: {
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'Missing RESEND_API_KEY' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Beyond Financing <finley@beyondfinancing.com>',
      to: args.to,
      cc: args.cc ?? [],
      reply_to: args.replyTo,
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

function buildLoanOfficerEmail(args: {
  officerName: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  preferredLanguage: string;
  realtor?: RealtorPayload;
  scenario?: IntakePayload['scenario'];
}) {
  const r = args.realtor;
  const realtorBlock = r?.hasRealtor
    ? `
      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:12px;padding:14px;margin-top:12px;">
        <h3 style="margin:0 0 8px 0;color:#263366;font-size:16px;">Borrower's Realtor</h3>
        <p style="margin:4px 0;"><strong>Name:</strong> ${escapeHtml(r.name ?? '—')}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(r.email ?? '—')}</p>
        <p style="margin:4px 0;"><strong>Phone:</strong> ${escapeHtml(r.phone ?? '—')}</p>
        <p style="margin:8px 0 0 0;font-size:13px;color:#475569;">
          Realtor was notified by Beyond Intelligence at intake.
        </p>
      </div>
    `
    : '';

  const s = args.scenario;
  const scenarioBlock =
    s && (s.homePrice || s.downPayment)
      ? `
      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:12px;padding:14px;margin-top:12px;">
        <h3 style="margin:0 0 8px 0;color:#263366;font-size:16px;">Scenario So Far</h3>
        <p style="margin:4px 0;"><strong>Home Price:</strong> ${escapeHtml(s.homePrice ?? '—')}</p>
        <p style="margin:4px 0;"><strong>Down Payment:</strong> ${escapeHtml(s.downPayment ?? '—')}</p>
        <p style="margin:4px 0;"><strong>Estimated Loan:</strong> ${escapeHtml(s.estimatedLoanAmount ?? '—')}</p>
        <p style="margin:4px 0;"><strong>Estimated LTV:</strong> ${escapeHtml(s.estimatedLtv ?? '—')}</p>
      </div>
    `
      : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:720px;margin:0 auto;padding:20px;">
      <h1 style="margin:0 0 12px 0;color:#263366;font-size:22px;">New Borrower Intake</h1>
      <p style="line-height:1.6;">
        ${escapeHtml(args.borrowerName)} just started a preliminary mortgage review
        with you through Finley Beyond. A full conversation summary will follow
        once the borrower takes a follow-up action (Apply, Schedule, or Contact).
      </p>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:12px;padding:14px;margin-top:12px;">
        <h3 style="margin:0 0 8px 0;color:#263366;font-size:16px;">Borrower Contact</h3>
        <p style="margin:4px 0;"><strong>Name:</strong> ${escapeHtml(args.borrowerName)}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(args.borrowerEmail)}</p>
        <p style="margin:4px 0;"><strong>Phone:</strong> ${escapeHtml(args.borrowerPhone)}</p>
        <p style="margin:4px 0;"><strong>Preferred Language:</strong> ${escapeHtml(args.preferredLanguage)}</p>
      </div>

      ${realtorBlock}
      ${scenarioBlock}

      <p style="margin-top:16px;line-height:1.6;font-size:13px;color:#475569;">
        Beyond Intelligence™ — Routed to ${escapeHtml(args.officerName)}.
      </p>
    </div>
  `;
}

function buildRealtorEmail(args: {
  realtorName: string;
  borrowerName: string;
  officerName: string;
  officerNmls: string;
  officerEmail: string;
  officerPhone: string;
  preferredLanguage: string;
}) {
  // Privacy-conservative. NO borrower financials.
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:680px;margin:0 auto;padding:20px;">
      <h1 style="margin:0 0 12px 0;color:#263366;font-size:22px;">
        Your client just started a mortgage review
      </h1>
      <p style="line-height:1.7;">
        Hi ${escapeHtml(args.realtorName || 'there')},
      </p>
      <p style="line-height:1.7;">
        This is a courtesy notice that your client
        <strong>${escapeHtml(args.borrowerName)}</strong>
        just submitted a preliminary mortgage scenario with Beyond Financing.
        ${escapeHtml(args.officerName)}${
          args.officerNmls ? ` (NMLS ${escapeHtml(args.officerNmls)})` : ''
        } will reach out shortly to discuss financing.
      </p>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:12px;padding:14px;margin-top:12px;">
        <h3 style="margin:0 0 8px 0;color:#263366;font-size:16px;">Loan Officer Contact</h3>
        <p style="margin:4px 0;"><strong>Name:</strong> ${escapeHtml(args.officerName)}</p>
        ${args.officerNmls ? `<p style="margin:4px 0;"><strong>NMLS:</strong> ${escapeHtml(args.officerNmls)}</p>` : ''}
        <p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(args.officerEmail)}</p>
        ${args.officerPhone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${escapeHtml(args.officerPhone)}</p>` : ''}
      </div>

      <p style="line-height:1.7;margin-top:16px;">
        If you'd like to be looped in on financing milestones for this transaction,
        just reply to this email or contact the loan officer directly.
      </p>

      <p style="line-height:1.6;margin-top:20px;font-size:12px;color:#64748b;">
        For your client's privacy, this notice does not include any
        financial details. Borrower financial information is reviewed
        only by the licensed loan officer.
      </p>
    </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IntakePayload;

    const fullName = (body?.borrower?.fullName ?? '').trim();
    const borrowerEmail = (body?.borrower?.email ?? '').trim();
    const borrowerPhone = (body?.borrower?.phone ?? '').trim();
    const preferredLanguage = (body?.borrower?.preferredLanguage ?? '').trim();

    if (!fullName || !borrowerEmail || !borrowerPhone || !preferredLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing borrower details (name, email, phone, language).',
        },
        { status: 400 },
      );
    }

    const realtor = body?.realtor;
    if (realtor?.hasRealtor) {
      const rName = (realtor.name ?? '').trim();
      const rEmail = (realtor.email ?? '').trim();
      const rPhone = (realtor.phone ?? '').trim();
      if (!rName || !rEmail || !rPhone) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Realtor name, email, and phone are required when working with a realtor.',
          },
          { status: 400 },
        );
      }
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured.' },
        { status: 500 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const officer = await resolveOfficer(
      supabase,
      body.loanOfficerId?.trim() || null,
      body.loanOfficerQuery?.trim() || null,
    );

    const officerName = officer?.full_name ?? 'Beyond Financing Loan Officer';
    const officerEmail = officer?.email ?? 'finley@beyondfinancing.com';
    const officerNmls = officer?.nmls ?? '';
    const officerPhone = officer?.mobile ?? officer?.phone ?? '';
    const officerAssistant = officer?.assistant_email ?? null;

    const notificationStatus = {
      loan_officer: 'pending' as 'pending' | 'sent' | 'error',
      realtor: 'skipped' as 'pending' | 'sent' | 'error' | 'skipped',
      loan_officer_error: null as string | null,
      realtor_error: null as string | null,
    };

    // 1. Notify the loan officer
    const loEmailRes = await sendResendEmail({
      to: [officerEmail],
      cc: officerAssistant ? [officerAssistant] : [],
      replyTo: borrowerEmail,
      subject: `[New Lead] ${fullName}`,
      html: buildLoanOfficerEmail({
        officerName,
        borrowerName: fullName,
        borrowerEmail,
        borrowerPhone,
        preferredLanguage,
        realtor,
        scenario: body.scenario,
      }),
    });
    if (loEmailRes.ok) {
      notificationStatus.loan_officer = 'sent';
    } else {
      notificationStatus.loan_officer = 'error';
      notificationStatus.loan_officer_error = loEmailRes.error ?? 'unknown';
    }

    // 2. Notify the realtor (if applicable)
    if (realtor?.hasRealtor) {
      notificationStatus.realtor = 'pending';
      const realtorRes = await sendResendEmail({
        to: [(realtor.email ?? '').trim()],
        replyTo: officerEmail,
        subject: `Mortgage review started for ${fullName}`,
        html: buildRealtorEmail({
          realtorName: (realtor.name ?? '').trim(),
          borrowerName: fullName,
          officerName,
          officerNmls,
          officerEmail,
          officerPhone,
          preferredLanguage,
        }),
      });
      if (realtorRes.ok) {
        notificationStatus.realtor = 'sent';
      } else {
        notificationStatus.realtor = 'error';
        notificationStatus.realtor_error = realtorRes.error ?? 'unknown';
      }
    }

    // 3. Audit log
    await supabase.from('borrower_action_logs').insert({
      borrower_name: fullName,
      borrower_email: borrowerEmail,
      borrower_phone: borrowerPhone,
      preferred_language: preferredLanguage,
      loan_officer_name: officerName,
      loan_officer_email: officerEmail,
      assistant_email: officerAssistant,
      realtor_name: realtor?.hasRealtor ? (realtor.name ?? null) : null,
      realtor_email: realtor?.hasRealtor ? (realtor.email ?? null) : null,
      realtor_phone: realtor?.hasRealtor ? (realtor.phone ?? null) : null,
      trigger: 'preliminary_review',
      event_type: 'intake_submit',
      status:
        notificationStatus.loan_officer === 'sent' ? 'logged' : 'logged_with_errors',
      source_page: '/finley',
      metadata: {
        officer_id: officer?.id ?? null,
        officer_nmls: officerNmls,
        notifications: notificationStatus,
        scenario: body.scenario ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      notifications: notificationStatus,
      resolved: officer
        ? { id: officer.id, name: officer.full_name, email: officer.email }
        : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
