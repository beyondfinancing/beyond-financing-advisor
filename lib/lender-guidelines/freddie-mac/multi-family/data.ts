// ===============================
// FREDDIE MAC — MULTI-FAMILY LOGIC
// ===============================

export type FreddieMultifamilyBorrowerProfile = {
  creditScore?: number;
  ltv: number;
  dscr?: number;
  occupancy?: "investment" | "mixed-use" | "other";
  units?: number;
  experienceLevel?: "first-time-investor" | "experienced-investor";
};

export type FreddieMultifamilyProgramSuggestion = {
  program: string;
  eligible: boolean;
  strength: "strong" | "moderate" | "weak";
  notes: string[];
};

// Main evaluation function
export function evaluateFreddieMacMultifamily(
  borrower: FreddieMultifamilyBorrowerProfile
): FreddieMultifamilyProgramSuggestion[] {
  const results: FreddieMultifamilyProgramSuggestion[] = [];

  // ===============================
  // STANDARD FREDDIE MULTIFAMILY
  // ===============================
  const standardEligible = borrower.ltv <= 80;

  let standardStrength: "strong" | "moderate" | "weak" = "weak";

  if ((borrower.dscr ?? 0) >= 1.35 && borrower.ltv <= 75) {
    standardStrength = "strong";
  } else if ((borrower.dscr ?? 0) >= 1.25 && borrower.ltv <= 80) {
    standardStrength = "moderate";
  }

  results.push({
    program: "Freddie Mac Multifamily Standard",
    eligible: standardEligible,
    strength: standardStrength,
    notes: [
      borrower.ltv > 80
        ? "LTV exceeds common Freddie Mac multifamily threshold"
        : "LTV within a generally acceptable Freddie Mac multifamily range",
      borrower.dscr !== undefined
        ? borrower.dscr < 1.25
          ? "DSCR appears below preferred benchmark"
          : "DSCR appears supportable"
        : "DSCR not provided — underwriting review needed",
    ],
  });

  // ===============================
  // LOWER LEVERAGE / STRONGER EXECUTION
  // ===============================
  const conservativeEligible =
    borrower.ltv <= 75 && (borrower.dscr === undefined || borrower.dscr >= 1.30);

  results.push({
    program: "Lower-Leverage Multifamily Direction",
    eligible: conservativeEligible,
    strength: conservativeEligible ? "strong" : "moderate",
    notes: [
      borrower.ltv <= 75
        ? "Lower leverage profile may support stronger execution"
        : "LTV may be high for best execution",
      "May present better with stronger reserves and sponsor profile",
    ],
  });

  // ===============================
  // SMALL / MID-SIZE MULTIFAMILY VIEW
  // ===============================
  if (borrower.units !== undefined) {
    const smallBalanceEligible = borrower.units >= 5 && borrower.units <= 50;

    results.push({
      program: "Small / Mid-Size Multifamily Consideration",
      eligible: smallBalanceEligible,
      strength: smallBalanceEligible ? "moderate" : "weak",
      notes: [
        smallBalanceEligible
          ? "Unit count may fit a smaller multifamily profile"
          : "Unit count may fall outside smaller multifamily range",
      ],
    });
  }

  // ===============================
  // EXPERIENCE LAYER
  // ===============================
  if (borrower.experienceLevel === "first-time-investor") {
    results.push({
      program: "Sponsor Experience Review",
      eligible: true,
      strength: "weak",
      notes: [
        "First-time investor profile may require stronger compensating factors",
        "Liquidity, reserves, and management plan should be reviewed carefully",
      ],
    });
  } else if (borrower.experienceLevel === "experienced-investor") {
    results.push({
      program: "Sponsor Experience Review",
      eligible: true,
      strength: "strong",
      notes: [
        "Experienced investor profile may strengthen execution",
        "Track record can support underwriting narrative",
      ],
    });
  }

  // ===============================
  // DSCR WARNING
  // ===============================
  if (borrower.dscr !== undefined && borrower.dscr < 1.20) {
    results.push({
      program: "Cash Flow Risk Review",
      eligible: true,
      strength: "weak",
      notes: [
        "DSCR below 1.20 suggests elevated cash flow risk",
        "Review NOI, vacancy assumptions, and debt sizing",
      ],
    });
  }

  // ===============================
  // MIXED-USE OCCUPANCY NOTE
  // ===============================
  if (borrower.occupancy === "mixed-use") {
    results.push({
      program: "Mixed-Use Review",
      eligible: true,
      strength: "weak",
      notes: [
        "Mixed-use properties may require additional review",
        "Confirm commercial income share and property composition",
      ],
    });
  }

  return results;
}
