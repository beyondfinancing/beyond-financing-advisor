// ===============================
// FANNIE MAE — SINGLE FAMILY LOGIC
// ===============================

export type BorrowerProfile = {
  creditScore: number;
  ltv: number;
  dti?: number;
  occupancy?: "primary" | "second" | "investment";
  firstTimeBuyer?: boolean;
};

export type ProgramSuggestion = {
  program: string;
  eligible: boolean;
  strength: "strong" | "moderate" | "weak";
  notes: string[];
};

// Main evaluation function
export function evaluateFannieMaeSingleFamily(
  borrower: BorrowerProfile
): ProgramSuggestion[] {
  const results: ProgramSuggestion[] = [];

  // ===============================
  // CONVENTIONAL STANDARD
  // ===============================
  const conventionalEligible =
    borrower.creditScore >= 620 && borrower.ltv <= 97;

  let conventionalStrength: "strong" | "moderate" | "weak" = "weak";

  if (borrower.creditScore >= 740 && borrower.ltv <= 90) {
    conventionalStrength = "strong";
  } else if (borrower.creditScore >= 680 && borrower.ltv <= 95) {
    conventionalStrength = "moderate";
  }

  results.push({
    program: "Conventional (Fannie Mae Standard)",
    eligible: conventionalEligible,
    strength: conventionalStrength,
    notes: [
      borrower.creditScore < 620
        ? "Credit score below minimum requirement"
        : "Credit score meets minimum requirement",
      borrower.ltv > 97
        ? "LTV exceeds Fannie Mae limits"
        : "LTV within acceptable range",
    ],
  });

  // ===============================
  // HOMEREADY PROGRAM
  // ===============================
  const homeReadyEligible =
    borrower.creditScore >= 620 &&
    borrower.ltv <= 97 &&
    borrower.occupancy === "primary";

  results.push({
    program: "HomeReady (Fannie Mae)",
    eligible: homeReadyEligible,
    strength:
      borrower.firstTimeBuyer && borrower.creditScore >= 680
        ? "strong"
        : "moderate",
    notes: [
      borrower.occupancy !== "primary"
        ? "Primary residence required"
        : "Primary residence confirmed",
      "Potential reduced MI and flexible income options",
    ],
  });

  // ===============================
  // HIGH LTV FLAG
  // ===============================
  if (borrower.ltv > 95) {
    results.push({
      program: "High LTV Consideration",
      eligible: true,
      strength: "moderate",
      notes: [
        "High LTV scenario — mortgage insurance required",
        "Consider risk layering with credit and DTI",
      ],
    });
  }

  // ===============================
  // DTI WARNING
  // ===============================
  if (borrower.dti && borrower.dti > 45) {
    results.push({
      program: "DTI Risk Review",
      eligible: true,
      strength: "weak",
      notes: [
        "DTI exceeds 45% — may require compensating factors",
        "Consider AUS findings and reserves",
      ],
    });
  }

  return results;
}
