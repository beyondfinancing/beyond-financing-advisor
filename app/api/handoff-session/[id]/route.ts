// app/api/handoff-session/[id]/route.ts
//
// Step 4 (Drop 1) of the Professional Handoff workstream.
// GET endpoint that hydrates /finley with a borrower's intake session.
//
// Flow:
//   1. Auth-gate: verify bf_team_session cookie, look up team_users row,
//      check is_active and role in PROFESSIONAL_ROLES (Real Estate Agents
//      explicitly excluded — same allow-list as /finley page).
//   2. Validate the [id] route param is a UUID.
//   3. Load the borrower_intake_sessions row. 404 if not found.
//   4. UPSERT a professional_chat_sessions row keyed on the unique
//      constraint (intake_session_id, team_user_id) — so each LO/LOA gets
//      their own thread that resumes across visits.
//   5. Return: { session: {...}, transcript: [...], extractedPayload, proSession }
//
// Security: service-role client (bypasses RLS). The route's own auth check
// is what gates access. Real Estate Agents who somehow get an intake URL
// will hit 403 here even if they're logged in.

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

type IntakeSessionRow = {
  id: string;
  status: string;
  language: string;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_email: string | null;
  borrower_phone: string | null;
  borrower_state: string | null;
  has_realtor: boolean;
  realtor_name: string | null;
  realtor_email: string | null;
  realtor_phone: string | null;
  loan_officer_id: string | null;
  lo_assistant_id: string | null;
  messages: unknown;
  extracted_payload: unknown;
  match_results: unknown;
  created_at: string;
  updated_at: string;
};

type ProSessionRow = {
  id: string;
  intake_session_id: string;
  team_user_id: string;
  language: string;
  messages: unknown;
  created_at: string;
  updated_at: string;
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // -------------------------------------------------------------------------
  // 1. Auth gate
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
    .select("id, role, is_active, preferred_language")
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
      { error: "This view is for licensed mortgage professionals." },
      { status: 403 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Validate the id param
  // -------------------------------------------------------------------------
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Invalid session id." },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 3. Load the intake session
  // -------------------------------------------------------------------------
  const { data: intakeRow, error: intakeError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .select(
      "id, status, language, borrower_first_name, borrower_last_name, " +
        "borrower_email, borrower_phone, borrower_state, has_realtor, " +
        "realtor_name, realtor_email, realtor_phone, loan_officer_id, " +
        "lo_assistant_id, messages, extracted_payload, match_results, " +
        "created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (intakeError || !intakeRow) {
    return NextResponse.json(
      { error: "Intake session not found." },
      { status: 404 }
    );
  }

  const intake = intakeRow as IntakeSessionRow;

  // -------------------------------------------------------------------------
  // 4. UPSERT pro chat session for (intake_session_id, team_user_id)
  //    Default language pulls from team_users.preferred_language; falls
  //    back to intake language if team has none set.
  // -------------------------------------------------------------------------
  const proLanguage =
    (teamUser as { preferred_language?: string | null }).preferred_language ||
    intake.language ||
    "en";

  const { data: proRow, error: proError } = await supabaseAdmin
    .from("professional_chat_sessions")
    .upsert(
      {
        intake_session_id: intake.id,
        team_user_id: session.userId,
        language: proLanguage,
      },
      {
        onConflict: "intake_session_id,team_user_id",
        // Don't overwrite messages or language on subsequent visits — only
        // create if missing. ignoreDuplicates=true means UPSERT becomes
        // INSERT-OR-NOTHING. We then SELECT the actual row (existing or
        // newly created) below.
        ignoreDuplicates: true,
      }
    )
    .select("id, intake_session_id, team_user_id, language, messages, created_at, updated_at")
    .maybeSingle();

  let proSession = (proRow as ProSessionRow | null) ?? null;

  // ignoreDuplicates means an existing row returns null. Look it up.
  if (!proSession) {
    if (proError) {
      console.error("[handoff-session] upsert errored", proError);
    }
    const { data: existingRow, error: lookupError } = await supabaseAdmin
      .from("professional_chat_sessions")
      .select(
        "id, intake_session_id, team_user_id, language, messages, created_at, updated_at"
      )
      .eq("intake_session_id", intake.id)
      .eq("team_user_id", session.userId)
      .maybeSingle();

    if (lookupError || !existingRow) {
      console.error("[handoff-session] pro session lookup failed", lookupError);
      return NextResponse.json(
        { error: "Could not load or create professional chat session." },
        { status: 500 }
      );
    }
    proSession = existingRow as ProSessionRow;
  }

  // -------------------------------------------------------------------------
  // 5. Return everything /finley needs to hydrate
  // -------------------------------------------------------------------------
  return NextResponse.json({
    session: {
      id: intake.id,
      status: intake.status,
      language: intake.language,
      borrowerName: [intake.borrower_first_name, intake.borrower_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
      borrowerEmail: intake.borrower_email,
      borrowerPhone: intake.borrower_phone,
      borrowerState: intake.borrower_state,
      hasRealtor: intake.has_realtor,
      realtorName: intake.realtor_name,
      realtorEmail: intake.realtor_email,
      realtorPhone: intake.realtor_phone,
      loanOfficerId: intake.loan_officer_id,
      loAssistantId: intake.lo_assistant_id,
      createdAt: intake.created_at,
      updatedAt: intake.updated_at,
    },
    transcript: Array.isArray(intake.messages) ? intake.messages : [],
    extractedPayload: intake.extracted_payload ?? {},
    matchResults: intake.match_results ?? null,
    proSession: {
      id: proSession.id,
      language: proSession.language,
      messages: Array.isArray(proSession.messages) ? proSession.messages : [],
      createdAt: proSession.created_at,
      updatedAt: proSession.updated_at,
    },
  });
}
