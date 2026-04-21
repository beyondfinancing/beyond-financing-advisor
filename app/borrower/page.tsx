"use client";

import React, { useMemo, useState } from "react";

type LanguageCode = "en" | "pt" | "es";

type IntakeFormState = {
  name: string;
  email: string;
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
  },
];

const DEFAULT_LOAN_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

const COPY = {
  en: {
    heroTitle: "Borrower / Client Workspace",
    heroText: "Start your guided mortgage conversation with Finley Beyond.",
    languageLabel: "Language",
    backHome: "Back to Beyond Intelligence",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, title, appraisal, and current investor or agency guidelines.",
    acceptText: "I acknowledge and accept this disclaimer.",
    purchase: "Purchase",
    refinance: "Refinance",
    investment: "Investment",
    borrowerName: "Borrower Name",
    email: "Email",
    phone: "Phone Number",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt",
    currentState: "State You Live In Now",
    targetState: "State You Are Looking to Move Into",
    realtorQuestion: "Are you working with a Realtor?",
    yes: "Yes",
    no: "No",
    notSure: "Not Sure",
    loanOfficerPlaceholder: "Type loan officer name or NMLS #",
    loanOfficerHint: "Start typing to see matching loan officers.",
    confirmLoanOfficer: "Confirm Loan Officer",
    unknownLoanOfficer: "I Do Not Know My Loan Officer",
    assignedRouting: "Assigned Routing",
    routingLine: "Internal summary will route to",
    runPreliminaryReview: "Run Preliminary Review",
    reviewing: "Reviewing...",
    scenarioTitle: "Property Scenario",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    estimatedLoanAmount: "Estimated Loan Amount",
    estimatedLtv: "Estimated LTV",
    continueScenario: "Continue with This Scenario",
    updatingScenario: "Updating Scenario...",
    conversationTitle: "Conversation with Finley Beyond",
    conversationPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
    sendMessage: "Send Message",
    sending: "Sending...",
    scenarioDirectionTitle: "Internal Scenario Direction",
    scenarioDirectionPlaceholder:
      "Run the preliminary review to generate internal match direction.",
    scenarioDirectionText:
      "This section reflects Finley Beyond’s internal matching direction and is used to guide the conversation and routing.",
    nextActions: "Next Actions",
    applyNow: "Apply Now",
    scheduleLoanOfficer: "Schedule with Loan Officer",
    emailLoanOfficer: "Email Loan Officer",
    callLoanOfficer: "Call Loan Officer",
  },
  pt: {
    heroTitle: "Workspace do Cliente / Borrower",
    heroText: "Inicie sua conversa guiada sobre financiamento com Finley Beyond.",
    languageLabel: "Idioma",
    backHome: "Voltar para Beyond Intelligence",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimerText:
      "Este sistema fornece apenas orientação preliminar. Não é aprovação de empréstimo, decisão de underwriting, compromisso de concessão, aconselhamento jurídico, aconselhamento fiscal ou determinação final de programa. Todos os cenários permanecem sujeitos à revisão do loan officer licenciado, documentação, verificação, underwriting, title, appraisal e diretrizes atuais de investidores ou agências.",
    acceptText: "Reconheço e aceito este aviso.",
    purchase: "Compra",
    refinance: "Refinanciamento",
    investment: "Investimento",
    borrowerName: "Nome do Cliente",
    email: "Email",
    phone: "Telefone",
    credit: "Pontuação de Crédito Estimada",
    income: "Renda Bruta Mensal",
    debt: "Dívida Mensal",
    currentState: "Estado Onde Você Mora Hoje",
    targetState: "Estado Para Onde Deseja Ir",
    realtorQuestion: "Você está trabalhando com um Corretor?",
    yes: "Sim",
    no: "Não",
    notSure: "Não Tenho Certeza",
    loanOfficerPlaceholder: "Digite o nome do loan officer ou NMLS #",
    loanOfficerHint: "Comece a digitar para ver loan officers correspondentes.",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "Não Sei Meu Loan Officer",
    assignedRouting: "Roteamento Definido",
    routingLine: "O resumo interno será enviado para",
    runPreliminaryReview: "Executar Revisão Preliminar",
    reviewing: "Analisando...",
    scenarioTitle: "Cenário do Imóvel",
    homePrice: "Valor Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    occupancy: "Ocupação",
    estimatedLoanAmount: "Valor Estimado do Empréstimo",
    estimatedLtv: "LTV Estimado",
    continueScenario: "Continuar com Este Cenário",
    updatingScenario: "Atualizando Cenário...",
    conversationTitle: "Conversa com Finley Beyond",
    conversationPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta hipotecária do Finley Beyond.",
    sendMessage: "Enviar Mensagem",
    sending: "Enviando...",
    scenarioDirectionTitle: "Direção Interna do Cenário",
    scenarioDirectionPlaceholder:
      "Execute a revisão preliminar para gerar a direção interna de matching.",
    scenarioDirectionText:
      "Esta seção reflete a direção interna de matching do Finley Beyond e é usada para orientar a conversa e o roteamento.",
    nextActions: "Próximos Passos",
    applyNow: "Aplicar Agora",
    scheduleLoanOfficer: "Agendar com o Loan Officer",
    emailLoanOfficer: "Enviar Email ao Loan Officer",
    callLoanOfficer: "Ligar para o Loan Officer",
  },
  es: {
    heroTitle: "Workspace del Borrower / Cliente",
    heroText: "Comience su conversación guiada de hipoteca con Finley Beyond.",
    languageLabel: "Idioma",
    backHome: "Volver a Beyond Intelligence",
    disclaimerTitle: "Aviso Requerido",
    disclaimerText:
      "Este sistema proporciona únicamente orientación preliminar. No es una aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, asesoría fiscal ni determinación final del programa. Todos los escenarios siguen sujetos a revisión del loan officer con licencia, documentación, verificación, underwriting, title, appraisal y guías actuales de inversionistas o agencias.",
    acceptText: "Reconozco y acepto este aviso.",
    purchase: "Compra",
    refinance: "Refinanciamiento",
    investment: "Inversión",
    borrowerName: "Nombre del Cliente",
    email: "Correo Electrónico",
    phone: "Número de Teléfono",
    credit: "Puntaje de Crédito Estimado",
    income: "Ingreso Bruto Mensual",
    debt: "Deuda Mensual",
    currentState: "Estado Donde Vive Ahora",
    targetState: "Estado al que Desea Mudarse",
    realtorQuestion: "¿Está trabajando con un Realtor?",
    yes: "Sí",
    no: "No",
    notSure: "No Estoy Seguro",
    loanOfficerPlaceholder: "Escriba el nombre del loan officer o NMLS #",
    loanOfficerHint: "Comience a escribir para ver loan officers coincidentes.",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "No Conozco Mi Loan Officer",
    assignedRouting: "Asignación Definida",
    routingLine: "El resumen interno se enviará a",
    runPreliminaryReview: "Ejecutar Revisión Preliminar",
    reviewing: "Revisando...",
    scenarioTitle: "Escenario de la Propiedad",
    homePrice: "Precio Estimado de la Vivienda",
    downPayment: "Pago Inicial Estimado",
    occupancy: "Ocupación",
    estimatedLoanAmount: "Monto Estimado del Préstamo",
    estimatedLtv: "LTV Estimado",
    continueScenario: "Continuar con Este Escenario",
    updatingScenario: "Actualizando Escenario...",
    conversationTitle: "Conversación con Finley Beyond",
    conversationPlaceholder:
      "Haga una pregunta o responda la próxima pregunta hipotecaria de Finley Beyond.",
    sendMessage: "Enviar Mensaje",
    sending: "Enviando...",
    scenarioDirectionTitle: "Dirección Interna del Escenario",
    scenarioDirectionPlaceholder:
      "Ejecute la revisión preliminar para generar la dirección interna de matching.",
    scenarioDirectionText:
      "Esta sección refleja la dirección interna de matching de Finley Beyond y se utiliza para orientar la conversación y el enrutamiento.",
    nextActions: "Próximas Acciones",
    applyNow: "Aplicar Ahora",
    scheduleLoanOfficer: "Agendar con el Loan Officer",
    emailLoanOfficer: "Enviar Correo al Loan Officer",
    callLoanOfficer: "Llamar al Loan Officer",
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

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 10)}`;
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
      nextQuestion?: string;
      internalDirection?: string;
    };

    return (
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
      obj.nextQuestion ||
      obj.internalDirection ||
      obj.choices?.[0]?.message?.content ||
      ""
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

  return (
    LOAN_OFFICERS.find(
      (officer) =>
        officer.name.toLowerCase().includes(trimmed) ||
        officer.nmls.toLowerCase().includes(trimmed)
    ) || null
  );
}

function getRealtorStatusLabel(
  realtorStatus: "yes" | "no" | "not_sure",
  language: LanguageCode
) {
  if (language === "pt") {
    if (realtorStatus === "yes") return "Sim";
    if (realtorStatus === "no") return "Não";
    return "Não Tenho Certeza";
  }

  if (language === "es") {
    if (realtorStatus === "yes") return "Sí";
    if (realtorStatus === "no") return "No";
    return "No Estoy Seguro";
  }

  if (realtorStatus === "yes") return "Yes";
  if (realtorStatus === "no") return "No";
  return "Not Sure";
}

export default function BorrowerPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [accepted, setAccepted] = useState(false);
  const [transactionType, setTransactionType] = useState<
    "purchase" | "refinance" | "investment"
  >("purchase");
  const [realtorStatus, setRealtorStatus] = useState<"yes" | "no" | "not_sure">(
    "not_sure"
  );
  const [borrowerName, setBorrowerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [credit, setCredit] = useState("");
  const [income, setIncome] = useState("");
  const [debt, setDebt] = useState("");
  const [currentState, setCurrentState] = useState("");
  const [targetState, setTargetState] = useState("");
  const [loanOfficerQuery, setLoanOfficerQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] =
    useState<LoanOfficerRecord | null>(DEFAULT_LOAN_OFFICER);
  const [homePrice, setHomePrice] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [occupancy, setOccupancy] = useState("");
  const [scenarioDirection, setScenarioDirection] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const t = COPY[language];

  const officerSuggestions = useMemo(() => {
    const query = loanOfficerQuery.trim().toLowerCase();
    if (!query) return [];
    return LOAN_OFFICERS.filter(
      (officer) =>
        officer.name.toLowerCase().includes(query) ||
        officer.nmls.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [loanOfficerQuery]);

  const estimatedLoanAmount = useMemo(() => {
    const price = Number(homePrice) || 0;
    const down = Number(downPayment) || 0;
    return Math.max(price - down, 0);
  }, [homePrice, downPayment]);

  const estimatedLtv = useMemo(() => {
    const price = Number(homePrice) || 0;
    if (price <= 0) return "";
    return `${Math.round((estimatedLoanAmount / price) * 100)}%`;
  }, [estimatedLoanAmount, homePrice]);

  const activeOfficer =
    selectedOfficer ||
    resolveOfficerFromQuery(loanOfficerQuery) ||
    DEFAULT_LOAN_OFFICER;
  
  const buildRoutingPayload = () => ({
    language,
    transactionType,
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
      name: borrowerName,
      email,
      phone,
      credit,
      income,
      debt,
      currentState,
      targetState,
    },
    scenario: {
      homePrice,
      downPayment,
      occupancy,
      estimatedLoanAmount: String(estimatedLoanAmount || ""),
      estimatedLtv,
    },
    conversation,
  });

  const sendBorrowerSummary = async (trigger: SummaryTrigger) => {
    const officerForSummary =
      activeOfficer.id === "sandro-pansini-souza"
        ? "sandro"
        : activeOfficer.id === "warren-wendt"
        ? "warren"
        : "finley";

    const realtorLabel = getRealtorStatusLabel(realtorStatus, language);

    await fetch("/api/chat-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead: {
          fullName: borrowerName,
          email,
          phone,
          preferredLanguage:
            language === "pt"
              ? "Português"
              : language === "es"
              ? "Español"
              : "English",
          loanOfficer: officerForSummary,
          assignedEmail: activeOfficer.email,
          realtorName: `Realtor Status: ${realtorLabel}`,
          realtorPhone: "",
        },
        trigger,
        messages: [
          ...conversation,
          {
            role: "user",
            content: `Borrower intake summary:
