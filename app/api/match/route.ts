import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type BorrowerStatus =
  | "citizen"
  | "permanent_resident"
  | "non_permanent_resident"
  | "itin"
  | "daca"
  | "foreign_national"
  | "";

type OccupancyType = "primary" | "second_home" | "investment" | "";
type TransactionType = "purchase" | "rate_term" | "cash_out" | "";
type IncomeType =
  | "w2"
  | "self_employed_tax_returns"
  | "bank_statements"
  | "1099"
  | "p_and_l"
  | "asset_utilization"
  | "dscr"
  | "";

type PropertyType =
  | "single_family"
  | "condo"
  | "multi_family"
  | "mixed_use"
  | "manufactured"
  | "";

type MatchInput = {
  borrowerStatus?: BorrowerStatus;
  occupancyType?: OccupancyType;
  transactionType?: TransactionType;
  incomeType?: IncomeType;
  propertyType?: PropertyType;
  creditScore?: number | null;
  ltv?: number | null;
  dti?: number | null;
  loanAmount?: number | null;
  units?: number | null;
  firstTimeHomebuyer?: boolean | null;
};

type GuidelineRow = {
  id: string;
  program_id: string;
  borrower_statuses: string[] | null;
  occupancy_types: string[] | null;
  transaction_types: string[] | null;
  income_types: string[] | null;
  property_types: string[] | null;
  min_credit_score: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
  max_units: number | null;
  requires_itin: boolean | null;
  allows_itin: boolean | null;
  allows_daca: boolean | null;
  allows_foreign_national: boolean | null;
  allows_non_permanent_resident: boolean | null;
  allows_first_time_homebuyer: boolean | null;
  guideline_summary: string | null;
  overlay_notes: string | null;
  missing_items_prompt: string | null;
  programs: {
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
};

function includesOrEmpty(list: string[] | null, value: string | undefined) {
  if (!list || list.length === 0) return true;
  if (!value) return true;
  return list.includes(value);
}

function pushMissing(missing: Set<string>, condition: boolean, label: string) {
  if (condition) missing.add(label);
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const body = (await req.json()) as MatchInput;

    const borrowerStatus = body.borrowerStatus || "";
    const occupancyType = body.occupancyType || "";
    const transactionType = body.transactionType || "";
    const incomeType = body.incomeType || "";
    const propertyType = body.propertyType || "";

    const creditScore =
      typeof body.creditScore === "number" ? body.creditScore : null;
    const ltv = typeof body.ltv === "number" ? body.ltv : null;
    const dti = typeof body.dti === "number" ? body.dti : null;
    const loanAmount =
      typeof body.loanAmount === "number" ? body.loanAmount : null;
    const units = typeof body.units === "number" ? body.units : null;
    const firstTimeHomebuyer =
      typeof body.firstTimeHomebuyer === "boolean"
        ? body.firstTimeHomebuyer
        : null;

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
        max_units,
        requires_itin,
        allows_itin,
        allows_daca,
        allows_foreign_national,
        allows_non_permanent_resident,
        allows_first_time_homebuyer,
        guideline_summary,
        overlay_notes,
        missing_items_prompt,
        programs!inner (
          id,
          name,
          slug,
          loan_category,
          lender_id,
          lenders!inner (
            id,
            name
          )
        )
      `)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load program guidelines." },
        { status: 500 }
      );
    }

    const rows = (Array.isArray(data) ? data : []) as GuidelineRow[];

    const strong_matches: unknown[] = [];
    const conditional_matches: unknown[] = [];
    const eliminated_matches: unknown[] = [];

    const globalMissing = new Set<string>();

    for (const row of rows) {
      const missing = new Set<string>();
      const hardFails: string[] = [];
      const softFlags: string[] = [];

      pushMissing(missing, !borrowerStatus, "borrowerStatus");
      pushMissing(missing, !occupancyType, "occupancyType");
      pushMissing(missing, !transactionType, "transactionType");
      pushMissing(missing, !incomeType, "incomeType");
      pushMissing(missing, !propertyType, "propertyType");
      pushMissing(missing, creditScore === null, "creditScore");
      pushMissing(missing, ltv === null, "ltv");
      pushMissing(missing, dti === null, "dti");
      pushMissing(missing, loanAmount === null, "loanAmount");
      pushMissing(missing, units === null, "units");

      if (!includesOrEmpty(row.borrower_statuses, borrowerStatus)) {
        hardFails.push(`Borrower status not allowed for this program.`);
      }

      if (!includesOrEmpty(row.occupancy_types, occupancyType)) {
        hardFails.push(`Occupancy type not allowed.`);
      }

      if (!includesOrEmpty(row.transaction_types, transactionType)) {
        hardFails.push(`Transaction type not allowed.`);
      }

      if (!includesOrEmpty(row.income_types, incomeType)) {
        hardFails.push(`Income type not allowed.`);
      }

      if (!includesOrEmpty(row.property_types, propertyType)) {
        hardFails.push(`Property type not allowed.`);
      }

      if (borrowerStatus === "itin") {
        if (row.requires_itin === false) {
          hardFails.push(`Program is not structured for ITIN borrowers.`);
        }
        if (row.allows_itin === false) {
          hardFails.push(`ITIN borrowers not allowed.`);
        }
      }

      if (borrowerStatus === "daca" && row.allows_daca === false) {
        hardFails.push(`DACA borrowers not allowed.`);
      }

      if (
        borrowerStatus === "foreign_national" &&
        row.allows_foreign_national === false
      ) {
        hardFails.push(`Foreign national borrowers not allowed.`);
      }

      if (
        borrowerStatus === "non_permanent_resident" &&
        row.allows_non_permanent_resident === false
      ) {
        hardFails.push(`Non-permanent residents not allowed.`);
      }

      if (
        firstTimeHomebuyer === true &&
        row.allows_first_time_homebuyer === false
      ) {
        hardFails.push(`First-time homebuyers not allowed.`);
      }

      if (creditScore !== null && row.min_credit_score !== null) {
        if (creditScore < row.min_credit_score) {
          hardFails.push(
            `Credit score ${creditScore} is below minimum ${row.min_credit_score}.`
          );
        }
      } else if (row.min_credit_score !== null) {
        softFlags.push(`Minimum credit score must be confirmed.`);
      }

      if (ltv !== null && row.max_ltv !== null) {
        if (ltv > row.max_ltv) {
          hardFails.push(`LTV ${ltv}% exceeds max ${row.max_ltv}%.`);
        }
      } else if (row.max_ltv !== null) {
        softFlags.push(`LTV must be confirmed.`);
      }

      if (dti !== null && row.max_dti !== null) {
        if (dti > row.max_dti) {
          hardFails.push(`DTI ${dti}% exceeds max ${row.max_dti}%.`);
        }
      } else if (row.max_dti !== null) {
        softFlags.push(`DTI must be confirmed.`);
      }

      if (loanAmount !== null && row.min_loan_amount !== null) {
        if (loanAmount < row.min_loan_amount) {
          hardFails.push(
            `Loan amount ${loanAmount} is below minimum ${row.min_loan_amount}.`
          );
        }
      }

      if (loanAmount !== null && row.max_loan_amount !== null) {
        if (loanAmount > row.max_loan_amount) {
          hardFails.push(
            `Loan amount ${loanAmount} exceeds max ${row.max_loan_amount}.`
          );
        }
      } else if (row.max_loan_amount !== null) {
        softFlags.push(`Final loan amount must be confirmed.`);
      }

      if (units !== null && row.max_units !== null) {
        if (units > row.max_units) {
          hardFails.push(`Unit count ${units} exceeds max ${row.max_units}.`);
        }
      } else if (row.max_units !== null) {
        softFlags.push(`Unit count must be confirmed.`);
      }

      for (const item of missing) {
        globalMissing.add(item);
      }

      const payload = {
        lender_name: row.programs?.lenders?.name || "Unknown Lender",
        program_name: row.programs?.name || "Unknown Program",
        program_slug: row.programs?.slug || "",
        loan_category: row.programs?.loan_category || null,
        guideline_summary: row.guideline_summary,
        overlay_notes: row.overlay_notes,
        missing_items_prompt: row.missing_items_prompt,
        missing_items: Array.from(missing),
        soft_flags: softFlags,
      };

      if (hardFails.length > 0) {
        eliminated_matches.push({
          ...payload,
          hard_fails: hardFails,
        });
      } else if (softFlags.length > 0 || missing.size > 0) {
        conditional_matches.push(payload);
      } else {
        strong_matches.push(payload);
      }
    }

    return NextResponse.json({
      strong_matches,
      conditional_matches,
      eliminated_matches,
      missing_items: Array.from(globalMissing),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
