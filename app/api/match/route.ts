// =============================================================================
// PASTE THIS FILE AT (replace existing entirely):
//
//     app/api/match/route.ts
//
// =============================================================================
//
// PHASE 2 SUPABASE-BACKED MATCHER — with CATEGORY TIER SCORING
//
// Reads from:
//   - programs + program_guidelines (lender-specific programs)
//   - global_guidelines (agency programs: Fannie, Freddie, FHA, VA, USDA)
//   - lenders (with capability flags: does_conventional/fha/va/usda)
//   - lender_state_eligibility
//
// =============================================================================
// F3.3 (6/6) — TENANT SCOPING + AUTH (this revision)
// =============================================================================
//
// Prior to this revision, /api/match was an UNAUTHENTICATED route that
// returned the system-wide lender catalog evaluation to any caller. After
// F3.1 multi-tenancy schema landed, that meant the matcher would have
// returned ALL lenders across ALL tenants — leaking other shops' lender
// catalogs to BF and vice versa.
//
// Changes in this revision:
//
//   1. AUTH — same pattern as sibling F3.3 routes:
//        - bf_team_session cookie required (401 if missing/invalid)
//        - team_users row must be active (403 if not)
//        - role must be in PROFESSIONAL_ROLES (403 if not)
//        - Verified via SQL probe (and via GitHub grep) that no
//          borrower-side route calls /api/match. Only callers are
//          /finley/page.tsx and persist-match (which only references it
//          in comments). Safe to add auth without borrower regression.
//
//   2. TENANT RESOLUTION — same pattern as sibling F3.3 routes:
//        - Resolve viewer.tenant_id via employees table by email
//          (canonical join key under Phase 5-prep-C dual-write).
//        - 403 if employees row missing or has no tenant_id.
//
//   3. CATALOG SCOPING — 4-step pattern from /api/handoff-chat:
//        a) Read tenant_lenders for viewerTenantId where is_active=true
//           → enabledLenderIds[]
//        b) If enabledLenderIds is empty: short-circuit with empty
//           buckets and a clear top_recommendation message. Don't run
//           queries with .in('id', []) — Supabase behavior on empty
//           IN is inconsistent.
//        c) lenders query: add .in('id', enabledLenderIds). Existing
//           lender_type != 'agency' filter preserved as defense in
//           depth.
//        d) programs query: add .in('lender_id', enabledLenderIds).
//        e) lender_state_eligibility query: add
//           .in('lender_id', enabledLenderIds).
//        f) global_guidelines (agency selling guides) is NOT scoped —
//           Fannie/Freddie/FHA/VA/USDA selling guides are shared by
//           every shop. Same decision as /api/handoff-chat.
//
//   4. CLIENT INSTANCE — this route mixes `createClient` (existing,
//      for catalog reads) with `supabaseAdmin` (new, for auth lookups
//      so RLS on team_users/employees doesn't block the lookup). The
//      inconsistency is acknowledged in the F3 cleanup queue and will
//      be normalized post-F3.7. Not blocking.
//
// =============================================================================
// SCORING CHANGE
// =============================================================================
//
// SCORING CHANGE (this version):
//   - Agency / Conventional / Government programs: +20 tier bonus
//   - Non-QM / DSCR / Bank Statement programs: -10 tier penalty
//   - ITIN / Foreign National programs: -15 tier penalty
//   - HELOC / Second / Other / null: 0 (neutral)
//
//   Rationale: when a borrower qualifies for both agency conventional AND
//   non-QM, agency conventional should always be the top recommendation
//   (better rate, lower fees). The previous version scored both categories
//   on the same scale, letting non-QM programs win on bonus headroom.
//
// STEP 2.5 EXTENSION — TRANSACTION-TYPE INFERENCE FROM PROGRAM NAME
//
// `global_guidelines` has no transaction_types column. The empty-array-permissive
// logic in Step 2 was therefore treating refi-only and construction programs
// as eligible for purchase scenarios. This version extends Step 2.5
// (deriveProgramRestrictions / evaluateAgencyProgramForLender) with name-derived
// transaction-type rules:
//
//   - Refinance programs (name contains "Refinance"):
//       ELIMINATE on a purchase transaction.
//       Caught: High LTV Refinance (Alt Path / Option), Disaster-Related
//       Limited Cash-Out Refinance, Student Loan Cash-Out Refinance, PACE
//       Refinance, etc.
//
//   - Construction-to-Permanent programs:
//       Demote to CONDITIONAL on a purchase transaction with a "verify
//       intent to build" concern. (Construction-to-Perm IS technically
//       purchase financing, but only for ground-up build.)
//
//   - HomeStyle Renovation / HomeStyle Refresh:
//       Demote to CONDITIONAL on a purchase transaction with a "verify
//       intent to renovate at closing" concern.
//
// The conditional demotion uses an explicit `forceConditional` flag rather
// than relying on score/concern arithmetic so it survives regardless of
// other scoring noise. When `global_guidelines` gains a transaction_types
// column (Option C territory), this logic should migrate into proper field
// checks alongside the existing transaction_types check on the lender path.
//
// =============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type FormPayload = {
  subject_state?: string;
  borrower_status?: string;
  occupancy_type?: string;
  transaction_type?: string;
  income_type?: string;
  property_type?: string;
  credit_score?: string | number;
  ltv?: string | number;
  dti?: string | number;
  loan_amount?: string | number;
  units?: string | number;
  first_time_homebuyer?: boolean | string;
  available_reserves_months?: string | number;
  session_id?: string;
};

type MatchBucket = {
  lender_name: string;
  lender_id: string;
  program_name: string;
  program_slug: string | null;
  loan_category: string | null;
  guideline_id: string;
  notes: string[];
  missing_items: string[];
  blockers: string[];
  strengths: string[];
  concerns: string[];
  explanation: string;
  score: number;
  required_reserves_months: number | null;
};

type ProgramRow = {
  id: string;
  name: string | null;
  slug: string | null;
  loan_category: string | null;
  is_active: boolean;
  lender_id: string;
  underwriting_method: string | null;
  lenders: unknown;
  program_guidelines: unknown;
};

type LenderJoin = {
  id: string;
  name: string | null;
  states: string[] | null;
};

type GuidelineRow = {
  id: string;
  program_id: string;
  borrower_statuses: unknown;
  occupancy_types: unknown;
  transaction_types: unknown;
  income_types: unknown;
  property_types: unknown;
  min_credit_score: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
  max_units: number | null;
  min_units: number | null;
  reserves_required_months: number | null;
  first_time_homebuyer_allowed: boolean | null;
  allows_itin: boolean | null;
  allows_daca: boolean | null;
  allows_foreign_national: boolean | null;
  allows_non_permanent_resident: boolean | null;
  guideline_summary: string | null;
  guideline_notes: string | null;
  is_active: boolean;
};

type StateEligibilityRow = {
  lender_id: string;
  state_code: string;
  owner_occupied_allowed: boolean;
  non_owner_occupied_allowed: boolean;
  second_home_allowed: boolean;
  heloc_allowed: boolean;
  is_active: boolean;
};

type LenderRow = {
  id: string;
  name: string | null;
  is_active?: boolean | null;
  lender_type: string | null;
  does_conventional: boolean | null;
  does_fha: boolean | null;
  does_va: boolean | null;
  does_usda: boolean | null;
  aus_methods: string[] | null;
};

type GlobalGuidelineRow = {
  id: string;
  agency: string;
  product_family: string;
  program_name: string;
  document_type: string;
  occupancy: unknown;
  income_types: unknown;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  max_units: number | null;
  notes: string | null;
  effective_date: string | null;
  is_active: boolean;
  underwriting_method: string | null;
};

// -----------------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s]/g, "").trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function arrayContainsNormalized(
  arr: string[],
  inputValue: string,
  fieldType: "occupancy" | "default" = "default"
): boolean {
  if (arr.length === 0) return true;
  const normalizedInput = normalizeToken(inputValue);

  for (const item of arr) {
    const normalizedItem = normalizeToken(item);

    if (normalizedItem === normalizedInput) return true;

    if (fieldType === "occupancy") {
      if (normalizedInput === "primary_residence" && normalizedItem === "primary") return true;
      if (normalizedInput === "second_home" && normalizedItem === "second_home") return true;
      if (normalizedInput === "investment_property" && normalizedItem === "investment") return true;
      if (normalizedItem === "primary_residence" && normalizedInput === "primary") return true;
      if (normalizedItem === "investment" && normalizedInput === "investment_property") return true;
    }
  }

  return false;
}

// -----------------------------------------------------------------------------
// AUS / Underwriting method helpers (Phase 7.5)
// -----------------------------------------------------------------------------
//
// Programs declare a required AUS / manual underwriting path via
// `underwriting_method` (one of 'either' | 'du' | 'lpa' | 'manual' |
// 'lender_box'). Lenders declare which AUS pipelines they accept via
// `aus_methods` (a string array). 'lender_box' was added in B1 to
// represent proprietary non-QM credit-box underwriting (Athas, ClearEdge,
// NQM Funding, etc.) that doesn't run through DU/LPA.
//
// The matcher gate: if a program's required method is anything other than
// 'either', the lender must list that method in its aus_methods. Otherwise the
// pairing is eliminated with a clear blocker.
//
function describeAusMethod(method: string | null | undefined): string {
  switch (method) {
    case "du":
      return "DU";
    case "lpa":
      return "LPA";
    case "manual":
      return "Manual UW";
    case "lender_box":
      return "Lender Box";
    case "either":
      return "DU/LPA";
    default:
      return method || "(unspecified)";
  }
}

function lenderAcceptsAusMethod(
  lenderAusMethods: string[] | null | undefined,
  requiredMethod: string | null | undefined
): boolean {
  if (!requiredMethod || requiredMethod === "either") return true;
  const accepted = Array.isArray(lenderAusMethods) ? lenderAusMethods : [];
  return accepted.includes(requiredMethod);
}

// -----------------------------------------------------------------------------
// Borrower status normalization (Step 3A)
// -----------------------------------------------------------------------------
//
// The data convention used in `program_guidelines.borrower_statuses` (across
// both ClearEdge and FNBA, and presumably future lender ingestions) is the
// short canonical form: `citizen`, `permanent_resident`, `non_permanent_resident`,
// `itin_borrower`, `daca`, `foreign_national`.
//
// Borrower-facing forms and conversation flows often emit longer-form synonyms
// (`us_citizen`, `green_card`, `lpr`, `dreamer`, etc.). Rather than migrate the
// data or hunt down every form value, we fold synonyms into the canonical form
// here. This means the matcher works correctly regardless of which variant a
// caller sends, and future synonyms can be absorbed by adding a single line.
//
const BORROWER_STATUS_ALIASES: Record<string, string> = {
  // U.S. Citizen → citizen
  us_citizen: "citizen",
  u_s_citizen: "citizen",
  united_states_citizen: "citizen",
  american_citizen: "citizen",

  // Green Card / LPR → permanent_resident
  green_card: "permanent_resident",
  green_card_holder: "permanent_resident",
  lpr: "permanent_resident",
  lawful_permanent_resident: "permanent_resident",
  permanent_resident_alien: "permanent_resident",

  // Non-Permanent Resident
  npr: "non_permanent_resident",
  non_perm_resident: "non_permanent_resident",
  non_permanent_resident_alien: "non_permanent_resident",
  temporary_resident: "non_permanent_resident",

  // ITIN
  itin: "itin_borrower",
  itin_only: "itin_borrower",
  itin_holder: "itin_borrower",

  // DACA
  dreamer: "daca",
  daca_recipient: "daca",

  // Foreign National
  foreign_borrower: "foreign_national",
  non_resident_alien: "foreign_national",
};

function normalizeBorrowerStatus(value: string): string {
  if (!value) return "";
  const normalized = normalizeToken(value);
  return BORROWER_STATUS_ALIASES[normalized] || normalized;
}