Transaction Type: ${transactionType}
Realtor Status: ${realtorLabel}
Selected Loan Officer: ${activeOfficer.name} — NMLS ${activeOfficer.nmls}
Current State: ${currentState || "Not provided"}
Target State: ${targetState || "Not provided"}
Estimated Credit Score: ${credit || "Not provided"}
Gross Monthly Income: ${income || "Not provided"}
Monthly Debt: ${debt || "Not provided"}
Home Price: ${homePrice || "Not provided"}
Down Payment: ${downPayment || "Not provided"}
Occupancy: ${occupancy || "Not provided"}
Estimated Loan Amount: ${
              estimatedLoanAmount ? String(estimatedLoanAmount) : "Not provided"
            }
Estimated LTV: ${estimatedLtv || "Not provided"}`,
          },
        ],
      }),
    });
  };

  const runPreliminaryReview = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "initial_review",
          routing: buildRoutingPayload(),
          messages: [
            {
              role: "user",
              content: `Please begin the borrower-facing mortgage conversation in ${language}.`,
            },
          ],
        }),
      });

      const data = await response.json();
      const reply =
        extractAiText(data) ||
        "Thank you. I will organize this scenario for your loan officer and guide the next steps.";

      setScenarioDirection(
        data?.internalDirection ||
          "Preliminary review completed. Internal match direction generated."
      );
      setConversation([{ role: "assistant", content: reply }]);
    } catch {
      setScenarioDirection(
        "Preliminary review completed. Internal match direction generated."
      );
      setConversation([
        {
          role: "assistant",
          content:
            "Thank you for sharing this initial information. I will organize this scenario for your loan officer and guide the next steps.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const continueScenario = async () => {
    setChatLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "scenario_review",
          routing: buildRoutingPayload(),
          messages: [
            {
              role: "user",
              content: `The borrower updated the property scenario. Continue in ${language}.`,
            },
          ],
        }),
      });

      const data = await response.json();
      const reply =
        extractAiText(data) ||
        "I have updated your scenario and will continue organizing this for your loan officer.";

      setConversation((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I have updated your scenario and will continue organizing this for your loan officer.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const nextConversation = [
      ...conversation,
      { role: "user" as const, content: chatInput.trim() },
    ];
    setConversation(nextConversation);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "follow_up",
          routing: { ...buildRoutingPayload(), conversation: nextConversation },
          messages: nextConversation,
        }),
      });

      const data = await response.json();
      const reply =
        extractAiText(data) ||
        "Thank you. I will continue organizing your scenario for review.";

      setConversation((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Thank you. I will continue organizing your scenario for review.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const confirmLoanOfficer = () => {
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

  const useDefaultOfficer = () => {
    setSelectedOfficer(DEFAULT_LOAN_OFFICER);
    setLoanOfficerQuery(
      `${DEFAULT_LOAN_OFFICER.name} — NMLS ${DEFAULT_LOAN_OFFICER.nmls}`
    );
  };

  const emailHref = `mailto:${activeOfficer.email}`;
  const callHref = `tel:${activeOfficer.mobile}`;

  return (
    <main style={styles.page}>
      <div style={styles.pageWrap}>
        <div style={styles.topRow}>
          <div style={styles.badge}>BEYOND INTELLIGENCE™</div>

          <div style={styles.topControls}>
            <label style={styles.languageLabel}>{t.languageLabel}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              style={styles.languageSelect}
            >
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="es">Español</option>
            </select>

            <a href="/" style={styles.backLink}>
              {t.backHome}
            </a>
          </div>
        </div>

        <h1 style={styles.heroTitle}>{t.heroTitle}</h1>
        <p style={styles.heroText}>{t.heroText}</p>

        <div style={styles.mainGrid}>
          <div style={styles.leftColumn}>
            <div style={styles.twoColumnTop}>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>{t.disclaimerTitle}</h2>
                <p style={styles.cardText}>{t.disclaimerText}</p>

                <div style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>{t.acceptText}</span>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.cardTitle}>{t.scenarioDirectionTitle}</h2>
                <p style={styles.cardText}>{t.scenarioDirectionText}</p>
                <div style={styles.directionBox}>
                  {scenarioDirection || t.scenarioDirectionPlaceholder}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.transactionTabs}>
                {[
                  { key: "purchase", label: t.purchase },
                  { key: "refinance", label: t.refinance },
                  { key: "investment", label: t.investment },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() =>
                      setTransactionType(
                        tab.key as "purchase" | "refinance" | "investment"
                      )
                    }
                    style={{
                      ...styles.tabButton,
                      ...(transactionType === tab.key
                        ? styles.tabButtonActive
                        : {}),
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  ...styles.formGrid,
                  opacity: accepted ? 1 : 0.45,
                  pointerEvents: accepted ? "auto" : "none",
                }}
              >
                <input
                  style={styles.input}
                  placeholder={t.borrowerName}
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.phone}
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                />
                <input
                  style={styles.input}
                  placeholder={t.credit}
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.income}
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.debt}
                  value={debt}
                  onChange={(e) => setDebt(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.currentState}
                  value={currentState}
                  onChange={(e) => setCurrentState(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.targetState}
                  value={targetState}
                  onChange={(e) => setTargetState(e.target.value)}
                />
              </div>

              <div style={styles.realtorSection}>
                <div style={styles.realtorLabel}>{t.realtorQuestion}</div>
                <div style={styles.realtorButtons}>
                  <button
                    type="button"
                    onClick={() => setRealtorStatus("yes")}
                    style={{
                      ...styles.smallButton,
                      ...(realtorStatus === "yes" ? styles.smallButtonActive : {}),
                    }}
                  >
                    {t.yes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRealtorStatus("no")}
                    style={{
                      ...styles.smallButton,
                      ...(realtorStatus === "no" ? styles.smallButtonActive : {}),
                    }}
                  >
                    {t.no}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRealtorStatus("not_sure")}
                    style={{
                      ...styles.smallButton,
                      ...(realtorStatus === "not_sure"
                        ? styles.smallButtonActive
                        : {}),
                    }}
                  >
                    {t.notSure}
                  </button>
                </div>
              </div>

              <div style={{ position: "relative", marginTop: 14 }}>
                <input
                  style={styles.input}
                  placeholder={t.loanOfficerPlaceholder}
                  value={loanOfficerQuery}
                  onChange={(e) => {
                    setLoanOfficerQuery(e.target.value);
                  }}
                />
                <div style={styles.helperText}>{t.loanOfficerHint}</div>

                {officerSuggestions.length > 0 && (
                  <div style={styles.suggestionBox}>
                    {officerSuggestions.map((officer) => (
                      <button
                        key={officer.id}
                        type="button"
                        onClick={() => {
                          setSelectedOfficer(officer);
                          setLoanOfficerQuery(
                            `${officer.name} — NMLS ${officer.nmls}`
                          );
                        }}
                        style={styles.suggestionItem}
                      >
                        {officer.name} — NMLS {officer.nmls}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.officerButtons}>
                <button type="button" onClick={confirmLoanOfficer} style={styles.confirmButton}>
                  {t.confirmLoanOfficer}
                </button>
                <button type="button" onClick={useDefaultOfficer} style={styles.unknownButton}>
                  {t.unknownLoanOfficer}
                </button>
              </div>

              <div style={styles.assignedBox}>
                <div style={styles.assignedLabel}>{t.assignedRouting}</div>
                <div style={styles.assignedName}>
                  {activeOfficer.name} — NMLS {activeOfficer.nmls}
                </div>
                <div style={styles.assignedText}>
                  {t.routingLine} {activeOfficer.email} and{" "}
                  {activeOfficer.assistantEmail}.
                </div>
              </div>

              <button
                type="button"
                onClick={runPreliminaryReview}
                disabled={!accepted || loading}
                style={{
                  ...styles.runButton,
                  opacity: !accepted || loading ? 0.6 : 1,
                }}
              >
                {loading ? t.reviewing : t.runPreliminaryReview}
              </button>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>{t.scenarioTitle}</h2>

              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  placeholder={t.homePrice}
                  value={homePrice}
                  onChange={(e) => setHomePrice(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder={t.downPayment}
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                />
                <select
                  style={styles.input}
                  value={occupancy}
                  onChange={(e) => setOccupancy(e.target.value)}
                >
                  <option value="">{t.occupancy}</option>
                  <option value="primary_residence">Primary Residence</option>
                  <option value="second_home">Second Home</option>
                  <option value="investment_property">Investment Property</option>
                </select>
              </div>

              <div style={styles.loanAmountBox}>
                <div style={styles.loanAmountLabel}>{t.estimatedLoanAmount}</div>
                <div style={styles.loanAmountValue}>
                  {formatCurrency(estimatedLoanAmount)}
                </div>
                <div style={styles.loanAmountSubtext}>
                  {t.estimatedLtv}: {estimatedLtv || "Not provided"}
                </div>
              </div>

              <button
                type="button"
                onClick={continueScenario}
                disabled={chatLoading}
                style={{
                  ...styles.scenarioButton,
                  opacity: chatLoading ? 0.6 : 1,
                }}
              >
                {chatLoading ? t.updatingScenario : t.continueScenario}
              </button>
            </div>
          </div>

          <div style={styles.rightColumn}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>{t.conversationTitle}</h2>

              <div style={styles.chatBox}>
                {conversation.length === 0 ? (
                  <div style={styles.chatPlaceholder}>
                    {t.conversationPlaceholder}
                  </div>
                ) : (
                  conversation.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        ...styles.chatMessage,
                        backgroundColor:
                          message.role === "user" ? "#E8F4FB" : "#F8FAFC",
                      }}
                    >
                      {message.content}
                    </div>
                  ))
                )}
              </div>

              <textarea
                style={styles.textarea}
                placeholder={t.conversationPlaceholder}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={chatLoading}
                style={{
                  ...styles.sendButton,
                  opacity: chatLoading ? 0.6 : 1,
                }}
              >
                {chatLoading ? t.sending : t.sendMessage}
              </button>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>{t.nextActions}</h2>

              <div style={styles.actionButtons}>
                <a
                  href={activeOfficer.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.primaryAction}
                  onClick={() => {
                    void sendBorrowerSummary("apply");
                  }}
                >
                  {t.applyNow}
                </a>
                <a
                  href={activeOfficer.scheduleUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.secondaryAction}
                  onClick={() => {
                    void sendBorrowerSummary("schedule");
                  }}
                >
                  {t.scheduleLoanOfficer}
                </a>
                <a
                  href={emailHref}
                  style={styles.outlineAction}
                  onClick={() => {
                    void sendBorrowerSummary("contact");
                  }}
                >
                  {t.emailLoanOfficer}
                </a>
                <a
                  href={callHref}
                  style={styles.outlineAction}
                  onClick={() => {
                    void sendBorrowerSummary("contact");
                  }}
                >
                  {t.callLoanOfficer}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F5F7FC",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
    color: "#263366",
  },
  pageWrap: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "24px 20px 40px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#EAF0FF",
    color: "#263366",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    padding: "6px 10px",
    borderRadius: 999,
  },
  topControls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  languageLabel: {
    fontWeight: 700,
    fontSize: 14,
  },
  languageSelect: {
    border: "1px solid #CBD5E1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  backLink: {
    color: "#263366",
    textDecoration: "none",
    fontWeight: 700,
  },
  heroTitle: {
    fontSize: 56,
    lineHeight: 1.05,
    margin: "16px 0 10px",
    fontWeight: 800,
  },
  heroText: {
    margin: "0 0 22px",
    fontSize: 16,
    color: "#5B6B92",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  twoColumnTop: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #D8E0F0",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 3px 12px rgba(38,51,102,0.04)",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: 18,
    fontWeight: 800,
    color: "#263366",
  },
  cardText: {
    margin: 0,
    color: "#5B6B92",
    lineHeight: 1.75,
    fontSize: 14,
  },
  directionBox: {
    marginTop: 18,
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    color: "#8A97B5",
    fontSize: 14,
    lineHeight: 1.7,
  },
  checkboxRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    color: "#263366",
    fontSize: 14,
  },
  transactionTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    borderRadius: 14,
    border: "1px solid #B8C5DD",
    backgroundColor: "#FFFFFF",
    color: "#7A88A8",
    fontWeight: 700,
    fontSize: 16,
    padding: "14px 10px",
    cursor: "pointer",
  },
  tabButtonActive: {
    backgroundColor: "#68B8D8",
    color: "#FFFFFF",
    border: "1px solid #68B8D8",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #D5DDEA",
    padding: "14px 14px",
    fontSize: 14,
    backgroundColor: "#FFFFFF",
    color: "#263366",
    outline: "none",
    boxSizing: "border-box",
  },
  realtorSection: {
    marginTop: 14,
  },
  realtorLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#7A88A8",
    marginBottom: 10,
  },
  realtorButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  smallButton: {
    borderRadius: 14,
    border: "1px solid #B8C5DD",
    backgroundColor: "#FFFFFF",
    color: "#7A88A8",
    fontWeight: 700,
    fontSize: 14,
    padding: "10px 16px",
    cursor: "pointer",
  },
  smallButtonActive: {
    backgroundColor: "#68B8D8",
    color: "#FFFFFF",
    border: "1px solid #68B8D8",
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: "#9AA5BF",
  },
  suggestionBox: {
    position: "absolute",
    zIndex: 20,
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 6,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #D5DDEA",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 6px 20px rgba(38,51,102,0.08)",
  },
  suggestionItem: {
    width: "100%",
    textAlign: "left",
    backgroundColor: "#FFFFFF",
    border: "none",
    padding: "12px 14px",
    cursor: "pointer",
    color: "#263366",
    fontSize: 14,
  },
  officerButtons: {
    display: "flex",
    gap: 10,
    marginTop: 16,
    flexWrap: "wrap",
  },
  confirmButton: {
    borderRadius: 14,
    border: "none",
    backgroundColor: "#68B8D8",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 16px",
    cursor: "pointer",
  },
  unknownButton: {
    borderRadius: 14,
    border: "1px solid #B8C5DD",
    backgroundColor: "#FFFFFF",
    color: "#7A88A8",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 16px",
    cursor: "pointer",
  },
  assignedBox: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#F7FAFF",
    border: "1px solid #D8E0F0",
    padding: 16,
  },
  assignedLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#A0AEC8",
    fontWeight: 700,
    marginBottom: 8,
  },
  assignedName: {
    fontSize: 20,
    fontWeight: 800,
    color: "#6D7797",
    marginBottom: 8,
  },
  assignedText: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#98A4BE",
  },
  runButton: {
    marginTop: 18,
    borderRadius: 14,
    border: "none",
    backgroundColor: "#A3ABC4",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 18px",
    cursor: "pointer",
  },
  loanAmountBox: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#F7FAFF",
    border: "1px solid #D8E0F0",
    padding: 16,
  },
  loanAmountLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#A0AEC8",
    fontWeight: 700,
    marginBottom: 8,
  },
  loanAmountValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#6D7797",
  },
  loanAmountSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#8894B0",
  },
  scenarioButton: {
    marginTop: 14,
    borderRadius: 14,
    border: "none",
    backgroundColor: "#A3ABC4",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 18px",
    cursor: "pointer",
  },
  chatBox: {
    minHeight: 180,
    maxHeight: 280,
    overflowY: "auto",
    marginBottom: 12,
  },
  chatPlaceholder: {
    color: "#98A4BE",
    fontSize: 14,
    lineHeight: 1.7,
  },
  chatMessage: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#263366",
  },
  textarea: {
    width: "100%",
    minHeight: 106,
    borderRadius: 14,
    border: "1px solid #D5DDEA",
    padding: 14,
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
    color: "#263366",
    marginBottom: 12,
  },
  sendButton: {
    width: "100%",
    borderRadius: 14,
    border: "none",
    backgroundColor: "#8B94B3",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 14,
    padding: "14px 18px",
    cursor: "pointer",
  },
  actionButtons: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  primaryAction: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    backgroundColor: "#263366",
    color: "#FFFFFF",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 14,
  },
  secondaryAction: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    backgroundColor: "#1495C2",
    color: "#FFFFFF",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 14,
  },
  outlineAction: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    backgroundColor: "#FFFFFF",
    color: "#263366",
    border: "1px solid #263366",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 14,
  },
};
