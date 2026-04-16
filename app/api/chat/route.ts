import { NextResponse } from "next/server";

import { evaluateFannieMaeSingleFamily } from "@/lib/lender-guidelines/fannie-mae/single-family/data";
import { evaluateFannieMaeMultifamily } from "@/lib/lender-guidelines/fannie-mae/multi-family/data";
import { evaluateFreddieMacSingleFamily } from "@/lib/lender-guidelines/freddie-mac/single-family/data";
import { evaluateFreddieMacMultifamily } from "@/lib/lender-guidelines/freddie-mac/multi-family/data";

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

type BorrowerFields = {
  name?: string;
  email?: string;
  credit?: string;
  income?: string;
  debt?: string;
  phone?: string;
};

type ScenarioFields = {
  homePrice?: string;
  downPayment?: string;
  estimatedLoanAmount?: string;
  estimatedLtv?: string;
  occupancy?: string;
  timeline?: string;
  fundsSource?: string;
  units?: string;
  propertyType?: string;
  dscr?: string;
  firstTimeBuyer?: string;
  experienceLevel?: string;
  communicationPreference?: string;
  transactionType?: string;
  citizenshipStatus?: string;
  visaType?: string;
  currentHousingPayment?: string;
  reoCount?: string;
  giftFunds?: string;
  selfEmployed?: string;
  incomeType?: string;
};

type RoutingPayload = {
  language?: LanguageCode;
  loanOfficerQuery?: string;
  selectedOfficer?: LoanOfficerSelection;
  borrower?: BorrowerFields;
  scenario?: ScenarioFields;
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
  riskFlags: string[];
  missingItems: string[];
  borrowerReadiness: string;
  suggestedDocuments: string[];
};

type AnswerState = {
  hasName: boolean;
  hasEmail: boolean;
  hasCredit: boolean;
  hasIncome: boolean;
  hasDebt: boolean;
  hasHomePrice: boolean;
  hasDownPayment: boolean;
  hasLoanAmount: boolean;
  hasLtv: boolean;
  hasOccupancy: boolean;
  hasTimeline: boolean;
  hasFundsSource: boolean;
  hasPropertyTypeIntent: boolean;
  hasCommunicationPreference: boolean;
  hasIncomeType: boolean;
  hasTransactionType: boolean;
};

type InternalProgramMatch = {
  program: string;
  strength: "strong" | "moderate" | "weak";
  source: string;
  notes: string[];
};

type ExtractedStructuredAnswers = {
  borrower?: Partial<BorrowerFields>;
  scenario?: Partial<ScenarioFields>;
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

function hasValue(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
    "llámame",
    "mándame mensaje",
  ]);
}

function detectCommunicationPreferenceValue(text: string): string | undefined {
  const lower = text.toLowerCase();

  const wantsText = hasAny(lower, [
    "text me",
    "text message",
    "text is better",
    "mensagem",
    "texto",
    "mensaje",
  ]);

  const wantsCall = hasAny(lower, [
    "call me",
    "phone call",
    "phone is better",
    "ligar",
    "ligação",
    "llamar",
    "phone",
  ]);

  const wantsEmail = hasAny(lower, [
    "email me",
    "email is better",
    "correo",
    "e-mail",
    "email",
  ]);

  if (wantsText && wantsCall) return "Text message and phone call";
  if (wantsText && wantsEmail) return "Text message and email";
  if (wantsCall && wantsEmail) return "Phone call and email";
  if (wantsText) return "Text message";
  if (wantsCall) return "Phone call";
  if (wantsEmail) return "Email";

  return undefined;
}

function normalizeOccupancy(
  occupancy?: string
): "primary" | "second" | "investment" | "mixed-use" | "other" {
  const value = (occupancy || "").toLowerCase().trim();

  if (
    hasAny(value, [
      "primary",
      "primary residence",
      "primary home",
      "owner occupied",
      "owner-occupied",
      "moradia principal",
      "residência principal",
      "vivienda principal",
    ])
  ) {
    return "primary";
  }

  if (
    hasAny(value, [
      "second",
      "second home",
      "vacation home",
      "segunda casa",
      "segunda vivienda",
    ])
  ) {
    return "second";
  }

  if (
    hasAny(value, [
      "investment",
      "investment property",
      "investimento",
      "propiedad de inversión",
    ])
  ) {
    return "investment";
  }

  if (hasAny(value, ["mixed-use", "mixed use", "mixed", "mixed use property"])) {
    return "mixed-use";
  }

  return "other";
}

function normalizeExperience(
  experienceLevel?: string
): "first-time-investor" | "experienced-investor" | undefined {
  const value = (experienceLevel || "").toLowerCase().trim();

  if (
    hasAny(value, [
      "first-time-investor",
      "first time investor",
      "first investor",
      "primeiro investidor",
      "primer inversionista",
    ])
  ) {
    return "first-time-investor";
  }

  if (
    hasAny(value, [
      "experienced-investor",
      "experienced investor",
      "seasoned investor",
      "investidor experiente",
      "inversionista experimentado",
    ])
  ) {
    return "experienced-investor";
  }

  return undefined;
}

function normalizeTransactionType(value?: string): string | undefined {
  const lower = (value || "").toLowerCase().trim();
  if (!lower) return undefined;

  if (hasAny(lower, ["purchase", "buy", "compra", "comprar", "compra de vivienda"])) {
    return "Purchase";
  }

  if (hasAny(lower, ["refinance", "refi", "refinanciamento", "refinance"])) {
    return "Refinance";
  }

  if (hasAny(lower, ["cash-out", "cash out", "saque", "retiro de efectivo"])) {
    return "Cash-Out Refinance";
  }

  return normalizeWhitespace(value || "");
}

function normalizeTimelineValue(value?: string): string | undefined {
  const lower = (value || "").toLowerCase().trim();
  if (!lower) return undefined;

  if (
    hasAny(lower, [
      "as soon as possible",
      "asap",
      "immediately",
      "o quanto antes",
      "o mais rápido possível",
      "lo antes posible",
      "inmediatamente",
    ])
  ) {
    return "As soon as possible";
  }

  if (
    hasAny(lower, [
      "30 to 60 days",
      "30-60 days",
      "30 a 60 dias",
      "30 a 60 días",
    ])
  ) {
    return "Within 30 to 60 days";
  }

  if (
    hasAny(lower, [
      "within 3 months",
      "next 3 months",
      "3 months",
      "3 meses",
      "within the next three months",
    ])
  ) {
    return "Within 3 months";
  }

  if (hasAny(lower, ["next month", "próximo mês", "próximo mes"])) {
    return "Next month";
  }

  if (hasAny(lower, ["this month", "este mês", "este mes"])) {
    return "This month";
  }

  return normalizeWhitespace(value || "");
}

