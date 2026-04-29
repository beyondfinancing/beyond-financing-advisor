// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/finley/page.tsx
//
// =============================================================================
//
// PROGRAM-FIRST GROUPED RESULTS UI
//
// Changes vs. the prior version:
//
//   1. Match results now group by PROGRAM at the top level rather than
//      flat-listing every (lender x program) combination. With ~19
//      wholesale lenders x ~26 agency programs, the previous flat list
//      produced ~500 nearly-identical cards. The new layout collapses
//      to ~26 program rows (Strong) / ~10 (Eliminated), each expandable
//      inline to show the lenders offering that program.
//
//   2. Three render levels:
//        L1 - Program row: program name, best score across lenders,
//             lender count, blocker (eliminated only).
//        L2 - Click program -> inline list of lenders for that program
//             with individual scores + "View Details" button per lender.
//        L3 - Click "View Details" -> existing per-lender detail panel
//             (explanation, strengths, concerns, notes, missing items,
//             blockers) - UNCHANGED behavior from prior version.
//
//   3. Sort within bucket: best score desc -> lender count desc ->
//      program name alpha. Sort within program group: score desc ->
//      lender name alpha.
//
//   4. Group key: guideline_id || program_slug || program_name.
//      Display label: program_name.
//
//   5. State additions: expandedPrograms (separate from expandedCards
//      to avoid collisions). Both reset on new match run.
//
//   6. renderBucketCard is unchanged EXCEPT for one line: the cardKey
//      now includes lender_id (or lender_name) to ensure each lender's
//      "View Details" toggle is independent. Without this, cards
//      sharing the same guideline_id would expand as a group.
//
// Auth, intake form, /api/match integration, scoring pills, OpenAI
// enhancement panel, Email My Summary, conversation panel, and all
// styling outside the results section remain unchanged.
//
// =============================================================================

"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type BorrowerStatus =
  | ""
  | "citizen"
  | "permanent_resident"
  | "non_permanent_resident"
  | "itin_borrower"
  | "daca"
  | "foreign_national";

type OccupancyType =
  | ""
  | "primary_residence"
  | "second_home"
  | "investment_property";

type TransactionType =
  | ""
  | "purchase"
  | "rate_term_refinance"
  | "cash_out_refinance"
  | "second_lien";

type IncomeType =
  | ""
  | "full_doc"
  | "express_doc"
  | "bank_statements"
  | "1099"
  | "pnl"
  | "asset_utilization"
  | "dscr"
  | "no_ratio"
  | "wvoe";

type PropertyType =
  | ""
  | "single_family"
  | "condo"
  | "townhouse"
  | "2_unit"
  | "3_unit"
  | "4_unit"
  | "mixed_use"
  | "5_to_8_units";

type QualificationInput = {
  subject_state: string;
  borrower_status: BorrowerStatus;
  occupancy_type: OccupancyType;
  transaction_type: TransactionType;
  income_type: IncomeType;
  property_type: PropertyType;
  credit_score: string;
  ltv: string;
  dti: string;
  loan_amount: string;
  units: string;
  first_time_homebuyer: "" | "yes" | "no";
  available_reserves_months: string;
};

type MatchBucket = {
  lender_name?: string;
  lender_id?: string;
  program_name?: string;
  program_slug?: string;
  loan_category?: string | null;
  guideline_id?: string;
  notes?: string[] | null;
  missing_items?: string[] | null;
  blockers?: string[] | null;
  strengths?: string[] | null;
  concerns?: string[] | null;
  explanation?: string;
  score?: number;
  required_reserves_months?: number | null;
};

type ProgramGroup = {
  groupKey: string;
  programName: string;
  loanCategory: string | null;
  guidelineId: string;
  bestScore: number;
  lenderCount: number;
  blocker: string | null;
  items: MatchBucket[];
};

type OpenAiEnhancement = {
  topRecommendation?: string;
  whyItMatches?: string[] | null;
  cautionItems?: string[] | null;
  nextBestQuestion?: string;
} | null;

type MatchResponse = {
  success: boolean;
  error?: string;
  next_question?: string;
  top_recommendation?: string;
  openai_enhancement?: OpenAiEnhancement;
  strong_matches?: MatchBucket[] | null;
  conditional_matches?: MatchBucket[] | null;
  eliminated_paths?: MatchBucket[] | null;
  lender_summary?: {
    active_lender_count?: number;
    active_lenders_checked?: string[];
    matched_lenders_in_results?: string[];
  } | null;
  summary?: {
    total_guidelines_checked?: number;
    strong_count?: number;
    conditional_count?: number;
    eliminated_count?: number;
  };
};

type ProfessionalSession = {
  isAuthenticated?: boolean;
  role?: string;
  name?: string;
  email?: string;
  nmls?: string;
} | null;

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

// Borrower-side transcript turn shape. Roles can include values beyond
// user/assistant (the borrower flow may persist system or tool turns),
// so we keep role as a permissive string and filter when rendering.
type TranscriptTurn = {
  role: string;
  content: string;
  ts?: string | null;
};

const PROFESSIONAL_LOGIN_PATH = "/team";
const BORROWER_MODE_PATH = "/borrower";
const SUMMARY_ROUTE = "/api/chat-summary";

const initialForm: QualificationInput = {
  subject_state: "",
  borrower_status: "",
  occupancy_type: "",
  transaction_type: "",
  income_type: "",
  property_type: "",
  credit_score: "",
  ltv: "",
  dti: "",
  loan_amount: "",
  units: "",
  first_time_homebuyer: "",
  available_reserves_months: "",
};

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function labelize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toBooleanOrEmpty(value: "" | "yes" | "no"): "" | boolean {
  if (value === "") return "";
  return value === "yes";
}

function normalizeNumberInput(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function buildChatSummary(data: MatchResponse): string {
  const strong = safeArray(data.strong_matches);
  const conditional = safeArray(data.conditional_matches);
  const eliminated = safeArray(data.eliminated_paths);
  const ai = data.openai_enhancement;

  if (!data.success) {
    return data.error || "Match request failed.";
  }

  if (ai?.topRecommendation) {
    const nextQuestion = ai.nextBestQuestion || data.next_question || "";
    return `${ai.topRecommendation}${nextQuestion ? ` ${nextQuestion}` : ""}`.trim();
  }

  if (strong.length > 0) {
    const top = strong[0];
    return `I found ${strong.length} strong match(es). The leading direction is ${
      top.program_name || "a program"
    } with ${top.lender_name || "a lender"}. ${
      data.next_question || "Please continue with the next missing qualification detail."
    }`.trim();
  }

  if (conditional.length > 0) {
    return `I found ${conditional.length} conditional path(s). We are close, but I still need more qualification detail before presenting a stronger direction. ${
      data.next_question || ""
    }`.trim();
  }

  if (eliminated.length > 0) {
    return `The currently loaded guidelines appear to eliminate the visible paths for this exact combination so far. ${
      data.next_question || "Please adjust or confirm the qualification data so I can reassess."
    }`.trim();
  }

  return (
    data.next_question ||
    ai?.nextBestQuestion ||
    "No visible paths were identified yet. Please confirm the next qualification detail."
  );
}

// ---------------------------------------------------------------------------
// groupByProgram
//
// Collapses a flat list of (lender x program) match items into one row per
// distinct program. Each group carries the best score across lenders, the
// lender count, and (for eliminated bucket) the first non-empty blocker.
//
// Group key precedence: guideline_id > program_slug > program_name. The
// display label is always program_name.
//
// Group sort: bestScore desc -> lenderCount desc -> programName alpha.
// Within-group sort: score desc -> lender_name alpha.
// ---------------------------------------------------------------------------
function groupByProgram(items: MatchBucket[]): ProgramGroup[] {
  const map = new Map<string, ProgramGroup>();

  for (const item of items) {
    const groupKey =
      item.guideline_id ||
      item.program_slug ||
      item.program_name ||
      "unknown_program";
    const programName = item.program_name || "Unknown Program";
    const loanCategory = item.loan_category ?? null;
    const guidelineId = item.guideline_id || "";
    const score = item.score ?? 0;
    const firstBlocker = safeArray(item.blockers)[0] || null;

    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        programName,
        loanCategory,
        guidelineId,
        bestScore: score,
        lenderCount: 1,
        blocker: firstBlocker,
        items: [item],
      });
    } else {
      existing.bestScore = Math.max(existing.bestScore, score);
      existing.lenderCount += 1;
      if (!existing.blocker && firstBlocker) {
        existing.blocker = firstBlocker;
      }
      existing.items.push(item);
    }
  }

  // Sort items within each group: score desc, then lender name alpha
  for (const group of map.values()) {
    group.items.sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.lender_name || "").localeCompare(b.lender_name || "");
    });
  }

  // Sort groups: bestScore desc, then lenderCount desc, then programName alpha
  return Array.from(map.values()).sort((a, b) => {
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    if (b.lenderCount !== a.lenderCount) return b.lenderCount - a.lenderCount;
    return a.programName.localeCompare(b.programName);
  });
}

