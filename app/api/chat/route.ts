// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/chat/route.ts
//
// =============================================================================
//
// PHASE 5-prep-E — Finley's Brain Upgrade
//
// What's new vs. the previous version:
//
//   1. Senior loan officer assistant persona with 20+ years of experience.
//      Finley speaks like an experienced LOA, not a generic chatbot.
//
//   2. Broad mortgage program knowledge baked into the system prompt:
//      Conventional (FNMA/FHLMC), FHA, VA, USDA, Jumbo, Non-QM, Bank
//      Statement, ITIN, DSCR, Foreign National. Finley knows the typical
//      flags that point toward each program family.
//
//   3. Live lender catalog injection. On each request, Finley reads a
//      summary of what programs Beyond Intelligence's lender database
//      actually contains and grounds suggestions in real availability,
//      WITHOUT exposing specific lender names to the borrower.
//
//   4. Smarter qualification flow that adapts to:
//      - which intake fields are filled
//      - which path (Purchase / Refinance / Investment) the borrower chose
//      - which target state they picked (state-licensing awareness)
//
//   5. Optional Claude Sonnet escalation. If ANTHROPIC_API_KEY is set in
//      the environment AND the borrower's most recent message is long or
//      complex (technical mortgage question, multi-part), Finley routes
//      to Claude Sonnet 4.5 for a higher-quality answer. Otherwise it
//      uses OpenAI gpt-4o-mini for speed and cost.
//
//   6. Hard guardrails preserved:
//      - Never quote rates, terms, or approval status to borrowers
//      - Never name specific lenders to borrowers (only program directions)
//      - Always defer final qualification to the assigned licensed LO
//      - Never invent facts not present in the conversation or context
//
//   7. Backward compatible. The team_command stage still works, the
//      response shape is unchanged, the borrower page does not need
//      to be modified for this upgrade to take effect.
//
// =============================================================================
//
// ENVIRONMENT VARIABLES:
//
//   OPENAI_API_KEY          (required)
//   ANTHROPIC_API_KEY       (optional — enables Claude escalation path)
//   NEXT_PUBLIC_SUPABASE_URL          (required for catalog injection)
//   SUPABASE_SERVICE_ROLE_KEY         (required for catalog injection)
//
// =============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type IncomingMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type BorrowerPayload = {
  name?: string;
  email?: string;
  credit?: string;
  income?: string;
  debt?: string;
};

type ScenarioPayload = {
  homePrice?: string;
  downPayment?: string;
  estimatedLoanAmount?: string;
  estimatedLtv?: string;
  occupancy?: string;
  borrowerPath?: string;
};

type SelectedOfficerPayload = {
  id?: string;
  name?: string;
  nmls?: string;
  email?: string;
  assistantEmail?: string;
  mobile?: string;
  assistantMobile?: string;
  applyUrl?: string;
  scheduleUrl?: string;
};

type SelectedRealtorPayload = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  mls?: string;
} | null;

type RoutingPayload = {
  borrower?: BorrowerPayload;
  scenario?: ScenarioPayload;
  selectedOfficer?: SelectedOfficerPayload;
  selectedRealtor?: SelectedRealtorPayload;
  language?: string;
  conversation?: IncomingMessage[];
  currentState?: string;
  targetState?: string;
  borrowerPath?: string;
  realtorStatus?: string;
  intakeSessionId?: string;

  // Team command center fields
  source?: string;
  fileId?: string;
  borrowerName?: string;
  loanOfficer?: string;
  processor?: string;
  purpose?: string;
  occupancy?: string;
  amount?: string;
  targetCloseDate?: string;
  stageLabel?: string;
  priority?: string;
  blocker?: string;
  nextInternalAction?: string;
  nextBorrowerAction?: string;
};

type RequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up" | "team_command";
  routing?: RoutingPayload;
  messages?: IncomingMessage[];
};

