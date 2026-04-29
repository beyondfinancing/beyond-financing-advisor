// app/api/handoff-chat/[proSessionId]/route.ts
//
// Step 5 Drop A — Pro Mode system prompt + scenario/transcript/match/catalog
// context injection. Replaces the placeholder prompt that shipped in Drop 1.
//
// What changed vs Drop 1:
//   - buildSystemPrompt() rewritten as a multi-block runtime prompt:
//       1. Static Pro Mode rules (audience, tone, regulatory, business model)
//       2. BORROWER SCENARIO block — built from extracted_payload + intake row
//       3. BORROWER TRANSCRIPT block — last 50 turns from intake.messages
//       4. MATCH RESULTS block — summarized match_results, or "not yet run"
//       5. WHOLESALE LENDER × PROGRAM CATALOG block — live read from
//          lenders ⨝ programs (wholesale/correspondent/both, programs.is_active=true)
//   - Loads the borrower_intake_sessions row and the lenders/programs catalog
//     on every turn (live reads — no cache yet; ~19 lenders × ~26 programs
//     is small).
//   - Resolves loan_officer_id → team_users.full_name for "Loan Officer of
//     record" line in the scenario block.
//
// What did NOT change:
//   - Auth gate (cookie → role check)
//   - Pro session load + ownership check
//   - Message validation
//   - OpenAI call shape (model, temperature, message structure)
//   - Persistence (messages JSONB update on professional_chat_sessions)
//   - Response shape ({ success, reply, proSessionId, messageCount })
//
// Drop B (next) will add persistence so /finley's Run Qualification Match
// writes back to borrower_intake_sessions.match_results — at which point
// the MATCH RESULTS block will populate with real data instead of the
// "not yet run" branch.

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

const MAX_MESSAGE_LENGTH = 8000;
const TRANSCRIPT_TURN_CAP = 50;
const STRONG_TOP_N = 10; // top-N strong matches injected into the prompt

// =============================================================================
// Types
// =============================================================================

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

type ProSessionRow = {
  id: string;
  intake_session_id: string;
  team_user_id: string;
  language: string;
  messages: unknown;
};

type IntakeRow = {
  id: string;
  status: string;
  language: string | null;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_state: string | null;
  loan_officer_id: string | null;
  messages: unknown;
  extracted_payload: unknown;
  match_results: unknown;
};

type ExtractedBorrower = {
  name?: string;
  email?: string;
  phone?: string;
  credit?: string | number;
  income?: string | number;
  debt?: string | number;
  targetState?: string;
  currentState?: string;
};

type ExtractedScenario = {
  homePrice?: string | number;
  occupancy?: string;
  downPayment?: string | number;
  estimatedLtv?: string;
  estimatedLoanAmount?: string | number;
};

type ExtractedPayload = {
  borrower?: ExtractedBorrower;
  scenario?: ExtractedScenario;
  borrowerPath?: string;
  targetState?: string | null;
  currentState?: string | null;
};

type CatalogProgram = {
  id: string;
  lender_id: string;
  name: string;
  loan_category: string | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  occupancy: string | null;
};

type CatalogLender = {
  id: string;
  name: string;
  lender_type: string | null;
  does_conventional: boolean | null;
  does_fha: boolean | null;
  does_va: boolean | null;
  does_usda: boolean | null;
  programs: CatalogProgram[];
};

type AgencyProgram = {
  id: string;
  agency: string;
  product_family: string | null;
  program_name: string;
  occupancy: string[] | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  max_units: number | null;
};

type Catalog = {
  lenders: CatalogLender[];
  agencyPrograms: AgencyProgram[];
};

// Shape mirroring /api/match's MatchBucket. Defensive — we only read fields
// we actually use, so an upstream change to the matcher won't break us as
// long as the core fields stay.
type MatchBucket = {
  lender_name?: string;
  lender_id?: string;
  program_name?: string;
  program_slug?: string | null;
  loan_category?: string | null;
  guideline_id?: string;
  notes?: string[];
  missing_items?: string[];
  blockers?: string[];
  strengths?: string[];
  concerns?: string[];
  explanation?: string;
  score?: number;
  required_reserves_months?: number | null;
};

