// =============================================================================
// PHASE 7.5d — NEW FILE: app/api/admin/agency-guidelines/approve-singletons/route.ts
//
// Bulk-approves all draft global_guidelines records that are NOT part of a
// duplicate cluster. Safe by design: never approves a record whose
// (agency, product_family, normalized program_name) signature matches another
// draft or active record — those need human judgment via merge/pick winner.
//
// POST {} (no body needed)
//
// Returns:
//   { success: true, approvedCount: N, skippedCount: M, skippedClusters: [...] }
// =============================================================================

import { NextResponse } from 'next/server'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

type AgencyGuidelineRow = {
  id: string
  agency: string
  product_family: string
  program_name: string
  is_active: boolean
}

function normalizeProgramName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function POST() {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  // Fetch ALL global_guidelines (drafts + active) so we can identify
  // which drafts are singletons vs which share a key with another record.
  const { data: allRecords, error: fetchError } = await supabaseAdmin
    .from('global_guidelines')
    .select('id, agency, product_family, program_name, is_active')

  if (fetchError || !allRecords) {
    return NextResponse.json(
      {
        success: false,
        error: fetchError?.message || 'Failed to load records.',
      },
      { status: 500 }
    )
  }

  const typedRecords = allRecords as AgencyGuidelineRow[]

  // Group every record (active OR draft) by signature
  const signatureCounts = new Map<string, number>()
  for (const r of typedRecords) {
    const sig = `${r.agency}::${r.product_family}::${normalizeProgramName(
      r.program_name
    )}`
    signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1)
  }

  // A draft is a "true singleton" if its signature appears exactly once
  // across ALL records (drafts + active). If it appears 2+ times, it's
  // either part of a draft cluster or it duplicates an already-active
  // record — either way, human judgment needed.
  const singletonDraftIds: string[] = []
  const skippedSignatures = new Set<string>()

  for (const r of typedRecords) {
    if (r.is_active) continue // skip active records
    const sig = `${r.agency}::${r.product_family}::${normalizeProgramName(
      r.program_name
    )}`
    const count = signatureCounts.get(sig) || 0
    if (count === 1) {
      singletonDraftIds.push(r.id)
    } else {
      skippedSignatures.add(sig)
    }
  }

  if (singletonDraftIds.length === 0) {
    return NextResponse.json({
      success: true,
      approvedCount: 0,
      skippedCount: skippedSignatures.size,
      skippedClusters: Array.from(skippedSignatures).map((s) => {
        const [agency, product_family, programName] = s.split('::')
        return { agency, product_family, programName }
      }),
      message: 'No singleton drafts to approve.',
    })
  }

  // Bulk activate
  const { error: updateError } = await supabaseAdmin
    .from('global_guidelines')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .in('id', singletonDraftIds)

  if (updateError) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to activate singletons: ${updateError.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    approvedCount: singletonDraftIds.length,
    skippedCount: skippedSignatures.size,
    skippedClusters: Array.from(skippedSignatures).map((s) => {
      const [agency, product_family, programName] = s.split('::')
      return { agency, product_family, programName }
    }),
  })
}

