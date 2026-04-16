import { NextResponse } from "next/server";

type LanguageCode = "en" | "pt" | "es";

type ChatMessage = {
  role?: string;
  content?: string;
};

type LoanOfficerSelection = {
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

type ConversationMessage = {
  role?: string;
  content?: string;
};

type RoutingPayload = {
  language?: LanguageCode;
  loanOfficerQuery?: string;
  selectedOfficer?: LoanOfficerSelection;
  borrower?: {
    name?: string;
    email?: string;
    credit?: string;
    income?: string;
    debt?: string;
    phone?: string;
  };
  scenario?: {
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
    occupancy?: string;
    timeline?: string;
    fundsSource?: string;
  };
  conversation?: ConversationMessage[];
};

type RequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up";
  routing?: RoutingPayload;
  messages?: ChatMessage[];
};

type LoanOfficerRecord = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  mobile: string;
  assistantMobile: string;
  applyUrl: string;
  scheduleUrl: string;
};

type SummaryPayload = {
  borrowerSummary: string;
  likelyDirection: string;
  strengths: string[];
  openQuestions: string[];
  provisionalPrograms: string[];
  recommendedNextStep: string;
  loanOfficerActionPlan: string[];
};

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://calendly.com/sandropansini",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const DEFAULT_LOAN_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function buildTranscriptHtml(messages: ConversationMessage[]): string {
  return messages
    .map((msg, index) => {
      const roleLabel = msg.role === "user" ? "Borrower" : "Finley Beyond";

      return `
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:12px;background:${
          msg.role === "user" ? "#DCEAFE" : "#F3F4F6"
        };color:#263366;">
          <div style="font-weight:700;margin-bottom:6px;">${roleLabel} ${index + 1}</div>
          <div style="line-height:1.6;">${nl2br(msg.content || "")}</div>
        </div>
      `;
    })
    .join("");
}

function getLatestUserMessage(messages: ChatMessage[]) {
  const reversed = [...messages].reverse();
  return reversed.find((message) => message.role === "user")?.content ?? "";
}

function resolveLoanOfficer(routing?: RoutingPayload): LoanOfficerRecord {
  const selected = routing?.selectedOfficer;

  if (selected?.id) {
    const byId = LOAN_OFFICERS.find((officer) => officer.id === selected.id);
    if (byId) return byId;
  }

  if (selected?.nmls) {
    const byNmls = LOAN_OFFICERS.find(
      (officer) => officer.nmls.toLowerCase() === selected.nmls?.toLowerCase()
    );
    if (byNmls) return byNmls;
  }

  if (selected?.name) {
    const byName = LOAN_OFFICERS.find(
      (officer) => officer.name.toLowerCase() === selected.name?.toLowerCase()
    );
    if (byName) return byName;
  }

  const query = routing?.loanOfficerQuery?.trim().toLowerCase();

  if (query) {
    const exact = LOAN_OFFICERS.find(
      (officer) =>
        officer.name.toLowerCase() === query ||
        officer.nmls.toLowerCase() === query
    );
    if (exact) return exact;

    const partial = LOAN_OFFICERS.find(
      (officer) =>
        query.includes(officer.name.toLowerCase()) ||
        officer.name.toLowerCase().includes(query) ||
        query.includes(officer.nmls.toLowerCase()) ||
        officer.nmls.toLowerCase().includes(query)
    );
    if (partial) return partial;
  }

  return DEFAULT_LOAN_OFFICER;
}

function getLanguage(routing?: RoutingPayload): LanguageCode {
  return routing?.language || "en";
}