type LenderCatalogSummary = {
  programCount: number;
  categories: string[];
  lowestMinCredit: number | null;
  highestMaxLtv: number | null;
  lenderCount: number;
  hasNonQM: boolean;
  hasGovernment: boolean;
  hasJumbo: boolean;
  hasInvestment: boolean;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

// Split a single "Full Name" field into first / last on the first space.
// "Sandro Pansini" -> { first: "Sandro", last: "Pansini" }
// "Maria del Carmen Lopez" -> { first: "Maria", last: "del Carmen Lopez" }
// "Madonna" -> { first: "Madonna", last: null }
function splitName(full: string): { first: string | null; last: string | null } {
  const t = full.trim();
  if (!t) return { first: null, last: null };
  const idx = t.indexOf(" ");
  if (idx === -1) return { first: t, last: null };
  return { first: t.slice(0, idx), last: t.slice(idx + 1).trim() || null };
}

// Validate a UUID string. We never trust client-provided ids without a check —
// a malformed value would throw on the Postgres uuid column. Treat as missing.
function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeMessages(messages: unknown): IncomingMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      if (!msg || typeof msg !== "object") return null;
      const rawRole = (msg as { role?: unknown }).role;
      const content = safeString((msg as { content?: unknown }).content);
      if (!content) return null;
      let role: "system" | "user" | "assistant" = "user";
      if (rawRole === "assistant") role = "assistant";
      if (rawRole === "system") role = "system";
      return { role, content };
    })
    .filter(Boolean) as IncomingMessage[];
}

function buildLanguageInstruction(language: string): string {
  if (language === "pt") return "Respond in Brazilian Portuguese.";
  if (language === "es") return "Respond in Spanish (neutral Latin American).";
  return "Respond in English.";
}

function buildStageInstruction(stage?: string): string {
  switch (stage) {
    case "initial_review":
      return "This is the borrower's first message after running Preliminary Review. Greet them warmly by name, briefly acknowledge what you see, and ask the single most important next qualification question.";
    case "scenario_review":
      return "The borrower just updated their property scenario. Acknowledge the new numbers, comment briefly on what they suggest, and ask the next logical qualification question.";
    case "follow_up":
      return "This is an ongoing conversation. Answer the borrower's question if appropriate, then ask the next useful qualification question.";
    case "team_command":
      return "This is an internal Beyond Intelligence Team Command Center conversation with a mortgage professional, not a borrower.";
    default:
      return "This is a borrower mortgage conversation.";
  }
}

// -----------------------------------------------------------------------------
// Lender catalog injection — reads from Supabase to ground Finley in what
// Beyond Intelligence's database actually offers. Failure here is non-fatal;
// Finley falls back to general program knowledge if the catalog can't load.
// -----------------------------------------------------------------------------

async function loadLenderCatalogSummary(): Promise<LenderCatalogSummary | null> {
  try {
    const { data: programs, error: progErr } = await supabaseAdmin
      .from("programs")
      .select("loan_category, min_credit, max_ltv, lender_id, is_active")
      .eq("is_active", true);

    if (progErr || !programs) return null;

    const categories = Array.from(
      new Set(
        programs
          .map((p) => safeString(p.loan_category as string))
          .filter((c) => c.length > 0)
      )
    );

    const minCredits = programs
      .map((p) => Number(p.min_credit))
      .filter((n) => Number.isFinite(n) && n > 0);
    const maxLtvs = programs
      .map((p) => Number(p.max_ltv))
      .filter((n) => Number.isFinite(n) && n > 0);
    const lenderIds = new Set(
      programs.map((p) => p.lender_id).filter((id) => id != null)
    );

    const catLower = categories.map((c) => c.toLowerCase());

    return {
      programCount: programs.length,
      categories,
      lowestMinCredit: minCredits.length ? Math.min(...minCredits) : null,
      highestMaxLtv: maxLtvs.length ? Math.max(...maxLtvs) : null,
      lenderCount: lenderIds.size,
      hasNonQM: catLower.some((c) => c.includes("non-qm") || c.includes("non_qm") || c.includes("nonqm") || c.includes("bank statement") || c.includes("dscr")),
      hasGovernment: catLower.some((c) => c.includes("fha") || c.includes("va") || c.includes("usda") || c.includes("government")),
      hasJumbo: catLower.some((c) => c.includes("jumbo")),
      hasInvestment: catLower.some((c) => c.includes("investment") || c.includes("dscr") || c.includes("investor")),
    };
  } catch {
    return null;
  }
}

