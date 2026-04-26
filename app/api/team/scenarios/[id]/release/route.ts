// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     app/api/team/scenarios/[id]/release/route.ts
//
// =============================================================================
//
// PHASE 5.3 — RELEASE A CLAIMED SCENARIO
//
// LO had claimed the scenario; now they're letting it go. The workflow
// file is archived (preserves audit trail), and the scenario returns to
// 'assigned_pending_claim' so it can be re-claimed.
//
// Audit columns claimed_at and claimed_by_workflow_file_id are LEFT IN
// PLACE on release — they reflect the most recent claim attempt and let
// the inbox UI show "previously claimed" indicators if desired. A
// re-claim simply overwrites them.
//
// Request body: none required. Empty body or `{}` is fine.
//
// Response (200):
//   { success: true, scenarioId, status: 'assigned_pending_claim' }
//
// Errors:
//   401 — auth failed
//   403 — caller is not the assigned LO
//   404 — scenario does not exist
//   409 — scenario is not in 'claimed' status
//   500 — internal error
//
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireTeamUser } from '@/lib/team-guards'

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

    const guard = await requireTeamUser(req, {
      allowedRoles: ['Loan Officer'],
    })
    if (!guard.ok) return guard.response
    const viewer = guard.viewer

    // -----------------------------------------------------------------------
    // Pre-flight: load and validate.
    // -----------------------------------------------------------------------
    const { data: scenario, error: scenarioErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .select(
        'id, status, assigned_loan_officer_id, claimed_by_workflow_file_id'
      )
      .eq('id', scenarioId)
      .maybeSingle()

    if (scenarioErr) {
      console.error('release: scenario load failed.', scenarioErr)
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

    if (scenario.status !== 'claimed') {
      return NextResponse.json(
        {
          success: false,
          error: `Scenario cannot be released from status '${scenario.status}'.`,
          currentStatus: scenario.status,
        },
        { status: 409 }
      )
    }

    // -----------------------------------------------------------------------
    // Archive the workflow file (best-effort but logged).
    // The `.is('archived_at', null)` guard makes this idempotent: if the
    // file is somehow already archived, we don't bump the timestamp.
    // -----------------------------------------------------------------------
    if (scenario.claimed_by_workflow_file_id) {
      const { error: archiveErr } = await supabaseAdmin
        .from('workflow_files')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', scenario.claimed_by_workflow_file_id)
        .is('archived_at', null)

      if (archiveErr) {
        console.error('release: workflow file archive failed.', archiveErr)
        // Continue — scenario release still proceeds. Orphan is recoverable.
      }
    }

    // -----------------------------------------------------------------------
    // Release the scenario back to pending. Optimistic lock on status.
    // -----------------------------------------------------------------------
    const updatedAt = new Date().toISOString()
    const { data: released, error: releaseErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .update({
        status: 'assigned_pending_claim',
        updated_at: updatedAt,
      })
      .eq('id', scenarioId)
      .eq('status', 'claimed')
      .select('id')
      .maybeSingle()

    if (releaseErr || !released) {
      console.error('release: status flip failed.', releaseErr)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to release scenario. It may have changed.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      scenarioId,
      status: 'assigned_pending_claim',
    })
  } catch (err) {
    console.error('release: unhandled error.', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
