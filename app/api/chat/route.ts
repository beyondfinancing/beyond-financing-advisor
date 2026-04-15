import { NextResponse } from "next/server";

function buildSimulatedFinleyReply(userMessage: string) {
  const lower = userMessage.toLowerCase();

  const mentionsHighLtv =
    lower.includes("down payment: 50000") ||
    lower.includes("ltv") ||
    lower.includes("high ltv");

  const loanDirection = mentionsHighLtv
    ? "This scenario appears to fit a conventional high-LTV review, subject to full underwriting, AUS findings, reserve requirements, and investor overlays."
    : "This scenario appears to fit a conventional financing review, subject to full underwriting and investor eligibility.";

  return `
Finley Beyond Initial Review

Likely Loan Direction:
${loanDirection}

Key Risk Flags:
- Final approval cannot be determined from intake alone
- Income, assets, credit, and occupancy must be fully documented
- Pricing, PMI, and lender overlays may materially affect final eligibility
${mentionsHighLtv ? "- Higher LTV may reduce flexibility and increase monthly mortgage insurance" : ""}

Recommended Next Steps:
- Run AUS through the appropriate investor channel
- Verify income documentation and asset sourcing
- Confirm available funds for closing and reserves
- Review lender overlays for the selected program
- Have a licensed loan officer issue the final guidance after full file review

Important Notice:
This is preliminary guidance only and does not constitute a loan approval or commitment to lend.
  `.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { reply: "Missing or invalid messages array." },
        { status: 400 }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || "";

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