function renderCatalogContext(catalog: LenderCatalogSummary | null): string {
  if (!catalog || catalog.programCount === 0) {
    return `Beyond Intelligence's lender database is being populated. Speak about general program directions only.`;
  }

  const programDirections: string[] = [];
  if (catalog.hasGovernment) programDirections.push("FHA, VA, USDA government programs");
  if (catalog.hasNonQM) programDirections.push("Non-QM, Bank Statement, DSCR alternatives for self-employed and investors");
  if (catalog.hasJumbo) programDirections.push("Jumbo financing for higher loan amounts");
  if (catalog.hasInvestment) programDirections.push("Investment property and DSCR-style financing");

  return `
Beyond Intelligence has access to a lender database covering ${catalog.programCount} active programs across ${catalog.lenderCount} lenders.

Program families available include:
${catalog.categories.length > 0 ? catalog.categories.map((c) => `- ${c}`).join("\n") : "- (data still being indexed)"}

Notable directions in the BI catalog:
${programDirections.length > 0 ? programDirections.map((d) => `- ${d}`).join("\n") : "- Conventional financing through FNMA and FHLMC"}

${catalog.lowestMinCredit ? `Programs in the catalog support FICO scores starting at ${catalog.lowestMinCredit}.` : ""}
${catalog.highestMaxLtv ? `Programs in the catalog support LTV up to ${catalog.highestMaxLtv}% for qualified borrowers.` : ""}

CRITICAL: NEVER name specific lenders to the borrower. Speak only about PROGRAM DIRECTIONS at a high level. Specific lender placement is the assigned loan officer's job.
`.trim();
}

// -----------------------------------------------------------------------------
// Borrower facts collector
// -----------------------------------------------------------------------------

function buildCollectedFacts(routing?: RoutingPayload) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const officer = routing?.selectedOfficer || {};
  const realtor = routing?.selectedRealtor || null;

  return {
    borrowerName: safeString(borrower.name),
    borrowerEmail: safeString(borrower.email),
    credit: safeString(borrower.credit),
    income: safeString(borrower.income),
    debt: safeString(borrower.debt),
    homePrice: safeString(scenario.homePrice),
    downPayment: safeString(scenario.downPayment),
    estimatedLoanAmount: safeString(scenario.estimatedLoanAmount),
    estimatedLtv: safeString(scenario.estimatedLtv),
    occupancy: safeString(scenario.occupancy),
    borrowerPath: safeString(scenario.borrowerPath) || safeString(routing?.borrowerPath),
    officerName: safeString(officer.name),
    officerNmls: safeString(officer.nmls),
    realtorName: realtor ? safeString(realtor.name) : "",
    currentState: safeString(routing?.currentState),
    targetState: safeString(routing?.targetState),
    language: safeString(routing?.language) || "en",
  };
}

function buildMissingItems(facts: ReturnType<typeof buildCollectedFacts>): string[] {
  const missing: string[] = [];
  if (!hasValue(facts.borrowerName)) missing.push("borrower name");
  if (!hasValue(facts.borrowerEmail)) missing.push("borrower email");
  if (!hasValue(facts.credit)) missing.push("estimated credit score");
  if (!hasValue(facts.income)) missing.push("gross monthly income");
  if (!hasValue(facts.debt)) missing.push("monthly debt obligations");
  if (!hasValue(facts.homePrice)) missing.push("target home price");
  if (!hasValue(facts.downPayment)) missing.push("estimated down payment");
  return missing;
}

// -----------------------------------------------------------------------------
// Borrower-facing system prompt — Finley as Senior Loan Officer Assistant
// -----------------------------------------------------------------------------

