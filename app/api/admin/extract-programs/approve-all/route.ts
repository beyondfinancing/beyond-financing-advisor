// =============================================================================
// PHASE 7.3 — APPROVE ALL DRAFTS FROM A DOCUMENT
//
// Paste this file at:
//     app/api/admin/extract-programs/approve-all/route.ts
//
// What it does:
//   POST { documentId: "<lender_documents.id>" }
//
//   Finds all draft programs (source='extracted', is_active=false,
//   source_document_id=documentId) and flips them all to active in one shot.
//   Also activates their program_guidelines rows.
//
// Response:
//   { ok, approvedCount, programIds }
//
// Auth: admin only.
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

  // Find all drafts from this document.
  const { data: drafts, error: findError } = await supabaseAdmin
    .from('programs')
    .select('id, name')
    .eq('source_document_id', documentId)
    .eq('source', 'extracted')
    .eq('is_active', false)

  if (findError) {
    return NextResponse.json(
      { ok: false, error: `Failed to find drafts: ${findError.message}` },
      { status: 500 }
    )
  }

  if (!drafts || drafts.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No draft programs found for this document.',
      approvedCount: 0,
      programIds: [],
    })
  }

  const draftIds = drafts.map((d) => d.id)

  // Activate programs.
  const { error: programUpdateError } = await supabaseAdmin
    .from('programs')
    .update({ is_active: true })
    .in('id', draftIds)

  if (programUpdateError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to activate programs: ${programUpdateError.message}`,
      },
      { status: 500 }
    )
  }

  // Activate guidelines (best effort — log and continue if it fails).
  const { error: guidelineUpdateError } = await supabaseAdmin
    .from('program_guidelines')
    .update({ is_active: true })
    .in('program_id', draftIds)

  if (guidelineUpdateError) {
    console.warn(
      '[approve-all] Programs activated but guideline activation failed:',
      guidelineUpdateError.message
    )
  }

  return NextResponse.json({
    ok: true,
    approvedCount: draftIds.length,
    programIds: draftIds,
    programNames: drafts.map((d) => d.name),
  })
}
