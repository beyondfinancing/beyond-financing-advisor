// =============================================================================
// PHASE 7.5 — NEW FILE: app/api/admin/agency-guidelines/route.ts
//
// Backing API for the /admin/agency-guidelines page.
//
// GET    → list all global_guidelines (admin sees both active and drafts)
// PATCH  → update is_active or other fields (used for "Approve & Activate")
// DELETE → delete by id (used for "Reject Draft")
//
// Auth: admin only (mirrors the rest of /api/admin).
// =============================================================================

import { NextResponse } from 'next/server'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('global_guidelines')
    .select(
      'id, agency, product_family, program_name, document_type, occupancy, income_types, min_credit, max_ltv, max_dti, max_units, notes, source_name, effective_date, is_active, created_at, source, extraction_metadata'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, guidelines: data || [] })
}

export async function PATCH(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  let body: {
    id?: string
    is_active?: boolean
    program_name?: string
    min_credit?: number | null
    max_ltv?: number | null
    max_dti?: number | null
    max_units?: number | null
    occupancy?: string[] | null
    income_types?: string[] | null
    notes?: string | null
    effective_date?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const id = String(body?.id || '').trim()
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required.' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if (typeof body.program_name === 'string')
    updates.program_name = body.program_name
  if (body.min_credit !== undefined) updates.min_credit = body.min_credit
  if (body.max_ltv !== undefined) updates.max_ltv = body.max_ltv
  if (body.max_dti !== undefined) updates.max_dti = body.max_dti
  if (body.max_units !== undefined) updates.max_units = body.max_units
  if (body.occupancy !== undefined) updates.occupancy = body.occupancy || []
  if (body.income_types !== undefined)
    updates.income_types = body.income_types || []
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.effective_date !== undefined)
    updates.effective_date = body.effective_date

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No fields to update.' },
      { status: 400 }
    )
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('global_guidelines')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  const url = new URL(req.url)
  const id = String(url.searchParams.get('id') || '').trim()

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id query param is required.' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('global_guidelines')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