type MatcherResponse = {
  success?: boolean;
  top_recommendation?: string;
  next_question?: string;
  strong_matches?: MatchBucket[];
  conditional_matches?: MatchBucket[];
  eliminated_paths?: MatchBucket[];
  lender_summary?: {
    active_lender_count?: number;
    active_lenders_checked?: string[];
    matched_lenders_in_results?: string[];
  };
  summary?: {
    total_guidelines_checked?: number;
    strong_count?: number;
    conditional_count?: number;
    eliminated_count?: number;
  };
};

type ContextBlocks = {
  scenario: string;
  transcript: string;
  matchResults: string;
  catalog: string;
};

// =============================================================================
// Static Pro Mode prompt prefix
// =============================================================================

const PRO_MODE_PROMPT_PREFIX = `You are Finley Beyond, the AI mortgage intelligence layer for Beyond Financing, Inc. You are operating in PROFESSIONAL MODE.

# Audience

You are talking to a licensed U.S. mortgage professional — Loan Officer, LO Assistant, Branch Manager, Production Manager, or Processor — who has authenticated through a secure handoff link to discuss a specific borrower file. You are NOT talking to the borrower, and you are NOT talking to a real estate agent.

If the user appears to be either (asks "what's my rate?", refers to themselves as the borrower, asks how to refer clients to a loan officer), do not answer the question. Respond with exactly:

"Pro Mode is restricted to licensed mortgage professionals. If you reached this view in error, please return to the borrower-facing experience."

End there.

# Mortgage business model — hold this in mind

Borrower → Broker (Beyond Financing) → Wholesale lender (UWM, Pennymac TPO, etc.) → Wholesale lender sells the closed loan into Fannie Mae or Freddie Mac (GSE) pools, or Ginnie Mae pools (FHA/VA/USDA).

- Fannie Mae and Freddie Mac are investors/GSEs, not lenders. They publish selling guides; wholesale lenders fund loans to those guides.
- A recommendation is always wholesale lender × program. Never recommend "Fannie Mae" or "Freddie Mac" as a lender.
- Cite agency rules as "per the Fannie Mae Selling Guide…" — not "Fannie Mae requires" or "Fannie Mae will fund."

# Tone

- English only.
- Concise, technical. The LO is mortgage-literate; skip beginner explanations unless asked.
- Name specific lender × program combinations when recommending direction. "Top direction is Agency Connect with ClearEdge at 100" beats "consider a conforming agency program."
- No emojis. No filler ("Great question!", "Happy to help"). Get to the point.
- Tables when comparing 3+ programs or lenders.
- Short paragraphs. End with one concrete next move when natural.

# How to use the runtime context blocks

The system context that follows includes four runtime blocks for the file in question:

1. BORROWER SCENARIO — structured intake. Ground truth.
2. BORROWER TRANSCRIPT — recent borrower-facing conversation. Borrower's own words; useful for intent, hesitations, unstated context.
3. MATCH RESULTS — matcher output, or a flag that the matcher has not been run.
4. WHOLESALE LENDER × PROGRAM CATALOG — three sections:
   (a) Wholesale lenders with their capability flags (Conventional / FHA / VA / USDA).
   (b) Lender-specific programs — products owned by individual wholesale lenders (e.g. ClearEdge's Agency Connect, FNBA's Alt-A). These can only be recommended for the named lender.
   (c) Agency programs — Fannie Mae / FHA / VA / USDA / HUD selling guides. These are placeable by ANY wholesale lender in section (a) that has the matching capability flag. When recommending an agency program, name it together with one or more lenders from section (a) that can place it.
   THIS IS THE ONLY VALID SET OF RECOMMENDATIONS. Do not name a lender or program that is not in this list.

# When MATCH RESULTS says "not yet run"

Your response MUST have two parts. NEVER stop after Part 1. Stopping after Part 1 is a failure mode — you are leaving the LO without direction.

Part 1 (one short paragraph, max 2 sentences): Note that the matcher hasn't been run. Phrase like: "The qualification matcher hasn't been run on this file yet — run it from the form panel above for actual lender × program scores."

Part 2 (the rest of your response — REQUIRED, never skip): Proceed with direction-setting using the BORROWER SCENARIO and the CATALOG. Walk through:
  (a) What the borrower's profile suggests (credit, LTV, occupancy, state, transaction type, income vs debt at a glance).
  (b) Which program categories from the catalog are plausible given that profile.
  (c) 1–3 specific lender × program candidates from the catalog you'd watch closely, named individually.
  (d) One concrete next move for the LO.

If the catalog appears thin (few lenders or few programs visible), still recommend from what's there — flag the thinness in passing but do not use it as a reason to give a non-answer.

# When MATCH RESULTS is present

- Lead with the strongest direction — the top-scoring lender × program combination(s).
- Identify fallback groups — programs scoring conditional/clearable across many lenders, useful if pricing comes back unfavorable on the top pick.
- Flag noteworthy eliminations — they sometimes signal an unstated borrower plan (occupancy, state, unit count, transaction type).
- If the LO asks "why," walk through the matcher's reasoning.
- If programs tie at the top, table them.

# Regulatory carefulness — non-negotiable

- Never promise loan approval. Use language like "appears eligible per the matcher," "should clear program eligibility," "subject to underwriting and full documentation review."
- Never promise rate, APR, or pricing. You don't have pricing data. Direct the LO to pull from the lender's portal.
- Never offer legal or tax advice. Redirect: "That's a question for the borrower's attorney / CPA."
- Never quote underwriting in absolutes. Selling guides are binding; you are not. Frame as "per the [Lender] [Program] guidelines" or "per the Fannie Mae Selling Guide."
- Never fabricate program details, lender names, or guideline numbers. If it's not in the catalog or the match results, say so: "I don't have that in the catalog — pull the lender's product matrix."

# Allowed and useful

- Drafting borrower-facing copy at the LO's request (next-steps email, plain-English scenario explanation, document checklist).
- Comparing 2–3 programs head-to-head.
- Stress-testing the borrower profile ("if income drops 10%, do we still clear DTI on this program?").
- Naming likely overlay risks given the borrower's state and the program.

# What you are not

- Not a chatbot for borrowers.
- Not a pricing engine.
- Not an underwriter — you read the catalog and the matcher; you don't make credit decisions.
- Not a legal or tax advisor.

# Response substance floor

Every reply must be substantive. If you find yourself ending after a single template-style sentence ("the matcher hasn't been run, please run it"), you are violating the contract. The LO came to you with a real file; give them direction, not a redirect. The only exceptions are (1) the Pro Mode restricted refusal line above, and (2) genuine clarifying questions where the LO's request is ambiguous — and even then, propose a default direction the LO can confirm or correct.`;

