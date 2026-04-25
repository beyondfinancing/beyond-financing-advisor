// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/public/team-users/route.ts
//
// =============================================================================
//
// PHASE 5-prep-B — State filtering for realtor and LO autocomplete
//
// What changed vs. Phase 3.1:
//
//   1. Now accepts an optional `?state=XX` query parameter (2-letter state
//      code like SC, MA, FL).
//
//   2. When `state` is provided:
//        - Realtors are filtered to only those with that state in
//          their licensed_states array.
//        - Loan Officers are filtered to only those with that state in
//          their licensed_states array.
//        - Branch Managers, LO Assistants, Processors, etc. are NOT
//          state-filtered (they're internal staff, not borrower-facing).
//
//   3. When `state` is omitted:
//        - Returns ALL active realtors and loan officers (Phase 3.1
//          behavior preserved for callers who don't yet pass state).
//
// Response shape preserved exactly:
//   {
//     success: true,
//     loanOfficers: [...],
//     realtors: [...]
//   }
//
// =============================================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const FINLEY_BOT_NMLS = '2394496FB'

type LoanOfficerOut = {
  id: string
  name: string
  email: string
  nmls: string
  phone: string
  calendly: string
  assistantEmail: string
  isBot: boolean
  licensedStates: string[]
}

type RealtorOut = {
  id: string
  name: string
  email: string
  phone: string
  mls: string
  licensedStates: string[]
}

function safe(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStateCode(value: string | null): string {
  if (!value) return ''
  return value.trim().toUpperCase().slice(0, 2)
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const stateFilter = normalizeStateCode(url.searchParams.get('state'))

    // -------------------------------------------------------------------------
    // Loan officers — pull from `employees` where role = 'Loan Officer'
    // (Branch Managers with is_branch_manager=true are STILL Loan Officers
    // by primary role, so they're included.)
    // -------------------------------------------------------------------------

    let loQuery = supabaseAdmin
      .from('employees')
      .select(
        'id, full_name, email, nmls, phone, calendly_url, role, licensed_states, is_active'
      )
      .eq('role', 'Loan Officer')
      .eq('is_active', true)

    if (stateFilter) {
      // Postgres array containment: licensed_states @> ARRAY['SC']
      loQuery = loQuery.contains('licensed_states', [stateFilter])
    }

    const { data: loRows, error: loErr } = await loQuery
    if (loErr) {
      console.error('public/team-users: employees query failed.', loErr)
      return NextResponse.json(
        { success: false, error: 'Failed to load loan officers.' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // For each LO, find their primary assistant via the matrix.
    // -------------------------------------------------------------------------

    const loIds = (loRows || []).map((r) => r.id).filter(Boolean) as string[]

    const assistantEmailByLoId = new Map<string, string>()

    if (loIds.length > 0) {
      const { data: assignments, error: aerr } = await supabaseAdmin
        .from('lo_assistant_assignments')
        .select('loan_officer_id, assistant_id, is_active, is_primary')
        .in('loan_officer_id', loIds)
        .eq('is_active', true)

      if (!aerr && assignments && assignments.length > 0) {
        const assistantIds = assignments.map((a) => a.assistant_id)
        const { data: assistants, error: aaerr } = await supabaseAdmin
          .from('employees')
          .select('id, email, is_active')
          .in('id', assistantIds)
          .eq('is_active', true)

        if (!aaerr && assistants) {
          const assistantEmailById = new Map<string, string>()
          for (const a of assistants) {
            if (a.id && a.email) assistantEmailById.set(a.id, a.email)
          }

          // Group by LO and pick primary first, else any
          const byLo = new Map<string, { id: string; isPrimary: boolean }[]>()
          for (const a of assignments) {
            const arr = byLo.get(a.loan_officer_id) || []
            arr.push({ id: a.assistant_id, isPrimary: !!a.is_primary })
            byLo.set(a.loan_officer_id, arr)
          }

          for (const [loId, list] of byLo.entries()) {
            const primary = list.find((x) => x.isPrimary) || list[0]
            const email = primary ? assistantEmailById.get(primary.id) : null
            if (email) assistantEmailByLoId.set(loId, email)
          }
        }
      }
    }

    const loanOfficers: LoanOfficerOut[] = (loRows || []).map((r) => {
      const nmls = safe(r.nmls)
      const isBot = nmls === FINLEY_BOT_NMLS
      return {
        id: r.id,
        name: safe(r.full_name),
        email: safe(r.email),
        nmls,
        phone: safe(r.phone),
        calendly: safe(r.calendly_url),
        assistantEmail: assistantEmailByLoId.get(r.id) || '',
        isBot,
        licensedStates: Array.isArray(r.licensed_states) ? r.licensed_states : [],
      }
    })

    // -------------------------------------------------------------------------
    // Realtors — pull from `realtors`.
    // -------------------------------------------------------------------------

    let realtorQuery = supabaseAdmin
      .from('realtors')
      .select('id, full_name, email, phone, mls_id, licensed_states, is_active')
      .eq('is_active', true)

    if (stateFilter) {
      realtorQuery = realtorQuery.contains('licensed_states', [stateFilter])
    }

    const { data: realtorRows, error: rErr } = await realtorQuery
    if (rErr) {
      console.error('public/team-users: realtors query failed.', rErr)
      return NextResponse.json(
        { success: false, error: 'Failed to load realtors.' },
        { status: 500 }
      )
    }

    const realtors: RealtorOut[] = (realtorRows || []).map((r) => ({
      id: r.id,
      name: safe(r.full_name),
      email: safe(r.email),
      phone: safe(r.phone),
      mls: safe(r.mls_id),
      licensedStates: Array.isArray(r.licensed_states) ? r.licensed_states : [],
    }))

    // -------------------------------------------------------------------------
    // Sort alphabetically for stable autocomplete UX.
    // -------------------------------------------------------------------------

    loanOfficers.sort((a, b) => a.name.localeCompare(b.name))
    realtors.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      success: true,
      stateFilter: stateFilter || null,
      loanOfficers,
      realtors,
    })
  } catch (err) {
    console.error('public/team-users: unhandled error.', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