function borrowerStatusMatches(
  borrowerStatuses: string[],
  inputStatus: string,
  guideline: GuidelineRow
): boolean {
  if (!inputStatus) return true;

  const normalizedInput = normalizeBorrowerStatus(inputStatus);

  if (borrowerStatuses.length > 0) {
    for (const item of borrowerStatuses) {
      if (normalizeBorrowerStatus(item) === normalizedInput) return true;
    }
  }

  if (normalizedInput === "itin_borrower" && guideline.allows_itin === true) return true;
  if (normalizedInput === "daca" && guideline.allows_daca === true) return true;
  if (normalizedInput === "foreign_national" && guideline.allows_foreign_national === true) return true;
  if (normalizedInput === "non_permanent_resident" && guideline.allows_non_permanent_resident === true) return true;

  if (borrowerStatuses.length === 0) {
    return true;
  }

  return false;
}

// -----------------------------------------------------------------------------
// Category tier bonus (NEW)
// -----------------------------------------------------------------------------
//
// When a borrower qualifies for both agency conventional and a non-QM tier,
// agency should always win. This bonus encodes that preference structurally
// rather than relying on coincidental margin bonuses.
//
// Returns a number that is added to the per-program score AFTER all the
// margin-based bonuses are applied, but BEFORE bucket assignment. That way
// the bucket reflects the tier-adjusted score.
//
// String matching is loose (case-insensitive, normalized) to handle whatever
// values land in the loan_category column. Add new categories here as they
// appear in the data.
//
function getCategoryTierBonus(loanCategory: string | null | undefined): number {
  if (!loanCategory) return 0;
  const normalized = normalizeToken(loanCategory);

  // Agency / conventional / government — preferred placement tier
  if (normalized === "agency") return 20;
  if (normalized === "conventional") return 20;
  if (normalized.includes("fannie_mae")) return 20;
  if (normalized.includes("freddie_mac")) return 20;
  if (normalized.includes("fha")) return 20;
  if (normalized.includes("va")) return 20;
  if (normalized.includes("usda")) return 20;
  if (normalized === "government") return 20;

  // Neutral tiers — HELOC, second liens, generic "Other"
  if (normalized === "heloc") return 0;
  if (normalized === "second") return 0;
  if (normalized === "other") return 0;

  // Non-QM family — penalized vs agency
  if (normalized === "non_qm") return -10;
  if (normalized === "jumbo_non_qm") return -10;
  if (normalized === "bank_statement") return -10;
  if (normalized === "dscr") return -10;

  // Non-citizen / alternative-doc product tiers — heavier penalty
  if (normalized === "itin") return -15;
  if (normalized === "foreign_national") return -15;

  // Unknown category — neutral, don't penalize unfamiliar data
  return 0;
}

// =============================================================================
// F3.7-FINLEY — TIER GROUPING HELPERS (Diff #9)
// =============================================================================
//
// Pure in-memory transformations. NO Supabase reads. Mirrors the 5-tier
// vocabulary enforced at the DB CHECK-constraint level (programs_tier_code_chk
// and gg_tier_code_chk). Single source of truth: the TIER_CODES constant.
//
// =============================================================================

const TIER_CODES = [
  "TIER_1_AGENCY",
  "TIER_2_GOVERNMENT",
  "TIER_3_LENDER_PORTFOLIO",
  "TIER_4_NON_QM",
  "TIER_5_SPECIALTY",
] as const;

type TierCode = (typeof TIER_CODES)[number];

const TIER_LABELS: Record<TierCode, string> = {
  TIER_1_AGENCY: "Agency Programs",
  TIER_2_GOVERNMENT: "Government Programs",
  TIER_3_LENDER_PORTFOLIO: "Lender Portfolio",
  TIER_4_NON_QM: "Non-QM",
  TIER_5_SPECIALTY: "Specialty",
};

const TIER_RANKS: Record<TierCode, number> = {
  TIER_1_AGENCY: 10,
  TIER_2_GOVERNMENT: 20,
  TIER_3_LENDER_PORTFOLIO: 30,
  TIER_4_NON_QM: 40,
  TIER_5_SPECIALTY: 50,
};

function getTierCodeFromCategory(loanCategory: string | null | undefined): TierCode {
  if (!loanCategory) return "TIER_3_LENDER_PORTFOLIO";
  const normalized = loanCategory.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  // Agency — explicit and synthesized agency entries
  if (normalized.includes("fannie")) return "TIER_1_AGENCY";
  if (normalized.includes("freddie")) return "TIER_1_AGENCY";
  if (normalized.includes("conventional")) return "TIER_1_AGENCY";
  if (normalized === "agency" || normalized.includes("conforming")) return "TIER_1_AGENCY";

  // Government
  if (normalized.includes("fha")) return "TIER_2_GOVERNMENT";
  if (normalized.includes("usda")) return "TIER_2_GOVERNMENT";
  if (/(^|_)va($|_)/.test(normalized)) return "TIER_2_GOVERNMENT";

  // Specialty (alt-doc / alt-citizenship)
  if (normalized.includes("itin")) return "TIER_5_SPECIALTY";
  if (normalized.includes("foreign")) return "TIER_5_SPECIALTY";

  // Non-QM family
  if (normalized.includes("non_qm") || normalized.includes("nonqm")) return "TIER_4_NON_QM";
  if (normalized.includes("dscr")) return "TIER_4_NON_QM";
  if (normalized.includes("bank_statement") || normalized.includes("bank_stmt")) return "TIER_4_NON_QM";
  if (normalized.includes("asset_depletion")) return "TIER_4_NON_QM";
  if (normalized.includes("p_l") || normalized.includes("profit_loss")) return "TIER_4_NON_QM";

  // Default: lender portfolio (HELOC / Second / Other / null)
  return "TIER_3_LENDER_PORTFOLIO";
}

type BucketEntry = {
  loan_category?: string | null;
  score?: number | null;
  [key: string]: unknown;
};

function groupIntoTiers(
  strong: BucketEntry[],
  conditional: BucketEntry[]
): Array<{
  tier_code: TierCode;
  tier_label: string;
  tier_rank: number;
  strong_count: number;
  conditional_count: number;
  best_fit: BucketEntry | null;
  all_matches: BucketEntry[];
}> {
  const buckets: Record<TierCode, { strong: BucketEntry[]; conditional: BucketEntry[] }> = {
    TIER_1_AGENCY: { strong: [], conditional: [] },
    TIER_2_GOVERNMENT: { strong: [], conditional: [] },
    TIER_3_LENDER_PORTFOLIO: { strong: [], conditional: [] },
    TIER_4_NON_QM: { strong: [], conditional: [] },
    TIER_5_SPECIALTY: { strong: [], conditional: [] },
  };

  for (const m of strong) {
    const t = getTierCodeFromCategory((m.loan_category as string | null | undefined) ?? null);
    buckets[t].strong.push(m);
  }
  for (const m of conditional) {
    const t = getTierCodeFromCategory((m.loan_category as string | null | undefined) ?? null);
    buckets[t].conditional.push(m);
  }

  return TIER_CODES.map((code) => {
    const all = [...buckets[code].strong, ...buckets[code].conditional].sort(
      (a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0)
    );
    return {
      tier_code: code,
      tier_label: TIER_LABELS[code],
      tier_rank: TIER_RANKS[code],
      strong_count: buckets[code].strong.length,
      conditional_count: buckets[code].conditional.length,
      best_fit: buckets[code].strong[0] ?? buckets[code].conditional[0] ?? null,
      all_matches: all,
    };
  }).sort((a, b) => a.tier_rank - b.tier_rank);
}

// -----------------------------------------------------------------------------
// Guideline completeness check (lender-program path)
// -----------------------------------------------------------------------------

function hasSufficientGuidelineData(g: GuidelineRow): boolean {
  const borrowerStatuses = toStringArray(g.borrower_statuses);
  const occupancyTypes = toStringArray(g.occupancy_types);
  const incomeTypes = toStringArray(g.income_types);
  const propertyTypes = toStringArray(g.property_types);
  const transactionTypes = toStringArray(g.transaction_types);

  const hasArrayData =
    borrowerStatuses.length > 0 ||
    occupancyTypes.length > 0 ||
    incomeTypes.length > 0 ||
    propertyTypes.length > 0 ||
    transactionTypes.length > 0;

  const hasAllowsBoolean =
    g.allows_itin === true ||
    g.allows_daca === true ||
    g.allows_foreign_national === true ||
    g.allows_non_permanent_resident === true;

  const hasNumericThreshold =
    g.min_credit_score !== null ||
    g.max_ltv !== null ||
    g.max_dti !== null ||
    g.max_loan_amount !== null;

  return hasArrayData || hasAllowsBoolean || hasNumericThreshold;
}

// -----------------------------------------------------------------------------
// Per-program evaluation (lender programs)
// -----------------------------------------------------------------------------

type EvaluationResult = {
  bucket: "strong" | "conditional" | "eliminated";
  score: number;
  blockers: string[];
  concerns: string[];
  strengths: string[];
  missingItems: string[];
  explanation: string;
};

