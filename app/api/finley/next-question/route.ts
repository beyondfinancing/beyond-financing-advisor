// =============================================================================
// app/api/finley/next-question/route.ts
// =============================================================================
//
// F3.7-FINLEY Phase 3b — Discovery question funnel
//
// Returns the next unanswered gating question for a given scenario, based on
// the global finley_question_bank ordered by ask_order, joined against the
// tenant-scoped scenario_qualifying_answers table.
//
// Auth: bf_team_session cookie required. tenant_id is read from the session.
//
// Endpoint: GET /api/finley/next-question?scenario_id=<uuid>
//
// Responses:
//   200 { status: "in_progress", next_question: { ... }, answered: [...] }
//   200 { status: "complete",    next_question: null,    answered: [...] }
//   200 { status: "no_questions_configured", ... }
//   400 { error: "scenario_id query param is required" }
//   401 { error: "unauthenticated" | "invalid_session" }
//   500 { error: <db error message> }
// =============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/team-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // ---- Auth ----
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("bf_team_session")?.value;
  if (!sessionToken) {
    return NextResponse.json(
      { success: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const session = verifySessionToken(sessionToken);
  if (!session || !session.tenantId) {
    return NextResponse.json(
      { success: false, error: "invalid_session" },
      { status: 401 }
    );
  }
  const tenantId = session.tenantId;

  // ---- Input ----
  const url = new URL(req.url);
  const scenarioId = url.searchParams.get("scenario_id");
  if (!scenarioId) {
    return NextResponse.json(
      { success: false, error: "scenario_id query param is required" },
      { status: 400 }
    );
  }

  // ---- Read question bank (active, ordered) ----
  const { data: bank, error: bankErr } = await supabaseAdmin
    .from("finley_question_bank")
    .select("question_key, prompt_text, answer_schema, ask_order")
    .eq("active", true)
    .order("ask_order", { ascending: true });
  if (bankErr) {
    return NextResponse.json(
      { success: false, error: bankErr.message },
      { status: 500 }
    );
  }

  const totalQuestions = bank?.length ?? 0;

  // ---- Defensive: empty bank ----
  if (totalQuestions === 0) {
    return NextResponse.json({
      success: true,
      status: "no_questions_configured",
      scenario_id: scenarioId,
      total_questions: 0,
      answered_count: 0,
      remaining_count: 0,
      next_question: null,
      answered: [],
    });
  }

  // ---- Read tenant-scoped answers for this scenario ----
  const { data: answers, error: ansErr } = await supabaseAdmin
    .from("scenario_qualifying_answers")
    .select("question_key, answer_value, answered_at, answered_by_role")
    .eq("tenant_id", tenantId)
    .eq("scenario_id", scenarioId);
  if (ansErr) {
    return NextResponse.json(
      { success: false, error: ansErr.message },
      { status: 500 }
    );
  }

  const answeredKeys = new Set((answers ?? []).map((a) => a.question_key));
  const answeredCount = answers?.length ?? 0;
  const nextQ = bank!.find((q) => !answeredKeys.has(q.question_key)) ?? null;

  return NextResponse.json({
    success: true,
    status: nextQ ? "in_progress" : "complete",
    scenario_id: scenarioId,
    total_questions: totalQuestions,
    answered_count: answeredCount,
    remaining_count: totalQuestions - answeredCount,
    next_question: nextQ
      ? {
          question_key: nextQ.question_key,
          prompt_text: nextQ.prompt_text,
          answer_schema: nextQ.answer_schema,
          ask_order: nextQ.ask_order,
        }
      : null,
    answered: answers ?? [],
  });
}
