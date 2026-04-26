// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     lib/team-guards.ts
//
// =============================================================================
//
// Request-level authorization helpers shared by /api/team/* route handlers.
//
// Composes lib/team-auth's signed-cookie session with a live employees-row
// check, so role/active-status changes after cookie issuance still
// invalidate the session.
//
// Usage:
//
//   const guard = await requireTeamUser(req, { allowedRoles: ['Loan Officer'] })
//   if (!guard.ok) return guard.response
//   const viewer = guard.viewer
//
// Note on Phase 5.2 inbox route: that route was shipped with the same
// auth pattern inlined. It still works as written. To DRY it, swap its
// auth block for `requireTeamUser(req, { allowedRoles: ['Loan Officer'] })`
// in a follow-up commit — purely cosmetic, no behavior change.
//
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionFromRequest } from '@/lib/team-auth'

export type TeamViewer = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_active: boolean
}

export type RequireTeamUserResult =
  | { ok: true; viewer: TeamViewer }
  | { ok: false; response: NextResponse }

export type RequireTeamUserOptions = {
  allowedRoles?: string[]
}

export async function requireTeamUser(
  req: NextRequest,
  options?: RequireTeamUserOptions
): Promise<RequireTeamUserResult> {
  const session = getSessionFromRequest(req)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Not authenticated.' },
        { status: 401 }
      ),
    }
  }

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, email, role, is_active')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) {
    console.error('requireTeamUser: viewer lookup failed.', error)
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Failed to verify session.' },
        { status: 500 }
      ),
    }
  }

  if (!data || !data.is_active) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Session no longer valid.' },
        { status: 401 }
      ),
    }
  }

  const viewer = data as TeamViewer

  if (
    options?.allowedRoles &&
    options.allowedRoles.length > 0 &&
    !options.allowedRoles.includes(viewer.role)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Access restricted for role: ${viewer.role}.`,
          role: viewer.role,
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true, viewer }
}
