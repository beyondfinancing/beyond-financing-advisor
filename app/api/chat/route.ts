import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type LoanOfficerRecord = {
  id?: string;
  name?: string;
  nmls?: string;
  email?: string;
  assistantEmail?: string;
  applyUrl?: string;
  scheduleUrl?: string;
};

type RoutingPayload = {
  language?: "en" | "pt" | "es";
  loanOfficerQuery?: string;
  selectedOfficer?: LoanOfficerRecord;
  borrower?: {
    name?: string;
    email?: string;
    phone?: string;
    credit?: string;
    income?: string;
    debt?: string;
    currentState?: string;
    targetState?: string;
    realtorName?: string;
    realtorPhone?: string;
  };
  scenario?: {
    transactionType?: string;
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
    occupancy?: string;
    timeline?: string;
    fundsSource?: string;
    communicationPreference?: string;
  };
  internalMatch?: {
    topRecommendation?: string;
    nextQuestion?: string;
    strongCount?: number;
    conditionalCount?: number;
    eliminatedCount?: number;
    totalGuidelinesChecked?: number;
    activeLendersChecked?: string[];
    topStrongMatches?: Array<{
      lender_name: string;
      program_name: string;
      loan_category: string | null;
      score: number;
      explanation: string;
      notes: string[];
      strengths: string[];
      concerns: string[];
    }>;
  };
  conversation?: ChatMessage[];
};

type ChatRequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up";
  routing?: RoutingPayload;
  messages?: ChatMessage[];
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function languageName(code?: string): string {
  if (code === "pt") return "Portuguese";
  if (code === "es") return "Spanish";
  return "English";
}

function extractLatestUserMessage(messages: ChatMessage[]): string {
  const reversed = [...messages].reverse();
  const found = reversed.find((m) => m.role === "user" && normalizeText(m.content));
  return found?.content?.trim() || "";
}

function getSpecificMissingQuestion(routing?: RoutingPayload): string {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};

  if (isMissing(borrower.name)) {
    return "What is the borrower’s full name?";
  }

  if (isMissing(borrower.email)) {
    return "What is the borrower’s best email address?";
  }

  if (isMissing(borrower.phone)) {
    return "What is the borrower’s best phone number?";
  }

  if (isMissing(borrower.credit)) {
    return "What is the borrower’s estimated credit score?";
  }

  if (isMissing(borrower.income)) {
    return "What is the borrower’s estimated gross monthly income?";
  }

  if (isMissing(borrower.debt)) {
    return "What is the borrower’s estimated total monthly debt?";
  }

  if (isMissing(borrower.currentState)) {
    return "What state does the borrower currently live in?";
  }

  if (isMissing(borrower.targetState)) {
    return "What state is the borrower looking to buy or refinance in?";
  }

  if (isMissing(scenario.transactionType)) {
    return "Is this a purchase, refinance, or investment-property scenario?";
  }

  if (isMissing(scenario.homePrice)) {
    return "What is the estimated purchase price or property value?";
  }

  if (isMissing(scenario.downPayment)) {
    return "What is the estimated down payment or available equity contribution?";
  }

  if (isMissing(scenario.occupancy)) {
    return "Will this property be a primary residence, second home, or investment property?";
  }

  if (isMissing(scenario.timeline)) {
    return "What is the expected timeline to move forward: immediately, within 30 days, 60 to 90 days, or later?";
  }

  if (isMissing(scenario.fundsSource)) {
    return "What is the source of funds for the down payment and closing costs?";
  }

  if (isMissing(scenario.communicationPreference)) {
    return "What is the borrower’s preferred communication method: call, text, or email?";
  }

  return routing?.internalMatch?.nextQuestion?.trim() ||
    "What compensating factor is strongest here: reserves, lower LTV, stronger credit, or stronger income documentation?";
}

