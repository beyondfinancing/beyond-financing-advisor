import { NextResponse } from "next/server";

type MissingItem =
  | "borrowerStatus"
  | "occupancyType"
  | "transactionType"
  | "incomeType"
  | "propertyType"
  | "creditScore"
  | "ltv"
  | "dti"
  | "loanAmount"
  | "units";

const QUESTION_MAP: Record<MissingItem, string> = {
  borrowerStatus:
    "To help narrow the correct financing path, are you a U.S. citizen, permanent resident, non-permanent resident, ITIN borrower, DACA borrower, or foreign national?",
  occupancyType:
    "Would this property be a primary residence, second home, or investment property?",
  transactionType:
    "Is this transaction a purchase, rate-and-term refinance, or cash-out refinance?",
  incomeType:
    "How would this borrower qualify for income: W-2, tax returns, bank statements, 1099, profit and loss, asset utilization, or DSCR?",
  propertyType:
    "What property type are we discussing: single-family, condo, multi-family, mixed-use, or manufactured home?",
  creditScore:
    "What is the borrower’s current middle credit score or best estimated credit score?",
  ltv: "What is the approximate loan-to-value ratio or down payment percentage?",
  dti: "Do you know the borrower’s approximate debt-to-income ratio?",
  loanAmount: "What loan amount are you targeting?",
  units: "How many units does the property have?",
};

const PRIORITY: MissingItem[] = [
  "borrowerStatus",
  "occupancyType",
  "transactionType",
  "incomeType",
  "propertyType",
  "creditScore",
  "loanAmount",
  "ltv",
  "units",
  "dti",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const missingItems = Array.isArray(body?.missingItems)
      ? (body.missingItems as MissingItem[])
      : [];

    const next = PRIORITY.find((item) => missingItems.includes(item));

    return NextResponse.json({
      nextQuestion: next ? QUESTION_MAP[next] : null,
      nextField: next || null,
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
