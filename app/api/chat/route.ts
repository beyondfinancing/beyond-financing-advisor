import { NextResponse } from "next/server";

type IncomingMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type RoutingPayload = {
  borrower?: {
    name?: string;
    email?: string;
    credit?: string;
    income?: string;
    debt?: string;
  };
  scenario?: {
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
  };
  selectedOfficer?: {
    id?: string;
    name?: string;
    nmls?: string;
    email?: string;
    assistantEmail?: string;
    mobile?: string;
    assistantMobile?: string;
    applyUrl?: string;
    scheduleUrl?: string;
  };
  language?: string;
  conversation?: IncomingMessage[];
};

type RequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up";
  routing?: RoutingPayload;
  messages?: IncomingMessage[];
};

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMessages(messages: unknown): IncomingMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      if (!msg || typeof msg !== "object") return null;

      const rawRole = (msg as { role?: unknown }).role;
      const content = safeString((msg as { content?: unknown }).content);

      if (!content) return null;

      let role: "system" | "user" | "assistant" = "user";
      if (rawRole === "assistant") role = "assistant";
      if (rawRole === "system") role = "system";

      return { role, content };
    })
    .filter(Boolean) as IncomingMessage[];
}

function hasValue(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function buildCollectedFacts(routing?: RoutingPayload) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const officer = routing?.selectedOfficer || {};

  return {
    borrowerName: safeString(borrower.name),
    borrowerEmail: safeString(borrower.email),
    credit: safeString(borrower.credit),
    income: safeString(borrower.income),
    debt: safeString(borrower.debt),
    homePrice: safeString(scenario.homePrice),
    downPayment: safeString(scenario.downPayment),
    estimatedLoanAmount: safeString(scenario.estimatedLoanAmount),
    estimatedLtv: safeString(scenario.estimatedLtv),
    officerName: safeString(officer.name),
    officerNmls: safeString(officer.nmls),
    language: safeString(routing?.language) || "en",
  };
}

function buildMissingItems(facts: ReturnType<typeof buildCollectedFacts>) {
  const missing: string[] = [];

  if (!hasValue(facts.borrowerName)) missing.push("borrower name");
  if (!hasValue(facts.borrowerEmail)) missing.push("borrower email");
  if (!hasValue(facts.credit)) missing.push("estimated credit score");
  if (!hasValue(facts.income)) missing.push("gross monthly income");
  if (!hasValue(facts.debt)) missing.push("monthly debt obligations");
  if (!hasValue(facts.homePrice)) missing.push("target home price");
  if (!hasValue(facts.downPayment)) missing.push("estimated down payment");

  return missing;
}

function buildLanguageInstruction(language: string) {
  if (language === "pt") return "Respond in Portuguese.";
  if (language === "es") return "Respond in Spanish.";
  return "Respond in English.";
}

function buildStageInstruction(stage?: string) {
  switch (stage) {
    case "initial_review":
      return "This is the initial intake review.";
    case "scenario_review":
      return "This is the property scenario review.";
    case "follow_up":
    default:
      return "This is a follow-up borrower conversation.";
  }
}

function buildSystemPrompt(stage: string | undefined, routing?: RoutingPayload) {
  const facts = buildCollectedFacts(routing);
  const missingItems = buildMissingItems(facts);

  return `
You are Finley Beyond, a borrower-facing mortgage assistant for Beyond Financing.

${buildLanguageInstruction(facts.language)}
${buildStageInstruction(stage)}

Non-negotiable rules:
- Be professional, concise, and helpful.
- Never promise approval.
- Never issue an underwriting decision.
- Never guarantee eligibility.
- Never quote personalized rates or definitive loan terms.
- You may explain general process only.
- Encourage Apply Now when appropriate.
- Refer final qualification and program review to the assigned licensed loan officer.

Critical behavior rule:
- The borrower intake form already collected some data.
- Treat the collected data below as already answered facts.
- DO NOT ask again for any item that already has a value.
- Ask only for information that is actually missing.
- If all major intake items are already collected, move forward naturally with the next logical question instead of repeating prior intake questions.

Collected borrower facts:
- Borrower Name: ${facts.borrowerName || "missing"}
- Borrower Email: ${facts.borrowerEmail || "missing"}
- Estimated Credit Score: ${facts.credit || "missing"}
- Gross Monthly Income: ${facts.income || "missing"}
- Monthly Debt Obligations: ${facts.debt || "missing"}
- Target Home Price: ${facts.homePrice || "missing"}
- Estimated Down Payment: ${facts.downPayment || "missing"}
- Estimated Loan Amount: ${facts.estimatedLoanAmount || "missing"}
- Estimated LTV: ${facts.estimatedLtv || "missing"}
- Assigned Loan Officer: ${facts.officerName || "missing"}
- Assigned Loan Officer NMLS: ${facts.officerNmls || "missing"}

Missing items only:
${
  missingItems.length > 0
    ? missingItems.map((item) => `- ${item}`).join("\n")
    : "- none"
}

Response instructions:
- If income is already present, do not ask for income.
- If debt is already present, do not ask for debt.
- If home price and down payment are already present, do not ask for them again.
- If credit score is already present, do not ask for it again.
- If there are missing items, ask for only one most important missing item.
- If there are no missing core items, acknowledge progress and ask a more advanced next-step question such as:
  occupancy, property type, employment type, assets/source of funds, timeline, or whether the borrower has already completed the application.
- Keep the response to a few short paragraphs.
  `.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const stage = body?.stage;
    const routing = body?.routing;
    const incomingMessages = normalizeMessages(body?.messages);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing OPENAI_API_KEY. Add it in Vercel Project Settings > Environment Variables.",
        },
        { status: 500 }
      );
    }

    if (!incomingMessages.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No chat messages were provided.",
        },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(stage, routing);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: systemPrompt,
          },
          ...incomingMessages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.message ||
            data?.message ||
            "OpenAI request failed.",
        },
        { status: 500 }
      );
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Thank you. Your assigned loan officer will review the scenario and advise the next steps.";

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error in /api/chat.",
      },
      { status: 500 }
    );
  }
}
