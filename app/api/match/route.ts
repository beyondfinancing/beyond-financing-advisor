import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type BorrowerStatus =
  | "citizen"
  | "permanent_resident"
  | "non_permanent_resident"
  | "itin_borrower"
  | "daca"
  | "foreign_national"
  | "";

type OccupancyType =
  | "primary_residence"
  | "second_home"
  | "investment_property"
  | "";

type TransactionType =
  | "purchase"
  | "rate_term_refinance"
  | "cash_out_refinance"
  | "second_lien"
  | "";

type IncomeType =
  | "full_doc"
  | "express_doc"
  | "bank_statements"
  | "1099"
  | "pnl"
  | "asset_utilization"
  | "dscr"
  | "no_ratio"
  | "wvoe"
  | "";

type PropertyType =
  | "single_family"
  | "condo"
  | "townhouse"
  | "2_unit"
  | "3_unit"
  | "4_unit"
  | "mixed_use"
  | "5_to_8_units"
  | "";

type QualificationInput = {
  borrower_status: BorrowerStatus;
  occupancy_type: OccupancyType;
  transaction_type: TransactionType;
  income_type: IncomeType;
  property_type: PropertyType;
  credit_score: number | null;
  ltv: number | null;
  dti: number | null;
  loan_amount: number | null;
  units: number | null;
  first_time_homebuyer: boolean | null;
  subject_state: string;
  available_reserves_months: number | null;
};

type RawProgramRelation = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  loan_category?: unknown;
  lender_id?: unknown;
  lenders?: unknown;
} | null;

type RawLenderRelation = {
  id?: unknown;
  name?: unknown;
} | null;

type RawProgramGuidelineRow = {
  id?: unknown;
  program_id?: unknown;
  borrower_statuses?: unknown;
  occupancy_types?: unknown;
  transaction_types?: unknown;
  income_types?: unknown;
  property_types?: unknown;
  min_credit_score?: unknown;
  max_ltv?: unknown;
  max_dti?: unknown;
  min_loan_amount?: unknown;
  max_loan_amount?: unknown;
  min_units?: unknown;
  max_units?: unknown;
  first_time_homebuyer_allowed?: unknown;
  reserves_required_months?: unknown;
  guideline_notes?: unknown;
  ask_before_match?: unknown;
  programs?: unknown;
};

type RawLenderStateEligibilityRow = {
  lender_id?: unknown;
  state_code?: unknown;
  owner_occupied_allowed?: unknown;
  non_owner_occupied_allowed?: unknown;
  second_home_allowed?: unknown;
  heloc_allowed?: unknown;
  notes?: unknown;
};

type ProgramRelation = {
  id: string;
  name: string;
  slug: string;
  loan_category: string | null;
  lender_id: string;
  lenders: {
    id: string;
    name: string;
  } | null;
} | null;

type ProgramGuidelineRow = {
  id: string;
  program_id: string;
  borrower_statuses: string[];
  occupancy_types: string[];
  transaction_types: string[];
  income_types: string[];
  property_types: string[];
  min_credit_score: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
  min_units: number | null;
  max_units: number | null;
  first_time_homebuyer_allowed: boolean | null;
  reserves_required_months: number | null;
  guideline_notes: string | null;
  ask_before_match: string[];
  programs: ProgramRelation;
};

type LenderStateEligibility = {
  lender_id: string;
  state_code: string;
  owner_occupied_allowed: boolean;
  non_owner_occupied_allowed: boolean;
  second_home_allowed: boolean;
  heloc_allowed: boolean;
  notes: string | null;
};

type MatchBucket = {
  lender_name: string;
  lender_id: string;
  program_name: string;
  program_slug: string;
  loan_category: string | null;
  guideline_id: string;
  reserves_required_months: number | null;
  notes: string[];
  missing_items: string[];
  blockers: string[];
  strengths: string[];
  concerns: string[];
  explanation: string;
  score: number;
};

type OpenAiEnhancement = {
  topRecommendation: string;
  whyItMatches: string[];
  cautionItems: string[];
  nextBestQuestion: string;
} | null;

