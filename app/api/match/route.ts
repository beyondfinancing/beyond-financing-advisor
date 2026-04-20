import { NextResponse } from "next/server";

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

type CitizenshipType =
  | "citizen"
  | "permanent_resident"
  | "non_permanent_resident"
  | "itin_borrower"
  | "daca"
  | "foreign_national"
  | "";

type IncomeType =
  | "full_doc"
  | "express_doc"
  | "bank_statements"
  | "1099"
  | "p_and_l"
  | "asset_utilization"
  | "dscr"
  | "";

type PropertyType =
  | "single_family"
  | "condo"
  | "two_to_four_unit"
  | "mixed_use"
  | "manufactured"
  | "";

type MatchRequestPayload = {
  borrowerName?: string;
  loanOfficerName?: string;
  language?: "en" | "pt" | "es";
  creditScore?: number | string;
  monthlyIncome?: number | string;
  monthlyDebt?: number | string;
  liquidAssets?: number | string;
  reservesMonths?: number | string;
  homePrice?: number | string;
  downPayment?: number | string;
  loanAmount?: number | string;
  occupancy?: OccupancyType;
  transactionType?: TransactionType;
  propertyType?: PropertyType;
  citizenshipStatus?: CitizenshipType;
  incomeType?: IncomeType;
  selfEmployedYears?: number | string;
  firstTimeHomebuyer?: boolean;
  bankruptcySeasoningMonths?: number | string;
  foreclosureSeasoningMonths?: number | string;
  lateMortgagePayments12m?: number | string;
  lateMortgagePayments24m?: number | string;
  hasPrepaymentPenaltyTolerance?: boolean;
  interestOnlyPreference?: boolean;
  dscrRatio?: number | string;
  estimatedRentalIncome?: number | string;
  monthlyHousingPayment?: number | string;
  wantsAffordableProgramReview?: boolean;
  wantsNonQmReview?: boolean;
  wantsInvestorReview?: boolean;
};

type MatchFit = "Strong" | "Possible" | "Caution" | "Ineligible";

type LenderProgram = {
  id: string;
  lender: string;
  programName: string;
  category:
    | "Agency"
    | "Government"
    | "Non-QM"
    | "Investor"
    | "Specialty"
    | "HELOC";
  priority: number;
  states?: string[];
  occupancyAllowed: OccupancyType[];
  transactionTypes: TransactionType[];
  propertyTypes: PropertyType[];
  citizenshipAllowed: CitizenshipType[];
  incomeTypes: IncomeType[];
  minCreditScore?: number;
  maxLtv?: number;
  maxDti?: number;
  minDownPaymentPct?: number;
  minReservesMonths?: number;
  minSelfEmployedYears?: number;
  minDscr?: number;
  allowFirstTimeHomebuyer?: boolean;
  allowInterestOnly?: boolean;
  allowPrepaymentPenalty?: boolean;
  notes: string[];
  docPriorities: string[];
  cautionRules?: string[];
};

type ProgramMatchResult = {
  id: string;
  lender: string;
  programName: string;
  category: LenderProgram["category"];
  fit: MatchFit;
  score: number;
  headline: string;
  reasons: string[];
  cautions: string[];
  missingItems: string[];
  docChecklist: string[];
};