function conversationToText(conversation?: ConversationMessage[]) {
  if (!conversation || conversation.length === 0) return "";
  return conversation
    .map((item) => `${item.role || "unknown"}: ${item.content || ""}`)
    .join("\n");
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function detectClosingIntent(text: string) {
  const lower = text.toLowerCase();

  return hasAny(lower, [
    "i am ready to apply",
    "i'm ready to apply",
    "ready to apply",
    "i want to apply",
    "send me the application",
    "application link",
    "i want to move forward",
    "i'm ready to move forward",
    "lets move forward",
    "let's move forward",
    "schedule",
    "book a time",
    "book a call",
    "call me",
    "text me",
    "email me",
    "have him call me",
    "have her call me",
    "i am ready",
    "i'm ready",
    "vamos aplicar",
    "quero aplicar",
    "quero seguir",
    "quero prosseguir",
    "vamos prosseguir",
    "agendar",
    "marcar horário",
    "pode me ligar",
    "pode me mandar mensagem",
    "estoy listo para aplicar",
    "quiero aplicar",
    "quiero seguir",
    "quiero avanzar",
    "agendar",
    "llámame",
    "mándame mensaje",
  ]);
}

function buildContextBlock(
  language: LanguageCode,
  routing: RoutingPayload | undefined,
  assignedOfficer: LoanOfficerRecord
) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const transcript = conversationToText(routing?.conversation);

  return `
Borrower and scenario context:

Preferred language: ${language}
Assigned loan officer: ${assignedOfficer.name} — NMLS ${assignedOfficer.nmls}
Assigned loan officer email: ${assignedOfficer.email}
Assistant email: ${assignedOfficer.assistantEmail}

Borrower details:
- Name: ${borrower.name || "Not provided"}
- Email: ${borrower.email || "Not provided"}
- Phone: ${borrower.phone || "Not provided"}
- Estimated credit score: ${borrower.credit || "Not provided"}
- Gross monthly income: ${borrower.income || "Not provided"}
- Monthly debt: ${borrower.debt || "Not provided"}

Scenario details:
- Estimated home price: ${scenario.homePrice || "Not provided"}
- Estimated down payment: ${scenario.downPayment || "Not provided"}
- Estimated loan amount: ${scenario.estimatedLoanAmount || "Not provided"}
- Estimated LTV: ${scenario.estimatedLtv || "Not provided"}
- Occupancy: ${scenario.occupancy || "Not provided"}
- Timeline: ${scenario.timeline || "Not provided"}
- Funds source: ${scenario.fundsSource || "Not provided"}

Conversation transcript so far:
${transcript || "No prior transcript yet."}
  `.trim();
}

function buildInitialFallback(language: LanguageCode): string {
  if (language === "pt") {
    return `Obrigado por compartilhar estas informações iniciais.

Vou organizar este cenário para o loan officer designado, que fará a análise pessoal e orientará os próximos passos.

Para adiantar o processo, recomendo também clicar em Aplicar Agora.

Vou fazer algumas perguntas para ajudar na qualificação preliminar:

Esta compra seria para moradia principal, segunda casa ou imóvel de investimento?`;
  }

  if (language === "es") {
    return `Gracias por compartir esta información inicial.

Voy a organizar este escenario para el loan officer asignado, quien realizará la revisión personal y le orientará sobre los próximos pasos.

Para adelantar el proceso, también le recomiendo hacer clic en Aplicar Ahora.

Voy a hacerle algunas preguntas para ayudar con la calificación preliminar:

¿Esta compra sería para vivienda principal, segunda vivienda o propiedad de inversión?`;
  }

  return `Thank you for sharing this initial information.

I will organize this scenario for the assigned loan officer, who will review it personally and advise the next steps.

To help move things forward, I also recommend clicking Apply Now.

I will ask you a few questions to help with the preliminary qualification process:

Would this purchase be for a primary residence, a second home, or an investment property?`;
}

function buildScenarioFallback(language: LanguageCode): string {
  if (language === "pt") {
    return `Perfeito.

Agora tenho um cenário de compra mais claro para enviar ao loan officer designado.

Estas informações serão analisadas pessoalmente, e você receberá orientação sobre os próximos passos.

Também recomendo clicar em Aplicar Agora para adiantar o processo.

Para eu ajudar melhor, qual é o seu prazo ideal para comprar ou entrar em contrato: o quanto antes, nos próximos 30 a 60 dias, ou mais adiante?`;
  }

  if (language === "es") {
    return `Perfecto.

Ahora tengo un escenario de compra más claro para enviar al loan officer asignado.

Esta información será revisada personalmente, y usted recibirá orientación sobre los próximos pasos.

También le recomiendo hacer clic en Aplicar Ahora para avanzar el proceso.

Para ayudarle mejor, ¿cuál es su plazo ideal para comprar o entrar en contrato: lo antes posible, dentro de los próximos 30 a 60 días, o más adelante?`;
  }

  return `Perfect.

I now have a clearer purchase scenario to send to the assigned loan officer.

This information will be reviewed personally, and you will be guided on the next steps.

I also recommend clicking Apply Now to help move the process forward.

To help me guide the next step, what is your ideal timeline to buy or go under contract: as soon as possible, within the next 30 to 60 days, or later on?`;
}

