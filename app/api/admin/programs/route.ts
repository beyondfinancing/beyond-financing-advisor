// =============================================================================
// COMPLETE REPLACEMENT for app/api/admin/programs/route.ts
//
// Replaces what you currently have entirely. Drop-in.
//
// What this file provides:
//   GET  -> Returns active programs as JSON (same behavior you had before)
//   POST -> Handles form submissions with action=create | update | delete
//           Reads form-data, writes to programs table, redirects back to
//           /admin/programs with ?success or ?error query strings
//
// Why the POST handler matters:
//   The existing /admin/programs page submits standard HTML forms with hidden
//   action= fields. Phase 7.2's "Approve & Activate" button does the same.
//   Without a POST handler, none of these have ever actually worked.
//
// Important details:
//   - Uses supabaseAdmin (service role) for writes — admin pages only.
//   - Auth-protected by isAdminSignedIn() — same gate as your admin pages.
//   - On Approve & Activate, also flips is_active=true on the matching
//     program_guidelines row (best-effort, doesn't fail the request).
//   - Returns redirects so the browser navigates back cleanly.
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

// =============================================================================
// Phase 7.2 — AUS / underwriting method validation
// =============================================================================
const ALLOWED_UNDERWRITING_METHODS = ['either', 'du', 'lpa', 'manual', 'lender_box'] as const
type UnderwritingMethod = (typeof ALLOWED_UNDERWRITING_METHODS)[number]

function normalizeUnderwritingMethod(
  value: FormDataEntryValue | null
): UnderwritingMethod {
  if (value === null || value === undefined) return 'either'
  const trimmed = String(value).trim().toLowerCase()
  if ((ALLOWED_UNDERWRITING_METHODS as readonly string[]).includes(trimmed)) {
    return trimmed as UnderwritingMethod
  }
  return 'either'
}

// =============================================================================
// GET — list programs (unchanged behavior)
// =============================================================================
export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('programs')
      .select('id, lender_id, name, slug, loan_category, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to load programs.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      programs: Array.isArray(data) ? data : [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Server error.',
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST — handle create / update / delete from /admin/programs forms
// =============================================================================
export async function POST(req: Request) {
  // 1. Auth gate.
  if (!(await isAdminSignedIn())) {
    return redirectWithError('Not signed in as admin.')
  }

  // 2. Parse form data (the page submits classic HTML forms, not JSON).
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return redirectWithError('Invalid form submission.')
  }

  const action = String(formData.get('action') || '').trim()

  if (action === 'create') {
    return handleCreate(formData)
  }
  if (action === 'update') {
    return handleUpdate(formData)
  }
  if (action === 'delete') {
    return handleDelete(formData)
  }

  return redirectWithError(`Unknown action: ${action || 'none'}`)
}

