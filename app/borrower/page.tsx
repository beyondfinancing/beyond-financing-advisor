"use client";

import React, { useMemo, useState } from "react";

type LanguageCode = "en" | "pt" | "es";

type IntakeFormState = {
  name: string;
  email: string;
  phone: string;
  credit: string;
  income: string;
  debt: string;
};

type ScenarioFormState = {
  homePrice: string;
  downPayment: string;
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
  mobile: string;
  assistantMobile: string;
  applyUrl: string;
  scheduleUrl: string;
  summaryKey: "finley" | "sandro" | "warren";
};

const APPLY_NOW_URL = "https://www.beyondfinancing.com/apply-now";

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
    summaryKey: "sandro",
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
    summaryKey: "warren",
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
    summaryKey: "finley",
  },
];

const DEFAULT_LOAN_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

const COPY = {
  en: {
    heroTitle: "Finley Beyond Powered by Beyond Intelligence™",
    heroText:
      "AI-Powered Mortgage Decision System supervised by a Certified Mortgage Advisor.",
    languageLabel: "Language",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It does not constitute a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program eligibility determination. All scenarios must be independently reviewed and confirmed by a licensed loan officer using current investor guidelines, overlays, and program requirements.",
    acceptText:
      "I acknowledge and accept this disclaimer before using the system.",
    intakeTitle: "Borrower Intake",
    intakeLocked:
      "The intake section is locked until the disclaimer is accepted.",
    borrowerName: "Borrower Name",
    email: "Email",
    phone: "Phone",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt",
    loanOfficer: "Loan Officer Name or NMLS #",
    loanOfficerPlaceholder: "Type loan officer name or NMLS #",
    confirmLoanOfficer: "Confirm Loan Officer",
    unknownLoanOfficer: "I Do Not Know My Loan Officer",
    assignedRouting: "Assigned Routing",
    internalRoutingPrefix: "Internal summary will route to",
    runPreliminaryReview: "Run Preliminary Review",
    reviewing: "Reviewing...",
    targetScenarioTitle: "Property Target Scenario",
    targetScenarioText:
      "Now enter the target home price and the estimated down payment so Finley Beyond can continue the scenario with the numbers you are actually considering.",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    estimatedLoanAmount: "Estimated Loan Amount",
    continueScenario: "Continue with This Scenario",
    updatingScenario: "Updating Scenario...",
    financialSnapshot: "Financial Snapshot",
    estimatedLtv: "Estimated LTV",
    conversationTitle: "Conversation with Finley",
    placeholderConversation:
      "Complete the intake and run the preliminary review to begin the Finley Beyond conversation.",
    continueChatting: "Continue chatting with Finley Beyond",
    chatPlaceholder:
      "Ask a question or answer Finley’s next qualification question.",
    sendMessage: "Send Message",
    sending: "Sending...",
    applyNow: "Apply Now",
    scheduleLoanOfficer: "Schedule with Loan Officer",
    emailLoanOfficer: "Email Loan Officer",
    actionTitle: "Next Actions",
    loanOfficerNotFound:
      "Loan Officer not found. Please select one of the suggested names or use the default option.",
    summaryFailed:
      "Conversation continued, but internal summary email could not be sent.",
  },
  pt: {
    heroTitle: "Finley Beyond com tecnologia Beyond Intelligence™",
    heroText:
      "Sistema de orientação hipotecária com IA supervisionado por um Certified Mortgage Advisor.",
    languageLabel: "Idioma",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimerText:
      "Este sistema fornece apenas orientação preliminar. Não constitui aprovação de empréstimo, decisão de underwriting, compromisso de conceder crédito, aconselhamento jurídico, aconselhamento fiscal ou determinação final de elegibilidade de programa. Todos os cenários devem ser analisados e confirmados de forma independente por um loan officer licenciado, com base nas diretrizes atuais dos investidores, overlays e requisitos do programa.",
    acceptText:
      "Reconheço e aceito este aviso antes de usar o sistema.",
    intakeTitle: "Informações do Cliente",
    intakeLocked:
      "A seção de informações permanece bloqueada até que o aviso seja aceito.",
    borrowerName: "Nome do Cliente",
    email: "Email",
    phone: "Telefone",
    credit: "Pontuação de Crédito Estimada",
    income: "Renda Bruta Mensal",
    debt: "Dívida Mensal",
    loanOfficer: "Nome do Loan Officer ou NMLS #",
    loanOfficerPlaceholder: "Digite o nome do loan officer ou o NMLS #",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "Não Sei Meu Loan Officer",
    assignedRouting: "Roteamento Definido",
    internalRoutingPrefix: "O resumo interno será enviado para",
    runPreliminaryReview: "Executar Revisão Preliminar",
    reviewing: "Analisando...",
    targetScenarioTitle: "Cenário do Imóvel Desejado",
    targetScenarioText:
      "Agora informe o valor estimado do imóvel e a entrada estimada para que Finley Beyond continue o cenário com os números que você realmente está considerando.",
    homePrice: "Valor Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    estimatedLoanAmount: "Valor Estimado do Empréstimo",
    continueScenario: "Continuar com Este Cenário",
    updatingScenario: "Atualizando Cenário...",
    financialSnapshot: "Resumo Financeiro",
    estimatedLtv: "LTV Estimado",
    conversationTitle: "Conversa com Finley",
    placeholderConversation:
      "Complete as informações e execute a revisão preliminar para iniciar a conversa com Finley Beyond.",
    continueChatting: "Continue conversando com Finley Beyond",
    chatPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta de qualificação do Finley.",
    sendMessage: "Enviar Mensagem",
    sending: "Enviando...",
    applyNow: "Aplicar Agora",
    scheduleLoanOfficer: "Agendar com o Loan Officer",
    emailLoanOfficer: "Enviar Email ao Loan Officer",
    actionTitle: "Próximos Passos",
    loanOfficerNotFound:
      "Loan Officer não encontrado. Selecione um dos nomes sugeridos ou use a opção padrão.",
    summaryFailed:
      "A conversa continuou, mas o resumo interno não pôde ser enviado.",
  },
  es: {
    heroTitle: "Finley Beyond impulsado por Beyond Intelligence™",
    heroText:
      "Sistema de orientación hipotecaria con IA supervisado por un Certified Mortgage Advisor.",
    languageLabel: "Idioma",
    disclaimerTitle: "Aviso Requerido",
    disclaimerText:
      "Este sistema proporciona únicamente orientación preliminar. No constituye aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, asesoría fiscal ni determinación final de elegibilidad de programa. Todos los escenarios deben ser revisados y confirmados de manera independiente por un loan officer con licencia utilizando las guías actuales de inversionistas, overlays y requisitos del programa.",
    acceptText:
      "Reconozco y acepto este aviso antes de usar el sistema.",
    intakeTitle: "Información del Cliente",
    intakeLocked:
      "La sección de información permanece bloqueada hasta que se acepte el aviso.",
    borrowerName: "Nombre del Cliente",
    email: "Correo Electrónico",
    phone: "Teléfono",
    credit: "Puntaje de Crédito Estimado",
    income: "Ingreso Bruto Mensual",
    debt: "Deuda Mensual",
    loanOfficer: "Nombre del Loan Officer o NMLS #",
    loanOfficerPlaceholder: "Escriba el nombre del loan officer o el NMLS #",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "No Conozco Mi Loan Officer",
    assignedRouting: "Asignación Definida",
    internalRoutingPrefix: "El resumen interno se enviará a",
    runPreliminaryReview: "Ejecutar Revisión Preliminar",
    reviewing: "Revisando...",
    targetScenarioTitle: "Escenario del Inmueble Deseado",
    targetScenarioText:
      "Ahora ingrese el precio estimado de la vivienda y el pago inicial estimado para que Finley Beyond continúe el escenario con las cifras que realmente está considerando.",
    homePrice: "Precio Estimado de la Vivienda",
    downPayment: "Pago Inicial Estimado",
    estimatedLoanAmount: "Monto Estimado del Préstamo",
    continueScenario: "Continuar con Este Escenario",
    updatingScenario: "Actualizando Escenario...",
    financialSnapshot: "Resumen Financiero",
    estimatedLtv: "LTV Estimado",
    conversationTitle: "Conversación con Finley",
    placeholderConversation:
      "Complete la información y ejecute la revisión preliminar para comenzar la conversación con Finley Beyond.",
    continueChatting: "Continúe conversando con Finley Beyond",
    chatPlaceholder:
      "Haga una pregunta o responda la siguiente pregunta de calificación de Finley.",
    sendMessage: "Enviar Mensaje",
    sending: "Enviando...",
    applyNow: "Aplicar Ahora",
    scheduleLoanOfficer: "Agendar con el Loan Officer",
    emailLoanOfficer: "Enviar Correo al Loan Officer",
    actionTitle: "Próximos Pasos",
    loanOfficerNotFound:
      "Loan Officer no encontrado. Seleccione uno de los nombres sugeridos o use la opción predeterminada.",
    summaryFailed:
      "La conversación continuó, pero no se pudo enviar el resumen interno.",
  },
} as const;

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function extractAiText(data: unknown): string {
  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null) {
    const obj = data as {
      choices?: Array<{ message?: { content?: string } }>;
      reply?: string;
      message?: string;
      response?: string;
      content?: string;
      text?: string;
      error?: string;
    };

    return (
      obj.choices?.[0]?.message?.content ||
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
      obj.error ||
      JSON.stringify(obj, null, 2)
    );
  }

  return "";
}