function normalizeFundsSourceValue(value?: string): string | undefined {
  const lower = (value || "").toLowerCase().trim();
  if (!lower) return undefined;

  if (
    hasAny(lower, [
      "savings",
      "savings account",
      "bank account",
      "economias",
      "poupança",
      "ahorros",
    ])
  ) {
    return "Savings";
  }

  if (hasAny(lower, ["gift", "gift funds", "doação", "regalo"])) {
    return "Gift funds";
  }

  if (
    hasAny(lower, [
      "sale of another property",
      "sale of property",
      "venda de imóvel",
      "venta de propiedad",
    ])
  ) {
    return "Sale of another property";
  }

  if (hasAny(lower, ["business funds", "fundos da empresa", "fondos del negocio"])) {
    return "Business funds";
  }

  return normalizeWhitespace(value || "");
}

function normalizeIncomeTypeValue(value?: string): string | undefined {
  const lower = (value || "").toLowerCase().trim();
  if (!lower) return undefined;

  if (hasAny(lower, ["w2", "w-2", "salary", "salaried", "salário", "asalariado"])) {
    return "W-2 / Salaried";
  }

  if (hasAny(lower, ["hourly", "por hora"])) {
    return "Hourly";
  }

  if (hasAny(lower, ["self-employed", "self employed", "autônomo", "autonomo", "independiente"])) {
    return "Self-Employed";
  }

  if (hasAny(lower, ["1099"])) {
    return "1099";
  }

  if (hasAny(lower, ["commission", "comissão", "comision"])) {
    return "Commission";
  }

  if (hasAny(lower, ["bonus", "bônus", "bono"])) {
    return "Bonus";
  }

  if (hasAny(lower, ["rental income", "aluguéis", "alquileres"])) {
    return "Rental Income";
  }

  if (hasAny(lower, ["social security", "retirement", "aposentadoria", "jubilación"])) {
    return "Retirement / Fixed Income";
  }

  return normalizeWhitespace(value || "");
}

function extractNamedPattern(
  text: string,
  patterns: RegExp[]
): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }
  return undefined;
}

