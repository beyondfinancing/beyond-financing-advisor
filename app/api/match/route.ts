// =============================================================================
// PASTE THIS FILE AT (replace existing entirely):
//
//     app/api/match/route.ts
//
// =============================================================================
//
// PHASE 1 SUPABASE-BACKED MATCHER (TypeScript-safe relations version)
//
// Reads from: programs + program_guidelines + lenders + lender_state_eligibility
//
// Returns the contract expected by app/finley/page.tsx:
//   strong_matches, conditional_matches, eliminated_paths,
//   next_question, top_recommendation, lender_summary, summary
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

function borrowerStatusMatches(
  borrowerStatuses: string[],
  inputStatus: string,
  guideline: GuidelineRow
): boolean {
  if (!inputStatus) return true;

  const normalizedInput = normalizeToken(inputStatus);

  if (borrowerStatuses.length > 0) {
    for (const item of borrowerStatuses) {
      if (normalizeToken(item) === normalizedInput) return true;
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
// Guideline completeness check (option b: skip if insufficient)
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
// Per-program evaluation
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

function evaluateProgram(
  guideline: GuidelineRow,
  payload: FormPayload,
  stateEligibility: StateEligibilityRow | null,
  lenderName: string,
  programName: string
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
    if (!arrayContainsNormalized(occupancyTypes, occupancyType, "occupancy")) {
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
    }
    if (occupancyTypes.length > 0) {
      strengths.push(`Occupancy (${occupancyType.replace(/_/g, " ")}) is permitted.`);
    }
  } else {
    missingItems.push("Occupancy type");
  }

  if (transactionType) {
    const transactionTypes = toStringArray(guideline.transaction_types);
    if (!arrayContainsNormalized(transactionTypes, transactionType)) {
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
    }
    if (transactionTypes.length > 0) {
      strengths.push(`Transaction type (${transactionType.replace(/_/g, " ")}) is permitted.`);
    }
  } else {
    missingItems.push("Transaction type");
  }

  if (incomeType) {
    const incomeTypes = toStringArray(guideline.income_types);
    if (!arrayContainsNormalized(incomeTypes, incomeType)) {
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
    }
    if (incomeTypes.length > 0) {
      strengths.push(`Income type (${incomeType.replace(/_/g, " ")}) is accepted.`);
    }
  } else {
    missingItems.push("Income type");
  }

  if (propertyType) {
    const propertyTypes = toStringArray(guideline.property_types);
    if (!arrayContainsNormalized(propertyTypes, propertyType)) {
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
    }
    if (propertyTypes.length > 0) {
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
// POST handler
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as FormPayload;

    const supabase = createClient();

    const { data: programs, error: programsError } = await supabase
      .from("programs")
      .select(`
        id,
        name,
        slug,
        loan_category,
        is_active,
        lender_id,
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

    for (const program of allRows) {
      // Normalize lender join (Supabase may return as object or array)
      const lenderJoin: LenderJoin | null = Array.isArray(program.lenders)
        ? ((program.lenders[0] as LenderJoin) || null)
        : ((program.lenders as LenderJoin | null) || null);
      const lenderName = lenderJoin?.name || "Unknown Lender";
      const lenderId = program.lender_id;
      const programName = program.name || "Unknown Program";

      activeLenderNames.add(lenderName);

      const activeGuidelines = (Array.isArray(program.program_guidelines)
        ? (program.program_guidelines as GuidelineRow[])
        : []
      ).filter((g) => g.is_active);

      if (activeGuidelines.length === 0) continue;

      const guideline = activeGuidelines.find(hasSufficientGuidelineData);
      if (!guideline) continue;

      const stateEligibility = stateByLender.get(lenderId) || null;

      const evaluation = evaluateProgram(
        guideline,
        payload,
        stateEligibility,
        lenderName,
        programName
      );

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
        total_guidelines_checked: allRows.length,
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
