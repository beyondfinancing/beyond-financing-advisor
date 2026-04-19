"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type LanguageCode = "en" | "pt" | "es";
type LoanPurpose = "Purchase" | "Refinance" | "Investment";
type SummaryTrigger = "ai" | "apply" | "schedule" | "contact";

type IntakeFormState = {
  name: string;
  email: string;
  phone: string;
  credit: string;
  income: string;
  debt: string;
  currentState: string;
  targetState: string;
  realtorStatus: "yes" | "no" | "not-sure";
  realtorName: string;
  realtorPhone: string;
};

type ScenarioFormState = {
  homePrice: string;
  downPayment: string;
  occupancy: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type LoanOfficerRecord = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  mobile?: string;
  assistantMobile?: string;
  applyUrl: string;
  scheduleUrl: string;
  companyName: string;
};

type MatchBucket = {
  lender_name: string;
  lender_id: string;
  program_name: string;
  program_slug: string;
  loan_category: string | null;
  guideline_id: string;
  notes: string[];
  missing_items: string[];
  blockers: string[];
  strengths: string[];
  concerns: string[];
  explanation: string;
  score: number;
};

type MatchResponse = {
  success: boolean;
  intake?: {
    borrower_status?: string;
    occupancy_type?: string;
    transaction_type?: string;
    income_type?: string;
    property_type?: string;
    credit_score?: number | null;
    ltv?: number | null;
    dti?: number | null;
    loan_amount?: number | null;
    units?: number | null;
    first_time_homebuyer?: boolean | null;
    subject_state?: string;
    available_reserves_months?: number | null;
  };
  summary?: {
    total_guidelines_checked?: number;
    strong_count?: number;
    conditional_count?: number;
    eliminated_count?: number;
  };
  lender_summary?: {
    active_lender_count?: number;
    active_lenders_checked?: string[];
    matched_lenders_in_results?: string[];
  };
  next_question?: string;
  top_recommendation?: string;
  openai_enhancement?: {
    topRecommendation?: string;
    whyItMatches?: string[];
    cautionItems?: string[];
    nextBestQuestion?: string;
  } | null;
  strong_matches?: MatchBucket[];
  conditional_matches?: MatchBucket[];
  eliminated_paths?: MatchBucket[];
  error?: string;
};

type RoutingPayload = {
  language?: LanguageCode;
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
    subjectState?: string;
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

type SummaryResponse = {
  success: boolean;
  error?: string;
  sentTo?: string;
};

const APPLY_NOW_URL = "https://www.beyondfinancing.com/apply-now";
const SUMMARY_API_PATH = "/api/chat-summary";

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://calendly.com/sandropansini",
    companyName: "Beyond Financing, Inc.",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
    companyName: "Beyond Financing, Inc.",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
    companyName: "Beyond Financing, Inc.",
  },
];

const DEFAULT_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

