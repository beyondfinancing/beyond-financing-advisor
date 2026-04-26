// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     app/api/team/scenarios/[id]/route.ts
//
// =============================================================================
//
// PHASE 5.4 SUPPORT — SCENARIO DETAIL
//
// Returns the full scenario for the inbox detail pane, including the
// conversation transcript that the list endpoint omits.
//
// Authorization:
//   - Loan Officer assigned to this scenario → can view.
//   - Anyone (LO role) for pool scenarios (status=awaiting_assignment).
//   - Everything else → 403.
//
// Response (200):
//   { success: true, scenario: { ... full row + embeds ... } }
//
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireTeamUser } from '@/lib/team-guards'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
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

    const { data: scenario, error } = await supabaseAdmin
      .from('borrower_scenarios')
      .select(`
        id,
        status,
        assignment_method,
        borrower_path,
        language,
        intake_data,
        scenario_data,
        conversation,
        trigger_event,
        source_page,
        claimed_at,
        claimed_by_workflow_file_id,
        abandoned_at,
        abandoned_reason,
        assigned_loan_officer_id,
        created_at,
        updated_at,
        borrower:borrowers ( id, full_name, email, phone, preferred_language ),
        realtor:realtors ( id, full_name, email, phone )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('scenario detail: load failed.', error)
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

    const isAssignedToMe = scenario.assigned_loan_officer_id === viewer.id
    const isPool = scenario.status === 'awaiting_assignment'
    if (!isAssignedToMe && !isPool) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to view this scenario.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, scenario })
  } catch (err) {
    console.error('scenario detail: unhandled error.', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
