// =============================================================================
// PHASE 7.5b — NEW FILE: app/api/admin/agency-guidelines/merge/route.ts
//
// Merges multiple global_guidelines drafts into one activated record.
// Used by the dedup cluster "Merge into one" action on /admin/agency-guidelines.
//
// POST { ids: string[] }
//
// Behavior:
//   1. Reads all records by id
//   2. Validates they all share the same agency, product_family, and
//      normalized program name (safety check)
//   3. Picks the "best" record as the base (highest confidence; if tied,
//      the most recent)
//   4. Merges fields from all records into the base:
//      - min_credit: lowest non-null value (most permissive)
//      - max_ltv: highest non-null value (most permissive)
//      - max_dti: highest non-null value (most permissive)
//      - max_units: highest non-null value
//      - occupancy: union of all arrays
//      - income_types: union of all arrays
//      - notes: concatenated with section dividers
//      - effective_date: latest non-null value
//      - source_name: comma-separated list of contributing source names
//      - extraction_metadata: array of all original metadata for audit
//   5. Updates base record with merged fields and is_active=true
//   6. Soft-rejects (or deletes) the other records:
//      - If draft (is_active=false), deletes
//      - If active, deactivates
//
// Returns the updated base record.
// =============================================================================

import { NextResponse } from 'next/server'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

type AgencyGuidelineRow = {
  id: string
  agency: string
  product_family: string
  program_name: string
  document_type: string | null
  occupancy: string[] | null
  income_types: string[] | null
  min_credit: number | null
  max_ltv: number | null
  max_dti: number | null
  max_units: number | null
  notes: string | null
  source_name: string | null
  effective_date: string | null
  is_active: boolean
  created_at: string
  source: string
  extraction_metadata: Record<string, unknown>
}

function normalizeProgramName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

function getConfidenceScore(record: AgencyGuidelineRow): number {
  const conf = (record.extraction_metadata as { confidence?: string })
    ?.confidence
  if (conf === 'high') return 3
  if (conf === 'medium') return 2
  if (conf === 'low') return 1
  return 0
}

