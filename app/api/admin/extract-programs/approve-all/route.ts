// =============================================================================
// PHASE 7.5 — REPLACEMENT for app/api/admin/extract-programs/approve-all/route.ts
//
// What changed vs Phase 7.3:
//   When approving drafts from a document, we now check BOTH programs and
//   global_guidelines tables and activate whichever has draft rows for the
//   given document. A single document only writes to one table, but this
//   approve-all endpoint is now table-agnostic.
//
//   Returns counts for both so the UI/JSON consumer knows what happened.
// =============================================================================

import { NextResponse } from 'next/server'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  let body: { documentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const documentId = String(body?.documentId || '').trim()
  if (!documentId) {
    return NextResponse.json(
      { ok: false, error: 'documentId is required.' },
      { status: 400 }
    )
  }

  // ---------------- TABLE 1: programs (regular lender programs) ----------------
  const { data: programDrafts, error: programFindError } = await supabaseAdmin
    .from('programs')
    .select('id, name')
    .eq('source_document_id', documentId)
    .eq('source', 'extracted')
    .eq('is_active', false)

  if (programFindError) {
    return NextResponse.json(
      { ok: false, error: `Failed to find program drafts: ${programFindError.message}` },
      { status: 500 }
    )
  }

  let programsApproved = 0
  let programNames: string[] = []
  let programIds: string[] = []

  if (programDrafts && programDrafts.length > 0) {
    programIds = programDrafts.map((d) => d.id)
    programNames = programDrafts.map((d) => d.name)

    const { error: programUpdateError } = await supabaseAdmin
      .from('programs')
      .update({ is_active: true })
      .in('id', programIds)

    if (programUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to activate programs: ${programUpdateError.message}`,
        },
        { status: 500 }
      )
    }

    // Also activate guideline rows
    await supabaseAdmin
      .from('program_guidelines')
      .update({ is_active: true })
      .in('program_id', programIds)

    programsApproved = programIds.length
  }

  // ---------------- TABLE 2: global_guidelines (agency programs) ----------------
  const { data: agencyDrafts, error: agencyFindError } = await supabaseAdmin
    .from('global_guidelines')
    .select('id, program_name, agency, product_family')
    .eq('source_document_id', documentId)
    .eq('source', 'extracted')
    .eq('is_active', false)

  if (agencyFindError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to find global guideline drafts: ${agencyFindError.message}`,
      },
      { status: 500 }
    )
  }

  let agencyApproved = 0
  let agencyNames: string[] = []
  let agencyIds: string[] = []

  if (agencyDrafts && agencyDrafts.length > 0) {
    agencyIds = agencyDrafts.map((d) => d.id)
    agencyNames = agencyDrafts.map(
      (d) => `${d.agency} ${d.product_family} — ${d.program_name}`
    )

    const { error: agencyUpdateError } = await supabaseAdmin
      .from('global_guidelines')
      .update({ is_active: true })
      .in('id', agencyIds)

    if (agencyUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to activate agency guidelines: ${agencyUpdateError.message}`,
        },
        { status: 500 }
      )
    }

    agencyApproved = agencyIds.length
  }

  const totalApproved = programsApproved + agencyApproved

  if (totalApproved === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No draft programs or agency guidelines found for this document.',
      approvedCount: 0,
      programIds: [],
      programNames: [],
    })
  }

  return NextResponse.json({
    ok: true,
    approvedCount: totalApproved,
    programsApproved,
    agencyApproved,
    programIds: [...programIds, ...agencyIds],
    programNames: [...programNames, ...agencyNames],
  })
}