function buildClosingFallback(language: LanguageCode, officerName: string): string {
  if (language === "pt") {
    return `Perfeito.

Se você já está pronto para seguir, este é um bom momento para encerrar esta etapa e avançar.

Recomendo clicar em Aplicar Agora para iniciar oficialmente, ou usar Agendar com o Loan Officer se preferir falar primeiro com ${officerName}.

Seu cenário será encaminhado para acompanhamento.`;
  }

  if (language === "es") {
    return `Perfecto.

Si ya está listo para avanzar, este es un buen momento para cerrar esta etapa y seguir al siguiente paso.

Le recomiendo hacer clic en Aplicar Ahora para iniciar oficialmente, o usar Agendar con el Loan Officer si prefiere hablar primero con ${officerName}.

Su escenario quedará encaminado para seguimiento.`;
  }

  return `Perfect.

If you are ready to move forward, this is the right point to close this step and proceed.

I recommend clicking Apply Now to begin officially, or using Schedule with Loan Officer if you would prefer to speak first with ${officerName}.

Your scenario will be routed for follow-up.`;
}

function buildFollowUpFallback(language: LanguageCode): string {
  if (language === "pt") {
    return `Obrigado. Isso já ajuda bastante.

Vou registrar isso para que o loan officer designado tenha um quadro mais claro do seu cenário.

Também recomendo clicar em Aplicar Agora para adiantar o processo.

Próxima pergunta útil:

Os fundos para entrada e fechamento virão principalmente de economias, gift funds, venda de outro imóvel ou outra fonte?`;
  }

  if (language === "es") {
    return `Gracias. Eso ayuda bastante.

Voy a registrar eso para que el loan officer asignado tenga un panorama más claro de su escenario.

También le recomiendo hacer clic en Aplicar Ahora para avanzar el proceso.

Siguiente pregunta útil:

¿Los fondos para el pago inicial y el cierre provendrán principalmente de ahorros, gift funds, venta de otra propiedad u otra fuente?`;
  }

  return `Thank you. That helps a lot.

I will note that so the assigned loan officer has a clearer picture of your scenario.

I also recommend clicking Apply Now to help move things forward.

Helpful next question:

Will your down payment and closing funds come mainly from savings, gift funds, the sale of another property, or another source?`;
}

async function callOpenAIChat(args: {
  system: string;
  user: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    return typeof content === "string" && content.trim() ? content.trim() : null;
  } catch {
    return null;
  }
}

async function callOpenAIJson<T>(args: {
  system: string;
  user: string;
}): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;

    if (typeof raw !== "string" || !raw.trim()) return null;

    return parseJsonSafely<T>(raw);
  } catch {
    return null;
  }
}