// =============================================================================
// Context block builders
// =============================================================================

function formatScenarioBlock(
  intake: IntakeRow,
  loanOfficerName: string | null
): string {
  const payload = ((intake.extracted_payload as ExtractedPayload | null) ?? {}) as ExtractedPayload;
  const borrower = payload.borrower ?? {};
  const scenario = payload.scenario ?? {};

  const borrowerFullName =
    [intake.borrower_first_name, intake.borrower_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || borrower.name || "Anonymous";

  const subjectState =
    borrower.targetState ||
    borrower.currentState ||
    intake.borrower_state ||
    "Unknown";

  const fmtMoney = (v: string | number | undefined): string => {
    if (v === undefined || v === null || v === "") return "Unknown";
    const s = String(v).replace(/[^\d.]/g, "");
    return s ? `$${s}` : "Unknown";
  };
  const fmtRaw = (v: string | number | undefined): string => {
    if (v === undefined || v === null || v === "") return "Unknown";
    return String(v);
  };

  const lines = [
    "=== BORROWER SCENARIO ===",
    `Borrower: ${borrowerFullName}`,
    `Loan Officer of record: ${loanOfficerName || "Unassigned"}`,
    `Borrower-side conversation language: ${intake.language || "en"}`,
    `Transaction type: ${payload.borrowerPath || "Unknown"}`,
    `Subject property state: ${subjectState}`,
    `Occupancy: ${scenario.occupancy || "Unknown"}`,
    `Home price: ${fmtMoney(scenario.homePrice)}`,
    `Down payment: ${fmtMoney(scenario.downPayment)}`,
    `Estimated loan amount: ${fmtMoney(scenario.estimatedLoanAmount)}`,
    `Estimated LTV: ${fmtRaw(scenario.estimatedLtv)}`,
    `Credit score: ${fmtRaw(borrower.credit)}`,
    `Monthly gross income: ${fmtMoney(borrower.income)}`,
    `Monthly debt: ${fmtMoney(borrower.debt)}`,
  ];
  return lines.join("\n");
}

function formatTranscriptBlock(messages: unknown, cap: number): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "=== BORROWER TRANSCRIPT ===\n(No borrower-side conversation on file.)";
  }

  const filtered = (messages as Array<{ role?: unknown; content?: unknown }>)
    .filter(
      (m) =>
        m &&
        typeof m.content === "string" &&
        (m.role === "user" || m.role === "assistant")
    );

  const lastN = filtered.slice(-cap);

  const header =
    filtered.length > cap
      ? `=== BORROWER TRANSCRIPT (last ${lastN.length} of ${filtered.length} turns) ===`
      : `=== BORROWER TRANSCRIPT (${lastN.length} turns) ===`;

  const lines: string[] = [header];
  for (const m of lastN) {
    const label = m.role === "user" ? "[BORROWER]" : "[FINLEY]";
    lines.push(`${label}: ${String(m.content)}`);
  }
  return lines.join("\n");
}

