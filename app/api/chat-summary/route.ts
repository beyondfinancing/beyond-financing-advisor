// app/api/chat-summary/route.ts
//
// Updated to resolve the loan officer through Supabase
// (resolve_loan_officer RPC) using either a UUID or a free-text
// query. Falls back to the legacy hardcoded map only if Supabase
// can't find anyone — keeps the route working during migration.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOrCreateHandoffToken, buildHandoffLink, isUuid } from '@/lib/handoff';
import { BF_TENANT_UUID_FALLBACK } from '@/lib/team-auth';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type PreferredLanguage = 'English' | 'Português' | 'Español';
type SummaryTrigger = 'ai' | 'apply' | 'schedule' | 'contact';

type LeadPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: PreferredLanguage;
  loanOfficer?: string;        // legacy: free-text name
  loanOfficerId?: string;      // new: team_users.id
  loanOfficerQuery?: string;   // new: name or NMLS as typed
  assignedEmail?: string;      // optional override
  // The borrower_intake_sessions row id from /api/chat. Used to issue/reuse
  // a Professional Handoff token so the LO email contains the Pro Mode link.
  intakeSessionId?: string;
};

type SummaryPayload = {
  borrowerSummary: string;
  likelyDirection: string;
  strengths: string[];
  openQuestions: string[];
  provisionalPrograms: string[];
  recommendedNextStep: string;
  loanOfficerActionPlan: string[];
};

type ResolvedOfficerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  assistant_email: string | null;
  nmls: string | null;
};

type ResolvedOfficer = {
  id: string;
  full_name: string;
  email: string;
  assistant_email: string | null;
  nmls: string | null;
} | null;

const legacyOfficerMap: Record<string, string> = {
  finley: 'finley@beyondfinancing.com',
  sandro: 'pansini@beyondfinancing.com',
  warren: 'warren@beyondfinancing.com',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function buildTranscriptHtml(messages: ChatMessage[]): string {
  return messages
    .map((msg, index) => {
      const roleLabel =
        msg.role === 'user' ? 'Borrower' : 'Finley Beyond Advisor';
      return `
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:12px;background:${
          msg.role === 'user' ? '#DCEAFE' : '#F3F4F6'
        };color:#263366;">
          <div style="font-weight:700;margin-bottom:6px;">${roleLabel} ${index + 1}</div>
          <div style="line-height:1.6;">${nl2br(msg.content)}</div>
        </div>
      `;
    })
    .join('');
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function legacyEmailFromQuery(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const [key, email] of Object.entries(legacyOfficerMap)) {
    if (q.includes(key)) return email;
  }
  return null;
}

async function resolveOfficer(lead: LeadPayload): Promise<ResolvedOfficer> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const officerId = lead.loanOfficerId?.trim() || null;
  const officerQuery =
    lead.loanOfficerQuery?.trim() || lead.loanOfficer?.trim() || null;

  const { data, error } = await supabase.rpc('resolve_loan_officer', {
    officer_id: officerId,
    officer_query: officerQuery,
  });

  if (error || !data) return null;

  const rows = (Array.isArray(data) ? data : [data]) as unknown as ResolvedOfficerRow[];
  const row = rows[0];
  if (!row || !row.id) return null;

  return {
    id: row.id,
    full_name: row.full_name ?? '',
    email: row.email ?? '',
    assistant_email: row.assistant_email,
    nmls: row.nmls,
  };
}