const FIELD_LABELS: Record<string, string> = {
  borrower_status: "borrower status",
  occupancy_type: "occupancy type",
  transaction_type: "transaction type",
  income_type: "income type",
  property_type: "property type",
  credit_score: "credit score",
  ltv: "LTV",
  dti: "DTI",
  loan_amount: "loan amount",
  units: "unit count",
  first_time_homebuyer: "first-time-homebuyer status",
  subject_state: "subject state",
  available_reserves_months: "available reserves (months of PITIA)",
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;

  const str = String(value).trim().toLowerCase();
  if (["yes", "true", "y", "1"].includes(str)) return true;
  if (["no", "false", "n", "0"].includes(str)) return false;

  return null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeState(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function mapBorrowerStatus(value: unknown): BorrowerStatus {
  const v = normalizeText(value);

  if (!v) return "";
  if (v === "citizen" || v === "us citizen" || v === "u s citizen" || v === "american citizen") {
    return "citizen";
  }
  if (
    v === "permanent_resident" ||
    v === "permanent resident" ||
    v === "green card" ||
    v === "green card holder"
  ) {
    return "permanent_resident";
  }
  if (
    v === "non_permanent_resident" ||
    v === "non permanent resident" ||
    v === "nonpermanent resident" ||
    v === "visa" ||
    v === "work visa" ||
    v === "temporary visa"
  ) {
    return "non_permanent_resident";
  }
  if (v === "itin_borrower" || v === "itin borrower" || v === "itin") {
    return "itin_borrower";
  }
  if (v === "daca") {
    return "daca";
  }
  if (v === "foreign_national" || v === "foreign national" || v === "foreign") {
    return "foreign_national";
  }

  return "";
}

function mapOccupancyType(value: unknown): OccupancyType {
  const v = normalizeText(value);

  if (!v) return "";
  if (
    v === "primary_residence" ||
    v === "primary residence" ||
    v === "primary" ||
    v === "owner occupied" ||
    v === "owner occupied primary"
  ) {
    return "primary_residence";
  }
  if (v === "second_home" || v === "second home" || v === "vacation home") {
    return "second_home";
  }
  if (
    v === "investment_property" ||
    v === "investment property" ||
    v === "investment" ||
    v === "investor" ||
    v === "rental" ||
    v === "non owner occupied"
  ) {
    return "investment_property";
  }

  return "";
}

function mapTransactionType(value: unknown): TransactionType {
  const v = normalizeText(value);

  if (!v) return "";
  if (v === "purchase") return "purchase";
  if (
    v === "rate_term_refinance" ||
    v === "rate term refinance" ||
    v === "rate term refi" ||
    v === "rate and term refinance" ||
    v === "refinance"
  ) {
    return "rate_term_refinance";
  }
  if (
    v === "cash_out_refinance" ||
    v === "cash out refinance" ||
    v === "cash out refi" ||
    v === "cash out"
  ) {
    return "cash_out_refinance";
  }
  if (v === "second_lien" || v === "second lien" || v === "heloc" || v === "home equity") {
    return "second_lien";
  }

  return "";
}

function mapIncomeType(value: unknown): IncomeType {
  const v = normalizeText(value);

  if (!v) return "";
  if (v === "full_doc" || v === "full doc" || v === "full documentation" || v === "w2" || v === "w 2") {
    return "full_doc";
  }
  if (v === "express_doc" || v === "express doc") return "express_doc";
  if (
    v === "bank_statements" ||
    v === "bank statement" ||
    v === "bank statements" ||
    v === "12 month bank statements"
  ) {
    return "bank_statements";
  }
  if (v === "1099") return "1099";
  if (v === "pnl" || v === "p and l" || v === "profit and loss") return "pnl";
  if (v === "asset_utilization" || v === "asset utilization" || v === "asset depletion") {
    return "asset_utilization";
  }
  if (v === "dscr") return "dscr";
  if (v === "no_ratio" || v === "no ratio" || v === "stated" || v === "stated income") {
    return "no_ratio";
  }
  if (v === "wvoe" || v === "written verification of employment") {
    return "wvoe";
  }

  return "";
}

function mapPropertyType(value: unknown): PropertyType {
  const v = normalizeText(value);

  if (!v) return "";
  if (
    v === "single_family" ||
    v === "single family" ||
    v === "single family residence" ||
    v === "sfr" ||
    v === "1 unit" ||
    v === "1 unit sfr"
  ) {
    return "single_family";
  }
  if (v === "condo") return "condo";
  if (v === "townhouse" || v === "townhome") return "townhouse";
  if (v === "2_unit" || v === "2 unit" || v === "duplex" || v === "two unit") return "2_unit";
  if (v === "3_unit" || v === "3 unit" || v === "triplex" || v === "three unit") return "3_unit";
  if (v === "4_unit" || v === "4 unit" || v === "four unit") return "4_unit";
  if (v === "mixed_use" || v === "mixed use" || v === "mixed use property") return "mixed_use";
  if (
    v === "5_to_8_units" ||
    v === "5 to 8 units" ||
    v === "5 8 units" ||
    v === "5 unit" ||
    v === "6 unit" ||
    v === "7 unit" ||
    v === "8 unit"
  ) {
    return "5_to_8_units";
  }

  return "";
}

function inferUnitsFromPropertyType(propertyType: PropertyType): number | null {
  if (propertyType === "single_family" || propertyType === "condo" || propertyType === "townhouse") return 1;
  if (propertyType === "2_unit") return 2;
  if (propertyType === "3_unit") return 3;
  if (propertyType === "4_unit") return 4;
  return null;
}

function normalizeBody(body: unknown): QualificationInput {
  const obj = (body ?? {}) as Record<string, unknown>;

  const borrower_status = mapBorrowerStatus(obj.borrower_status ?? obj.borrowerStatus ?? obj.status);
  const occupancy_type = mapOccupancyType(obj.occupancy_type ?? obj.occupancyType ?? obj.occupancy);
  const transaction_type = mapTransactionType(obj.transaction_type ?? obj.transactionType ?? obj.transaction);
  const income_type = mapIncomeType(obj.income_type ?? obj.incomeType ?? obj.income);
  const property_type = mapPropertyType(obj.property_type ?? obj.propertyType ?? obj.property);

  const credit_score = toNumber(obj.credit_score ?? obj.creditScore ?? obj.credit);
  const ltv = toNumber(obj.ltv ?? obj.loan_to_value ?? obj.loanToValue);
  const dti = toNumber(obj.dti ?? obj.debt_to_income ?? obj.debtToIncome);
  const loan_amount = toNumber(obj.loan_amount ?? obj.loanAmount);
  const explicitUnits = toNumber(obj.units ?? obj.unit_count ?? obj.unitCount);
  const first_time_homebuyer = toBooleanOrNull(
    obj.first_time_homebuyer ?? obj.firstTimeHomebuyer ?? obj.fthb
  );
  const subject_state = normalizeState(
    obj.subject_state ?? obj.subjectState ?? obj.property_state ?? obj.propertyState ?? obj.state
  );
  const available_reserves_months = toNumber(
    obj.available_reserves_months ?? obj.availableReservesMonths ?? obj.reserves_months ?? obj.reservesMonths
  );

  return {
    borrower_status,
    occupancy_type,
    transaction_type,
    income_type,
    property_type,
    credit_score,
    ltv,
    dti,
    loan_amount,
    units: explicitUnits ?? inferUnitsFromPropertyType(property_type),
    first_time_homebuyer,
    subject_state,
    available_reserves_months,
  };
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
          .filter(Boolean);
      }
    } catch {
      // ignore parse error
    }

    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeProgramRelation(value: unknown): ProgramRelation {
  let programRaw: RawProgramRelation = null;

  if (Array.isArray(value)) {
    programRaw = (value[0] ?? null) as RawProgramRelation;
  } else {
    programRaw = (value ?? null) as RawProgramRelation;
  }

  if (!programRaw || typeof programRaw !== "object") return null;

  const lendersRaw = Array.isArray(programRaw.lenders)
    ? ((programRaw.lenders[0] ?? null) as RawLenderRelation)
    : ((programRaw.lenders ?? null) as RawLenderRelation);

  const lender =
    lendersRaw && typeof lendersRaw === "object"
      ? {
          id: normalizeString(lendersRaw.id),
          name: normalizeString(lendersRaw.name),
        }
      : null;

  return {
    id: normalizeString(programRaw.id),
    name: normalizeString(programRaw.name),
    slug: normalizeString(programRaw.slug),
    loan_category:
      programRaw.loan_category === null || programRaw.loan_category === undefined
        ? null
        : String(programRaw.loan_category),
    lender_id: normalizeString(programRaw.lender_id),
    lenders: lender && (lender.id || lender.name) ? lender : null,
  };
}

function normalizeGuidelineRow(raw: RawProgramGuidelineRow): ProgramGuidelineRow {
  return {
    id: normalizeString(raw.id),
    program_id: normalizeString(raw.program_id),
    borrower_statuses: normalizeArray(raw.borrower_statuses),
    occupancy_types: normalizeArray(raw.occupancy_types),
    transaction_types: normalizeArray(raw.transaction_types),
    income_types: normalizeArray(raw.income_types),
    property_types: normalizeArray(raw.property_types),
    min_credit_score: toNumber(raw.min_credit_score),
    max_ltv: toNumber(raw.max_ltv),
    max_dti: toNumber(raw.max_dti),
    min_loan_amount: toNumber(raw.min_loan_amount),
    max_loan_amount: toNumber(raw.max_loan_amount),
    min_units: toNumber(raw.min_units),
    max_units: toNumber(raw.max_units),
    first_time_homebuyer_allowed: toBooleanOrNull(raw.first_time_homebuyer_allowed),
    reserves_required_months: toNumber(raw.reserves_required_months),
    guideline_notes:
      raw.guideline_notes === null || raw.guideline_notes === undefined
        ? null
        : String(raw.guideline_notes),
    ask_before_match: normalizeArray(raw.ask_before_match),
    programs: normalizeProgramRelation(raw.programs),
  };
}

function normalizeLenderStateEligibilityRow(raw: RawLenderStateEligibilityRow): LenderStateEligibility {
  return {
    lender_id: normalizeString(raw.lender_id),
    state_code: normalizeState(raw.state_code),
    owner_occupied_allowed: Boolean(raw.owner_occupied_allowed),
    non_owner_occupied_allowed: Boolean(raw.non_owner_occupied_allowed),
    second_home_allowed: Boolean(raw.second_home_allowed),
    heloc_allowed: Boolean(raw.heloc_allowed),
    notes: raw.notes === null || raw.notes === undefined ? null : String(raw.notes),
  };
}

function includesOrEmpty(list: string[], value: string): boolean {
  if (!list || list.length === 0) return true;
  return list.includes(value);
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildBaseBucket(row: ProgramGuidelineRow): MatchBucket {
  return {
    lender_name: row.programs?.lenders?.name || "Unknown Lender",
    lender_id: row.programs?.lenders?.id || "",
    program_name: row.programs?.name || "Unknown Program",
    program_slug: row.programs?.slug || "",
    loan_category: row.programs?.loan_category || null,
    guideline_id: row.id,
    reserves_required_months: row.reserves_required_months,
    notes: [],
    missing_items: [],
    blockers: [],
    strengths: [],
    concerns: [],
    explanation: "",
    score: 50,
  };
}

function addProgramIdentityScoring(bucket: MatchBucket, input: QualificationInput) {
  const slug = bucket.program_slug.toLowerCase();
  const name = bucket.program_name.toLowerCase();
  const combined = `${slug} ${name}`;

  if (input.borrower_status === "itin_borrower" && combined.includes("itin")) {
    bucket.score += 18;
    bucket.strengths.push("Direct ITIN borrower fit.");
  }

  if (input.income_type === "bank_statements" && combined.includes("bank")) {
    bucket.score += 16;
    bucket.strengths.push("Program identity directly aligns with bank-statement qualification.");
  }

  if (input.income_type === "dscr" && (combined.includes("dscr") || combined.includes("investor"))) {
    bucket.score += 16;
    bucket.strengths.push("Program identity directly aligns with DSCR / investor qualification.");
  }

  if (input.occupancy_type === "investment_property" && combined.includes("investor")) {
    bucket.score += 10;
    bucket.strengths.push("Program identity strongly fits investment-property direction.");
  }

  if (
    combined.includes("jade") ||
    combined.includes("opal") ||
    combined.includes("plus") ||
    combined.includes("umbrella")
  ) {
    bucket.score -= 4;
    bucket.concerns.push("This appears to be a broader umbrella option rather than the narrowest direct-fit path.");
  }
}

function addBoundaryScoring(bucket: MatchBucket, row: ProgramGuidelineRow, input: QualificationInput) {
  if (input.credit_score !== null && row.min_credit_score !== null) {
    const cushion = input.credit_score - row.min_credit_score;

    if (cushion >= 80) {
      bucket.score += 10;
      bucket.strengths.push("Credit profile appears comfortably above the minimum floor.");
    } else if (cushion >= 40) {
      bucket.score += 6;
      bucket.strengths.push("Credit profile appears solid for this path.");
    } else if (cushion >= 0) {
      bucket.score += 2;
      bucket.notes.push("Credit score clears the floor but is not far above it.");
    }
  }

  if (input.ltv !== null && row.max_ltv !== null) {
    const cushion = row.max_ltv - input.ltv;

    if (cushion >= 20) {
      bucket.score += 10;
      bucket.strengths.push("LTV appears materially inside the guideline ceiling.");
    } else if (cushion >= 10) {
      bucket.score += 6;
      bucket.strengths.push("LTV appears comfortably inside the guideline ceiling.");
    } else if (cushion >= 0) {
      bucket.score += 2;
      bucket.notes.push("LTV is allowed but relatively close to the upper boundary.");
    }
  }

  if (input.dti !== null && row.max_dti !== null) {
    const cushion = row.max_dti - input.dti;

    if (cushion >= 15) {
      bucket.score += 8;
      bucket.strengths.push("DTI appears comfortably inside the guideline ceiling.");
    } else if (cushion >= 7) {
      bucket.score += 4;
      bucket.strengths.push("DTI appears acceptable for this path.");
    } else if (cushion >= 0) {
      bucket.score += 1;
      bucket.notes.push("DTI is allowed but relatively close to the upper boundary.");
    }
  }

  if (input.loan_amount !== null) {
    if (row.min_loan_amount !== null && input.loan_amount >= row.min_loan_amount) {
      bucket.score += 2;
    }
    if (row.max_loan_amount !== null && input.loan_amount <= row.max_loan_amount) {
      bucket.score += 2;
    }
  }

  if (input.units !== null) {
    if (row.min_units !== null && input.units >= row.min_units) {
      bucket.score += 1;
    }
    if (row.max_units !== null && input.units <= row.max_units) {
      bucket.score += 1;
    }
  }

  if (input.first_time_homebuyer !== null) {
    if (row.first_time_homebuyer_allowed === true && input.first_time_homebuyer === true) {
      bucket.score += 3;
      bucket.strengths.push("Program appears open to first-time-homebuyer layering.");
    } else if (row.first_time_homebuyer_allowed === false && input.first_time_homebuyer === true) {
      bucket.score -= 2;
      bucket.concerns.push("Program may not be ideal for first-time-homebuyer benefit layering.");
    }
  }

  if (row.reserves_required_months !== null) {
    if (input.available_reserves_months !== null) {
      if (input.available_reserves_months >= row.reserves_required_months) {
        bucket.score += 5;
        bucket.strengths.push(
          `Available reserves appear to cover the program requirement of ${row.reserves_required_months} month(s) PITIA.`
        );
      } else {
        bucket.blockers.push(
          `Available reserves appear below the required ${row.reserves_required_months} month(s) PITIA.`
        );
      }
    } else {
      if (row.reserves_required_months >= 12) {
        bucket.score -= 4;
        bucket.concerns.push(`Higher reserve burden noted: ${row.reserves_required_months} month(s) PITIA.`);
      } else if (row.reserves_required_months >= 6) {
        bucket.score -= 2;
        bucket.notes.push(`Reserves requirement noted: ${row.reserves_required_months} month(s) PITIA.`);
      } else {
        bucket.score += 1;
        bucket.notes.push(`Reserves requirement noted: ${row.reserves_required_months} month(s) PITIA.`);
      }
    }
  }
}

function buildExplanation(bucket: MatchBucket): string {
  const parts: string[] = [];

  if (bucket.strengths.length > 0) {
    parts.push(`Strong because ${bucket.strengths.join(" ")}`);
  }

  if (bucket.concerns.length > 0) {
    parts.push(`Watch items: ${bucket.concerns.join(" ")}`);
  }

  if (bucket.blockers.length > 0) {
    parts.push(`Eliminated because ${bucket.blockers.join(" ")}`);
  }

  if (bucket.missing_items.length > 0) {
    parts.push(`Still conditional because these items remain missing: ${bucket.missing_items.join(", ")}.`);
  }

  if (parts.length === 0) {
    return "Guideline reviewed. No major narrative explanation was generated.";
  }

  return parts.join(" ");
}

function applyGenericCategoryBlockers(
  bucket: MatchBucket,
  row: ProgramGuidelineRow,
  input: QualificationInput
) {
  const loanCategory = (row.programs?.loan_category || "").toLowerCase();

  if (input.transaction_type === "purchase" && (loanCategory === "heloc" || loanCategory === "second")) {
    bucket.blockers.push("Purchase scenarios should not be matched to HELOC or second-lien products.");
  }
}

function makeEligibilityKey(lenderId: string, stateCode: string): string {
  return `${lenderId}__${stateCode}`;
}

function applyLenderStateEligibility(
  bucket: MatchBucket,
  row: ProgramGuidelineRow,
  input: QualificationInput,
  lenderEligibilityMap: Map<string, LenderStateEligibility>
) {
  if (!input.subject_state || !row.programs?.lender_id) return;

  const key = makeEligibilityKey(row.programs.lender_id, input.subject_state);
  const eligibility = lenderEligibilityMap.get(key);

  if (!eligibility) {
    bucket.blockers.push(
      `${bucket.lender_name} is not configured as eligible in ${input.subject_state}.`
    );
    return;
  }

  if (input.occupancy_type === "primary_residence" && !eligibility.owner_occupied_allowed) {
    bucket.blockers.push(
      `${bucket.lender_name} is not eligible for owner-occupied lending in ${input.subject_state}.`
    );
  }

  if (input.occupancy_type === "second_home" && !eligibility.second_home_allowed) {
    bucket.blockers.push(
      `${bucket.lender_name} is not eligible for second-home lending in ${input.subject_state}.`
    );
  }

  if (input.occupancy_type === "investment_property" && !eligibility.non_owner_occupied_allowed) {
    bucket.blockers.push(
      `${bucket.lender_name} is not eligible for non-owner-occupied lending in ${input.subject_state}.`
    );
  }

  const loanCategory = (row.programs?.loan_category || "").toLowerCase();
  if (loanCategory === "heloc" && !eligibility.heloc_allowed) {
    bucket.blockers.push(
      `${bucket.lender_name} is not eligible for HELOC lending in ${input.subject_state}.`
    );
  }

  if (eligibility.notes) {
    bucket.notes.push(`State eligibility note: ${eligibility.notes}`);
  }
}

function evaluateRow(
  row: ProgramGuidelineRow,
  input: QualificationInput,
  lenderEligibilityMap: Map<string, LenderStateEligibility>
): { bucket: MatchBucket; status: "strong" | "conditional" | "eliminated" } {
  const bucket = buildBaseBucket(row);
  const requiredAskFields = row.ask_before_match || [];

  for (const field of requiredAskFields) {
    const value = (input as Record<string, unknown>)[field];
    if (isMissing(value)) {
      bucket.missing_items.push(FIELD_LABELS[field] || field);
      bucket.score -= 5;
    }
  }

  applyGenericCategoryBlockers(bucket, row, input);
  applyLenderStateEligibility(bucket, row, input, lenderEligibilityMap);

  if (input.borrower_status) {
    if (!includesOrEmpty(row.borrower_statuses, input.borrower_status)) {
      bucket.blockers.push("Borrower status does not fit this program.");
    } else {
      bucket.score += 12;
      bucket.strengths.push("Borrower status fits the program.");
    }
  }

  if (input.occupancy_type) {
    if (!includesOrEmpty(row.occupancy_types, input.occupancy_type)) {
      bucket.blockers.push("Occupancy does not fit this program.");
    } else {
      bucket.score += 10;
      bucket.strengths.push("Occupancy fits the program.");
    }
  }

  if (input.transaction_type) {
    if (!includesOrEmpty(row.transaction_types, input.transaction_type)) {
      bucket.blockers.push("Transaction type does not fit this program.");
    } else {
      bucket.score += 10;
      bucket.strengths.push("Transaction type fits the program.");
    }
  }

  if (input.income_type) {
    if (!includesOrEmpty(row.income_types, input.income_type)) {
      bucket.blockers.push("Income documentation type does not fit this program.");
    } else {
      bucket.score += 12;
      bucket.strengths.push("Income documentation type fits the program.");
    }
  }

  if (input.property_type) {
    if (!includesOrEmpty(row.property_types, input.property_type)) {
      bucket.blockers.push("Property type does not fit this program.");
    } else {
      bucket.score += 8;
      bucket.strengths.push("Property type fits the program.");
    }
  }

  if (input.credit_score !== null && row.min_credit_score !== null) {
    if (input.credit_score < row.min_credit_score) {
      bucket.blockers.push(`Credit score is below the minimum guideline of ${row.min_credit_score}.`);
    }
  }

  if (input.ltv !== null && row.max_ltv !== null) {
    if (input.ltv > row.max_ltv) {
      bucket.blockers.push(`LTV exceeds the maximum guideline of ${row.max_ltv}%.`);
    }
  }

  if (input.dti !== null && row.max_dti !== null) {
    if (input.dti > row.max_dti) {
      bucket.blockers.push(`DTI exceeds the maximum guideline of ${row.max_dti}%.`);
    }
  }

  if (input.loan_amount !== null) {
    if (row.min_loan_amount !== null && input.loan_amount < row.min_loan_amount) {
      bucket.blockers.push(
        `Loan amount is below the minimum guideline of $${row.min_loan_amount.toLocaleString()}.`
      );
    }

    if (row.max_loan_amount !== null && input.loan_amount > row.max_loan_amount) {
      bucket.blockers.push(
        `Loan amount exceeds the maximum guideline of $${row.max_loan_amount.toLocaleString()}.`
      );
    }
  }

  if (input.units !== null) {
    if (row.min_units !== null && input.units < row.min_units) {
      bucket.blockers.push("Unit count is below the program minimum.");
    }

    if (row.max_units !== null && input.units > row.max_units) {
      bucket.blockers.push("Unit count exceeds the program maximum.");
    }
  }

  if (
    input.first_time_homebuyer !== null &&
    row.first_time_homebuyer_allowed === false &&
    input.first_time_homebuyer === true
  ) {
    bucket.concerns.push("Program may not be ideal for first-time-homebuyer layering.");
    bucket.score -= 3;
  }

  addProgramIdentityScoring(bucket, input);
  addBoundaryScoring(bucket, row, input);

  if (row.guideline_notes) {
    bucket.notes.push(row.guideline_notes);
  }

  bucket.notes = uniqueStrings(bucket.notes);
  bucket.missing_items = uniqueStrings(bucket.missing_items);
  bucket.blockers = uniqueStrings(bucket.blockers);
  bucket.strengths = uniqueStrings(bucket.strengths);
  bucket.concerns = uniqueStrings(bucket.concerns);

  bucket.score = Math.max(1, Math.min(100, bucket.score));
  bucket.explanation = buildExplanation(bucket);

  if (bucket.blockers.length > 0) {
    return { bucket, status: "eliminated" };
  }

  if (bucket.missing_items.length > 0) {
    return { bucket, status: "conditional" };
  }

  return { bucket, status: "strong" };
}

function nextMissingQuestion(input: QualificationInput): string {
  if (!input.subject_state) {
    return "What is the subject property state?";
  }

  if (!input.borrower_status) {
    return "What is the borrower’s status: U.S. citizen, permanent resident, non-permanent resident, ITIN borrower, DACA, or foreign national?";
  }

  if (!input.occupancy_type) {
    return "Will the subject property be a primary residence, second home, or investment property?";
  }

  if (!input.transaction_type) {
    return "Is this a purchase, rate-term refinance, cash-out refinance, or second-lien scenario?";
  }

  if (!input.income_type) {
    return "How will the borrower qualify: full-doc, bank statements, 1099, P&L, asset utilization, DSCR, no-ratio, or another income path?";
  }

  if (!input.property_type) {
    return "What is the property type: single-family, condo, townhouse, 2-unit, 3-unit, 4-unit, mixed-use, or 5-to-8-units?";
  }

  if (input.credit_score === null) {
    return "What is the borrower’s estimated middle credit score?";
  }

  if (input.ltv === null) {
    return "What is the estimated LTV for this scenario?";
  }

  if (input.dti === null) {
    return "What is the estimated DTI?";
  }

  if (input.loan_amount === null) {
    return "What is the target loan amount?";
  }

  if (input.units === null) {
    return "How many residential units does the subject property have?";
  }

  if (input.first_time_homebuyer === null) {
    return "Is the borrower a first-time homebuyer?";
  }

  if (input.available_reserves_months === null) {
    return "How many months of PITIA reserves are available?";
  }

  return "What compensating factor is strongest here: reserves, lower LTV, stronger credit, stronger income documentation, or property flexibility?";
}

async function getOpenAiEnhancement(args: {
  input: QualificationInput;
  strongMatches: MatchBucket[];
  conditionalMatches: MatchBucket[];
  eliminatedPaths: MatchBucket[];
  defaultNextQuestion: string;
}): Promise<OpenAiEnhancement> {
  if (!process.env.OPENAI_API_KEY) return null;

  const { input, strongMatches, conditionalMatches, eliminatedPaths, defaultNextQuestion } = args;

  const compactStrong = strongMatches.slice(0, 5).map((item) => ({
    lender_name: item.lender_name,
    program_name: item.program_name,
    program_slug: item.program_slug,
    loan_category: item.loan_category,
    score: item.score,
    explanation: item.explanation,
    notes: item.notes,
    strengths: item.strengths,
    concerns: item.concerns,
    reserves_required_months: item.reserves_required_months,
  }));

  const compactConditional = conditionalMatches.slice(0, 5).map((item) => ({
    lender_name: item.lender_name,
    program_name: item.program_name,
    program_slug: item.program_slug,
    score: item.score,
    missing_items: item.missing_items,
    explanation: item.explanation,
    notes: item.notes,
    reserves_required_months: item.reserves_required_months,
  }));

  const compactEliminated = eliminatedPaths.slice(0, 5).map((item) => ({
    lender_name: item.lender_name,
    program_name: item.program_name,
    program_slug: item.program_slug,
    blockers: item.blockers,
  }));

  const prompt = `
You are Finley Beyond, an internal mortgage qualification reasoning layer for Beyond Financing.

Return strict JSON only in this exact shape:
{
  "topRecommendation": "string",
  "whyItMatches": ["string"],
  "cautionItems": ["string"],
  "nextBestQuestion": "string"
}

Rules:
- Be practical, mortgage-specific, and concise
- Do not promise approval
- Base your answer only on the structured scenario and the ranked match results below
- If the structured results already show strong matches, explain the best current direction
- If there are no strong matches, explain the best conditional direction
- nextBestQuestion should be the single most useful follow-up question for narrowing the file
- do not ask for fields already present in the scenario
- explicitly consider reserves and state eligibility when relevant

Scenario:
${JSON.stringify(input, null, 2)}

Strong matches:
${JSON.stringify(compactStrong, null, 2)}

Conditional matches:
${JSON.stringify(compactConditional, null, 2)}

Eliminated paths:
${JSON.stringify(compactEliminated, null, 2)}

Fallback next question:
${defaultNextQuestion}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You generate concise internal mortgage match explanations in strict JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) return null;

    const parsed = parseJsonSafely<{
      topRecommendation?: unknown;
      whyItMatches?: unknown;
      cautionItems?: unknown;
      nextBestQuestion?: unknown;
    }>(content);

    if (!parsed) return null;

    return {
      topRecommendation:
        typeof parsed.topRecommendation === "string" ? parsed.topRecommendation : "",
      whyItMatches: Array.isArray(parsed.whyItMatches)
        ? parsed.whyItMatches.map((x) => String(x)).filter(Boolean)
        : [],
      cautionItems: Array.isArray(parsed.cautionItems)
        ? parsed.cautionItems.map((x) => String(x)).filter(Boolean)
        : [],
      nextBestQuestion:
        typeof parsed.nextBestQuestion === "string" && parsed.nextBestQuestion.trim()
          ? parsed.nextBestQuestion
          : defaultNextQuestion,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = normalizeBody(body);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("program_guidelines")
      .select(`
        id,
        program_id,
        borrower_statuses,
        occupancy_types,
        transaction_types,
        income_types,
        property_types,
        min_credit_score,
        max_ltv,
        max_dti,
        min_loan_amount,
        max_loan_amount,
        min_units,
        max_units,
        first_time_homebuyer_allowed,
        reserves_required_months,
        guideline_notes,
        ask_before_match,
        programs (
          id,
          name,
          slug,
          loan_category,
          lender_id,
          lenders (
            id,
            name
          )
        )
      `)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const rawRows = Array.isArray(data) ? (data as RawProgramGuidelineRow[]) : [];
    const rows = rawRows.map(normalizeGuidelineRow).filter((row) => row.programs);

    const lenderIds = uniqueStrings(
      rows.map((row) => row.programs?.lender_id || "").filter(Boolean)
    );

    const lenderEligibilityMap = new Map<string, LenderStateEligibility>();

    if (input.subject_state && lenderIds.length > 0) {
      const { data: eligibilityData, error: eligibilityError } = await supabase
        .from("lender_state_eligibility")
        .select(`
          lender_id,
          state_code,
          owner_occupied_allowed,
          non_owner_occupied_allowed,
          second_home_allowed,
          heloc_allowed,
          notes
        `)
        .eq("state_code", input.subject_state)
        .in("lender_id", lenderIds);

      if (eligibilityError) {
        return NextResponse.json(
          { success: false, error: eligibilityError.message },
          { status: 500 }
        );
      }

      const normalizedEligibility = Array.isArray(eligibilityData)
        ? (eligibilityData as RawLenderStateEligibilityRow[]).map(normalizeLenderStateEligibilityRow)
        : [];

      for (const item of normalizedEligibility) {
        lenderEligibilityMap.set(makeEligibilityKey(item.lender_id, item.state_code), item);
      }
    }

    const strong_matches: MatchBucket[] = [];
    const conditional_matches: MatchBucket[] = [];
    const eliminated_paths: MatchBucket[] = [];

    for (const row of rows) {
      const result = evaluateRow(row, input, lenderEligibilityMap);

      if (result.status === "strong") strong_matches.push(result.bucket);
      if (result.status === "conditional") conditional_matches.push(result.bucket);
      if (result.status === "eliminated") eliminated_paths.push(result.bucket);
    }

    strong_matches.sort((a, b) => b.score - a.score);
    conditional_matches.sort((a, b) => b.score - a.score);
    eliminated_paths.sort((a, b) => b.score - a.score);

    const defaultNextQuestion = nextMissingQuestion(input);

    const openai = await getOpenAiEnhancement({
      input,
      strongMatches: strong_matches,
      conditionalMatches: conditional_matches,
      eliminatedPaths: eliminated_paths,
      defaultNextQuestion,
    });

    const topRecommendation =
      openai?.topRecommendation ||
      (strong_matches[0]
        ? `${strong_matches[0].program_name} with ${strong_matches[0].lender_name}`
        : conditional_matches[0]
        ? `${conditional_matches[0].program_name} with ${conditional_matches[0].lender_name}`
        : "No strong program direction yet.");

    const activeLendersChecked = uniqueStrings(
      rows.map((row) => row.programs?.lenders?.name || "").filter(Boolean)
    );

    const matchedLendersInResults = uniqueStrings(
      [
        ...strong_matches.map((item) => item.lender_name),
        ...conditional_matches.map((item) => item.lender_name),
        ...eliminated_paths.map((item) => item.lender_name),
      ].filter(Boolean)
    );

    return NextResponse.json({
      success: true,
      intake: input,
      summary: {
        total_guidelines_checked: rows.length,
        strong_count: strong_matches.length,
        conditional_count: conditional_matches.length,
        eliminated_count: eliminated_paths.length,
      },
      lender_summary: {
        active_lender_count: activeLendersChecked.length,
        active_lenders_checked: activeLendersChecked,
        matched_lenders_in_results: matchedLendersInResults,
      },
      next_question: openai?.nextBestQuestion || defaultNextQuestion,
      top_recommendation: topRecommendation,
      openai_enhancement: openai,
      strong_matches,
      conditional_matches,
      eliminated_paths,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected match engine failure.",
      },
      { status: 500 }
    );
  }
}