function buildBorrowerSystemPrompt(
  stage: string | undefined,
  routing: RoutingPayload | undefined,
  catalogContext: string
): string {
  const facts = buildCollectedFacts(routing);
  const missingItems = buildMissingItems(facts);

  // Calculate quick ratios when we have the data
  const incomeNum = Number(facts.income) || 0;
  const debtNum = Number(facts.debt) || 0;
  const homePriceNum = Number(facts.homePrice) || 0;
  const downPaymentNum = Number(facts.downPayment) || 0;
  const loanAmountCalc = Math.max(homePriceNum - downPaymentNum, 0);
  const dtiBackEndPct =
    incomeNum > 0 && loanAmountCalc > 0
      ? Math.round(((debtNum + loanAmountCalc * 0.006) / incomeNum) * 100)
      : null;
  const ltvCalc =
    homePriceNum > 0 && loanAmountCalc > 0
      ? Math.round((loanAmountCalc / homePriceNum) * 100)
      : null;

  return `
You are Finley Beyond, a senior loan officer assistant powered by Beyond Intelligence.

You speak like a 20-year-veteran loan officer assistant who has helped thousands of borrowers find the right mortgage program. You are warm, professional, plain-spoken, and concise. You do not use mortgage jargon without explaining it. You sound like a real human, never like a generic chatbot.

${buildLanguageInstruction(facts.language)}
${buildStageInstruction(stage)}

# YOUR ROLE

You help borrowers think through a mortgage scenario, gather the right information for their assigned loan officer, and explain general concepts. You do NOT issue approvals, quote rates, or commit to specific programs. The assigned loan officer makes those decisions.

You are the borrower's preparation partner. By the time the loan officer joins the conversation, you have already collected and clarified the basics, asked the smart follow-up questions, and surfaced any complications worth flagging.

# HARD RULES (NEVER BREAK THESE)

1. NEVER quote a rate. Not even "around 7%". Rates change daily and are personalized.
2. NEVER promise approval, eligibility, or commitment to lend.
3. NEVER name specific lenders to the borrower. Talk about program directions only.
4. NEVER invent facts not present in this conversation or the borrower context below.
5. NEVER give legal or tax advice. Refer those to a CPA or attorney.
6. ALWAYS defer final qualification, program selection, and pricing to the assigned licensed loan officer.
7. ALWAYS encourage the borrower to click "Apply Now" when they are ready to move forward.
8. ALWAYS keep responses concise — 2-4 short paragraphs maximum unless explaining a complex concept.

# PROGRAM KNOWLEDGE YOU HAVE

You know the major US mortgage program families and what flags point toward each:

CONVENTIONAL (Fannie Mae / Freddie Mac):
- FICO 620+ for most products, 660+ preferred
- Up to 97% LTV for first-time buyers (HomeReady, Home Possible)
- DTI typically up to 45-50%, sometimes higher with compensating factors
- 1-4 unit primary, second home, investment all eligible
- W-2 borrowers with 2-year history are the bread-and-butter case

FHA:
- FICO 580+ for 96.5% LTV, 500-579 with 10% down
- More forgiving on past credit events (BK 2 years, foreclosure 3 years)
- Mortgage insurance (UFMIP + monthly MIP) required
- Owner-occupied 1-4 units only
- Good for first-time buyers with limited down payment

VA:
- Veterans, active duty, qualifying surviving spouses
- 100% LTV (no down payment) up to county limits
- No mortgage insurance, but funding fee applies
- Owner-occupied only
- DTI flexibility with residual income test

USDA:
- Rural property in eligible zones
- 100% LTV (no down payment)
- Income limits apply
- Owner-occupied only
- Often missed by borrowers who don't realize they qualify geographically

JUMBO:
- Loan amount above conforming limit (varies by county, typically $766K-$1.15M+)
- Stricter underwriting: FICO 700+, more reserves, lower DTI
- Both full-doc and alternative-doc options exist

NON-QM / ALTERNATIVE DOC (relevant for self-employed, foreign income, complex profiles):
- Bank Statement loans (12-24 months personal/business statements instead of tax returns)
- Profit and Loss only programs
- 1099 borrower programs
- ITIN borrower programs (no SSN required)
- Foreign National programs (no US credit required)
- Asset Depletion / Asset Utilization programs
- Higher rates than conforming, but unlock borrowers who otherwise can't qualify

DSCR (Debt Service Coverage Ratio) — investment property:
- Qualifies based on the rental income covering the debt service
- No personal income docs required
- Investor-focused, 1-4 unit and small multifamily
- Common for landlords with multiple properties

# QUALIFICATION SIGNALS YOU LISTEN FOR

Listen actively to the borrower's responses for these flags and ask targeted follow-ups:

- "I'm self-employed" / "I own a business" → ask about doc type, years in business, average net income vs gross deposits
- "I just started a new job" → ask about prior job, gap, contract vs W-2
- "I have rental income" → ask if it's on the tax return or new lease
- "I had a bankruptcy / foreclosure / short sale" → ask the date, this gates program eligibility
- "I'm not a US citizen" → ask about visa type or green card status (gates program eligibility)
- "I'm a first-time buyer" → mention HomeReady / Home Possible / FHA may apply
- "I'm a veteran" / "I served" → mention VA financing
- "It's an investment property" → mention DSCR direction
- "It's rural" → mention USDA possibility
- "Big down payment, moving from another country" → mention Foreign National direction
- High debt vs income → ask about installment loans, student loans, child support

# BEYOND INTELLIGENCE LENDER CATALOG (live data)

${catalogContext}

# THE BORROWER YOU ARE TALKING TO

Path: ${facts.borrowerPath || "not specified"}
Name: ${facts.borrowerName || "not provided"}
Email: ${facts.borrowerEmail || "not provided"}
Credit Score: ${facts.credit || "not provided"}
Gross Monthly Income: ${facts.income ? `$${Number(facts.income).toLocaleString()}` : "not provided"}
Monthly Debt: ${facts.debt ? `$${Number(facts.debt).toLocaleString()}` : "not provided"}
Current State: ${facts.currentState || "not provided"}
Target State: ${facts.targetState || "not provided"}
Target Home Price: ${facts.homePrice ? `$${Number(facts.homePrice).toLocaleString()}` : "not provided"}
Estimated Down Payment: ${facts.downPayment ? `$${Number(facts.downPayment).toLocaleString()}` : "not provided"}
Estimated Loan Amount: ${loanAmountCalc > 0 ? `$${loanAmountCalc.toLocaleString()}` : "not provided"}
Estimated LTV: ${ltvCalc !== null ? `${ltvCalc}%` : "not provided"}
Occupancy: ${facts.occupancy || "not specified"}
Estimated DTI (rough): ${dtiBackEndPct !== null ? `~${dtiBackEndPct}%` : "not yet calculable"}
Assigned Loan Officer: ${facts.officerName || "Finley Beyond (BI will assign)"} ${facts.officerNmls ? `(NMLS ${facts.officerNmls})` : ""}
Realtor on file: ${facts.realtorName || "none"}

Missing intake items (do not re-ask anything that's already filled):
${missingItems.length > 0 ? missingItems.map((item) => `- ${item}`).join("\n") : "- none — full intake captured"}

# RESPONSE INSTRUCTIONS

1. NEVER re-ask for any data field already populated above.
2. If there are missing core items, ask for the SINGLE most important one.
3. If full intake is captured, move to advanced questions: occupancy, employment type, time in current job/business, residency status, property type, timeline, reserves/assets, prior credit events.
4. When the borrower asks a general question (e.g., "what's a DTI?", "what's PMI?", "what's the difference between FHA and conventional?"), explain it plainly in 2-3 sentences with a concrete example, then redirect to the next qualification question.
5. When the borrower's profile suggests a program direction (e.g., self-employed → Bank Statement; rural → USDA; veteran → VA), MENTION the direction by category name only, never by lender name.
6. If you spot a complication (high DTI, recent BK, non-permanent resident, low credit), call it out gently and explain what that means for next steps. Do not panic the borrower.
7. End most responses with one specific question.
8. If the borrower is clearly ready (full intake, scenario set, no obvious blockers), encourage them to click "Apply Now" so the assigned loan officer can take over.

# TONE EXAMPLES

GOOD: "Got it — your numbers look solid for a conventional path with a strong down payment cushion. One question that helps your loan officer figure out the right product: are you W-2, self-employed, or a mix?"

GOOD: "Self-employed with two years of returns and steady deposits is a great profile — your loan officer has multiple program directions to consider including conventional with bank statement alternatives if needed. How long have you been running the business?"

GOOD: "FHA can be a strong fit when down payment is tight or credit needs more flexibility. Mortgage insurance applies. If you'd rather avoid that, conventional with 5% down is another path. Which feels more important to you — lowest down payment, or no mortgage insurance?"

BAD: "You qualify for an FHA loan at 7.5%!" (NEVER quote rates, never promise qualification)

BAD: "I recommend Lender XYZ's super-saver program." (NEVER name specific lenders to borrowers)

BAD: "Let me ask you a series of questions: what's your income, what's your debt, what's your credit..." (NEVER batch questions; ask one at a time)
`.trim();
}

