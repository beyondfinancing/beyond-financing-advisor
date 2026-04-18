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
};

type RawProgramGuidelineRow = {
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
  min_units: number | null;
  max_units: number | null;
  first_time_homebuyer_allowed: boolean | null;
  reserves_required_months: number | null;
  guideline_notes: string | null;
  ask_before_match: unknown;
  programs: {
    id: string;
    name: string;
    slug: string;
    loan_category: string | null;
    lender_id: string;
    lenders:
      | {
          id: string;
          name: string;
        }
      | null;
  } | null;
};

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
  programs: {
    id: string;
    name: string;
    slug: string;
    loan_category: string | null;
    lender_id: string;
    lenders:
      | {
          id: string;
          name: string;
        }
      | null;
  } | null;
};

type MatchBucket = {
  lender_name: string;
  lender_id: string;
  program_name: string;
  program_slug: string;
  loan_category: string | null;
  guideline_id: string;
  notes: string[];
  missing_items: string[];
  blockers: string[];
  score: number;
};

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
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase().trim();
  if (s === "yes" || s === "true") return true;
  if (s === "no" || s === "false") return false;
  return null;
}

function normalizeBody(body: any): QualificationInput {
  return {
    borrower_status: (body?.borrower_status || "") as BorrowerStatus,
    occupancy_type: (body?.occupancy_type || "") as OccupancyType,
    transaction_type: (body?.transaction_type || "") as TransactionType,
    income_type: (body?.income_type || "") as IncomeType,
    property_type: (body?.property_type || "") as PropertyType,
    credit_score: toNumber(body?.credit_score),
    ltv: toNumber(body?.ltv),
    dti: toNumber(body?.dti),
    loan_amount: toNumber(body?.loan_amount),
    units: toNumber(body?.units),
    first_time_homebuyer: toBooleanOrNull(body?.first_time_homebuyer),
  };
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function normalizeArray(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0);
      }
    } catch {
      return [trimmed];
    }

    return [trimmed];
  }

  return [];
}

function includesOrEmpty(list: string[], value: string): boolean {
  if (!list || list.length === 0) return true;
  return list.includes(value);
}

function normalizeGuidelineRow(row: RawProgramGuidelineRow): ProgramGuidelineRow {
  return {
    ...row,
    borrower_statuses: normalizeArray(row.borrower_statuses),
    occupancy_types: normalizeArray(row.occupancy_types),
    transaction_types: normalizeArray(row.transaction_types),
    income_types: normalizeArray(row.income_types),
    property_types: normalizeArray(row.property_types),
    ask_before_match: normalizeArray(row.ask_before_match),
  };
}

function buildBaseBucket(row: ProgramGuidelineRow): MatchBucket {
  return {
    lender_name: row.programs?.lenders?.name || "Unknown Lender",
    lender_id: row.programs?.lenders?.id || "",
    program_name: row.programs?.name || "Unknown Program",
    program_slug: row.programs?.slug || "",
    loan_category: row.programs?.loan_category || null,
    guideline_id: row.id,
    notes: [],
    missing_items: [],
    blockers: [],
    score: 100,
  };
}

function evaluateRow(
  row: ProgramGuidelineRow,
  input: QualificationInput
): { bucket: MatchBucket; status: "strong" | "conditional" | "eliminated" } {
  const bucket = buildBaseBucket(row);
  const requiredAskFields = row.ask_before_match || [];

  for (const field of requiredAskFields) {
    const value = (input as any)[field];
    if (isMissing(value)) {
      bucket.missing_items.push(FIELD_LABELS[field] || field);
      bucket.score -= 8;
    }
  }

  if (input.borrower_status && !includesOrEmpty(row.borrower_statuses, input.borrower_status)) {
    bucket.blockers.push("Borrower status does not fit this program.");
  }

  if (input.occupancy_type && !includesOrEmpty(row.occupancy_types, input.occupancy_type)) {
    bucket.blockers.push("Occupancy does not fit this program.");
  }

  if (input.transaction_type && !includesOrEmpty(row.transaction_types, input.transaction_type)) {
    bucket.blockers.push("Transaction type does not fit this program.");
  }

  if (input.income_type && !includesOrEmpty(row.income_types, input.income_type)) {
    bucket.blockers.push("Income documentation type does not fit this program.");
  }

  if (input.property_type && !includesOrEmpty(row.property_types, input.property_type)) {
    bucket.blockers.push("Property type does not fit this program.");
  }

  if (input.credit_score !== null && row.min_credit_score !== null) {
    if (input.credit_score < row.min_credit_score) {
      bucket.blockers.push(
        `Credit score is below the minimum guideline of ${row.min_credit_score}.`
      );
    } else if (input.credit_score <= row.min_credit_score + 20) {
      bucket.notes.push("Credit score is close to the floor for this program.");
      bucket.score -= 5;
    }
  }

  if (input.ltv !== null && row.max_ltv !== null) {
    if (input.ltv > row.max_ltv) {
      bucket.blockers.push(`LTV exceeds the maximum guideline of ${row.max_ltv}%.`);
    } else if (input.ltv >= row.max_ltv - 5) {
      bucket.notes.push("LTV is near the upper guideline boundary.");
      bucket.score -= 5;
    }
  }

  if (input.dti !== null && row.max_dti !== null) {
    if (input.dti > row.max_dti) {
      bucket.blockers.push(`DTI exceeds the maximum guideline of ${row.max_dti}%.`);
    } else if (input.dti >= row.max_dti - 5) {
      bucket.notes.push("DTI is near the upper guideline boundary.");
      bucket.score -= 5;
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
    bucket.notes.push("This program is not oriented to first-time-homebuyer benefit layering.");
    bucket.score -= 4;
  }

  if (row.guideline_notes) {
    bucket.notes.push(row.guideline_notes);
  }

  if (row.reserves_required_months !== null) {
    bucket.notes.push(`Reserves requirement noted: ${row.reserves_required_months} month(s).`);
  }

  if (bucket.blockers.length > 0) {
    return { bucket, status: "eliminated" };
  }

  if (bucket.missing_items.length > 0) {
    return { bucket, status: "conditional" };
  }

  return { bucket, status: "strong" };
}

function nextMissingQuestion(input: QualificationInput): string {
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
    return "How will the borrower qualify: full-doc, bank statements, 1099, P&L, asset utilization, DSCR, no-ratio, WVOE, or another income path?";
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

  return "What compensating factor is strongest here: reserves, lower LTV, stronger credit, or stronger income documentation?";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = normalizeBody(body);
    const supabase = createClient();

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

    const rawRows: RawProgramGuidelineRow[] = Array.isArray(data)
      ? (data as RawProgramGuidelineRow[])
      : [];

    const rows: ProgramGuidelineRow[] = rawRows.map(normalizeGuidelineRow);

    const strong_matches: MatchBucket[] = [];
    const conditional_matches: MatchBucket[] = [];
    const eliminated_paths: MatchBucket[] = [];

    for (const row of rows) {
      const result = evaluateRow(row, input);

      if (result.status === "strong") strong_matches.push(result.bucket);
      if (result.status === "conditional") conditional_matches.push(result.bucket);
      if (result.status === "eliminated") eliminated_paths.push(result.bucket);
    }

    strong_matches.sort((a, b) => b.score - a.score);
    conditional_matches.sort((a, b) => b.score - a.score);
    eliminated_paths.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      intake: input,
      summary: {
        total_guidelines_checked: rows.length,
        strong_count: strong_matches.length,
        conditional_count: conditional_matches.length,
        eliminated_count: eliminated_paths.length,
      },
      next_question: nextMissingQuestion(input),
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
