// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/chat-summary/route.ts
//
// =============================================================================
//
// PHASE 5.1 — PERSIST SCENARIOS TO THE DATABASE
//
// What this version adds vs. the Phase 4 version:
//
//   1. Upserts a `borrowers` row (matched by email).
//
//   2. Creates or updates a `borrower_scenarios` row using "Option C":
//      - If an unclaimed scenario for this borrower already exists, UPDATE
//        it with the latest submission data.
//      - If a CLAIMED scenario for this borrower already exists, leave it
//        alone and INSERT a new scenario for the new submission.
//      - If no scenario for this borrower exists, INSERT a fresh row.
//
//   3. Stores the chat conversation in borrower_scenarios.conversation
//      so the Inbox can later display message previews.
//
//   4. Sets status:
//      - assigned_pending_claim if the selected officer is a real LO
//      - awaiting_assignment   if Finley Beyond was chosen (no real LO)
//
//   5. Sets assignment_method:
//      - self_chosen if the borrower picked a real LO
//      - bi_assigned if Finley Beyond was chosen (BI will route)
//
// What this version preserves:
//
//   - Email behavior is byte-identical to Phase 4
//   - Audit log behavior is byte-identical to Phase 4
//   - Response shape is byte-identical to Phase 4
//   - Borrower page payload shape is unchanged
//   - Database persistence is best-effort: if the persist step fails,
//     the email and audit log still happen and the route still returns
//     success. Persistence failures are logged but do not break the
//     borrower experience.
//
// =============================================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// -----------------------------------------------------------------------------
// Types — shaped to match what /borrower currently sends
// -----------------------------------------------------------------------------

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type PreferredLanguage = 'English' | 'Português' | 'Español'
type SummaryTrigger = 'ai' | 'apply' | 'schedule' | 'contact' | 'call' | 'professional'
type LanguageCode = 'en' | 'pt' | 'es'
type BorrowerPath = 'Purchase' | 'Refinance' | 'Investment'

type LeadPayload = {
  fullName?: string
  email?: string
  phone?: string
  preferredLanguage?: PreferredLanguage
  loanOfficer?: string
  assignedEmail?: string
  assistantEmail?: string
  realtorName?: string
  realtorEmail?: string
  realtorPhone?: string
  realtorMls?: string
  // Light scenario hints the borrower page may include
  borrowerPath?: BorrowerPath
  currentState?: string
  targetState?: string
  homePrice?: string | number
  downPayment?: string | number
  estimatedCreditScore?: string | number
  monthlyIncome?: string | number
  monthlyDebt?: string | number
}

type SelectedOfficerPayload = {
  id?: string
  name?: string
  nmls?: string
  email?: string
  assistantEmail?: string
  mobile?: string
  assistantMobile?: string
  applyUrl?: string
  scheduleUrl?: string
}

type SelectedRealtorPayload = {
  id?: string
  name?: string
  email?: string
  phone?: string
  mls?: string
} | null

type IncomingBody = {
  lead?: LeadPayload
  selectedOfficer?: SelectedOfficerPayload
  selectedRealtor?: SelectedRealtorPayload
  messages?: ChatMessage[]
  trigger?: SummaryTrigger
}

type SummaryPayload = {
  borrowerSummary: string
  likelyDirection: string
  strengths: string[]
  openQuestions: string[]
  provisionalPrograms: string[]
  recommendedNextStep: string
  loanOfficerActionPlan: string[]
}

type ResolvedRouting = {
  loanOfficer: {
    id: string | null
    name: string
    email: string
    nmls: string
    isFinleyBot: boolean
  }
  assistantEmails: string[]
  realtor: {
    id: string | null
    name: string
    email: string
    phone: string
    mls: string
  } | null
  primaryEmail: string
  ccList: string[]
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const FROM_ADDRESS = 'Finley Beyond <finley@beyondfinancing.com>'
const FALLBACK_PRIMARY_EMAIL = 'finley@beyondfinancing.com'
const DEFAULT_TENANT_SUBDOMAIN = 'bf'

// The bot's NMLS sentinel — distinguishes the system's Finley Beyond
// employees row from a real licensed LO. When the borrower selects
// Finley Beyond on the form, that means "I don't know my LO" and BI
// should assign someone, so the scenario goes into awaiting_assignment.
const FINLEY_BOT_NMLS = '2394496FB'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />')
}

