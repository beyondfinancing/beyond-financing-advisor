// app/api/handoff-session/[id]/persist-match/route.ts
//
// Step 5 Drop B (Component 1) — persist matcher response.
// F3.3 (4/6) — TENANT SCOPING (this revision)
//
// Persists a matcher response to borrower_intake_sessions.match_results so
// Pro Mode can reason about scored matches on subsequent /api/handoff-chat
// turns.
//
// Request shape:
//   POST /api/handoff-session/<intakeSessionId>/persist-match
//   Body: the full /api/match response object (success, strong_matches,
//         conditional_matches, eliminated_paths, top_recommendation,
//         lender_summary, summary, ...)
//
// Auth: same pattern as the sibling GET /api/handoff-session/[id]:
//   - bf_team_session cookie required
//   - team_users row must be active
//   - role must be in PROFESSIONAL_ROLES
//
// Tenant scoping (F3.3):
//   - viewer.tenant_id comes from employees by email (canonical join key
//     under Phase 5-prep-C dual-write).
//   - Both the existence check and the UPDATE are scoped to viewer's
//     tenant. Cross-tenant: 404 (do not leak that the row exists).
//
// Behavior:
//   1. Auth gate.
//   2. Resolve viewer.tenant_id via employees by email.
//   3. Validate the [id] param is a UUID.
//   4. Validate the body has the expected matcher shape (lightweight check —
//      we trust /api/match's output, but defend against a hand-crafted POST
//      that would corrupt the column with junk).
//   5. Confirm intake session exists in viewer's tenant.
//   6. UPDATE borrower_intake_sessions.match_results = <body>, scoped to
//      viewer's tenant for defense in depth.
//   7. Return { success: true, persistedAt }.
//
// Failure modes (return non-2xx):
//   - 401 if no session
//   - 403 if account inactive, wrong role, or no tenant configured
//   - 400 if [id] isn't a UUID or body shape is invalid
//   - 404 if intake session not found OR belongs to a different tenant
//   - 500 if the UPDATE itself errors
//
// The /finley page calls this fire-and-forget — it doesn't surface failures
// to the user. The matcher already returned success and the UI is rendered.
// Persistence failure here is server-side logged only.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { isUuid } from "@/lib/handoff";
import { verifySessionToken } from "@/lib/team-auth";

const SESSION_COOKIE = "bf_team_session";

const PROFESSIONAL_ROLES = new Set([
  "Loan Officer",
  "Loan Officer Assistant",
  "Branch Manager",
  "Production Manager",
  "Processor",
]);

// Lightweight body shape check. We don't deeply validate every MatchBucket
// field — trust /api/match. This guards against an empty body or a hand-
// crafted POST that would write garbage to the column.
function looksLikeMatcherResponse(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.success !== true) return false;
  if (!Array.isArray(b.strong_matches)) return false;
  if (!Array.isArray(b.conditional_matches)) return false;
  if (!Array.isArray(b.eliminated_paths)) return false;
  return true;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // -------------------------------------------------------------------------
  // 1. Auth gate (team_users)
  // -------------------------------------------------------------------------
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { data: teamUser, error: teamUserError } = await supabaseAdmin
    .from("team_users")
    .select("id, role, is_active, email")
    .eq("id", session.userId)
    .maybeSingle();

  if (teamUserError || !teamUser || !teamUser.is_active) {
    return NextResponse.json(
      { error: "Account not active." },
      { status: 403 }
    );
  }
  if (!PROFESSIONAL_ROLES.has(teamUser.role as string)) {
    return NextResponse.json(
      { error: "Persistence is for licensed mortgage professionals." },
      { status: 403 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. F3.3: Resolve viewer's tenant_id via employees lookup by EMAIL.
  // -------------------------------------------------------------------------
  const viewerEmail = (teamUser as { email?: string | null }).email;
  if (!viewerEmail) {
    console.error(
      "[persist-match] team_users row has no email — cannot resolve tenant.",
      { teamUserId: teamUser.id }
    );
    return NextResponse.json(
      { error: "Tenant is not configured for this account." },
      { status: 403 }
    );
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("tenant_id")
    .eq("email", viewerEmail)
    .maybeSingle();

  if (employeeError) {
    console.error("[persist-match] employees lookup failed.", employeeError);
    return NextResponse.json(
      { error: "Failed to verify session." },
      { status: 500 }
    );
  }

  if (!employee || !employee.tenant_id) {
    console.warn(
      "[persist-match] employees row missing or has no tenant_id.",
      { teamUserId: teamUser.id, viewerEmail }
    );
    return NextResponse.json(
      { error: "Tenant is not configured for this account." },
      { status: 403 }
    );
  }

  const viewerTenantId = employee.tenant_id as string;

  // -------------------------------------------------------------------------
  // 3. Validate [id] param
  // -------------------------------------------------------------------------
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Invalid intake session id." },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 4. Parse + validate body
  // -------------------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!looksLikeMatcherResponse(body)) {
    return NextResponse.json(
      { error: "Body does not look like a matcher response." },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 5. Confirm the intake session exists in viewer's tenant before writing.
  //    Cross-tenant access returns 404 (not 403) to avoid leaking row
  //    existence in another tenant.
  // -------------------------------------------------------------------------
  const { data: intakeRow, error: intakeError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", viewerTenantId)
    .maybeSingle();

  if (intakeError || !intakeRow) {
    return NextResponse.json(
      { error: "Intake session not found." },
      { status: 404 }
    );
  }

  // -------------------------------------------------------------------------
  // 6. Persist the matcher response onto the intake row.
  //    JSONB column accepts the body as-is.
  //    Tenant filter on the UPDATE for defense in depth — even if step 5
  //    somehow let a cross-tenant row through, the UPDATE writes zero rows.
  // -------------------------------------------------------------------------
  const persistedAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .update({
      match_results: body,
      updated_at: persistedAt,
    })
    .eq("id", id)
    .eq("tenant_id", viewerTenantId);

  if (updateError) {
    console.error("[persist-match] update failed", {
      intakeId: id,
      teamUserId: session.userId,
      tenantId: viewerTenantId,
      error: updateError.message,
    });
    return NextResponse.json(
      { error: "Could not persist match results." },
      { status: 500 }
    );
  }

  // Lightweight observability — counts only, no PII content.
  const b = body as {
    strong_matches: unknown[];
    conditional_matches: unknown[];
    eliminated_paths: unknown[];
    summary?: { strong_count?: number };
  };
  console.log("[persist-match] persisted", {
    intakeId: id,
    teamUserId: session.userId,
    tenantId: viewerTenantId,
    strongCount: b.strong_matches.length,
    conditionalCount: b.conditional_matches.length,
    eliminatedCount: b.eliminated_paths.length,
  });

  return NextResponse.json({
    success: true,
    persistedAt,
  });
}
