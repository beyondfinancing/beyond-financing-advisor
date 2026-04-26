// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     app/api/team/scenarios/[id]/abandon/route.ts
//
// =============================================================================
//
// PHASE 5.3 — ABANDON A SCENARIO (TERMINAL)
//
// Marks a scenario as abandoned with optional reason. Valid from either
// 'assigned_pending_claim' or 'claimed'. If the scenario was claimed,
// the route also archives the associated workflow file.
//
// This is a terminal status — no API is provided to un-abandon. If a
// scenario was abandoned in error, an admin must reset it via SQL.
//
// Request body (JSON):
//   { reason?: string }   // optional free text
//
// Response (200):
//   {
//     success: true,
//     scenarioId,
//     status: 'abandoned',
//     abandonedAt,
//     abandonedReason
//   }
//
// Errors:
//   401 — auth failed
//   403 — caller is not the assigned LO
//   404 — scenario does not exist
//   409 — scenario is not in a state that allows abandonment
//   500 — internal error
//
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireTeamUser } from '@/lib/team-guards'

type AbandonRequestBody = {
  reason?: string
}

const ABANDONABLE_STATUSES = ['assigned_pending_claim', 'claimed'] as const

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

    const body = (await req.json().catch(() => ({}))) as AbandonRequestBody
    const reasonRaw =
      typeof body.reason === 'string' ? body.reason.trim() : ''
    const reason = reasonRaw || null

    // -----------------------------------------------------------------------
    // Pre-flight.
    // -----------------------------------------------------------------------
    const { data: scenario, error: scenarioErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .select(
        'id, status, assigned_loan_officer_id, claimed_by_workflow_file_id'
      )
      .eq('id', scenarioId)
      .maybeSingle()

    if (scenarioErr) {
      console.error('abandon: scenario load failed.', scenarioErr)
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

    if (
      !ABANDONABLE_STATUSES.includes(
        scenario.status as (typeof ABANDONABLE_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Scenario cannot be abandoned from status '${scenario.status}'.`,
          currentStatus: scenario.status,
        },
        { status: 409 }
      )
    }

    // -----------------------------------------------------------------------
    // If claimed, archive the workflow file. Best-effort, idempotent.
    // -----------------------------------------------------------------------
    if (scenario.claimed_by_workflow_file_id) {
      const { error: archiveErr } = await supabaseAdmin
        .from('workflow_files')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', scenario.claimed_by_workflow_file_id)
        .is('archived_at', null)

      if (archiveErr) {
        console.error('abandon: workflow file archive failed.', archiveErr)
        // Continue — scenario abandonment still proceeds.
      }
    }

    // -----------------------------------------------------------------------
    // Stamp abandoned. Optimistic lock on status.
    // -----------------------------------------------------------------------
    const abandonedAt = new Date().toISOString()
    const { data: abandoned, error: abandonErr } = await supabaseAdmin
      .from('borrower_scenarios')
      .update({
        status: 'abandoned',
        abandoned_at: abandonedAt,
        abandoned_reason: reason,
        updated_at: abandonedAt,
      })
      .eq('id', scenarioId)
      .in('status', ABANDONABLE_STATUSES as unknown as string[])
      .select('id')
      .maybeSingle()

    if (abandonErr || !abandoned) {
      console.error('abandon: status flip failed.', abandonErr)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to abandon scenario. It may have changed.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      scenarioId,
      status: 'abandoned',
      abandonedAt,
      abandonedReason: reason,
    })
  } catch (err) {
    console.error('abandon: unhandled error.', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