// -----------------------------------------------------------------------------
// Team command system prompt (preserved from previous version)
// -----------------------------------------------------------------------------

function buildTeamCommandSystemPrompt(
  stage: string | undefined,
  routing: RoutingPayload | undefined,
  catalogContext: string
): string {
  const facts = {
    source: safeString(routing?.source),
    fileId: safeString(routing?.fileId),
    borrowerName: safeString(routing?.borrowerName),
    loanOfficer: safeString(routing?.loanOfficer),
    processor: safeString(routing?.processor),
    purpose: safeString(routing?.purpose),
    occupancy: safeString(routing?.occupancy),
    amount: safeString(routing?.amount),
    targetCloseDate: safeString(routing?.targetCloseDate),
    stageLabel: safeString(routing?.stageLabel),
    priority: safeString(routing?.priority),
    blocker: safeString(routing?.blocker),
    nextInternalAction: safeString(routing?.nextInternalAction),
    nextBorrowerAction: safeString(routing?.nextBorrowerAction),
  };

  return `
You are Finley Beyond inside the Beyond Intelligence Team Command Center, advising mortgage professionals — not borrowers.

${buildStageInstruction(stage)}

# YOUR ROLE

You speak as an experienced mortgage operations strategist. The audience is a loan officer, processor, assistant, or production manager. They want crisp, practical, operational answers.

# RULES

- Be precise, concise, operational.
- You MAY name lenders, programs, and overlays here — this is internal.
- NEVER promise loan approval or final eligibility.
- NEVER present rates as final.
- DO NOT invent missing facts. If a file is incomplete, say so.
- Speak in short paragraphs and compact bullets.

# BEYOND INTELLIGENCE LENDER CATALOG

${catalogContext}

# CURRENT FILE CONTEXT

- Source: ${facts.source || "team command center"}
- File ID: ${facts.fileId || "missing"}
- Borrower Name: ${facts.borrowerName || "missing"}
- Loan Officer: ${facts.loanOfficer || "missing"}
- Processor: ${facts.processor || "missing"}
- Purpose: ${facts.purpose || "missing"}
- Occupancy: ${facts.occupancy || "missing"}
- Amount: ${facts.amount || "missing"}
- Target Close Date: ${facts.targetCloseDate || "missing"}
- Stage: ${facts.stageLabel || "missing"}
- Priority: ${facts.priority || "missing"}
- Blocker: ${facts.blocker || "missing"}
- Next Internal Action: ${facts.nextInternalAction || "missing"}
- Next Borrower Action: ${facts.nextBorrowerAction || "missing"}

# RESPONSE STRUCTURE

When asked about the file, structure your answer:
1. Quick read of where the file sits.
2. Risk or delay points.
3. Missing documentation or weak areas.
4. Best next internal action.
5. Borrower-facing wording if useful.
6. Possible program directions at a high level — final fit depends on guidelines, overlays, and review.
`.trim();
}