const COPY = {
  en: {
    title: "Borrower / Client Workspace",
    subtitle:
      "Start your guided mortgage conversation with Finley Beyond.",
    disclaimerTitle: "Required Disclaimer",
    disclaimer:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, title, appraisal, and current investor or agency guidelines.",
    accept: "I acknowledge and accept this disclaimer.",
    backHome: "Back to Beyond Intelligence",
    language: "Language",
    borrowerName: "Borrower Name",
    email: "Email",
    phone: "Phone Number",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt",
    currentState: "State You Live In Now",
    targetState: "State You Are Looking to Move Into",
    realtorQuestion: "Are you working with a Realtor?",
    realtorName: "Realtor Name",
    realtorPhone: "Realtor Phone Number",
    loanOfficerPlaceholder: "Type loan officer name or NMLS #",
    confirmOfficer: "Confirm Loan Officer",
    unknownOfficer: "I Do Not Know My Loan Officer",
    assigned: "Assigned Routing",
    review: "Run Preliminary Review",
    reviewing: "Reviewing...",
    scenarioTitle: "Property Scenario",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    continueScenario: "Continue with This Scenario",
    updatingScenario: "Updating Scenario...",
    conversation: "Conversation with Finley Beyond",
    send: "Send Message",
    sending: "Sending...",
    applyNow: "Apply Now",
    schedule: "Schedule with Loan Officer",
    emailOfficer: "Email Loan Officer",
    callOfficer: "Call Loan Officer",
    nextActions: "Next Actions",
    internalReviewTitle: "Internal Scenario Direction",
    internalReviewText:
      "This section reflects Finley Beyond’s internal matching direction and is used to guide the conversation and routing.",
    likelyDirection: "Likely Direction",
    lenderCoverage: "Lender/Broker Coverage",
    nextQuestion: "Next Best Question",
    chatPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
    reviewError: "There was a problem running the preliminary review.",
    matchError: "There was a problem evaluating the scenario.",
    matchPending:
      "Run the preliminary review to generate internal match direction.",
    officerConfirmed: "Loan officer confirmed.",
    officerFallback: "No match found. Default routing assigned to Finley Beyond.",
    officerTypeHint:
      "Start typing to see matching loan officers.",
    estimatedLoanAmount: "Estimated Loan Amount",
    estimatedLtv: "Estimated LTV",
    purpose: "Purpose",
    notProvided: "Not provided",
    yes: "Yes",
    no: "No",
    notSure: "Not Sure",
    summarySent: "Internal summary sent successfully to:",
    summaryFailed:
      "The conversation worked, but the internal summary email did not send.",
    actionContinuing:
      "The action is continuing, but the internal email summary did not send.",
  },
  pt: {
    title: "Área do Cliente / Borrower",
    subtitle:
      "Inicie sua conversa guiada sobre mortgage com Finley Beyond.",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimer:
      "Este sistema fornece apenas orientação preliminar. Não representa aprovação de empréstimo, decisão de underwriting, compromisso de concessão de crédito, aconselhamento jurídico, aconselhamento fiscal ou determinação final de programa. Todos os cenários permanecem sujeitos à revisão de um loan officer licenciado, documentação, verificação, underwriting, title, appraisal e diretrizes atuais de investidores ou agências.",
    accept: "Reconheço e aceito este aviso.",
    backHome: "Voltar para Beyond Intelligence",
    language: "Idioma",
    borrowerName: "Nome do Cliente",
    email: "Email",
    phone: "Telefone",
    credit: "Pontuação de Crédito Estimada",
    income: "Renda Bruta Mensal",
    debt: "Dívida Mensal",
    currentState: "Estado Onde Mora Atualmente",
    targetState: "Estado Para Onde Deseja se Mudar",
    realtorQuestion: "Você está trabalhando com um Realtor?",
    realtorName: "Nome do Realtor",
    realtorPhone: "Telefone do Realtor",
    loanOfficerPlaceholder: "Digite o nome do loan officer ou o NMLS #",
    confirmOfficer: "Confirmar Loan Officer",
    unknownOfficer: "Não Sei Meu Loan Officer",
    assigned: "Roteamento Definido",
    review: "Executar Revisão Preliminar",
    reviewing: "Analisando...",
    scenarioTitle: "Cenário do Imóvel",
    homePrice: "Valor Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    occupancy: "Ocupação",
    continueScenario: "Continuar com Este Cenário",
    updatingScenario: "Atualizando Cenário...",
    conversation: "Conversa com Finley Beyond",
    send: "Enviar Mensagem",
    sending: "Enviando...",
    applyNow: "Aplicar Agora",
    schedule: "Agendar com o Loan Officer",
    emailOfficer: "Enviar Email ao Loan Officer",
    callOfficer: "Ligar para o Loan Officer",
    nextActions: "Próximos Passos",
    internalReviewTitle: "Direção Interna do Cenário",
    internalReviewText:
      "Esta seção reflete a direção interna de matching do Finley Beyond e é usada para orientar a conversa e o roteamento.",
    likelyDirection: "Direção Mais Provável",
    lenderCoverage: "Cobertura Lender/Broker",
    nextQuestion: "Próxima Melhor Pergunta",
    chatPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta do Finley Beyond.",
    reviewError: "Houve um problema ao executar a revisão preliminar.",
    matchError: "Houve um problema ao avaliar o cenário.",
    matchPending:
      "Execute a revisão preliminar para gerar a direção interna de matching.",
    officerConfirmed: "Loan officer confirmado.",
    officerFallback:
      "Nenhuma correspondência encontrada. Roteamento padrão atribuído ao Finley Beyond.",
    officerTypeHint:
      "Comece a digitar para ver loan officers correspondentes.",
    estimatedLoanAmount: "Valor Estimado do Empréstimo",
    estimatedLtv: "LTV Estimado",
    purpose: "Objetivo",
    notProvided: "Não informado",
    yes: "Sim",
    no: "Não",
    notSure: "Não Tenho Certeza",
    summarySent: "Resumo interno enviado com sucesso para:",
    summaryFailed:
      "A conversa funcionou, mas o email de resumo interno não foi enviado.",
    actionContinuing:
      "A ação continuará, mas o email de resumo interno não foi enviado.",
  },
  es: {
    title: "Espacio del Cliente / Borrower",
    subtitle:
      "Comience su conversación guiada sobre hipoteca con Finley Beyond.",
    disclaimerTitle: "Aviso Requerido",
    disclaimer:
      "Este sistema proporciona únicamente orientación preliminar. No representa aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, asesoría fiscal ni determinación final de programa. Todos los escenarios permanecen sujetos a revisión por un loan officer con licencia, documentación, verificación, underwriting, title, appraisal y guías actuales de inversionistas o agencias.",
    accept: "Reconozco y acepto este aviso.",
    backHome: "Volver a Beyond Intelligence",
    language: "Idioma",
    borrowerName: "Nombre del Cliente",
    email: "Correo Electrónico",
    phone: "Teléfono",
    credit: "Puntaje de Crédito Estimado",
    income: "Ingreso Bruto Mensual",
    debt: "Deuda Mensual",
    currentState: "Estado Donde Vive Actualmente",
    targetState: "Estado al Que Desea Mudarse",
    realtorQuestion: "¿Está trabajando con un Realtor?",
    realtorName: "Nombre del Realtor",
    realtorPhone: "Teléfono del Realtor",
    loanOfficerPlaceholder: "Escriba el nombre del loan officer o el NMLS #",
    confirmOfficer: "Confirmar Loan Officer",
    unknownOfficer: "No Conozco Mi Loan Officer",
    assigned: "Asignación Definida",
    review: "Ejecutar Revisión Preliminar",
    reviewing: "Revisando...",
    scenarioTitle: "Escenario de la Propiedad",
    homePrice: "Precio Estimado de la Vivienda",
    downPayment: "Pago Inicial Estimado",
    occupancy: "Ocupación",
    continueScenario: "Continuar con Este Escenario",
    updatingScenario: "Actualizando Escenario...",
    conversation: "Conversación con Finley Beyond",
    send: "Enviar Mensaje",
    sending: "Enviando...",
    applyNow: "Aplicar Ahora",
    schedule: "Agendar con el Loan Officer",
    emailOfficer: "Enviar Correo al Loan Officer",
    callOfficer: "Llamar al Loan Officer",
    nextActions: "Próximos Pasos",
    internalReviewTitle: "Dirección Interna del Escenario",
    internalReviewText:
      "Esta sección refleja la dirección interna de matching de Finley Beyond y se utiliza para orientar la conversación y el enrutamiento.",
    likelyDirection: "Dirección Más Probable",
    lenderCoverage: "Cobertura Lender/Broker",
    nextQuestion: "Siguiente Mejor Pregunta",
    chatPlaceholder:
      "Haga una pregunta o responda la siguiente pregunta de Finley Beyond.",
    reviewError: "Hubo un problema al ejecutar la revisión preliminar.",
    matchError: "Hubo un problema al evaluar el escenario.",
    matchPending:
      "Ejecute la revisión preliminar para generar la dirección interna de matching.",
    officerConfirmed: "Loan officer confirmado.",
    officerFallback:
      "No se encontró coincidencia. Se asignó el enrutamiento predeterminado a Finley Beyond.",
    officerTypeHint:
      "Empiece a escribir para ver los loan officers coincidentes.",
    estimatedLoanAmount: "Monto Estimado del Préstamo",
    estimatedLtv: "LTV Estimado",
    purpose: "Propósito",
    notProvided: "No proporcionado",
    yes: "Sí",
    no: "No",
    notSure: "No Estoy Seguro",
    summarySent: "Resumen interno enviado correctamente a:",
    summaryFailed:
      "La conversación funcionó, pero no se envió el correo interno de resumen.",
    actionContinuing:
      "La acción continuará, pero no se envió el correo interno de resumen.",
  },
} as const;

function cardStyle(opacity = 1): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
    opacity,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    minWidth: 0,
    boxSizing: "border-box",
    background: "#fff",
  };
}

function buttonPrimaryStyle(disabled = false): React.CSSProperties {
  return {
    background: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function buttonSecondaryStyle(active = false): React.CSSProperties {
  return {
    background: active ? "#0096C7" : "#fff",
    color: active ? "#fff" : "#263366",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function formatMoney(value: string) {
  const n = Number(value || 0);
  if (!n) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/[^\d]/g, "").slice(0, 10);

  const parts = [];
  if (cleaned.length > 0) parts.push(cleaned.slice(0, 3));
  if (cleaned.length >= 4) parts.push(cleaned.slice(3, 6));
  if (cleaned.length >= 7) parts.push(cleaned.slice(6, 10));

  return parts.join(".");
}

function formatPlainNumber(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return "";
  return new Intl.NumberFormat("en-US").format(Number(cleaned));
}

function normalizeOccupancyForMatch(value: string, purpose: LoanPurpose) {
  const lower = value.trim().toLowerCase();

  if (lower.includes("primary")) return "primary residence";
  if (lower.includes("second")) return "second home";
  if (lower.includes("investment")) return "investment property";

  if (purpose === "Investment") return "investment property";
  return "";
}

function normalizeTransactionForMatch(purpose: LoanPurpose) {
  if (purpose === "Purchase" || purpose === "Investment") return "purchase";
  if (purpose === "Refinance") return "rate term refinance";
  return "";
}

function guessIncomeType(income: string, purpose: LoanPurpose) {
  const lower = income.trim().toLowerCase();

  if (purpose === "Investment") return "dscr";
  if (lower.includes("bank")) return "bank statements";
  if (lower.includes("1099")) return "1099";
  if (lower.includes("p&l") || lower.includes("pnl") || lower.includes("profit")) {
    return "pnl";
  }
  return "full doc";
}

function guessBorrowerStatus() {
  return "citizen";
}

function extractReply(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) return data;

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    if (typeof obj.reply === "string" && obj.reply.trim()) return obj.reply;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
    if (typeof obj.response === "string" && obj.response.trim()) return obj.response;
    if (typeof obj.content === "string" && obj.content.trim()) return obj.content;

    const choices = obj.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown>;
      const message = first.message as Record<string, unknown> | undefined;
      if (message && typeof message.content === "string" && message.content.trim()) {
        return message.content;
      }
    }
  }

  return fallback;
}

function sanitizeNumericInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function normalizeOfficerText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findOfficer(query: string): LoanOfficerRecord | null {
  const cleaned = normalizeOfficerText(query.trim());
  if (!cleaned) return null;

  const exact =
    LOAN_OFFICERS.find(
      (officer) =>
        normalizeOfficerText(officer.name) === cleaned ||
        normalizeOfficerText(officer.nmls) === cleaned
    ) || null;

  if (exact) return exact;

  const partial =
    LOAN_OFFICERS.find(
      (officer) =>
        normalizeOfficerText(officer.name).includes(cleaned) ||
        cleaned.includes(normalizeOfficerText(officer.name)) ||
        normalizeOfficerText(officer.nmls).includes(cleaned) ||
        cleaned.includes(normalizeOfficerText(officer.nmls))
    ) || null;

  return partial;
}

function sanitizeBorrowerVisibleDirection(text: string | undefined, companyName: string) {
  if (!text?.trim()) return `Review available financing paths through ${companyName}.`;

  let safe = text;

  safe = safe.replace(/\bClearEdge Lending\b/gi, companyName);
  safe = safe.replace(/\bFirst National Bank of America\b/gi, companyName);
  safe = safe.replace(/\blenders\b/gi, "financing paths");
  safe = safe.replace(/\blender\b/gi, "financing path");
  safe = safe.replace(/\binvestors\b/gi, "financing sources");
  safe = safe.replace(/\binvestor\b/gi, "financing source");

  return safe;
}

