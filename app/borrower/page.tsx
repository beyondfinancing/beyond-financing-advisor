"use client";

import React, { useMemo, useState } from "react";

type LanguageCode = "en" | "pt" | "es";
type LoanPurpose = "purchase" | "refinance" | "investment";
type RealtorStatus = "yes" | "no" | "not_sure";
type OccupancyType =
  | "Primary residence"
  | "Second home"
  | "Investment property";

type IntakeFormState = {
  name: string;
  email: string;
  phone: string;
  credit: string;
  income: string;
  debt: string;
  currentState: string;
  targetState: string;
};

type ScenarioFormState = {
  homePrice: string;
  downPayment: string;
  occupancy: OccupancyType;
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
  summaryKey: "sandro" | "warren" | "finley";
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
    heroTitle: "Borrower / Client Workspace",
    heroText: "Start your guided mortgage conversation with Finley Beyond.",
    backHome: "Back to Beyond Intelligence",
    languageLabel: "Language",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, title, appraisal, and current investor or agency guidelines.",
    acceptText: "I acknowledge and accept this disclaimer.",
    purposePurchase: "Purchase",
    purposeRefinance: "Refinance",
    purposeInvestment: "Investment",
    borrowerName: "Borrower Name",
    borrowerEmail: "Email",
    borrowerPhone: "Phone",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt Obligations",
    currentState: "Current State",
    targetState: "Target Property State",
    workingWithRealtor: "Are you working with a Realtor?",
    yes: "Yes",
    no: "No",
    notSure: "Not Sure",
    loanOfficer: "Loan Officer Name or NMLS #",
    confirmLoanOfficer: "Confirm Loan Officer",
    unknownLoanOfficer: "I Do Not Know My Loan Officer",
    assignedRouting: "Assigned Routing",
    internalSummaryRoutesTo: "Internal summary will route to",
    runReview: "Run Preliminary Review",
    reviewing: "Reviewing...",
    conversationTitle: "Conversation with Finley Beyond",
    placeholderConversation:
      "I am ready to begin the preliminary review.",
    chatPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
    sendMessage: "Send Message",
    sending: "Sending...",
    propertyScenario: "Property Scenario",
    homePrice: "Estimated Property Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    estimatedLoanAmount: "Estimated Loan Amount",
    estimatedLtv: "Estimated LTV",
    continueScenario: "Continue with This Scenario",
    updatingScenario: "Updating Scenario...",
    actionTitle: "Next Actions",
    applyNow: "Apply Now",
    scheduleLoanOfficer: "Schedule with Loan Officer",
    emailLoanOfficer: "Email Loan Officer",
    sendingSummary: "Sending Summary...",
    internalDirection: "Internal Scenario Direction",
    internalDirectionText:
      "This section reflects Finley Beyond’s internal matching direction and is used to guide the conversation and routing.",
    likelyDirection: "Likely Direction",
    nextBestQuestion: "Next Best Question",
    strong: "Strong",
    conditional: "Conditional",
    eliminated: "Eliminated",
    lenderCoverage: "Lender Coverage",
    readyFallback:
      "Thank you. We already have a meaningful preliminary snapshot of your scenario.",
    persuasiveFallback:
      "You are welcome to continue answering a few more questions so we can organize the file more clearly for your assigned loan officer. If you prefer not to continue right now, you may still click Apply Now. The information you have already provided will still be sent in summary form so your assigned loan officer can continue the process with you directly.",
  },
  pt: {
    heroTitle: "Área do Cliente / Borrower",
    heroText: "Inicie sua conversa hipotecária guiada com Finley Beyond.",
    backHome: "Voltar para Beyond Intelligence",
    languageLabel: "Idioma",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimerText:
      "Este sistema fornece apenas orientação preliminar. Não constitui aprovação de empréstimo, decisão de underwriting, compromisso de conceder crédito, aconselhamento jurídico, fiscal ou determinação final de programa. Todos os cenários permanecem sujeitos à revisão de um loan officer licenciado, documentação, verificação, underwriting, título, appraisal e diretrizes atuais de investidores ou agências.",
    acceptText: "Reconheço e aceito este aviso.",
    purposePurchase: "Compra",
    purposeRefinance: "Refinanciamento",
    purposeInvestment: "Investimento",
    borrowerName: "Nome do Cliente",
    borrowerEmail: "Email",
    borrowerPhone: "Telefone",
    credit: "Pontuação de Crédito Estimada",
    income: "Renda Bruta Mensal",
    debt: "Dívidas Mensais",
    currentState: "Estado Atual",
    targetState: "Estado do Imóvel",
    workingWithRealtor: "Você está trabalhando com um Realtor?",
    yes: "Sim",
    no: "Não",
    notSure: "Não Tenho Certeza",
    loanOfficer: "Nome do Loan Officer ou NMLS #",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "Não Sei Meu Loan Officer",
    assignedRouting: "Roteamento Definido",
    internalSummaryRoutesTo: "O resumo interno será enviado para",
    runReview: "Executar Revisão Preliminar",
    reviewing: "Analisando...",
    conversationTitle: "Conversa com Finley Beyond",
    placeholderConversation: "Estou pronto para iniciar a revisão preliminar.",
    chatPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta do Finley Beyond.",
    sendMessage: "Enviar Mensagem",
    sending: "Enviando...",
    propertyScenario: "Cenário do Imóvel",
    homePrice: "Preço Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    occupancy: "Ocupação",
    estimatedLoanAmount: "Valor Estimado do Empréstimo",
    estimatedLtv: "LTV Estimado",
    continueScenario: "Continuar com Este Cenário",
    updatingScenario: "Atualizando Cenário...",
    actionTitle: "Próximos Passos",
    applyNow: "Aplicar Agora",
    scheduleLoanOfficer: "Agendar com o Loan Officer",
    emailLoanOfficer: "Enviar Email ao Loan Officer",
    sendingSummary: "Enviando Resumo...",
    internalDirection: "Direção Interna do Cenário",
    internalDirectionText:
      "Esta seção reflete a direção interna do Finley Beyond e é usada para orientar a conversa e o roteamento.",
    likelyDirection: "Direção Provável",
    nextBestQuestion: "Próxima Melhor Pergunta",
    strong: "Fortes",
    conditional: "Condicionais",
    eliminated: "Eliminados",
    lenderCoverage: "Cobertura de Lenders",
    readyFallback:
      "Obrigado. Já temos um retrato preliminar significativo do seu cenário.",
    persuasiveFallback:
      "Você pode continuar respondendo mais algumas perguntas para organizarmos o arquivo com mais clareza para o loan officer designado. Se preferir não continuar agora, ainda assim pode clicar em Aplicar Agora. As informações já fornecidas serão enviadas em formato de resumo para que o loan officer designado continue o processo diretamente com você.",
  },
  es: {
    heroTitle: "Espacio del Cliente / Borrower",
    heroText: "Inicie su conversación hipotecaria guiada con Finley Beyond.",
    backHome: "Volver a Beyond Intelligence",
    languageLabel: "Idioma",
    disclaimerTitle: "Aviso Requerido",
    disclaimerText:
      "Este sistema proporciona únicamente orientación preliminar. No constituye aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, fiscal ni determinación final del programa. Todos los escenarios siguen sujetos a la revisión de un loan officer con licencia, documentación, verificación, underwriting, título, appraisal y guías actuales de inversionistas o agencias.",
    acceptText: "Reconozco y acepto este aviso.",
    purposePurchase: "Compra",
    purposeRefinance: "Refinanciación",
    purposeInvestment: "Inversión",
    borrowerName: "Nombre del Cliente",
    borrowerEmail: "Correo Electrónico",
    borrowerPhone: "Teléfono",
    credit: "Puntaje de Crédito Estimado",
    income: "Ingreso Bruto Mensual",
    debt: "Deudas Mensuales",
    currentState: "Estado Actual",
    targetState: "Estado de la Propiedad",
    workingWithRealtor: "¿Está trabajando con un Realtor?",
    yes: "Sí",
    no: "No",
    notSure: "No Estoy Seguro",
    loanOfficer: "Nombre del Loan Officer o NMLS #",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "No Conozco Mi Loan Officer",
    assignedRouting: "Asignación Definida",
    internalSummaryRoutesTo: "El resumen interno se enviará a",
    runReview: "Ejecutar Revisión Preliminar",
    reviewing: "Revisando...",
    conversationTitle: "Conversación con Finley Beyond",
    placeholderConversation: "Estoy listo para comenzar la revisión preliminar.",
    chatPlaceholder:
      "Haga una pregunta o responda la siguiente pregunta de Finley Beyond.",
    sendMessage: "Enviar Mensaje",
    sending: "Enviando...",
    propertyScenario: "Escenario de la Propiedad",
    homePrice: "Precio Estimado de la Propiedad",
    downPayment: "Pago Inicial Estimado",
    occupancy: "Ocupación",
    estimatedLoanAmount: "Monto Estimado del Préstamo",
    estimatedLtv: "LTV Estimado",
    continueScenario: "Continuar con Este Escenario",
    updatingScenario: "Actualizando Escenario...",
    actionTitle: "Próximos Pasos",
    applyNow: "Aplicar Ahora",
    scheduleLoanOfficer: "Agendar con el Loan Officer",
    emailLoanOfficer: "Enviar Correo al Loan Officer",
    sendingSummary: "Enviando Resumen...",
    internalDirection: "Dirección Interna del Escenario",
    internalDirectionText:
      "Esta sección refleja la dirección interna de Finley Beyond y se utiliza para guiar la conversación y el enrutamiento.",
    likelyDirection: "Dirección Probable",
    nextBestQuestion: "Siguiente Mejor Pregunta",
    strong: "Fuertes",
    conditional: "Condicionales",
    eliminated: "Eliminados",
    lenderCoverage: "Cobertura de Lenders",
    readyFallback:
      "Gracias. Ya tenemos una visión preliminar significativa de su escenario.",
    persuasiveFallback:
      "Puede seguir respondiendo algunas preguntas más para que organicemos el archivo con mayor claridad para el loan officer asignado. Si prefiere no continuar ahora, todavía puede hacer clic en Aplicar Ahora. La información que ya proporcionó se enviará en forma de resumen para que el loan officer asignado continúe el proceso directamente con usted.",
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

function extractAiText(data: unknown): string {
  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null) {
    const obj = data as {
      reply?: string;
      message?: string;
      response?: string;
      content?: string;
      text?: string;
      error?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

    return (
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
      obj.error ||
      obj.choices?.[0]?.message?.content ||
      ""
    );
  }

  return "";
}

function normalizeState(value: string) {
  return value.trim().toUpperCase();
}

export default function BorrowerPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scenarioUnlocked, setScenarioUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [loanPurpose, setLoanPurpose] = useState<LoanPurpose>("purchase");
  const [realtorStatus, setRealtorStatus] = useState<RealtorStatus>("no");
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
    currentState: "",
    targetState: "",
  });

  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>({
    homePrice: "",
    downPayment: "",
    occupancy: "Primary residence",
  });

  const t = COPY[language];
  const activeOfficer = selectedOfficer || DEFAULT_LOAN_OFFICER;

  const officerSuggestions = useMemo(() => {
    const query = loanOfficerQuery.trim().toLowerCase();
    if (!query || selectedOfficer) return [];

    return LOAN_OFFICERS.filter(
      (officer) =>
        officer.name.toLowerCase().includes(query) ||
        officer.nmls.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [loanOfficerQuery, selectedOfficer]);

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(scenarioForm.homePrice) || 0;
    const downPayment = Number(scenarioForm.downPayment) || 0;
    return Math.max(homePrice - downPayment, 0);
  }, [scenarioForm.homePrice, scenarioForm.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenarioForm.homePrice) || 0;
    if (homePrice <= 0) return 0;
    return estimatedLoanAmount / homePrice;
  }, [scenarioForm.homePrice, estimatedLoanAmount]);

  const setIntakeField = (key: keyof IntakeFormState, value: string) => {
    setIntakeForm((prev) => ({
      ...prev,
      [key]:
        key === "currentState" || key === "targetState"
          ? normalizeState(value)
          : value,
    }));
  };

  const setScenarioField = (key: keyof ScenarioFormState, value: string) => {
    setScenarioForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getCollectedFacts = () => {
    const facts = {
      borrowerName: intakeForm.name.trim(),
      borrowerEmail: intakeForm.email.trim(),
      borrowerPhone: intakeForm.phone.trim(),
      credit: intakeForm.credit.trim(),
      income: intakeForm.income.trim(),
      debt: intakeForm.debt.trim(),
      currentState: intakeForm.currentState.trim(),
      targetState: intakeForm.targetState.trim(),
      homePrice: scenarioForm.homePrice.trim(),
      downPayment: scenarioForm.downPayment.trim(),
      occupancy: scenarioForm.occupancy.trim(),
      purpose: loanPurpose,
      realtorStatus,
      loanOfficerName: activeOfficer.name,
      loanOfficerNmls: activeOfficer.nmls,
    };

    return facts;
  };

  const getMissingItems = () => {
    const facts = getCollectedFacts();
    const missing: string[] = [];

    if (!facts.borrowerName) missing.push("borrower name");
    if (!facts.borrowerEmail) missing.push("borrower email");
    if (!facts.borrowerPhone) missing.push("borrower phone");
    if (!facts.credit) missing.push("estimated credit score");
    if (!facts.income) missing.push("gross monthly income");
    if (!facts.debt) missing.push("monthly debt obligations");
    if (!facts.currentState) missing.push("current residence state");
    if (!facts.targetState) missing.push("subject property state");
    if (!facts.homePrice) missing.push("estimated property price");
    if (!facts.downPayment) missing.push("estimated down payment");

    return missing;
  };

  const getLocalNextQuestion = () => {
    const missing = getMissingItems();

    if (missing.includes("gross monthly income")) {
      return "What is your gross monthly income?";
    }
    if (missing.includes("monthly debt obligations")) {
      return "What are your total monthly debt payments?";
    }
    if (missing.includes("estimated property price")) {
      return "What is your estimated property price?";
    }
    if (missing.includes("estimated down payment")) {
      return "What is your estimated down payment?";
    }
    if (missing.includes("subject property state")) {
      return "What is the subject property state?";
    }
    if (missing.includes("current residence state")) {
      return "What is your current residence state?";
    }
    if (missing.includes("estimated credit score")) {
      return "What is your estimated credit score?";
    }
    if (missing.includes("borrower phone")) {
      return "What is your best phone number?";
    }

    if (scenarioForm.occupancy === "Primary residence") {
      return "What type of property are you considering for the purchase?";
    }

    return "Have you already completed the application, or would you like to continue answering a few more questions here first?";
  };

  const internalDirection = useMemo(() => {
    const credit = Number(intakeForm.credit) || 0;
    const income = Number(intakeForm.income) || 0;
    const debt = Number(intakeForm.debt) || 0;
    const dti = income > 0 ? debt / income : 0;
    const targetState = intakeForm.targetState.trim();
    const missing = getMissingItems();

    let likelyDirection =
      "Continue qualification conversation and organize the scenario for licensed loan officer review.";
    let strong = 0;
    let conditional = 0;
    let eliminated = 0;

    if (missing.length > 0) {
      likelyDirection =
        "Collect the remaining essential intake information before narrowing the scenario further.";
      conditional = 2;
      eliminated = 0;
    } else if (credit >= 740 && dti <= 0.45) {
      likelyDirection =
        "Strong preliminary consumer profile. Continue with structured intake and licensed loan officer review.";
      strong = 4;
      conditional = 2;
      eliminated = 6;
    } else if (credit >= 680 && dti <= 0.5) {
      likelyDirection =
        "Viable preliminary profile with possible conditional paths depending on full documentation and investor review.";
      strong = 2;
      conditional = 4;
      eliminated = 8;
    } else {
      likelyDirection =
        "Consider alternative mortgage options or programs that accommodate higher DTI ratios or more layered profiles.";
      strong = 0;
      conditional = 3;
      eliminated = 12;
    }

    const lenders: string[] = [];
    if (targetState) lenders.push("First National Bank of America");
    if (credit >= 680 || !credit) lenders.push("ClearEdge Lending");
    if (dti <= 0.5 || !income) lenders.push("FNBA");
    if (!lenders.length) lenders.push("Pending lender review");

    return {
      likelyDirection,
      strong,
      conditional,
      eliminated,
      lenderCoverage: Array.from(new Set(lenders)).join(", "),
      nextBestQuestion: getLocalNextQuestion(),
    };
  }, [
    intakeForm.credit,
    intakeForm.income,
    intakeForm.debt,
    intakeForm.targetState,
    scenarioForm.occupancy,
  ]);

  const buildStructuredContext = () => {
    const facts = getCollectedFacts();
    const missing = getMissingItems();

    return `
Collected borrower facts:
- Borrower name: ${facts.borrowerName || "missing"}
- Borrower email: ${facts.borrowerEmail || "missing"}
- Borrower phone: ${facts.borrowerPhone || "missing"}
- Estimated credit score: ${facts.credit || "missing"}
- Gross monthly income: ${facts.income || "missing"}
- Monthly debt obligations: ${facts.debt || "missing"}
- Current residence state: ${facts.currentState || "missing"}
- Subject property state: ${facts.targetState || "missing"}
- Loan purpose: ${facts.purpose}
- Realtor status: ${facts.realtorStatus}
- Estimated property price: ${facts.homePrice || "missing"}
- Estimated down payment: ${facts.downPayment || "missing"}
- Occupancy: ${facts.occupancy || "missing"}
- Estimated loan amount: ${
      estimatedLoanAmount > 0 ? String(Math.round(estimatedLoanAmount)) : "missing"
    }
- Estimated LTV: ${
      Number(scenarioForm.homePrice) > 0
        ? `${Math.round(estimatedLtv * 100)}%`
        : "missing"
    }
- Assigned loan officer: ${facts.loanOfficerName}
- Assigned loan officer NMLS: ${facts.loanOfficerNmls}

Missing items:
${
  missing.length > 0
    ? missing.map((item) => `- ${item}`).join("\n")
    : "- none"
}

Conversation behavior requirements:
- Treat any field above that has a value as already disclosed.
- Do not ask again for any field that already has a value.
- Ask only one missing item at a time.
- If there are no major missing items, move to a more advanced and useful next-step question.
- Keep the borrower engaged politely and persuasively.
- If the borrower does not want to continue providing more information, use this constructive fallback idea:
"${t.readyFallback} ${t.persuasiveFallback}"
- Do not promise approval.
- Do not provide personalized rates.
- Do not guarantee a specific program.
- Refer final qualification and loan structure decisions to the assigned licensed loan officer.
- Respond in ${
      language === "pt"
        ? "Portuguese"
        : language === "es"
        ? "Spanish"
        : "English"
    }.
    `.trim();
  };

  const buildRoutingPayload = () => ({
    language,
    loanPurpose,
    realtorStatus,
    selectedOfficer: {
      id: activeOfficer.id,
      name: activeOfficer.name,
      nmls: activeOfficer.nmls,
      email: activeOfficer.email,
      assistantEmail: activeOfficer.assistantEmail,
      mobile: activeOfficer.mobile,
      assistantMobile: activeOfficer.assistantMobile,
      applyUrl: activeOfficer.applyUrl,
      scheduleUrl: activeOfficer.scheduleUrl,
    },
    borrower: {
      name: intakeForm.name,
      email: intakeForm.email,
      phone: intakeForm.phone,
      credit: intakeForm.credit,
      income: intakeForm.income,
      debt: intakeForm.debt,
      currentState: intakeForm.currentState,
      targetState: intakeForm.targetState,
    },
    scenario: {
      homePrice: scenarioForm.homePrice,
      downPayment: scenarioForm.downPayment,
      occupancy: scenarioForm.occupancy,
      estimatedLoanAmount: String(estimatedLoanAmount || ""),
      estimatedLtv:
        Number(scenarioForm.homePrice) > 0
          ? `${Math.round(estimatedLtv * 100)}%`
          : "",
    },
    conversation,
    nextBestQuestion: internalDirection.nextBestQuestion,
    internalDirection: internalDirection.likelyDirection,
  });

  const confirmOfficerSelection = () => {
    const matched = resolveOfficerFromQuery(loanOfficerQuery);
    if (matched) {
      setSelectedOfficer(matched);
      setLoanOfficerQuery(`${matched.name} — NMLS ${matched.nmls}`);
    } else {
      setSelectedOfficer(DEFAULT_LOAN_OFFICER);
      setLoanOfficerQuery(
        `${DEFAULT_LOAN_OFFICER.name} — NMLS ${DEFAULT_LOAN_OFFICER.nmls}`
      );
    }
  };

  const useDefaultFinley = () => {
    setSelectedOfficer(DEFAULT_LOAN_OFFICER);
    setLoanOfficerQuery(
      `${DEFAULT_LOAN_OFFICER.name} — NMLS ${DEFAULT_LOAN_OFFICER.nmls}`
    );
  };

  const runPreliminaryReview = async () => {
    setSubmitted(true);
    setLoading(true);
    setErrorMessage("");
    setChatError("");
    setConversation([]);

    const resolvedOfficer =
      selectedOfficer ||
      resolveOfficerFromQuery(loanOfficerQuery) ||
      DEFAULT_LOAN_OFFICER;

    if (!selectedOfficer || selectedOfficer.id !== resolvedOfficer.id) {
      setSelectedOfficer(resolvedOfficer);
      setLoanOfficerQuery(`${resolvedOfficer.name} — NMLS ${resolvedOfficer.nmls}`);
    }

    try {
      const prompt = `
${buildStructuredContext()}

Start the borrower conversation as a polished mortgage assistant.
Acknowledge only the information already provided.
Do not repeat questions for already completed fields.
If essential information is still missing, ask for only the single most important missing item.
If enough information is already present, transition to a more advanced next-step question.
Use a polite, persuasive tone and encourage Apply Now without sounding pushy.
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "initial_review",
          routing: {
            ...buildRoutingPayload(),
            selectedOfficer: {
              id: resolvedOfficer.id,
              name: resolvedOfficer.name,
              nmls: resolvedOfficer.nmls,
              email: resolvedOfficer.email,
              assistantEmail: resolvedOfficer.assistantEmail,
              mobile: resolvedOfficer.mobile,
              assistantMobile: resolvedOfficer.assistantMobile,
              applyUrl: resolvedOfficer.applyUrl,
              scheduleUrl: resolvedOfficer.scheduleUrl,
            },
          },
          messages: [
            {
              role: "user",
              content:
                conversation.length > 0 ? conversation[0].content : t.placeholderConversation,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          extractAiText(data) || "The AI review did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) ||
        `${t.readyFallback} ${t.persuasiveFallback}`;

      setConversation([
        {
          role: "user",
          content: t.placeholderConversation,
        },
        {
          role: "assistant",
          content: finalText,
        },
      ]);
      setScenarioUnlocked(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "There was an error connecting to the AI system.";
      setErrorMessage(message);
      setConversation([]);
      setScenarioUnlocked(false);
    } finally {
      setLoading(false);
    }
  };

  const updateScenarioAndContinue = async () => {
    if (!submitted || !scenarioUnlocked) return;

    setChatLoading(true);
    setChatError("");

    try {
      const prompt = `
${buildStructuredContext()}

The borrower has updated or confirmed the property scenario.
Acknowledge the property price, down payment, and occupancy if already provided.
Do not ask again for any field that already has a value.
If anything essential is still missing, ask only one missing item.
If essentials are already covered, ask a more advanced next-step question such as property type, assets, employment type, or timeline.
Use polite, persuasive wording.
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "scenario_review",
          routing: buildRoutingPayload(),
          messages: [
            ...conversation,
            {
              role: "user",
              content: prompt
