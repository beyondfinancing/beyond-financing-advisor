// =============================================================================
// PASTE THIS FILE AT (existing file):
//
//     app/api/team/inbox/route.ts
//
// =============================================================================
//
// PHASE 5.2 — TEAM INBOX (READ-ONLY)
// F3.3 — TENANT SCOPING (this revision)
//
// Returns the calling Loan Officer's scenario inbox, sourced from
// borrower_scenarios written by Phase 5.1 (chat-summary persistence).
//
// Auth: bf_team_session cookie via lib/team-auth.getSessionFromRequest.
//   - 401 if no session, expired session, or signature mismatch.
//   - 401 if the session's userId no longer maps to an active employees row.
//   - 403 if the role is not 'Loan Officer'.
//     (Phase 5.2 scope. Assistant/Admin views are deferred.)
//
// Tenant scoping (F3.3):
//   - viewer.tenant_id (from employees) is the authoritative tenant filter.
//   - assigned/pending/claimed buckets filter on
//       borrower_scenarios.assigned_tenant_id = viewer.tenant_id
//   - 'all' bucket excludes the pool entirely under F3.3.
//   - 'pool' bucket returns zero rows under F3.3. The cross-tenant pool's
//     behavior is a product decision deferred to F3.6 (Tenant B seed +
//     negative leak tests). See POOL_DEFERRED_F3_6 below.
//
// Query params:
//   - bucket: 'assigned' (default) | 'pending' | 'claimed' | 'pool' | 'all'
//       assigned → status IN (assigned_pending_claim, claimed)
//                    AND assigned_loan_officer_id = me
//                    AND assigned_tenant_id = my_tenant
//       pending  → status =   'assigned_pending_claim'
//                    AND assigned_loan_officer_id = me
//                    AND assigned_tenant_id = my_tenant
//       claimed  → status =   'claimed'
//                    AND assigned_loan_officer_id = me
//                    AND assigned_tenant_id = my_tenant
//       pool     → DEFERRED to F3.6. Returns zero rows.
//       all      → assigned_loan_officer_id = me
//                    AND assigned_tenant_id = my_tenant
//   - limit: 1..100, default 25
//   - offset: ≥ 0, default 0
//
// Response (200 success):
//   {
//     success: true,
//     viewer: { id, name, email, role },
//     bucket: '...',
//     counts: { assigned, pending, claimed, pool },
//     items: ScenarioRowOut[],
//     pagination: { limit, offset, total }
//   }
//
// Notes:
//   - Reads via supabaseAdmin (service role). Auth + tenant scope are
//     enforced at the route boundary, so service-role read is safe.
//   - msgCount and lastMessagePreview are computed server-side from the
//     conversation jsonb. The full transcript is NOT returned to keep the
//     inbox payload small. Phase 5.3 detail view fetches conversation on
//     demand.
//   - Counts are fetched in parallel via head/count queries: three small
//     index hits (pool count returns 0 without a DB call under F3.3).
//   - Status enum assumed: awaiting_assignment, assigned_pending_claim,
//     claimed, abandoned. If new statuses are added, extend `applyBucket`
//     and the counts shape.
//
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionFromRequest } from '@/lib/team-auth'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Bucket = 'assigned' | 'pending' | 'claimed' | 'pool' | 'all'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ScenarioRowDb = {
  id: string
  borrower_id: string | null
  realtor_id: string | null
  assigned_loan_officer_id: string | null
  language: string | null
  borrower_path: string | null
  intake_data: Record<string, unknown>
  scenario_data: Record<string, unknown>
  conversation: unknown // jsonb; expected to be ChatMessage[] but treated defensively
  status: string
  assignment_method: string | null
  source_page: string | null
  trigger_event: string | null
  claimed_at: string | null
  claimed_by_workflow_file_id: string | null
  abandoned_at: string | null
  created_at: string
  updated_at: string
  borrower:
    | {
        id: string
        full_name: string | null
        email: string | null
        phone: string | null
        preferred_language: string | null
      }
    | null
  realtor:
    | {
        id: string
        full_name: string | null
        email: string | null
        phone: string | null
      }
    | null
}

type ScenarioRowOut = {
  scenarioId: string
  createdAt: string
  updatedAt: string
  status: string
  assignmentMethod: string | null
  borrowerPath: string | null
  triggerEvent: string | null
  language: string | null
  sourcePage: string | null
  borrower: {
    id: string | null
    name: string | null
    email: string | null
    phone: string | null
    preferredLanguage: string | null
  }
  realtor: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
  intakeData: Record<string, unknown>
  scenarioData: Record<string, unknown>
  scenarioSummary: {
    homePrice: number | null
    downPayment: number | null
    estimatedLoanAmount: number | null
    estimatedLtv: number | null
  }
  msgCount: number
  lastMessagePreview: string | null
  claimedAt: string | null
  claimedByWorkflowFileId: string | null
  abandonedAt: string | null
}

