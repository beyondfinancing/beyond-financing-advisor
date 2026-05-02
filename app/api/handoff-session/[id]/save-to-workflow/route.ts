// app/api/handoff-session/[id]/save-to-workflow/route.ts
//
// Step 6 Phase 6.1 (Polish v1) — Pro Mode summary endpoint.
// F3.3 (5/6) — TENANT SCOPING (this revision)
//
// =============================================================================
// CHANGES IN F3.3 (5/6) — TENANT SCOPING
// =============================================================================
//
// - Resolve viewer.tenant_id via employees lookup by email.
// - Tenant-scope all four reads: workflow_files, borrower_intake_sessions,
//   and both branches of professional_chat_sessions.
// - Set tenant_id explicitly on workflow_feed INSERT for F3.7-safety.
// - workflow_files.loan_officer_id verified to reference team_users.id
//   (SQL probe). Existing ownership check (loan_officer_id === session.userId)
//   stays unchanged.
// - Cross-tenant access on any read returns 404. The route can never reach
//   the INSERT step with a workflow_file or intake from another tenant.
//
// =============================================================================
// PRIOR CHANGES IN POLISH V1 (preserved)
// =============================================================================
//
// Hybrid template: deterministic data is now assembled by CODE; the AI
// produces ONLY the prose-judgment bullets (Key Pro Chat Takeaways and
// Recommended Next Action).
//
// Why: the prior all-AI version was observed having gpt-4o-mini hallucinate
// numeric counts and the top-recommendation string even when given exact
// values in the context. These outputs become permanent file records —
// factual fidelity matters.
//
// The AI now returns JSON ({ takeaways[], next_action }) via OpenAI's
// response_format=json_object. The route handler assembles the final
// summary text from that JSON plus the structured ScenarioFields and
// MatchSummary produced by code-side helpers. Counts, top recommendation,
// and field labels can never drift.
//
// =============================================================================
//
// Request:
//   POST /api/handoff-session/<intakeSessionId>/save-to-workflow
//   Body: {
//     targetWorkflowFileId: string,   // UUID, REQUIRED
//     proSessionId?: string           // optional UUID
//   }
//
// Auth (matches sibling handoff-session/[id] routes):
//   - bf_team_session cookie required
//   - team_users row must be active
//   - role must be in PROFESSIONAL_ROLES
//
// Access control:
//   - Calling user MUST be workflow_files.loan_officer_id on the target.
//   - Target workflow_file MUST belong to caller's tenant.
//
// Failure modes:
//   - 401 no/invalid session
//   - 403 inactive, wrong role, no tenant configured, not the assigned LO,
//         or pro session belongs to different caller
//   - 400 invalid [id] / body / pro session belongs to different intake
//   - 404 intake session, target workflow file, or explicit pro session
//         not found (also returned for cross-tenant access — do not leak
//         row existence in another tenant)
//   - 502 OpenAI call failed
//   - 500 INSERT failed

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

const TRANSCRIPT_TURN_CAP = 30;
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_TEMPERATURE = 0.2;

// =============================================================================
// Types — defensive shapes (only fields we read)
// =============================================================================

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

type IntakeRow = {
  id: string;
  language: string | null;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_state: string | null;
  loan_officer_id: string | null;
  extracted_payload: unknown;
  match_results: unknown;
};

type ProSessionRow = {
  id: string;
  intake_session_id: string;
  team_user_id: string;
  language: string | null;
  messages: unknown;
  created_at: string;
};

type ExtractedPayload = {
  borrower?: {
    name?: string;
    email?: string;
    phone?: string;
    credit?: string | number;
    income?: string | number;
    debt?: string | number;
    targetState?: string;
    currentState?: string;
  };
  scenario?: {
    homePrice?: string | number;
    occupancy?: string;
    downPayment?: string | number;
    estimatedLtv?: string;
    estimatedLoanAmount?: string | number;
  };
  borrowerPath?: string;
};

type MatchBucket = {
  lender_name?: string;
  program_name?: string;
  score?: number;
};

type MatcherResponse = {
  success?: boolean;
  top_recommendation?: string;
  strong_matches?: MatchBucket[];
  conditional_matches?: MatchBucket[];
  eliminated_paths?: MatchBucket[];
  summary?: {
    strong_count?: number;
    conditional_count?: number;
    eliminated_count?: number;
  };
};

// === Polish v1 — structured data the code controls directly =================