function resolveOfficerFromQuery(query: string): LoanOfficerRecord | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;

  const exact = LOAN_OFFICERS.find(
    (officer) =>
      officer.name.toLowerCase() === trimmed ||
      officer.nmls.toLowerCase() === trimmed
  );

  if (exact) return exact;

  const partial = LOAN_OFFICERS.find(
    (officer) =>
      officer.name.toLowerCase().includes(trimmed) ||
      officer.nmls.toLowerCase().includes(trimmed)
  );

  return partial || null;
}

export default function Page() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scenarioUnlocked, setScenarioUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);

  const [loanOfficerQuery, setLoanOfficerQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] =
    useState<LoanOfficerRecord | null>(null);

  const [intakeForm, setIntakeForm] = useState<IntakeFormState>({
    name: "",
    email: "",
    phone: "",
    credit: "",
    income: "",
    debt: "",
  });

  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>({
    homePrice: "",
    downPayment: "",
  });

  const t = COPY[language];

  const officerSuggestions = useMemo(() => {
    const query = loanOfficerQuery.trim().toLowerCase();
    if (!query || selectedOfficer) return [];

    return LOAN_OFFICERS.filter(
      (officer) =>
        officer.name.toLowerCase().includes(query) ||
        officer.nmls.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [loanOfficerQuery, selectedOfficer]);

  const setIntakeField = (key: keyof IntakeFormState, value: string) => {
    setIntakeForm((prev) => ({ ...prev, [key]: value }));
  };

  const setScenarioField = (key: keyof ScenarioFormState, value: string) => {
    setScenarioForm((prev) => ({ ...prev, [key]: value }));
  };

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(scenarioForm.homePrice) || 0;
    const downPayment = Number(scenarioForm.downPayment) || 0;
    return Math.max(homePrice - downPayment, 0);
  }, [scenarioForm]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenarioForm.homePrice) || 0;
    if (homePrice <= 0) return 0;
    return estimatedLoanAmount / homePrice;
  }, [scenarioForm, estimatedLoanAmount]);

  const activeOfficer = selectedOfficer || DEFAULT_LOAN_OFFICER;

  const getPreferredLanguageLabel = () => {
    if (language === "pt") return "Português";
    if (language === "es") return "Español";
    return "English";
  };

  const buildBorrowerContext = () => {
    return `
Borrower profile for context:
- Preferred language: ${language}
- Name: ${intakeForm.name