// -----------------------------------------------------------------------------
// F3.3 — Pool deferral sentinel
// -----------------------------------------------------------------------------
//
// POOL_DEFERRED_F3_6: The 'pool' bucket (status = 'awaiting_assignment') has
// no assigned_tenant_id by definition — the field only gets populated when
// the scenario transitions to assigned_pending_claim. That makes the pool
// inherently cross-tenant in the current schema.
//
// Rather than ship a half-baked tenant filter for the pool, F3.3 returns
// zero rows for any pool query. The product question — "should LOs see
// other shops' unclaimed leads, or only their own?" — is deferred to F3.6,
// when Tenant B exists and we can reason about it concretely.
//
// We use an unmatchable UUID rather than a special branch in the caller, so
// applyBucket continues to return a query of the same shape regardless of
// bucket. This avoids branching in fetchCounts and the page query.
//
// At F3.6, replace this with the actual pool-scoping rule.
//
// Grep target for cleanup: POOL_DEFERRED_F3_6
// -----------------------------------------------------------------------------
const UNMATCHABLE_UUID = '00000000-0000-0000-0000-000000000000'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function clampInt(value: string | null, def: number, min: number, max: number) {
  if (!value) return def
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return def
  if (n < min) return min
  if (n > max) return max
  return n
}