export default function BorrowerPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = COPY[language];

  const [accepted, setAccepted] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState<LoanPurpose>("Purchase");
  const [loanOfficerQuery, setLoanOfficerQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] =
    useState<LoanOfficerRecord>(DEFAULT_OFFICER);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [matchError, setMatchError] = useState("");
  const [officerStatus, setOfficerStatus] = useState("");
  const [summaryStatus, setSummaryStatus] = useState("");
  const [actionBusy, setActionBusy] = useState<SummaryTrigger | "">("");
  const [actionBanner, setActionBanner] = useState("");

  const sentSummaryKeysRef = useRef<Set<string>>(new Set());

  const [intake, setIntake] = useState<IntakeFormState>({
    name: "",
    email: "",
    phone: "",
    credit: "",
    income: "",
    debt: "",
    currentState: "",
    targetState: "",
    realtorStatus: "not-sure",
    realtorName: "",
    realtorPhone: "",
  });

  const [scenario, setScenario] = useState<ScenarioFormState>({
    homePrice: "",
    downPayment: "",
    occupancy: "",
  });

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routing, setRouting] = useState<RoutingPayload | undefined>(undefined);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);

  useEffect(() => {
    setSummaryStatus("");
  }, [language]);

  const officerSuggestions = useMemo(() => {
    const trimmed = loanOfficerQuery.trim();
    if (!trimmed) return [];

    const cleaned = normalizeOfficerText(trimmed);
    if (!cleaned) return [];

    return LOAN_OFFICERS.filter((officer) => {
      const officerName = normalizeOfficerText(officer.name);
      const officerNmls = normalizeOfficerText(officer.nmls);
      return officerName.includes(cleaned) || officerNmls.includes(cleaned);
    }).slice(0, 5);
  }, [loanOfficerQuery]);

  const estimatedLoanAmount = useMemo(() => {
const homePrice = Number(scenario.homePrice.replace(/,/g, "") || 0);
const downPayment = Number(scenario.downPayment.replace(/,/g, "") || 0);
    const value = Math.max(homePrice - downPayment, 0);
    return value > 0 ? value.toString() : "";
  }, [scenario.homePrice, scenario.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenario.homePrice.replace(/,/g, "") || 0);
    const downPayment = Number(scenario.downPayment.replace(/,/g, "") || 0);
    if (!homePrice) return "";
    const ltv = ((homePrice - downPayment) / homePrice) * 100;
    return `${Math.max(0, Math.round(ltv))}%`;
  }, [scenario.homePrice, scenario.downPayment]);
  const matchRequestBody = useMemo(() => {
    return {
      borrower_status: guessBorrowerStatus(),
      occupancy: normalizeOccupancyForMatch(scenario.occupancy, loanPurpose),
      transaction: normalizeTransactionForMatch(loanPurpose),
      income: guessIncomeType(intake.income, loanPurpose),
      property: "single family",
      credit: Number(intake.credit || 0) || null,
      ltv: estimatedLtv ? Number(estimatedLtv.replace("%", "")) : null,
      dti: Number(intake.debt || 0) || null,
      loan_amount: estimatedLoanAmount ? Number(estimatedLoanAmount) : null,
      first_time_homebuyer: loanPurpose === "Purchase" ? true : false,
      subject_state: intake.targetState || intake.currentState || "",
    };
  }, [
    estimatedLoanAmount,
    estimatedLtv,
    intake.credit,
    intake.currentState,
    intake.debt,
    intake.income,
    intake.targetState,
    loanPurpose,
    scenario.occupancy,
  ]);

  const knownFactsSummary = useMemo(() => {
    const facts: string[] = [];

    if (intake.name.trim()) facts.push(`Borrower name: ${intake.name.trim()}`);
    if (intake.email.trim()) facts.push(`Borrower email: ${intake.email.trim()}`);
    if (intake.phone.trim()) facts.push(`Borrower phone: ${intake.phone.trim()}`);
    if (intake.credit.trim()) facts.push(`Estimated credit score: ${intake.credit.trim()}`);
    if (intake.income.trim()) facts.push(`Gross monthly income: ${intake.income.trim()}`);
    if (intake.debt.trim()) facts.push(`Monthly debt: ${intake.debt.trim()}`);
    if (intake.currentState.trim()) facts.push(`Current state: ${intake.currentState.trim()}`);
    if (intake.targetState.trim()) {
      facts.push(`Target state: ${intake.targetState.trim()}`);
      facts.push(
        `Unless clarified otherwise, treat target state as the likely subject property state already provided.`
      );
    }
    if (scenario.homePrice.trim()) facts.push(`Estimated home price: ${scenario.homePrice.trim()}`);
    if (scenario.downPayment.trim()) facts.push(`Estimated down payment: ${scenario.downPayment.trim()}`);
    if (estimatedLoanAmount) facts.push(`Estimated loan amount: ${estimatedLoanAmount}`);
    if (estimatedLtv) facts.push(`Estimated LTV: ${estimatedLtv}`);
    if (scenario.occupancy.trim()) facts.push(`Occupancy: ${scenario.occupancy.trim()}`);
    facts.push(`Transaction purpose: ${loanPurpose}`);
    facts.push(`Assigned loan officer: ${selectedOfficer.name} — NMLS ${selectedOfficer.nmls}`);
    facts.push(`Broker/lender company name to reference when needed: ${selectedOfficer.companyName}`);

    if (intake.realtorStatus === "yes") {
      facts.push(`Borrower is working with a Realtor.`);
      if (intake.realtorName.trim()) facts.push(`Realtor name: ${intake.realtorName.trim()}`);
      if (intake.realtorPhone.trim()) facts.push(`Realtor phone: ${intake.realtorPhone.trim()}`);
    } else if (intake.realtorStatus === "no") {
      facts.push(`Borrower is not working with a Realtor.`);
    } else {
      facts.push(`Realtor status is not confirmed.`);
    }

    return facts.join("\n- ");
  }, [
    estimatedLoanAmount,
    estimatedLtv,
    intake.credit,
    intake.currentState,
    intake.debt,
    intake.email,
    intake.income,
    intake.name,
    intake.phone,
    intake.realtorName,
    intake.realtorPhone,
    intake.realtorStatus,
    intake.targetState,
    loanPurpose,
    scenario.downPayment,
    scenario.homePrice,
    scenario.occupancy,
    selectedOfficer.companyName,
    selectedOfficer.name,
    selectedOfficer.nmls,
  ]);

  const borrowerChatRules = `
Rules for borrower-facing response:
- Keep the response concise, natural, and professional.
- Prefer 2 to 4 short paragraphs maximum.
- Do not ask for information that is already present in the known facts.
- If target state is already provided, do not ask again for subject property state unless there is a real reason to verify a difference.
- Do not repeat the loan officer's full name in every message.
- Mention the assigned loan officer only when useful, and no more than once in the response.
- Do not mention lender names, investor names, or internal lender coverage names to the borrower.
- If referring to the company, use the broker/lender company name already provided in the known facts.
- Do not tell the borrower to visit the website for Apply Now when the Apply Now button is already on the page.
- If referencing Apply Now, say: "You can begin by selecting the Apply Now option below."
- Do not promise approval.
- Do not reveal raw internal lender/program names unless compliance-safe.
- Encourage Apply Now naturally when useful, not mechanically every time.
- If asking a next question, ask only one question.
- Ask the most useful unanswered qualification question, not a question that is already answered.
`.trim();

  const preferredLanguageLabel = useMemo(() => {
    if (language === "pt") return "Português";
    if (language === "es") return "Español";
    return "English";
  }, [language]);

  const resetBorrowerWorkspace = () => {
    setAccepted(false);
    setLoanPurpose("Purchase");
    setLoanOfficerQuery("");
    setSelectedOfficer(DEFAULT_OFFICER);
    setReviewing(false);
    setSending(false);
    setMatchLoading(false);
    setPageError("");
    setMatchError("");
    setOfficerStatus("");
    setSummaryStatus("");
    setActionBusy("");
    setActionBanner("");
    setIntake({
      name: "",
      email: "",
      phone: "",
      credit: "",
      income: "",
      debt: "",
      currentState: "",
      targetState: "",
      realtorStatus: "not-sure",
      realtorName: "",
      realtorPhone: "",
    });
    setScenario({
      homePrice: "",
      downPayment: "",
      occupancy: "",
    });
    setChatInput("");
    setMessages([]);
    setRouting(undefined);
    setMatchResult(null);
    sentSummaryKeysRef.current.clear();
  };

  const sendSummaryToLoanOfficer = async (
    conversation: ChatMessage[],
    trigger: SummaryTrigger = "ai",
    options?: {
      force?: boolean;
      resolvedOfficer?: LoanOfficerRecord;
    }
  ): Promise<SummaryResponse> => {
    const activeOfficer = options?.resolvedOfficer || selectedOfficer;

    if (!intake.name.trim() || !intake.email.trim() || !intake.phone.trim()) {
      return { success: false, error: "Missing required lead details." };
    }

    const signature = JSON.stringify({
      trigger,
      officerId: activeOfficer.id,
      name: intake.name.trim(),
      email: intake.email.trim(),
      phone: intake.phone.trim(),
      lastUserMessage:
        conversation
          .filter((item) => item.role === "user")
          .slice(-1)[0]?.content || "",
      messageCount: conversation.length,
    });

    const dedupeKey = `${trigger}:${signature}`;

    if (!options?.force && sentSummaryKeysRef.current.has(dedupeKey)) {
      return { success: true };
    }

    try {
      const response = await fetch(SUMMARY_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: trigger !== "ai",
        body: JSON.stringify({
          trigger,
          lead: {
            fullName: intake.name.trim(),
            email: intake.email.trim(),
            phone: intake.phone.trim(),
            preferredLanguage: preferredLanguageLabel,
            loanOfficer: activeOfficer.id,
            assignedOfficerName: activeOfficer.name,
            estimatedLoanAmount: estimatedLoanAmount
              ? formatMoney(estimatedLoanAmount)
              : "",
            assignedEmail: activeOfficer.email,
          },
          messages: conversation,
        }),
      });

      const data = (await response.json().catch(() => null)) as SummaryResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Summary email request failed.");
      }

      sentSummaryKeysRef.current.add(dedupeKey);

      if (trigger === "ai") {
        setSummaryStatus(`${t.summarySent} ${data.sentTo || activeOfficer.email}`);
      }

      return { success: true, sentTo: data.sentTo || activeOfficer.email };
    } catch (error) {
      console.error("Email summary failed:", error);

      if (trigger === "ai") {
        setSummaryStatus("");
        setPageError((prev) => prev || t.summaryFailed);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Summary email failed.",
      };
    }
  };

  const handleConfirmOfficer = () => {
    const found = findOfficer(loanOfficerQuery);

    if (found) {
      setSelectedOfficer(found);
      setLoanOfficerQuery(`${found.name} — NMLS ${found.nmls}`);
      setOfficerStatus(t.officerConfirmed);
      return;
    }

    setSelectedOfficer(DEFAULT_OFFICER);
    setLoanOfficerQuery(`${DEFAULT_OFFICER.name} — NMLS ${DEFAULT_OFFICER.nmls}`);
    setOfficerStatus(t.officerFallback);
  };

  const handleChooseSuggestion = (officer: LoanOfficerRecord) => {
    setSelectedOfficer(officer);
    setLoanOfficerQuery(`${officer.name} — NMLS ${officer.nmls}`);
    setOfficerStatus(t.officerConfirmed);
  };

  const handleUseUnknownOfficer = () => {
    setSelectedOfficer(DEFAULT_OFFICER);
    setLoanOfficerQuery(`${DEFAULT_OFFICER.name} — NMLS ${DEFAULT_OFFICER.nmls}`);
    setOfficerStatus("");
  };

  const buildRouting = (
    conversation: ChatMessage[],
    match: MatchResponse | null,
    officer?: LoanOfficerRecord
  ): RoutingPayload => ({
    language,
    loanOfficerQuery,
    selectedOfficer: officer || selectedOfficer,
    borrower: {
      name: intake.name,
      email: intake.email,
      phone: intake.phone,
      credit: intake.credit,
      income: intake.income,
      debt: intake.debt,
      currentState: intake.currentState,
      targetState: intake.targetState,
      realtorName: intake.realtorStatus === "yes" ? intake.realtorName : "",
      realtorPhone: intake.realtorStatus === "yes" ? intake.realtorPhone : "",
    },
    scenario: {
      transactionType: loanPurpose,
      homePrice: scenario.homePrice,
      downPayment: scenario.downPayment,
      estimatedLoanAmount,
      estimatedLtv,
      occupancy: scenario.occupancy,
      subjectState: intake.targetState || intake.currentState || "",
    },
    internalMatch: match
      ? {
          topRecommendation:
            match.openai_enhancement?.topRecommendation ||
            match.top_recommendation ||
            "",
          nextQuestion:
            match.openai_enhancement?.nextBestQuestion ||
            match.next_question ||
            "",
          strongCount: match.summary?.strong_count || 0,
          conditionalCount: match.summary?.conditional_count || 0,
          eliminatedCount: match.summary?.eliminated_count || 0,
          totalGuidelinesChecked: match.summary?.total_guidelines_checked || 0,
          activeLendersChecked: match.lender_summary?.active_lenders_checked || [],
          topStrongMatches: (match.strong_matches || []).slice(0, 3).map((item) => ({
            lender_name: item.lender_name,
            program_name: item.program_name,
            loan_category: item.loan_category,
            score: item.score,
            explanation: item.explanation,
            notes: item.notes,
            strengths: item.strengths,
            concerns: item.concerns,
          })),
        }
      : undefined,
    conversation,
  });

  const runMatch = async (): Promise<MatchResponse | null> => {
    setMatchLoading(true);
    setMatchError("");

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(matchRequestBody),
      });

      const data = (await response.json()) as MatchResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || t.matchError);
      }

      setMatchResult(data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : t.matchError;
      setMatchError(message);
      return null;
    } finally {
      setMatchLoading(false);
    }
  };

  const runPreliminaryReview = async () => {
    setReviewing(true);
    setPageError("");
    setOfficerStatus("");
    setSummaryStatus("");

    const resolvedOfficer = findOfficer(loanOfficerQuery) || selectedOfficer || DEFAULT_OFFICER;
    setSelectedOfficer(resolvedOfficer);

    if (!loanOfficerQuery.trim()) {
      setLoanOfficerQuery(`${resolvedOfficer.name} — NMLS ${resolvedOfficer.nmls}`);
    }

    const starterMessage: ChatMessage = {
      role: "user",
      content:
        language === "pt"
          ? "Estou pronto para começar a revisão preliminar."
          : language === "es"
          ? "Estoy listo para comenzar la revisión preliminar."
          : "I am ready to begin the preliminary review.",
    };

    try {
      const match = await runMatch();
      const starterConversation: ChatMessage[] = [starterMessage];
      const currentRouting = buildRouting(starterConversation, match, resolvedOfficer);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "initial_review",
          routing: {
            ...currentRouting,
            selectedOfficer: resolvedOfficer,
            conversation: starterConversation,
          },
          messages: [
            {
              role: "user",
              content: `
Borrower intake has been collected.

Known facts already collected:
- ${knownFactsSummary}

Internal match direction:
- Top recommendation: ${
                match?.openai_enhancement?.topRecommendation ||
                match?.top_recommendation ||
                "No strong direction yet"
              }
- Strong match count: ${match?.summary?.strong_count || 0}
- Conditional match count: ${match?.summary?.conditional_count || 0}
- Next best question from internal engine: ${
                match?.openai_enhancement?.nextBestQuestion ||
                match?.next_question ||
                "Continue qualification"
              }

${borrowerChatRules}

Start the borrower conversation.
Acknowledge the scenario briefly.
Do not ask for any field that is already in the known facts list.
If a next question is needed, ask one useful unanswered question only.
              `.trim(),
            },
            starterMessage,
          ],
        }),
      });

      const data = await response.json();

      const newConversation: ChatMessage[] = [
        starterMessage,
        {
          role: "assistant",
          content: extractReply(data, "Review started."),
        },
      ];

      setMessages(newConversation);
      setRouting(
        data.routing || {
          ...buildRouting(newConversation, match, resolvedOfficer),
          selectedOfficer: resolvedOfficer,
        }
      );

      await sendSummaryToLoanOfficer(newConversation, "ai", {
        resolvedOfficer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.reviewError;
      setPageError(message);
    } finally {
      setReviewing(false);
    }
  };

  const continueScenario = async () => {
    setReviewing(true);
    setPageError("");

    const userMessage: ChatMessage = {
      role: "user",
      content:
        language === "pt"
          ? `Meu objetivo é um cenário de ${loanPurpose.toLowerCase()} com imóvel estimado em ${scenario.homePrice || "0"} e entrada estimada de ${scenario.downPayment || "0"}.`
          : language === "es"
          ? `Mi objetivo es un escenario de ${loanPurpose.toLowerCase()} con propiedad estimada en ${scenario.homePrice || "0"} y pago inicial estimado de ${scenario.downPayment || "0"}.`
          : `My goal is a ${loanPurpose.toLowerCase()} scenario with an estimated property price of ${scenario.homePrice || "0"} and an estimated down payment of ${scenario.downPayment || "0"}.`,
    };

    try {
      const match = await runMatch();
      const nextConversation: ChatMessage[] = [...messages, userMessage];
      const currentRouting = buildRouting(nextConversation, match);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "scenario_review",
          routing: currentRouting,
          messages: [
            {
              role: "user",
              content: `
Updated scenario details are available.

Known facts already collected:
- ${knownFactsSummary}

Internal match direction:
- Top recommendation: ${
                match?.openai_enhancement?.topRecommendation ||
                match?.top_recommendation ||
                "No strong direction yet"
              }
- Strong match count: ${match?.summary?.strong_count || 0}
- Conditional match count: ${match?.summary?.conditional_count || 0}
- Next best question from internal engine: ${
                match?.openai_enhancement?.nextBestQuestion ||
                match?.next_question ||
                "Continue qualification"
              }

${borrowerChatRules}

Acknowledge the scenario briefly.
Do not ask for any field already collected.
If a next question is needed, ask only one useful unanswered question.
              `.trim(),
            },
            ...nextConversation,
          ],
        }),
      });

      const data = await response.json();

      const updatedConversation: ChatMessage[] = [
        ...nextConversation,
        {
          role: "assistant",
          content: extractReply(data, "Scenario updated."),
        },
      ];

      setMessages(updatedConversation);
      setRouting(data.routing || buildRouting(updatedConversation, match));
    } catch (error) {
      const message = error instanceof Error ? error.message : t.reviewError;
      setPageError(message);
    } finally {
      setReviewing(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    setSending(true);
    setPageError("");

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
    };

    try {
      const nextConversation: ChatMessage[] = [...messages, userMessage];
      const currentRouting = buildRouting(nextConversation, matchResult);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "follow_up",
          routing: currentRouting,
          messages: [
            {
              role: "user",
              content: `
Continue the borrower-facing conversation.

Known facts already collected:
- ${knownFactsSummary}

Internal match direction:
- Top recommendation: ${
                matchResult?.openai_enhancement?.topRecommendation ||
                matchResult?.top_recommendation ||
                "No strong direction yet"
              }
- Next best question from internal engine: ${
                matchResult?.openai_enhancement?.nextBestQuestion ||
                matchResult?.next_question ||
                "Continue qualification"
              }

${borrowerChatRules}

Answer naturally.
Do not ask for any field already collected.
If appropriate, ask only one useful unanswered question.
              `.trim(),
            },
            ...nextConversation,
          ],
        }),
      });

      const data = await response.json();

      const updatedConversation: ChatMessage[] = [
        ...nextConversation,
        {
          role: "assistant",
          content: extractReply(data, "Message received."),
        },
      ];

      setMessages(updatedConversation);
      setRouting(data.routing || buildRouting(updatedConversation, matchResult));
      setChatInput("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "There was a problem sending the message.";
      setPageError(message);
    } finally {
      setSending(false);
    }
  };
  const buildActionTranscriptMessage = (
    trigger: SummaryTrigger,
     channel?: "email" | "phone"
  ): ChatMessage => {
    const content =
      language === "pt"
        ? trigger === "apply"
          ? "Selecionei Aplicar Agora."
          : trigger === "schedule"
          ? "Selecionei Agendar com o Loan Officer."
          : channel === "phone"
          ? "Selecionei Ligar para o Loan Officer."
          : "Selecionei Enviar Email ao Loan Officer."
        : language === "es"
        ? trigger === "apply"
          ? "Seleccioné Aplicar Ahora."
          : trigger === "schedule"
          ? "Seleccioné Agendar con el Loan Officer."
            : channel === "phone"
          ? "Seleccioné Llamar al Loan Officer."
          : "Seleccioné Enviar Correo al Loan Officer."
        : trigger === "apply"
        ? "I selected Apply Now."
        : trigger === "schedule"
        ? "I selected Schedule with Loan Officer."
        : channel === "phone"
        ? "I selected Call Loan Officer."
        : "I selected Email Loan Officer.";

    return {
      role: "user",
      content,
    };
  };
  
  const handleTriggeredSummaryAction = async (
    trigger: SummaryTrigger,
    options?: { channel?: "email" | "phone" }
  ) => {
    setActionBusy(trigger);
    setPageError("");
    setSummaryStatus("");

    const actionMessage = buildActionTranscriptMessage(trigger, options?.channel);

    const baseConversation = messages.length
      ? messages
      : [
          {
            role: "assistant" as const,
            content: "Borrower visited the workspace and selected a next action.",
          },
        ];

    const alreadyLoggedSameAction =
      baseConversation[baseConversation.length - 1]?.role === "user" &&
      baseConversation[baseConversation.length - 1]?.content === actionMessage.content;

    const conversationToSend = alreadyLoggedSameAction
      ? baseConversation
      : [...baseConversation, actionMessage];

    if (!alreadyLoggedSameAction) {
      setMessages(conversationToSend);
      setRouting((prev) =>
        prev
          ? { ...prev, conversation: conversationToSend }
          : buildRouting(conversationToSend, matchResult)
      );
    }

    const result = await sendSummaryToLoanOfficer(conversationToSend, trigger, {
      force: true,
    });

    if (!result.success) {
      setPageError(`${t.actionContinuing} ${result.error || ""}`.trim());
    }

    return result.success;
  };
  const finalizeTriggeredAction = (
    shouldReset = false,
    bannerMessage?: string
  ) => {
    setActionBusy("");

    if (bannerMessage) {
      setActionBanner(bannerMessage);
    }

    if (shouldReset) {
      setTimeout(() => {
        resetBorrowerWorkspace();
      }, 1200);
    }
  };

  const officerPhoneHref = selectedOfficer.mobile
    ? `tel:${selectedOfficer.mobile}`
    : undefined;

  const officerMailtoHref = `mailto:${selectedOfficer.email}?subject=${encodeURIComponent(
    intake.name
      ? `Borrower inquiry from ${intake.name}`
      : "Borrower inquiry from Beyond Intelligence"
  )}&body=${encodeURIComponent(
    language === "pt"
      ? `Olá ${selectedOfficer.name}, gostaria de falar sobre meu cenário de financiamento.`
      : language === "es"
      ? `Hola ${selectedOfficer.name}, me gustaría hablar sobre mi escenario de financiamiento.`
      : `Hello ${selectedOfficer.name}, I would like to discuss my financing scenario.`
  )}`;

  const borrowerVisibleDirection = sanitizeBorrowerVisibleDirection(
    matchResult?.openai_enhancement?.topRecommendation ||
      matchResult?.top_recommendation ||
      "No strong direction yet",
    selectedOfficer.companyName
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 20 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                background: "#E8EEF8",
                color: "#263366",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              BEYOND INTELLIGENCE™
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(34px, 6vw, 54px)",
                lineHeight: 1.15,
              }}
            >
              {t.title}
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: "clamp(16px, 2.5vw, 18px)",
              }}
            >
              {t.subtitle}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "flex-start",
              flex: "1 1 320px",
              minWidth: 0,
            }}
          >
            <label style={{ fontWeight: 700 }}>{t.language}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              style={{ ...inputStyle(), width: 160, padding: "10px 12px" }}
            >
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="es">Español</option>
            </select>

            <Link
              href="/"
              style={{
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
              }}
            >
              {t.backHome}
            </Link>
          </div>
        </div>

        {(pageError || matchError) && (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid #F5C2C7",
              background: "#FFF5F5",
              color: "#842029",
              marginBottom: 20,
              whiteSpace: "pre-wrap",
            }}
          >
            {pageError || matchError}
          </div>
        )}

        {summaryStatus && (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid #BADBCC",
              background: "#F0FFF4",
              color: "#0F5132",
              marginBottom: 20,
            }}
          >
            {summaryStatus}
          </div>
        )}

        {actionBanner && (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid #BADBCC",
              background: "#F0FFF4",
              color: "#0F5132",
              marginBottom: 20,
            }}
          >
            {actionBanner}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{t.disclaimerTitle}</h2>
              <p style={{ lineHeight: 1.8, color: "#4B5C78", marginBottom: 0 }}>
                {t.disclaimer}
              </p>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginTop: 18,
                }}
              >
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>{t.accept}</span>
              </label>
            </section>

            <section style={cardStyle(accepted ? 1 : 0.55)}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                {(["Purchase", "Refinance", "Investment"] as LoanPurpose[]).map(
                  (purpose) => (
                    <button
                      key={purpose}
                      type="button"
                      disabled={!accepted}
                      onClick={() => setLoanPurpose(purpose)}
                      style={buttonSecondaryStyle(loanPurpose === purpose)}
                    >
                      {purpose}
                    </button>
                  )
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <input
                  disabled={!accepted}
                  placeholder={t.borrowerName}
                  value={intake.name}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.email}
                  value={intake.email}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, email: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.phone}
                  value={intake.phone}
                  onChange={(e) =>
                    setIntake((prev) => ({
                      ...prev,
                      phone: formatPhoneNumber(e.target.value),
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.credit}
                  value={intake.credit}
                  onChange={(e) =>
                    setIntake((prev) => ({
                      ...prev,
                      credit: sanitizeNumericInput(e.target.value),
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.income}
                  value={intake.income}
                  onChange={(e) =>
                    setIntake((prev) => ({
                      ...prev,
                      income: formatPlainNumber(e.target.value),
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.debt}
                  value={intake.debt}
                  onChange={(e) =>
                    setIntake((prev) => ({
                      ...prev,
                      debt: formatPlainNumber(e.target.value),
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.currentState}
                  value={intake.currentState}
                  onChange={(e) =>
                    setIntake((prev) => ({
                      ...prev,
                      currentState: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.targetState}
                  value={intake.targetState}
                  onChange={(e) =>
                    setIntake((prev) => ({
                      ...prev,
                      targetState: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  {t.realtorQuestion}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button
                    type="button"
                    disabled={!accepted}
                    onClick={() =>
                      setIntake((prev) => ({ ...prev, realtorStatus: "yes" }))
                    }
                    style={buttonSecondaryStyle(intake.realtorStatus === "yes")}
                  >
                    {t.yes}
                  </button>
                  <button
                    type="button"
                    disabled={!accepted}
                    onClick={() =>
                      setIntake((prev) => ({ ...prev, realtorStatus: "no" }))
                    }
                    style={buttonSecondaryStyle(intake.realtorStatus === "no")}
                  >
                    {t.no}
                  </button>
                  <button
                    type="button"
                    disabled={!accepted}
                    onClick={() =>
                      setIntake((prev) => ({ ...prev, realtorStatus: "not-sure" }))
                    }
                    style={buttonSecondaryStyle(
                      intake.realtorStatus === "not-sure"
                    )}
                  >
                    {t.notSure}
                  </button>
                </div>

                {intake.realtorStatus === "yes" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 14,
                      marginTop: 14,
                    }}
                  >
                    <input
                      disabled={!accepted}
                      placeholder={t.realtorName}
                      value={intake.realtorName}
                      onChange={(e) =>
                        setIntake((prev) => ({
                          ...prev,
                          realtorName: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                    <input
                      disabled={!accepted}
                      placeholder={t.realtorPhone}
                      value={intake.realtorPhone}
                      onChange={(e) =>
                        setIntake((prev) => ({
                          ...prev,
                          realtorPhone: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18, position: "relative" }}>
                <input
                  disabled={!accepted}
                  placeholder={t.loanOfficerPlaceholder}
                  value={loanOfficerQuery}
                  onChange={(e) => {
                    setLoanOfficerQuery(e.target.value);
                    setOfficerStatus("");
                  }}
                  style={inputStyle()}
                />

                {accepted && loanOfficerQuery.trim() && officerSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #D9E1EC",
                      borderRadius: 14,
                      boxShadow: "0 12px 24px rgba(38,51,102,0.10)",
                      zIndex: 10,
                      overflow: "hidden",
                    }}
                  >
                    {officerSuggestions.map((officer) => (
                      <button
                        key={officer.id}
                        type="button"
                        onClick={() => handleChooseSuggestion(officer)}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          textAlign: "left",
                          border: "none",
                          background: "#fff",
                          color: "#263366",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {officer.name} — NMLS {officer.nmls}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: "#6B7B94" }}>
                {t.officerTypeHint}
              </div>

              {officerStatus && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "#F8FAFC",
                    border: "1px solid #D9E1EC",
                    color: "#4B5C78",
                    fontSize: 14,
                  }}
                >
                  {officerStatus}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  disabled={!accepted}
                  onClick={handleConfirmOfficer}
                  style={buttonSecondaryStyle(true)}
                >
                  {t.confirmOfficer}
                </button>

                <button
                  type="button"
                  disabled={!accepted}
                  onClick={handleUseUnknownOfficer}
                  style={buttonSecondaryStyle(false)}
                >
                  {t.unknownOfficer}
                </button>
              </div>

              <div
                style={{
                  marginTop: 18,
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  background: "#F8FAFC",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: "#6B7B94",
                    marginBottom: 8,
                  }}
                >
                  {t.assigned}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "clamp(18px, 3vw, 24px)",
                    lineHeight: 1.4,
                  }}
                >
                  {selectedOfficer.name} — NMLS {selectedOfficer.nmls}
                </div>
                <div style={{ color: "#5A6A84", marginTop: 6, lineHeight: 1.7 }}>
                  Internal summary will route to {selectedOfficer.email} and{" "}
                  {selectedOfficer.assistantEmail}.
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  disabled={!accepted || reviewing}
                  onClick={runPreliminaryReview}
                  style={buttonPrimaryStyle(!accepted || reviewing)}
                >
                  {reviewing ? t.reviewing : t.review}
                </button>
              </div>
            </section>

            <section style={cardStyle(accepted ? 1 : 0.55)}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{t.scenarioTitle}</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <input
                  disabled={!accepted}
                  placeholder={t.homePrice}
                  value={scenario.homePrice}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      homePrice: formatPlainNumber(e.target.value),
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.downPayment}
                  value={scenario.downPayment}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      downPayment: formatPlainNumber(e.target.value),
                    }))
                  }
                  style={inputStyle()}
                />
                <select
                  disabled={!accepted}
                  value={scenario.occupancy}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, occupancy: e.target.value }))
                  }
                  style={inputStyle()}
                >
                  <option value="">{t.occupancy}</option>
                  <option value="Primary residence">Primary residence</option>
                  <option value="Second home">Second home</option>
                  <option value="Investment property">Investment property</option>
                </select>
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 16,
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.45,
                    color: "#6B7B94",
                    marginBottom: 8,
                  }}
                >
                  {t.estimatedLoanAmount.toUpperCase()}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {formatMoney(estimatedLoanAmount)}
                </div>
                <div style={{ marginTop: 8, color: "#5A6A84" }}>
                  {t.estimatedLtv}: {estimatedLtv || t.notProvided}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  disabled={!accepted || reviewing}
                  onClick={continueScenario}
                  style={buttonPrimaryStyle(!accepted || reviewing)}
                >
                  {reviewing ? t.updatingScenario : t.continueScenario}
                </button>
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{t.internalReviewTitle}</h2>
              <p style={{ marginTop: 0, color: "#5A6A84", lineHeight: 1.7 }}>
                {t.internalReviewText}
              </p>

              {!matchResult ? (
                <div style={{ color: "#70819A", lineHeight: 1.7 }}>
                  {matchLoading ? "Evaluating scenario..." : t.matchPending}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: "#F8FAFC",
                      border: "1px solid #D9E1EC",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.45,
                        color: "#6B7B94",
                        marginBottom: 8,
                      }}
                    >
                      {t.likelyDirection}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {borrowerVisibleDirection}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: "#F8FAFC",
                      border: "1px solid #D9E1EC",
                      color: "#4B5C78",
                      lineHeight: 1.8,
                    }}
                  >
                    <div>
                      <strong>Strong:</strong> {matchResult.summary?.strong_count || 0}
                    </div>
                    <div>
                      <strong>Conditional:</strong>{" "}
                      {matchResult.summary?.conditional_count || 0}
                    </div>
                    <div>
                      <strong>Eliminated:</strong>{" "}
                      {matchResult.summary?.eliminated_count || 0}
                    </div>
                    <div>
                      <strong>{t.lenderCoverage}:</strong>{" "}
                      {selectedOfficer.companyName || t.notProvided}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: "#F8FAFC",
                      border: "1px solid #D9E1EC",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.45,
                        color: "#6B7B94",
                        marginBottom: 8,
                      }}
                    >
                      {t.nextQuestion}
                    </div>
                    <div style={{ lineHeight: 1.7, color: "#263366" }}>
                      {matchResult.openai_enhancement?.nextBestQuestion ||
                        matchResult.next_question ||
                        t.notProvided}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{t.conversation}</h2>

              <div
                style={{
                  minHeight: 320,
                  maxHeight: 560,
                  overflowY: "auto",
                  padding: 14,
                  borderRadius: 16,
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                }}
              >
                {messages.length === 0 ? (
                  <div style={{ color: "#70819A", lineHeight: 1.7 }}>
                    {t.chatPlaceholder}
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        marginBottom: 14,
                        padding: 14,
                        borderRadius: 14,
                        background:
                          message.role === "assistant" ? "#FFFFFF" : "#DBEAFE",
                        border: "1px solid #D9E1EC",
                        lineHeight: 1.8,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          marginBottom: 8,
                          color: "#263366",
                        }}
                      >
                        {message.role === "assistant"
                          ? "Finley Beyond"
                          : intake.name || "Borrower"}
                      </div>
                      <div>{message.content}</div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!sending && accepted && chatInput.trim()) {
                        void sendMessage();
                      }
                    }
                  }}
                  placeholder={t.chatPlaceholder}
                  rows={5}
                  style={{
                    ...inputStyle(),
                    resize: "vertical",
                    minHeight: 120,
                  }}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending || !accepted}
                  style={buttonPrimaryStyle(sending || !accepted)}
                >
                  {sending ? t.sending : t.send}
                </button>
              </div>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{t.nextActions}</h2>

              <div style={{ display: "grid", gap: 12 }}>
                <a
                  href={selectedOfficer.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={async (e) => {
                    e.preventDefault();

                    window.open(
                      selectedOfficer.applyUrl,
                      "_blank",
                      "noopener,noreferrer"
                    );

                    await handleTriggeredSummaryAction("apply");

                    finalizeTriggeredAction(
                      true,
                      "Application page opened. Your information was routed successfully."
                    );
                  }}
                  style={{
                    ...buttonPrimaryStyle(actionBusy === "apply"),
                    textAlign: "center",
                    textDecoration: "none",
                    pointerEvents: actionBusy ? "none" : "auto",
                  }}
                >
                  {actionBusy === "apply" ? "Opening..." : t.applyNow}
                </a>

                <a
                  href={selectedOfficer.scheduleUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={async (e) => {
                    e.preventDefault();

                    window.open(
                      selectedOfficer.scheduleUrl,
                      "_blank",
                      "noopener,noreferrer"
                    );

                    await handleTriggeredSummaryAction("schedule");

                    finalizeTriggeredAction(
                      true,
                      "Scheduling page opened. Your information was routed successfully."
                    );
                  }}
                  style={{
                    ...buttonSecondaryStyle(true),
                    textAlign: "center",
                    textDecoration: "none",
                    pointerEvents: actionBusy ? "none" : "auto",
                    opacity: actionBusy ? 0.7 : 1,
                  }}
                >
                  {actionBusy === "schedule" ? "Opening..." : t.schedule}
                </a>

                <a
                  href={officerMailtoHref}
                  onClick={async (e) => {
                    e.preventDefault();
                    const targetHref = officerMailtoHref;

                    window.location.href = targetHref;

                    void handleTriggeredSummaryAction("contact", {
                      channel: "email",
                    }).finally(() => {
                      finalizeTriggeredAction(
                        true,
                        "Email action launched. Your information was routed successfully."
                      );
                    });
                  }}
                  style={{
                    ...buttonSecondaryStyle(false),
                    textAlign: "center",
                    textDecoration: "none",
                    pointerEvents: actionBusy ? "none" : "auto",
                    opacity: actionBusy ? 0.7 : 1,
                  }}
                >
                  {actionBusy === "contact" ? "Opening..." : t.emailOfficer}
                </a>

                {officerPhoneHref && (
                  <a
                    onClick={async (e) => {
                      e.preventDefault();
                      const targetHref = officerPhoneHref;

                      if (!targetHref) return;

                      window.location.href = targetHref;

                      void handleTriggeredSummaryAction("contact", {
                        channel: "phone",
                      }).finally(() => {
                        finalizeTriggeredAction(
                          true,
                          "Call action launched. Your information was routed successfully."
                        );
                      });
                    }}
                    style={{
                      ...buttonSecondaryStyle(false),
                      textAlign: "center",
                      textDecoration: "none",
                      pointerEvents: actionBusy ? "none" : "auto",
                      opacity: actionBusy ? 0.7 : 1,
                    }}
                  >
                    {actionBusy === "contact" ? "Opening..." : t.callOfficer}
                  </a>
                )}
              </div>

              {routing?.scenario && (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: "1px solid #E0E7F0",
                    color: "#4B5C78",
                    lineHeight: 1.8,
                  }}
                >
                  <div>
                    <strong>{t.purpose}:</strong> {loanPurpose}
                  </div>
                  <div>
                    <strong>Current State:</strong>{" "}
                    {intake.currentState || t.notProvided}
                  </div>
                  <div>
                    <strong>Target State:</strong>{" "}
                    {intake.targetState || t.notProvided}
                  </div>
                  <div>
                    <strong>Occupancy:</strong>{" "}
                    {routing.scenario.occupancy || t.notProvided}
                  </div>
                  <div>
                    <strong>{t.estimatedLoanAmount}:</strong>{" "}
                    {formatMoney(routing.scenario.estimatedLoanAmount || "0")}
                  </div>
                  <div>
                    <strong>{t.estimatedLtv}:</strong>{" "}
                    {routing.scenario.estimatedLtv || t.notProvided}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