function buildSystemPrompt(
  stage: string | undefined,
  routing: RoutingPayload | undefined,
  catalogContext: string
): string {
  if (stage === "team_command") {
    return buildTeamCommandSystemPrompt(stage, routing, catalogContext);
  }
  return buildBorrowerSystemPrompt(stage, routing, catalogContext);
}

// -----------------------------------------------------------------------------
// Model routing — choose between OpenAI and Claude
// -----------------------------------------------------------------------------

function shouldUseClaude(messages: IncomingMessage[]): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return false;

  const content = lastUser.content;
  // Escalate to Claude if message is long, contains multiple questions,
  // or asks about complex topics that benefit from careful reasoning.
  const isLong = content.length > 280;
  const multipleQuestions = (content.match(/\?/g) || []).length >= 2;
  const complexKeywords = [
    "self-employed",
    "self employed",
    "1099",
    "bankruptcy",
    "foreclosure",
    "short sale",
    "non-qm",
    "non qm",
    "bank statement",
    "dscr",
    "itin",
    "foreign national",
    "visa",
    "green card",
    "tax return",
    "schedule c",
    "k-1",
    "k1",
    "trust",
    "non-warrantable",
    "condotel",
    "manufactured",
    "rural",
    "guideline",
    "overlay",
  ];
  const hasComplexTopic = complexKeywords.some((k) =>
    content.toLowerCase().includes(k)
  );

  return isLong || multipleQuestions || hasComplexTopic;
}