async function generateBorrowerReply(args: {
  stage: "initial_review" | "scenario_review" | "follow_up";
  language: LanguageCode;
  latestUserMessage: string;
  routing?: RoutingPayload;
  assignedOfficer: LoanOfficerRecord;
}): Promise<{ reply: string; shouldClose: boolean }> {
  const { stage, language, latestUserMessage, routing, assignedOfficer } = args;

  const closingIntent = detectClosingIntent(latestUserMessage);

  const system = `
You are Finley Beyond, an AI-powered mortgage advisor assistant for Beyond Financing.

Your job:
- speak naturally and professionally
- gather mortgage qualification information
- keep the conversation warm, polished, and human
- sound like a skilled loan officer assistant, not a bot

Important compliance rules:
- never promise approval
- never state that the borrower is definitively qualified
- never make a commitment to lend
- never provide personalized rates
- never provide a final underwriting decision
- you may reference broad possible mortgage directions carefully, only when useful
- you may encourage Apply Now and Schedule with Loan Officer
- do not ask the borrower to choose a lender, bank, or investor
- lender-channel decisions belong internally to the assigned loan officer
- if the borrower is clearly ready to apply, schedule, or be contacted, stop asking more qualification questions and move naturally to a close

Language rule:
- respond only in ${language === "pt" ? "Portuguese" : language === "es" ? "Spanish" : "English"}
  `.trim();

  const stageInstruction =
    closingIntent
      ? `
The borrower has expressed clear intent to move forward.
Do not ask another qualifying question.
Close the conversation naturally.
Direct the borrower to Apply Now or Schedule with Loan Officer.
Acknowledge that the assigned loan officer will follow up.
`
      : stage === "initial_review"
      ? `
The borrower has just completed the first intake.
Acknowledge the information.
Mention that the assigned loan officer will review it personally.
Then ask the next best borrower-relevant qualification question.
Do not ask about lender or bank preference.
`
      : stage === "scenario_review"
      ? `
The borrower has added a property scenario.
Acknowledge it naturally.
Mention that the assigned loan officer will review it personally.
If helpful, briefly mention broad possible direction without promising anything.
Then ask the next best borrower-relevant qualification question.
Do not ask about lender or bank preference.
`
      : `
Continue the borrower-facing mortgage conversation naturally.
Answer the borrower clearly and humanly.
Do not ask about lender or bank preference.
If the borrower signals readiness to move forward, stop asking questions and close naturally to CTA.
Otherwise, ask only one useful next question.
`;

  const user = `
${buildContextBlock(language, routing, assignedOfficer)}

Current stage: ${stage}
Assigned loan officer name: ${assignedOfficer.name}
Borrower expressed closing intent: ${closingIntent ? "yes" : "no"}

Latest borrower message:
${latestUserMessage}

Instruction:
${stageInstruction}
  `.trim();

  const aiReply = await callOpenAIChat({ system, user });

  if (aiReply) {
    return { reply: aiReply, shouldClose: closingIntent };
  }

  if (closingIntent) {
    return {
      reply: buildClosingFallback(language, assignedOfficer.name),
      shouldClose: true,
    };
  }

  if (stage === "initial_review") {
    return { reply: buildInitialFallback(language), shouldClose: false };
  }

  if (stage === "scenario_review") {
    return { reply: buildScenarioFallback(language), shouldClose: false };
  }

  return { reply: buildFollowUpFallback(language), shouldClose: false };
}

function buildFallbackSummary(
  stage: string,
  assignedOfficer: LoanOfficerRecord,
  routing?: RoutingPayload
): SummaryPayload {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const transcript = conversationToText(routing?.conversation);

  const strengths: string[] = [];
  if (borrower.name) strengths.push("Borrower provided name.");
  if (borrower.email) strengths.push("Borrower provided email.");
  if (borrower.credit) strengths.push(`Estimated credit score provided: ${borrower.credit}.`);
  if (borrower.income) strengths.push(`Gross monthly income provided: ${borrower.income}.`);
  if (scenario.homePrice) strengths.push(`Estimated home price provided: ${scenario.homePrice}.`);
  if (scenario.downPayment) strengths.push(`Estimated down payment provided: ${scenario.downPayment}.`);

  const provisionalPrograms: string[] = [];
  const credit = Number(borrower.credit || 0);
  const ltv = Number(String(scenario.estimatedLtv || "").replace("%", "") || 0);

  if (credit >= 700) provisionalPrograms.push("Conventional review");
  if (credit >= 620 && ltv >= 90) provisionalPrograms.push("High-LTV conventional review");
  if (credit > 0 && credit < 700) provisionalPrograms.push("FHA review");
  if (provisionalPrograms.length === 0) provisionalPrograms.push("Initial financing review");

  return {
    borrowerSummary:
      transcript ||
      "Borrower engaged with Finley Beyond and submitted a mortgage scenario.",
    likelyDirection:
      "Borrower appears to be in an early mortgage review stage and should receive licensed loan officer follow-up.",
    strengths:
      strengths.length > 0
        ? strengths
        : ["Borrower engaged with the intake and qualification flow."],
    openQuestions: [
      "Confirm occupancy intent.",
      "Confirm timeline to purchase.",
      "Confirm funds source for down payment and closing.",
      "Confirm documentation strategy.",
    ],
    provisionalPrograms,
    recommendedNextStep:
      "Loan officer should review the scenario personally and guide the borrower toward application and next steps.",
    loanOfficerActionPlan: [
      `Review this ${stage} interaction.`,
      "Contact the borrower directly.",
      "Confirm occupancy, timeline, and funds to close.",
      "Determine the most appropriate program direction after full review.",
    ],
  };
}