type ScenarioFields = {
  borrowerName: string;
  loanAmount: string;
  homePrice: string;
  downPayment: string;
  ltv: string;
  occupancy: string;
  state: string;
  path: string;
  credit: string;
  income: string;
  debt: string;
};

type MatchSummary = {
  available: boolean;
  strongCount: number;
  conditionalCount: number;
  eliminatedCount: number;
  topRecommendation: string;
};

type AIBullets = {
  takeaways: string[];
  nextAction: string;
};

// =============================================================================
// Helpers — formatting
// =============================================================================

function fmtPlain(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v).trim() || "—";
}

function fmtCurrency(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n =
    typeof v === "number"
      ? v
      : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return String(v);
  return `$${n.toLocaleString("en-US")}`;
}

function fmtLtv(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v).trim();
  if (!s) return "—";
  return /%$/.test(s) ? s : `${s}%`;
}

// =============================================================================
// Code-side extraction — single source of truth for scenario + match values
// =============================================================================

function getScenarioFields(intake: IntakeRow): ScenarioFields {
  const payload = (intake.extracted_payload ?? {}) as ExtractedPayload;
  const b = payload.borrower ?? {};
  const s = payload.scenario ?? {};

  const borrowerName =
    [intake.borrower_first_name, intake.borrower_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    b.name ||
    "—";

  return {
    borrowerName,
    loanAmount: fmtCurrency(s.estimatedLoanAmount),
    homePrice: fmtCurrency(s.homePrice),
    downPayment: fmtCurrency(s.downPayment),
    ltv: fmtLtv(s.estimatedLtv),
    occupancy: s.occupancy || "—",
    state: b.targetState || intake.borrower_state || "—",
    path: payload.borrowerPath || "—",
    credit: fmtPlain(b.credit),
    income: fmtCurrency(b.income),
    debt: fmtCurrency(b.debt),
  };
}

function getMatchSummary(intake: IntakeRow): {
  summary: MatchSummary;
  raw: MatcherResponse | null;
} {
  const m = (intake.match_results ?? null) as MatcherResponse | null;
  if (!m || m.success !== true) {
    return {
      summary: {
        available: false,
        strongCount: 0,
        conditionalCount: 0,
        eliminatedCount: 0,
        topRecommendation: "",
      },
      raw: null,
    };
  }

  const sCount =
    typeof m.summary?.strong_count === "number"
      ? m.summary.strong_count
      : (m.strong_matches?.length ?? 0);
  const cCount =
    typeof m.summary?.conditional_count === "number"
      ? m.summary.conditional_count
      : (m.conditional_matches?.length ?? 0);
  const eCount =
    typeof m.summary?.eliminated_count === "number"
      ? m.summary.eliminated_count
      : (m.eliminated_paths?.length ?? 0);

  return {
    summary: {
      available: true,
      strongCount: sCount,
      conditionalCount: cCount,
      eliminatedCount: eCount,
      topRecommendation: (m.top_recommendation || "").trim(),
    },
    raw: m,
  };
}

// =============================================================================
// Context block builders — strings sent to the AI (not the final output)
// =============================================================================

function buildScenarioContextBlock(s: ScenarioFields): string {
  return [
    `Borrower: ${s.borrowerName}`,
    `Path: ${s.path}`,
    `Target state: ${s.state}`,
    `Occupancy: ${s.occupancy}`,
    `Home price: ${s.homePrice}`,
    `Down payment: ${s.downPayment}`,
    `Loan amount: ${s.loanAmount}`,
    `Estimated LTV: ${s.ltv}`,
    `Credit: ${s.credit}`,
    `Monthly income: ${s.income}`,
    `Monthly debt: ${s.debt}`,
  ].join("\n");
}

function buildMatchContextBlock(
  summary: MatchSummary,
  raw: MatcherResponse | null
): string {
  if (!summary.available) {
    return "No matcher run on file yet.";
  }
  const lines: string[] = [
    `Counts: ${summary.strongCount} strong, ${summary.conditionalCount} conditional, ${summary.eliminatedCount} eliminated`,
    `Top recommendation: ${summary.topRecommendation || "—"}`,
  ];
  if (raw) {
    const topStrong = (raw.strong_matches ?? [])
      .slice(0, 5)
      .map((b) => {
        const lender = b.lender_name ?? "?";
        const program = b.program_name ?? "?";
        const score =
          typeof b.score === "number" ? ` (score ${b.score})` : "";
        return `  - ${lender} / ${program}${score}`;
      })
      .join("\n");
    if (topStrong) lines.push(`Top strong matches:\n${topStrong}`);
  }
  return lines.join("\n");
}

function buildTranscriptBlock(messages: unknown): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "(No pro chat conversation yet.)";
  }
  const turns = (messages as ChatMessage[])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-TRANSCRIPT_TURN_CAP);
  if (turns.length === 0) {
    return "(No pro chat conversation yet.)";
  }
  return turns
    .map((m) => {
      const tag = m.role === "user" ? "LO" : "ProMode";
      return `${tag}: ${m.content.trim()}`;
    })
    .join("\n\n");
}