function evaluateLenderProgram(
  guideline: GuidelineRow,
  payload: FormPayload,
  stateEligibility: StateEligibilityRow | null,
  lenderName: string,
  programName: string,
  loanCategory: string | null
): EvaluationResult {
  const blockers: string[] = [];
  const concerns: string[] = [];
  const strengths: string[] = [];
  const missingItems: string[] = [];

  let score = 50;

  const subjectState = String(payload.subject_state || "").trim().toUpperCase();
  const borrowerStatus = String(payload.borrower_status || "").trim();
  const occupancyType = String(payload.occupancy_type || "").trim();
  const transactionType = String(payload.transaction_type || "").trim();
  const incomeType = String(payload.income_type || "").trim();
  const propertyType = String(payload.property_type || "").trim();
  const creditScore = toNumber(payload.credit_score);
  const ltv = toNumber(payload.ltv);
  const dti = toNumber(payload.dti);
  const loanAmount = toNumber(payload.loan_amount);
  const units = toNumber(payload.units);
  const reservesMonths = toNumber(payload.available_reserves_months);
  const firstTimeHomebuyer =
    payload.first_time_homebuyer === true || payload.first_time_homebuyer === "yes";

  // ---------------------------------------------------------------------------
  // Government program (FHA / VA / USDA) statutory disqualifiers
  // ---------------------------------------------------------------------------
  // Hard-eliminate the program if it is FHA / VA / USDA AND the borrower
  // status is ITIN / DACA / Foreign National OR the income type is non-full-doc.
  // This runs BEFORE state / occupancy / etc. so the blocker reflects the true
  // reason (statute, not licensing) and does not get masked by a softer concern.
  const govProgram = getGovernmentAgencyForProgram(
    programName,
    loanCategory,
    (guideline as { agency?: string | null }).agency ?? null
  );
  if (govProgram) {
    if (borrowerStatus && !isBorrowerStatusGovernmentCompatible(borrowerStatus)) {
      blockers.push(
        `${govProgram} loans require a valid Social Security Number; borrower status ${borrowerStatus.replace(/_/g, " ")} is not eligible for ${govProgram} financing.`
      );
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${programName} is a ${govProgram} program. ${govProgram} financing statutorily requires an SSN; ITIN, DACA, and Foreign National borrowers are not eligible.`,
      };
    }
    if (incomeType && !isIncomeTypeAgencyCompatible(incomeType)) {
      blockers.push(
        `${govProgram} loans require full-documentation income; ${incomeType.replace(/_/g, " ")} is not accepted for ${govProgram}.`
      );
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${programName} is a ${govProgram} program. ${govProgram} underwriting requires traditional full-doc / W-2 income; the selected income type is not compatible.`,
      };
    }
  }

  if (subjectState) {
    if (!stateEligibility || !stateEligibility.is_active) {
      blockers.push(`${lenderName} has no active state eligibility entry for ${subjectState}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${lenderName} is not currently eligible to lend in ${subjectState} per state eligibility data.`,
      };
    }

    const isOwnerOccupiedScenario =
      occupancyType === "primary_residence" || occupancyType === "second_home";
    const isInvestmentScenario = occupancyType === "investment_property";

    if (isOwnerOccupiedScenario && !stateEligibility.owner_occupied_allowed) {
      blockers.push(`${lenderName} is not licensed for owner-occupied loans in ${subjectState}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${lenderName} does not allow owner-occupied lending in ${subjectState}.`,
      };
    }

    if (isInvestmentScenario && !stateEligibility.non_owner_occupied_allowed) {
      blockers.push(`${lenderName} is not licensed for non-owner-occupied loans in ${subjectState}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${lenderName} does not allow investment-property lending in ${subjectState}.`,
      };
    }

    strengths.push(`${lenderName} is licensed in ${subjectState} for this occupancy.`);
  } else {
    missingItems.push("Subject state");
  }

  if (borrowerStatus) {
    const borrowerStatuses = toStringArray(guideline.borrower_statuses);
    if (!borrowerStatusMatches(borrowerStatuses, borrowerStatus, guideline)) {
      blockers.push(`${programName} does not allow borrower status: ${borrowerStatus.replace(/_/g, " ")}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Borrower status (${borrowerStatus.replace(/_/g, " ")}) is not permitted under ${programName}.`,
      };
    }
    strengths.push(`Borrower status (${borrowerStatus.replace(/_/g, " ")}) is permitted.`);
  } else {
    missingItems.push("Borrower status");
  }

  if (occupancyType) {
    const occupancyTypes = toStringArray(guideline.occupancy_types);
    if (occupancyTypes.length === 0) {
      concerns.push(`${programName} did not specify eligible occupancy types — verify with lender that ${occupancyType.replace(/_/g, " ")} is permitted.`);
      missingItems.push("Eligible occupancy types not specified");
    } else if (!arrayContainsNormalized(occupancyTypes, occupancyType, "occupancy")) {
      blockers.push(`${programName} does not allow occupancy: ${occupancyType.replace(/_/g, " ")}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Occupancy (${occupancyType.replace(/_/g, " ")}) is not permitted under ${programName}.`,
      };
    } else {
      strengths.push(`Occupancy (${occupancyType.replace(/_/g, " ")}) is permitted.`);
    }
  } else {
    missingItems.push("Occupancy type");
  }

  if (transactionType) {
    const transactionTypes = toStringArray(guideline.transaction_types);
    if (transactionTypes.length === 0) {
      concerns.push(`${programName} did not specify eligible transaction types — verify with lender that ${transactionType.replace(/_/g, " ")} is permitted.`);
      missingItems.push("Eligible transaction types not specified");
    } else if (!arrayContainsNormalized(transactionTypes, transactionType)) {
      blockers.push(`${programName} does not allow transaction type: ${transactionType.replace(/_/g, " ")}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Transaction type (${transactionType.replace(/_/g, " ")}) is not permitted under ${programName}.`,
      };
    } else {
      strengths.push(`Transaction type (${transactionType.replace(/_/g, " ")}) is permitted.`);
    }
  } else {
    missingItems.push("Transaction type");
  }

  if (incomeType) {
    const incomeTypes = toStringArray(guideline.income_types);
    if (incomeTypes.length === 0) {
      concerns.push(`${programName} did not specify accepted income types — verify with lender that ${incomeType.replace(/_/g, " ")} is accepted.`);
      missingItems.push("Accepted income types not specified");
    } else if (!arrayContainsNormalized(incomeTypes, incomeType)) {
      blockers.push(`${programName} does not accept income type: ${incomeType.replace(/_/g, " ")}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Income type (${incomeType.replace(/_/g, " ")}) is not accepted under ${programName}.`,
      };
    } else {
      strengths.push(`Income type (${incomeType.replace(/_/g, " ")}) is accepted.`);
    }
  } else {
    missingItems.push("Income type");
  }

  if (propertyType) {
    const propertyTypes = toStringArray(guideline.property_types);
    if (propertyTypes.length === 0) {
      concerns.push(`${programName} did not specify eligible property types — verify with lender that ${propertyType.replace(/_/g, " ")} is permitted.`);
      missingItems.push("Eligible property types not specified");
    } else if (!arrayContainsNormalized(propertyTypes, propertyType)) {
      blockers.push(`${programName} does not allow property type: ${propertyType.replace(/_/g, " ")}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Property type (${propertyType.replace(/_/g, " ")}) is not permitted under ${programName}.`,
      };
    } else {
      strengths.push(`Property type (${propertyType.replace(/_/g, " ")}) is permitted.`);
    }
  } else {
    missingItems.push("Property type");
  }

  if (creditScore > 0 && guideline.min_credit_score !== null) {
    if (creditScore < guideline.min_credit_score) {
      blockers.push(`Credit score ${creditScore} is below program minimum of ${guideline.min_credit_score}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Credit score ${creditScore} does not meet minimum of ${guideline.min_credit_score} for ${programName}.`,
      };
    }
    const margin = creditScore - guideline.min_credit_score;
    if (margin >= 60) {
      score += 12;
      strengths.push(`Credit score (${creditScore}) is well above the program minimum of ${guideline.min_credit_score}.`);
    } else if (margin >= 30) {
      score += 8;
      strengths.push(`Credit score (${creditScore}) clears the program minimum of ${guideline.min_credit_score} comfortably.`);
    } else if (margin >= 10) {
      score += 4;
      strengths.push(`Credit score (${creditScore}) meets the program minimum of ${guideline.min_credit_score}.`);
    } else {
      concerns.push(`Credit score (${creditScore}) only narrowly clears the program minimum of ${guideline.min_credit_score}.`);
    }
  } else if (creditScore <= 0) {
    missingItems.push("Credit score");
  }

  if (ltv > 0 && guideline.max_ltv !== null) {
    if (ltv > Number(guideline.max_ltv)) {
      blockers.push(`LTV ${ltv}% exceeds program maximum of ${guideline.max_ltv}%.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `LTV ${ltv}% exceeds the maximum LTV of ${guideline.max_ltv}% for ${programName}.`,
      };
    }
    const margin = Number(guideline.max_ltv) - ltv;
    if (margin >= 15) {
      score += 10;
      strengths.push(`LTV (${ltv}%) is comfortably below the program maximum of ${guideline.max_ltv}%.`);
    } else if (margin >= 5) {
      score += 5;
      strengths.push(`LTV (${ltv}%) is within the program maximum of ${guideline.max_ltv}%.`);
    } else {
      concerns.push(`LTV (${ltv}%) is close to the program maximum of ${guideline.max_ltv}%.`);
    }
  } else if (ltv <= 0) {
    missingItems.push("LTV");
  }

  if (dti > 0 && guideline.max_dti !== null) {
    if (dti > Number(guideline.max_dti)) {
      blockers.push(`DTI ${dti}% exceeds program maximum of ${guideline.max_dti}%.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `DTI ${dti}% exceeds the maximum DTI of ${guideline.max_dti}% for ${programName}.`,
      };
    }
    const margin = Number(guideline.max_dti) - dti;
    if (margin >= 20) {
      score += 8;
      strengths.push(`DTI (${dti}%) is comfortably below the program maximum of ${guideline.max_dti}%.`);
    } else if (margin >= 5) {
      score += 4;
      strengths.push(`DTI (${dti}%) is within the program maximum of ${guideline.max_dti}%.`);
    } else {
      concerns.push(`DTI (${dti}%) is close to the program maximum of ${guideline.max_dti}%.`);
    }
  } else if (dti <= 0) {
    missingItems.push("DTI");
  }

  if (loanAmount > 0) {
    if (guideline.min_loan_amount !== null && loanAmount < Number(guideline.min_loan_amount)) {
      blockers.push(`Loan amount $${loanAmount.toLocaleString()} is below program minimum of $${Number(guideline.min_loan_amount).toLocaleString()}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Loan amount $${loanAmount.toLocaleString()} is below the minimum of $${Number(guideline.min_loan_amount).toLocaleString()} for ${programName}.`,
      };
    }
    if (guideline.max_loan_amount !== null && loanAmount > Number(guideline.max_loan_amount)) {
      blockers.push(`Loan amount $${loanAmount.toLocaleString()} exceeds program maximum of $${Number(guideline.max_loan_amount).toLocaleString()}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Loan amount $${loanAmount.toLocaleString()} exceeds the maximum of $${Number(guideline.max_loan_amount).toLocaleString()} for ${programName}.`,
      };
    }
    if (guideline.min_loan_amount !== null || guideline.max_loan_amount !== null) {
      strengths.push(`Loan amount $${loanAmount.toLocaleString()} is within program limits.`);
    }
  } else {
    missingItems.push("Loan amount");
  }

  if (units > 0) {
    if (guideline.min_units !== null && units < guideline.min_units) {
      blockers.push(`Units (${units}) below program minimum of ${guideline.min_units}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Units count below program minimum for ${programName}.`,
      };
    }
    if (guideline.max_units !== null && units > guideline.max_units) {
      blockers.push(`Units (${units}) exceed program maximum of ${guideline.max_units}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Units count exceeds program maximum for ${programName}.`,
      };
    }
  } else {
    missingItems.push("Units");
  }

  if (firstTimeHomebuyer && guideline.first_time_homebuyer_allowed === false) {
    concerns.push(`Program does not allow first-time homebuyers.`);
    score -= 8;
  } else if (firstTimeHomebuyer && guideline.first_time_homebuyer_allowed === true) {
    strengths.push(`First-time homebuyer is permitted.`);
    score += 3;
  }

  if (guideline.reserves_required_months !== null) {
    if (reservesMonths === 0) {
      missingItems.push("Available reserves (months of PITIA)");
    } else if (reservesMonths >= guideline.reserves_required_months) {
      score += 5;
      strengths.push(`Reserves (${reservesMonths} months) meet program requirement of ${guideline.reserves_required_months} months.`);
    } else {
      concerns.push(`Reserves (${reservesMonths} months) are below program requirement of ${guideline.reserves_required_months} months.`);
      score -= 6;
    }
  }

  // Apply category tier bonus AFTER margin-based scoring but BEFORE bucket
  // assignment so the bucket reflects the tier-adjusted score.
  score += getCategoryTierBonus(loanCategory);

  // Clamp to 100. Tier bonuses can push a high base score above the visible
  // ceiling (e.g. 81 + 20 agency bonus = 101). Bucket thresholds are 60 / 75
  // so clamping here changes the displayed value only, never the bucket.
  score = Math.min(score, 100);

  let bucket: "strong" | "conditional" = "conditional";
  if (score >= 75 && concerns.length === 0 && missingItems.length <= 1) {
    bucket = "strong";
  } else if (score >= 60 && concerns.length <= 1) {
    bucket = "strong";
  } else {
    bucket = "conditional";
  }

  const explanation =
    bucket === "strong"
      ? `${programName} aligns well with the borrower scenario across the documented qualification dimensions.`
      : `${programName} appears workable but has some open items, soft concerns, or missing details to confirm before final placement.`;

  return {
    bucket,
    score,
    blockers,
    concerns,
    strengths,
    missingItems,
    explanation,
  };
}

// -----------------------------------------------------------------------------
// Agency program evaluation (Phase 2 — global_guidelines)
// -----------------------------------------------------------------------------

// Maps an agency name (from global_guidelines.agency) to the lender capability
// flag column that gates which lenders can place that agency program.
function getCapabilityFlagForAgency(agency: string): keyof Pick<LenderRow, "does_conventional" | "does_fha" | "does_va" | "does_usda"> | null {
  const normalized = normalizeToken(agency);
  if (normalized === "fannie_mae" || normalized === "freddie_mac") return "does_conventional";
  if (normalized === "fha") return "does_fha";
  if (normalized === "va") return "does_va";
  if (normalized === "usda") return "does_usda";
  return null;
}