async function generateInternalSummary(args: {
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
}): Promise<SummaryPayload> {
  const { stage, assignedOfficer, routing } = args;
  const fallback = buildFallbackSummary(stage, assignedOfficer, routing);

  const system = `
You create concise internal mortgage loan officer briefings for Beyond Financing.

Return valid JSON only with this exact shape:
{
  "borrowerSummary": "string",
  "likelyDirection": "string",
  "strengths": ["string"],
  "openQuestions": ["string"],
  "provisionalPrograms": ["string"],
  "recommendedNextStep": "string",
  "loanOfficerActionPlan": ["string"]
}

Rules:
- write for an internal licensed mortgage loan officer
- be practical and concise
- use only the borrower data and transcript provided
- do not promise approval
- do not claim certainty where the data does not support it
- provisional programs should be directional only
- do not mention lender selection questions to the borrower
  `.trim();

  const user = `
Assigned loan officer:
- Name: ${assignedOfficer.name}
- NMLS: ${assignedOfficer.nmls}

Stage:
${stage}

${buildContextBlock(getLanguage(routing), routing, assignedOfficer)}
  `.trim();

  const aiSummary = await callOpenAIJson<SummaryPayload>({ system, user });

  if (!aiSummary) return fallback;

  return {
    borrowerSummary: aiSummary.borrowerSummary || fallback.borrowerSummary,
    likelyDirection: aiSummary.likelyDirection || fallback.likelyDirection,
    strengths:
      Array.isArray(aiSummary.strengths) && aiSummary.strengths.length > 0
        ? aiSummary.strengths
        : fallback.strengths,
    openQuestions:
      Array.isArray(aiSummary.openQuestions) && aiSummary.openQuestions.length > 0
        ? aiSummary.openQuestions
        : fallback.openQuestions,
    provisionalPrograms:
      Array.isArray(aiSummary.provisionalPrograms) &&
      aiSummary.provisionalPrograms.length > 0
        ? aiSummary.provisionalPrograms
        : fallback.provisionalPrograms,
    recommendedNextStep:
      aiSummary.recommendedNextStep || fallback.recommendedNextStep,
    loanOfficerActionPlan:
      Array.isArray(aiSummary.loanOfficerActionPlan) &&
      aiSummary.loanOfficerActionPlan.length > 0
        ? aiSummary.loanOfficerActionPlan
        : fallback.loanOfficerActionPlan,
  };
}

