import { NextResponse } from "next/server";

type ChatMessage = {
  role?: string;
  content?: string;
};

type RequestBody = {
  messages?: ChatMessage[];
};

function getLatestUserMessage(messages: ChatMessage[]) {
  const reversed = [...messages].reverse();
  return reversed.find((message) => message.role === "user")?.content ?? "";
}

function buildInitialReview(userMessage: string) {
  const lower = userMessage.toLowerCase();

  const highLtv =
    lower.includes("estimated ltv: 9") ||
    lower.includes("ltv: 9") ||
    lower.includes("94%") ||
    lower.includes("95%") ||
    lower.includes("high ltv");

  const conventionalDirection = highLtv
    ? "This scenario appears to fit a conventional high-LTV review, subject to full underwriting, AUS findings, reserve requirements, PMI structure, and investor overlays."
    : "This scenario appears to fit a conventional financing review, subject to full underwriting and investor eligibility.";

  const extraRisk = highLtv
    ? "\n- Higher LTV may reduce flexibility and increase monthly mortgage insurance"
    : "";

  return `
Finley Beyond Initial Review

Likely Loan Direction:
${conventionalDirection}

Key Risk Flags:
- Final approval cannot be determined from intake alone
- Income, assets, credit, and occupancy must be fully documented
- Pricing, mortgage insurance, and lender overlays may materially affect final eligibility${extraRisk}

Recommended Next Steps:
- Run AUS through the appropriate investor channel
- Verify income documentation and asset sourcing
- Confirm available funds for closing and reserves
- Review lender overlays for the selected program
- Have a licensed loan officer issue final guidance after full file review

Important Notice:
This is preliminary guidance only and does not constitute a loan approval, underwriting decision, or commitment to lend.
  `.trim();
}

function buildFollowUpReply(userMessage: string) {
  const lower = userMessage.toLowerCase();

  if (lower.includes("fha")) {
    return `
FHA may be worth reviewing if the borrower needs more flexible qualification treatment, especially if conventional pricing, mortgage insurance, or automated findings are less favorable.

What to evaluate next:
- Compare total monthly payment under FHA versus conventional
- Review upfront and monthly mortgage insurance impact
- Confirm occupancy, minimum investment, and credit profile
- Check whether conventional still offers a stronger long-term structure

This remains preliminary guidance only. A licensed loan officer should compare both options against current investor guidelines before making a recommendation.
    `.trim();
  }

  if (
    lower.includes("documents") ||
    lower.includes("document") ||
    lower.includes("collect first")
  ) {
    return `
For a strong next step, begin collecting the core qualification documents first:

Recommended documents to gather:
- Most recent pay stubs or income evidence
- W-2s or tax returns, depending on income type
- Most recent asset statements for funds to close and reserves
- Government-issued identification
- Authorization to pull credit, if not already completed
- Any documentation relevant to debts, large deposits, or gift funds

After that, the licensed loan officer should align the documentation set with the selected program and investor overlays.
    `.trim();
  }

  if (
    lower.includes("down payment") ||
    lower.includes("put more down") ||
    lower.includes("increase the down payment")
  ) {
    return `
Increasing the down payment can strengthen the scenario materially.

Potential benefits:
- Lower LTV
- Better mortgage insurance structure
- Greater flexibility with certain lender overlays
- Lower monthly housing payment
- Potentially stronger overall approval profile

The next step would be to rerun the scenario with the revised down payment and compare payment, LTV, and program fit.
    `.trim();
  }

  if (
    lower.includes("self-employed") ||
    lower.includes("self employed") ||
    lower.includes("1099")
  ) {
    return `
If the borrower is self-employed or paid on a 1099 basis, the file should be reviewed differently than a standard salaried borrower.

Items to review:
- Length of self-employment
- Tax return treatment of income
- Business stability and continuance
- Whether bank statement, P&L, or other non-QM options may be needed
- Investor-specific overlays for self-employed borrowers

This could still be viable, but the documentation path and program selection may change materially.
    `.trim();
  }

  return `
Based on the borrower profile already entered, that question should be reviewed in light of credit, income, debts, funds to close, and the estimated LTV.

A prudent next step would be:
- compare the main program options side by side,
- confirm documentation strength,
- review lender overlays,
- and have a licensed loan officer determine the most suitable direction.

If you want, ask the next question more specifically, such as program choice, down payment strategy, documentation, self-employment treatment, gift funds, or approval risks.
  `.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { reply: "Missing or invalid messages array." },
        { status: 400 }
      );
    }

    const latestUserMessage = getLatestUserMessage(messages);

    if (!latestUserMessage.trim()) {
      return NextResponse.json(
        { reply: "The latest message content is empty." },
        { status: 400 }
      );
    }

    const isInitialAnalysisRequest =
      latestUserMessage.toLowerCase().includes("likely loan direction") ||
      latestUserMessage.toLowerCase().includes("main risk flags") ||
      latestUserMessage.toLowerCase().includes("recommended next steps");

    const reply = isInitialAnalysisRequest
      ? buildInitialReview(latestUserMessage)
      : buildFollowUpReply(latestUserMessage);

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { reply: "Server error processing request." },
      { status: 500 }
    );
  }
}
