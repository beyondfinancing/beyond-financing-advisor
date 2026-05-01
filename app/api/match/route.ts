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
import { createClient } from "@/lib/supabase/server";

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

function buildNextQuestion(
  payload: FormPayload,
  strongCount: number,
  conditionalCount: number,
  eliminatedCount: number
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
    return "Please review the conditional matches and confirm the items flagged for closer review.";
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
// POST handler
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as FormPayload;

    const supabase = createClient();

    // Pull all active lender programs with their lender + guideline relations
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
      .eq("is_active", true);

    if (programsError) {
      return NextResponse.json(
        { success: false, error: `Failed to load programs: ${programsError.message}` },
        { status: 500 }
      );
    }

    // Pull all lenders with capability flags and type. Filter out agencies
    // (Fannie Mae, Freddie Mac, etc.) — they are investors/GSEs that publish
    // selling guides, not placement options for borrowers. The matcher pairs
    // each agency guideline with the wholesale lenders capable of placing it,
    // which is why agencies should never appear in the candidate pool.
    const { data: lendersData, error: lendersError } = await supabase
      .from("lenders")
      .select("id, name, lender_type, does_conventional, does_fha, does_va, does_usda, aus_methods")
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

    // Pull active agency programs from global_guidelines
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

    // Pull state eligibility for the borrower's subject state
    const subjectState = String(payload.subject_state || "").trim().toUpperCase();
    let stateEligibilityRows: StateEligibilityRow[] = [];
    if (subjectState) {
      const { data: stateRows, error: stateError } = await supabase
        .from("lender_state_eligibility")
        .select("*")
        .eq("state_code", subjectState);
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

    const nextQuestion = buildNextQuestion(
      payload,
      strongMatches.length,
      conditionalMatches.length,
      eliminatedPaths.length
    );

    return NextResponse.json({
      success: true,
      next_question: nextQuestion,
      top_recommendation: topRecommendation,
      openai_enhancement: null,
      strong_matches: strongMatches,
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
