"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

type LanguageCode = "en" | "pt" | "es";
type LoanPurpose = "Purchase" | "Refinance" | "Investment";

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
  applyUrl: string;
  scheduleUrl: string;
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
  };
  conversation?: ChatMessage[];
};

const APPLY_NOW_URL = "https://www.beyondfinancing.com/apply-now";

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://calendly.com/sandropansini",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
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
    purpose: "Loan Purpose",
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
    loanOfficer: "Loan Officer Name or NMLS #",
    loanOfficerPlaceholder: "Type loan officer name or NMLS #",
    confirmOfficer: "Confirm Loan Officer",
    unknownOfficer: "I Do Not Know My Loan Officer",
    assigned: "Assigned Routing",
    review: "Run Preliminary Review",
    scenarioTitle: "Property Scenario",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    continueScenario: "Continue with This Scenario",
    conversation: "Conversation with Finley Beyond",
    send: "Send Message",
    applyNow: "Apply Now",
    schedule: "Schedule with Loan Officer",
    emailOfficer: "Email Loan Officer",
    chatPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
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
    purpose: "Objetivo do Empréstimo",
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
    loanOfficer: "Nome do Loan Officer ou NMLS #",
    loanOfficerPlaceholder: "Digite o nome do loan officer ou o NMLS #",
    confirmOfficer: "Confirmar Loan Officer",
    unknownOfficer: "Não Sei Meu Loan Officer",
    assigned: "Roteamento Definido",
    review: "Executar Revisão Preliminar",
    scenarioTitle: "Cenário do Imóvel",
    homePrice: "Valor Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    occupancy: "Ocupação",
    continueScenario: "Continuar com Este Cenário",
    conversation: "Conversa com Finley Beyond",
    send: "Enviar Mensagem",
    applyNow: "Aplicar Agora",
    schedule: "Agendar com o Loan Officer",
    emailOfficer: "Enviar Email ao Loan Officer",
    chatPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta do Finley Beyond.",
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
    purpose: "Objetivo del Préstamo",
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
    loanOfficer: "Nombre del Loan Officer o NMLS #",
    loanOfficerPlaceholder: "Escriba el nombre del loan officer o el NMLS #",
    confirmOfficer: "Confirmar Loan Officer",
    unknownOfficer: "No Conozco Mi Loan Officer",
    assigned: "Asignación Definida",
    review: "Ejecutar Revisión Preliminar",
    scenarioTitle: "Escenario de la Propiedad",
    homePrice: "Precio Estimado de la Vivienda",
    downPayment: "Pago Inicial Estimado",
    occupancy: "Ocupación",
    continueScenario: "Continuar con Este Escenario",
    conversation: "Conversación con Finley Beyond",
    send: "Enviar Mensaje",
    applyNow: "Aplicar Ahora",
    schedule: "Agendar con el Loan Officer",
    emailOfficer: "Enviar Correo al Loan Officer",
    chatPlaceholder:
      "Haga una pregunta o responda la siguiente pregunta de Finley Beyond.",
  },
};

function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
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
  };
}

