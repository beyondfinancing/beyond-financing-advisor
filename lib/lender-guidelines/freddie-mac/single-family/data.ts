// ===============================
// FREDDIE MAC — SINGLE FAMILY LOGIC
// ===============================

export type FreddieBorrowerProfile = {
  creditScore: number;
  ltv: number;
  dti?: number;
  occupancy?: "primary" | "second" | "investment";
  firstTimeBuyer?: boolean;
};

export type FreddieProgramSuggestion = {
  program: string;
  eligible: boolean;
  strength: "strong" | "moderate" | "weak";
  notes: string[];
};

// Main evaluation function
export function evaluateFreddieMacSingleFamily(
  borrower: FreddieBorrowerProfile
): FreddieProgramSuggestion[] {
  const results: FreddieProgramSuggestion[] = [];

  // ===============================
  // HOME POSSIBLE / PRIMARY FOCUS
  // ===============================
  const homePossibleEligible =
    borrower.creditScore >= 620 &&
    borrower.ltv <= 97 &&
    borrower.occupancy === "primary";

  results.push({
    program: "Home Possible (Freddie Mac)",
    eligible: homePossibleEligible,
    strength:
      borrower.firstTimeBuyer && borrower.creditScore >= 680
        ? "strong"
        : homePossibleEligible
        ? "moderate"
        : "weak",
    notes: [
      borrower.occupancy !== "primary"
        ? "Primary residence required"
        : "Primary residence confirmed",
      borrower.creditScore < 620
        ? "Credit score below baseline threshold"
        : "Credit score meets baseline threshold",
      "Consider for flexible underwriting and MI advantages where applicable",
    ],
  });

  // ===============================
  // STANDARD CONVENTIONAL
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
    program: "Conventional (Freddie Mac Standard)",
    eligible: conventionalEligible,
    strength: conventionalStrength,
    notes: [
      borrower.ltv > 97
        ? "LTV exceeds standard Freddie Mac range"
        : "LTV within acceptable range",
      borrower.creditScore < 620
        ? "Credit score below minimum baseline"
        : "Credit profile meets minimum baseline",
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
        "High LTV scenario may increase mortgage insurance impact",
        "Review compensating factors such as reserves and stronger credit",
      ],
    });
  }

  // ===============================
  // DTI WARNING
  // ===============================
  if (borrower.dti !== undefined && borrower.dti > 45) {
    results.push({
      program: "DTI Risk Review",
      eligible: true,
      strength: "weak",
      notes: [
        "DTI exceeds 45% and may require stronger AUS findings",
        "Consider reserve strength, residual capacity, and overall risk layering",
      ],
    });
  }

  // ===============================
  // OCCUPANCY RISK NOTE
  // ===============================
  if (borrower.occupancy === "investment") {
    results.push({
      program: "Investment Occupancy Review",
      eligible: true,
      strength: "weak",
      notes: [
        "Investment occupancy typically carries tighter risk tolerance",
        "Review pricing, reserves, and LTV constraints carefully",
      ],
    });
  } else if (borrower.occupancy === "second") {
    results.push({
      program: "Second Home Occupancy Review",
      eligible: true,
      strength: "moderate",
      notes: [
        "Second home occupancy may still support conventional execution",
        "Confirm occupancy intent and property usage",
      ],
    });
  }

  return results;
}