async function callOpenAI(
  systemPrompt: string,
  messages: IncomingMessage[],
  stage: string | undefined
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: stage === "team_command" ? 0.2 : 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error?.message || data?.message || "OpenAI request failed."
    );
  }

  return (
    data?.choices?.[0]?.message?.content?.trim() ||
    "Thank you. Your assigned loan officer will review the scenario and advise the next steps."
  );
}

async function callClaude(
  systemPrompt: string,
  messages: IncomingMessage[]
): Promise<string> {
  // Anthropic uses a different API shape — system prompt is separate,
  // and the messages array can only contain user/assistant turns.
  const claudeMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0.4,
      system: systemPrompt,
      messages: claudeMessages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error?.message || data?.message || "Claude request failed."
    );
  }

  // Claude returns content as an array of content blocks
  const blocks = data?.content;
  if (Array.isArray(blocks) && blocks.length > 0) {
    const textBlock = blocks.find((b) => b?.type === "text");
    if (textBlock?.text) return String(textBlock.text).trim();
  }

  return "Thank you. Your assigned loan officer will review the scenario and advise the next steps.";
}

// -----------------------------------------------------------------------------
// Resolve a borrower-picker email to a real team_users.id.
// -----------------------------------------------------------------------------
//
// The borrower picker surfaces officers from a different identity space than
// the team_users table where our FK points (legacy: users / employees / etc).
// So we cannot trust the id the client hands us — instead we resolve by email,
// which IS unique on team_users. If no match, return null and let the caller
// store loan_officer_id as null. The full picker payload still survives on
// extracted_payload.selectedOfficer for downstream reference.
//
// Best-effort: any DB hiccup returns null. Persistence path is non-blocking.
//
async function resolveTeamUserIdByEmail(
  email: string | null | undefined
): Promise<string | null> {
  const e = safeString(email).toLowerCase();
  if (!e) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from("team_users")
      .select("id")
      .eq("email", e)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Persistence — write the borrower conversation to borrower_intake_sessions.
// -----------------------------------------------------------------------------
//
// Best-effort. If anything goes wrong, we log the error and return null —
// the chat reply is sacred and must never be blocked by a DB hiccup.
//
// Behavior:
//   - team_command stage is the /finley professional flow; skip persistence
//     (those land in professional_chat_sessions in a future step).
//   - If routing.intakeSessionId is a valid UUID, UPDATE that row.
//   - Otherwise INSERT a new row and return its id.
//   - Status is always 'submitted' from creation: there is no chat turn that
//     happens before Run Preliminary Review in the borrower flow.
//
async function persistConversation(
  stage: string | undefined,
  routing: RoutingPayload | undefined,
  reply: string
): Promise<string | null> {
  if (stage === "team_command") return null;
  if (!routing) return null;

  try {
    const sessionId = isUuid(routing.intakeSessionId)
      ? (routing.intakeSessionId as string)
      : null;

    // routing.conversation is the full borrower/assistant history sent up
    // by the client. We append the freshly-generated assistant reply and
    // overwrite the row's messages JSONB with the result. Client state is
    // the source of truth — this is a mirror.
    const ts = new Date().toISOString();
    const incoming = Array.isArray(routing.conversation)
      ? routing.conversation
          .filter(
            (m) =>
              m &&
              typeof m.content === "string" &&
              (m.role === "user" || m.role === "assistant")
          )
          .map((m) => ({ role: m.role, content: m.content, ts }))
      : [];
    const fullMessages = [
      ...incoming,
      { role: "assistant", content: reply, ts },
    ];

    const borrower = routing.borrower ?? {};
    const realtor = routing.selectedRealtor ?? null;
    const officer = routing.selectedOfficer ?? null;
    const { first: firstName, last: lastName } = splitName(
      safeString(borrower.name)
    );
    const language = (() => {
      const l = safeString(routing.language).toLowerCase();
      return l === "pt" || l === "es" ? l : "en";
    })();

    // Resolve picker ids to real team_users.id values via email lookup.
    // The picker's officer.id comes from a different identity space and
    // would violate the FK. We trust the email instead. If no match → null,
    // and we still persist the row (full picker object survives on
    // extracted_payload.selectedOfficer).
    const officerEmail = officer ? safeString(officer.email) : "";
    const assistantEmail = officer ? safeString(officer.assistantEmail) : "";
    const [resolvedOfficerId, resolvedAssistantId] = await Promise.all([
      resolveTeamUserIdByEmail(officerEmail),
      resolveTeamUserIdByEmail(assistantEmail),
    ]);

    const extractedPayload = {
      borrower,
      scenario: routing.scenario ?? {},
      borrowerPath: routing.borrowerPath ?? null,
      targetState: routing.targetState ?? null,
      currentState: routing.currentState ?? null,
      realtorStatus: routing.realtorStatus ?? null,
      selectedOfficer: officer,
      selectedRealtor: realtor,
    };

    const baseRow = {
      status: "submitted" as const,
      language,
      borrower_first_name: firstName,
      borrower_last_name: lastName,
      borrower_email: safeString(borrower.email) || null,
      borrower_phone: null as string | null,
      borrower_state: safeString(routing.targetState) || null,
      has_realtor: realtor !== null && realtor !== undefined,
      realtor_name: realtor ? safeString(realtor.name) || null : null,
      realtor_email: realtor ? safeString(realtor.email) || null : null,
      realtor_phone: realtor ? safeString(realtor.phone) || null : null,
      loan_officer_id: resolvedOfficerId,
      lo_assistant_id: resolvedAssistantId,
      messages: fullMessages,
      extracted_payload: extractedPayload,
    };

    if (sessionId) {
      const { error } = await supabaseAdmin
        .from("borrower_intake_sessions")
        .update(baseRow)
        .eq("id", sessionId);

      if (error) {
        console.error("persistConversation: UPDATE failed", error);
        return null;
      }
      return sessionId;
    }

    const { data, error } = await supabaseAdmin
      .from("borrower_intake_sessions")
      .insert(baseRow)
      .select("id")
      .single();

    if (error || !data) {
      console.error("persistConversation: INSERT failed", error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.error("persistConversation: unexpected error", err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const stage = body?.stage;
    const routing = body?.routing;
    const incomingMessages = normalizeMessages(body?.messages);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing OPENAI_API_KEY. Add it in Vercel Project Settings > Environment Variables.",
        },
        { status: 500 }
      );
    }

    if (!incomingMessages.length) {
      return NextResponse.json(
        { success: false, error: "No chat messages were provided." },
        { status: 400 }
      );
    }

    // Load lender catalog summary (best-effort — non-fatal on failure)
    const catalog = await loadLenderCatalogSummary();
    const catalogContext = renderCatalogContext(catalog);

    const systemPrompt = buildSystemPrompt(stage, routing, catalogContext);

    // Decide which model to use
    const useClaude = shouldUseClaude(incomingMessages);
    let reply: string;
    let modelUsed: "openai-gpt-4o-mini" | "claude-sonnet-4";

    try {
      if (useClaude) {
        reply = await callClaude(systemPrompt, incomingMessages);
        modelUsed = "claude-sonnet-4";
      } else {
        reply = await callOpenAI(systemPrompt, incomingMessages, stage);
        modelUsed = "openai-gpt-4o-mini";
      }
    } catch (primaryError) {
      // If the primary model fails, fall back to OpenAI as a safety net.
      console.error(
        "chat: primary model failed, falling back to OpenAI.",
        primaryError
      );
      reply = await callOpenAI(systemPrompt, incomingMessages, stage);
      modelUsed = "openai-gpt-4o-mini";
    }

    return NextResponse.json({
      success: true,
      reply,
      meta: {
        model: modelUsed,
        catalogProgramCount: catalog?.programCount || 0,
        catalogLenderCount: catalog?.lenderCount || 0,
        intakeSessionId: await persistConversation(stage, routing, reply),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error in /api/chat.",
      },
      { status: 500 }
    );
  }
}
