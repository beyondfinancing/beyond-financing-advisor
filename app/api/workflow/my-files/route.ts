// app/api/workflow/my-files/route.ts
//
// Step 6 Phase 6.2a — NEW endpoint.
//
// Returns the workflow files where the calling team user is the assigned
// Loan Officer (workflow_files.loan_officer_id = caller's UUID). Used by
// the /finley page to populate the "Save Summary to Workflow File"
// dropdown introduced in Phase 6.2b.
//
// Request:
//   GET /api/workflow/my-files
//
// Auth (matches sibling handoff-session and save-to-workflow routes):
//   - bf_team_session cookie required
//   - team_users row must be active
//   - role must be in PROFESSIONAL_ROLES
//
// Behavior:
//   1. Auth gate
//   2. SELECT id, file_number, borrower_name, status, last_activity_at,
//      created_at FROM workflow_files WHERE loan_officer_id = caller
//      ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
//      LIMIT 50
//   3. Return { success, files }
//
// Notes:
//   - Returns ALL statuses including 'closed' (per locked Step 6 decision —
//     an LO may want to attach a Pro Mode summary to a recently closed file
//     for institutional memory).
//   - LO-only filter — does NOT include files where caller is the assigned
//     processor. Per locked decision Linking C-2.
//   - When the LO has zero assigned files, returns { success: true,
//     files: [] }. The /finley page hides the "Save Summary to Workflow
//     File" button in that case.
//
// Failure modes:
//   - 401 no/invalid session
//   - 403 inactive or wrong role
//   - 500 DB error

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { verifySessionToken } from "@/lib/team-auth";

const SESSION_COOKIE = "bf_team_session";

const PROFESSIONAL_ROLES = new Set([
  "Loan Officer",
  "Loan Officer Assistant",
  "Branch Manager",
  "Production Manager",
  "Processor",
]);

const MAX_FILES = 50;

type WorkflowFileSummary = {
  id: string;
  file_number: string | null;
  borrower_name: string | null;
  status: string | null;
  last_activity_at: string | null;
  created_at: string | null;
};

export async function GET() {
  // ---------------------------------------------------------------------------
  // 1. Auth
  // ---------------------------------------------------------------------------
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
  const callerRole = String(teamUser.role ?? "");
  if (!PROFESSIONAL_ROLES.has(callerRole)) {
    return NextResponse.json(
      { error: "This action is for licensed mortgage professionals." },
      { status: 403 }
    );
  }

  // ---------------------------------------------------------------------------
  // 2. SELECT workflow files where caller is the assigned LO
  // ---------------------------------------------------------------------------
  const { data, error } = await supabaseAdmin
    .from("workflow_files")
    .select(
      "id, file_number, borrower_name, status, last_activity_at, created_at"
    )
    .eq("loan_officer_id", session.userId)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_FILES);

  if (error) {
    console.error("[my-files] select failed", {
      teamUserId: session.userId,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Could not load your workflow files." },
      { status: 500 }
    );
  }

  const files = (data ?? []) as unknown as WorkflowFileSummary[];

  return NextResponse.json({
    success: true,
    files,
  });
}