// =============================================================================
// Handlers
// =============================================================================
async function handleCreate(formData: FormData) {
  const lenderId = String(formData.get('lender_id') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const minCredit = parseNumberOrNull(formData.get('min_credit'))
  const maxLtv = parseNumberOrNull(formData.get('max_ltv'))
  const maxDti = parseNumberOrNull(formData.get('max_dti'))
  const occupancy = String(formData.get('occupancy') || '').trim() || null
  const notes = String(formData.get('notes') || '').trim() || null
  const underwritingMethod = normalizeUnderwritingMethod(
    formData.get('underwriting_method')
  )

  if (!lenderId || !name) {
    return redirectWithError('Lender and Program Name are required.')
  }

  const { error } = await supabaseAdmin.from('programs').insert({
    lender_id: lenderId,
    name,
    min_credit: minCredit,
    max_ltv: maxLtv,
    max_dti: maxDti,
    occupancy,
    notes,
    underwriting_method: underwritingMethod,
    is_active: true,
    source: 'manual',
  })

  if (error) {
    return redirectWithError(`Create failed: ${error.message}`)
  }

  return redirectWithSuccess('Program created.')
}

async function handleUpdate(formData: FormData) {
  const id = String(formData.get('id') || '').trim()
  if (!id) return redirectWithError('Missing program id for update.')

  const lenderId = String(formData.get('lender_id') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const minCredit = parseNumberOrNull(formData.get('min_credit'))
  const maxLtv = parseNumberOrNull(formData.get('max_ltv'))
  const maxDti = parseNumberOrNull(formData.get('max_dti'))
  const occupancy = String(formData.get('occupancy') || '').trim() || null
  const notes = String(formData.get('notes') || '').trim() || null
  const underwritingMethod = normalizeUnderwritingMethod(
    formData.get('underwriting_method')
  )

  if (!lenderId || !name) {
    return redirectWithError('Lender and Program Name are required.')
  }

  const updatePayload: Record<string, unknown> = {
    lender_id: lenderId,
    name,
    min_credit: minCredit,
    max_ltv: maxLtv,
    max_dti: maxDti,
    occupancy,
    notes,
    underwriting_method: underwritingMethod,
  }

  // Phase 7.2 hook: Approve & Activate posts is_active=true so drafts go live.
  // Save Changes (regular edit) doesn't post is_active at all, so we leave it
  // alone — the program keeps whatever is_active state it already had.
  const isActiveRaw = formData.get('is_active')
  let approvedDraft = false

  if (isActiveRaw !== null) {
    const isActive = String(isActiveRaw).toLowerCase() === 'true'
    updatePayload.is_active = isActive
    approvedDraft = isActive
  }

  const { error } = await supabaseAdmin
    .from('programs')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    return redirectWithError(`Update failed: ${error.message}`)
  }

  // If we just activated a draft, also flip its program_guidelines row
  // to is_active=true. Best-effort — log but don't fail the user-facing request.
  if (approvedDraft) {
    const { error: guidelineError } = await supabaseAdmin
      .from('program_guidelines')
      .update({ is_active: true })
      .eq('program_id', id)

    if (guidelineError) {
      console.warn(
        `[programs] Activated program ${id} but guideline activation failed:`,
        guidelineError.message
      )
      // Continue — the program itself is active.
    }
  }

  return redirectWithSuccess(
    approvedDraft ? 'Program approved and activated.' : 'Program updated.'
  )
}

async function handleDelete(formData: FormData) {
  const id = String(formData.get('id') || '').trim()
  if (!id) return redirectWithError('Missing program id for delete.')

  // Best-effort guideline cleanup before program delete.
  // If you have ON DELETE CASCADE on the FK, this is harmless redundancy.
  // If you don't, this prevents FK violations.
  const { error: guidelineDeleteError } = await supabaseAdmin
    .from('program_guidelines')
    .delete()
    .eq('program_id', id)

  if (guidelineDeleteError) {
    console.warn(
      `[programs] Pre-delete guideline cleanup failed for program ${id}:`,
      guidelineDeleteError.message
    )
    // Continue — the program delete may still succeed if FK cascades.
  }

  const { error } = await supabaseAdmin
    .from('programs')
    .delete()
    .eq('id', id)

  if (error) {
    return redirectWithError(`Delete failed: ${error.message}`)
  }

  return redirectWithSuccess('Program deleted.')
}

// =============================================================================
// Helpers
// =============================================================================
function parseNumberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function redirectWithSuccess(message: string) {
  const url = new URL(
    `/admin/programs?success=${encodeURIComponent(message)}`,
    getBaseUrl()
  )
  return NextResponse.redirect(url, { status: 303 })
}

function redirectWithError(message: string) {
  const url = new URL(
    `/admin/programs?error=${encodeURIComponent(message)}`,
    getBaseUrl()
  )
  return NextResponse.redirect(url, { status: 303 })
}

function getBaseUrl(): string {
  // Vercel sets VERCEL_URL on production; fall back to the canonical domain.
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://beyondintelligence.io'
}