function summarizeMatchResults(matchResults: unknown): string {
  const header = "=== MATCH RESULTS ===";

  // Null / empty / not-yet-run cases
  if (
    matchResults === null ||
    matchResults === undefined ||
    (Array.isArray(matchResults) && matchResults.length === 0) ||
    (typeof matchResults === "object" &&
      matchResults !== null &&
      Object.keys(matchResults as object).length === 0)
  ) {
    return `${header}\nMatcher has not been run on this file.`;
  }

  // Validate it looks like a matcher response. If it's some other JSON shape
  // (e.g. someone manually populated the column with non-matcher data), fall
  // back to a flag rather than a raw dump that could blow context.
  if (typeof matchResults !== "object" || matchResults === null) {
    return `${header}\nMatch results present but not in the expected shape.`;
  }
  const m = matchResults as MatcherResponse;
  if (
    !Array.isArray(m.strong_matches) &&
    !Array.isArray(m.conditional_matches) &&
    !Array.isArray(m.eliminated_paths)
  ) {
    return `${header}\nMatch results present but not in the expected shape.`;
  }

  const strong = Array.isArray(m.strong_matches) ? m.strong_matches : [];
  const conditional = Array.isArray(m.conditional_matches)
    ? m.conditional_matches
    : [];
  const eliminated = Array.isArray(m.eliminated_paths) ? m.eliminated_paths : [];

  // Sort strong descending by score (defensive — matcher already does this,
  // but a manual SQL UPDATE could land them out of order).
  const strongSorted = [...strong].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );
  const topStrong = strongSorted.slice(0, STRONG_TOP_N);

  const lines: string[] = [header];

  if (m.top_recommendation && m.top_recommendation.trim().length > 0) {
    lines.push(`Top recommendation: ${m.top_recommendation.trim()}`);
    lines.push("");
  }

  // Bucket counts
  lines.push(
    `Strong: ${strong.length} | Conditional: ${conditional.length} | Eliminated: ${eliminated.length}`
  );

  // Lender pool summary if present
  if (m.lender_summary) {
    const ls = m.lender_summary;
    if (typeof ls.active_lender_count === "number") {
      lines.push(`Active lenders checked: ${ls.active_lender_count}`);
    }
    if (
      Array.isArray(ls.matched_lenders_in_results) &&
      ls.matched_lenders_in_results.length > 0
    ) {
      lines.push(
        `Lenders surfacing in results: ${ls.matched_lenders_in_results.join(", ")}`
      );
    }
  }

  lines.push("");

  // Top N strong matches (lender × program × score)
  if (topStrong.length > 0) {
    lines.push(
      `Top ${topStrong.length} strong matches (sorted by score desc):`
    );
    topStrong.forEach((b, idx) => {
      const lender = b.lender_name || "Unknown lender";
      const program = b.program_name || "Unknown program";
      const score =
        typeof b.score === "number" ? `score ${b.score}` : "score n/a";
      const category = b.loan_category ? ` [${b.loan_category}]` : "";
      lines.push(`  ${idx + 1}. ${lender} × ${program}${category} — ${score}`);
    });
    lines.push("");
  }

  // Conditional bucket — show count + a few representative concerns/blockers
  if (conditional.length > 0) {
    const conditionalSorted = [...conditional].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );
    const topConditional = conditionalSorted.slice(0, 5);
    lines.push(
      `Conditional bucket: ${conditional.length} match(es). Top by score:`
    );
    topConditional.forEach((b, idx) => {
      const lender = b.lender_name || "Unknown lender";
      const program = b.program_name || "Unknown program";
      const score =
        typeof b.score === "number" ? `score ${b.score}` : "score n/a";
      const concernCount =
        Array.isArray(b.concerns) && b.concerns.length > 0
          ? ` — ${b.concerns.length} concern(s)`
          : "";
      lines.push(
        `  ${idx + 1}. ${lender} × ${program} — ${score}${concernCount}`
      );
    });
    lines.push("");
  }

  // Top elimination reasons — most-frequent blocker strings
  if (eliminated.length > 0) {
    const blockerCounts = new Map<string, number>();
    for (const b of eliminated) {
      const blockers = Array.isArray(b.blockers) ? b.blockers : [];
      for (const blk of blockers) {
        if (typeof blk === "string" && blk.trim()) {
          const key = blk.trim();
          blockerCounts.set(key, (blockerCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const topReasons = Array.from(blockerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    lines.push(`Eliminated bucket: ${eliminated.length} path(s).`);
    if (topReasons.length > 0) {
      lines.push("Top elimination reasons (frequency):");
      topReasons.forEach(([reason, count]) => {
        lines.push(`  • (${count}×) ${reason}`);
      });
    }
  }

  return lines.join("\n").trimEnd();
}

function formatCatalogBlock(catalog: Catalog): string {
  const header = "=== WHOLESALE LENDER × PROGRAM CATALOG ===";
  const lines: string[] = [header];

  // ---------------------------------------------------------------------------
  // Section 1: Wholesale lenders + capability flags
  // ---------------------------------------------------------------------------
  if (catalog.lenders.length === 0) {
    lines.push("(No active wholesale lenders configured.)");
  } else {
    lines.push("");
    lines.push(`# Wholesale Lenders (${catalog.lenders.length})`);
    for (const l of catalog.lenders) {
      const caps: string[] = [];
      if (l.does_conventional) caps.push("Conventional");
      if (l.does_fha) caps.push("FHA");
      if (l.does_va) caps.push("VA");
      if (l.does_usda) caps.push("USDA");
      const capStr = caps.length
        ? ` — capabilities: ${caps.join(", ")}`
        : " — capabilities: (not flagged)";
      lines.push(`${l.name}${capStr}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Section 2: Lender-specific programs
  // ---------------------------------------------------------------------------
  const lendersWithPrograms = catalog.lenders.filter(
    (l) => l.programs.length > 0
  );
  if (lendersWithPrograms.length > 0) {
    const totalPrograms = lendersWithPrograms.reduce(
      (sum, l) => sum + l.programs.length,
      0
    );
    lines.push("");
    lines.push(`# Lender-specific programs (${totalPrograms})`);
    for (const lender of lendersWithPrograms) {
      lines.push(`${lender.name}:`);
      for (const p of lender.programs) {
        const constraints = [
          p.loan_category ? p.loan_category : null,
          p.min_credit != null ? `min credit ${p.min_credit}` : null,
          p.max_ltv != null ? `max LTV ${p.max_ltv}` : null,
          p.max_dti != null ? `max DTI ${p.max_dti}` : null,
          p.occupancy ? `occupancy ${p.occupancy}` : null,
        ].filter((x): x is string => Boolean(x));
        const tail = constraints.length ? ` — ${constraints.join(", ")}` : "";
        lines.push(`  • ${p.name}${tail}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Section 3: Agency programs grouped by agency
  // ---------------------------------------------------------------------------
  if (catalog.agencyPrograms.length > 0) {
    const byAgency = new Map<string, AgencyProgram[]>();
    for (const ap of catalog.agencyPrograms) {
      const list = byAgency.get(ap.agency);
      if (list) list.push(ap);
      else byAgency.set(ap.agency, [ap]);
    }

    lines.push("");
    lines.push(
      `# Agency programs (${catalog.agencyPrograms.length}) — placeable by any wholesale lender above with the matching capability`
    );

    // Stable ordering: Fannie Mae first, then alphabetical
    const sortedAgencies = Array.from(byAgency.keys()).sort((a, b) => {
      if (a === "Fannie Mae") return -1;
      if (b === "Fannie Mae") return 1;
      return a.localeCompare(b);
    });

    for (const agency of sortedAgencies) {
      const programs = byAgency.get(agency) ?? [];
      const capabilityHint = agencyCapabilityHint(agency);
      lines.push(
        `${agency} (${programs.length} programs)${capabilityHint ? ` — typically requires ${capabilityHint} capability` : ""}:`
      );
      // Sort programs alphabetically within agency
      const sortedPrograms = [...programs].sort((a, b) =>
        a.program_name.localeCompare(b.program_name)
      );
      for (const ap of sortedPrograms) {
        const occList = Array.isArray(ap.occupancy) ? ap.occupancy.join(", ") : null;
        const constraints = [
          ap.product_family ? ap.product_family : null,
          ap.min_credit != null ? `min credit ${ap.min_credit}` : null,
          ap.max_ltv != null ? `max LTV ${ap.max_ltv}` : null,
          ap.max_dti != null ? `max DTI ${ap.max_dti}` : null,
          ap.max_units != null ? `max units ${ap.max_units}` : null,
          occList ? `occupancy ${occList}` : null,
        ].filter((x): x is string => Boolean(x));
        const tail = constraints.length ? ` — ${constraints.join(", ")}` : "";
        lines.push(`  • ${ap.program_name}${tail}`);
      }
    }
  }

  return lines.join("\n");
}

// Map agency name → which lender capability flag is typically needed.
// Conservative — when in doubt, omit the hint and let Finley reason from
// agency-name + lender capability flags directly.
function agencyCapabilityHint(agency: string): string | null {
  switch (agency) {
    case "Fannie Mae":
    case "Freddie Mac":
      return "Conventional";
    case "FHA":
      return "FHA";
    case "VA":
      return "VA";
    case "USDA":
      return "USDA";
    case "HUD":
      // Section 184 is HUD-administered but generally tracked under FHA-capable
      // wholesale lenders. Conservative hint.
      return "FHA";
    default:
      return null;
  }
}

// =============================================================================
// System prompt assembly
// =============================================================================

function buildSystemPrompt(blocks: ContextBlocks): string {
  return [
    PRO_MODE_PROMPT_PREFIX,
    "",
    "=================================================",
    "RUNTIME CONTEXT FOR THIS FILE (refresh on every turn)",
    "=================================================",
    "",
    blocks.scenario,
    "",
    blocks.transcript,
    "",
    blocks.matchResults,
    "",
    blocks.catalog,
  ].join("\n");
}

// =============================================================================
// Data loaders
// =============================================================================

async function loadBorrowerScenario(
  intakeSessionId: string
): Promise<IntakeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("borrower_intake_sessions")
    .select(
      "id, status, language, borrower_first_name, borrower_last_name, borrower_state, loan_officer_id, messages, extracted_payload, match_results"
    )
    .eq("id", intakeSessionId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[handoff-chat] intake load failed", error);
    return null;
  }
  return data as unknown as IntakeRow;
}

async function loadLoanOfficerName(
  loanOfficerId: string | null
): Promise<string | null> {
  if (!loanOfficerId) return null;
  const { data, error } = await supabaseAdmin
    .from("team_users")
    .select("full_name")
    .eq("id", loanOfficerId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { full_name?: string | null }).full_name ?? null;
}

async function loadCatalog(): Promise<Catalog> {
  // Lenders: filter matches `/api/match` exactly — anything that isn't tagged
  // as an agency (Fannie Mae, Freddie Mac, etc.) is a placement option.
  // Pull capability flags so Pro Mode can reason about which agency programs
  // each lender can actually place.
  const { data: lenderRows, error: lenderError } = await supabaseAdmin
    .from("lenders")
    .select(
      "id, name, lender_type, does_conventional, does_fha, does_va, does_usda"
    )
    .or("lender_type.is.null,lender_type.neq.agency");

  if (lenderError || !lenderRows || lenderRows.length === 0) {
    if (lenderError) console.error("[handoff-chat] lender load failed", lenderError);
    return { lenders: [], agencyPrograms: [] };
  }

  const lenders = lenderRows as unknown as Array<{
    id: string;
    name: string;
    lender_type: string | null;
    does_conventional: boolean | null;
    does_fha: boolean | null;
    does_va: boolean | null;
    does_usda: boolean | null;
  }>;

  const lenderIds = lenders.map((l) => l.id);

  // Lender-specific active programs
  const { data: programRows, error: programError } = await supabaseAdmin
    .from("programs")
    .select(
      "id, lender_id, name, loan_category, min_credit, max_ltv, max_dti, occupancy"
    )
    .in("lender_id", lenderIds)
    .eq("is_active", true);

  if (programError) {
    console.error("[handoff-chat] program load failed", programError);
  }

  const programs = (programRows ?? []) as unknown as CatalogProgram[];

  const programsByLender = new Map<string, CatalogProgram[]>();
  for (const p of programs) {
    const list = programsByLender.get(p.lender_id);
    if (list) list.push(p);
    else programsByLender.set(p.lender_id, [p]);
  }
  for (const list of programsByLender.values()) {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  const catalogLenders: CatalogLender[] = lenders
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => ({
      id: l.id,
      name: l.name,
      lender_type: l.lender_type,
      does_conventional: l.does_conventional,
      does_fha: l.does_fha,
      does_va: l.does_va,
      does_usda: l.does_usda,
      programs: programsByLender.get(l.id) ?? [],
    }));

  // Agency programs from global_guidelines — same source the matcher reads.
  // Fields kept compact for the prompt; richer notes live on each row but
  // would blow the token budget if injected wholesale.
  const { data: agencyRows, error: agencyError } = await supabaseAdmin
    .from("global_guidelines")
    .select(
      "id, agency, product_family, program_name, occupancy, min_credit, max_ltv, max_dti, max_units"
    )
    .eq("is_active", true);

  if (agencyError) {
    console.error("[handoff-chat] agency guideline load failed", agencyError);
    return { lenders: catalogLenders, agencyPrograms: [] };
  }

  const agencyPrograms = (agencyRows ?? []) as unknown as AgencyProgram[];

  return { lenders: catalogLenders, agencyPrograms };
}

// =============================================================================
// OpenAI call
// =============================================================================

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned empty content.");
  }
  return content.trim();
}

// =============================================================================
// POST handler
// =============================================================================

export async function POST(
  req: Request,
  context: { params: Promise<{ proSessionId: string }> }
) {
  const { proSessionId } = await context.params;

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
      { error: "This chat is for licensed mortgage professionals." },
      { status: 403 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Validate route param + load pro session
  // -------------------------------------------------------------------------
  if (!isUuid(proSessionId)) {
    return NextResponse.json(
      { error: "Invalid pro session id." },
      { status: 400 }
    );
  }

  const { data: proRow, error: proError } = await supabaseAdmin
    .from("professional_chat_sessions")
    .select("id, intake_session_id, team_user_id, language, messages")
    .eq("id", proSessionId)
    .maybeSingle();

  if (proError || !proRow) {
    return NextResponse.json(
      { error: "Pro session not found." },
      { status: 404 }
    );
  }

  const pro = proRow as unknown as ProSessionRow;

  // -------------------------------------------------------------------------
  // 3. Defense in depth: ensure this LO owns this thread.
  // -------------------------------------------------------------------------
  if (pro.team_user_id !== session.userId) {
    return NextResponse.json(
      { error: "This pro session belongs to a different team member." },
      { status: 403 }
    );
  }

  // -------------------------------------------------------------------------
  // 4. Parse + validate the LO's message
  // -------------------------------------------------------------------------
  let body: { message?: unknown; mode?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const userMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return NextResponse.json(
      { error: "Message is required." },
      { status: 400 }
    );
  }
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars).` },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 5. Load runtime context (intake row, LO of record, catalog)
  // -------------------------------------------------------------------------
  const intake = await loadBorrowerScenario(pro.intake_session_id);
  if (!intake) {
    return NextResponse.json(
      { error: "Borrower intake session not found." },
      { status: 404 }
    );
  }

  const [loanOfficerName, catalog] = await Promise.all([
    loadLoanOfficerName(intake.loan_officer_id),
    loadCatalog(),
  ]);

  const blocks: ContextBlocks = {
    scenario: formatScenarioBlock(intake, loanOfficerName),
    transcript: formatTranscriptBlock(intake.messages, TRANSCRIPT_TURN_CAP),
    matchResults: summarizeMatchResults(intake.match_results),
    catalog: formatCatalogBlock(catalog),
  };

  const systemPrompt = buildSystemPrompt(blocks);

  // Lightweight observability — sizes only, no PII content.
  console.log("[handoff-chat] context built", {
    proSessionId: pro.id,
    intakeId: intake.id,
    teamUserId: session.userId,
    scenarioBytes: blocks.scenario.length,
    transcriptBytes: blocks.transcript.length,
    matchBytes: blocks.matchResults.length,
    catalogBytes: blocks.catalog.length,
    systemPromptChars: systemPrompt.length,
    catalogLenders: catalog.lenders.length,
    catalogAgencyPrograms: catalog.agencyPrograms.length,
    matchPresent: !blocks.matchResults.includes("has not been run"),
  });

  // -------------------------------------------------------------------------
  // 6. Build conversation history + call OpenAI
  // -------------------------------------------------------------------------
  const ts = new Date().toISOString();
  const existingMessages: ChatMessage[] = Array.isArray(pro.messages)
    ? (pro.messages as ChatMessage[]).filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          (m.role === "user" || m.role === "assistant")
      )
    : [];

  const userTurn: ChatMessage = { role: "user", content: userMessage, ts };
  const historyForOpenAi: ChatMessage[] = [...existingMessages, userTurn];

  let assistantReply: string;
  try {
    assistantReply = await callOpenAI(systemPrompt, historyForOpenAi);
  } catch (err) {
    console.error("[handoff-chat] OpenAI call failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI provider error.",
      },
      { status: 502 }
    );
  }

  // -------------------------------------------------------------------------
  // 7. Persist updated messages JSONB
  // -------------------------------------------------------------------------
  const assistantTurn: ChatMessage = {
    role: "assistant",
    content: assistantReply,
    ts: new Date().toISOString(),
  };
  const updatedMessages = [...existingMessages, userTurn, assistantTurn];

  const { error: updateError } = await supabaseAdmin
    .from("professional_chat_sessions")
    .update({ messages: updatedMessages })
    .eq("id", pro.id);

  if (updateError) {
    console.error("[handoff-chat] persist failed", updateError);
    // Reply still flows back to the LO — persistence failure is server-side
    // visible via logs but shouldn't strand the LO mid-thought.
  }

  // -------------------------------------------------------------------------
  // 8. Return the assistant reply
  // -------------------------------------------------------------------------
  return NextResponse.json({
    success: true,
    reply: assistantReply,
    proSessionId: pro.id,
    messageCount: updatedMessages.length,
  });
}
