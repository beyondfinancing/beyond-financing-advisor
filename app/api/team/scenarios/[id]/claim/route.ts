// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     app/api/team/scenarios/[id]/claim/route.ts
//
// =============================================================================
//
// PHASE 5.3 — CLAIM A SCENARIO
//
// Sandro clicks "Claim" in the inbox and fills in the modal. This route:
//   1. Verifies the caller is the assigned LO and the scenario is in
//      'assigned_pending_claim' status.
//   2. Atomically flips status -> 'claimed' and stamps claimed_at via an
//      UPDATE with a status-equals-pending guard. The guard acts as an
//      optimistic lock: only one writer wins.
//   3. Creates a workflow_files row pre-filled with everything we know:
//      borrower name, purpose (LO override), target_close, property_address,
//      loan_officer name, computed loan amount. If the borrower has a
//      realtor and borrower_path is Purchase or Investment, pre-fills
//      buyer_agent_*.
//   4. Links the new workflow file back via claimed_by_workflow_file_id.
//
// Race protection: the optimistic UPDATE in step 2 is the mutex. If
// another LO (or the same LO double-clicking) already claimed, the
// UPDATE matches zero rows and we return 409.
//
// Failure recovery: if step 2 succeeds but step 3 (workflow file insert)
// fails, the route reverts the scenario to 'assigned_pending_claim' so
// it can be re-claimed cleanly. Rollback failure is logged loudly.
//
// Request body (JSON):
//   {
//     purpose:         string                  // required; dropdown value
//     targetClose?:    string (YYYY-MM-DD)     // optional
//     propertyAddress?: string                  // optional
//   }
//
// Response (200):
//   {
//     success: true,
//     scenarioId, status: 'claimed', claimedAt,
//     workflowFile: { id, ... }
//   }
//
// Errors:
//   400 — missing purpose
//   401 — auth failed
//   403 — caller is not the assigned LO
//   404 — scenario does not exist
//   409 — scenario is no longer claimable
//   500 — internal error
//
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireTeamUser } from '@/lib/team-guards'

