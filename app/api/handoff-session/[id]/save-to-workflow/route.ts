// app/api/handoff-session/[id]/save-to-workflow/route.ts
//
// Step 6 Phase 6.1 — NEW endpoint.
//
// Generates an AI summary of the Pro Mode session (borrower scenario +
// matcher results + pro chat transcript) and persists it as a workflow_feed
// row on a target workflow file the calling Loan Officer is assigned to.
//
// Request:
//   POST /api/handoff-session/<intakeSessionId>/save-to-workflow
//   Body: {
//     targetWorkflowFileId: string,   // UUID of workflow_files row, REQUIRED
//     proSessionId?: string           // optional UUID; if omitted, picks the
//                                     // most recent pro chat session for
//                                     // this intake belonging to the
//                                     // calling team user
//   }
//
// Auth (matches sibling handoff-session/[id] routes):
//   - bf_team_session cookie required
//   - team_users row must be active
//   - role must be in PROFESSIONAL_ROLES
//
// Access control:
//   - Calling user MUST be workflow_files.loan_officer_id on the target.
//     Otherwise 403. The /finley dropdown also filters by this; the API
//     enforces it as defense in depth.
//
// Behavior:
//   1. Auth gate
//   2. Validate [id] + body
//   3. Verify ownership of target workflow file
//   4. Load borrower_intake_sessions row (scenario + match_results)
//   5. Load professional_chat_sessions row (most-recent for caller OR explicit)
//   6. Build OpenAI prompt + call gpt-4o-mini
//   7. INSERT into workflow_feed with update_type='pro_mode_summary'
//   8. Return { success, feedId, persistedAt, summary }
//
// On INSERT, the workflow_feed_touch_activity trigger fires and bumps
// workflow_files.last_activity_at — same as "Add Internal Update".
//
// Failure modes:
//   - 401 no/invalid session
//   - 403 inactive, wrong role, not the assigned LO on target file, or
//         pro session does not belong to caller
//   - 400 invalid [id] or body, or pro session belongs to different intake
//   - 404 intake session, target workflow file, or explicit pro session
//         not found
//   - 502 OpenAI call failed (distinct from 500 so the caller can retry)
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

const TRANSCRIPT_TURN_CAP = 30; // last 30 turns of pro chat fed to summarizer
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_TEMPERATURE = 0.2; // low — structured summary, not creative prose

// =============================================================================
// Types (defensive shapes — only fields we read)
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

// =============================================================================
// Helpers — context block builders
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