function renderList(title: string, items: string[]) {
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <strong>{title}</strong>
      <ul style={{ marginTop: 8, paddingLeft: 18 }}>
        {items.map((text, i) => (
          <li key={`${title}-${i}`}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function getFieldDisplayValue(form: QualificationInput, key: keyof QualificationInput) {
  const value = form[key];

  if (typeof value !== "string") return "";
  if (!value.trim()) return "";

  if (key === "first_time_homebuyer") {
    return value === "yes" ? "Yes" : value === "no" ? "No" : "";
  }

  return labelize(value);
}

function getMissingFields(form: QualificationInput) {
  const orderedFields: { key: keyof QualificationInput; label: string }[] = [
    { key: "subject_state", label: "subject state" },
    { key: "borrower_status", label: "borrower status" },
    { key: "occupancy_type", label: "occupancy type" },
    { key: "transaction_type", label: "transaction type" },
    { key: "income_type", label: "income type" },
    { key: "property_type", label: "property type" },
    { key: "credit_score", label: "credit score" },
    { key: "ltv", label: "LTV" },
    { key: "dti", label: "DTI" },
    { key: "loan_amount", label: "loan amount" },
    { key: "units", label: "units" },
    { key: "first_time_homebuyer", label: "first-time homebuyer status" },
    {
      key: "available_reserves_months",
      label: "available reserves in months of PITIA",
    },
  ];

  return orderedFields.filter(({ key }) => {
    const value = form[key];
    return typeof value === "string" ? value.trim() === "" : !value;
  });
}

function getGuidedAssistantReply(
  form: QualificationInput,
  nextQuestion: string,
  strongMatches: MatchBucket[],
  conditionalMatches: MatchBucket[]
) {
  const missing = getMissingFields(form);

  if (missing.length === 0) {
    if (strongMatches.length > 0) {
      const top = strongMatches[0];
      return `You already have the core qualification fields loaded. Based on the current visible results, the leading direction is ${
        top.program_name || "the top matched program"
      } with ${top.lender_name || "the matched lender"}. I recommend reviewing the strong match details, missing items, and reserves requirement before moving the file forward.`;
    }

    if (conditionalMatches.length > 0) {
      return `You already have the core qualification fields loaded. The scenario is currently landing in conditional paths, so the next step is to review the missing items, concerns, and program-specific blockers to strengthen the file presentation.`;
    }

    return `The core qualification fields are already loaded. The next step is to refine the scenario by reviewing current lender responses, blockers, and any compensating factors that may improve the file direction.`;
  }

  const nextMissing = missing[0];
  const capturedExamples = [
    form.subject_state ? `state: ${getFieldDisplayValue(form, "subject_state")}` : "",
    form.borrower_status
      ? `borrower status: ${getFieldDisplayValue(form, "borrower_status")}`
      : "",
    form.occupancy_type
      ? `occupancy: ${getFieldDisplayValue(form, "occupancy_type")}`
      : "",
    form.transaction_type
      ? `transaction: ${getFieldDisplayValue(form, "transaction_type")}`
      : "",
    form.income_type ? `income: ${getFieldDisplayValue(form, "income_type")}` : "",
    form.property_type
      ? `property: ${getFieldDisplayValue(form, "property_type")}`
      : "",
    form.credit_score ? `credit score: ${form.credit_score}` : "",
    form.ltv ? `LTV: ${form.ltv}` : "",
    form.dti ? `DTI: ${form.dti}` : "",
    form.loan_amount ? `loan amount: ${form.loan_amount}` : "",
  ].filter(Boolean);

  const capturedText =
    capturedExamples.length > 0
      ? `I already have ${capturedExamples.join(", ")}. `
      : "";

  const resolvedNextQuestion =
    nextQuestion ||
    `What is the ${nextMissing.label} for this scenario so I can narrow the lender and program fit more precisely?`;

  return `${capturedText}${resolvedNextQuestion}`;
}

function buildSummaryPayload(args: {
  professionalSession: ProfessionalSession;
  form: QualificationInput;
  strongMatches: MatchBucket[];
  conditionalMatches: MatchBucket[];
  eliminatedPaths: MatchBucket[];
  nextQuestion: string;
  topRecommendation: string;
  openAiEnhancement: OpenAiEnhancement;
  chatMessages: ChatMessage[];
}) {
  const {
    professionalSession,
    form,
    strongMatches,
    conditionalMatches,
    eliminatedPaths,
    nextQuestion,
    topRecommendation,
    openAiEnhancement,
    chatMessages,
  } = args;

  const borrowerSummary = [
    `Professional user: ${professionalSession?.name || "Unknown"}`,
    professionalSession?.role ? `Role: ${professionalSession.role}` : "",
    professionalSession?.nmls ? `NMLS: ${professionalSession.nmls}` : "",
    professionalSession?.email ? `Email: ${professionalSession.email}` : "",
    "",
    "Scenario intake:",
    `Subject state: ${form.subject_state || "Not provided"}`,
    `Borrower status: ${labelize(form.borrower_status)}`,
    `Occupancy type: ${labelize(form.occupancy_type)}`,
    `Transaction type: ${labelize(form.transaction_type)}`,
    `Income type: ${labelize(form.income_type)}`,
    `Property type: ${labelize(form.property_type)}`,
    `Credit score: ${form.credit_score || "Not provided"}`,
    `LTV: ${form.ltv || "Not provided"}`,
    `DTI: ${form.dti || "Not provided"}`,
    `Loan amount: ${form.loan_amount || "Not provided"}`,
    `Units: ${form.units || "Not provided"}`,
    `First-time homebuyer: ${
      form.first_time_homebuyer
        ? form.first_time_homebuyer === "yes"
          ? "Yes"
          : "No"
        : "Not provided"
    }`,
    `Available reserves months: ${
      form.available_reserves_months || "Not provided"
    }`,
    "",
    strongMatches.length > 0
      ? `Strong matches: ${strongMatches
          .map(
            (item) =>
              `${item.program_name || "Unknown Program"} - ${item.lender_name || "Unknown Lender"}`
          )
          .join("; ")}`
      : "Strong matches: None",
    conditionalMatches.length > 0
      ? `Conditional matches: ${conditionalMatches
          .map(
            (item) =>
              `${item.program_name || "Unknown Program"} - ${item.lender_name || "Unknown Lender"}`
          )
          .join("; ")}`
      : "Conditional matches: None",
    eliminatedPaths.length > 0
      ? `Eliminated paths: ${eliminatedPaths
          .map(
            (item) =>
              `${item.program_name || "Unknown Program"} - ${item.lender_name || "Unknown Lender"}`
          )
          .join("; ")}`
      : "Eliminated paths: None",
  ]
    .filter(Boolean)
    .join("\n");

  const likelyDirection =
    topRecommendation ||
    openAiEnhancement?.topRecommendation ||
    (strongMatches[0]
      ? `${strongMatches[0].program_name || "Program"} with ${
          strongMatches[0].lender_name || "Lender"
        }`
      : conditionalMatches[0]
      ? `${conditionalMatches[0].program_name || "Conditional program path"} with ${
          conditionalMatches[0].lender_name || "Lender"
        }`
      : "No clear program direction yet");

  const strengths = [
    ...safeArray(openAiEnhancement?.whyItMatches),
    ...safeArray(strongMatches[0]?.strengths),
  ].filter(Boolean);

  const openQuestions = [
    ...getMissingFields(form).map((item) => item.label),
    nextQuestion || "",
  ].filter(Boolean);

  const provisionalPrograms = [
    ...strongMatches.map(
      (item) =>
        `${item.program_name || "Unknown Program"} — ${item.lender_name || "Unknown Lender"}`
    ),
    ...conditionalMatches.map(
      (item) =>
        `${item.program_name || "Unknown Program"} — ${item.lender_name || "Unknown Lender"}`
    ),
  ].filter(Boolean);

  const loanOfficerActionPlan = [
    "Review the current match results and determine the strongest lender/program direction.",
    "Confirm missing qualification details and documentation.",
    "Review conditional matches, blockers, concerns, and reserves requirements.",
    "Validate final eligibility directly against the applicable lender or investor guide before issuing advice or decisioning.",
  ];

  return {
    lead: {
      fullName: professionalSession?.name || "Professional User",
      email: professionalSession?.email || "",
      phone: "",
      preferredLanguage: "English" as const,
      loanOfficer: professionalSession?.name || "Professional User",
      assignedEmail: professionalSession?.email || "",
      recipientEmail: professionalSession?.email || "",
      professionalName: professionalSession?.name || "Professional User",
      professionalRole: professionalSession?.role || "Professional",
      mode: "professional" as const,
    },
    trigger: "professional" as const,
    messages: chatMessages,
    summary: {
      borrowerSummary,
      likelyDirection,
      strengths,
      openQuestions,
      provisionalPrograms,
      recommendedNextStep:
        nextQuestion ||
        "Review the current file, collect the next missing detail, and validate lender-specific fit.",
      loanOfficerActionPlan,
    },
  };
}

// Inner component holds all the page logic. Wrapped in <Suspense> by the
// default export below — required by Next.js 15+ when using useSearchParams,
// because that hook opts the subtree out of static prerender and Next needs
// a fallback boundary to prerender around it.
function FinleyPageInner() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [professionalSession, setProfessionalSession] =
    useState<ProfessionalSession>(null);

  const [form, setForm] = useState<QualificationInput>(initialForm);
  const [loading, setLoading] = useState(false);
  const [emailingSummary, setEmailingSummary] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [nextQuestion, setNextQuestion] = useState(
    "Run the qualification match first. Finley will then identify the next best question and explain which lender and program paths remain viable."
  );
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [strongMatches, setStrongMatches] = useState<MatchBucket[]>([]);
  const [conditionalMatches, setConditionalMatches] = useState<MatchBucket[]>([]);
  const [eliminatedPaths, setEliminatedPaths] = useState<MatchBucket[]>([]);
  const [topRecommendation, setTopRecommendation] = useState("");
  const [openAiEnhancement, setOpenAiEnhancement] =
    useState<OpenAiEnhancement>(null);
  const [lenderSummary, setLenderSummary] =
    useState<MatchResponse["lender_summary"]>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [expandedPrograms, setExpandedPrograms] = useState<Record<string, boolean>>({});

  // ---------------------------------------------------------------------------
  // Step 4 (Drop 1) of Pro Handoff — when /finley is opened with ?session=<uuid>
  // (typically via the /handoff/[token] receiver), hydrate the qualification
  // form with whatever the borrower already provided. Drop 1 only pre-fills
  // the form — Drop 2 adds the borrower transcript panel and pro chat UI on
  // top. The pro chat session is upserted server-side regardless so it's
  // ready when Drop 2 lands.
  // ---------------------------------------------------------------------------
  const searchParams = useSearchParams();
  const handoffSessionId = searchParams.get("session");
  const [handoffHydrated, setHandoffHydrated] = useState(false);
  const [handoffBorrowerName, setHandoffBorrowerName] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Step 4 (Drop 2) — Pro Mode tabbed right column state.
  //
  // proSessionId / proMessages / borrowerTranscript come from the same
  // hydrate call that pre-fills the form (already shipped in Drop 1).
  // activeRightTab toggles the right-column conversation area between the
  // LO's private chat with Finley about this file and the verbatim borrower
  // transcript. proInput / proSending / proError manage the live send loop.
  // None of this state is touched when ?session= is absent — direct visits
  // to /finley render the existing UX unchanged.
  // ---------------------------------------------------------------------------
  const [proSessionId, setProSessionId] = useState<string | null>(null);
  const [proMessages, setProMessages] = useState<ChatMessage[]>([]);
  const [borrowerTranscript, setBorrowerTranscript] = useState<TranscriptTurn[]>([]);
  const [activeRightTab, setActiveRightTab] = useState<
    "pro_chat" | "borrower_transcript"
  >("pro_chat");
  const [proInput, setProInput] = useState("");
  const [proSending, setProSending] = useState(false);
  const [proError, setProError] = useState("");

  // ---------------------------------------------------------------------------
  // Auth — verify cookie session via /api/team-auth/me, then guard by role.
  // Real Estate Agents are explicitly excluded from the Professional Thinking
  // Layer; they should not see lender or program matching.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const ALLOWED_ROLES = [
      "Loan Officer",
      "Loan Officer Assistant",
      "Branch Manager",
      "Production Manager",
      "Processor",
    ];

    const verifySession = async () => {
      try {
        const response = await fetch("/api/team-auth/me");

        if (!response.ok) {
          router.replace(PROFESSIONAL_LOGIN_PATH);
          return;
        }

        const data = await response.json();

        if (!data?.authenticated || !data?.user) {
          router.replace(PROFESSIONAL_LOGIN_PATH);
          return;
        }

        if (!ALLOWED_ROLES.includes(data.user.role)) {
          // Authenticated but role not authorized for this page.
          // Bounce back to /team — they'll see the team dashboard or
          // the login form depending on their session state.
          router.replace(PROFESSIONAL_LOGIN_PATH);
          return;
        }

        setProfessionalSession({
          isAuthenticated: true,
          role: data.user.role,
          name: data.user.name,
          email: data.user.email,
          nmls: data.user.nmls,
        });
        setAuthChecked(true);
      } catch {
        router.replace(PROFESSIONAL_LOGIN_PATH);
      }
    };

    void verifySession();
  }, [router]);

  // ---------------------------------------------------------------------------
  // Step 4 (Drop 1) — pre-fill the qualification form from a borrower intake
  // session. Only direct-correspondence fields get mapped (state, transaction
  // type, loan amount, ltv). All other fields are inferred during the live
  // borrower conversation rather than explicitly captured, so they stay
  // blank for the LO to verify and complete.
  //
  // Runs once after auth passes and only when ?session= is present. Refuses
  // to overwrite fields the LO has already started editing if they navigated
  // to the URL directly with the form already populated.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authChecked) return;
    if (!handoffSessionId) return;
    if (handoffHydrated) return;

    let cancelled = false;
    const hydrate = async () => {
      try {
        const res = await fetch(
          `/api/handoff-session/${encodeURIComponent(handoffSessionId)}`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          session?: {
            borrowerName?: string | null;
            borrowerState?: string | null;
          };
          extractedPayload?: {
            borrowerPath?: string | null;
            scenario?: {
              homePrice?: string | number | null;
              downPayment?: string | number | null;
              estimatedLoanAmount?: string | null;
            };
          };
          transcript?: TranscriptTurn[] | null;
          proSession?: {
            id?: string;
            messages?: ChatMessage[] | null;
          };
        };

        if (cancelled) return;

        const sess = data.session ?? {};
        const ext = data.extractedPayload ?? {};
        const scenario = ext.scenario ?? {};

        // Map borrowerPath → transaction_type. Borrower's "Investment" is
        // a purchase that's investment-occupancy; treat as purchase here.
        const tx =
          ext.borrowerPath === "Refinance"
            ? "rate_term_refinance"
            : ext.borrowerPath === "Purchase" ||
                ext.borrowerPath === "Investment"
              ? "purchase"
              : "";

        // Derive numeric loan amount + LTV from scenario when both home
        // price and down payment are present.
        const home = Number(scenario.homePrice || 0);
        const down = Number(scenario.downPayment || 0);
        const loanAmt =
          home > 0 && down >= 0 && down <= home
            ? Math.round(home - down)
            : Number(scenario.estimatedLoanAmount || 0) || 0;
        const ltvPct =
          home > 0 && loanAmt > 0
            ? Math.min(100, Math.round((loanAmt / home) * 100))
            : 0;

        setForm((prev) => ({
          ...prev,
          subject_state: prev.subject_state || sess.borrowerState || "",
          transaction_type:
            prev.transaction_type ||
            (tx as QualificationInput["transaction_type"]),
          loan_amount: prev.loan_amount || (loanAmt > 0 ? String(loanAmt) : ""),
          ltv: prev.ltv || (ltvPct > 0 ? String(ltvPct) : ""),
        }));

        setHandoffBorrowerName(sess.borrowerName ?? null);

        // Drop 2: capture pro session id, prior pro messages, and the
        // verbatim borrower transcript so the right-column tabs render
        // immediately on mount instead of waiting for first interaction.
        // Drop 1 already returns these fields — we just stopped discarding
        // them.
        const proSess = data.proSession ?? {};
        setProSessionId(proSess.id ?? null);
        setProMessages(Array.isArray(proSess.messages) ? proSess.messages : []);
        setBorrowerTranscript(
          Array.isArray(data.transcript) ? data.transcript : []
        );

        setHandoffHydrated(true);
      } catch (err) {
        console.error("[finley] hydrate from handoff failed", err);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [authChecked, handoffSessionId, handoffHydrated]);

  const hasResults =
    strongMatches.length > 0 ||
    conditionalMatches.length > 0 ||
    eliminatedPaths.length > 0;

  const summaryText = useMemo(() => {
    return {
      strong: strongMatches.length,
      conditional: conditionalMatches.length,
      eliminated: eliminatedPaths.length,
    };
  }, [strongMatches, conditionalMatches, eliminatedPaths]);

  const matchedLenders = useMemo(() => {
    const all = [
      ...strongMatches.map((x) => x.lender_name || ""),
      ...conditionalMatches.map((x) => x.lender_name || ""),
      ...eliminatedPaths.map((x) => x.lender_name || ""),
    ].filter(Boolean);

    return Array.from(new Set(all));
  }, [strongMatches, conditionalMatches, eliminatedPaths]);

  const missingFields = useMemo(() => getMissingFields(form), [form]);

  const groupedStrong = useMemo(
    () => groupByProgram(strongMatches),
    [strongMatches]
  );
  const groupedConditional = useMemo(
    () => groupByProgram(conditionalMatches),
    [conditionalMatches]
  );
  const groupedEliminated = useMemo(
    () => groupByProgram(eliminatedPaths),
    [eliminatedPaths]
  );

  function updateField<K extends keyof QualificationInput>(
    key: K,
    value: QualificationInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goToBorrowerMode() {
    router.push(BORROWER_MODE_PATH);
  }

  // ---------------------------------------------------------------------------
  // Logout — clears the server-side session via /api/team-auth/logout, then
  // redirects to /team. Proceeds with the redirect even if the server call
  // fails so the user is never stranded on a page they can no longer use.
  // ---------------------------------------------------------------------------
  async function logoutProfessional() {
    try {
      await fetch("/api/team-auth/logout", { method: "POST" });
    } catch {
      // Proceed with the redirect even if the server-side logout call fails.
    }
    router.replace(PROFESSIONAL_LOGIN_PATH);
  }

  async function runQualificationMatch() {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        subject_state: form.subject_state.trim().toUpperCase(),
        borrower_status: form.borrower_status,
        occupancy_type: form.occupancy_type,
        transaction_type: form.transaction_type,
        income_type: form.income_type,
        property_type: form.property_type,
        credit_score: form.credit_score,
        ltv: form.ltv,
        dti: form.dti,
        loan_amount: form.loan_amount,
        units: form.units,
        first_time_homebuyer: toBooleanOrEmpty(form.first_time_homebuyer),
        available_reserves_months: form.available_reserves_months,
      };

      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: MatchResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Match request failed.");
      }

      const normalizedStrong = safeArray(data.strong_matches);
      const normalizedConditional = safeArray(data.conditional_matches);
      const normalizedEliminated = safeArray(data.eliminated_paths);

      setStrongMatches(normalizedStrong);
      setConditionalMatches(normalizedConditional);
      setEliminatedPaths(normalizedEliminated);
      setTopRecommendation(data.top_recommendation || "");
      setOpenAiEnhancement(data.openai_enhancement || null);
      setLenderSummary(data.lender_summary || null);
      setExpandedCards({});
      setExpandedPrograms({});

      const resolvedNextQuestion =
        data.next_question ||
        data.openai_enhancement?.nextBestQuestion ||
        (getMissingFields(form)[0]
          ? `Please continue by providing the ${getMissingFields(form)[0].label} so I can narrow lender and program fit more precisely.`
          : "Please review the visible lender and program paths and confirm any remaining documentation or compensating factors.");

      setNextQuestion(resolvedNextQuestion);
      setSuccessMessage("Match analysis completed successfully.");

      // Step 5 Drop B (Component 2) — persist match results to the borrower
      // intake row when running in handoff mode. Fire-and-forget; failures
      // are logged client-side and do not surface to the LO. The matcher's
      // own response is the source of truth for the UI; this persistence
      // path only feeds Pro Mode's MATCH RESULTS context block on the
      // /api/handoff-chat side.
      if (handoffSessionId) {
        fetch(
          `/api/handoff-session/${encodeURIComponent(handoffSessionId)}/persist-match`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        ).catch((err) => {
          console.error("[finley] persist-match failed", err);
        });
      }

      const assistantSummary = buildChatSummary({
        ...data,
        strong_matches: normalizedStrong,
        conditional_matches: normalizedConditional,
        eliminated_paths: normalizedEliminated,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantSummary,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error running match.";

      setError(message);
      setStrongMatches([]);
      setConditionalMatches([]);
      setEliminatedPaths([]);
      setTopRecommendation("");
      setOpenAiEnhancement(null);
      setLenderSummary(null);
      setExpandedCards({});
      setExpandedPrograms({});
    } finally {
      setLoading(false);
    }
  }

  function sendToFinley() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const assistantReply = getGuidedAssistantReply(
      form,
      nextQuestion || openAiEnhancement?.nextBestQuestion || "",
      strongMatches,
      conditionalMatches
    );

    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: assistantReply },
    ]);

    setChatInput("");
  }

  // ---------------------------------------------------------------------------
  // Step 4 (Drop 2) — Pro Mode chat send handler.
  //
  // Appends the LO's message optimistically, POSTs to the dedicated
  // /api/handoff-chat/<proSessionId> endpoint (which also persists both
  // turns server-side), then appends the assistant reply on success.
  // On failure, the user turn stays visible and an error bubble is appended
  // so the LO doesn't lose context. Cmd/Ctrl+Enter in the textarea also fires
  // this — useful for fast back-and-forth while reviewing the file.
  //
  // Request body shape: { message: string }. If /api/handoff-chat expects a
  // different field name, that's the only line to patch.
  // ---------------------------------------------------------------------------
  async function sendToProChat() {
    const trimmed = proInput.trim();
    if (!trimmed || !proSessionId || proSending) return;

    setProSending(true);
    setProError("");

    setProMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setProInput("");

    try {
      const res = await fetch(
        `/api/handoff-chat/${encodeURIComponent(proSessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Pro chat request failed.");
      }

      setProMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "" },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error sending message.";
      setProError(message);
      setProMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `(Could not get a reply from Finley right now. ${message})`,
        },
      ]);
    } finally {
      setProSending(false);
    }
  }

  async function emailMySummary() {
    if (!professionalSession?.email) {
      setError(
        "No professional email is available in the current session. Please sign in again."
      );
      return;
    }

    setEmailingSummary(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = buildSummaryPayload({
        professionalSession,
        form,
        strongMatches,
        conditionalMatches,
        eliminatedPaths,
        nextQuestion,
        topRecommendation,
        openAiEnhancement,
        chatMessages,
      });

      const response = await fetch(SUMMARY_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to send the summary email from the current route."
        );
      }

      setSuccessMessage(`Summary email sent successfully to ${professionalSession.email}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error sending summary email.";
      setError(message);
    } finally {
      setEmailingSummary(false);
    }
  }

  function toggleCard(key: string) {
    setExpandedCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function togglePrograms(key: string) {
    setExpandedPrograms((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function renderBucketCard(
    item: MatchBucket,
    type: "strong" | "conditional" | "eliminated",
    index: number
  ) {
    const notes = safeArray(item.notes);
    const missingItems = safeArray(item.missing_items);
    const blockers = safeArray(item.blockers);
    const strengths = safeArray(item.strengths);
    const concerns = safeArray(item.concerns);
    // cardKey now includes lender_id (or lender_name) so each lender's
    // "View Details" toggle is independent — without this, lenders sharing
    // the same guideline_id would expand as a group inside a program row.
    const cardKey = `${type}-${
      item.guideline_id || item.program_slug || "p"
    }-${item.lender_id || item.lender_name || index}`;
    const expanded = !!expandedCards[cardKey];

    return (
      <div
        key={cardKey}
        style={{
          border: "1px solid #d9e1ec",
          borderRadius: 18,
          padding: 18,
          marginBottom: 16,
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1.1fr auto",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#263366" }}>
              {item.program_name || "Unknown Program"}
            </h3>
            <div style={{ color: "#4b5d7a", marginBottom: 8 }}>
              {item.lender_name || "Unknown Lender"}
            </div>
            <div>
              <strong>Program Slug:</strong> {item.program_slug || "—"}
            </div>
          </div>

          <div>
            <strong>Loan Category:</strong> {labelize(item.loan_category)}
          </div>

          <div>
            <strong>Guideline ID:</strong> {item.guideline_id || "—"}
          </div>

          <div>
            <strong>Required Reserves:</strong>{" "}
            {item.required_reserves_months !== null &&
            item.required_reserves_months !== undefined
              ? `${item.required_reserves_months} month(s) PITIA`
              : "—"}
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background:
                  type === "strong"
                    ? "#e8f7ee"
                    : type === "conditional"
                    ? "#fff6e5"
                    : "#fdecec",
                color:
                  type === "strong"
                    ? "#157347"
                    : type === "conditional"
                    ? "#946200"
                    : "#b42318",
                fontWeight: 700,
                marginBottom: 10,
                display: "inline-block",
              }}
            >
              Score: {item.score ?? 0}
            </div>

            <div>
              <button
                type="button"
                onClick={() => toggleCard(cardKey)}
                style={{
                  background: "#eef4fb",
                  color: "#263366",
                  border: "1px solid #c7d7eb",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {expanded ? "Hide Details" : "View Details"}
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 18 }}>
            {item.explanation && (
              <div style={{ color: "#4b5d7a", lineHeight: 1.65 }}>
                <strong>Explanation</strong>
                <div style={{ marginTop: 8 }}>{item.explanation}</div>
              </div>
            )}

            {renderList("Strengths", strengths)}
            {renderList("Concerns", concerns)}
            {renderList("Notes", notes)}
            {renderList("Missing Items", missingItems)}
            {renderList("Blockers", blockers)}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // renderProgramGroup — L1 row.
  //
  // Renders a clickable program-level header showing program name, loan
  // category, best score across lenders, and lender count. For eliminated
  // bucket, also shows the program-level blocker. When expanded, fans out
  // into renderBucketCard calls per lender (which themselves expand into
  // the existing per-lender detail panel).
  // ---------------------------------------------------------------------------
  function renderProgramGroup(
    group: ProgramGroup,
    type: "strong" | "conditional" | "eliminated"
  ) {
    const programKey = `${type}-program-${group.groupKey}`;
    const isExpanded = !!expandedPrograms[programKey];

    const pillBg =
      type === "strong"
        ? "#e8f7ee"
        : type === "conditional"
        ? "#fff6e5"
        : "#fdecec";
    const pillFg =
      type === "strong"
        ? "#157347"
        : type === "conditional"
        ? "#946200"
        : "#b42318";

    return (
      <div
        key={programKey}
        style={{
          border: "1px solid #d9e1ec",
          borderRadius: 18,
          marginBottom: 14,
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => togglePrograms(programKey)}
          aria-expanded={isExpanded}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 14,
            alignItems: "center",
            width: "100%",
            padding: "16px 18px",
            border: "none",
            background: isExpanded ? "#f8fbff" : "transparent",
            cursor: "pointer",
            textAlign: "left",
            color: "#263366",
            fontFamily: "inherit",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 16,
              color: "#0096C7",
              width: 14,
              display: "inline-block",
            }}
          >
            {isExpanded ? "▾" : "▸"}
          </span>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#263366",
                marginBottom: 4,
                lineHeight: 1.3,
              }}
            >
              {group.programName}
            </div>
            {group.loanCategory && (
              <div style={{ fontSize: 13, color: "#4b5d7a" }}>
                {labelize(group.loanCategory)}
              </div>
            )}
            {type === "eliminated" && group.blocker && (
              <div
                style={{
                  fontSize: 13,
                  color: "#b42318",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                <strong>Blocker:</strong> {group.blocker}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {type !== "eliminated" && (
              <span
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: pillBg,
                  color: pillFg,
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                Best: {group.bestScore}
              </span>
            )}
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "#eef4fb",
                color: "#263366",
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {group.lenderCount}{" "}
              {group.lenderCount === 1 ? "lender" : "lenders"}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div
            style={{
              padding: "16px 18px 4px 18px",
              borderTop: "1px solid #eef2f8",
              background: "#fbfcfe",
            }}
          >
            {group.items.map((item, index) =>
              renderBucketCard(item, type, index)
            )}
          </div>
        )}
      </div>
    );
  }

  if (!authChecked) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f3f6fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "Arial, Helvetica, sans-serif",
          color: "#263366",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
            textAlign: "center",
            maxWidth: 520,
            width: "100%",
          }}
        >
          <h2 style={{ margin: "0 0 12px 0" }}>Checking professional access...</h2>
          <div style={{ color: "#4b5d7a", lineHeight: 1.6 }}>
            Redirecting to the professional login screen if credentials are required.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f6fb",
        padding: "20px 14px 44px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#263366",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <section
          style={{
            background: "linear-gradient(90deg, #263366 0%, #0096C7 100%)",
            borderRadius: 28,
            padding: "22px 22px 24px",
            color: "#ffffff",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              opacity: 0.92,
              marginBottom: 8,
            }}
          >
            BEYOND INTELLIGENCE™
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 7vw, 56px)",
              lineHeight: 1.02,
              margin: "0 0 10px 0",
            }}
          >
            Finley Beyond
          </h1>

          <div
            style={{
              fontSize: "clamp(16px, 2.6vw, 20px)",
              lineHeight: 1.5,
            }}
          >
            AI-powered mortgage qualification and program matching supervised by an
            Independent Certified Mortgage Advisor.
          </div>

          {professionalSession?.name && (
            <div style={{ marginTop: 14, fontSize: 15, opacity: 0.95 }}>
              Signed in as <strong>{professionalSession.name}</strong>
              {professionalSession.role ? ` — ${professionalSession.role}` : ""}
              {professionalSession.nmls ? ` (${professionalSession.nmls})` : ""}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            <button
              type="button"
              onClick={emailMySummary}
              disabled={emailingSummary}
              style={{
                background: "#ffffff",
                color: "#263366",
                border: "none",
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 700,
                cursor: emailingSummary ? "not-allowed" : "pointer",
                opacity: emailingSummary ? 0.7 : 1,
              }}
            >
              {emailingSummary ? "Sending Summary..." : "Email My Summary"}
            </button>

            <button
              type="button"
              onClick={logoutProfessional}
              style={{
                background: "transparent",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.45)",
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Secure Logout
            </button>
          </div>
        </section>

        {successMessage && (
          <div
            style={{
              background: "#e8f7ee",
              border: "1px solid #86d19c",
              color: "#157347",
              borderRadius: 18,
              padding: "16px 18px",
              marginBottom: 18,
            }}
          >
            {successMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fdecec",
              border: "1px solid #f5a4a4",
              color: "#b42318",
              borderRadius: 18,
              padding: "16px 18px",
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {topRecommendation && (
          <div
            style={{
              background: "#f8fbff",
              border: "1px solid #cfe0f6",
              color: "#263366",
              borderRadius: 18,
              padding: "16px 18px",
              marginBottom: 18,
              lineHeight: 1.6,
            }}
          >
            <strong>Top Recommendation:</strong> {topRecommendation}
          </div>
        )}

        {handoffHydrated && handoffBorrowerName ? (
          <section
            style={{
              background: "linear-gradient(90deg, #5CB2D8 0%, #1EA6E0 100%)",
              borderRadius: 18,
              padding: "14px 18px",
              color: "#ffffff",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 0.6,
                background: "rgba(255,255,255,0.22)",
                borderRadius: 999,
                padding: "4px 10px",
                whiteSpace: "nowrap",
              }}
            >
              PRO MODE
            </span>
            <span style={{ fontSize: 15, flex: 1, minWidth: 0 }}>
              You are reviewing <strong>{handoffBorrowerName}</strong>&apos;s
              borrower file. Pre-filled scenario is on the left. The borrower
              transcript and your private chat with Finley are on the right.
            </span>
          </section>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              borderRadius: 28,
              padding: 22,
              boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
              minWidth: 0,
            }}
          >
            <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", margin: "0 0 14px 0" }}>
              Qualification Intake
            </h2>

            <p style={{ color: "#4b5d7a", lineHeight: 1.6 }}>
              Use this screen to gather decisive qualification facts, eliminate
              ineligible paths, and surface lender and program combinations still in play.
            </p>

            {handoffHydrated && handoffBorrowerName ? (
              <div
                style={{
                  marginTop: 14,
                  background: "#f0f9ff",
                  border: "1px solid #0096C7",
                  borderRadius: 18,
                  padding: 18,
                  color: "#243F7C",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#243F7C" }}>
                  Pre-filled from borrower intake:
                </strong>{" "}
                {handoffBorrowerName}&apos;s submitted scenario has been mapped
                into the form below. Verify the pre-filled fields, complete any
                missing items, and run the qualification match.
              </div>
            ) : null}

            <div
              style={{
                marginTop: 14,
                background: "#f8fbff",
                border: "1px solid #cfe0f6",
                borderRadius: 18,
                padding: 18,
                color: "#4b5d7a",
                lineHeight: 1.65,
              }}
            >
              Finley Beyond should think like a real mortgage professional: collect
              missing qualification facts, eliminate impossible paths, and narrow the
              best program options instead of stopping at incomplete intake.
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 18,
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                style={{
                  background: "#263366",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 16,
                  padding: "14px 18px",
                  fontWeight: 700,
                  cursor: "default",
                }}
              >
                Professional Mode
              </button>

              <button
                type="button"
                onClick={goToBorrowerMode}
                style={{
                  background: "#eef4fb",
                  color: "#263366",
                  border: "1px solid #c7d7eb",
                  borderRadius: 16,
                  padding: "14px 18px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Borrower Mode
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <label style={labelStyle}>Subject State</label>
                <input
                  value={form.subject_state}
                  onChange={(e) =>
                    updateField("subject_state", e.target.value.toUpperCase())
                  }
                  maxLength={2}
                  style={inputStyle}
                  placeholder="MA"
                />
              </div>

              <div>
                <label style={labelStyle}>Borrower Status</label>
                <select
                  value={form.borrower_status}
                  onChange={(e) =>
                    updateField("borrower_status", e.target.value as BorrowerStatus)
                  }
                  style={inputStyle}
                >
                  <option value="">Select status</option>
                  <option value="citizen">U.S. Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="non_permanent_resident">Non-Permanent Resident</option>
                  <option value="itin_borrower">ITIN Borrower</option>
                  <option value="daca">DACA</option>
                  <option value="foreign_national">Foreign National</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Occupancy Type</label>
                <select
                  value={form.occupancy_type}
                  onChange={(e) =>
                    updateField("occupancy_type", e.target.value as OccupancyType)
                  }
                  style={inputStyle}
                >
                  <option value="">Select occupancy</option>
                  <option value="primary_residence">Primary Residence</option>
                  <option value="second_home">Second Home</option>
                  <option value="investment_property">Investment Property</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Transaction Type</label>
                <select
                  value={form.transaction_type}
                  onChange={(e) =>
                    updateField("transaction_type", e.target.value as TransactionType)
                  }
                  style={inputStyle}
                >
                  <option value="">Select transaction type</option>
                  <option value="purchase">Purchase</option>
                  <option value="rate_term_refinance">Rate-Term Refinance</option>
                  <option value="cash_out_refinance">Cash-Out Refinance</option>
                  <option value="second_lien">Second Lien</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Income Type</label>
                <select
                  value={form.income_type}
                  onChange={(e) => updateField("income_type", e.target.value as IncomeType)}
                  style={inputStyle}
                >
                  <option value="">Select income type</option>
                  <option value="full_doc">Full Doc</option>
                  <option value="express_doc">Express Doc</option>
                  <option value="bank_statements">Bank Statements</option>
                  <option value="1099">1099</option>
                  <option value="pnl">P&amp;L</option>
                  <option value="asset_utilization">Asset Utilization</option>
                  <option value="dscr">DSCR</option>
                  <option value="no_ratio">No Ratio</option>
                  <option value="wvoe">WVOE</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Property Type</label>
                <select
                  value={form.property_type}
                  onChange={(e) =>
                    updateField("property_type", e.target.value as PropertyType)
                  }
                  style={inputStyle}
                >
                  <option value="">Select property type</option>
                  <option value="single_family">Single Family</option>
                  <option value="condo">Condo</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="2_unit">2 Unit</option>
                  <option value="3_unit">3 Unit</option>
                  <option value="4_unit">4 Unit</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="5_to_8_units">5 to 8 Units</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Credit Score</label>
                <input
                  value={form.credit_score}
                  onChange={(e) =>
                    updateField("credit_score", normalizeNumberInput(e.target.value))
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>LTV %</label>
                <input
                  value={form.ltv}
                  onChange={(e) => updateField("ltv", normalizeNumberInput(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>DTI %</label>
                <input
                  value={form.dti}
                  onChange={(e) => updateField("dti", normalizeNumberInput(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Loan Amount</label>
                <input
                  value={form.loan_amount}
                  onChange={(e) =>
                    updateField("loan_amount", normalizeNumberInput(e.target.value))
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Units</label>
                <input
                  value={form.units}
                  onChange={(e) => updateField("units", normalizeNumberInput(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>First-Time Homebuyer</label>
                <select
                  value={form.first_time_homebuyer}
                  onChange={(e) =>
                    updateField(
                      "first_time_homebuyer",
                      e.target.value as "" | "yes" | "no"
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Available Reserves (Months of PITIA)</label>
                <input
                  value={form.available_reserves_months}
                  onChange={(e) =>
                    updateField(
                      "available_reserves_months",
                      normalizeNumberInput(e.target.value)
                    )
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={runQualificationMatch}
                disabled={loading}
                style={{
                  background: "#263366",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Running..." : "Run Qualification Match"}
              </button>

              <button
                type="button"
                onClick={emailMySummary}
                disabled={emailingSummary}
                style={{
                  background: "#eef4fb",
                  color: "#263366",
                  border: "1px solid #c7d7eb",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontWeight: 700,
                  cursor: emailingSummary ? "not-allowed" : "pointer",
                  opacity: emailingSummary ? 0.7 : 1,
                }}
              >
                {emailingSummary ? "Sending..." : "Email My Summary"}
              </button>
            </div>
          </section>

          <section
            style={{
              background: "#ffffff",
              borderRadius: 28,
              padding: 22,
              boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
              minWidth: 0,
            }}
          >
            <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", margin: "0 0 14px 0" }}>
              Finley Conversation
            </h2>

            <div
              style={{
                background: "#f8fbff",
                border: "1px solid #cfe0f6",
                borderRadius: 18,
                padding: 18,
                color: "#4b5d7a",
                lineHeight: 1.6,
                marginBottom: 18,
              }}
            >
              {nextQuestion}
            </div>

            {missingFields.length > 0 && (
              <div
                style={{
                  background: "#fffaf0",
                  border: "1px solid #f3ddab",
                  borderRadius: 18,
                  padding: 18,
                  color: "#7a5a00",
                  lineHeight: 1.65,
                  marginBottom: 18,
                }}
              >
                <strong>Still Missing:</strong> {missingFields.map((item) => item.label).join(", ")}
              </div>
            )}

            {openAiEnhancement && (
              <div
                style={{
                  background: "#f8fbff",
                  border: "1px solid #cfe0f6",
                  borderRadius: 18,
                  padding: 18,
                  color: "#263366",
                  lineHeight: 1.65,
                  marginBottom: 18,
                }}
              >
                {openAiEnhancement.topRecommendation && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>Finley Direction:</strong> {openAiEnhancement.topRecommendation}
                  </div>
                )}

                {safeArray(openAiEnhancement.whyItMatches).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>Why It Matches</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                      {safeArray(openAiEnhancement.whyItMatches).map((item, i) => (
                        <li key={`ai-why-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {safeArray(openAiEnhancement.cautionItems).length > 0 && (
                  <div>
                    <strong>Caution Items</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                      {safeArray(openAiEnhancement.cautionItems).map((item, i) => (
                        <li key={`ai-caution-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {handoffHydrated ? (
              <>
                {/* Drop 2: Tab strip — Pro Chat (private LO↔Finley about this
                    file) vs Borrower Transcript (read-only, verbatim). Shown
                    only in handoff mode; direct visits to /finley render the
                    legacy chatMessages flow below. */}
                <div
                  style={{
                    display: "flex",
                    gap: 0,
                    borderBottom: "2px solid #e7eef8",
                    marginBottom: 16,
                  }}
                >
                  {(
                    [
                      { key: "pro_chat", label: "Pro Chat" },
                      {
                        key: "borrower_transcript",
                        label: "Borrower Transcript",
                      },
                    ] as const
                  ).map((tab) => {
                    const active = activeRightTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveRightTab(tab.key)}
                        style={{
                          background: "transparent",
                          border: "none",
                          borderBottom: active
                            ? "3px solid #0096C7"
                            : "3px solid transparent",
                          padding: "10px 16px",
                          marginBottom: -2,
                          fontWeight: 700,
                          fontSize: 15,
                          color: active ? "#0096C7" : "#4b5d7a",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {tab.label}
                        {tab.key === "borrower_transcript" &&
                          borrowerTranscript.length > 0 && (
                            <span
                              style={{
                                marginLeft: 8,
                                background: active ? "#e6f7fc" : "#eef4fb",
                                color: active ? "#0096C7" : "#4b5d7a",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {borrowerTranscript.length}
                            </span>
                          )}
                      </button>
                    );
                  })}
                </div>

                {activeRightTab === "pro_chat" ? (
                  <>
                    {proMessages.length === 0 ? (
                      <div
                        style={{
                          background: "#f8fbff",
                          border: "1px dashed #c7d7eb",
                          borderRadius: 18,
                          padding: 18,
                          color: "#4b5d7a",
                          lineHeight: 1.6,
                          marginBottom: 16,
                        }}
                      >
                        Ask Finley anything about this borrower&apos;s scenario —
                        program fit, missing items, structuring options, lender
                        overlays. This conversation is private to you and is
                        never shown to the borrower.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          marginBottom: 18,
                          maxHeight: 480,
                          overflowY: "auto",
                          paddingRight: 4,
                        }}
                      >
                        {proMessages.map((msg, index) => (
                          <div
                            key={`pro-${index}`}
                            style={{
                              alignSelf:
                                msg.role === "user" ? "flex-end" : "stretch",
                              background:
                                msg.role === "user" ? "#263366" : "#f8fbff",
                              color:
                                msg.role === "user" ? "#ffffff" : "#263366",
                              border:
                                msg.role === "user"
                                  ? "none"
                                  : "1px solid #cfe0f6",
                              borderRadius: 18,
                              padding: "14px 16px",
                              maxWidth: msg.role === "user" ? "85%" : "100%",
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    )}

                    {proError && (
                      <div
                        style={{
                          background: "#fdecec",
                          border: "1px solid #f5a4a4",
                          color: "#b42318",
                          borderRadius: 14,
                          padding: "10px 14px",
                          marginBottom: 12,
                          fontSize: 14,
                        }}
                      >
                        {proError}
                      </div>
                    )}

                    <textarea
                      value={proInput}
                      onChange={(e) => setProInput(e.target.value)}
                      placeholder={
                        proSending
                          ? "Sending..."
                          : "Ask Finley about this file..."
                      }
                      disabled={proSending}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          void sendToProChat();
                        }
                      }}
                      style={{
                        width: "100%",
                        minHeight: 110,
                        resize: "vertical",
                        borderRadius: 16,
                        border: "1px solid #c7d7eb",
                        padding: 16,
                        fontSize: 16,
                        outline: "none",
                        marginBottom: 16,
                        color: "#263366",
                        background: proSending ? "#f3f6fb" : "#ffffff",
                      }}
                    />

                    <button
                      type="button"
                      onClick={sendToProChat}
                      disabled={
                        proSending || !proInput.trim() || !proSessionId
                      }
                      style={{
                        background: "#0096C7",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 16,
                        padding: "14px 20px",
                        fontWeight: 700,
                        cursor:
                          proSending || !proInput.trim() || !proSessionId
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          proSending || !proInput.trim() || !proSessionId
                            ? 0.6
                            : 1,
                      }}
                    >
                      {proSending ? "Sending..." : "Send to Finley"}
                    </button>
                  </>
                ) : (
                  <>
                    {borrowerTranscript.length === 0 ? (
                      <div
                        style={{
                          background: "#f8fbff",
                          border: "1px dashed #c7d7eb",
                          borderRadius: 18,
                          padding: 18,
                          color: "#4b5d7a",
                          lineHeight: 1.6,
                        }}
                      >
                        No borrower transcript was captured for this intake
                        session.
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#4b5d7a",
                            marginBottom: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          Verbatim conversation between{" "}
                          {handoffBorrowerName || "the borrower"} and Finley
                          Beyond. Read-only.
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            maxHeight: 600,
                            overflowY: "auto",
                            paddingRight: 4,
                            background: "#fbfcfe",
                            border: "1px solid #e7eef8",
                            borderRadius: 18,
                            padding: 16,
                          }}
                        >
                          {borrowerTranscript
                            .filter(
                              (t) =>
                                t.role === "user" || t.role === "assistant"
                            )
                            .map((turn, index) => (
                              <div
                                key={`bt-${index}`}
                                style={{
                                  alignSelf:
                                    turn.role === "user"
                                      ? "flex-end"
                                      : "stretch",
                                  background:
                                    turn.role === "user"
                                      ? "#eef4fb"
                                      : "#ffffff",
                                  color: "#263366",
                                  border:
                                    turn.role === "user"
                                      ? "1px solid #c7d7eb"
                                      : "1px solid #e7eef8",
                                  borderRadius: 16,
                                  padding: "12px 14px",
                                  maxWidth:
                                    turn.role === "user" ? "85%" : "100%",
                                  lineHeight: 1.6,
                                  whiteSpace: "pre-wrap",
                                  fontSize: 14,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: 0.4,
                                    color:
                                      turn.role === "user"
                                        ? "#4b5d7a"
                                        : "#0096C7",
                                    marginBottom: 4,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {turn.role === "user"
                                    ? handoffBorrowerName || "Borrower"
                                    : "Finley"}
                                </div>
                                {turn.content}
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {chatMessages.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      marginBottom: 18,
                    }}
                  >
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        style={{
                          alignSelf: msg.role === "user" ? "flex-end" : "stretch",
                          background: msg.role === "user" ? "#263366" : "#f8fbff",
                          color: msg.role === "user" ? "#ffffff" : "#263366",
                          border: msg.role === "user" ? "none" : "1px solid #cfe0f6",
                          borderRadius: 18,
                          padding: "14px 16px",
                          maxWidth: msg.role === "user" ? "85%" : "100%",
                          lineHeight: 1.6,
                        }}
                      >
                        {msg.content}
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Continue the qualification conversation here..."
                  style={{
                    width: "100%",
                    minHeight: 110,
                    resize: "vertical",
                    borderRadius: 16,
                    border: "1px solid #c7d7eb",
                    padding: 16,
                    fontSize: 16,
                    outline: "none",
                    marginBottom: 16,
                    color: "#263366",
                  }}
                />

                <button
                  type="button"
                  onClick={sendToFinley}
                  style={{
                    background: "#0096C7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 16,
                    padding: "14px 20px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Send to Finley
                </button>
              </>
            )}

            <div style={{ marginTop: 24, color: "#4b5d7a", lineHeight: 1.7 }}>
              <div>
                <strong>Strong Matches:</strong> {summaryText.strong}
              </div>
              <div>
                <strong>Conditional Matches:</strong> {summaryText.conditional}
              </div>
              <div>
                <strong>Eliminated Paths:</strong> {summaryText.eliminated}
              </div>

              <div style={{ marginTop: 10 }}>
                <strong>Matched Lenders in Results:</strong>{" "}
                {matchedLenders.length > 0 ? matchedLenders.join(", ") : "None yet"}
              </div>

              {lenderSummary && (
                <div style={{ marginTop: 10 }}>
                  <div>
                    <strong>Active Lenders Checked:</strong>{" "}
                    {lenderSummary.active_lender_count ?? 0}
                  </div>
                  <div>
                    <strong>Lenders Loaded in Engine:</strong>{" "}
                    {safeArray(lenderSummary.active_lenders_checked).length > 0
                      ? safeArray(lenderSummary.active_lenders_checked).join(", ")
                      : "None returned"}
                  </div>
                </div>
              )}

              {!hasResults && <div style={{ marginTop: 8 }}>Run the qualification match first.</div>}
            </div>
          </section>
        </div>

        <section style={resultsSectionStyle}>
          <h2 style={resultsTitleStyle}>Strong Matches</h2>
          {strongMatches.length === 0 ? (
            <div style={{ color: "#4b5d7a" }}>No strong matches yet.</div>
          ) : (
            <>
              <div style={groupSummaryStyle}>
                {groupedStrong.length}{" "}
                {groupedStrong.length === 1 ? "program" : "programs"} across{" "}
                {strongMatches.length}{" "}
                {strongMatches.length === 1 ? "lender" : "lenders"}. Click a
                program to see the lenders offering it.
              </div>
              {groupedStrong.map((group) => renderProgramGroup(group, "strong"))}
            </>
          )}
        </section>

        <section style={resultsSectionStyle}>
          <h2 style={resultsTitleStyle}>Conditional Matches</h2>
          {conditionalMatches.length === 0 ? (
            <div style={{ color: "#4b5d7a" }}>No conditional matches.</div>
          ) : (
            <>
              <div style={groupSummaryStyle}>
                {groupedConditional.length}{" "}
                {groupedConditional.length === 1 ? "program" : "programs"} across{" "}
                {conditionalMatches.length}{" "}
                {conditionalMatches.length === 1 ? "lender" : "lenders"}. Click a
                program to see the lenders and concerns to clear.
              </div>
              {groupedConditional.map((group) =>
                renderProgramGroup(group, "conditional")
              )}
            </>
          )}
        </section>

        <section style={resultsSectionStyle}>
          <h2 style={resultsTitleStyle}>Eliminated Paths</h2>
          {eliminatedPaths.length === 0 ? (
            <div style={{ color: "#4b5d7a" }}>No eliminated paths yet.</div>
          ) : (
            <>
              <div style={groupSummaryStyle}>
                {groupedEliminated.length}{" "}
                {groupedEliminated.length === 1 ? "program" : "programs"} across{" "}
                {eliminatedPaths.length}{" "}
                {eliminatedPaths.length === 1 ? "lender" : "lenders"}. The
                program-level blocker is shown on each row.
              </div>
              {groupedEliminated.map((group) =>
                renderProgramGroup(group, "eliminated")
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// Default export — wraps the inner component in <Suspense>. Next.js 15+
// requires this when any descendant uses useSearchParams (or other dynamic
// APIs that depend on URL state), because those bail out of static prerender
// and need a boundary to fall back through. Fallback is null so the auth
// gate renders its own empty state during the brief client-side resolve.
export default function FinleyPage() {
  return (
    <Suspense fallback={null}>
      <FinleyPageInner />
    </Suspense>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #c7d7eb",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
  background: "#ffffff",
  color: "#263366",
  minWidth: 0,
};

const resultsSectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
  marginTop: 20,
};

const resultsTitleStyle: React.CSSProperties = {
  fontSize: "clamp(24px, 4vw, 30px)",
  margin: "0 0 16px 0",
};

const groupSummaryStyle: React.CSSProperties = {
  color: "#4b5d7a",
  fontSize: 14,
  lineHeight: 1.6,
  marginBottom: 14,
};
