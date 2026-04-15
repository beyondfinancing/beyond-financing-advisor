import { NextResponse } from "next/server";

type ChatMessage = {
  role?: string;
  content?: string;
};

type RequestBody = {
  messages?: ChatMessage[];
};

function buildSimulatedFinleyReply(userMessage: string) {
  const lower = userMessage.toLowerCase();

  const mentionsHighLtv =
    lower.includes("estimated ltv: 9") ||
    lower.includes("ltv: 9") ||
    lower.includes("high ltv");

  const loanDirection = mentionsHighLtv
    ? "This scenario appears to fit a conventional high-LTV review, subject to full underwriting, AUS findings, reserve requirements, PMI structure, and investor overlays."
    : "This scenario appears to fit a conventional financing review, subject to full underwriting and investor eligibility.";

  const extraRisk = mentionsHighLtv
    ? "\n- Higher LTV may reduce flexibility and increase monthly mortgage insurance"
    : "";

  return `
Finley Beyond Initial Review

Likely Loan Direction:
${loanDirection}

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

    const userMessage = messages[messages.length - 1]?.content ?? "";

    if (!userMessage.trim()) {
      return NextResponse.json(
        { reply: "The latest message content is empty." },
        { status: 400 }
      );
    }

    const reply = buildSimulatedFinleyReply(userMessage);

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { reply: "Server error processing request." },
      { status: 500 }
    );
  }
}