type ClaimRequestBody = {
  purpose?: string
  targetClose?: string | null
  propertyAddress?: string | null
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asDateOrNull(v: unknown): string | null {
  const s = asString(v)
  if (!s) return null
  // Loose YYYY-MM-DD validation; Postgres date type rejects malformed input.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scenarioId } = await context.params
    if (!scenarioId) {
      return NextResponse.json(
        { success: false, error: 'Missing scenario id.' },
        { status: 400 }
      )
    }

    // -----------------------------------------------------------------------
    // Auth — Loan Officer only.
    // -----------------------------------------------------------------------
    const guard = await requireTeamUser(req, {
      allowedRoles: ['Loan Officer'],
    })
    if (!guard.ok) return guard.response
    const viewer = guard.viewer

    // -----------------------------------------------------------------------
    // Parse and validate body.
    // -----------------------------------------------------------------------
    const body = (await req.json().catch(() => ({}))) as ClaimRequestBody
    const purpose = asString(body.purpose)
    const targetClose = asDateOrNull(body.targetClose)
    const propertyAddress = asString(body.propertyAddress)

    if (!purpose) {
      return NextResponse.json(
        { success: false, error: 'Purpose is required.' },
        { status: 400 }
      )
    }

    // -----------------------------------------------------------------------
    // Pre-flight: load scenario for context (borrower, realtor, path) and
    // fail fast on ownership / status mismatches with clear error codes.
    // -----------------------------------------------------------------------
    const { data: scenario, error: scenarioErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .select(`
        id,
        status,
        assigned_loan_officer_id,
        borrower_path,
        scenario_data,
        borrower:borrowers ( id, full_name, email, phone ),
        realtor:realtors ( id, full_name, email, phone )
      `)
      .eq('id', scenarioId)
      .maybeSingle()

    if (scenarioErr) {
      console.error('claim: scenario load failed.', scenarioErr)
      return NextResponse.json(
        { success: false, error: 'Failed to load scenario.' },
        { status: 500 }
      )
    }

    if (!scenario) {
      return NextResponse.json(
        { success: false, error: 'Scenario not found.' },
        { status: 404 }
      )
    }

    if (scenario.assigned_loan_officer_id !== viewer.id) {
      return NextResponse.json(
        { success: false, error: 'Scenario is not assigned to you.' },
        { status: 403 }
      )
    }

    if (scenario.status !== 'assigned_pending_claim') {
      return NextResponse.json(
        {
          success: false,
          error: `Scenario cannot be claimed from status '${scenario.status}'.`,
          currentStatus: scenario.status,
        },
        { status: 409 }
      )
    }

    // -----------------------------------------------------------------------
    // Step 1 — Optimistic lock: flip status to 'claimed' only if it is
    // still 'assigned_pending_claim'. The compound WHERE acts as the
    // mutex: between two concurrent claimers, only one UPDATE matches a
    // row, the other gets `data: null`.
    // -----------------------------------------------------------------------
    const claimedAt = new Date().toISOString()

    const { data: stamped, error: stampErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .update({
        status: 'claimed',
        claimed_at: claimedAt,
        updated_at: claimedAt,
      })
      .eq('id', scenarioId)
      .eq('status', 'assigned_pending_claim')
      .eq('assigned_loan_officer_id', viewer.id)
      .select('id')
      .maybeSingle()

    if (stampErr) {
      console.error('claim: status stamp failed.', stampErr)
      return NextResponse.json(
        { success: false, error: 'Failed to claim scenario.' },
        { status: 500 }
      )
    }

    if (!stamped) {
      // Lost the race — somebody else just claimed it, or the row state
      // changed between our read and our write.
      return NextResponse.json(
        {
          success: false,
          error:
            'Scenario was claimed or changed by someone else. Refresh your inbox.',
        },
        { status: 409 }
      )
    }

    // -----------------------------------------------------------------------
    // Step 2 — Create the workflow file with everything we know.
    // -----------------------------------------------------------------------
    type ScenarioData = { homePrice?: unknown; downPayment?: unknown }
    const sd = (scenario.scenario_data || {}) as ScenarioData
    const homePrice = Number(sd.homePrice) || 0
    const downPayment = Number(sd.downPayment) || 0
    const loanAmount = Math.max(homePrice - downPayment, 0)

    type EmbeddedPerson = {
      full_name: string | null
      email: string | null
      phone: string | null
    } | null
    const borrower = (scenario as unknown as { borrower: EmbeddedPerson })
      .borrower
    const realtor = (scenario as unknown as { realtor: EmbeddedPerson })
      .realtor

    // Pre-fill buyer_agent only when the realtor is plausibly a buyer-side
    // contact for this scenario. Refinances don't carry an agent.
    const isPurchaseSide =
      scenario.borrower_path === 'Purchase' ||
      scenario.borrower_path === 'Investment'

    const buyerAgentPrefill =
      isPurchaseSide && realtor
        ? {
            buyer_agent_name: realtor.full_name,
            buyer_agent_email: realtor.email,
            buyer_agent_phone: realtor.phone,
          }
        : {}

    const workflowFilePayload = {
      borrower_name: borrower?.full_name || null,
      purpose,
      amount: loanAmount > 0 ? loanAmount : null,
      status: 'new',
      loan_officer: viewer.full_name,
      target_close: targetClose,
      property_address: propertyAddress || null,
      latest_update: 'Claimed from Beyond Intelligence inbox.',
      notification_active: true,
      final_notification_sent: false,
      ...buyerAgentPrefill,
    }

    const { data: workflowFile, error: wfErr } = await supabaseAdmin
      .from('workflow_files')
      .insert(workflowFilePayload)
      .select('*')
      .maybeSingle()

    if (wfErr || !workflowFile) {
      console.error('claim: workflow file insert failed.', wfErr)

      // -----------------------------------------------------------------
      // Rollback the scenario stamp so it can be re-claimed cleanly.
      // -----------------------------------------------------------------
      const { error: rollbackErr } = await supabaseAdmin
        .from('borrower_scenarios')
        .update({
          status: 'assigned_pending_claim',
          claimed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scenarioId)
        .eq('status', 'claimed')

      if (rollbackErr) {
        console.error(
          'claim: ROLLBACK FAILED — scenario stamped claimed but workflow file is missing.',
          { scenarioId, rollbackErr }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create workflow file. Claim has been reverted.',
        },
        { status: 500 }
      )
    }

    // -----------------------------------------------------------------------
    // Step 3 — Link the workflow file back to the scenario.
    // Best-effort: if this fails the claim is functionally complete
    // (status='claimed', workflow file exists), we just lose the
    // back-reference. Log it for reconciliation.
    // -----------------------------------------------------------------------
    const { error: linkErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .update({
        claimed_by_workflow_file_id: workflowFile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scenarioId)

    if (linkErr) {
      console.error(
        'claim: back-link update failed (claim succeeded; link missing).',
        { scenarioId, workflowFileId: workflowFile.id, linkErr }
      )
    }

    return NextResponse.json({
      success: true,
      scenarioId,
      status: 'claimed',
      claimedAt,
      workflowFile,
    })
  } catch (err) {
    console.error('claim: unhandled error.', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
