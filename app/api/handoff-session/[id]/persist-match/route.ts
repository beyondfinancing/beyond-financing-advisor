// app/api/handoff-session/[id]/persist-match/route.ts
//
// Step 5 Drop B (Component 1) — NEW endpoint.
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
// Behavior:
//   1. Validate the [id] param is a UUID and the session exists.
//   2. Validate the body has the expected matcher shape (lightweight check —
//      we trust /api/match's output, but defend against a hand-crafted POST
//      that would corrupt the column with junk).
//   3. UPDATE borrower_intake_sessions.match_results = <body>.
//   4. Return { success: true, persistedAt }.
//
// Failure modes (return non-2xx):
//   - 401 if no session
//   - 403 if account inactive or wrong role
//   - 400 if [id] isn't a UUID or body shape is invalid
//   - 404 if intake session not found
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
  // 1. Auth gate — identical to /api/handoff-session/[id] GET
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
    .select("id, role, is_active")
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
  // 2. Validate [id] param
  // -------------------------------------------------------------------------
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Invalid intake session id." },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 3. Parse + validate body
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
  // 4. Confirm the intake session exists before writing
  // -------------------------------------------------------------------------
  const { data: intakeRow, error: intakeError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (intakeError || !intakeRow) {
    return NextResponse.json(
      { error: "Intake session not found." },
      { status: 404 }
    );
  }

  // -------------------------------------------------------------------------
  // 5. Persist the matcher response onto the intake row.
  //    JSONB column accepts the body as-is.
  // -------------------------------------------------------------------------
  const persistedAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .update({
      match_results: body,
      updated_at: persistedAt,
    })
    .eq("id", id);

  if (updateError) {
    console.error("[persist-match] update failed", {
      intakeId: id,
      teamUserId: session.userId,
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
    strongCount: b.strong_matches.length,
    conditionalCount: b.conditional_matches.length,
    eliminatedCount: b.eliminated_paths.length,
  });

  return NextResponse.json({
    success: true,
    persistedAt,
  });
}