function extractStructuredAnswers(
  latestUserMessage: string,
  routing?: RoutingPayload
): ExtractedStructuredAnswers {
  const lower = latestUserMessage.toLowerCase();
  const extracted: ExtractedStructuredAnswers = {
    borrower: {},
    scenario: {},
  };

  const occupancy = normalizeOccupancy(latestUserMessage);
  if (occupancy !== "other") {
    extracted.scenario!.occupancy =
      occupancy === "primary"
        ? "Primary residence"
        : occupancy === "second"
        ? "Second home"
        : occupancy === "investment"
        ? "Investment property"
        : "Mixed-use";
  }

  const timeline = normalizeTimelineValue(latestUserMessage);
  if (timeline) {
    extracted.scenario!.timeline = timeline;
  }

  const fundsSource = normalizeFundsSourceValue(latestUserMessage);
  if (fundsSource) {
    extracted.scenario!.fundsSource = fundsSource;
  }

  const communicationPreference = detectCommunicationPreferenceValue(latestUserMessage);
  if (communicationPreference) {
    extracted.scenario!.communicationPreference = communicationPreference;
  }

  const transactionType = normalizeTransactionType(latestUserMessage);
  if (
    transactionType &&
    hasAny(lower, [
      "purchase",
      "buy",
      "compra",
      "comprar",
      "refinance",
      "refi",
      "cash-out",
      "cash out",
    ])
  ) {
    extracted.scenario!.transactionType = transactionType;
  }

  const incomeType = normalizeIncomeTypeValue(latestUserMessage);
  if (incomeType) {
    extracted.scenario!.incomeType = incomeType;
    if (incomeType === "Self-Employed" || incomeType === "1099") {
      extracted.scenario!.selfEmployed = "Yes";
    }
  }

  const citizenshipStatus = extractNamedPattern(latestUserMessage, [
    /(?:i am|i'm)\s+a\s+(u\.?s\.?\s+citizen|permanent resident|green card holder|itin borrower|foreign national)/i,
    /(?:sou|soy)\s+(cidad[aã]o americano|residente permanente|titular de green card|foreign national|itin borrower)/i,
  ]);
  if (citizenshipStatus) {
    extracted.scenario!.citizenshipStatus = citizenshipStatus;
  }

  const visaType = extractNamedPattern(latestUserMessage, [
    /(?:visa|status)\s+(h1b|l1|o1|c08|e2|f1|tn|h-1b|l-1|o-1)/i,
    /(?:my visa is|i have an?)\s+(h1b|l1|o1|c08|e2|f1|tn|h-1b|l-1|o-1)/i,
  ]);
  if (visaType) {
    extracted.scenario!.visaType = visaType.toUpperCase();
  }

  const phone = extractNamedPattern(latestUserMessage, [
    /(?:my phone is|best number is|phone number is)\s+([\d\-\+\(\)\s]+)/i,
    /(?:meu telefone é|meu número é)\s+([\d\-\+\(\)\s]+)/i,
  ]);
  if (phone) {
    extracted.borrower!.phone = phone;
  }

  const email = extractNamedPattern(latestUserMessage, [
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]);
  if (email) {
    extracted.borrower!.email = email;
  }

  const name = extractNamedPattern(latestUserMessage, [
    /(?:my name is|i am|i'm)\s+([a-z ,.'-]{3,60})/i,
    /(?:meu nome é|eu sou)\s+([a-z ,.'-]{3,60})/i,
    /(?:mi nombre es|soy)\s+([a-z ,.'-]{3,60})/i,
  ]);
  if (name && !hasAny(name.toLowerCase(), ["ready to apply", "ready to move", "self-employed"])) {
    extracted.borrower!.name = name
      .split(" ")
      .map((part) =>
        part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
      )
      .join(" ");
  }

  const firstTimeBuyer =
    hasAny(lower, [
      "first-time buyer",
      "first time buyer",
      "primeira casa",
      "primeiro imóvel",
      "primer comprador",
    ])
      ? "Yes"
      : hasAny(lower, [
          "not first-time buyer",
          "not a first time buyer",
          "não sou comprador pela primeira vez",
          "no soy comprador por primera vez",
        ])
      ? "No"
      : undefined;
  if (firstTimeBuyer) {
    extracted.scenario!.firstTimeBuyer = firstTimeBuyer;
  }

  const experienceLevel = normalizeExperience(latestUserMessage);
  if (experienceLevel) {
    extracted.scenario!.experienceLevel =
      experienceLevel === "first-time-investor"
        ? "First-time investor"
        : "Experienced investor";
  }

  const unitsMatch = latestUserMessage.match(
    /(?:^|\s)([2-9]|[1-9][0-9]+)\s*(?:units?|unit property|doors?)\b/i
  );
  if (unitsMatch?.[1]) {
    extracted.scenario!.units = unitsMatch[1];
  }

  const dscrMatch = latestUserMessage.match(
    /\bdscr\b[^0-9]{0,10}(\d+(?:\.\d+)?)\b/i
  );
  if (dscrMatch?.[1]) {
    extracted.scenario!.dscr = dscrMatch[1];
  }

  if (
    hasAny(lower, [
      "single-family",
      "single family",
      "single family home",
      "casa unifamiliar",
      "single-family home",
    ])
  ) {
    extracted.scenario!.propertyType = "Single-family";
  } else if (
    hasAny(lower, ["condo", "condominium", "condomínio", "condominio"])
  ) {
    extracted.scenario!.propertyType = "Condo";
  } else if (
    hasAny(lower, [
      "multi-family",
      "multifamily",
      "multifamiliar",
      "apartment building",
    ])
  ) {
    extracted.scenario!.propertyType = "Multi-family";
  } else if (hasAny(lower, ["mixed-use", "mixed use"])) {
    extracted.scenario!.propertyType = "Mixed-use";
  }

  if (hasAny(lower, ["gift funds", "gift", "doação", "regalo"])) {
    extracted.scenario!.giftFunds = "Yes";
  }

  if (hasAny(lower, ["i own", "own other properties", "rental property", "investment property I own"])) {
    extracted.scenario!.reoCount = "Yes";
  }

  return extracted;
}

function mergeRoutingWithExtractedAnswers(
  routing: RoutingPayload | undefined,
  extracted: ExtractedStructuredAnswers
): RoutingPayload | undefined {
  if (!routing) return routing;

  return {
    ...routing,
    borrower: {
      ...(routing.borrower || {}),
      ...(extracted.borrower || {}),
    },
    scenario: {
      ...(routing.scenario || {}),
      ...(extracted.scenario || {}),
    },
  };
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
- Transaction type: ${scenario.transactionType || "Not provided"}
- Estimated home price: ${scenario.homePrice || "Not provided"}
- Estimated down payment: ${scenario.downPayment || "Not provided"}
- Estimated loan amount: ${scenario.estimatedLoanAmount || "Not provided"}
- Estimated LTV: ${scenario.estimatedLtv || "Not provided"}
- Occupancy: ${scenario.occupancy || "Not provided"}
- Timeline: ${scenario.timeline || "Not provided"}
- Funds source: ${scenario.fundsSource || "Not provided"}
- Communication preference: ${scenario.communicationPreference || "Not provided"}
- Income type: ${scenario.incomeType || "Not provided"}
- Property type: ${scenario.propertyType || "Not provided"}
- Units: ${scenario.units || "Not provided"}
- DSCR: ${scenario.dscr || "Not provided"}
- First-time buyer: ${scenario.firstTimeBuyer || "Not provided"}
- Experience level: ${scenario.experienceLevel || "Not provided"}
- Citizenship status: ${scenario.citizenshipStatus || "Not provided"}
- Visa type: ${scenario.visaType || "Not provided"}

Conversation transcript so far:
${transcript || "No prior transcript yet."}
  `.trim();
}

function analyzeAnsweredState(routing?: RoutingPayload): AnswerState {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const convo = conversationToText(routing?.conversation).toLowerCase();

  const occupancyAnsweredFromConversation = hasAny(convo, [
    "primary residence",
    "primary home",
    "owner occupied",
    "owner-occupied",
    "second home",
    "vacation home",
    "investment property",
    "investment",
    "moradia principal",
    "residência principal",
    "segunda casa",
    "investimento",
    "vivienda principal",
    "segunda vivienda",
    "propiedad de inversión",
    "inversión",
  ]);

  const timelineAnsweredFromConversation = hasAny(convo, [
    "as soon as possible",
    "30 days",
    "60 days",
    "90 days",
    "this month",
    "next month",
    "in a few months",
    "within 3 months",
    "next 3 months",
    "o quanto antes",
    "o mais rápido possível",
    "30 dias",
    "60 dias",
    "90 dias",
    "este mês",
    "próximo mês",
    "3 meses",
    "lo antes posible",
    "este mes",
    "próximo mes",
    "30 a 60 días",
    "30 to 60 days",
  ]);

  const fundsSourceAnsweredFromConversation = hasAny(convo, [
    "savings",
    "saved",
    "gift funds",
    "gift",
    "sale of another property",
    "sale of home",
    "retirement account",
    "bank account",
    "savings account",
    "economias",
    "poupança",
    "doação",
    "venda de imóvel",
    "ahorros",
    "regalo",
    "venta de propiedad",
  ]);

  const propertyIntentAnsweredFromConversation = occupancyAnsweredFromConversation;
  const communicationPreferenceAnsweredFromConversation = !!detectCommunicationPreferenceValue(convo);
  const incomeTypeAnsweredFromConversation = !!normalizeIncomeTypeValue(convo);
  const transactionTypeAnsweredFromConversation = !!normalizeTransactionType(convo);

  return {
    hasName: hasValue(borrower.name),
    hasEmail: hasValue(borrower.email),
    hasCredit: hasValue(borrower.credit),
    hasIncome: hasValue(borrower.income),
    hasDebt: hasValue(borrower.debt),
    hasHomePrice: hasValue(scenario.homePrice),
    hasDownPayment: hasValue(scenario.downPayment),
    hasLoanAmount: hasValue(scenario.estimatedLoanAmount),
    hasLtv: hasValue(scenario.estimatedLtv),
    hasOccupancy:
      hasValue(scenario.occupancy) || occupancyAnsweredFromConversation,
    hasTimeline:
      hasValue(scenario.timeline) || timelineAnsweredFromConversation,
    hasFundsSource:
      hasValue(scenario.fundsSource) || fundsSourceAnsweredFromConversation,
    hasPropertyTypeIntent: propertyIntentAnsweredFromConversation,
    hasCommunicationPreference:
      hasValue(scenario.communicationPreference) ||
      communicationPreferenceAnsweredFromConversation,
    hasIncomeType:
      hasValue(scenario.incomeType) || incomeTypeAnsweredFromConversation,
    hasTransactionType:
      hasValue(scenario.transactionType) || transactionTypeAnsweredFromConversation,
  };
}

function getNextUsefulQuestion(
  language: LanguageCode,
  routing?: RoutingPayload
): string | null {
  const state = analyzeAnsweredState(routing);

  if (!state.hasPropertyTypeIntent || !state.hasOccupancy) {
    if (language === "pt") {
      return "Esta compra seria para moradia principal, segunda casa ou imóvel de investimento?";
    }
    if (language === "es") {
      return "¿Esta compra sería para vivienda principal, segunda vivienda o propiedad de inversión?";
    }
    return "Would this purchase be for a primary residence, a second home, or an investment property?";
  }

  if (!state.hasTimeline) {
    if (language === "pt") {
      return "Qual é o seu prazo ideal para comprar ou entrar em contrato: o quanto antes, nos próximos 30 a 60 dias, ou mais adiante?";
    }
    if (language === "es") {
      return "¿Cuál es su plazo ideal para comprar o entrar en contrato: lo antes posible, dentro de los próximos 30 a 60 días, o más adelante?";
    }
    return "What is your ideal timeline to buy or go under contract: as soon as possible, within the next 30 to 60 days, or later on?";
  }

  if (!state.hasFundsSource) {
    if (language === "pt") {
      return "Os fundos para entrada e fechamento virão principalmente de economias, gift funds, venda de outro imóvel ou outra fonte?";
    }
    if (language === "es") {
      return "¿Los fondos para el pago inicial y el cierre provendrán principalmente de ahorros, gift funds, venta de otra propiedad u otra fuente?";
    }
    return "Will your down payment and closing funds come mainly from savings, gift funds, the sale of another property, or another source?";
  }

  if (!state.hasIncomeType) {
    if (language === "pt") {
      return "Sua renda principal hoje vem de salário W-2, trabalho autônomo, 1099, comissão, aluguel ou outra fonte?";
    }
    if (language === "es") {
      return "¿Su ingreso principal proviene hoy de salario W-2, trabajo independiente, 1099, comisión, renta u otra fuente?";
    }
    return "Does your primary income currently come from W-2 employment, self-employment, 1099 work, commission, rental income, or another source?";
  }

  if (!state.hasCommunicationPreference) {
    if (language === "pt") {
      return "Qual é a melhor forma de contato para atualizações, email, ligação ou mensagem de texto?";
    }
    if (language === "es") {
      return "¿Cuál es la mejor forma de contacto para actualizaciones, correo, llamada o mensaje de texto?";
    }
    return "What is the best way for your loan officer to keep you updated: email, phone call, or text message?";
  }

  return null;
}

function buildInitialFallback(language: LanguageCode, routing?: RoutingPayload): string {
  const nextQuestion = getNextUsefulQuestion(language, routing);

  if (language === "pt") {
    return `Obrigado por compartilhar estas informações iniciais.

Vou organizar este cenário para o loan officer designado, que fará a análise pessoal e orientará os próximos passos.

Para adiantar o processo, recomendo também clicar em Aplicar Agora.${
      nextQuestion ? `

${nextQuestion}` : ""
    }`;
  }

  if (language === "es") {
    return `Gracias por compartir esta información inicial.

Voy a organizar este escenario para el loan officer asignado, quien realizará la revisión personal y le orientará sobre los próximos pasos.

Para adelantar el proceso, también le recomiendo hacer clic en Aplicar Ahora.${
      nextQuestion ? `

${nextQuestion}` : ""
    }`;
  }

  return `Thank you for sharing this initial information.

I will organize this scenario for the assigned loan officer, who will review it personally and advise the next steps.

To help move things forward, I also recommend clicking Apply Now.${
    nextQuestion ? `

${nextQuestion}` : ""
  }`;
}

function buildScenarioFallback(language: LanguageCode, routing?: RoutingPayload): string {
  const nextQuestion = getNextUsefulQuestion(language, routing);

  if (language === "pt") {
    return `Perfect.

Agora tenho um cenário de compra mais claro para enviar ao loan officer designado.

Estas informações serão analisadas pessoalmente, e você receberá orientação sobre os próximos passos.

Também recomendo clicar em Aplicar Agora para adiantar o processo.${
      nextQuestion ? `

${nextQuestion}` : ""
    }`;
  }

  if (language === "es") {
    return `Perfecto.

Ahora tengo un escenario de compra más claro para enviar al loan officer asignado.

Esta información será revisada personalmente, y usted recibirá orientación sobre los próximos pasos.

También le recomiendo hacer clic en Aplicar Ahora para avanzar el proceso.${
      nextQuestion ? `

${nextQuestion}` : ""
    }`;
  }

  return `Perfect.

I now have a clearer purchase scenario to send to the assigned loan officer.

This information will be reviewed personally, and you will be guided on the next steps.

I also recommend clicking Apply Now to help move the process forward.${
    nextQuestion ? `

${nextQuestion}` : ""
  }`;
}

function buildClosingFallback(
  language: LanguageCode,
  officerName: string,
  routing?: RoutingPayload
): string {
  const preference = routing?.scenario?.communicationPreference || "";
  const lower = preference.toLowerCase();

  if (language === "pt") {
    if (lower.includes("text") && lower.includes("phone")) {
      return `Perfeito.

Registrei sua preferência por mensagem de texto e ligação.

Clique em "Aplicar Agora" para começar oficialmente. Seu loan officer, ${officerName}, fará o acompanhamento com os próximos passos.`;
    }

    if (lower.includes("text")) {
      return `Perfeito.

Registrei sua preferência por mensagem de texto.

Clique em "Aplicar Agora" para começar oficialmente. Seu loan officer, ${officerName}, fará o acompanhamento com os próximos passos.`;
    }

    if (lower.includes("phone")) {
      return `Perfeito.

Registrei sua preferência por ligação.

Clique em "Aplicar Agora" para começar oficialmente. Seu loan officer, ${officerName}, fará o acompanhamento com os próximos passos.`;
    }

    if (lower.includes("email")) {
      return `Perfeito.

Registrei sua preferência por email.

Clique em "Aplicar Agora" para começar oficialmente. Seu loan officer, ${officerName}, fará o acompanhamento com os próximos passos.`;
    }

    return `Perfeito.

Você está pronto para avançar.

Clique em "Aplicar Agora" para começar oficialmente. Seu loan officer, ${officerName}, fará o acompanhamento com os próximos passos.`;
  }

  if (language === "es") {
    if (lower.includes("text") && lower.includes("phone")) {
      return `Perfecto.

He registrado su preferencia por mensajes de texto y llamadas.

Haga clic en "Aplicar Ahora" para comenzar oficialmente. Su loan officer, ${officerName}, le dará seguimiento con los próximos pasos.`;
    }

    if (lower.includes("text")) {
      return `Perfecto.

He registrado su preferencia por mensajes de texto.

Haga clic en "Aplicar Ahora" para comenzar oficialmente. Su loan officer, ${officerName}, le dará seguimiento con los próximos pasos.`;
    }

    if (lower.includes("phone")) {
      return `Perfecto.

He registrado su preferencia por llamadas.

Haga clic en "Aplicar Ahora" para comenzar oficialmente. Su loan officer, ${officerName}, le dará seguimiento con los próximos pasos.`;
    }

    if (lower.includes("email")) {
      return `Perfecto.

He registrado su preferencia por correo electrónico.

Haga clic en "Aplicar Ahora" para comenzar oficialmente. Su loan officer, ${officerName}, le dará seguimiento con los próximos pasos.`;
    }

    return `Perfecto.

Ya está listo para avanzar.

Haga clic en "Aplicar Ahora" para comenzar oficialmente. Su loan officer, ${officerName}, le dará seguimiento con los próximos pasos.`;
  }

  if (lower.includes("text") && lower.includes("phone")) {
    return `Perfect.

I’ve noted your preference for text updates and a phone call.

Click "Apply Now" to begin officially. Your loan officer, ${officerName}, will follow up with the next steps.`;
  }

  if (lower.includes("text")) {
    return `Perfect.

I’ve noted your preference for text updates.

Click "Apply Now" to begin officially. Your loan officer, ${officerName}, will follow up with the next steps.`;
  }

  if (lower.includes("phone")) {
    return `Perfect.

I’ve noted your preference for a phone call.

Click "Apply Now" to begin officially. Your loan officer, ${officerName}, will follow up with the next steps.`;
  }

  if (lower.includes("email")) {
    return `Perfect.

I’ve noted your preference for email updates.

Click "Apply Now" to begin officially. Your loan officer, ${officerName}, will follow up with the next steps.`;
  }

  return `Perfect.

You’re ready to move forward.

Click "Apply Now" to begin officially. Your loan officer, ${officerName}, will follow up with the next steps.`;
}

function buildFollowUpFallback(language: LanguageCode, routing?: RoutingPayload): string {
  const nextQuestion = getNextUsefulQuestion(language, routing);

  if (language === "pt") {
    return `Obrigado. Isso já ajuda bastante.

Vou registrar isso para que o loan officer designado tenha um quadro mais claro do seu cenário.

Também recomendo clicar em Aplicar Agora para adiantar o processo.${
      nextQuestion ? `

${nextQuestion}` : ""
    }`;
  }

  if (language === "es") {
    return `Gracias. Eso ayuda bastante.

Voy a registrar eso para que el loan officer asignado tenga un panorama más claro de su escenario.

También le recomiendo hacer clic en Aplicar Ahora para avanzar el proceso.${
      nextQuestion ? `

${nextQuestion}` : ""
    }`;
  }

  return `Thank you. That helps a lot.

I will note that so the assigned loan officer has a clearer picture of your scenario.

I also recommend clicking Apply Now to help move things forward.${
    nextQuestion ? `

${nextQuestion}` : ""
  }`;
}

function buildProgramSuggestions(routing?: RoutingPayload): InternalProgramMatch[] {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};

  const creditScore = Number(borrower.credit || 0);
  const homePrice = Number(scenario.homePrice || 0);
  const downPayment = Number(scenario.downPayment || 0);
  const estimatedLtvString = scenario.estimatedLtv || "";
  const estimatedLtvNumber = Number(
    estimatedLtvString.toString().replace("%", "").trim() || 0
  );

  const ltv =
    homePrice > 0 && downPayment >= 0
      ? ((homePrice - downPayment) / homePrice) * 100
      : estimatedLtvNumber;

  const dti =
    borrower.income && borrower.debt && Number(borrower.income) > 0
      ? (Number(borrower.debt) / Number(borrower.income)) * 100
      : undefined;

  const occupancy = normalizeOccupancy(scenario.occupancy);
  const firstTimeBuyer =
    hasAny((scenario.firstTimeBuyer || "").toLowerCase(), [
      "yes",
      "true",
      "sim",
      "sí",
      "si",
    ]) || false;

  const units = Number(scenario.units || 0) || undefined;
  const dscr = Number(scenario.dscr || 0) || undefined;
  const experienceLevel = normalizeExperience(scenario.experienceLevel);

  const isMultifamily =
    (units !== undefined && units >= 5) ||
    hasAny((scenario.propertyType || "").toLowerCase(), [
      "multi-family",
      "multifamily",
      "multifamiliar",
      "5+ unit",
      "apartment",
    ]);

  const suggestions: InternalProgramMatch[] = [];

  if (!isMultifamily) {
    const sfOccupancy =
      occupancy === "primary" || occupancy === "second" || occupancy === "investment"
        ? occupancy
        : "primary";

    const fannie = evaluateFannieMaeSingleFamily({
      creditScore,
      ltv,
      dti,
      occupancy: sfOccupancy,
      firstTimeBuyer,
    });

    const freddie = evaluateFreddieMacSingleFamily({
      creditScore,
      ltv,
      dti,
      occupancy: sfOccupancy,
      firstTimeBuyer,
    });

    fannie
      .filter((item) => item.eligible)
      .forEach((item) => {
        suggestions.push({
          program: item.program,
          strength: item.strength,
          source: "Fannie Mae Single-Family",
          notes: item.notes,
        });
      });

    freddie
      .filter((item) => item.eligible)
      .forEach((item) => {
        suggestions.push({
          program: item.program,
          strength: item.strength,
          source: "Freddie Mac Single-Family",
          notes: item.notes,
        });
      });
  } else {
    const mfOccupancy =
      occupancy === "mixed-use"
        ? "mixed-use"
        : occupancy === "other"
        ? "investment"
        : "investment";

    const fannie = evaluateFannieMaeMultifamily({
      creditScore: creditScore || undefined,
      ltv,
      dscr,
      occupancy: mfOccupancy,
      units,
      experienceLevel,
    });

    const freddie = evaluateFreddieMacMultifamily({
      creditScore: creditScore || undefined,
      ltv,
      dscr,
      occupancy: mfOccupancy,
      units,
      experienceLevel,
    });

    fannie
      .filter((item) => item.eligible)
      .forEach((item) => {
        suggestions.push({
          program: item.program,
          strength: item.strength,
          source: "Fannie Mae Multi-Family",
          notes: item.notes,
        });
      });

    freddie
      .filter((item) => item.eligible)
      .forEach((item) => {
        suggestions.push({
          program: item.program,
          strength: item.strength,
          source: "Freddie Mac Multi-Family",
          notes: item.notes,
        });
      });
  }

  const rank = { strong: 3, moderate: 2, weak: 1 };

  return suggestions
    .sort((a, b) => rank[b.strength] - rank[a.strength])
    .slice(0, 4);
}

function computeRiskFlags(routing?: RoutingPayload): string[] {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};

  const flags: string[] = [];
  const credit = Number(borrower.credit || 0);
  const income = Number(borrower.income || 0);
  const debt = Number(borrower.debt || 0);
  const homePrice = Number(scenario.homePrice || 0);
  const down = Number(scenario.downPayment || 0);
  const ltv =
    homePrice > 0 && down >= 0
      ? ((homePrice - down) / homePrice) * 100
      : Number((scenario.estimatedLtv || "").replace("%", "") || 0);

  if (!scenario.occupancy) flags.push("Occupancy not yet confirmed.");
  if (!scenario.timeline) flags.push("Timeline not yet fully confirmed.");
  if (!scenario.fundsSource) flags.push("Funds source not yet fully confirmed.");
  if (credit > 0 && credit < 680) flags.push("Credit profile may require closer agency review.");
  if (ltv > 95) flags.push("High LTV may increase risk layering and MI impact.");
  if (income > 0 && debt > 0 && debt / income > 0.45) {
    flags.push("DTI may be elevated based on current income and debt entered.");
  }
  if (scenario.giftFunds === "Yes") flags.push("Gift funds will require documentation.");
  if (scenario.visaType) flags.push("Visa / lawful presence documentation review required.");
  if (scenario.selfEmployed === "Yes") flags.push("Self-employed income analysis may require deeper documentation.");

  return flags;
}

function computeMissingItems(routing?: RoutingPayload): string[] {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const missing: string[] = [];

  if (!borrower.phone) missing.push("Best contact phone number");
  if (!scenario.occupancy) missing.push("Occupancy type");
  if (!scenario.timeline) missing.push("Purchase timeline");
  if (!scenario.fundsSource) missing.push("Funds source");
  if (!scenario.communicationPreference) missing.push("Preferred communication method");
  if (!scenario.incomeType) missing.push("Income type classification");

  return missing;
}

function buildSuggestedDocuments(routing?: RoutingPayload): string[] {
  const scenario = routing?.scenario || {};
  const docs: string[] = [
    "Government-issued photo ID",
    "Most recent 2 months of bank statements",
  ];

  const incomeType = (scenario.incomeType || "").toLowerCase();
  const isSelfEmployed =
    scenario.selfEmployed === "Yes" ||
    hasAny(incomeType, ["self-employed", "1099"]);

  if (isSelfEmployed) {
    docs.push("Last 2 years personal tax returns");
    docs.push("Last 2 years business tax returns if applicable");
    docs.push("Year-to-date profit and loss statement");
  } else {
    docs.push("Most recent 30 days of pay stubs");
    docs.push("Last 2 years W-2s");
  }

  if (scenario.fundsSource === "Gift funds") {
    docs.push("Gift letter");
  }

  if (scenario.visaType || scenario.citizenshipStatus) {
    docs.push("Passport / visa / lawful presence documents if applicable");
  }

  if (scenario.units && Number(scenario.units) >= 2) {
    docs.push("Lease agreements if rental units are occupied");
  }

  return [...new Set(docs)];
}

function computeBorrowerReadiness(routing?: RoutingPayload): string {
  const missing = computeMissingItems(routing);
  const riskFlags = computeRiskFlags(routing);

  if (missing.length === 0 && riskFlags.length <= 2) {
    return "Near pre-approval ready";
  }

  if (missing.length <= 2) {
    return "Partially documented / progressing well";
  }

  return "Initial to intermediate intake stage";
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
        temperature: 0.25,
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
  const nextQuestion = getNextUsefulQuestion(language, routing);
  const answeredState = analyzeAnsweredState(routing);

  const system = `
You are Finley Beyond, an AI-powered mortgage advisor assistant for Beyond Financing.

Your job:
- speak naturally and professionally
- gather mortgage qualification information
- keep the conversation warm, polished, and human
- sound like a skilled loan officer assistant, not a bot
- ask only one useful next question at a time
- do not ask for information already answered
- acknowledge borrower answers in a way that sounds mortgage-specific and helpful
- when possible, translate answers into practical mortgage relevance

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
- when closing, be brief and decisive
- do not reopen the conversation after a clear closing intent
- do not add repetitive filler like "looking forward to assisting you further"
- if the borrower answered something useful like savings, timeline, W-2, self-employed, primary residence, etc., briefly acknowledge why it matters in mortgage context

Language rule:
- respond only in ${
    language === "pt" ? "Portuguese" : language === "es" ? "Spanish" : "English"
  }
  `.trim();

  const stageInstruction = closingIntent
    ? `
The borrower has expressed clear intent to move forward.
Do not ask another qualifying question.
Close the conversation naturally and briefly.
Direct the borrower to Apply Now.
Acknowledge that the assigned loan officer will follow up.
If communication preference was already provided, acknowledge it briefly and close.
`
    : stage === "initial_review"
    ? `
The borrower has just completed the first intake.
Acknowledge the information.
Mention that the assigned loan officer will review it personally.
Ask only one useful next question, and only if it has not already been answered.
Do not ask about lender or bank preference.
`
    : stage === "scenario_review"
    ? `
The borrower has added a property scenario.
Acknowledge it naturally.
Mention that the assigned loan officer will review it personally.
If helpful, briefly mention broad possible direction without promising anything.
Ask only one useful next question, and only if it has not already been answered.
Do not ask about lender or bank preference.
`
    : `
Continue the borrower-facing mortgage conversation naturally.
Answer the borrower clearly and humanly.
Do not ask about lender or bank preference.
If the borrower signals readiness to move forward, stop asking questions and close naturally to CTA.
Otherwise, ask only one useful next question, and only if it has not already been answered.
`;

  const user = `
${buildContextBlock(language, routing, assignedOfficer)}

Current stage: ${stage}
Assigned loan officer name: ${assignedOfficer.name}
Borrower expressed closing intent: ${closingIntent ? "yes" : "no"}

Answered state:
- hasPropertyTypeIntent: ${answeredState.hasPropertyTypeIntent ? "yes" : "no"}
- hasOccupancy: ${answeredState.hasOccupancy ? "yes" : "no"}
- hasTimeline: ${answeredState.hasTimeline ? "yes" : "no"}
- hasFundsSource: ${answeredState.hasFundsSource ? "yes" : "no"}
- hasCommunicationPreference: ${answeredState.hasCommunicationPreference ? "yes" : "no"}
- hasIncomeType: ${answeredState.hasIncomeType ? "yes" : "no"}

Preferred next useful question if needed:
${nextQuestion || "No additional question is needed right now."}

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
      reply: buildClosingFallback(language, assignedOfficer.name, routing),
      shouldClose: true,
    };
  }

  if (stage === "initial_review") {
    return { reply: buildInitialFallback(language, routing), shouldClose: false };
  }

  if (stage === "scenario_review") {
    return { reply: buildScenarioFallback(language, routing), shouldClose: false };
  }

  return { reply: buildFollowUpFallback(language, routing), shouldClose: false };
}

function buildFallbackSummary(
  stage: string,
  assignedOfficer: LoanOfficerRecord,
  routing?: RoutingPayload
): SummaryPayload {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const transcript = conversationToText(routing?.conversation);
  const programMatches = buildProgramSuggestions(routing);

  const strengths: string[] = [];

  if (borrower.credit) {
    const score = Number(borrower.credit);
    if (score >= 720) strengths.push(`Strong credit profile (${score}).`);
    else strengths.push(`Credit score provided: ${score}.`);
  }

  if (borrower.income) {
    strengths.push(`Verified income level (${borrower.income} monthly).`);
  }

  if (scenario.homePrice && scenario.downPayment) {
    strengths.push(
      `Defined purchase scenario (${scenario.homePrice} price / ${scenario.downPayment} down).`
    );
  }

  if (scenario.timeline) {
    strengths.push(`Timeline identified (${scenario.timeline}).`);
  }

  if (scenario.fundsSource) {
    strengths.push(`Funds source identified (${scenario.fundsSource}).`);
  }

  const provisionalPrograms =
    programMatches.length > 0
      ? programMatches.map(
          (item) =>
            `${item.program} — ${item.strength.toUpperCase()} alignment (${item.source})`
        )
      : ["Initial agency review recommended"];

  return {
    borrowerSummary:
      transcript ||
      "Borrower completed initial intake and is actively moving forward with financing.",
    likelyDirection:
      programMatches.length > 0
        ? "Borrower scenario appears to align with one or more agency directions and should be prioritized for immediate licensed loan officer review."
        : "Borrower demonstrates strong forward intent and should be prioritized for immediate loan officer engagement.",
    strengths:
      strengths.length > 0
        ? strengths
        : ["Borrower engaged and ready to proceed with financing."],
    openQuestions: computeMissingItems(routing),
    provisionalPrograms,
    recommendedNextStep:
      "Borrower is ready to apply. Immediate follow-up is recommended to secure the application, confirm documentation strategy, and select final program direction.",
    loanOfficerActionPlan: [
      "Contact borrower immediately based on stated forward intent and timeline.",
      "Guide borrower through full application submission.",
      "Confirm missing structured items and documentation strategy.",
      "Review top provisional program matches and select best execution path.",
    ],
    riskFlags: computeRiskFlags(routing),
    missingItems: computeMissingItems(routing),
    borrowerReadiness: computeBorrowerReadiness(routing),
    suggestedDocuments: buildSuggestedDocuments(routing),
  };
}

async function generateInternalSummary(args: {
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
}): Promise<SummaryPayload> {
  const { stage, assignedOfficer, routing } = args;
  const fallback = buildFallbackSummary(stage, assignedOfficer, routing);
  const programMatches = buildProgramSuggestions(routing);

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
  "loanOfficerActionPlan": ["string"],
  "riskFlags": ["string"],
  "missingItems": ["string"],
  "borrowerReadiness": "string",
  "suggestedDocuments": ["string"]
}

Rules:
- write for an internal licensed mortgage loan officer
- be practical and concise
- use only the borrower data, transcript, and provisional program intelligence provided
- do not promise approval
- provisional programs should be directional only
- if the borrower is clearly ready to apply or move forward, do not create unnecessary open questions
- make the likelyDirection stronger and more useful for the loan officer
- prefer urgent follow-up language when borrower intent is high
- if an item was already answered in the structured context, do not list it as missing
  `.trim();

  const user = `
Assigned loan officer:
- Name: ${assignedOfficer.name}
- NMLS: ${assignedOfficer.nmls}

Stage:
${stage}

${buildContextBlock(getLanguage(routing), routing, assignedOfficer)}

Provisional program intelligence:
${
  programMatches.length > 0
    ? programMatches
        .map(
          (item) =>
            `- ${item.program} | strength: ${item.strength} | source: ${item.source} | notes: ${item.notes.join(
              "; "
            )}`
        )
        .join("\n")
    : "No provisional agency matches generated."
}
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
      Array.isArray(aiSummary.openQuestions)
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
    riskFlags:
      Array.isArray(aiSummary.riskFlags) && aiSummary.riskFlags.length > 0
        ? aiSummary.riskFlags
        : fallback.riskFlags,
    missingItems:
      Array.isArray(aiSummary.missingItems)
        ? aiSummary.missingItems
        : fallback.missingItems,
    borrowerReadiness:
      aiSummary.borrowerReadiness || fallback.borrowerReadiness,
    suggestedDocuments:
      Array.isArray(aiSummary.suggestedDocuments) &&
      aiSummary.suggestedDocuments.length > 0
        ? aiSummary.suggestedDocuments
        : fallback.suggestedDocuments,
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
  const programMatches = buildProgramSuggestions(routing);

  const isReadyToApply =
    stage === "follow_up" &&
    (
      summary.recommendedNextStep.toLowerCase().includes("ready to apply") ||
      summary.recommendedNextStep.toLowerCase().includes("immediate follow-up") ||
      summary.likelyDirection.toLowerCase().includes("immediate") ||
      summary.likelyDirection.toLowerCase().includes("ready")
    );

  const recommendedProgramDirectionHtml =
    programMatches.length > 0
      ? `
      <h3 style="margin:18px 0 8px 0;">Recommended Program Direction</h3>
      <ul style="line-height:1.8;">
        ${programMatches
          .map(
            (item) =>
              `<li><strong>${escapeHtml(item.program)}</strong> — ${escapeHtml(
                item.strength.toUpperCase()
              )} alignment (${escapeHtml(item.source)})<br /><span style="color:#475569;">${escapeHtml(
                item.notes.join(" | ")
              )}</span></li>`
          )
          .join("")}
      </ul>
      `
      : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:900px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px 0;color:#263366;">Conversation Summary - Finley Beyond</h1>

      ${
        isReadyToApply
          ? `
      <div style="margin-bottom:16px;padding:12px;border-radius:10px;background:#E6F4EA;border:1px solid #B7E1CD;color:#1E7F4F;font-weight:700;">
        Status: Borrower Ready to Apply - Immediate Follow-Up Recommended
      </div>
      `
          : ""
      }

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
        <p><strong>Transaction Type:</strong> ${escapeHtml(
          scenario.transactionType || "Not provided"
        )}</p>
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
        <p><strong>Communication Preference:</strong> ${escapeHtml(
          scenario.communicationPreference || "Not provided"
        )}</p>
        <p><strong>Income Type:</strong> ${escapeHtml(
          scenario.incomeType || "Not provided"
        )}</p>
        <p><strong>Property Type:</strong> ${escapeHtml(
          scenario.propertyType || "Not provided"
        )}</p>
        <p><strong>First-Time Buyer:</strong> ${escapeHtml(
          scenario.firstTimeBuyer || "Not provided"
        )}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d9e1ec;border-radius:16px;padding:18px;margin-bottom:18px;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">Borrower Summary</h2>
        <p style="line-height:1.7;">${nl2br(summary.borrowerSummary)}</p>

        <h3 style="margin:18px 0 8px 0;">Likely Direction</h3>
        <p style="line-height:1.7;">${nl2br(summary.likelyDirection)}</p>

        ${recommendedProgramDirectionHtml}

        <h3 style="margin:18px 0 8px 0;">Borrower Readiness</h3>
        <p style="line-height:1.7;">${escapeHtml(summary.borrowerReadiness)}</p>

        <h3 style="margin:18px 0 8px 0;">Strengths</h3>
        <ul style="line-height:1.8;">
          ${summary.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>

        ${
          summary.riskFlags && summary.riskFlags.length > 0
            ? `
        <h3 style="margin:18px 0 8px 0;">Risk Flags</h3>
        <ul style="line-height:1.8;">
          ${summary.riskFlags.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        `
            : ""
        }

        ${
          summary.missingItems && summary.missingItems.length > 0
            ? `
        <h3 style="margin:18px 0 8px 0;">Missing Items</h3>
        <ul style="line-height:1.8;">
          ${summary.missingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        `
            : ""
        }

        ${
          summary.suggestedDocuments && summary.suggestedDocuments.length > 0
            ? `
        <h3 style="margin:18px 0 8px 0;">Suggested Document Request</h3>
        <ul style="line-height:1.8;">
          ${summary.suggestedDocuments
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}
        </ul>
        `
            : ""
        }

        ${
          summary.openQuestions && summary.openQuestions.length > 0
            ? `
        <h3 style="margin:18px 0 8px 0;">Open Questions</h3>
        <ul style="line-height:1.8;">
          ${summary.openQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        `
            : ""
        }

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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const messages = body?.messages;
    const incomingRouting = body?.routing;
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

    const extractedAnswers = extractStructuredAnswers(
      latestUserMessage,
      incomingRouting
    );

    const routing = mergeRoutingWithExtractedAnswers(
      incomingRouting,
      extractedAnswers
    );

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
        ? [
            ...routing.conversation,
            { role: "assistant", content: borrowerReply.reply },
          ]
        : [{ role: "assistant", content: borrowerReply.reply }];

    const finalRouting: RoutingPayload | undefined = routing
      ? {
          ...routing,
          conversation: updatedConversation,
        }
      : undefined;

    let internalSummaryPrepared = false;

    if (borrowerReply.shouldClose) {
      const summary = await generateInternalSummary({
        stage,
        assignedOfficer,
        routing: finalRouting,
      });

      await queueInternalNotifications({
        stage,
        assignedOfficer,
        routing: finalRouting,
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
      routing: finalRouting,
      extractedAnswers,
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
