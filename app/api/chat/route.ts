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

function buildInitialBorrowerReview(userMessage: string) {
  const lower = userMessage.toLowerCase();

  const highLtv =
    lower.includes("estimated ltv: 9") ||
    lower.includes("ltv: 9") ||
    lower.includes("94%") ||
    lower.includes("95%");

  const strengths = [
    "- The scenario reflects income being presented up front for review",
    "- Funds for down payment or equity are being considered early in the process",
  ];

  const cautionItems = [
    "- Final eligibility cannot be determined from intake alone",
    "- Income, assets, credit, and occupancy must still be fully documented",
    "- Pricing, mortgage insurance, and lender-specific requirements may affect the final outcome",
  ];

  if (highLtv) {
    cautionItems.push(
      "- A higher loan-to-value structure may reduce flexibility and increase monthly mortgage insurance"
    );
  }

  return `
Finley Beyond Preliminary Review

General strengths in this scenario:
${strengths.join("\n")}

General areas that may need attention:
${cautionItems.join("\n")}

Reasonable next steps:
- Gather income and asset documents as early as possible
- Be prepared to discuss available funds for closing, reserves, and monthly payment comfort
- Review the full picture with a licensed loan officer
- Allow the licensed loan officer to compare available options under current investor guidelines

Important reminder:
This is preliminary guidance only. Final direction must come from a licensed loan officer after full review of the scenario and current program requirements.
  `.trim();
}

function buildFollowUpReply(userMessage: string) {
  const lower = userMessage.toLowerCase();

  if (
    lower.includes("document") ||
    lower.includes("documents") ||
    lower.includes("prepare next") ||
    lower.includes("collect first")
  ) {
    return `
A strong next step is to prepare the core documents early so your licensed loan officer can review the full picture more efficiently.

Helpful items to gather:
- Recent income documentation
- Recent asset statements
- Government-issued identification
- Any information related to current debts or obligations
- Any documentation tied to gift funds, large deposits, or other funds being used in the transaction

Your licensed loan officer can then tell you exactly what additional items may be needed for your specific situation.
    `.trim();
  }

  if (
    lower.includes("improve") ||
    lower.includes("strengthen") ||
    lower.includes("make my file stronger")
  ) {
    return `
To strengthen a file, it usually helps to focus on the core areas a licensed loan officer will review most closely:

Common ways to strengthen the overall scenario:
- Keep funds for closing and reserves well documented
- Reduce outstanding monthly debt where practical
- Avoid major credit changes during the review process
- Be ready to provide complete and consistent documentation
- Discuss payment comfort and cash-to-close expectations early

A licensed loan officer can then determine which factors matter most for your particular scenario.
    `.trim();
  }

  if (
    lower.includes("down payment") ||
    lower.includes("put more down") ||
    lower.includes("increase the down payment")
  ) {
    return `
Increasing the down payment may improve the overall structure of the scenario.

Possible benefits may include:
- Lower overall loan-to-value
- Lower monthly payment impact
- Improved mortgage insurance profile in some cases
- Greater flexibility depending on the full file review

Your licensed loan officer can compare the updated numbers and explain how a larger down payment may affect your overall options.
    `.trim();
  }

  if (
    lower.includes("monthly payment") ||
    lower.includes("payment") ||
    lower.includes("afford")
  ) {
    return `
Monthly payment comfort should be reviewed carefully alongside income, debts, funds needed to close, and the total monthly housing expense.

A helpful next step is to discuss:
- your ideal monthly payment range,
- how much cash you want to keep available after closing,
- and what level of flexibility matters most to you.

Your licensed loan officer can then help you compare realistic payment scenarios based on current market conditions and full documentation.
    `.trim();
  }

  if (
    lower.includes("self-employed") ||
    lower.includes("self employed") ||
    lower.includes("1099")
  ) {
    return `
If income is self-employed or non-salaried, the review process may require a different documentation path.

That usually means your licensed loan officer will want to review:
- how the income is earned,
- how long it has been received,
- how it is documented,
- and whether the income is stable and usable under current guidelines.

The best next step is to provide a clear picture of the income source so the licensed loan officer can evaluate it properly.
    `.trim();
  }

  return `
That is a good question to review with the full scenario in mind.

The most practical next step is to discuss it with your licensed loan officer using your complete documentation, payment goals, available funds, and current investor requirements.

If you want, you can ask a more specific follow-up question about:
- documents,
- payment comfort,
- strengthening the file,
- down payment strategy,
- or how to prepare for the next conversation with your loan officer.
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
      latestUserMessage.toLowerCase().includes("general strengths in this scenario") ||
      latestUserMessage.toLowerCase().includes("general areas that may need attention") ||
      latestUserMessage.toLowerCase().includes("reasonable next steps");

    const reply = isInitialAnalysisRequest
      ? buildInitialBorrowerReview(latestUserMessage)
      : buildFollowUpReply(latestUserMessage);

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { reply: "Server error processing request." },
      { status: 500 }
    );
  }
}