// =============================================================================
// AI — JSON-mode, prose-only output
// =============================================================================

async function generateAIBullets(args: {
  scenarioBlock: string;
  matchBlock: string;
  transcriptBlock: string;
  matchAvailable: boolean;
  hasTranscript: boolean;
}): Promise<AIBullets> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const systemPrompt = [
    "You produce ONLY the prose-judgment portion of a Pro Mode mortgage summary.",
    'Output a single valid JSON object with exactly this shape: { "takeaways": [string, ...], "next_action": string }.',
    "No prose outside the JSON. No markdown. No code fences.",
    "takeaways: 3 to 5 short sentences. Each is one factual observation drawn from the pro chat transcript and the scenario/matcher context provided. Never invent details that are not in the context.",
    'If the pro chat transcript is empty, return takeaways = ["No pro mode conversation yet — observations drawn from scenario and matcher results only."].',
    "next_action: ONE concise sentence describing what the loan officer should do next. Specific and grounded in the context provided.",
    "If the matcher has not been run, do not invent matcher results. Frame next_action around running the matcher or completing missing qualification facts.",
    "Do NOT include any matcher counts, top-recommendation strings, lender names, or program names in takeaways or next_action unless those exact values appear verbatim in the [MATCHER RESULTS] block.",
  ].join(" ");

  const userPrompt = `[BORROWER SCENARIO]
${args.scenarioBlock}

[MATCHER RESULTS]
${args.matchBlock}

[PRO CHAT TRANSCRIPT — last ${TRANSCRIPT_TURN_CAP} turns]
${args.transcriptBlock}

Generate the JSON now.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI returned no content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned non-JSON despite json_object format.");
  }

  const obj = (parsed ?? {}) as { takeaways?: unknown; next_action?: unknown };
  const takeaways = Array.isArray(obj.takeaways)
    ? obj.takeaways
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const nextAction =
    typeof obj.next_action === "string" ? obj.next_action.trim() : "";

  // Defensive fallbacks if AI returns empty
  const finalTakeaways =
    takeaways.length > 0
      ? takeaways
      : [
          args.hasTranscript
            ? "Pro chat session reviewed; see transcript for full context."
            : "No pro mode conversation yet — observations drawn from scenario and matcher results only.",
        ];

  const finalNextAction =
    nextAction ||
    (args.matchAvailable
      ? "Review the matcher's top recommendation and confirm the next missing qualification fact with the borrower."
      : "Run the qualification matcher with the available scenario data to identify viable lender-program paths.");

  return {
    takeaways: finalTakeaways,
    nextAction: finalNextAction,
  };
}

// =============================================================================
// Final assembly — pure code, deterministic structure
// =============================================================================

function assembleFinalSummary(args: {
  todayHuman: string;
  scenario: ScenarioFields;
  match: MatchSummary;
  bullets: AIBullets;
}): string {
  const { todayHuman, scenario: s, match, bullets } = args;

  const propertyDetails = [s.occupancy, s.state]
    .filter((x) => x && x !== "—")
    .join(" in ");
  const propertyLine = propertyDetails
    ? `• Property: ${propertyDetails}, ${s.homePrice}`
    : `• Property: ${s.homePrice}`;

  const ltvSuffix = s.ltv !== "—" ? ` at ${s.ltv} LTV` : "";
  const downSuffix =
    s.downPayment !== "—" ? ` with ${s.downPayment} down` : "";
  const loanPathPrefix = s.path !== "—" ? `${s.path}, ` : "";
  const loanLine = `• Loan: ${loanPathPrefix}${s.loanAmount}${ltvSuffix}${downSuffix}`;

  const matchLines = match.available
    ? [
        `• ${match.strongCount} strong, ${match.conditionalCount} conditional, ${match.eliminatedCount} eliminated`,
        `• Top recommendation: ${match.topRecommendation || "—"}`,
      ]
    : ["• Matcher has not been run on this file yet."];

  const takeawayLines = bullets.takeaways.map((t) => `• ${t}`);

  return [
    `PRO MODE SUMMARY — saved ${todayHuman}`,
    "",
    "Scenario",
    `• Borrower: ${s.borrowerName}`,
    propertyLine,
    loanLine,
    `• Credit / Monthly income / Monthly debt: ${s.credit} / ${s.income} / ${s.debt}`,
    "",
    "Matcher Outcome",
    ...matchLines,
    "",
    "Key Pro Chat Takeaways",
    ...takeawayLines,
    "",
    "Recommended Next Action",
    `• ${bullets.nextAction}`,
  ].join("\n");
}

// =============================================================================
// Route handler
// =============================================================================

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: intakeSessionId } = await context.params;

  // ---------------------------------------------------------------------------
  // 1. Auth (team_users)
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
    .select("id, full_name, role, is_active, email")
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
  // 2. F3.3: Resolve viewer's tenant_id via employees lookup by EMAIL.
  // ---------------------------------------------------------------------------
  const viewerEmail = (teamUser as { email?: string | null }).email;
  if (!viewerEmail) {
    console.error(
      "[save-to-workflow] team_users row has no email — cannot resolve tenant.",
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
    console.error("[save-to-workflow] employees lookup failed.", employeeError);
    return NextResponse.json(
      { error: "Failed to verify session." },
      { status: 500 }
    );
  }

  if (!employee || !employee.tenant_id) {
    console.warn(
      "[save-to-workflow] employees row missing or has no tenant_id.",
      { teamUserId: teamUser.id, viewerEmail }
    );
    return NextResponse.json(
      { error: "Tenant is not configured for this account." },
      { status: 403 }
    );
  }

  const viewerTenantId = employee.tenant_id as string;

  // ---------------------------------------------------------------------------
  // 3. Validate [id] + body
  // ---------------------------------------------------------------------------
  if (!isUuid(intakeSessionId)) {
    return NextResponse.json(
      { error: "Invalid intake session id." },
      { status: 400 }
    );
  }

  let body: { targetWorkflowFileId?: unknown; proSessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const targetWorkflowFileId = String(body.targetWorkflowFileId ?? "").trim();
  const explicitProSessionId =
    typeof body.proSessionId === "string" && body.proSessionId.trim()
      ? body.proSessionId.trim()
      : null;

  if (!isUuid(targetWorkflowFileId)) {
    return NextResponse.json(
      { error: "targetWorkflowFileId is required and must be a UUID." },
      { status: 400 }
    );
  }
  if (explicitProSessionId && !isUuid(explicitProSessionId)) {
    return NextResponse.json(
      { error: "proSessionId, if provided, must be a UUID." },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Verify ownership of target workflow file (tenant-scoped).
  //    workflow_files.loan_officer_id references team_users.id (verified
  //    via SQL probe). Comparison against session.userId stays unchanged.
  // ---------------------------------------------------------------------------
  const { data: workflowFile, error: workflowFileError } = await supabaseAdmin
    .from("workflow_files")
    .select("id, loan_officer_id, borrower_name, file_number")
    .eq("id", targetWorkflowFileId)
    .eq("tenant_id", viewerTenantId)
    .maybeSingle();

  if (workflowFileError) {
    return NextResponse.json(
      { error: workflowFileError.message },
      { status: 500 }
    );
  }
  if (!workflowFile) {
    return NextResponse.json(
      { error: "Target workflow file not found." },
      { status: 404 }
    );
  }
  if (workflowFile.loan_officer_id !== session.userId) {
    return NextResponse.json(
      {
        error:
          "You are not the assigned Loan Officer on that workflow file.",
      },
      { status: 403 }
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Load intake row (tenant-scoped)
  // ---------------------------------------------------------------------------
  const { data: intakeData, error: intakeError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .select(
      "id, language, borrower_first_name, borrower_last_name, borrower_state, loan_officer_id, extracted_payload, match_results"
    )
    .eq("id", intakeSessionId)
    .eq("tenant_id", viewerTenantId)
    .maybeSingle();

  if (intakeError) {
    return NextResponse.json(
      { error: intakeError.message },
      { status: 500 }
    );
  }
  if (!intakeData) {
    return NextResponse.json(
      { error: "Intake session not found." },
      { status: 404 }
    );
  }
  const intakeRow = intakeData as unknown as IntakeRow;

  // ---------------------------------------------------------------------------
  // 6. Load pro chat session — explicit OR most-recent for caller.
  //    Both branches tenant-scoped for defense in depth.
  // ---------------------------------------------------------------------------
  let proSession: ProSessionRow | null = null;

  if (explicitProSessionId) {
    const { data, error } = await supabaseAdmin
      .from("professional_chat_sessions")
      .select(
        "id, intake_session_id, team_user_id, language, messages, created_at"
      )
      .eq("id", explicitProSessionId)
      .eq("tenant_id", viewerTenantId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Pro session not found." },
        { status: 404 }
      );
    }
    const candidate = data as unknown as ProSessionRow;
    if (candidate.intake_session_id !== intakeSessionId) {
      return NextResponse.json(
        { error: "Pro session does not belong to this intake." },
        { status: 400 }
      );
    }
    if (candidate.team_user_id !== session.userId) {
      return NextResponse.json(
        { error: "Pro session does not belong to you." },
        { status: 403 }
      );
    }
    proSession = candidate;
  } else {
    const { data, error } = await supabaseAdmin
      .from("professional_chat_sessions")
      .select(
        "id, intake_session_id, team_user_id, language, messages, created_at"
      )
      .eq("intake_session_id", intakeSessionId)
      .eq("team_user_id", session.userId)
      .eq("tenant_id", viewerTenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    proSession = (data as unknown as ProSessionRow | null) ?? null;
  }

  // ---------------------------------------------------------------------------
  // 7. Extract structured data + build context blocks
  // ---------------------------------------------------------------------------
  const scenario = getScenarioFields(intakeRow);
  const { summary: match, raw: matchRaw } = getMatchSummary(intakeRow);
  const transcriptBlock = buildTranscriptBlock(proSession?.messages ?? []);
  const scenarioBlock = buildScenarioContextBlock(scenario);
  const matchBlock = buildMatchContextBlock(match, matchRaw);

  const hasTranscript =
    Array.isArray(proSession?.messages) &&
    (proSession?.messages as unknown[]).length > 0;

  const todayHuman = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // ---------------------------------------------------------------------------
  // 8. AI generates ONLY takeaways + next_action (JSON mode)
  // ---------------------------------------------------------------------------
  let bullets: AIBullets;
  try {
    bullets = await generateAIBullets({
      scenarioBlock,
      matchBlock,
      transcriptBlock,
      matchAvailable: match.available,
      hasTranscript,
    });
  } catch (e) {
    console.error("[save-to-workflow] OpenAI failed", {
      intakeSessionId,
      targetWorkflowFileId,
      teamUserId: session.userId,
      tenantId: viewerTenantId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Could not generate summary. Please try again." },
      { status: 502 }
    );
  }

  // ---------------------------------------------------------------------------
  // 9. Assemble final summary text deterministically
  // ---------------------------------------------------------------------------
  const summary = assembleFinalSummary({
    todayHuman,
    scenario,
    match,
    bullets,
  });

  // ---------------------------------------------------------------------------
  // 10. INSERT into workflow_feed.
  //     tenant_id is set explicitly so this INSERT continues to work after
  //     F3.7 DROPs the DEFAULT off workflow_feed.tenant_id.
  // ---------------------------------------------------------------------------
  const author = String(teamUser.full_name ?? "").trim() || "Team User";

  const { data: feedRow, error: feedError } = await supabaseAdmin
    .from("workflow_feed")
    .insert({
      workflow_file_id: targetWorkflowFileId,
      tenant_id: viewerTenantId,
      author,
      role: callerRole,
      text: summary,
      update_type: "pro_mode_summary",
    })
    .select("id, created_at")
    .single();

  if (feedError || !feedRow) {
    console.error("[save-to-workflow] feed insert failed", {
      intakeSessionId,
      targetWorkflowFileId,
      teamUserId: session.userId,
      tenantId: viewerTenantId,
      error: feedError?.message,
    });
    return NextResponse.json(
      { error: "Could not save summary to workflow file." },
      { status: 500 }
    );
  }

  console.log("[save-to-workflow] saved", {
    intakeSessionId,
    targetWorkflowFileId,
    teamUserId: session.userId,
    tenantId: viewerTenantId,
    feedId: (feedRow as { id: string }).id,
    summaryChars: summary.length,
    matchAvailable: match.available,
    proSessionUsed: proSession?.id ?? null,
  });

  return NextResponse.json({
    success: true,
    feedId: (feedRow as { id: string }).id,
    persistedAt: (feedRow as { created_at: string }).created_at,
    summary,
  });
}