export async function POST(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  let body: { ids?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : []

  if (ids.length < 2) {
    return NextResponse.json(
      { success: false, error: 'Need at least 2 ids to merge.' },
      { status: 400 }
    )
  }

  // Fetch all records
  const { data: records, error: fetchError } = await supabaseAdmin
    .from('global_guidelines')
    .select('*')
    .in('id', ids)

  if (fetchError || !records || records.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: fetchError?.message || 'No records found.',
      },
      { status: 500 }
    )
  }

  if (records.length !== ids.length) {
    return NextResponse.json(
      {
        success: false,
        error: `Expected ${ids.length} records, found ${records.length}.`,
      },
      { status: 400 }
    )
  }

  const typedRecords = records as AgencyGuidelineRow[]

  // Safety: confirm all share agency + product_family + normalized program name
  const firstAgency = typedRecords[0].agency
  const firstFamily = typedRecords[0].product_family
  const firstNormalized = normalizeProgramName(typedRecords[0].program_name)

  for (const r of typedRecords) {
    if (
      r.agency !== firstAgency ||
      r.product_family !== firstFamily ||
      normalizeProgramName(r.program_name) !== firstNormalized
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Records do not share the same agency, product family, and program name. Cannot merge.`,
        },
        { status: 400 }
      )
    }
  }

  // Pick base: highest confidence, tiebreak by most recent created_at
  const base = [...typedRecords].sort((a, b) => {
    const confDiff = getConfidenceScore(b) - getConfidenceScore(a)
    if (confDiff !== 0) return confDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0]

  const others = typedRecords.filter((r) => r.id !== base.id)

  // Merge logic
  const allRecords = typedRecords

  // min_credit: lowest non-null
  let mergedMinCredit: number | null = null
  for (const r of allRecords) {
    if (r.min_credit != null) {
      if (mergedMinCredit == null || r.min_credit < mergedMinCredit) {
        mergedMinCredit = r.min_credit
      }
    }
  }

  // max_ltv: highest non-null
  let mergedMaxLtv: number | null = null
  for (const r of allRecords) {
    if (r.max_ltv != null) {
      if (mergedMaxLtv == null || r.max_ltv > mergedMaxLtv) {
        mergedMaxLtv = r.max_ltv
      }
    }
  }

  // max_dti: highest non-null
  let mergedMaxDti: number | null = null
  for (const r of allRecords) {
    if (r.max_dti != null) {
      if (mergedMaxDti == null || r.max_dti > mergedMaxDti) {
        mergedMaxDti = r.max_dti
      }
    }
  }

  // max_units: highest non-null
  let mergedMaxUnits: number | null = null
  for (const r of allRecords) {
    if (r.max_units != null) {
      if (mergedMaxUnits == null || r.max_units > mergedMaxUnits) {
        mergedMaxUnits = r.max_units
      }
    }
  }

  // occupancy: union of arrays
  const occupancySet = new Set<string>()
  for (const r of allRecords) {
    if (Array.isArray(r.occupancy)) {
      for (const occ of r.occupancy) occupancySet.add(occ)
    }
  }
  const mergedOccupancy =
    occupancySet.size > 0 ? Array.from(occupancySet).sort() : null

  // income_types: union of arrays
  const incomeSet = new Set<string>()
  for (const r of allRecords) {
    if (Array.isArray(r.income_types)) {
      for (const inc of r.income_types) incomeSet.add(inc)
    }
  }
  const mergedIncomeTypes =
    incomeSet.size > 0 ? Array.from(incomeSet).sort() : null

  // notes: concatenated with dividers
  const noteSegments: string[] = []
  for (const r of allRecords) {
    if (r.notes && r.notes.trim().length > 0) {
      const sourceLabel = r.source_name || 'unknown source'
      noteSegments.push(`[from ${sourceLabel}]\n${r.notes.trim()}`)
    }
  }
  const mergedNotes =
    noteSegments.length > 0 ? noteSegments.join('\n\n---\n\n') : null

  // effective_date: latest non-null
  let mergedEffectiveDate: string | null = null
  for (const r of allRecords) {
    if (r.effective_date) {
      if (
        !mergedEffectiveDate ||
        r.effective_date > mergedEffectiveDate
      ) {
        mergedEffectiveDate = r.effective_date
      }
    }
  }

  // source_name: comma-separated unique
  const sourceSet = new Set<string>()
  for (const r of allRecords) {
    if (r.source_name) sourceSet.add(r.source_name)
  }
  const mergedSourceName =
    sourceSet.size > 0 ? Array.from(sourceSet).join(', ') : null

  // extraction_metadata: keep base's, add merge audit
  const mergedMetadata = {
    ...(base.extraction_metadata || {}),
    mergedFrom: allRecords.map((r) => ({
      id: r.id,
      source_name: r.source_name,
      created_at: r.created_at,
      confidence: (r.extraction_metadata as { confidence?: string })
        ?.confidence,
    })),
    mergedAt: new Date().toISOString(),
  }

  // Update base record
  const { error: updateError } = await supabaseAdmin
    .from('global_guidelines')
    .update({
      min_credit: mergedMinCredit,
      max_ltv: mergedMaxLtv,
      max_dti: mergedMaxDti,
      max_units: mergedMaxUnits,
      occupancy: mergedOccupancy || [],
      income_types: mergedIncomeTypes || [],
      notes: mergedNotes,
      source_name: mergedSourceName,
      effective_date: mergedEffectiveDate,
      extraction_metadata: mergedMetadata,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', base.id)

  if (updateError) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update base record: ${updateError.message}`,
      },
      { status: 500 }
    )
  }

  // Handle other records
  const draftIdsToDelete = others
    .filter((r) => !r.is_active)
    .map((r) => r.id)
  const activeIdsToDeactivate = others
    .filter((r) => r.is_active)
    .map((r) => r.id)

  if (draftIdsToDelete.length > 0) {
    await supabaseAdmin
      .from('global_guidelines')
      .delete()
      .in('id', draftIdsToDelete)
  }

  if (activeIdsToDeactivate.length > 0) {
    await supabaseAdmin
      .from('global_guidelines')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', activeIdsToDeactivate)
  }

  return NextResponse.json({
    success: true,
    mergedRecordId: base.id,
    mergedFrom: allRecords.length,
    deletedDrafts: draftIdsToDelete.length,
    deactivatedActive: activeIdsToDeactivate.length,
  })
}