function buttonPrimaryStyle(): React.CSSProperties {
  return {
    background: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
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

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(scenario.homePrice || 0);
    const downPayment = Number(scenario.downPayment || 0);
    const value = Math.max(homePrice - downPayment, 0);
    return value > 0 ? value.toString() : "";
  }, [scenario.homePrice, scenario.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenario.homePrice || 0);
    const downPayment = Number(scenario.downPayment || 0);
    if (!homePrice) return "";
    const ltv = ((homePrice - downPayment) / homePrice) * 100;
    return `${Math.max(0, Math.round(ltv))}%`;
  }, [scenario.homePrice, scenario.downPayment]);

  const handleConfirmOfficer = () => {
    const lower = loanOfficerQuery.trim().toLowerCase();
    const found =
      LOAN_OFFICERS.find(
        (officer) =>
          officer.name.toLowerCase() === lower || officer.nmls.toLowerCase() === lower
      ) ||
      LOAN_OFFICERS.find(
        (officer) =>
          lower.includes(officer.name.toLowerCase()) ||
          officer.name.toLowerCase().includes(lower) ||
          lower.includes(officer.nmls.toLowerCase())
      ) ||
      DEFAULT_OFFICER;

    setSelectedOfficer(found);
  };

  const buildRouting = (conversation: ChatMessage[]): RoutingPayload => ({
    language,
    loanOfficerQuery,
    selectedOfficer,
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
    },
    conversation,
  });

  const runPreliminaryReview = async () => {
    setReviewing(true);

    const currentRouting = buildRouting(messages);

    const starterMessage: ChatMessage = {
      role: "user",
      content:
        language === "pt"
          ? "Estou pronto para começar a revisão preliminar."
          : language === "es"
          ? "Estoy listo para comenzar la revisión preliminar."
          : "I am ready to begin the preliminary review.",
    };

    const payload = {
      stage: "initial_review",
      routing: {
        ...currentRouting,
        conversation: [starterMessage],
      },
      messages: [starterMessage],
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      const newConversation: ChatMessage[] = [
        starterMessage,
        { role: "assistant", content: data.reply || "Review started." },
      ];

      setMessages(newConversation);
      setRouting(data.routing || buildRouting(newConversation));
    } finally {
      setReviewing(false);
    }
  };

  const continueScenario = async () => {
    setReviewing(true);

    const userMessage: ChatMessage = {
      role: "user",
      content:
        language === "pt"
          ? `Meu objetivo é um cenário de ${loanPurpose.toLowerCase()} com imóvel estimado em ${scenario.homePrice || "0"} e entrada estimada de ${scenario.downPayment || "0"}.`
          : language === "es"
          ? `Mi objetivo es un escenario de ${loanPurpose.toLowerCase()} con propiedad estimada en ${scenario.homePrice || "0"} y pago inicial estimado de ${scenario.downPayment || "0"}.`
          : `My goal is a ${loanPurpose.toLowerCase()} scenario with an estimated property price of ${scenario.homePrice || "0"} and an estimated down payment of ${scenario.downPayment || "0"}.`,
    };

    const nextConversation = [...messages, userMessage];
    const currentRouting = buildRouting(nextConversation);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "scenario_review",
          routing: currentRouting,
          messages: nextConversation,
        }),
      });

      const data = await response.json();
      const updatedConversation = [
        ...nextConversation,
        { role: "assistant", content: data.reply || "Scenario updated." },
      ];

      setMessages(updatedConversation);
      setRouting(data.routing || buildRouting(updatedConversation));
    } finally {
      setReviewing(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    setSending(true);

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
    };

    const nextConversation = [...messages, userMessage];
    const currentRouting = buildRouting(nextConversation);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "follow_up",
          routing: currentRouting,
          messages: nextConversation,
        }),
      });

      const data = await response.json();

      const updatedConversation = [
        ...nextConversation,
        { role: "assistant", content: data.reply || "Message received." },
      ];

      setMessages(updatedConversation);
      setRouting(data.routing || buildRouting(updatedConversation));
      setChatInput("");
    } finally {
      setSending(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
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
            <h1 style={{ margin: 0, fontSize: 36 }}>{t.title}</h1>
            <p style={{ margin: "10px 0 0", color: "#5A6A84", lineHeight: 1.6 }}>
              {t.subtitle}
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontWeight: 700 }}>{t.language}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              style={{ ...inputStyle(), width: 140, padding: "10px 12px" }}
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 22,
          }}
        >
          <div style={{ display: "grid", gap: 22 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0 }}>{t.disclaimerTitle}</h2>
              <p style={{ lineHeight: 1.7, color: "#4B5C78" }}>{t.disclaimer}</p>

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

            <section style={{ ...cardStyle(), opacity: accepted ? 1 : 0.55 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
                    setIntake((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.credit}
                  value={intake.credit}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, credit: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.income}
                  value={intake.income}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, income: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  disabled={!accepted}
                  placeholder={t.debt}
                  value={intake.debt}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, debt: e.target.value }))
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
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={!accepted}
                    onClick={() =>
                      setIntake((prev) => ({ ...prev, realtorStatus: "no" }))
                    }
                    style={buttonSecondaryStyle(intake.realtorStatus === "no")}
                  >
                    No
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
                    Not Sure
                  </button>
                </div>

                {intake.realtorStatus === "yes" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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

              <div style={{ marginTop: 18 }}>
                <input
                  disabled={!accepted}
                  placeholder={t.loanOfficerPlaceholder}
                  value={loanOfficerQuery}
                  onChange={(e) => setLoanOfficerQuery(e.target.value)}
                  style={inputStyle()}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 14,
                  alignItems: "center",
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
                  onClick={() => setSelectedOfficer(DEFAULT_OFFICER)}
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
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {selectedOfficer.name} — NMLS {selectedOfficer.nmls}
                </div>
                <div style={{ color: "#5A6A84", marginTop: 6 }}>
                  Internal summary will route to {selectedOfficer.email} and{" "}
                  {selectedOfficer.assistantEmail}.
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  disabled={!accepted || reviewing}
                  onClick={runPreliminaryReview}
                  style={buttonPrimaryStyle()}
                >
                  {reviewing ? "Reviewing..." : t.review}
                </button>
              </div>
            </section>

            <section style={{ ...cardStyle(), opacity: accepted ? 1 : 0.55 }}>
              <h2 style={{ marginTop: 0 }}>{t.scenarioTitle}</h2>

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
                    setScenario((prev) => ({ ...prev, homePrice: e.target.value }))
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
                      downPayment: e.target.value,
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
                  ESTIMATED LOAN AMOUNT
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {estimatedLoanAmount || "0"}
                </div>
                <div style={{ marginTop: 8, color: "#5A6A84" }}>
                  Estimated LTV: {estimatedLtv || "Not available"}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  disabled={!accepted || reviewing}
                  onClick={continueScenario}
                  style={buttonPrimaryStyle()}
                >
                  {reviewing ? "Updating..." : t.continueScenario}
                </button>
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 22 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0 }}>{t.conversation}</h2>

              <div
                style={{
                  minHeight: 420,
                  maxHeight: 620,
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
                        lineHeight: 1.7,
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
                  placeholder={t.chatPlaceholder}
                  rows={5}
                  style={{ ...inputStyle(), resize: "vertical" }}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending || !accepted}
                  style={buttonPrimaryStyle()}
                >
                  {sending ? "Sending..." : t.send}
                </button>
              </div>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0 }}>Next Actions</h2>

              <div style={{ display: "grid", gap: 12 }}>
                <a
                  href={selectedOfficer.applyUrl}
                  target="_blank"
                  style={{
                    ...buttonPrimaryStyle(),
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  {t.applyNow}
                </a>

                <a
                  href={selectedOfficer.scheduleUrl}
                  target="_blank"
                  style={{
                    ...buttonSecondaryStyle(true),
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  {t.schedule}
                </a>

                <a
                  href={`mailto:${selectedOfficer.email}`}
                  style={{
                    ...buttonSecondaryStyle(false),
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  {t.emailOfficer}
                </a>
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
                    <strong>Purpose:</strong> {loanPurpose}
                  </div>
                  <div>
                    <strong>Current State:</strong> {intake.currentState || "Not provided"}
                  </div>
                  <div>
                    <strong>Target State:</strong> {intake.targetState || "Not provided"}
                  </div>
                  <div>
                    <strong>Occupancy:</strong>{" "}
                    {routing.scenario.occupancy || "Not provided"}
                  </div>
                  <div>
                    <strong>Timeline:</strong>{" "}
                    {routing.scenario.timeline || "Not provided"}
                  </div>
                  <div>
                    <strong>Funds Source:</strong>{" "}
                    {routing.scenario.fundsSource || "Not provided"}
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