// Agency programs use full-doc underwriting. If borrower selected a non-doc
// type (bank_statements, dscr, etc.), agency is not a fit.
function isIncomeTypeAgencyCompatible(incomeType: string): boolean {
  if (!incomeType) return true;
  const normalized = normalizeToken(incomeType);
  return normalized === "full_doc" || normalized === "express_doc";
}

// -----------------------------------------------------------------------------
// Government program detection (FHA / VA / USDA)
// -----------------------------------------------------------------------------
//
// FHA, VA, and USDA are government-backed programs subject to STATUTORY
// borrower and documentation requirements that override any per-lender or
// per-program data quality. Specifically:
//
//   1. SSN required. ITIN, DACA, and Foreign National borrowers are
//      categorically ineligible. (US Citizens, Permanent Residents, and
//      Non-Permanent Residents holding a valid SSN are fine for FHA/USDA;
//      VA additionally requires veteran/active-duty/eligible-spouse status.)
//
//   2. Full-doc income only. Bank Statements, P&L only, 1099-only,
//      Asset Utilization, DSCR, No Ratio, and WVOE are all categorically
//      ineligible — FHA/VA/USDA underwriting requires traditional
//      W-2 / 1040 full-doc or express-doc income.
//
// These rules mirror isIncomeTypeAgencyCompatible() (which gates Fannie /
// Freddie agency programs) and exist because the per-lender programs table
// frequently has empty borrower_statuses[] / income_types[] arrays — the
// engine treats empty as "permissive" in evaluateLenderProgram(), which would
// otherwise let ITIN borrowers and bank-statement income flow through onto
// FHA/VA programs as Conditional matches. Statute wins over data quality.

function getGovernmentAgencyForProgram(
  programName: string,
  loanCategory: string | null,
  agency?: string | null
): "FHA" | "VA" | "USDA" | null {
  const cat = normalizeToken(String(loanCategory || ""));
  if (cat === "fha") return "FHA";
  if (cat === "va") return "VA";
  if (cat === "usda") return "USDA";

  const ag = normalizeToken(String(agency || ""));
  if (ag === "fha") return "FHA";
  if (ag === "va") return "VA";
  if (ag === "usda") return "USDA";

  const name = String(programName || "");
  if (/\bfha\b/i.test(name) || /fha-insured/i.test(name)) return "FHA";
  if (/\bva\b/i.test(name) || /va-guaranteed/i.test(name) || /\birrrl\b/i.test(name)) return "VA";
  if (/\busda\b/i.test(name) || /rural housing/i.test(name) || /rd section/i.test(name)) return "USDA";

  return null;
}

function isBorrowerStatusGovernmentCompatible(borrowerStatus: string): boolean {
  if (!borrowerStatus) return true;
  const normalized = normalizeBorrowerStatus(borrowerStatus);
  // FHA/VA/USDA require an SSN. ITIN, DACA, and Foreign National are
  // categorically ineligible regardless of any per-program override.
  if (normalized === "itin_borrower") return false;
  if (normalized === "daca") return false;
  if (normalized === "foreign_national") return false;
  return true;
}

// -----------------------------------------------------------------------------
// Program-name-derived restrictions (Step 2.5)
// -----------------------------------------------------------------------------
//
// `global_guidelines` does not have columns for property_types, transaction_types,
// or per-program eligible_states. Many programs in that table (Manufactured
// Housing, Co-op Share Loan, Texas Section 50(a)(6), FHA-Insured, VA-Guaranteed,
// RD Section 502, HUD Section 184, refinance-only programs, construction, and
// renovation products) carry their restrictions only in the program name. This
// helper pattern-matches the program_name and returns whatever borrower-side
// conflicts can be derived from it.
//
// Three classes of restriction:
//   1. Hard conflicts (property type, single state, refinance-only on a purchase)
//      — the borrower's input directly contradicts the program. Eliminate.
//   2. Government programs (FHA / VA / USDA / Section 184) — borrower wasn't
//      asked which agency they want; LO will decide in Pro Mode. Demote with a
//      targeted concern so it's still visible but no longer cluttering strong.
//   3. Construction and renovation products on a purchase — these CAN fund a
//      purchase, but only with extra borrower intent (build vs. buy, renovate
//      at closing). Demote to conditional via the `forceConditional` flag.
//
// When `global_guidelines` gains structured columns for these restrictions,
// migrate this logic into proper field checks and delete this helper.
//
type ProgramRestrictions = {
  requiresPropertyType?: string[];
  propertyTypeLabel?: string;
  requiresState?: string;
  governmentProgram?: "FHA" | "VA" | "USDA" | "Section 184";
  refinanceOnly?: boolean;
  conditionalForPurchase?: "construction" | "renovation";
};

function deriveProgramRestrictions(programName: string): ProgramRestrictions {
  const restrictions: ProgramRestrictions = {};
  const name = programName || "";

  // Property-type-restricted programs (eliminate on mismatch)
  if (/manufactured housing|\bmh advantage\b|\bstandard mh\b|\bmh\b/i.test(name)) {
    restrictions.requiresPropertyType = ["manufactured", "manufactured_housing", "manufactured home"];
    restrictions.propertyTypeLabel = "manufactured housing";
  } else if (/co-?op\b|cooperative/i.test(name)) {
    restrictions.requiresPropertyType = ["cooperative", "co_op", "coop", "co-op"];
    restrictions.propertyTypeLabel = "cooperative (co-op)";
  }

  // State-restricted programs (eliminate on mismatch)
  if (/texas section 50/i.test(name)) {
    restrictions.requiresState = "TX";
  }

  // Refinance-only programs (eliminate on a purchase transaction)
  // Catches: High LTV Refinance / Refinance Option / Alternative Qualification Path,
  // Disaster-Related Limited Cash-Out Refinance, Student Loan Cash-Out Refinance,
  // PACE Refinance, etc.
  if (/refinance/i.test(name)) {
    restrictions.refinanceOnly = true;
  }

  // Construction-to-Permanent — conditional on a purchase (verify intent to build).
  // Catches all "Construction-to-Permanent" variants (Single-Closing, Two-Closing,
  // Financing, etc.). Allows optional hyphens or whitespace between tokens.
  if (/construction[-\s]?to[-\s]?permanent/i.test(name)) {
    restrictions.conditionalForPurchase = "construction";
  }

  // HomeStyle Renovation / HomeStyle Refresh — conditional on a purchase
  // (verify intent to renovate at closing).
  if (/homestyle\s*(renovation|refresh)/i.test(name)) {
    restrictions.conditionalForPurchase = "renovation";
  }

  // Government programs (demote with targeted concern; do not eliminate)
  // Order matters — Section 184 and Section 502 are checked before generic
  // FHA/VA so HUD-Guaranteed Section 184 doesn't accidentally tag as something else.
  if (/section 184|hud-?guaranteed section 184/i.test(name)) {
    restrictions.governmentProgram = "Section 184";
  } else if (/section 502|rd-?guaranteed|\brd\b\s*section/i.test(name)) {
    restrictions.governmentProgram = "USDA";
  } else if (/^va-|va-guaranteed|\bva\b mortgage/i.test(name)) {
    restrictions.governmentProgram = "VA";
  } else if (/^fha-|fha-insured|\bfha\b mortgage/i.test(name)) {
    restrictions.governmentProgram = "FHA";
  }

  return restrictions;
}