function parseBucket(value: string | null): Bucket {
  switch (value) {
    case 'pending':
    case 'claimed':
    case 'pool':
    case 'all':
      return value
    default:
      return 'assigned'
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function previewOf(messages: unknown): { count: number; preview: string | null } {
  if (!Array.isArray(messages)) return { count: 0, preview: null }
  const count = messages.length
  if (count === 0) return { count: 0, preview: null }

  // Prefer the most recent borrower (user) message; fall back to the last
  // message regardless of role.
  const lastUser = [...messages]
    .reverse()
    .find(
      (m) =>
        m && typeof m === 'object' && (m as ChatMessage).role === 'user'
    ) as ChatMessage | undefined

  const last = (lastUser ?? messages[messages.length - 1]) as
    | ChatMessage
    | undefined

  const text =
    last && typeof last.content === 'string' ? last.content : ''
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const preview =
    trimmed.length > 160 ? trimmed.slice(0, 157) + '…' : trimmed

  return { count, preview: preview || null }
}

function toScenarioRow(r: ScenarioRowDb): ScenarioRowOut {
  const sd = (r.scenario_data || {}) as Record<string, unknown>
  const homePrice = toNumberOrNull(sd.homePrice)
  const downPayment = toNumberOrNull(sd.downPayment)

  const estimatedLoanAmount =
    homePrice !== null && downPayment !== null
      ? Math.max(homePrice - downPayment, 0)
      : null

  const estimatedLtv =
    homePrice !== null && homePrice > 0 && estimatedLoanAmount !== null
      ? estimatedLoanAmount / homePrice
      : null

  const { count, preview } = previewOf(r.conversation)

  return {
    scenarioId: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    status: r.status,
    assignmentMethod: r.assignment_method,
    borrowerPath: r.borrower_path,
    triggerEvent: r.trigger_event,
    language: r.language,
    sourcePage: r.source_page,
    borrower: {
      id: r.borrower?.id ?? r.borrower_id ?? null,
      name: r.borrower?.full_name ?? null,
      email: r.borrower?.email ?? null,
      phone: r.borrower?.phone ?? null,
      preferredLanguage: r.borrower?.preferred_language ?? null,
    },
    realtor: r.realtor
      ? {
          id: r.realtor.id,
          name: r.realtor.full_name,
          email: r.realtor.email,
          phone: r.realtor.phone,
        }
      : null,
    intakeData: (r.intake_data || {}) as Record<string, unknown>,
    scenarioData: sd,
    scenarioSummary: {
      homePrice,
      downPayment,
      estimatedLoanAmount,
      estimatedLtv,
    },
    msgCount: count,
    lastMessagePreview: preview,
    claimedAt: r.claimed_at,
    claimedByWorkflowFileId: r.claimed_by_workflow_file_id,
    abandonedAt: r.abandoned_at,
  }
}

// -----------------------------------------------------------------------------
// Query construction
// -----------------------------------------------------------------------------

const SELECT_COLUMNS = `
  id,
  borrower_id,
  realtor_id,
  assigned_loan_officer_id,
  language,
  borrower_path,
  intake_data,
  scenario_data,
  conversation,
  status,
  assignment_method,
  source_page,
  trigger_event,
  claimed_at,
  claimed_by_workflow_file_id,
  abandoned_at,
  created_at,
  updated_at,
  borrower:borrowers ( id, full_name, email, phone, preferred_language ),
  realtor:realtors ( id, full_name, email, phone )
`

// Supabase's chained-query types are intentionally complex generics; using
// `any`-ish shape here keeps this helper readable. Behavior is well-defined
// by the bucket cases below.
//
// F3.3: every bucket either filters on assigned_tenant_id = viewer's
// tenant, or returns zero rows via UNMATCHABLE_UUID (pool — see
// POOL_DEFERRED_F3_6 above).
function applyBucket<Q extends { eq: Function; in: Function; or: Function }>(
  query: Q,
  bucket: Bucket,
  viewerId: string,
  tenantId: string
): Q {
  switch (bucket) {
    case 'assigned':
      return query
        .eq('assigned_loan_officer_id', viewerId)
        .eq('assigned_tenant_id', tenantId)
        .in('status', ['assigned_pending_claim', 'claimed'])
    case 'pending':
      return query
        .eq('assigned_loan_officer_id', viewerId)
        .eq('assigned_tenant_id', tenantId)
        .eq('status', 'assigned_pending_claim')
    case 'claimed':
      return query
        .eq('assigned_loan_officer_id', viewerId)
        .eq('assigned_tenant_id', tenantId)
        .eq('status', 'claimed')
    case 'pool':
      // POOL_DEFERRED_F3_6: deliberately unmatchable.
      return query.eq('id', UNMATCHABLE_UUID)
    case 'all':
      // F3.3: 'all' no longer includes the pool. It's now equivalent to a
      // tenant-scoped 'mine' across statuses.
      return query
        .eq('assigned_loan_officer_id', viewerId)
        .eq('assigned_tenant_id', tenantId)
  }
}

// -----------------------------------------------------------------------------
// Counts — head/count only, no row payload, parallelized.
// -----------------------------------------------------------------------------

async function fetchCounts(viewerId: string, tenantId: string) {
  const make = (bucket: Bucket) => {
    const q = supabaseAdmin
      .from('borrower_scenarios')
      .select('id', { count: 'exact', head: true })
    return applyBucket(q, bucket, viewerId, tenantId)
  }

  // POOL_DEFERRED_F3_6: pool count is always 0 under F3.3. Skip the DB
  // round-trip entirely.
  const [assigned, pending, claimed] = await Promise.all([
    make('assigned'),
    make('pending'),
    make('claimed'),
  ])

  return {
    assigned: assigned.count ?? 0,
    pending: pending.count ?? 0,
    claimed: claimed.count ?? 0,
    pool: 0,
  }
}

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // Auth — verify signed cookie, then re-confirm against the live
    // employees row. The session cookie is HMAC-signed, but role,
    // is_active, and tenant_id can change after issuance. The live
    // employees row is the authoritative source of truth for tenant scope.
    // -----------------------------------------------------------------------
    const session = getSessionFromRequest(req)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated.' },
        { status: 401 }
      )
    }

    const { data: viewer, error: viewerErr } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, email, role, is_active, tenant_id')
      .eq('id', session.userId)
      .maybeSingle()

    if (viewerErr) {
      console.error('team/inbox: viewer lookup failed.', viewerErr)
      return NextResponse.json(
        { success: false, error: 'Failed to verify session.' },
        { status: 500 }
      )
    }

    if (!viewer || !viewer.is_active) {
      return NextResponse.json(
        { success: false, error: 'Session no longer valid.' },
        { status: 401 }
      )
    }

    if (viewer.role !== 'Loan Officer') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Inbox is currently available to Loan Officer accounts only.',
          role: viewer.role,
        },
        { status: 403 }
      )
    }

    // employees.tenant_id is NOT NULL post-F3.1, but defend against any
    // mid-migration row drift just in case.
    if (!viewer.tenant_id) {
      console.error(
        'team/inbox: viewer has no tenant_id — should be impossible post-F3.1.',
        { viewerId: viewer.id }
      )
      return NextResponse.json(
        { success: false, error: 'Session no longer valid.' },
        { status: 401 }
      )
    }

    // -----------------------------------------------------------------------
    // Parse and clamp query params.
    // -----------------------------------------------------------------------
    const url = new URL(req.url)
    const bucket = parseBucket(url.searchParams.get('bucket'))
    const limit = clampInt(url.searchParams.get('limit'), 25, 1, 100)
    const offset = clampInt(url.searchParams.get('offset'), 0, 0, 100_000)

    // -----------------------------------------------------------------------
    // Page query — rows for the current bucket. Counts run in parallel.
    // -----------------------------------------------------------------------
    let pageQuery = supabaseAdmin
      .from('borrower_scenarios')
      .select(SELECT_COLUMNS, { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    pageQuery = applyBucket(pageQuery, bucket, viewer.id, viewer.tenant_id)

    const [pageResult, counts] = await Promise.all([
      pageQuery,
      fetchCounts(viewer.id, viewer.tenant_id),
    ])

    const { data: rows, error: rowsErr, count: total } = pageResult

    if (rowsErr) {
      console.error('team/inbox: rows query failed.', rowsErr)
      return NextResponse.json(
        { success: false, error: 'Failed to load inbox.' },
        { status: 500 }
      )
    }

    const items = ((rows ?? []) as unknown as ScenarioRowDb[]).map(
      toScenarioRow
    )

    return NextResponse.json({
      success: true,
      viewer: {
        id: viewer.id,
        name: viewer.full_name,
        email: viewer.email,
        role: viewer.role,
      },
      bucket,
      counts,
      items,
      pagination: {
        limit,
        offset,
        total: total ?? items.length,
      },
    })
  } catch (err) {
    console.error('team/inbox: unhandled error.', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