function buildScenarioBlock(intake: IntakeRow): string {
  const payload = (intake.extracted_payload ?? {}) as ExtractedPayload;
  const b = payload.borrower ?? {};
  const s = payload.scenario ?? {};

  const fullName =
    [intake.borrower_first_name, intake.borrower_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    b.name ||
    "—";

  const state = b.targetState || intake.borrower_state || "—";
  const occupancy = s.occupancy || "—";
  const path = payload.borrowerPath || "—";

  return [
    `Borrower: ${fullName}`,
    `Path: ${path}`,
    `Target state: ${state}`,
    `Occupancy: ${occupancy}`,
    `Home price: ${fmtCurrency(s.homePrice)}`,
    `Down payment: ${fmtCurrency(s.downPayment)}`,
    `Estimated loan: ${fmtCurrency(s.estimatedLoanAmount)}`,
    `Estimated LTV: ${fmtPlain(s.estimatedLtv)}`,
    `Credit: ${fmtPlain(b.credit)}`,
    `Income (monthly): ${fmtCurrency(b.income)}`,
    `Debt (monthly): ${fmtCurrency(b.debt)}`,
  ].join("\n");
}

function buildMatchBlock(intake: IntakeRow): string {
  const m = (intake.match_results ?? null) as MatcherResponse | null;
  if (!m || m.success !== true) {
    return "No matcher run on file yet.";
  }

  const sCount =
    m.summary?.strong_count ?? (m.strong_matches?.length ?? 0);
  const cCount =
    m.summary?.conditional_count ?? (m.conditional_matches?.length ?? 0);
  const eCount =
    m.summary?.eliminated_count ?? (m.eliminated_paths?.length ?? 0);

  const top = m.top_recommendation?.trim() || "—";

  const topStrong = (m.strong_matches ?? [])
    .slice(0, 5)
    .map((b) => {
      const lender = b.lender_name ?? "?";
      const program = b.program_name ?? "?";
      const score =
        typeof b.score === "number" ? ` (score ${b.score})` : "";
      return `  - ${lender} / ${program}${score}`;
    })
    .join("\n");

  return [
    `Counts: ${sCount} strong, ${cCount} conditional, ${eCount} eliminated`,
    `Top recommendation: ${top}`,
    topStrong ? `Top strong matches:\n${topStrong}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
// OpenAI summarization
// =============================================================================

async function generateSummary(args: {
  scenarioBlock: string;
  matchBlock: string;
  transcriptBlock: string;
  todayHuman: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const systemPrompt = [
    "You are a senior mortgage advisor's assistant generating a file-quality summary of a Pro Mode session for the loan file record.",
    "Output PLAIN TEXT only. No markdown, no asterisks for bold, no emoji.",
    "Use the EXACT structure provided in the user prompt, with the exact section headers and the exact bullet character (•).",
    "Be factual, specific, and brief. Never invent details that are not present in the context.",
    "If a field is unknown, write '—'.",
    "The 'Key Pro Chat Takeaways' section must contain 3-5 bullets drawn ONLY from the pro chat transcript. If the transcript is empty, write '• No pro mode conversation yet.' as the only bullet in that section.",
    "The 'Recommended Next Action' section must be ONE concise line.",
  ].join(" ");

  const userPrompt = `Today's date: ${args.todayHuman}

Generate a Pro Mode summary using EXACTLY this structure (preserve headers and the • bullet character):

PRO MODE SUMMARY — saved ${args.todayHuman}

Scenario
• Borrower: ...
• Loan: ...
• Property: ...
• Credit / Income / Reserves: ...

Matcher Outcome
• N strong, N conditional, N eliminated
• Top recommendation: ...

Key Pro Chat Takeaways
• ...
• ...
• ...

Recommended Next Action
• ...

==== CONTEXT ====

[BORROWER SCENARIO]
${args.scenarioBlock}

[MATCHER RESULTS]
${args.matchBlock}

[PRO CHAT TRANSCRIPT — last ${TRANSCRIPT_TURN_CAP} turns]
${args.transcriptBlock}
`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
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
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("OpenAI returned no content.");
  }
  return summary;
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
  // 1. Auth — same pattern as /api/handoff-session/[id]/persist-match
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
    .select("id, full_name, role, is_active")
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
  // 2. Validate [id] + body
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
  // 3. Verify ownership of target workflow file
  // ---------------------------------------------------------------------------
  const { data: workflowFile, error: workflowFileError } = await supabaseAdmin
    .from("workflow_files")
    .select("id, loan_officer_id, borrower_name, file_number")
    .eq("id", targetWorkflowFileId)
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
  // 4. Load intake row
  // ---------------------------------------------------------------------------
  const { data: intakeData, error: intakeError } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .select(
      "id, language, borrower_first_name, borrower_last_name, borrower_state, loan_officer_id, extracted_payload, match_results"
    )
    .eq("id", intakeSessionId)
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
  // 5. Load pro chat session — explicit OR most-recent for caller
  // ---------------------------------------------------------------------------
  let proSession: ProSessionRow | null = null;

  if (explicitProSessionId) {
    const { data, error } = await supabaseAdmin
      .from("professional_chat_sessions")
      .select(
        "id, intake_session_id, team_user_id, language, messages, created_at"
      )
      .eq("id", explicitProSessionId)
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
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    proSession = (data as unknown as ProSessionRow | null) ?? null;
    // It's OK if no pro chat exists — we summarize what we have. The
    // transcript block will report "(No pro chat conversation yet.)" and
    // the AI is instructed to output the corresponding fallback bullet.
  }

  // ---------------------------------------------------------------------------
  // 6. Build context blocks + call OpenAI
  // ---------------------------------------------------------------------------
  const scenarioBlock = buildScenarioBlock(intakeRow);
  const matchBlock = buildMatchBlock(intakeRow);
  const transcriptBlock = buildTranscriptBlock(proSession?.messages ?? []);

  const todayHuman = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  let summary: string;
  try {
    summary = await generateSummary({
      scenarioBlock,
      matchBlock,
      transcriptBlock,
      todayHuman,
    });
  } catch (e) {
    console.error("[save-to-workflow] OpenAI failed", {
      intakeSessionId,
      targetWorkflowFileId,
      teamUserId: session.userId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Could not generate summary. Please try again." },
      { status: 502 }
    );
  }

  // ---------------------------------------------------------------------------
  // 7. INSERT into workflow_feed
  //    Fires workflow_feed_touch_activity trigger → bumps last_activity_at
  // ---------------------------------------------------------------------------
  const author = String(teamUser.full_name ?? "").trim() || "Team User";

  const { data: feedRow, error: feedError } = await supabaseAdmin
    .from("workflow_feed")
    .insert({
      workflow_file_id: targetWorkflowFileId,
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
    feedId: (feedRow as { id: string }).id,
    summaryChars: summary.length,
    proSessionUsed: proSession?.id ?? null,
  });

  return NextResponse.json({
    success: true,
    feedId: (feedRow as { id: string }).id,
    persistedAt: (feedRow as { created_at: string }).created_at,
    summary,
  });
}