function buildDeterministicReply(body: ChatRequestBody): string {
  const routing = body.routing;
  const language = routing?.language || "en";
  const borrowerName = normalizeText(routing?.borrower?.name) || "Borrower";
  const latestUserMessage = extractLatestUserMessage(body.messages || []);
  const nextQuestion = getSpecificMissingQuestion(routing);
  const likelyDirection = normalizeText(
    routing?.internalMatch?.topRecommendation
  );

  const hasEnoughCoreInfo =
    !isMissing(routing?.borrower?.name) &&
    !isMissing(routing?.borrower?.email) &&
    !isMissing(routing?.borrower?.phone) &&
    !isMissing(routing?.borrower?.credit) &&
    !isMissing(routing?.borrower?.income) &&
    !isMissing(routing?.scenario?.homePrice) &&
    !isMissing(routing?.scenario?.downPayment) &&
    !isMissing(routing?.scenario?.occupancy);

  if (language === "pt") {
    if (!hasEnoughCoreInfo) {
      return `Obrigado, ${borrowerName}. Já organizei as informações iniciais. O próximo detalhe específico que preciso é: ${nextQuestion}`;
    }

    if (latestUserMessage.toLowerCase().includes("what next") || latestUserMessage.toLowerCase().includes("missing")) {
      return `Claro. O próximo detalhe específico que eu preciso neste momento é: ${nextQuestion}`;
    }

    return `Obrigado, ${borrowerName}. Já organizei este cenário para revisão interna. ${
      likelyDirection
        ? `Neste momento, a direção interna mais provável é: ${likelyDirection}. `
        : ""
    }Para seguir com mais clareza, a próxima pergunta mais útil é: ${nextQuestion} Também recomendo clicar em Apply Now para que o loan officer revise tudo pessoalmente.`;
  }

  if (language === "es") {
    if (!hasEnoughCoreInfo) {
      return `Gracias, ${borrowerName}. Ya organicé la información inicial. El siguiente detalle específico que necesito es: ${nextQuestion}`;
    }

    if (latestUserMessage.toLowerCase().includes("what next") || latestUserMessage.toLowerCase().includes("missing")) {
      return `Claro. El siguiente detalle específico que necesito en este momento es: ${nextQuestion}`;
    }

    return `Gracias, ${borrowerName}. Ya organicé este escenario para revisión interna. ${
      likelyDirection
        ? `En este momento, la dirección interna más probable es: ${likelyDirection}. `
        : ""
    }Para seguir con mayor claridad, la siguiente pregunta más útil es: ${nextQuestion} También recomiendo hacer clic en Apply Now para que el loan officer revise todo personalmente.`;
  }

  if (!hasEnoughCoreInfo) {
    return `Thank you, ${borrowerName}. I have organized the initial information. The next specific detail I need is: ${nextQuestion}`;
  }

  if (
    latestUserMessage.toLowerCase().includes("what next") ||
    latestUserMessage.toLowerCase().includes("missing")
  ) {
    return `Certainly. The next specific detail I need at this point is: ${nextQuestion}`;
  }

  return `Thank you, ${borrowerName}. I have organized this scenario for internal review. ${
    likelyDirection ? `At this stage, the most likely internal direction is: ${likelyDirection}. ` : ""
  }To move forward with better clarity, the next most useful question is: ${nextQuestion} I also recommend clicking Apply Now so the loan officer can personally review everything.`;
}

function buildSystemPrompt(body: ChatRequestBody): string {
  const routing = body.routing || {};
  const borrower = routing.borrower || {};
  const scenario = routing.scenario || {};
  const internalMatch = routing.internalMatch || {};

  return `
You are Finley Beyond, a borrower-facing mortgage assistant for Beyond Intelligence.

Your role:
- Speak clearly, professionally, and helpfully.
- Be borrower-safe and compliance-aware.
- Never promise approval.
- Never guarantee terms, rates, or final eligibility.
- You may reference that the scenario is being organized for licensed loan officer review.
- You may encourage the borrower to click Apply Now.
- You should ask one specific next qualification question when useful.
- Avoid vague repetitive wording like "share the next missing detail" unless you immediately name the exact detail needed.

Current language: ${languageName(routing.language)}

Borrower context:
- Name: ${normalizeText(borrower.name) || "Not provided"}
- Email: ${normalizeText(borrower.email) || "Not provided"}
- Phone: ${normalizeText(borrower.phone) || "Not provided"}
- Credit: ${normalizeText(borrower.credit) || "Not provided"}
- Income: ${normalizeText(borrower.income) || "Not provided"}
- Debt: ${normalizeText(borrower.debt) || "Not provided"}
- Current state: ${normalizeText(borrower.currentState) || "Not provided"}
- Target state: ${normalizeText(borrower.targetState) || "Not provided"}

Scenario context:
- Transaction type: ${normalizeText(scenario.transactionType) || "Not provided"}
- Home price: ${normalizeText(scenario.homePrice) || "Not provided"}
- Down payment: ${normalizeText(scenario.downPayment) || "Not provided"}
- Estimated loan amount: ${normalizeText(scenario.estimatedLoanAmount) || "Not provided"}
- Estimated LTV: ${normalizeText(scenario.estimatedLtv) || "Not provided"}
- Occupancy: ${normalizeText(scenario.occupancy) || "Not provided"}
- Timeline: ${normalizeText(scenario.timeline) || "Not provided"}
- Funds source: ${normalizeText(scenario.fundsSource) || "Not provided"}
- Communication preference: ${normalizeText(scenario.communicationPreference) || "Not provided"}

Internal match direction:
- Top recommendation: ${normalizeText(internalMatch.topRecommendation) || "Not available"}
- Strong count: ${internalMatch.strongCount ?? 0}
- Conditional count: ${internalMatch.conditionalCount ?? 0}
- Eliminated count: ${internalMatch.eliminatedCount ?? 0}
- Total guidelines checked: ${internalMatch.totalGuidelinesChecked ?? 0}
- Next suggested question: ${normalizeText(internalMatch.nextQuestion) || "Not available"}

If something is missing, ask the single most specific next question.
If the borrower asks what is missing, answer directly with the exact detail.
If enough information is already present, acknowledge the scenario and ask the next best qualification question.
`.trim();
}

async function getOpenAiReply(body: ChatRequestBody): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const messages = body.messages || [];
  const systemPrompt = buildSystemPrompt(body);

  try {
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
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;

    const reply =
      (await getOpenAiReply(body)) ||
      buildDeterministicReply(body);

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const updatedConversation: ChatMessage[] = [
      ...messages,
      {
        role: "assistant",
        content: reply,
      },
    ];

    return NextResponse.json({
      success: true,
      reply,
      routing: {
        ...(body.routing || {}),
        conversation: updatedConversation,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        reply: "There was a problem processing the chat request.",
        error:
          error instanceof Error ? error.message : "Unexpected chat route failure.",
      },
      { status: 500 }
    );
  }
}