function buildSummaryHtml(args: {
  summary: SummaryPayload;
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
}) {
  const { summary, stage, assignedOfficer, routing } = args;
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const transcriptMessages = routing?.conversation || [];

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Conversation Summary - Finley Beyond</h1>

      <div style="background:#F8FAFC;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Lead Details</h2>
        <p><strong>Stage:</strong> ${escapeHtml(stage)}</p>
        <p><strong>Preferred Language:</strong> ${escapeHtml(routing?.language || "en")}</p>
        <p><strong>Assigned Loan Officer:</strong> ${escapeHtml(
          `${assignedOfficer.name} — NMLS ${assignedOfficer.nmls}`
        )}</p>
        <p><strong>Borrower Name:</strong> ${escapeHtml(borrower.name || "Not provided")}</p>
        <p><strong>Email:</strong> ${escapeHtml(borrower.email || "Not provided")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(borrower.phone || "Not provided")}</p>
        <p><strong>Credit Score:</strong> ${escapeHtml(borrower.credit || "Not provided")}</p>
        <p><strong>Gross Monthly Income:</strong> ${escapeHtml(
          borrower.income || "Not provided"
        )}</p>
        <p><strong>Monthly Debt:</strong> ${escapeHtml(borrower.debt || "Not provided")}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Scenario Snapshot</h2>
        <p><strong>Estimated Home Price:</strong> ${escapeHtml(
          scenario.homePrice || "Not provided"
        )}</p>
        <p><strong>Estimated Down Payment:</strong> ${escapeHtml(
          scenario.downPayment || "Not provided"
        )}</p>
        <p><strong>Estimated Loan Amount:</strong> ${escapeHtml(
          scenario.estimatedLoanAmount || "Not provided"
        )}</p>
        <p><strong>Estimated LTV:</strong> ${escapeHtml(
          scenario.estimatedLtv || "Not provided"
        )}</p>
        <p><strong>Occupancy:</strong> ${escapeHtml(scenario.occupancy || "Not provided")}</p>
        <p><strong>Timeline:</strong> ${escapeHtml(scenario.timeline || "Not provided")}</p>
        <p><strong>Funds Source:</strong> ${escapeHtml(
          scenario.fundsSource || "Not provided"
        )}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Borrower Summary</h2>
        <p style="line-height:1.7;">${nl2br(summary.borrowerSummary)}</p>

        <h3 style="margin:18px 0 8px 0;">Likely Direction</h3>
        <p style="line-height:1.7;">${nl2br(summary.likelyDirection)}</p>

        <h3 style="margin:18px 0 8px 0;">Provisional Program Directions</h3>
        <ul style="line-height:1.8;">
          ${summary.provisionalPrograms
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Strengths</h3>
        <ul style="line-height:1.8;">
          ${summary.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Open Questions</h3>
        <ul style="line-height:1.8;">
          ${summary.openQuestions
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}
        </ul>

        <h3 style="margin:18px 0 8px 0;">Recommended Next Step</h3>
        <p style="line-height:1.7;">${nl2br(summary.recommendedNextStep)}</p>

        <h3 style="margin:18px 0 8px 0;">Loan Officer Action Plan</h3>
        <ul style="line-height:1.8;">
          ${summary.loanOfficerActionPlan
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}
        </ul>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Full Conversation Transcript</h2>
        ${
          transcriptMessages.length > 0
            ? buildTranscriptHtml(transcriptMessages)
            : "<p>No transcript available.</p>"
        }
      </div>
    </div>
  `;
}

async function sendResendEmail(args: {
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
  stage: string;
  summary: SummaryPayload;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom =
    process.env.RESEND_FROM_EMAIL ||
    "Beyond Intelligence <noreply@beyondfinancing.com>";

  if (!resendApiKey) {
    console.log("RESEND_SKIPPED_NO_API_KEY");
    return;
  }

  const borrowerName = args.routing?.borrower?.name || "Unknown Borrower";

  const html = buildSummaryHtml({
    summary: args.summary,
    stage: args.stage,
    assignedOfficer: args.assignedOfficer,
    routing: args.routing,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [args.assignedOfficer.email],
      cc: [args.assignedOfficer.assistantEmail],
      reply_to: args.routing?.borrower?.email || undefined,
      subject: `Beyond Intelligence Interaction — ${borrowerName}`,
      html,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.log("RESEND_ERROR", text);
  } else {
    console.log("RESEND_SUCCESS", text);
  }
}

async function sendTwilioSms(args: {
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.log("TWILIO_SKIPPED_MISSING_CONFIG");
    return;
  }

  const borrowerName = args.routing?.borrower?.name || "Unknown Borrower";
  const messageToOfficer = `New Beyond Intelligence interaction received for ${borrowerName}. Review the email summary and follow up promptly.`;
  const messageToAssistant = `New Beyond Intelligence interaction received for ${borrowerName}. Review the assigned loan officer summary email.`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const sendOne = async (to: string, body: string) => {
    const payload = new URLSearchParams();
    payload.append("To", `+1${to}`);
    payload.append("From", from);
    payload.append("Body", body);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.log("TWILIO_ERROR", text);
    } else {
      console.log("TWILIO_SUCCESS", text);
    }
  };

  await sendOne(args.assignedOfficer.mobile, messageToOfficer);
  await sendOne(args.assignedOfficer.assistantMobile, messageToAssistant);
}

async function queueInternalNotifications(args: {
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
  summary: SummaryPayload;
}) {
  await sendResendEmail({
    assignedOfficer: args.assignedOfficer,
    routing: args.routing,
    stage: args.stage,
    summary: args.summary,
  });

  await sendTwilioSms({
    assignedOfficer: args.assignedOfficer,
    routing: args.routing,
  });
}

async function generateInternalSummary(args: {
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
}): Promise<SummaryPayload> {
  const { stage, assignedOfficer, routing } = args;
  const fallback = buildFallbackSummary(stage, assignedOfficer, routing);

  const system = `
You create concise internal mortgage loan officer briefings for Beyond Financing.

Return valid JSON only with this exact shape:
{
  "borrowerSummary": "string",
  "likelyDirection": "string",
  "strengths": ["string"],
  "openQuestions": ["string"],
  "provisionalPrograms": ["string"],
  "recommendedNextStep": "string",
  "loanOfficerActionPlan": ["string"]
}

Rules:
- write for an internal licensed mortgage loan officer
- be practical and concise
- use only the borrower data and transcript provided
- do not promise approval
- provisional programs should be directional only
  `.trim();

  const user = `
Assigned loan officer:
- Name: ${assignedOfficer.name}
- NMLS: ${assignedOfficer.nmls}

Stage:
${stage}

${buildContextBlock(getLanguage(routing), routing, assignedOfficer)}
  `.trim();

  const aiSummary = await callOpenAIJson<SummaryPayload>({ system, user });

  if (!aiSummary) return fallback;

  return {
    borrowerSummary: aiSummary.borrowerSummary || fallback.borrowerSummary,
    likelyDirection: aiSummary.likelyDirection || fallback.likelyDirection,
    strengths:
      Array.isArray(aiSummary.strengths) && aiSummary.strengths.length > 0
        ? aiSummary.strengths
        : fallback.strengths,
    openQuestions:
      Array.isArray(aiSummary.openQuestions) && aiSummary.openQuestions.length > 0
        ? aiSummary.openQuestions
        : fallback.openQuestions,
    provisionalPrograms:
      Array.isArray(aiSummary.provisionalPrograms) &&
      aiSummary.provisionalPrograms.length > 0
        ? aiSummary.provisionalPrograms
        : fallback.provisionalPrograms,
    recommendedNextStep:
      aiSummary.recommendedNextStep || fallback.recommendedNextStep,
    loanOfficerActionPlan:
      Array.isArray(aiSummary.loanOfficerActionPlan) &&
      aiSummary.loanOfficerActionPlan.length > 0
        ? aiSummary.loanOfficerActionPlan
        : fallback.loanOfficerActionPlan,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const messages = body?.messages;
    const routing = body?.routing;
    const stage = body?.stage || "follow_up";

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

    const language = getLanguage(routing);
    const assignedOfficer = resolveLoanOfficer(routing);

    const borrowerReply = await generateBorrowerReply({
      stage,
      language,
      latestUserMessage,
      routing,
      assignedOfficer,
    });

    const updatedConversation =
      routing?.conversation && routing.conversation.length > 0
        ? [...routing.conversation, { role: "assistant", content: borrowerReply.reply }]
        : [{ role: "assistant", content: borrowerReply.reply }];

    let internalSummaryPrepared = false;

    if (borrowerReply.shouldClose) {
      const summary = await generateInternalSummary({
        stage,
        assignedOfficer,
        routing: {
          ...routing,
          conversation: updatedConversation,
        },
      });

      await queueInternalNotifications({
        stage,
        assignedOfficer,
        routing: {
          ...routing,
          conversation: updatedConversation,
        },
        summary,
      });

      internalSummaryPrepared = true;
    }

    return NextResponse.json({
      reply: borrowerReply.reply,
      assignedOfficer: {
        name: assignedOfficer.name,
        nmls: assignedOfficer.nmls,
        email: assignedOfficer.email,
        assistantEmail: assignedOfficer.assistantEmail,
        applyUrl: assignedOfficer.applyUrl,
        scheduleUrl: assignedOfficer.scheduleUrl,
      },
      internalSummaryPrepared,
      conversationClosed: borrowerReply.shouldClose,
    });
  } catch {
    return NextResponse.json(
      { reply: "Server error processing request." },
      { status: 500 }
    );
  }
}
