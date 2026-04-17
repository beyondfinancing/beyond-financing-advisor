import { NextResponse } from "next/server";

type TeamChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TeamScenario = {
  borrowerName?: string;
  professionalName?: string;
  professionalEmail?: string;
  role?: string;
  borrowerCurrentState?: string;
  borrowerTargetState?: string;
  loanPurpose?: string;
  credit?: string;
  income?: string;
  debt?: string;
  homePrice?: string;
  downPayment?: string;
  occupancy?: string;
  incomeType?: string;
  units?: string;
  dscr?: string;
};

type ProgramSuggestion = {
  program?: string;
  lenderName?: string;
  strength?: string;
  notes?: string[];
};

function buildScenarioSummary(scenario: TeamScenario) {
  return [
    `Borrower scenario: ${scenario.borrowerName || "Not provided"}`,
    `Professional: ${scenario.professionalName || "Not provided"} (${scenario.role || "Unknown role"})`,
    `Loan purpose: ${scenario.loanPurpose || "Not provided"}`,
    `Credit score: ${scenario.credit || "Not provided"}`,
    `Income: ${scenario.income || "Not provided"}`,
    `Debt: ${scenario.debt || "Not provided"}`,
    `Home price: ${scenario.homePrice || "Not provided"}`,
    `Down payment: ${scenario.downPayment || "Not provided"}`,
    `Occupancy: ${scenario.occupancy || "Not provided"}`,
    `Income type: ${scenario.incomeType || "Not provided"}`,
    `Units: ${scenario.units || "Not provided"}`,
    `DSCR: ${scenario.dscr || "Not provided"}`,
    `Current state: ${scenario.borrowerCurrentState || "Not provided"}`,
    `Target state: ${scenario.borrowerTargetState || "Not provided"}`,
  ].join("\n");
}

function buildProgramSummary(suggestions: ProgramSuggestion[]) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return "No live lender-program matches were returned.";
  }

  return suggestions
    .map((item, index) => {
      const lender = item.lenderName ? ` | Lender: ${item.lenderName}` : "";
      const strength = item.strength ? ` | Strength: ${item.strength}` : "";
      const notes =
        item.notes && item.notes.length > 0
          ? ` | Notes: ${item.notes.join("; ")}`
          : "";
      return `${index + 1}. Program: ${item.program || "Unnamed"}${lender}${strength}${notes}`;
    })
    .join("\n");
}

function buildFallbackReply(
  scenario: TeamScenario,
  suggestions: ProgramSuggestion[],
  latestUserMessage: string
) {
  const borrowerName = scenario.borrowerName || "this borrower";
  const topMatch = suggestions[0];

  const opening = topMatch
    ? `Based on the current data entered, ${borrowerName} appears to align most closely with ${topMatch.program}${topMatch.lenderName ? ` through ${topMatch.lenderName}` : ""}.`
    : `Based on the current data entered, I do not yet see a confirmed lender-program match for ${borrowerName}.`;

  return `${opening}

Your latest question/comment:
"${latestUserMessage}"

Next underwriting-focused direction:
1. Confirm occupancy, income structure, and documentation support.
2. Validate whether the current credit, LTV, and DTI fit the intended execution.
3. Review reserves, assets, and any compensating factors.
4. Confirm whether the borrower profile supports the current path or whether an alternate program should be considered.

Recommended next questions:
- Is the income fully documentable as entered?
- Are there any recent credit events, undisclosed liabilities, or layered risks?
- Are the down payment and reserves already sourced and seasoned?
- Is this definitely a primary residence, second home, or investment property?

This is preliminary guidance only and should still be confirmed against the lender/investor guidelines and overlays before a lending decision is made.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const action = String(body?.action || "").trim();
    const scenario = (body?.scenario || {}) as TeamScenario;
    const messages = Array.isArray(body?.messages)
      ? (body.messages as TeamChatMessage[])
      : [];
    const suggestions = Array.isArray(body?.suggestions)
      ? (body.suggestions as ProgramSuggestion[])
      : [];
    const rolePrompt = String(body?.rolePrompt || "").trim();
    const roleObjective = String(body?.roleObjective || "").trim();
    const roleDocumentChecklist = Array.isArray(body?.roleDocumentChecklist)
      ? (body.roleDocumentChecklist as string[])
      : [];
    const authorizedUser = String(body?.authorizedUser || "").trim();
    const authorizedRole = String(body?.authorizedRole || "").trim();

    if (!action) {
      return NextResponse.json(
        { error: "Missing action." },
        { status: 400 }
      );
    }

    if (action === "chat") {
      const latestUserMessage =
        [...messages].reverse().find((msg) => msg.role === "user")?.content || "";

      if (!latestUserMessage) {
        return NextResponse.json(
          { error: "Missing user message." },
          { status: 400 }
        );
      }

      if (process.env.OPENAI_API_KEY) {
        try {
          const prompt = `
You are Finley Beyond, an internal mortgage scenario assistant for Beyond Intelligence.

Write a professional response for a mortgage professional.

Role objective:
${roleObjective || "Provide practical mortgage scenario guidance."}

Role prompt:
${rolePrompt || "Analyze the scenario carefully."}

Authorized user:
${authorizedUser || "Unknown"}

Authorized role:
${authorizedRole || "Unknown"}

Scenario summary:
${buildScenarioSummary(scenario)}

Live program matches:
${buildProgramSummary(suggestions)}

Suggested checklist:
${roleDocumentChecklist.length ? roleDocumentChecklist.join(", ") : "None provided"}

Conversation:
${messages
  .map((msg) => `${msg.role === "user" ? "Professional" : "Finley Beyond"}: ${msg.content}`)
  .join("\n")}

Instructions:
- Be practical, professional, and concise.
- Focus on qualification direction, program fit, risk flags, and next questions.
- Do not promise approval.
- Refer to lender-program matches if available.
- End with clear next-step guidance.
`;

          const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0.3,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a mortgage scenario assistant for licensed professionals. Be practical, conservative, and compliance-aware.",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
            }),
          });

          const aiData = await aiResponse.json();

          const reply =
            aiData?.choices?.[0]?.message?.content?.trim() ||
            buildFallbackReply(scenario, suggestions, latestUserMessage);

          return NextResponse.json({ reply });
        } catch {
          return NextResponse.json({
            reply: buildFallbackReply(scenario, suggestions, latestUserMessage),
          });
        }
      }

      return NextResponse.json({
        reply: buildFallbackReply(scenario, suggestions, latestUserMessage),
      });
    }

    if (action === "complete") {
      return NextResponse.json({
        success: true,
        message:
          "Review completed successfully. Email delivery can be connected next.",
      });
    }

    return NextResponse.json(
      { error: "Unsupported action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