function buildFallbackSummary(
  lead: LeadPayload,
  messages: ChatMessage[],
  trigger: SummaryTrigger,
): SummaryPayload {
  const borrowerMessages = messages
    .filter((msg) => msg.role === 'user')
    .map((msg) => msg.content)
    .join(' ');

  return {
    borrowerSummary:
      borrowerMessages ||
      'The borrower engaged with Finley Beyond Advisor and requested mortgage guidance.',
    likelyDirection:
      'Borrower appears to be exploring a home financing scenario and may be ready for live review.',
    strengths: [
      'Lead submitted with full contact details.',
      'Borrower engaged in a meaningful mortgage conversation.',
      `Preferred language: ${lead.preferredLanguage || 'Not provided'}.`,
    ],
    openQuestions: [
      'Confirm final documentation package.',
      'Confirm property details, occupancy, and down payment funds if still pending.',
    ],
    provisionalPrograms: [
      'Conventional financing review',
      'FHA review if needed',
      'Alternative/self-employed review if applicable',
    ],
    recommendedNextStep:
      trigger === 'apply'
        ? 'Borrower clicked or was directed toward the application flow.'
        : trigger === 'schedule'
          ? 'Borrower clicked or was directed toward consultation scheduling.'
          : trigger === 'contact'
            ? 'Borrower clicked or was directed toward Beyond Financing contact page.'
            : 'Borrower appears ready for a licensed loan officer to review and follow up.',
    loanOfficerActionPlan: [
      'Review the transcript.',
      'Contact the borrower promptly.',
      'Confirm income, credit, assets, and documentation strategy.',
      'Move borrower toward application, pre-approval, or consultation as appropriate.',
    ],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const lead = (body?.lead || {}) as LeadPayload;
    const messages = Array.isArray(body?.messages)
      ? (body.messages as ChatMessage[])
      : [];
    const trigger = (body?.trigger || 'ai') as SummaryTrigger;

    const fullName = String(lead.fullName || '').trim();
    const email = String(lead.email || '').trim();
    const phone = String(lead.phone || '').trim();
    const preferredLanguage = String(lead.preferredLanguage || '').trim();

    if (!fullName || !email || !preferredLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing lead details (name, email, language).',
        },
        { status: 400 },
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Missing RESEND_API_KEY.' },
        { status: 500 },
      );
    }

    const resolved = await resolveOfficer(lead);

    const officerName =
      resolved?.full_name ||
      lead.loanOfficer ||
      lead.loanOfficerQuery ||
      'Finley Beyond';

    const selectedEmail =
      String(lead.assignedEmail || '').trim() ||
      resolved?.email ||
      legacyEmailFromQuery(lead.loanOfficer || lead.loanOfficerQuery || '') ||
      'finley@beyondfinancing.com';

    const ccList = resolved?.assistant_email ? [resolved.assistant_email] : [];

    let summary: SummaryPayload = buildFallbackSummary(lead, messages, trigger);

    if (process.env.OPENAI_API_KEY && messages.length > 0) {
      const summaryPrompt = `
You are preparing an internal loan-officer briefing email for Beyond Financing.

Return valid JSON only with this exact shape:
{
  "borrowerSummary": "string",
  "likelyDirection": "string",
  "strengths": ["string"],
  "openQuestions": ["string"],
  "provisionalPrograms": ["string"],
  "recommendedNextStep": "string",
  "loanOfficerActionPlan": ["string"]
}

Rules:
- Write for an internal mortgage loan officer
- Be practical and concise
- Use only information actually present in the conversation and lead details
- Do not promise approval
- Assume this is an internal pre-brief before full underwriting

Lead details:
- Full Name: ${fullName}
- Email: ${email}
- Phone: ${phone}
- Preferred Language: ${preferredLanguage}
- Selected Loan Officer: ${officerName}
- Assigned Email: ${selectedEmail}
- Trigger: ${trigger}

Conversation transcript:
${messages
  .map((msg, index) => {
    const who = msg.role === 'user' ? 'Borrower' : 'Finley';
    return `${index + 1}. ${who}: ${msg.content}`;
  })
  .join('\n')}
`;

      const summaryResponse = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You create concise internal mortgage advisor briefings in strict JSON.',
              },
              { role: 'user', content: summaryPrompt },
            ],
          }),
        },
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        const rawContent = summaryData?.choices?.[0]?.message?.content;
        const parsed = rawContent
          ? parseJsonSafely<SummaryPayload>(rawContent)
          : null;

        if (parsed) {
          summary = {
            borrowerSummary: parsed.borrowerSummary || summary.borrowerSummary,
            likelyDirection: parsed.likelyDirection || summary.likelyDirection,
            strengths:
              Array.isArray(parsed.strengths) && parsed.strengths.length > 0
                ? parsed.strengths
                : summary.strengths,
            openQuestions:
              Array.isArray(parsed.openQuestions) &&
              parsed.openQuestions.length > 0
                ? parsed.openQuestions
                : summary.openQuestions,
            provisionalPrograms:
              Array.isArray(parsed.provisionalPrograms) &&
              parsed.provisionalPrograms.length > 0
                ? parsed.provisionalPrograms
                : summary.provisionalPrograms,
            recommendedNextStep:
              parsed.recommendedNextStep || summary.recommendedNextStep,
            loanOfficerActionPlan:
              Array.isArray(parsed.loanOfficerActionPlan) &&
              parsed.loanOfficerActionPlan.length > 0
                ? parsed.loanOfficerActionPlan
                : summary.loanOfficerActionPlan,
          };
        }
      }
    }

    const transcriptHtml = buildTranscriptHtml(messages);

    // Issue or reuse a Professional Handoff token for this intake session.
    // Best-effort — null result means email goes out without the magic link.
    const intakeSessionId = lead.intakeSessionId?.trim() || '';
    let handoffTokenId: string | null = null;
    if (
      isUuid(intakeSessionId) &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      const supabaseForToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );
      // F3.4: resolve tenant from parent borrower_intake_sessions row so handoff token inherits it.
      let resolvedTenantId: string = BF_TENANT_UUID_FALLBACK;
      try {
        const { data: parentSession } = await supabaseForToken
          .from('borrower_intake_sessions')
          .select('tenant_id')
          .eq('id', intakeSessionId)
          .maybeSingle();
        if (parentSession?.tenant_id) {
          resolvedTenantId = parentSession.tenant_id as string;
        }
      } catch {
        // best-effort — fall back to BF default on any error
      }
      handoffTokenId = await getOrCreateHandoffToken(
        supabaseForToken,
        intakeSessionId,
        resolvedTenantId,
      );
    }
    const handoffLink = handoffTokenId
      ? buildHandoffLink(handoffTokenId)
      : null;

    // Pro Mode link block. Brand: navy heading, deep accent button.
    const handoffBlock = handoffLink
      ? `
        <div style="background:#F0F9FF;border:1px solid #0096C7;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 8px 0;color:#243F7C;font-size:20px;">Open this conversation in Professional Mode</h2>
          <p style="margin:0 0 14px 0;line-height:1.6;color:#243F7C;font-size:14px;">
            Pro Mode loads the borrower's full transcript and intake in /finley
            with Finley's program suggestions ready. The link works for you,
            your assistant, and your Branch Manager. Expires in 14 days.
          </p>
          <p style="margin:0;">
            <a href="${escapeHtml(handoffLink)}"
               style="display:inline-block;background:#0096C7;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">
              Open in Professional Mode →
            </a>
          </p>
          <p style="margin:12px 0 0 0;font-size:12px;color:#475569;word-break:break-all;">
            ${escapeHtml(handoffLink)}
          </p>
        </div>
      `
      : '';

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">Conversation Summary - Finley Beyond Advisor</h1>

        <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Lead Details</h2>
          <p><strong>Full Name:</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Language:</strong> ${escapeHtml(preferredLanguage)}</p>
          <p><strong>Selected Loan Officer:</strong> ${escapeHtml(officerName)}${
            resolved?.nmls ? ` — NMLS ${escapeHtml(resolved.nmls)}` : ''
          }</p>
          <p><strong>Assigned Email:</strong> ${escapeHtml(selectedEmail)}</p>
          <p><strong>Trigger:</strong> ${escapeHtml(trigger)}</p>
        </div>

        ${handoffBlock}

        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Borrower Summary</h2>
          <p style="line-height:1.7;">${nl2br(summary.borrowerSummary)}</p>

          <h3 style="margin:18px 0 8px 0;">Likely Direction</h3>
          <p style="line-height:1.7;">${nl2br(summary.likelyDirection)}</p>

          <h3 style="margin:18px 0 8px 0;">Provisional Program Directions</h3>
          <ul style="line-height:1.8;">
            ${summary.provisionalPrograms.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Strengths</h3>
          <ul style="line-height:1.8;">
            ${summary.strengths.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Open Questions</h3>
          <ul style="line-height:1.8;">
            ${summary.openQuestions.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Recommended Next Step</h3>
          <p style="line-height:1.7;">${nl2br(summary.recommendedNextStep)}</p>

          <h3 style="margin:18px 0 8px 0;">Loan Officer Action Plan</h3>
          <ul style="line-height:1.8;">
            ${summary.loanOfficerActionPlan.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
        </div>

        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Full Conversation Transcript</h2>
          ${transcriptHtml || '<p>No transcript available.</p>'}
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Finley Beyond <finley@beyondfinancing.com>',
        to: [selectedEmail],
        cc: ccList,
        reply_to: email,
        subject: `Conversation Summary: ${fullName}`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return NextResponse.json(
        { success: false, error: errorText },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      resolved: resolved
        ? { id: resolved.id, name: resolved.full_name, email: resolved.email }
        : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