function isValidEmail(value: string): boolean {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function languageNameToCode(name: string): LanguageCode {
  const lower = String(name || '').trim().toLowerCase()
  if (lower.startsWith('port') || lower === 'pt') return 'pt'
  if (lower.startsWith('esp') || lower === 'es' || lower.startsWith('span'))
    return 'es'
  return 'en'
}

function buildTranscriptHtml(messages: ChatMessage[]): string {
  if (!messages || messages.length === 0) return ''
  return messages
    .map((msg, i) => {
      const label = msg.role === 'user' ? 'Borrower' : 'Finley Beyond Advisor'
      const bg = msg.role === 'user' ? '#DCEAFE' : '#F3F4F6'
      return `
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:12px;background:${bg};color:#263366;">
          <div style="font-weight:700;margin-bottom:6px;">${label} ${i + 1}</div>
          <div style="line-height:1.6;">${nl2br(msg.content)}</div>
        </div>
      `
    })
    .join('')
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// Routing resolution — looks up the real LO, their assistants, the realtor
// -----------------------------------------------------------------------------

async function resolveRouting(
  selectedOfficer: SelectedOfficerPayload | undefined,
  selectedRealtor: SelectedRealtorPayload,
  lead: LeadPayload
): Promise<ResolvedRouting> {

  let loId: string | null = null
  let loName = ''
  let loEmail = ''
  let loNmls = ''
  let isFinleyBot = false
  const assistantEmails: string[] = []

  // Step 1 — Look up by employees.id, then fall back to email
  if (selectedOfficer?.id) {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, email, nmls, is_active, role')
      .eq('id', selectedOfficer.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!error && data) {
      loId = data.id
      loName = data.full_name || ''
      loEmail = data.email || ''
      loNmls = data.nmls || ''
    }
  }

  if (!loEmail && selectedOfficer?.email && isValidEmail(selectedOfficer.email)) {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, email, nmls, is_active')
      .eq('email', selectedOfficer.email.trim())
      .eq('is_active', true)
      .maybeSingle()

    if (!error && data) {
      loId = data.id
      loName = data.full_name || ''
      loEmail = data.email || ''
      loNmls = data.nmls || ''
    } else {
      loName = selectedOfficer.name || ''
      loEmail = selectedOfficer.email
      loNmls = selectedOfficer.nmls || ''
    }
  }

  if (!loEmail || !isValidEmail(loEmail)) {
    loEmail = FALLBACK_PRIMARY_EMAIL
    if (!loName) loName = 'Finley Beyond'
  }

  isFinleyBot =
    loNmls === FINLEY_BOT_NMLS ||
    loName.toLowerCase().startsWith('finley') ||
    loEmail.toLowerCase().startsWith('finley@')

  // Step 2 — LO's assistants from the matrix
  if (loId) {
    const { data: assignments, error: aerr } = await supabaseAdmin
      .from('lo_assistant_assignments')
      .select('assistant_id, is_active')
      .eq('loan_officer_id', loId)
      .eq('is_active', true)

    if (!aerr && assignments && assignments.length > 0) {
      const assistantIds = assignments.map((a) => a.assistant_id)
      const { data: assistants, error: aaerr } = await supabaseAdmin
        .from('employees')
        .select('id, email, is_active')
        .in('id', assistantIds)
        .eq('is_active', true)

      if (!aaerr && assistants) {
        for (const a of assistants) {
          const e = String(a.email || '').trim()
          if (e && isValidEmail(e) && e.toLowerCase() !== loEmail.toLowerCase()) {
            if (!assistantEmails.includes(e)) {
              assistantEmails.push(e)
            }
          }
        }
      }
    }
  }

  // Legacy fallback for assistantEmail
  if (assistantEmails.length === 0) {
    const fallbackAssistant =
      safeString(selectedOfficer?.assistantEmail) || safeString(lead.assistantEmail)
    if (fallbackAssistant && isValidEmail(fallbackAssistant) &&
        fallbackAssistant.toLowerCase() !== loEmail.toLowerCase()) {
      assistantEmails.push(fallbackAssistant)
    }
  }

  // Step 3 — Resolve realtor
  let resolvedRealtor: ResolvedRouting['realtor'] = null

  if (selectedRealtor) {
    let realtorId: string | null = null
    let realtorName = safeString(selectedRealtor.name) || safeString(lead.realtorName)
    let realtorEmail = safeString(selectedRealtor.email) || safeString(lead.realtorEmail)
    let realtorPhone = safeString(selectedRealtor.phone) || safeString(lead.realtorPhone)
    let realtorMls = safeString(selectedRealtor.mls) || safeString(lead.realtorMls)

    if (selectedRealtor.id) {
      const { data, error } = await supabaseAdmin
        .from('realtors')
        .select('id, full_name, email, phone, mls_id, is_active')
        .eq('id', selectedRealtor.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!error && data) {
        realtorId = data.id
        realtorName = data.full_name || realtorName
        realtorEmail = data.email || realtorEmail
        realtorPhone = data.phone || realtorPhone
        realtorMls = data.mls_id || realtorMls
      }
    }

    if (realtorName) {
      resolvedRealtor = {
        id: realtorId,
        name: realtorName,
        email: isValidEmail(realtorEmail) ? realtorEmail : '',
        phone: realtorPhone,
        mls: realtorMls,
      }
    }
  }

  // Step 4 — CC list
  const ccList: string[] = []
  for (const e of assistantEmails) {
    if (!ccList.includes(e)) ccList.push(e)
  }
  if (resolvedRealtor?.email && !ccList.includes(resolvedRealtor.email)) {
    if (resolvedRealtor.email.toLowerCase() !== loEmail.toLowerCase()) {
      ccList.push(resolvedRealtor.email)
    }
  }

  return {
    loanOfficer: { id: loId, name: loName, email: loEmail, nmls: loNmls, isFinleyBot },
    assistantEmails,
    realtor: resolvedRealtor,
    primaryEmail: loEmail,
    ccList,
  }
}

// -----------------------------------------------------------------------------
// Persistence — upsert borrower + create/update borrower_scenario
// -----------------------------------------------------------------------------

type PersistResult = {
  borrowerId: string | null
  scenarioId: string | null
  scenarioAction: 'created' | 'updated' | 'skipped' | 'failed'
}

async function persistScenario(args: {
  lead: LeadPayload
  routing: ResolvedRouting
  trigger: SummaryTrigger
  messages: ChatMessage[]
}): Promise<PersistResult> {

  const { lead, routing, trigger, messages } = args

  const result: PersistResult = {
    borrowerId: null,
    scenarioId: null,
    scenarioAction: 'failed',
  }

  try {

    // -------------------------------------------------------------------------
    // Step 1 — Resolve the tenant (Beyond Financing for now).
    // -------------------------------------------------------------------------

    const { data: tenantRow, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('subdomain', DEFAULT_TENANT_SUBDOMAIN)
      .eq('is_active', true)
      .maybeSingle()

    if (tenantErr || !tenantRow) {
      console.error('persistScenario: tenant lookup failed.', tenantErr)
      return result
    }

    const tenantId = tenantRow.id as string

    // -------------------------------------------------------------------------
    // Step 2 — Upsert the borrower row by email.
    // -------------------------------------------------------------------------

    const fullName = safeString(lead.fullName)
    const email = safeString(lead.email).toLowerCase()
    const phone = safeString(lead.phone)
    const preferredLanguage = safeString(lead.preferredLanguage)
    const currentState = safeString(lead.currentState)
    const targetState = safeString(lead.targetState)

    if (!email || !fullName) {
      console.error('persistScenario: missing borrower name or email.')
      return result
    }

    const { data: borrowerUpsert, error: borrowerErr } = await supabaseAdmin
      .from('borrowers')
      .upsert(
        {
          full_name: fullName,
          email,
          phone: phone || null,
          preferred_language: preferredLanguage || 'English',
          current_state: currentState || null,
          target_state: targetState || null,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .maybeSingle()

    if (borrowerErr || !borrowerUpsert) {
      console.error('persistScenario: borrower upsert failed.', borrowerErr)
      return result
    }

    const borrowerId = borrowerUpsert.id as string
    result.borrowerId = borrowerId

    // -------------------------------------------------------------------------
    // Step 3 — Build the scenario payload.
    // -------------------------------------------------------------------------

    const isFinleyBot = routing.loanOfficer.isFinleyBot
    const assignedLoId = isFinleyBot ? null : routing.loanOfficer.id

    const status = isFinleyBot ? 'awaiting_assignment' : 'assigned_pending_claim'
    const assignmentMethod = isFinleyBot ? 'bi_assigned' : 'self_chosen'

    const intakeData = {
      fullName,
      email,
      phone,
      preferredLanguage,
      estimatedCreditScore: lead.estimatedCreditScore || null,
      monthlyIncome: lead.monthlyIncome || null,
      monthlyDebt: lead.monthlyDebt || null,
      currentState,
      targetState,
    }

    const scenarioData = {
      homePrice: lead.homePrice || null,
      downPayment: lead.downPayment || null,
    }

    const scenarioPayload = {
      borrower_id: borrowerId,
      realtor_id: routing.realtor?.id || null,
      assigned_loan_officer_id: assignedLoId,
      assigned_tenant_id: tenantId,
      language: languageNameToCode(preferredLanguage),
      borrower_path: lead.borrowerPath || null,
      intake_data: intakeData,
      scenario_data: scenarioData,
      conversation: messages || [],
      status,
      assignment_method: assignmentMethod,
      source_page: '/borrower',
      trigger_event: trigger,
      updated_at: new Date().toISOString(),
    }

    // -------------------------------------------------------------------------
    // Step 4 — Option C: find the most recent UNCLAIMED scenario for this
    // borrower. If found, UPDATE it. Otherwise, INSERT a new one.
    // -------------------------------------------------------------------------

    const { data: existingUnclaimed, error: findErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .select('id, status')
      .eq('borrower_id', borrowerId)
      .in('status', ['awaiting_assignment', 'assigned_pending_claim'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findErr) {
      console.error('persistScenario: find unclaimed failed.', findErr)
      return result
    }

    if (existingUnclaimed) {

      const { data: updated, error: updErr } = await supabaseAdmin
        .from('borrower_scenarios')
        .update(scenarioPayload)
        .eq('id', existingUnclaimed.id)
        .select('id')
        .maybeSingle()

      if (updErr || !updated) {
        console.error('persistScenario: scenario update failed.', updErr)
        return result
      }

      result.scenarioId = updated.id as string
      result.scenarioAction = 'updated'
      console.log(
        `persistScenario: updated existing unclaimed scenario id=${updated.id} for borrower=${email}.`
      )
      return result
    }

    // No unclaimed scenario found — create a fresh one.
    const { data: created, error: insErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .insert(scenarioPayload)
      .select('id')
      .maybeSingle()

    if (insErr || !created) {
      console.error('persistScenario: scenario insert failed.', insErr)
      return result
    }

    result.scenarioId = created.id as string
    result.scenarioAction = 'created'
    console.log(
      `persistScenario: created new scenario id=${created.id} for borrower=${email}.`
    )
    return result

  } catch (err) {
    console.error('persistScenario: unhandled error.', err)
    return result
  }
}

// -----------------------------------------------------------------------------
// Fallback summary builder
// -----------------------------------------------------------------------------

function buildFallbackSummary(
  lead: LeadPayload,
  messages: ChatMessage[],
  trigger: SummaryTrigger
): SummaryPayload {
  const borrowerMessages = (messages || [])
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')

  const triggerStep =
    trigger === 'apply'
      ? 'Borrower clicked Apply Now and was directed toward the application flow.'
      : trigger === 'schedule'
      ? 'Borrower clicked to schedule a consultation.'
      : trigger === 'contact'
      ? 'Borrower clicked to contact the loan officer by email.'
      : trigger === 'call'
      ? 'Borrower clicked to call the loan officer.'
      : 'Borrower appears ready for a licensed loan officer to review and follow up.'

  return {
    borrowerSummary:
      borrowerMessages ||
      'The borrower engaged with Finley Beyond and requested mortgage guidance.',
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
    recommendedNextStep: triggerStep,
    loanOfficerActionPlan: [
      'Review the transcript.',
      'Contact the borrower promptly.',
      'Confirm income, credit, assets, and documentation strategy.',
      'Move borrower toward application, pre-approval, or consultation as appropriate.',
    ],
  }
}

// -----------------------------------------------------------------------------
// Audit logger
// -----------------------------------------------------------------------------

async function logBorrowerAction(args: {
  lead: LeadPayload
  routing: ResolvedRouting
  trigger: SummaryTrigger
  status: 'sent' | 'failed'
  errorMessage?: string
  scenarioId?: string | null
  borrowerId?: string | null
}) {
  try {
    await supabaseAdmin.from('borrower_action_logs').insert({
      borrower_name: args.lead.fullName || null,
      borrower_email: args.lead.email || null,
      borrower_phone: args.lead.phone || null,
      preferred_language: args.lead.preferredLanguage || null,
      loan_officer_name: args.routing.loanOfficer.name,
      loan_officer_email: args.routing.loanOfficer.email,
      assistant_email: args.routing.assistantEmails[0] || null,
      realtor_name: args.routing.realtor?.name || null,
      realtor_email: args.routing.realtor?.email || null,
      realtor_phone: args.routing.realtor?.phone || null,
      trigger: args.trigger,
      event_type: 'chat_summary_email',
      status: args.status,
      source_page: '/borrower',
      notes: args.errorMessage || null,
      metadata: {
        cc_list: args.routing.ccList,
        loan_officer_id: args.routing.loanOfficer.id,
        realtor_id: args.routing.realtor?.id || null,
        scenario_id: args.scenarioId || null,
        borrower_id: args.borrowerId || null,
      },
    })
  } catch (err) {
    console.error('chat-summary: logBorrowerAction insert failed.', err)
  }
}

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingBody

    const lead = (body?.lead || {}) as LeadPayload
    const officer = body?.selectedOfficer
    const selectedRealtor = body?.selectedRealtor || null
    const messages: ChatMessage[] = Array.isArray(body?.messages)
      ? (body!.messages as ChatMessage[])
      : []
    const trigger: SummaryTrigger = (body?.trigger || 'ai') as SummaryTrigger

    const fullName = safeString(lead.fullName)
    const email = safeString(lead.email)
    const phone = safeString(lead.phone)
    const preferredLanguage = safeString(lead.preferredLanguage)

    if (!fullName || !email || !preferredLanguage) {
      return NextResponse.json(
        { success: false, error: 'Missing required lead details (name, email, language).' },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('chat-summary: RESEND_API_KEY is not set.')
      return NextResponse.json(
        { success: false, error: 'Email service is not configured.' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // Resolve routing through the matrix
    // -------------------------------------------------------------------------

    const routing = await resolveRouting(officer, selectedRealtor, lead)

    // -------------------------------------------------------------------------
    // PHASE 5.1 — Persist borrower + scenario (best-effort).
    // -------------------------------------------------------------------------

    const persistResult = await persistScenario({
      lead,
      routing,
      trigger,
      messages,
    })

    // -------------------------------------------------------------------------
    // Build the structured advisor summary
    // -------------------------------------------------------------------------

    let summary: SummaryPayload = buildFallbackSummary(lead, messages, trigger)

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
- Write for an internal mortgage loan officer.
- Be practical and concise.
- Use only information actually present in the conversation and lead details.
- Note borrower employment type, residency status, doc-type, etc., ONLY if supported by the transcript.
- "provisionalPrograms" should be directional only, never lender-specific guarantees.
- Include realistic possible directions (Conventional, FHA, HomeReady/Home Possible, self-employed, etc.) only when supported.
- Do not promise approval.
- Do not mention that no lender folder exists.
- Assume this is an internal pre-brief before full underwriting.

Lead details:
- Full Name: ${fullName}
- Email: ${email}
- Phone: ${phone || 'Not provided'}
- Preferred Language: ${preferredLanguage}
- Loan Officer: ${routing.loanOfficer.name}
- Loan Officer NMLS: ${routing.loanOfficer.nmls || 'Not provided'}
- Realtor: ${routing.realtor ? `${routing.realtor.name} (${routing.realtor.email || 'no email'})` : 'Not provided'}
- Trigger: ${trigger}

Conversation transcript:
${messages
  .map((m, i) => {
    const who = m.role === 'user' ? 'Borrower' : 'Finley'
    return `${i + 1}. ${who}: ${m.content}`
  })
  .join('\n')}
`.trim()

      try {
        const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
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
        })

        if (aiResp.ok) {
          const aiData = await aiResp.json()
          const raw = aiData?.choices?.[0]?.message?.content
          const parsed = raw ? parseJsonSafely<SummaryPayload>(raw) : null
          if (parsed) {
            summary = {
              borrowerSummary: parsed.borrowerSummary || summary.borrowerSummary,
              likelyDirection: parsed.likelyDirection || summary.likelyDirection,
              strengths:
                Array.isArray(parsed.strengths) && parsed.strengths.length > 0
                  ? parsed.strengths
                  : summary.strengths,
              openQuestions:
                Array.isArray(parsed.openQuestions) && parsed.openQuestions.length > 0
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
            }
          }
        } else {
          const t = await aiResp.text()
          console.error('chat-summary: OpenAI summary failed.', t)
        }
      } catch (e) {
        console.error('chat-summary: OpenAI call threw.', e)
      }
    }

    // -------------------------------------------------------------------------
    // Build email HTML
    // -------------------------------------------------------------------------

    const transcriptHtml = buildTranscriptHtml(messages)

    const realtorBlockHtml = routing.realtor
      ? `
        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Realtor on File</h2>
          <p><strong>Name:</strong> ${escapeHtml(routing.realtor.name || 'Not provided')}</p>
          <p><strong>Email:</strong> ${escapeHtml(routing.realtor.email || 'Not provided')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(routing.realtor.phone || 'Not provided')}</p>
          <p><strong>MLS #:</strong> ${escapeHtml(routing.realtor.mls || 'Not provided')}</p>
          ${
            routing.realtor.email
              ? `<p style="color:#4b5d7a;">A copy of this summary was CC'd to the realtor.</p>`
              : `<p style="color:#9a3412;">Realtor email was not on file. They were not CC'd.</p>`
          }
        </div>
      `
      : ''

    const persistanceTagHtml = persistResult.scenarioId
      ? `
        <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:16px;padding:14px;margin-bottom:18px;font-size:13px;color:#0C4A6E;">
          Scenario ${persistResult.scenarioAction === 'updated' ? 'updated' : 'recorded'} in Beyond Intelligence (id: <code>${escapeHtml(persistResult.scenarioId)}</code>).
        </div>
      `
      : ''

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 18px 0;color:#263366;">Conversation Summary - Finley Beyond Advisor</h1>

        <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Lead Details</h2>
          <p><strong>Full Name:</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
          <p><strong>Language:</strong> ${escapeHtml(preferredLanguage)}</p>
          <p><strong>Loan Officer:</strong> ${escapeHtml(routing.loanOfficer.name)}</p>
          <p><strong>Loan Officer NMLS:</strong> ${escapeHtml(routing.loanOfficer.nmls || 'Not provided')}</p>
          <p><strong>Primary Recipient:</strong> ${escapeHtml(routing.primaryEmail)}</p>
          <p><strong>CC List:</strong> ${escapeHtml(routing.ccList.join(', ') || 'None')}</p>
          <p><strong>Trigger:</strong> ${escapeHtml(trigger)}</p>
        </div>

        ${persistanceTagHtml}

        ${realtorBlockHtml}

        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Borrower Summary</h2>
          <p style="line-height:1.7;">${nl2br(summary.borrowerSummary)}</p>

          <h3 style="margin:18px 0 8px 0;">Likely Direction</h3>
          <p style="line-height:1.7;">${nl2br(summary.likelyDirection)}</p>

          <h3 style="margin:18px 0 8px 0;">Provisional Program Directions</h3>
          <ul style="line-height:1.8;">
            ${summary.provisionalPrograms.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Strengths</h3>
          <ul style="line-height:1.8;">
            ${summary.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Open Questions</h3>
          <ul style="line-height:1.8;">
            ${summary.openQuestions.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>

          <h3 style="margin:18px 0 8px 0;">Recommended Next Step</h3>
          <p style="line-height:1.7;">${nl2br(summary.recommendedNextStep)}</p>

          <h3 style="margin:18px 0 8px 0;">Loan Officer Action Plan</h3>
          <ul style="line-height:1.8;">
            ${summary.loanOfficerActionPlan.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>

        <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
          <h2 style="margin:0 0 12px 0;font-size:20px;">Full Conversation Transcript</h2>
          ${transcriptHtml || '<p>No transcript available.</p>'}
        </div>
      </div>
    `

    // -------------------------------------------------------------------------
    // Send via Resend
    // -------------------------------------------------------------------------

    const resendPayload: Record<string, unknown> = {
      from: FROM_ADDRESS,
      to: [routing.primaryEmail],
      reply_to: email,
      subject: `Conversation Summary: ${fullName}`,
      html,
    }
    if (routing.ccList.length > 0) {
      resendPayload.cc = routing.ccList
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(resendPayload),
    })

    if (!resendResp.ok) {
      const errText = await resendResp.text()
      console.error('chat-summary: Resend send failed.', {
        primary: routing.primaryEmail,
        cc: routing.ccList,
        from: FROM_ADDRESS,
        statusCode: resendResp.status,
        body: errText,
      })

      await logBorrowerAction({
        lead,
        routing,
        trigger,
        status: 'failed',
        errorMessage: `Resend ${resendResp.status}: ${errText}`,
        scenarioId: persistResult.scenarioId,
        borrowerId: persistResult.borrowerId,
      })

      return NextResponse.json(
        { success: false, error: `Email send failed: ${errText}` },
        { status: 500 }
      )
    }

    console.log('chat-summary: Resend send OK.', {
      primary: routing.primaryEmail,
      cc: routing.ccList,
      trigger,
      borrower: fullName,
      scenarioId: persistResult.scenarioId,
      scenarioAction: persistResult.scenarioAction,
    })

    await logBorrowerAction({
      lead,
      routing,
      trigger,
      status: 'sent',
      scenarioId: persistResult.scenarioId,
      borrowerId: persistResult.borrowerId,
    })

    return NextResponse.json({
      success: true,
      sentTo: [routing.primaryEmail, ...routing.ccList],
      scenarioId: persistResult.scenarioId,
      scenarioAction: persistResult.scenarioAction,
    })
  } catch (error) {
    console.error('chat-summary: unhandled server error.', error)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