function evaluateAgencyProgramForLender(
  agencyGuideline: GlobalGuidelineRow,
  lender: LenderRow,
  stateEligibility: StateEligibilityRow | null,
  payload: FormPayload
): EvaluationResult {
  const blockers: string[] = [];
  const concerns: string[] = [];
  const strengths: string[] = [];
  const missingItems: string[] = [];

  let score = 50;
  let forceConditional = false;

  const subjectState = String(payload.subject_state || "").trim().toUpperCase();
  const occupancyType = String(payload.occupancy_type || "").trim();
  const transactionType = String(payload.transaction_type || "").trim();
  const incomeType = String(payload.income_type || "").trim();
  const propertyType = String(payload.property_type || "").trim();
  const creditScore = toNumber(payload.credit_score);
  const ltv = toNumber(payload.ltv);
  const dti = toNumber(payload.dti);
  const units = toNumber(payload.units);
  const reservesMonths = toNumber(payload.available_reserves_months);
  const firstTimeHomebuyer =
    payload.first_time_homebuyer === true || payload.first_time_homebuyer === "yes";

  const lenderName = lender.name || "Unknown Lender";
  const agencyDisplay = agencyGuideline.agency;
  const programDisplay = `${agencyGuideline.program_name} (${agencyDisplay})`;

  // -----------------------------------------------------------------------
  // Program-name-derived restrictions (Step 2.5)
  // Hard conflicts (property type, single-state, refinance-only on purchase)
  // eliminate immediately. Construction/renovation programs on a purchase get
  // demoted to conditional via forceConditional. Government programs
  // (FHA/VA/USDA/Section 184) demote to conditional with a targeted concern
  // so the LO can confirm in Pro Mode.
  // -----------------------------------------------------------------------
  const restrictions = deriveProgramRestrictions(agencyGuideline.program_name);

  // Property-type restriction — eliminate on mismatch
  if (restrictions.requiresPropertyType && propertyType) {
    const normalizedInput = normalizeToken(propertyType);
    const propertyMatches = restrictions.requiresPropertyType.some(
      (allowed) => normalizeToken(allowed) === normalizedInput
    );
    if (!propertyMatches) {
      blockers.push(
        `${programDisplay} is restricted to ${restrictions.propertyTypeLabel} — borrower property type is ${propertyType.replace(/_/g, " ")}.`
      );
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${programDisplay} requires a ${restrictions.propertyTypeLabel} property, which does not match the borrower's ${propertyType.replace(/_/g, " ")}.`,
      };
    }
    strengths.push(`Property type (${propertyType.replace(/_/g, " ")}) matches the program's eligibility (${restrictions.propertyTypeLabel}).`);
  }

  // State restriction — eliminate on mismatch
  if (restrictions.requiresState && subjectState && restrictions.requiresState !== subjectState) {
    blockers.push(
      `${programDisplay} is restricted to ${restrictions.requiresState} only — borrower subject state is ${subjectState}.`
    );
    return {
      bucket: "eliminated",
      score: 0,
      blockers,
      concerns,
      strengths,
      missingItems,
      explanation: `${programDisplay} is a ${restrictions.requiresState}-only product and cannot be placed in ${subjectState}.`,
    };
  }

  // Refinance-only restriction — eliminate on a purchase transaction
  if (restrictions.refinanceOnly && transactionType === "purchase") {
    blockers.push(
      `${programDisplay} is a refinance program — borrower's transaction type is purchase.`
    );
    return {
      bucket: "eliminated",
      score: 0,
      blockers,
      concerns,
      strengths,
      missingItems,
      explanation: `${programDisplay} is a refinance product and cannot be placed on a purchase transaction.`,
    };
  }

  // Construction or renovation product on a purchase — demote to conditional
  // via the explicit forceConditional flag. The concern + missing item make
  // the open question visible; the flag overrides bucket assignment at the end.
  if (restrictions.conditionalForPurchase && transactionType === "purchase") {
    if (restrictions.conditionalForPurchase === "construction") {
      concerns.push(
        `${programDisplay} is a construction-to-permanent product — confirm borrower intends ground-up construction (vs. buying an existing property).`
      );
      missingItems.push("Construction intent (build vs. purchase existing property) not confirmed");
    } else {
      concerns.push(
        `${programDisplay} is a renovation/refresh program — confirm borrower intends to renovate at closing.`
      );
      missingItems.push("Renovation scope and intent at closing not confirmed");
    }
    score -= 10;
    forceConditional = true;
  }

  // Government program — demote with targeted concern (do not eliminate)
  if (restrictions.governmentProgram) {
    const govConcernMessages: Record<NonNullable<ProgramRestrictions["governmentProgram"]>, string> = {
      "FHA": `${programDisplay} is an FHA program — confirm with borrower whether they want this path versus conventional.`,
      "VA": `${programDisplay} is a VA program — requires the borrower to be a current/former military service member or eligible spouse. Confirm veteran status.`,
      "USDA": `${programDisplay} is a USDA Rural Development program — requires a rural-eligible property and household income within USDA limits. Confirm both with borrower.`,
      "Section 184": `${programDisplay} is a HUD Section 184 program — requires a Native American/Alaska Native borrower and tribal trust land. Confirm eligibility.`,
    };
    const govMissingItems: Record<NonNullable<ProgramRestrictions["governmentProgram"]>, string> = {
      "FHA": "Borrower preference for FHA versus conventional not confirmed",
      "VA": "Veteran status not confirmed",
      "USDA": "Rural property eligibility and USDA income limits not confirmed",
      "Section 184": "Section 184 borrower and property eligibility not confirmed",
    };
    concerns.push(govConcernMessages[restrictions.governmentProgram]);
    missingItems.push(govMissingItems[restrictions.governmentProgram]);
    score -= 10;
  }

  // State eligibility check
  if (subjectState) {
    if (!stateEligibility || !stateEligibility.is_active) {
      blockers.push(`${lenderName} has no active state eligibility for ${subjectState}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${lenderName} is not eligible to lend in ${subjectState} for this scenario.`,
      };
    }

    const isOwnerOccupiedScenario =
      occupancyType === "primary_residence" || occupancyType === "second_home";
    const isInvestmentScenario = occupancyType === "investment_property";

    if (isOwnerOccupiedScenario && !stateEligibility.owner_occupied_allowed) {
      blockers.push(`${lenderName} is not licensed for owner-occupied loans in ${subjectState}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${lenderName} does not allow owner-occupied lending in ${subjectState} (agency program ${agencyGuideline.program_name} cannot be placed there).`,
      };
    }

    if (isInvestmentScenario && !stateEligibility.non_owner_occupied_allowed) {
      blockers.push(`${lenderName} is not licensed for non-owner-occupied loans in ${subjectState}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `${lenderName} does not allow investment-property lending in ${subjectState}.`,
      };
    }

    strengths.push(`${lenderName} is licensed in ${subjectState} for this occupancy.`);
  } else {
    missingItems.push("Subject state");
  }

  // Agency programs are full-doc — eliminate non-doc income types
  if (incomeType && !isIncomeTypeAgencyCompatible(incomeType)) {
    blockers.push(`${agencyDisplay} agency programs require full-doc income; ${incomeType.replace(/_/g, " ")} is not accepted.`);
    return {
      bucket: "eliminated",
      score: 0,
      blockers,
      concerns,
      strengths,
      missingItems,
      explanation: `Agency programs (${agencyDisplay}) require full-documentation income. The selected income type is not compatible.`,
    };
  }

  // Occupancy match against global_guidelines.occupancy
  if (occupancyType) {
    const occupancyArr = toStringArray(agencyGuideline.occupancy);
    if (occupancyArr.length === 0) {
      concerns.push(`${programDisplay} did not specify eligible occupancy types — verify against agency selling guide that ${occupancyType.replace(/_/g, " ")} is permitted.`);
      missingItems.push("Eligible occupancy types not specified");
    } else if (!arrayContainsNormalized(occupancyArr, occupancyType, "occupancy")) {
      blockers.push(`${programDisplay} does not allow occupancy: ${occupancyType.replace(/_/g, " ")}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Occupancy (${occupancyType.replace(/_/g, " ")}) is not permitted under ${programDisplay}.`,
      };
    } else {
      strengths.push(`Occupancy (${occupancyType.replace(/_/g, " ")}) is permitted under this agency program.`);
    }
  } else {
    missingItems.push("Occupancy type");
  }

  // Credit score
  if (creditScore > 0 && agencyGuideline.min_credit !== null) {
    if (creditScore < agencyGuideline.min_credit) {
      blockers.push(`Credit score ${creditScore} is below agency minimum of ${agencyGuideline.min_credit}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Credit score ${creditScore} does not meet agency minimum of ${agencyGuideline.min_credit} for ${programDisplay}.`,
      };
    }
    const margin = creditScore - agencyGuideline.min_credit;
    if (margin >= 60) {
      score += 12;
      strengths.push(`Credit score (${creditScore}) is well above agency minimum of ${agencyGuideline.min_credit}.`);
    } else if (margin >= 30) {
      score += 8;
      strengths.push(`Credit score (${creditScore}) clears agency minimum of ${agencyGuideline.min_credit} comfortably.`);
    } else if (margin >= 10) {
      score += 4;
      strengths.push(`Credit score (${creditScore}) meets agency minimum of ${agencyGuideline.min_credit}.`);
    } else {
      concerns.push(`Credit score (${creditScore}) only narrowly clears agency minimum of ${agencyGuideline.min_credit}.`);
    }
  } else if (creditScore <= 0) {
    missingItems.push("Credit score");
  }

  // LTV
  if (ltv > 0 && agencyGuideline.max_ltv !== null) {
    const maxLtv = Number(agencyGuideline.max_ltv);
    if (ltv > maxLtv) {
      blockers.push(`LTV ${ltv}% exceeds agency maximum of ${maxLtv}%.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `LTV ${ltv}% exceeds the agency maximum of ${maxLtv}% for ${programDisplay}.`,
      };
    }
    const margin = maxLtv - ltv;
    if (margin >= 15) {
      score += 10;
      strengths.push(`LTV (${ltv}%) is comfortably below agency maximum of ${maxLtv}%.`);
    } else if (margin >= 5) {
      score += 5;
      strengths.push(`LTV (${ltv}%) is within agency maximum of ${maxLtv}%.`);
    } else {
      concerns.push(`LTV (${ltv}%) is close to agency maximum of ${maxLtv}%.`);
    }
  } else if (ltv <= 0) {
    missingItems.push("LTV");
  }

  // DTI
  if (dti > 0 && agencyGuideline.max_dti !== null) {
    const maxDti = Number(agencyGuideline.max_dti);
    if (dti > maxDti) {
      blockers.push(`DTI ${dti}% exceeds agency maximum of ${maxDti}%.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `DTI ${dti}% exceeds the agency maximum of ${maxDti}% for ${programDisplay}.`,
      };
    }
    const margin = maxDti - dti;
    if (margin >= 15) {
      score += 6;
      strengths.push(`DTI (${dti}%) is comfortably below agency maximum of ${maxDti}%.`);
    } else if (margin >= 5) {
      score += 3;
      strengths.push(`DTI (${dti}%) is within agency maximum of ${maxDti}%.`);
    } else {
      concerns.push(`DTI (${dti}%) is close to agency maximum of ${maxDti}%.`);
    }
  } else if (dti <= 0) {
    missingItems.push("DTI");
  }

  // Units
  if (units > 0 && agencyGuideline.max_units !== null) {
    if (units > agencyGuideline.max_units) {
      blockers.push(`Units (${units}) exceed agency maximum of ${agencyGuideline.max_units}.`);
      return {
        bucket: "eliminated",
        score: 0,
        blockers,
        concerns,
        strengths,
        missingItems,
        explanation: `Units count exceeds agency maximum for ${programDisplay}.`,
      };
    }
  } else if (units <= 0) {
    missingItems.push("Units");
  }

  // FTHB soft signal
  if (firstTimeHomebuyer) {
    score += 2;
    strengths.push(`First-time homebuyer status noted; many agency programs offer FTHB-friendly options.`);
  }

  // Reserves are typically required for agency but specific months not stated
  // in our global_guidelines data — handle as soft check.
  if (reservesMonths > 0) {
    score += 2;
  } else {
    missingItems.push("Available reserves (months of PITIA)");
  }

  // Agency programs are tier-1 by definition. Apply the tier bonus AFTER
  // margin-based scoring but BEFORE bucket assignment so the bucket reflects
  // the tier-adjusted score. This is the +20 from getCategoryTierBonus("agency").
  score += 20;

  // Clamp to 100. A high base score plus the +20 agency bonus can overshoot
  // the visible ceiling (e.g. 81 + 20 = 101). Bucket thresholds are 60 / 75
  // so clamping here changes the displayed value only, never the bucket.
  score = Math.min(score, 100);

  let bucket: "strong" | "conditional" = "conditional";
  if (score >= 75 && concerns.length === 0 && missingItems.length <= 1) {
    bucket = "strong";
  } else if (score >= 60 && concerns.length <= 1) {
    bucket = "strong";
  } else {
    bucket = "conditional";
  }

  // Step 2.5 conditional override — construction/renovation on a purchase
  // never lands in strong regardless of how high the underlying score is.
  // The concern + missing item from the block above explain why.
  if (forceConditional && bucket === "strong") {
    bucket = "conditional";
  }

  const explanation =
    bucket === "strong"
      ? `${programDisplay} aligns well as an agency placement option through ${lenderName} based on the documented qualification facts.`
      : `${programDisplay} via ${lenderName} appears workable but has open items or soft concerns to confirm before placement.`;

  return {
    bucket,
    score,
    blockers,
    concerns,
    strengths,
    missingItems,
    explanation,
  };
}

// -----------------------------------------------------------------------------
// Build next question
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Targeted follow-up question builder
// -----------------------------------------------------------------------------
//
// When all intake fields are filled but only conditional matches survive, mine
// the top conditional match's concerns[] and missingItems[] and turn the most
// decisive one into a question that — if answered — would either flip the
// program to a strong match or eliminate it. This makes Finley behave like a
// real mortgage professional who keeps drilling for compensating factors
// instead of stopping at "review the conditional matches."

type TopConditionalSummary = {
  program_name?: string | null;
  lender_name?: string | null;
  loan_category?: string | null;
  concerns?: string[] | null;
  missing_items?: string[] | null;
};

function buildTargetedFollowUpQuestion(
  payload: FormPayload,
  topConditional: TopConditionalSummary | null | undefined
): string | null {
  if (!topConditional) return null;

  const concerns = Array.isArray(topConditional.concerns) ? topConditional.concerns : [];
  const missing = Array.isArray(topConditional.missing_items) ? topConditional.missing_items : [];
  const programName = topConditional.program_name || "the top conditional program";
  const lenderName = topConditional.lender_name || "the lender";
  const category = normalizeToken(String(topConditional.loan_category || ""));

  // Walk concerns / missing items and pattern-match decisive items.
  const haystack = [...concerns, ...missing].map((s) => String(s || "").toLowerCase());

  // Credit score concerns
  if (haystack.some((h) => h.includes("credit score") || h.includes("fico") || h.includes("min credit"))) {
    return `The top conditional path (${programName} via ${lenderName}) has a credit-score concern. Are there compensating factors — large reserves beyond what was entered, low DTI, long employment continuity, or recent score improvements not yet reflected — that could offset it?`;
  }

  // Manual UW concerns
  if (haystack.some((h) => h.includes("manual uw") || h.includes("manual underwriting"))) {
    return `${programName} would require Manual Underwriting through ${lenderName}. What is the borrower's residual income (disposable income after PITIA + all monthly debts), and are there any compensating factors — 12+ months reserves, DTI well below program max, or strong job tenure — that support a manual UW package?`;
  }

  // VA-specific
  if (category === "va" || haystack.some((h) => h.includes(" va ") || h.includes("veteran") || h.includes("certificate of eligibility") || h.includes("coe"))) {
    return `${programName} is a VA program. Does the borrower hold a valid Certificate of Eligibility (COE), and is the borrower a veteran, active-duty service member, National Guard / Reserve member with qualifying service, or eligible surviving spouse?`;
  }

  // FHA-specific
  if (category === "fha" || haystack.some((h) => h.includes("fha"))) {
    return `${programName} is an FHA program. Has the borrower had a prior FHA loan paid off, any 3-year-look-back events (bankruptcy, foreclosure, short sale), or any non-occupant co-borrower involved? Also confirm the property will be primary owner-occupied.`;
  }

  // USDA-specific
  if (category === "usda" || haystack.some((h) => h.includes("usda") || h.includes("rural"))) {
    return `${programName} is a USDA Rural Housing program. Is the subject property in a USDA-eligible rural census tract, and is total household income within the county income limit for the household size?`;
  }

  // Reserves
  if (haystack.some((h) => h.includes("reserves") || h.includes("pitia"))) {
    return `${programName} flags a reserves concern. Beyond the months already entered, does the borrower have additional liquid or retirement assets (401k / IRA at typical 60% utilization), business accounts, or gift-of-equity that could be counted toward reserves?`;
  }

  // DTI
  if (haystack.some((h) => h.includes("dti") || h.includes("debt-to-income"))) {
    return `${programName} has a DTI concern. Are there debts on the credit report being paid off at or before closing, any non-borrower household income, or installment debts with fewer than 10 payments remaining that could be excluded from the qualifying ratio?`;
  }

  // LTV
  if (haystack.some((h) => h.includes("ltv"))) {
    return `${programName} has an LTV concern. Is additional down payment available — gift funds, seller concessions toward principal, or proceeds from another asset sale — that could lower the LTV into program tolerance?`;
  }

  // Bank-statement income (non-government context)
  if (haystack.some((h) => h.includes("bank statement"))) {
    return `${programName} uses bank-statement income. How many months of statements are available (12 vs 24), is the deposit pattern consistent month-over-month, and are statements personal, business, or co-mingled?`;
  }

  // Default — surface the first concern explicitly
  if (concerns.length > 0) {
    return `The top conditional path is ${programName} via ${lenderName}. Its leading open item is: "${concerns[0]}". What additional context can you share to clear or qualify that item?`;
  }
  if (missing.length > 0) {
    return `The top conditional path is ${programName} via ${lenderName}. Missing input flagged: "${missing[0]}". Can you provide that detail so I can re-score?`;
  }

  return null;
}

function buildNextQuestion(
  payload: FormPayload,
  strongCount: number,
  conditionalCount: number,
  eliminatedCount: number,
  topConditional?: TopConditionalSummary | null
): string {
  const orderedFieldChecks: { field: keyof FormPayload; question: string }[] = [
    { field: "subject_state", question: "What is the subject state for this scenario?" },
    { field: "borrower_status", question: "What is the borrower's current immigration or citizenship status?" },
    { field: "occupancy_type", question: "Will this be a primary residence, second home, or investment property?" },
    { field: "transaction_type", question: "Is this a purchase, rate-term refinance, cash-out refinance, or second lien?" },
    { field: "income_type", question: "What documentation type will the borrower use — full doc, bank statements, 1099, P&L, asset utilization, or DSCR?" },
    { field: "property_type", question: "What is the property type — single family, condo, townhouse, multi-unit, or mixed use?" },
    { field: "credit_score", question: "What is the borrower's qualifying middle credit score?" },
    { field: "ltv", question: "What is the target LTV?" },
    { field: "loan_amount", question: "What is the requested loan amount?" },
    { field: "dti", question: "What is the borrower's projected DTI?" },
    { field: "available_reserves_months", question: "How many months of PITIA reserves are available after closing?" },
  ];

  for (const check of orderedFieldChecks) {
    const value = payload[check.field];
    const isEmpty = value === undefined || value === null || value === "" || value === "0";
    if (isEmpty) return check.question;
  }

  if (strongCount > 0) {
    return "Please review the visible strong matches and confirm any remaining documentation or compensating factors.";
  }
  if (conditionalCount > 0) {
    // Finley should NOT stop at "review the conditional matches" — a real mortgage
    // professional keeps asking targeted questions until a strong match emerges or
    // every answerable concern has been addressed. Mine the top conditional match
    // for the most actionable open item and turn it into a question.
    const targeted = buildTargetedFollowUpQuestion(payload, topConditional);
    if (targeted) return targeted;
    return "All intake fields are filled but no strong match has surfaced yet. Please share any compensating factors — credit score detail, employment continuity, gift funds, reserves beyond what was entered, or veteran/active-duty status — that could elevate one of the conditional paths to a strong match.";
  }
  if (eliminatedCount > 0) {
    return "All currently loaded paths have been eliminated. Please review the eliminated paths and adjust the scenario or check whether additional lender programs need to be loaded.";
  }
  return "No visible paths were identified yet. Please confirm the next qualification detail.";
}

// -----------------------------------------------------------------------------
// Evaluation comparator (Step D2 fix)
// -----------------------------------------------------------------------------
//
// When a lender program has multiple active guideline rows (e.g., FNBA's
// FlexFirst HELOC has separate rows for primary / second_home / investment
// occupancy), the matcher needs to evaluate each row and keep the one that
// best fits the borrower's scenario. This comparator ranks evaluation results
// by bucket (strong > conditional > eliminated) and uses score as tiebreaker.
//
function isBetterEvaluation(a: EvaluationResult, b: EvaluationResult): boolean {
  const bucketRank: Record<EvaluationResult["bucket"], number> = {
    strong: 3,
    conditional: 2,
    eliminated: 1,
  };
  const rankA = bucketRank[a.bucket];
  const rankB = bucketRank[b.bucket];
  if (rankA !== rankB) return rankA > rankB;
  return a.score > b.score;
}

// -----------------------------------------------------------------------------
// PHASE 5 — FUNNEL-AWARE TIER FILTER
// -----------------------------------------------------------------------------
//
// Loads scenario_qualifying_answers for the current scenario_id (= workflow_files.id)
// and applies deterministic tier-impact rules to each program evaluation.
//
// Rules are conservative AGENCY-PROGRAM-FIRST. Lender-specific Non-QM programs
// are demoted only when explicit Non-QM-only signals are present (e.g. bank
// statements, DSCR rental, non-warrantable condo) — they are not eliminated
// by income docs alone because most lender-program guidelines already encode
// their own income_type rules.
//
// The funnel answers are layered ON TOP of the existing evaluator output:
// they may downgrade strong→conditional or conditional→eliminated, and they
// append blockers/concerns. They never UPGRADE buckets.
// -----------------------------------------------------------------------------

type FunnelAnswers = {
  citizenship_status?: string;
  income_doc_type?: string;
  credit_event_history_4y?: { event?: string; months_seasoned?: number };
  property_flags?: { units_2_4?: boolean; manufactured?: boolean; non_warrantable_condo?: boolean };
  loan_size_vs_county_limit?: { is_jumbo?: boolean; is_high_balance?: boolean };
  borrower_flags?: { veteran?: boolean; first_time_hb?: boolean; rural_property?: boolean };
};

async function loadFunnelAnswers(
  scenarioId: string,
  tenantId: string
): Promise<FunnelAnswers | null> {
  if (!scenarioId) return null;
  const { data, error } = await supabaseAdmin
    .from("scenario_qualifying_answers")
    .select("question_key, answer_value")
    .eq("tenant_id", tenantId)
    .eq("scenario_id", scenarioId);
  if (error || !data || data.length === 0) return null;
  const out: FunnelAnswers = {};
  for (const row of data) {
    const k = row.question_key as keyof FunnelAnswers;
    const v = row.answer_value;
    (out as Record<string, unknown>)[k] = v as never;
  }
  return out;
}

type FunnelImpact = {
  newBucket: "strong" | "conditional" | "eliminated";
  addedBlockers: string[];
  addedConcerns: string[];
  scoreDelta: number;
};

function isAgencyEquivalent(loanCategory?: string): boolean {
  if (!loanCategory) return false;
  const lc = loanCategory.toLowerCase();
  if (lc.includes("jumbo")) return false;
  return (
    lc.includes("conventional") ||
    lc.includes("agency") ||
    lc.includes("fannie") ||
    lc.includes("freddie") ||
    lc.includes("fha") ||
    lc.includes("usda") ||
    lc === "va" ||
    lc.startsWith("va ") ||
    lc.includes(" va ") ||
    lc.endsWith(" va")
  );
}

function isVAProgram(loanCategory?: string): boolean {
  if (!loanCategory) return false;
  const lc = loanCategory.toLowerCase();
  return (
    lc === "va" ||
    lc.startsWith("va ") ||
    lc.includes(" va ") ||
    lc.endsWith(" va")
  );
}

function applyFunnelTierImpact(
  evaluation: EvaluationResult,
  funnel: FunnelAnswers | null,
  programContext: { isAgency: boolean; agency?: string; productFamily?: string; programName?: string; loanCategory?: string }
): FunnelImpact {
  const out: FunnelImpact = {
    newBucket: evaluation.bucket,
    addedBlockers: [],
    addedConcerns: [],
    scoreDelta: 0,
  };
  if (!funnel) return out;
  const isAgency =
    programContext.isAgency ||
    isAgencyEquivalent(programContext.loanCategory);

  // --- Citizenship ---
  const citizenship = String(funnel.citizenship_status || "").trim().toLowerCase();
  if (citizenship === "foreign_national") {
    out.addedBlockers.push("Borrower is a Foreign National — Agency programs require US citizen, permanent resident, or eligible visa holder.");
    if (isAgency) {
      out.newBucket = "eliminated";
      out.scoreDelta -= 50;
    } else {
      out.addedConcerns.push("Confirm program supports Foreign National borrowers.");
    }
  } else if (citizenship === "itin") {
    if (isAgency) {
      out.addedBlockers.push("Borrower is an ITIN borrower — Agency programs require SSN. ITIN-niche Non-QM programs only.");
      out.newBucket = "eliminated";
      out.scoreDelta -= 50;
    } else {
      out.addedConcerns.push("Confirm program supports ITIN borrowers.");
    }
  }

  // --- Income docs ---
  const incomeDoc = String(funnel.income_doc_type || "").trim().toLowerCase();
  if (incomeDoc === "bank_statements" || incomeDoc === "dscr_rental" || incomeDoc === "asset_depletion" || incomeDoc === "profit_loss_only" || incomeDoc === "1099_only") {
    if (isAgency) {
      out.addedBlockers.push(`Borrower documents income via ${incomeDoc.replace(/_/g, " ")} — Agency programs require W-2 or full tax returns.`);
      out.newBucket = "eliminated";
      out.scoreDelta -= 40;
    }
  }

  // --- Credit events (4yr lookback) ---
  const creditEvent = funnel.credit_event_history_4y;
  if (creditEvent && creditEvent.event && creditEvent.event !== "none") {
    const event = String(creditEvent.event).toLowerCase();
    const months = typeof creditEvent.months_seasoned === "number" ? creditEvent.months_seasoned : 0;
    const requiredMonths: Record<string, number> = {
      bk7: 48,
      bk13: 24,
      foreclosure: 84,
      short_sale: 48,
      deed_in_lieu: 48,
    };
    const required = requiredMonths[event] ?? 0;
    if (isAgency && required > 0 && months < required) {
      out.addedBlockers.push(`${event.toUpperCase()} seasoning is ${months} months — Agency requires ${required} months minimum.`);
      out.newBucket = "eliminated";
      out.scoreDelta -= 40;
    } else if (isAgency && required > 0 && months >= required) {
      out.addedConcerns.push(`${event.toUpperCase()} seasoning of ${months} months meets Agency ${required}-month minimum — confirm with underwriter.`);
    }
  }

  // --- Property flags ---
  const propertyFlags = funnel.property_flags;
  if (propertyFlags) {
    if (propertyFlags.non_warrantable_condo === true && isAgency) {
      out.addedBlockers.push("Subject is a non-warrantable condo — Agency programs require warrantable. Non-QM only.");
      out.newBucket = "eliminated";
      out.scoreDelta -= 40;
    }
    if (propertyFlags.manufactured === true && isAgency) {
      out.addedConcerns.push("Subject is manufactured housing — Agency support is program-specific (Fannie MH Advantage / Freddie CHOICEHome). Confirm program eligibility.");
      if (out.newBucket === "strong") out.newBucket = "conditional";
    }
    if (propertyFlags.units_2_4 === true) {
      out.addedConcerns.push("2-4 unit subject — confirm program supports multi-unit and review LTV/reserves requirements.");
    }
  }

  // --- Loan size vs county limit ---
  const loanSize = funnel.loan_size_vs_county_limit;
  if (loanSize) {
    if (loanSize.is_jumbo === true && isAgency && programContext.productFamily !== "Jumbo" && !isVAProgram(programContext.loanCategory)) {
      out.addedBlockers.push("Loan size exceeds Agency conforming + high-balance limit (Jumbo) — Agency conforming programs do not apply.");
      out.newBucket = "eliminated";
      out.scoreDelta -= 40;
    }
    if (loanSize.is_high_balance === true && isAgency) {
      out.addedConcerns.push("Loan size in High-Balance range — confirm High-Balance variant pricing and county limit eligibility.");
    }
  }

 // --- Borrower flags (Phase 6-B3: boost-only; never UPGRADE buckets) ---
    const borrowerFlags = funnel.borrower_flags;
    if (borrowerFlags && isAgency) {
      const lc = String(programContext.loanCategory || "").toLowerCase();
      const pf = String(programContext.productFamily || "").toLowerCase();
      const pn = String(programContext.programName || "").toLowerCase();

      // Veteran → boost VA programs only
      if (borrowerFlags.veteran === true && isVAProgram(programContext.loanCategory)) {
        out.addedConcerns.push("Borrower indicates veteran status — confirm COE/entitlement and VA funding fee exemption if applicable.");
        out.scoreDelta += 15;
      }

      // First-time homebuyer → boost FHA, HomeReady, Home Possible
      const isFHA = lc.includes("fha");
      const isHomeReady = pf.includes("homeready") || pn.includes("homeready") || pn.includes("home ready");
      const isHomePossible = pf.includes("home possible") || pn.includes("home possible") || pn.includes("homepossible");
      if (borrowerFlags.first_time_hb === true && (isFHA || isHomeReady || isHomePossible)) {
        out.addedConcerns.push("First-time homebuyer — verify HUD-approved homebuyer education completion if program requires it.");
        out.scoreDelta += 10;
      }

      // Rural property → boost USDA programs; flag risk on non-USDA agency programs
      const isUSDA = lc.includes("usda") || lc.includes("rural development") || lc.includes("rd ");
      if (borrowerFlags.rural_property === true) {
        if (isUSDA) {
          out.addedConcerns.push("Rural property indicated — confirm subject address falls within USDA RD eligibility map.");
          out.scoreDelta += 15;
        } else {
          out.addedConcerns.push("Rural/non-warrantable area indicated — confirm appraiser comparable availability and lender overlays.");
        }
      }
    }

    return out;
}

// -----------------------------------------------------------------------------
// POST handler
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // -------------------------------------------------------------------------
    // F3.3 STEP 1: Auth (cookie + team_users active + role gate).
    // -------------------------------------------------------------------------
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
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
        { success: false, error: "Account not active." },
        { status: 403 }
      );
    }

    const callerRole = String(teamUser.role ?? "");
    if (!PROFESSIONAL_ROLES.has(callerRole)) {
      return NextResponse.json(
        {
          success: false,
          error: "This action is for licensed mortgage professionals.",
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // F3.3 STEP 2: Resolve viewer.tenant_id via employees lookup by EMAIL.
    // team_users.id !== employees.id under Phase 5-prep-C dual-write; email
    // is the canonical join key.
    // -------------------------------------------------------------------------
    const viewerEmail = (teamUser as { email?: string | null }).email;
    if (!viewerEmail) {
      console.error(
        "[match] team_users row has no email — cannot resolve tenant.",
        { teamUserId: teamUser.id }
      );
      return NextResponse.json(
        { success: false, error: "Tenant is not configured for this account." },
        { status: 403 }
      );
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("tenant_id")
      .eq("email", viewerEmail)
      .maybeSingle();

    if (employeeError) {
      console.error("[match] employees lookup failed.", employeeError);
      return NextResponse.json(
        { success: false, error: "Failed to verify session." },
        { status: 500 }
      );
    }

    if (!employee || !employee.tenant_id) {
      console.warn("[match] employees row missing or has no tenant_id.", {
        teamUserId: teamUser.id,
        viewerEmail,
      });
      return NextResponse.json(
        { success: false, error: "Tenant is not configured for this account." },
        { status: 403 }
      );
    }

    const viewerTenantId = employee.tenant_id as string;

    // -------------------------------------------------------------------------
    // F3.3 STEP 3: Get enabledLenderIds for this tenant from tenant_lenders.
    // -------------------------------------------------------------------------
    const { data: tenantLenderRows, error: tenantLendersError } =
      await supabaseAdmin
        .from("tenant_lenders")
        .select("lender_id")
        .eq("tenant_id", viewerTenantId)
        .eq("is_active", true);

    if (tenantLendersError) {
      console.error(
        "[match] tenant_lenders lookup failed.",
        tenantLendersError
      );
      return NextResponse.json(
        { success: false, error: "Failed to load tenant catalog." },
        { status: 500 }
      );
    }

    const enabledLenderIds: string[] = ((tenantLenderRows ?? []) as Array<{
      lender_id?: string | null;
    }>)
      .map((r) => r.lender_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const payload = (await req.json()) as FormPayload;

    // PHASE 5: Load funnel answers if scenario_id present.
    const funnelAnswers = payload.session_id
      ? await loadFunnelAnswers(payload.session_id, viewerTenantId)
      : null;

    // -------------------------------------------------------------------------
    // F3.3 STEP 4: Empty-tenant edge case.
    // If the tenant has no enabled lenders, short-circuit. Don't run
    // .in('id', []) — Supabase behavior on empty IN is inconsistent and we
    // already know the answer is "no matches possible." The agency loop
    // would also produce nothing because it iterates allLenders.
    // -------------------------------------------------------------------------
    if (enabledLenderIds.length === 0) {
      console.warn("[match] tenant has no enabled lenders.", {
        teamUserId: teamUser.id,
        tenantId: viewerTenantId,
      });
      return NextResponse.json({
        success: true,
        next_question: null,
        top_recommendation:
          "No lenders are configured for your account. Contact your admin to enable lender programs.",
        openai_enhancement: null,
        strong_matches: [],
        conditional_matches: [],
        eliminated_paths: [],
        lender_summary: {
          active_lender_count: 0,
          active_lenders_checked: [],
          matched_lenders_in_results: [],
        },
        summary: {
          total_guidelines_checked: 0,
          strong_count: 0,
          conditional_count: 0,
          eliminated_count: 0,
        },
      });
    }

    // -------------------------------------------------------------------------
    // F3.3 STEP 5: Catalog reads. `createClient` is preserved for the
    // catalog reads to avoid mid-F3.3 client-instance churn (see header
    // comment). Tenant scoping enforced via `.in('lender_id', ...)` and
    // `.in('id', ...)` filters.
    // -------------------------------------------------------------------------
    const supabase = createClient();

    // Pull active lender programs scoped to this tenant's enabled lenders,
    // with their lender + guideline relations.
    const { data: programs, error: programsError } = await supabase
      .from("programs")
      .select(`
        id,
        name,
        slug,
        loan_category,
        is_active,
        lender_id,
        underwriting_method,
        lenders ( id, name, states ),
        program_guidelines ( * )
      `)
      .eq("is_active", true)
      .in("lender_id", enabledLenderIds);

    if (programsError) {
      return NextResponse.json(
        { success: false, error: `Failed to load programs: ${programsError.message}` },
        { status: 500 }
      );
    }

    // Pull lenders scoped to this tenant's enabled lender ids, with capability
    // flags and type. The lender_type != 'agency' filter is preserved as
    // defense in depth — agencies (Fannie Mae, Freddie Mac, etc.) are
    // investors/GSEs that publish selling guides, not placement options for
    // borrowers, and should never appear in the candidate pool. The matcher
    // pairs each agency guideline with the wholesale lenders capable of
    // placing it (capability flags drive that loop), which is why agencies
    // are excluded from the candidate pool here.
    const { data: lendersData, error: lendersError } = await supabase
      .from("lenders")
      .select("id, name, lender_type, does_conventional, does_fha, does_va, does_usda, aus_methods")
      .in("id", enabledLenderIds)
      .or("lender_type.is.null,lender_type.neq.agency");

    if (lendersError) {
      return NextResponse.json(
        { success: false, error: `Failed to load lenders: ${lendersError.message}` },
        { status: 500 }
      );
    }

    const allLenders = (lendersData || []) as LenderRow[];

    // Map for O(1) lookup of full LenderRow by id. Used by the AUS gate in the
    // lender-program loop where the row's joined `lenders` field only carries
    // `id, name, states` (not aus_methods).
    const lendersById = new Map<string, LenderRow>();
    for (const lender of allLenders) {
      lendersById.set(lender.id, lender);
    }

    // Pull active agency programs from global_guidelines.
    // NOT tenant-scoped — Fannie/Freddie/FHA/VA/USDA selling guides are
    // shared across all shops by design. Agency programs pair with each
    // tenant's enabled wholesale lenders via capability flags in the
    // agency loop below, so tenant scoping is enforced through the lender
    // pairing, not the agency guideline read.
    const { data: agencyData, error: agencyError } = await supabase
      .from("global_guidelines")
      .select("*")
      .eq("is_active", true);

    if (agencyError) {
      return NextResponse.json(
        { success: false, error: `Failed to load agency guidelines: ${agencyError.message}` },
        { status: 500 }
      );
    }

    const agencyGuidelines = (agencyData || []) as GlobalGuidelineRow[];

    // Pull state eligibility for the borrower's subject state, scoped to
    // this tenant's enabled lenders.
    const subjectState = String(payload.subject_state || "").trim().toUpperCase();
    let stateEligibilityRows: StateEligibilityRow[] = [];
    if (subjectState) {
      const { data: stateRows, error: stateError } = await supabase
        .from("lender_state_eligibility")
        .select("*")
        .eq("state_code", subjectState)
        .in("lender_id", enabledLenderIds);
      if (stateError) {
        return NextResponse.json(
          { success: false, error: `Failed to load state eligibility: ${stateError.message}` },
          { status: 500 }
        );
      }
      stateEligibilityRows = (stateRows || []) as StateEligibilityRow[];
    }
    const stateByLender = new Map<string, StateEligibilityRow>();
    for (const row of stateEligibilityRows) {
      stateByLender.set(row.lender_id, row);
    }

    const allRows = (programs || []) as unknown as ProgramRow[];

    const strongMatches: MatchBucket[] = [];
    const conditionalMatches: MatchBucket[] = [];
    const eliminatedPaths: MatchBucket[] = [];

    const activeLenderNames = new Set<string>();
    const matchedLenderNames = new Set<string>();

    // -------- LENDER PROGRAM PASS --------
    for (const program of allRows) {
      const lenderJoin: LenderJoin | null = Array.isArray(program.lenders)
        ? ((program.lenders[0] as LenderJoin) || null)
        : ((program.lenders as LenderJoin | null) || null);
      const lenderName = lenderJoin?.name || "Unknown Lender";
      const lenderId = program.lender_id;
      const programName = program.name || "Unknown Program";

      activeLenderNames.add(lenderName);

      // -----------------------------------------------------------------------
      // AUS gate (Phase 7.5)
      // If the program declares a specific required AUS / underwriting method
      // and the lender does not accept that method, eliminate the pairing
      // before any guideline-level evaluation. Skip silently when the program
      // requires 'either' (no AUS gating).
      // -----------------------------------------------------------------------
      const programRequiredAus = program.underwriting_method;
      if (programRequiredAus && programRequiredAus !== "either") {
        const fullLender = lendersById.get(lenderId);
        if (fullLender && !lenderAcceptsAusMethod(fullLender.aus_methods, programRequiredAus)) {
          const acceptedDisplay =
            (fullLender.aus_methods || []).map(describeAusMethod).join("/") || "(none)";
          const requiredDisplay = describeAusMethod(programRequiredAus);
          eliminatedPaths.push({
            lender_name: lenderName,
            lender_id: lenderId,
            program_name: programName,
            program_slug: program.slug,
            loan_category: program.loan_category,
            guideline_id: "",
            notes: [],
            missing_items: [],
            blockers: [
              `${lenderName} accepts ${acceptedDisplay} but ${programName} requires ${requiredDisplay}.`,
            ],
            strengths: [],
            concerns: [],
            explanation: `${programName} via ${lenderName} cannot be placed: lender does not run ${requiredDisplay} and the program requires it.`,
            score: 0,
            required_reserves_months: null,
          });
          continue;
        }
      }

      const activeGuidelines = (Array.isArray(program.program_guidelines)
        ? (program.program_guidelines as GuidelineRow[])
        : []
      ).filter((g) => g.is_active);

      if (activeGuidelines.length === 0) continue;

      const candidateGuidelines = activeGuidelines.filter(hasSufficientGuidelineData);
      if (candidateGuidelines.length === 0) continue;

      // Pre-filter: prefer guideline rows whose occupancy + transaction arrays
      // cover the borrower's scenario. For multi-row programs (FNBA's FlexFirst
      // HELOC etc.), this routes the evaluation to the guideline row that
      // actually represents the borrower's case — so the LO sees the right
      // elimination reason (e.g., "LTV too high on the investment row") instead
      // of an irrelevant one ("occupancy mismatch on the primary row").
      // If no rows fit the scenario, fall back to evaluating all candidates so
      // the program still surfaces a meaningful elimination explanation.
      const occupancyType = String(payload.occupancy_type || "").trim();
      const transactionType = String(payload.transaction_type || "").trim();

      const scenarioRelevantGuidelines = candidateGuidelines.filter((g) => {
        const occArr = toStringArray(g.occupancy_types);
        const txnArr = toStringArray(g.transaction_types);
        const occMatches =
          !occupancyType ||
          occArr.length === 0 ||
          arrayContainsNormalized(occArr, occupancyType, "occupancy");
        const txnMatches =
          !transactionType ||
          txnArr.length === 0 ||
          arrayContainsNormalized(txnArr, transactionType);
        return occMatches && txnMatches;
      });

      const guidelinesToEvaluate =
        scenarioRelevantGuidelines.length > 0
          ? scenarioRelevantGuidelines
          : candidateGuidelines;

      const stateEligibility = stateByLender.get(lenderId) || null;

      // Evaluate every active+sufficient guideline row and keep the best fit.
      // Programs with one guideline row behave exactly as before; programs
      // with multiple rows (FNBA's multi-occupancy / multi-transaction design)
      // now correctly choose the row that matches the borrower scenario.
      let bestEvaluation: EvaluationResult | null = null;
      let bestGuideline: GuidelineRow | null = null;

      for (const candidate of guidelinesToEvaluate) {
        const evaluation = evaluateLenderProgram(
          candidate,
          payload,
          stateEligibility,
          lenderName,
          programName,
          program.loan_category
        );
        if (!bestEvaluation || isBetterEvaluation(evaluation, bestEvaluation)) {
          bestEvaluation = evaluation;
          bestGuideline = candidate;
        }
      }

      if (!bestEvaluation || !bestGuideline) continue;

      const guideline = bestGuideline;
      const evaluation = bestEvaluation;

      const bucketEntry: MatchBucket = {
        lender_name: lenderName,
        lender_id: lenderId,
        program_name: programName,
        program_slug: program.slug,
        loan_category: program.loan_category,
        guideline_id: guideline.id,
        notes: guideline.guideline_notes ? [guideline.guideline_notes] : [],
        missing_items: evaluation.missingItems,
        blockers: evaluation.blockers,
        strengths: evaluation.strengths,
        concerns: evaluation.concerns,
        explanation: evaluation.explanation,
        score: evaluation.score,
        required_reserves_months: guideline.reserves_required_months,
      };

      // PHASE 5: Apply funnel-aware tier impact (lender program).
      const funnelImpact = applyFunnelTierImpact(evaluation, funnelAnswers, {
        isAgency: false,
        loanCategory: program.loan_category || undefined,
        programName,
      });
      if (funnelImpact.addedBlockers.length > 0) bucketEntry.blockers = [...bucketEntry.blockers, ...funnelImpact.addedBlockers];
      if (funnelImpact.addedConcerns.length > 0) bucketEntry.concerns = [...bucketEntry.concerns, ...funnelImpact.addedConcerns];
      bucketEntry.score = Math.max(0, bucketEntry.score + funnelImpact.scoreDelta);
      evaluation.bucket = funnelImpact.newBucket;

      if (evaluation.bucket === "strong") {
        strongMatches.push(bucketEntry);
        matchedLenderNames.add(lenderName);
      } else if (evaluation.bucket === "conditional") {
        conditionalMatches.push(bucketEntry);
        matchedLenderNames.add(lenderName);
      } else {
        eliminatedPaths.push(bucketEntry);
      }
    }

    // -------- AGENCY PROGRAM PASS (Phase 2) --------
    for (const agencyGuideline of agencyGuidelines) {
      const capabilityFlag = getCapabilityFlagForAgency(agencyGuideline.agency);
      if (!capabilityFlag) continue; // Unknown agency — skip

      // Find all lenders that have this capability flag set to true
      const eligibleLenders = allLenders.filter((lender) => lender[capabilityFlag] === true);

      for (const lender of eligibleLenders) {
        activeLenderNames.add(lender.name || "Unknown Lender");

        // ---------------------------------------------------------------------
        // AUS gate (Phase 7.5)
        // If the agency program declares a specific required AUS / underwriting
        // method and the lender does not accept that method, eliminate the
        // pairing before evaluation. Skip silently when the agency program
        // requires 'either' (no AUS gating).
        // ---------------------------------------------------------------------
        const agencyRequiredAus = agencyGuideline.underwriting_method;
        if (agencyRequiredAus && agencyRequiredAus !== "either") {
          if (!lenderAcceptsAusMethod(lender.aus_methods, agencyRequiredAus)) {
            const lenderNameForBlocker = lender.name || "Unknown Lender";
            const programDisplay = `${agencyGuideline.program_name} (${agencyGuideline.agency})`;
            const acceptedDisplay =
              (lender.aus_methods || []).map(describeAusMethod).join("/") || "(none)";
            const requiredDisplay = describeAusMethod(agencyRequiredAus);
            eliminatedPaths.push({
              lender_name: lenderNameForBlocker,
              lender_id: lender.id,
              program_name: programDisplay,
              program_slug: null,
              loan_category: `${agencyGuideline.agency} ${agencyGuideline.product_family}`,
              guideline_id: agencyGuideline.id,
              notes: [],
              missing_items: [],
              blockers: [
                `${lenderNameForBlocker} accepts ${acceptedDisplay} but ${programDisplay} requires ${requiredDisplay}.`,
              ],
              strengths: [],
              concerns: [],
              explanation: `${programDisplay} via ${lenderNameForBlocker} cannot be placed: lender does not run ${requiredDisplay} and the program requires it.`,
              score: 0,
              required_reserves_months: null,
            });
            continue;
          }
        }

        const stateEligibility = stateByLender.get(lender.id) || null;

        const evaluation = evaluateAgencyProgramForLender(
          agencyGuideline,
          lender,
          stateEligibility,
          payload
        );

        const programNameDisplay = `${agencyGuideline.program_name} (${agencyGuideline.agency})`;
        const lenderNameDisplay = lender.name || "Unknown Lender";

        const bucketEntry: MatchBucket = {
          lender_name: lenderNameDisplay,
          lender_id: lender.id,
          program_name: programNameDisplay,
          program_slug: null,
          loan_category: `${agencyGuideline.agency} ${agencyGuideline.product_family}`,
          guideline_id: agencyGuideline.id,
          notes: agencyGuideline.notes ? [agencyGuideline.notes] : [],
          missing_items: evaluation.missingItems,
          blockers: evaluation.blockers,
          strengths: evaluation.strengths,
          concerns: evaluation.concerns,
          explanation: evaluation.explanation,
          score: evaluation.score,
          required_reserves_months: null,
        };

        // PHASE 5: Apply funnel-aware tier impact (agency program).
        const funnelImpactAgency = applyFunnelTierImpact(evaluation, funnelAnswers, {
          isAgency: true,
          agency: agencyGuideline.agency,
          productFamily: agencyGuideline.product_family,
          programName: agencyGuideline.program_name,
        });
        if (funnelImpactAgency.addedBlockers.length > 0) bucketEntry.blockers = [...bucketEntry.blockers, ...funnelImpactAgency.addedBlockers];
        if (funnelImpactAgency.addedConcerns.length > 0) bucketEntry.concerns = [...bucketEntry.concerns, ...funnelImpactAgency.addedConcerns];
        bucketEntry.score = Math.max(0, bucketEntry.score + funnelImpactAgency.scoreDelta);
        evaluation.bucket = funnelImpactAgency.newBucket;

        if (evaluation.bucket === "strong") {
          strongMatches.push(bucketEntry);
          matchedLenderNames.add(lenderNameDisplay);
        } else if (evaluation.bucket === "conditional") {
          conditionalMatches.push(bucketEntry);
          matchedLenderNames.add(lenderNameDisplay);
        } else {
          eliminatedPaths.push(bucketEntry);
        }
      }
    }

    // Sort by score descending
    strongMatches.sort((a, b) => b.score - a.score);
    conditionalMatches.sort((a, b) => b.score - a.score);
    eliminatedPaths.sort((a, b) => b.score - a.score);

    let topRecommendation = "";
    if (strongMatches.length > 0) {
      const top = strongMatches[0];
      topRecommendation = `${top.program_name} with ${top.lender_name} appears to be the leading direction based on the documented qualification facts.`;
    } else if (conditionalMatches.length > 0) {
      const top = conditionalMatches[0];
      topRecommendation = `${top.program_name} with ${top.lender_name} is the closest conditional path; confirm open items before placement.`;
    } else if (eliminatedPaths.length > 0) {
      topRecommendation = `No path currently survives the documented constraints. Review eliminated paths to identify which constraint to revisit or which lender programs may need to be added.`;
    }

    const topConditional = conditionalMatches.length > 0 ? conditionalMatches[0] : null;
    const nextQuestion = buildNextQuestion(
      payload,
      strongMatches.length,
      conditionalMatches.length,
      eliminatedPaths.length,
      topConditional as unknown as TopConditionalSummary | null
    );

    console.log("[match] completed", {
      teamUserId: teamUser.id,
      tenantId: viewerTenantId,
      enabledLenderCount: enabledLenderIds.length,
      activeLenderCount: activeLenderNames.size,
      matchedLenderCount: matchedLenderNames.size,
      programsLoaded: allRows.length,
      agencyGuidelinesLoaded: agencyGuidelines.length,
      strongCount: strongMatches.length,
      conditionalCount: conditionalMatches.length,
      eliminatedCount: eliminatedPaths.length,
    });

    const tieredView = groupIntoTiers(strongMatches, conditionalMatches);

    return NextResponse.json({
      success: true,
      next_question: nextQuestion,
      top_recommendation: topRecommendation,
      openai_enhancement: null,
      strong_matches: strongMatches,
      tiers: tieredView,
      conditional_matches: conditionalMatches,
      eliminated_paths: eliminatedPaths,
      lender_summary: {
        active_lender_count: activeLenderNames.size,
        active_lenders_checked: Array.from(activeLenderNames).sort(),
        matched_lenders_in_results: Array.from(matchedLenderNames).sort(),
      },
      summary: {
        total_guidelines_checked: allRows.length + agencyGuidelines.length,
        strong_count: strongMatches.length,
        conditional_count: conditionalMatches.length,
        eliminated_count: eliminatedPaths.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown matcher error.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