type MatchResponse = {
  success: true;
  borrowerSummary: {
    borrowerName: string;
    loanOfficerName: string;
    language: string;
    estimatedLoanAmount: number;
    estimatedLtvPct: number;
    estimatedDtiPct: number | null;
    dscrRatio: number | null;
  };
  executiveSummary: string;
  topMatches: ProgramMatchResult[];
  otherMatches: ProgramMatchResult[];
  cautionFlags: string[];
  missingDocuments: string[];
  nextQuestions: string[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s,]/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function clampScore(value: number) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

const PROGRAMS: LenderProgram[] = [
  {
    id: "fannie-conventional-primary",
    lender: "Agency / Fannie Mae",
    programName: "Conventional Primary Residence Review",
    category: "Agency",
    priority: 100,
    occupancyAllowed: ["primary_residence", "second_home"],
    transactionTypes: ["purchase", "rate_term_refinance", "cash_out_refinance"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
    ],
    incomeTypes: ["full_doc", "express_doc"],
    minCreditScore: 620,
    maxLtv: 0.97,
    maxDti: 0.5,
    minDownPaymentPct: 0.03,
    allowFirstTimeHomebuyer: true,
    allowInterestOnly: false,
    allowPrepaymentPenalty: false,
    notes: [
      "Best used for fully documented wage-earner or standard income scenarios.",
      "AUS findings, reserves, and property review still control final eligibility.",
    ],
    docPriorities: [
      "1003 / loan application",
      "Income documentation",
      "Asset documentation",
      "Credit review",
      "Property details",
    ],
  },
  {
    id: "freddie-home-possible-review",
    lender: "Agency / Freddie Mac",
    programName: "Home Possible / Affordable Review",
    category: "Agency",
    priority: 92,
    occupancyAllowed: ["primary_residence"],
    transactionTypes: ["purchase", "rate_term_refinance"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
    ],
    incomeTypes: ["full_doc", "express_doc"],
    minCreditScore: 620,
    maxLtv: 0.97,
    maxDti: 0.5,
    minDownPaymentPct: 0.03,
    allowFirstTimeHomebuyer: true,
    allowInterestOnly: false,
    allowPrepaymentPenalty: false,
    notes: [
      "Affordable-style review may be appropriate when structure and income support it.",
      "Final eligibility depends on AMI, AUS, and current guideline overlays.",
    ],
    docPriorities: [
      "1003 / loan application",
      "Income documentation",
      "Asset documentation",
      "Homebuyer status review",
      "Property details",
    ],
  },
  {
    id: "fha-primary-review",
    lender: "Government / FHA",
    programName: "FHA Primary Residence Review",
    category: "Government",
    priority: 95,
    occupancyAllowed: ["primary_residence"],
    transactionTypes: ["purchase", "rate_term_refinance", "cash_out_refinance"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
      "daca",
    ],
    incomeTypes: ["full_doc", "express_doc"],
    minCreditScore: 580,
    maxLtv: 0.965,
    maxDti: 0.57,
    minDownPaymentPct: 0.035,
    allowFirstTimeHomebuyer: true,
    allowInterestOnly: false,
    allowPrepaymentPenalty: false,
    notes: [
      "Useful fallback path where agency conventional is weaker.",
      "Manual downgrade and payment history issues still require careful review.",
    ],
    docPriorities: [
      "1003 / loan application",
      "Income documentation",
      "Asset documentation",
      "Housing history",
      "Credit review",
    ],
  },
  {
    id: "fnba-bank-statement-review",
    lender: "FNBA",
    programName: "12-24 Month Bank Statement Review",
    category: "Non-QM",
    priority: 97,
    occupancyAllowed: ["primary_residence", "second_home", "investment_property"],
    transactionTypes: ["purchase", "rate_term_refinance", "cash_out_refinance"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit", "mixed_use"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
      "itin_borrower",
      "foreign_national",
      "daca",
    ],
    incomeTypes: ["bank_statements", "1099", "p_and_l"],
    minCreditScore: 620,
    maxLtv: 0.9,
    maxDti: 0.55,
    minReservesMonths: 3,
    minSelfEmployedYears: 1,
    allowFirstTimeHomebuyer: true,
    allowInterestOnly: true,
    allowPrepaymentPenalty: true,
    notes: [
      "Good directional fit for self-employed borrowers using alternative income methods.",
      "Final review depends on business stability, expense factor, and reserves.",
    ],
    docPriorities: [
      "12 or 24 months bank statements",
      "Business existence documentation",
      "CPA / tax preparer support if applicable",
      "Asset / reserve documentation",
      "Letter of explanation if needed",
    ],
    cautionRules: [
      "Large undocumented deposits may require additional review.",
      "Short self-employment history may narrow options.",
    ],
  },
  {
    id: "fnba-p-and-l-review",
    lender: "FNBA",
    programName: "1-2 Year P&L Review",
    category: "Non-QM",
    priority: 94,
    occupancyAllowed: ["primary_residence", "second_home", "investment_property"],
    transactionTypes: ["purchase", "rate_term_refinance", "cash_out_refinance"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit", "mixed_use"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
      "itin_borrower",
      "foreign_national",
      "daca",
    ],
    incomeTypes: ["p_and_l", "1099"],
    minCreditScore: 620,
    maxLtv: 0.8,
    maxDti: 0.55,
    minReservesMonths: 3,
    minSelfEmployedYears: 1,
    allowFirstTimeHomebuyer: true,
    allowInterestOnly: true,
    allowPrepaymentPenalty: true,
    notes: [
      "Can be useful where tax returns do not reflect true cash flow.",
      "Prepared P&L support and consistency review remain critical.",
    ],
    docPriorities: [
      "Prepared year-to-date or annual P&L",
      "Business existence documentation",
      "Supporting bank activity if required",
      "Asset / reserve documentation",
      "LOE for variances",
    ],
  },
  {
    id: "clearedge-dscr-review",
    lender: "ClearEdge Lending",
    programName: "DSCR Investor Review",
    category: "Investor",
    priority: 96,
    occupancyAllowed: ["investment_property"],
    transactionTypes: ["purchase", "rate_term_refinance", "cash_out_refinance"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit", "mixed_use"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
      "foreign_national",
      "itin_borrower",
    ],
    incomeTypes: ["dscr", "asset_utilization", "bank_statements", "full_doc"],
    minCreditScore: 660,
    maxLtv: 0.8,
    minDscr: 0.75,
    minReservesMonths: 6,
    allowFirstTimeHomebuyer: false,
    allowInterestOnly: true,
    allowPrepaymentPenalty: true,
    notes: [
      "Primarily useful where rental cash flow is central to qualification.",
      "Lease, market rent, and property condition still matter materially.",
    ],
    docPriorities: [
      "Lease agreement or market rent support",
      "DSCR calculation inputs",
      "Asset / reserve documentation",
      "Entity documentation if applicable",
      "Property insurance / tax estimate",
    ],
  },
  {
    id: "foreign-national-review",
    lender: "Specialty Foreign National",
    programName: "Foreign National Directional Review",
    category: "Specialty",
    priority: 85,
    occupancyAllowed: ["second_home", "investment_property"],
    transactionTypes: ["purchase", "rate_term_refinance"],
    propertyTypes: ["single_family", "condo"],
    citizenshipAllowed: ["foreign_national"],
    incomeTypes: ["bank_statements", "asset_utilization", "full_doc"],
    minCreditScore: 680,
    maxLtv: 0.75,
    minReservesMonths: 12,
    allowFirstTimeHomebuyer: false,
    allowInterestOnly: true,
    allowPrepaymentPenalty: true,
    notes: [
      "Useful only for foreign-national-specific review paths.",
      "Documentation source, U.S. credit availability, and reserve strength remain important.",
    ],
    docPriorities: [
      "Passport / visa documents",
      "Foreign bank statements or assets",
      "Credit alternatives if required",
      "Source of funds review",
      "Property and occupancy support",
    ],
  },
  {
    id: "heloc-equity-review",
    lender: "Specialty Equity",
    programName: "HELOC / Closed-End Second Review",
    category: "HELOC",
    priority: 70,
    occupancyAllowed: ["primary_residence", "second_home", "investment_property"],
    transactionTypes: ["second_lien"],
    propertyTypes: ["single_family", "condo", "two_to_four_unit"],
    citizenshipAllowed: [
      "citizen",
      "permanent_resident",
      "non_permanent_resident",
    ],
    incomeTypes: ["full_doc", "express_doc", "bank_statements", "1099"],
    minCreditScore: 660,
    maxLtv: 0.9,
    maxDti: 0.5,
    minReservesMonths: 2,
    allowFirstTimeHomebuyer: false,
    allowInterestOnly: true,
    allowPrepaymentPenalty: false,
    notes: [
      "Useful for second-lien or equity-access scenarios.",
      "Combined lien position and current first mortgage terms remain key.",
    ],
    docPriorities: [
      "Current mortgage statement",
      "Property value support",
      "Income documentation",
      "Asset documentation",
      "Title / lien review",
    ],
  },
];

function evaluateProgram(
  payload: Required<MatchRequestPayload>,
  program: LenderProgram
): ProgramMatchResult {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const missingItems: string[] = [];

  let score = program.priority * 0.5;

  const creditScore = toNumber(payload.creditScore);
  const monthlyIncome = toNumber(payload.monthlyIncome);
  const monthlyDebt = toNumber(payload.monthlyDebt);
  const homePrice = toNumber(payload.homePrice);
  const downPayment = toNumber(payload.downPayment);
  const providedLoanAmount = toNumber(payload.loanAmount);
  const loanAmount =
    providedLoanAmount > 0 ? providedLoanAmount : Math.max(homePrice - downPayment, 0);

  const ltv = homePrice > 0 ? loanAmount / homePrice : 0;
  const dti = monthlyIncome > 0 ? monthlyDebt / monthlyIncome : 0;
  const reservesMonths = toNumber(payload.reservesMonths);
  const selfEmployedYears = toNumber(payload.selfEmployedYears);
  const dscrRatio = toNumber(payload.dscrRatio);

  if (!program.occupancyAllowed.includes(payload.occupancy)) {
    return {
      id: program.id,
      lender: program.lender,
      programName: program.programName,
      category: program.category,
      fit: "Ineligible",
      score: 0,
      headline: "Occupancy does not align with this program.",
      reasons: [],
      cautions: ["Occupancy mismatch."],
      missingItems: [],
      docChecklist: program.docPriorities,
    };
  }

  if (!program.transactionTypes.includes(payload.transactionType)) {
    return {
      id: program.id,
      lender: program.lender,
      programName: program.programName,
      category: program.category,
      fit: "Ineligible",
      score: 0,
      headline: "Transaction type does not align with this program.",
      reasons: [],
      cautions: ["Transaction type mismatch."],
      missingItems: [],
      docChecklist: program.docPriorities,
    };
  }

  if (!program.propertyTypes.includes(payload.propertyType)) {
    return {
      id: program.id,
      lender: program.lender,
      programName: program.programName,
      category: program.category,
      fit: "Ineligible",
      score: 0,
      headline: "Property type does not align with this program.",
      reasons: [],
      cautions: ["Property type mismatch."],
      missingItems: [],
      docChecklist: program.docPriorities,
    };
  }

  if (!program.citizenshipAllowed.includes(payload.citizenshipStatus)) {
    return {
      id: program.id,
      lender: program.lender,
      programName: program.programName,
      category: program.category,
      fit: "Ineligible",
      score: 0,
      headline: "Citizenship or residency profile does not align with this review path.",
      reasons: [],
      cautions: ["Citizenship / residency mismatch."],
      missingItems: [],
      docChecklist: program.docPriorities,
    };
  }

  if (!program.incomeTypes.includes(payload.incomeType)) {
    return {
      id: program.id,
      lender: program.lender,
      programName: program.programName,
      category: program.category,
      fit: "Ineligible",
      score: 0,
      headline: "Income type does not align with this program.",
      reasons: [],
      cautions: ["Income documentation method mismatch."],
      missingItems: [],
      docChecklist: program.docPriorities,
    };
  }

  if (creditScore <= 0) {
    missingItems.push("Estimated credit score");
  } else if (program.minCreditScore && creditScore >= program.minCreditScore) {
    score += 18;
    reasons.push(
      `Credit score appears to meet the directional minimum threshold of ${program.minCreditScore}.`
    );
  } else if (program.minCreditScore) {
    score -= 30;
    cautions.push(
      `Estimated credit score appears below the directional minimum of ${program.minCreditScore}.`
    );
  }

  if (homePrice > 0 && loanAmount > 0) {
    if (program.maxLtv !== undefined && ltv <= program.maxLtv) {
      score += 16;
      reasons.push(
        `Estimated LTV of ${round(ltv * 100)}% appears within the directional cap of ${round(
          program.maxLtv * 100
        )}%.`
      );
    } else if (program.maxLtv !== undefined) {
      score -= 22;
      cautions.push(
        `Estimated LTV of ${round(ltv * 100)}% appears above the directional cap of ${round(
          program.maxLtv * 100
        )}%.`
      );
    }
  } else {
    missingItems.push("Home price and down payment / loan amount");
  }

  if (monthlyIncome > 0 && monthlyDebt >= 0) {
    if (program.maxDti !== undefined && dti <= program.maxDti) {
      score += 12;
      reasons.push(
        `Estimated DTI of ${round(dti * 100)}% appears within the directional tolerance.`
      );
    } else if (program.maxDti !== undefined) {
      score -= 18;
      cautions.push(
        `Estimated DTI of ${round(dti * 100)}% may be above the directional tolerance.`
      );
    }
  } else if (program.maxDti !== undefined) {
    missingItems.push("Monthly income and debt for DTI review");
  }

  if (program.minReservesMonths !== undefined) {
    if (reservesMonths >= program.minReservesMonths) {
      score += 8;
      reasons.push(
        `Reported reserves appear supportive relative to a ${program.minReservesMonths}-month directional target.`
      );
    } else if (reservesMonths > 0) {
      score -= 8;
      cautions.push(
        `Reported reserves may be lighter than the directional target of ${program.minReservesMonths} months.`
      );
    } else {
      missingItems.push("Reserve months / liquid asset strength");
    }
  }

  if (program.minSelfEmployedYears !== undefined) {
    if (selfEmployedYears >= program.minSelfEmployedYears) {
      score += 7;
      reasons.push(
        `Self-employment history appears supportive for alternative-income review.`
      );
    } else if (selfEmployedYears > 0) {
      score -= 9;
      cautions.push(
        `Self-employment history may be short for this directional path.`
      );
    } else if (
      payload.incomeType === "bank_statements" ||
      payload.incomeType === "1099" ||
      payload.incomeType === "p_and_l"
    ) {
      missingItems.push("Self-employment history");
    }
  }

  if (program.minDscr !== undefined) {
    if (dscrRatio >= program.minDscr) {
      score += 14;
      reasons.push(
        `Estimated DSCR of ${round(dscrRatio, 2)} appears supportive for investor review.`
      );
    } else if (dscrRatio > 0) {
      score -= 15;
      cautions.push(
        `Estimated DSCR of ${round(dscrRatio, 2)} may be below the directional target of ${program.minDscr}.`
      );
    } else {
      missingItems.push("Estimated DSCR ratio");
    }
  }

  if (payload.firstTimeHomebuyer) {
    if (program.allowFirstTimeHomebuyer === false) {
      score -= 10;
      cautions.push("First-time-homebuyer profile may not align with this path.");
    } else {
      score += 4;
      reasons.push("First-time-homebuyer status does not appear to block this path.");
    }
  }

  if (payload.interestOnlyPreference) {
    if (program.allowInterestOnly) {
      score += 3;
      reasons.push("Interest-only preference may be available within this review lane.");
    } else {
      cautions.push("Interest-only preference may not align with this lane.");
    }
  }

  if (payload.hasPrepaymentPenaltyTolerance) {
    if (program.allowPrepaymentPenalty) {
      reasons.push("Prepayment-penalty tolerance may expand optionality here.");
      score += 2;
    }
  }

  if (toNumber(payload.lateMortgagePayments12m) > 0) {
    cautions.push("Recent mortgage lates may require layered review.");
    score -= 10;
  }

  if (toNumber(payload.bankruptcySeasoningMonths) > 0) {
    cautions.push("Bankruptcy seasoning should be reviewed against current program rules.");
  }

  if (toNumber(payload.foreclosureSeasoningMonths) > 0) {
    cautions.push("Foreclosure seasoning should be reviewed against current program rules.");
  }

  if (program.cautionRules?.length) {
    cautions.push(...program.cautionRules);
  }

  const finalScore = clampScore(score);

  let fit: MatchFit = "Possible";
  if (finalScore >= 78) fit = "Strong";
  else if (finalScore >= 55) fit = "Possible";
  else if (finalScore >= 30) fit = "Caution";
  else fit = "Ineligible";

  const headline =
    fit === "Strong"
      ? "This appears to be a strong directional fit for review."
      : fit === "Possible"
      ? "This appears workable but needs file-specific confirmation."
      : fit === "Caution"
      ? "This path may be possible, but there are material issues to review."
      : "This path does not appear directionally aligned based on current inputs.";

  return {
    id: program.id,
    lender: program.lender,
    programName: program.programName,
    category: program.category,
    fit,
    score: finalScore,
    headline,
    reasons: uniqueStrings(reasons),
    cautions: uniqueStrings(cautions),
    missingItems: uniqueStrings(missingItems),
    docChecklist: uniqueStrings(program.docPriorities),
  };
}

function buildExecutiveSummary(topMatches: ProgramMatchResult[]) {
  if (topMatches.length === 0) {
    return "No strong directional lender-program match was identified from the current intake. Additional borrower detail or a different structure may be needed.";
  }

  const best = topMatches[0];
  return `Top directional fit currently appears to be ${best.programName} with ${best.lender}. Final eligibility remains subject to full file review, current overlays, documentation quality, and investor guidelines.`;
}

function buildNextQuestions(payload: Required<MatchRequestPayload>) {
  const questions: string[] = [];

  if (!toNumber(payload.creditScore)) {
    questions.push("What is the borrower’s current estimated middle credit score?");
  }

  if (!toNumber(payload.monthlyIncome)) {
    questions.push("What is the borrower’s current gross monthly qualifying income?");
  }

  if (!toNumber(payload.homePrice)) {
    questions.push("What is the target purchase price or current property value?");
  }

  if (!toNumber(payload.downPayment) && !toNumber(payload.loanAmount)) {
    questions.push("How much is available for down payment or what is the requested loan amount?");
  }

  if (
    payload.incomeType === "bank_statements" ||
    payload.incomeType === "1099" ||
    payload.incomeType === "p_and_l"
  ) {
    if (!toNumber(payload.selfEmployedYears)) {
      questions.push("How long has the borrower been self-employed in the same line of work?");
    }
  }

  if (payload.occupancy === "investment_property" && !toNumber(payload.dscrRatio)) {
    questions.push("What is the estimated DSCR or expected monthly rent versus payment?");
  }

  if (!toNumber(payload.reservesMonths) && payload.transactionType !== "purchase") {
    questions.push("How many months of reserves are available after closing?");
  }

  return uniqueStrings(questions).slice(0, 8);
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as MatchRequestPayload;

    const payload: Required<MatchRequestPayload> = {
      borrowerName: String(raw.borrowerName || "").trim(),
      loanOfficerName: String(raw.loanOfficerName || "").trim(),
      language: raw.language || "en",
      creditScore: raw.creditScore ?? "",
      monthlyIncome: raw.monthlyIncome ?? "",
      monthlyDebt: raw.monthlyDebt ?? "",
      liquidAssets: raw.liquidAssets ?? "",
      reservesMonths: raw.reservesMonths ?? "",
      homePrice: raw.homePrice ?? "",
      downPayment: raw.downPayment ?? "",
      loanAmount: raw.loanAmount ?? "",
      occupancy: raw.occupancy || "",
      transactionType: raw.transactionType || "",
      propertyType: raw.propertyType || "",
      citizenshipStatus: raw.citizenshipStatus || "",
      incomeType: raw.incomeType || "",
      selfEmployedYears: raw.selfEmployedYears ?? "",
      firstTimeHomebuyer: Boolean(raw.firstTimeHomebuyer),
      bankruptcySeasoningMonths: raw.bankruptcySeasoningMonths ?? "",
      foreclosureSeasoningMonths: raw.foreclosureSeasoningMonths ?? "",
      lateMortgagePayments12m: raw.lateMortgagePayments12m ?? "",
      lateMortgagePayments24m: raw.lateMortgagePayments24m ?? "",
      hasPrepaymentPenaltyTolerance: Boolean(raw.hasPrepaymentPenaltyTolerance),
      interestOnlyPreference: Boolean(raw.interestOnlyPreference),
      dscrRatio: raw.dscrRatio ?? "",
      estimatedRentalIncome: raw.estimatedRentalIncome ?? "",
      monthlyHousingPayment: raw.monthlyHousingPayment ?? "",
      wantsAffordableProgramReview: Boolean(raw.wantsAffordableProgramReview),
      wantsNonQmReview: Boolean(raw.wantsNonQmReview),
      wantsInvestorReview: Boolean(raw.wantsInvestorReview),
    };

    const homePrice = toNumber(payload.homePrice);
    const downPayment = toNumber(payload.downPayment);
    const requestedLoanAmount = toNumber(payload.loanAmount);
    const estimatedLoanAmount =
      requestedLoanAmount > 0
        ? requestedLoanAmount
        : Math.max(homePrice - downPayment, 0);

    const estimatedLtvPct =
      homePrice > 0 ? round((estimatedLoanAmount / homePrice) * 100, 2) : 0;

    const monthlyIncome = toNumber(payload.monthlyIncome);
    const monthlyDebt = toNumber(payload.monthlyDebt);
    const estimatedDtiPct =
      monthlyIncome > 0 ? round((monthlyDebt / monthlyIncome) * 100, 2) : null;

    const dscrRatio = toNumber(payload.dscrRatio) || null;

    const results = ALL_PROGRAMS.map((program) => evaluateProgram(payload, program))
      .filter((item) => item.fit !== "Ineligible")
      .sort((a, b) => b.score - a.score);

    const topMatches = results.slice(0, 5);
    const otherMatches = results.slice(5, 12);

    const cautionFlags = uniqueStrings(
      results.flatMap((item) => item.cautions).slice(0, 30)
    );

    const missingDocuments = uniqueStrings(
      results.flatMap((item) => item.missingItems).slice(0, 30)
    );

    const nextQuestions = buildNextQuestions(payload);

    const response: MatchResponse = {
      success: true,
      borrowerSummary: {
        borrowerName: payload.borrowerName || "Not provided",
        loanOfficerName: payload.loanOfficerName || "Not provided",
        language: payload.language || "en",
        estimatedLoanAmount,
        estimatedLtvPct,
        estimatedDtiPct,
        dscrRatio,
      },
      executiveSummary: buildExecutiveSummary(topMatches),
      topMatches,
      otherMatches,
      cautionFlags,
      missingDocuments,
      nextQuestions,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to evaluate match request.",
      },
      { status: 500 }
    );
  }
}
