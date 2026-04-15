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
    };

    return (
      obj.choices?.[0]?.message?.content ||
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
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

  const buildBorrowerContext = () => {
    return `
Borrower profile for context:
- Preferred language: ${language}
- Name: ${intakeForm.name || "Not provided"}
- Email: ${intakeForm.email || "Not provided"}
- Estimated Credit Score: ${intakeForm.credit || "Not provided"}
- Gross Monthly Income: ${intakeForm.income || "Not provided"}
- Monthly Debt: ${intakeForm.debt || "Not provided"}
- Assigned Loan Officer: ${activeOfficer.name}
- Assigned Loan Officer NMLS: ${activeOfficer.nmls}
- Estimated Home Price: ${scenarioForm.homePrice || "Not provided"}
- Estimated Down Payment: ${scenarioForm.downPayment || "Not provided"}
- Estimated Loan Amount: ${
      estimatedLoanAmount > 0 ? Math.round(estimatedLoanAmount) : "Not provided"
    }
- Estimated LTV: ${
      Number(scenarioForm.homePrice) > 0
        ? `${Math.round(estimatedLtv * 100)}%`
        : "Not provided"
    }

Conversation role:
You are Finley Beyond acting like a professional mortgage loan officer assistant.
Your job is to gather qualification-oriented information, answer appropriate borrower questions, and help move the borrower toward the assigned loan officer.
You must never disclose specific loan programs, specific loan terms, personalized interest rates, or definitive qualification determinations to the borrower.
You may say that rates change and that national average mortgage rates are publicly available, but personalized rate, term, and program determination must come from the licensed loan officer.
You should encourage the borrower to click Apply Now and advise that the assigned licensed loan officer will review the information personally and advise next steps.
When helpful, ask the next qualification-style question a loan officer assistant would ask.
Respond in ${
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
    loanOfficerQuery,
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
      credit: intakeForm.credit,
      income: intakeForm.income,
      debt: intakeForm.debt,
    },
    scenario: {
      homePrice: scenarioForm.homePrice,
      downPayment: scenarioForm.downPayment,
      estimatedLoanAmount: String(estimatedLoanAmount || ""),
      estimatedLtv:
        Number(scenarioForm.homePrice) > 0
          ? `${Math.round(estimatedLtv * 100)}%`
          : "",
    },
    conversation,
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
      const initialPrompt = `
${buildBorrowerContext()}

Start the borrower conversation as a loan officer assistant.
Briefly acknowledge the borrower information already entered.
Do not disclose loan programs, rates, terms, or approval status.
Tell the borrower that this information will be sent to the assigned loan officer for personal review.
Encourage the borrower to use Apply Now.
Then ask the next logical qualification-style question.
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
              content: initialPrompt,
            },
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const extracted = extractAiText(data);
        throw new Error(
          extracted || "The AI request did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) || "No response was returned from the AI system.";

      setConversation([
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
${buildBorrowerContext()}

The borrower has now entered the target property scenario.
Acknowledge it briefly.
Do not disclose loan programs, rates, terms, or approval status.
Tell the borrower this scenario will be shared with the assigned loan officer for personal analysis.
Encourage the borrower to click Apply Now.
Then ask the next logical qualification-style question.
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
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const extracted = extractAiText(data);
        throw new Error(
          extracted || "The scenario update did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) || "No response was returned from the AI system.";

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: finalText,
        },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "There was an error updating the scenario.";
      setChatError(message);
    } finally {
      setChatLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();

    if (!trimmed || !submitted) return;

    setChatLoading(true);
    setChatError("");

    const nextConversation: ChatMessage[] = [
      ...conversation,
      { role: "user", content: trimmed },
    ];

    setConversation(nextConversation);
    setChatInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "follow_up",
          routing: {
            ...buildRoutingPayload(),
            conversation: nextConversation,
          },
          messages: [
            {
              role: "user",
              content: `${buildBorrowerContext()}

Continue the borrower-facing conversation naturally.
Answer what can properly be answered.
Never disclose exact loan programs, specific terms, or personalized rates.
Encourage Apply Now when appropriate.
Advise that the assigned loan officer will personally review the scenario and advise next steps.
After answering, ask the next useful qualification-style question if appropriate.`,
            },
            ...nextConversation.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const extracted = extractAiText(data);
        throw new Error(
          extracted || "The chat request did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) || "No response was returned from the AI system.";

      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: finalText },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "There was an error connecting to Finley Beyond.";
      setChatError(message);
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  };

  const mailtoHref = `mailto:${activeOfficer.email}?subject=${encodeURIComponent(
    `Borrower inquiry from ${intakeForm.name || "Beyond Intelligence"}`
  )}&body=${encodeURIComponent(
    language === "pt"
      ? `Olá ${activeOfficer.name}, gostaria de falar sobre meu cenário de financiamento.`
      : language === "es"
      ? `Hola ${activeOfficer.name}, me gustaría hablar sobre mi escenario de financiamiento.`
      : `Hello ${activeOfficer.name}, I would like to discuss my financing scenario.`
  )}`;

  return (
    <main style={styles.page}>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
        }

        @media (max-width: 980px) {
          .bf-main-grid {
            grid-template-columns: 1fr !important;
          }

          .bf-form-grid {
            grid-template-columns: 1fr !important;
          }

          .bf-header-title {
            font-size: 28px !important;
          }
        }

        @media (max-width: 640px) {
          .bf-page-wrap {
            padding: 20px 14px !important;
          }

          .bf-card {
            padding: 18px !important;
            border-radius: 16px !important;
          }

          .bf-hero {
            padding: 22px !important;
            border-radius: 16px !important;
          }

          .bf-header-title {
            font-size: 24px !important;
            line-height: 1.2 !important;
          }

          .bf-section-title {
            font-size: 20px !important;
          }

          .bf-button {
            width: 100%;
          }

          .bf-metric-value {
            font-size: 22px !important;
          }

          .bf-chat-scroll {
            max-height: 360px !important;
          }
        }
      `}</style>

      <div className="bf-page-wrap" style={styles.pageWrap}>
        <div className="bf-hero" style={styles.hero}>
          <div style={styles.heroEyebrow}>Beyond Intelligence™</div>

          <h1 className="bf-header-title" style={styles.heroTitle}>
            {t.heroTitle}
          </h1>

          <p style={styles.heroText}>{t.heroText}</p>
        </div>

        <div className="bf-main-grid" style={styles.mainGrid}>
          <section className="bf-card" style={styles.card}>
            <div style={styles.languageRow}>
              <label style={styles.label}>{t.languageLabel}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                style={styles.select}
              >
                <option value="en">English</option>
                <option value="pt">Português</option>
                <option value="es">Español</option>
              </select>
            </div>

            <h2 className="bf-section-title" style={styles.sectionTitle}>
              {t.disclaimerTitle}
            </h2>

            <div style={styles.noticeBox}>{t.disclaimerText}</div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              {t.acceptText}
            </label>

            <h2 className="bf-section-title" style={styles.sectionTitle}>
              {t.intakeTitle}
            </h2>

            {!accepted && <div style={styles.lockBox}>{t.intakeLocked}</div>}

            <div
              className="bf-form-grid"
              style={{
                ...styles.formGrid,
                opacity: accepted ? 1 : 0.55,
                pointerEvents: accepted ? "auto" : "none",
              }}
            >
              <div>
                <label style={styles.label}>{t.borrowerName}</label>
                <input
                  style={styles.input}
                  type="text"
                  value={intakeForm.name}
                  onChange={(e) => setIntakeField("name", e.target.value)}
                  placeholder={t.borrowerName}
                />
              </div>

              <div>
                <label style={styles.label}>{t.email}</label>
                <input
                  style={styles.input}
                  type="email"
                  value={intakeForm.email}
                  onChange={(e) => setIntakeField("email", e.target.value)}
                  placeholder={t.email}
                />
              </div>

              <div>
                <label style={styles.label}>{t.credit}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intakeForm.credit}
                  onChange={(e) => setIntakeField("credit", e.target.value)}
                  placeholder={t.credit}
                />
              </div>

              <div>
                <label style={styles.label}>{t.income}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intakeForm.income}
                  onChange={(e) => setIntakeField("income", e.target.value)}
                  placeholder={t.income}
                />
              </div>

              <div>
                <label style={styles.label}>{t.debt}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intakeForm.debt}
                  onChange={(e) => setIntakeField("debt", e.target.value)}
                  placeholder={t.debt}
                />
              </div>

              <div style={{ position: "relative" }}>
                <label style={styles.label}>{t.loanOfficer}</label>
                <input
                  style={styles.input}
                  type="text"
                  value={loanOfficerQuery}
                  onChange={(e) => {
                    setLoanOfficerQuery(e.target.value);
                    setSelectedOfficer(null);
                  }}
                  placeholder={t.loanOfficerPlaceholder}
                />

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
            </div>

            {accepted && (
              <div style={styles.loanOfficerActionRow}>
                <button
                  type="button"
                  onClick={confirmOfficerSelection}
                  className="bf-button"
                  style={{
                    ...styles.secondaryButton,
                    backgroundColor: "#0096C7",
                    cursor: "pointer",
                  }}
                >
                  {t.confirmLoanOfficer}
                </button>

                <button
                  type="button"
                  onClick={useDefaultFinley}
                  className="bf-button"
                  style={{
                    ...styles.outlineButton,
                    cursor: "pointer",
                  }}
                >
                  {t.unknownLoanOfficer}
                </button>
              </div>
            )}

            <div style={styles.assignedOfficerBox}>
              <div style={styles.assignedOfficerTitle}>{t.assignedRouting}</div>
              <div style={styles.assignedOfficerText}>
                {activeOfficer.name} — NMLS {activeOfficer.nmls}
              </div>
              <div style={styles.assignedOfficerSubtext}>
                {t.internalRoutingPrefix} {activeOfficer.email} and{" "}
                {activeOfficer.assistantEmail}.
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <button
                className="bf-button"
                onClick={runPreliminaryReview}
                disabled={!accepted || loading}
                style={{
                  ...styles.primaryButton,
                  backgroundColor: loading ? "#7c8aa8" : "#263366",
                  cursor: !accepted || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? t.reviewing : t.runPreliminaryReview}
              </button>
            </div>

            {scenarioUnlocked && (
              <div style={styles.secondStepWrap}>
                <h2 className="bf-section-title" style={styles.sectionTitle}>
                  {t.targetScenarioTitle}
                </h2>

                <div style={styles.infoBox}>{t.targetScenarioText}</div>

                <div className="bf-form-grid" style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>{t.homePrice}</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={scenarioForm.homePrice}
                      onChange={(e) =>
                        setScenarioField("homePrice", e.target.value)
                      }
                      placeholder={t.homePrice}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>{t.downPayment}</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={scenarioForm.downPayment}
                      onChange={(e) =>
                        setScenarioField("downPayment", e.target.value)
                      }
                      placeholder={t.downPayment}
                    />
                  </div>
                </div>

                <div style={styles.loanPreviewBox}>
                  <div style={styles.loanPreviewTitle}>
                    {t.estimatedLoanAmount}
                  </div>
                  <div style={styles.loanPreviewValue}>
                    {formatCurrency(estimatedLoanAmount)}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button
                    className="bf-button"
                    onClick={updateScenarioAndContinue}
                    disabled={
                      chatLoading ||
                      !scenarioForm.homePrice.trim() ||
                      !scenarioForm.downPayment.trim()
                    }
                    style={{
                      ...styles.secondaryButton,
                      backgroundColor:
                        chatLoading ||
                        !scenarioForm.homePrice.trim() ||
                        !scenarioForm.downPayment.trim()
                          ? "#7c8aa8"
                          : "#0096C7",
                      cursor:
                        chatLoading ||
                        !scenarioForm.homePrice.trim() ||
                        !scenarioForm.downPayment.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {chatLoading ? t.updatingScenario : t.continueScenario}
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside style={styles.aside}>
            {scenarioUnlocked && (
              <div className="bf-card" style={styles.card}>
                <h3 className="bf-section-title" style={styles.sectionTitleSmall}>
                  {t.financialSnapshot}
                </h3>

                <MetricCard
                  title={t.homePrice}
                  value={formatCurrency(Number(scenarioForm.homePrice) || 0)}
                />
                <MetricCard
                  title={t.downPayment}
                  value={formatCurrency(Number(scenarioForm.downPayment) || 0)}
                />
                <MetricCard
                  title={t.estimatedLoanAmount}
                  value={formatCurrency(estimatedLoanAmount)}
                />
                <MetricCard
                  title={t.estimatedLtv}
                  value={
                    Number(scenarioForm.homePrice) > 0
                      ? `${Math.round(estimatedLtv * 100)}%`
                      : "0%"
                  }
                />
              </div>
            )}

            {scenarioUnlocked && (
              <div className="bf-card" style={styles.card}>
                <h3 className="bf-section-title" style={styles.sectionTitleSmall}>
                  {t.actionTitle}
                </h3>

                <div style={styles.actionButtonWrap}>
                  <a
                    href={activeOfficer.applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.actionLinkPrimary}
                  >
                    {t.applyNow}
                  </a>

                  <a
                    href={activeOfficer.scheduleUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.actionLinkSecondary}
                  >
                    {t.scheduleLoanOfficer}
                  </a>

                  <a href={mailtoHref} style={styles.actionLinkOutline}>
                    {t.emailLoanOfficer}
                  </a>
                </div>
              </div>
            )}

            <div className="bf-card" style={styles.card}>
              <h3 className="bf-section-title" style={styles.sectionTitleSmall}>
                {t.conversationTitle}
              </h3>

              {!submitted && (
                <div style={styles.placeholderBox}>
                  {t.placeholderConversation}
                </div>
              )}

              {submitted && errorMessage && (
                <div style={styles.errorBox}>{errorMessage}</div>
              )}

              {submitted && !errorMessage && (
                <>
                  <div className="bf-chat-scroll" style={styles.chatScroll}>
                    {conversation.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        style={{
                          ...styles.chatBubble,
                          alignSelf:
                            message.role === "user" ? "flex-end" : "stretch",
                          backgroundColor:
                            message.role === "user" ? "#263366" : "#f8fbff",
                          color:
                            message.role === "user" ? "#ffffff" : "#1e293b",
                          border:
                            message.role === "user"
                              ? "1px solid #263366"
                              : "1px solid #dbeafe",
                        }}
                      >
                        {message.content}
                      </div>
                    ))}

                    {chatLoading && (
                      <div
                        style={{
                          ...styles.chatBubble,
                          backgroundColor: "#f8fbff",
                          border: "1px solid #dbeafe",
                          color: "#1e293b",
                        }}
                      >
                        Finley Beyond is responding...
                      </div>
                    )}
                  </div>

                  {chatError && <div style={styles.errorMiniBox}>{chatError}</div>}

                  <div style={styles.chatComposerWrap}>
                    <label style={styles.label}>{t.continueChatting}</label>

                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={t.chatPlaceholder}
                      rows={4}
                      style={styles.textarea}
                      disabled={chatLoading}
                    />

                    <button
                      className="bf-button"
                      onClick={sendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      style={{
                        ...styles.secondaryButton,
                        backgroundColor:
                          chatLoading || !chatInput.trim()
                            ? "#7c8aa8"
                            : "#0096C7",
                        cursor:
                          chatLoading || !chatInput.trim()
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {chatLoading ? t.sending : t.sendMessage}
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTitle}>{title}</div>
      <div className="bf-metric-value" style={styles.metricValue}>
        {value}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f4f6fb",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
    color: "#1f2937",
  },
  pageWrap: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 20px",
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    color: "#ffffff",
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 10px 30px rgba(38, 51, 102, 0.18)",
    marginBottom: 24,
  },
  heroEyebrow: {
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.9,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 1.15,
    margin: 0,
    fontWeight: 700,
  },
  heroText: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 780,
    color: "rgba(255,255,255,0.92)",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 24,
    alignItems: "start",
  },
  aside: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 24,
    color: "#263366",
  },
  sectionTitleSmall: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 22,
    color: "#263366",
  },
  languageRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  select: {
    minWidth: 180,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  noticeBox: {
    border: "1px solid #dbe3f0",
    backgroundColor: "#f8fbff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    lineHeight: 1.65,
    fontSize: 15,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 24,
    fontSize: 15,
    fontWeight: 600,
  },
  lockBox: {
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fdba74",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: "#f8fbff",
    color: "#334155",
    border: "1px solid #dbeafe",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 1.6,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    resize: "vertical",
    marginBottom: 12,
  },
  primaryButton: {
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "14px 20px",
    fontSize: 15,
    fontWeight: 700,
    boxShadow: "0 8px 18px rgba(38, 51, 102, 0.18)",
  },
  secondaryButton: {
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "12px 18px",
    fontSize: 14,
    fontWeight: 700,
  },
  outlineButton: {
    color: "#263366",
    backgroundColor: "#ffffff",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "12px 18px",
    fontSize: 14,
    fontWeight: 700,
  },
  secondStepWrap: {
    marginTop: 28,
    paddingTop: 24,
    borderTop: "1px solid #e2e8f0",
  },
  loanPreviewBox: {
    marginTop: 18,
    backgroundColor: "#f8fbff",
    border: "1px solid #dbe3f0",
    borderRadius: 14,
    padding: 16,
  },
  loanPreviewTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64748b",
    marginBottom: 6,
  },
  loanPreviewValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
  },
  metricCard: {
    backgroundColor: "#f8fbff",
    border: "1px solid #dbe3f0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64748b",
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 700,
    color: "#111827",
  },
  placeholderBox: {
    backgroundColor: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 16,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.6,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 16,
    whiteSpace: "pre-wrap",
    fontSize: 14,
    lineHeight: 1.6,
  },
  errorMiniBox: {
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  chatScroll: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 16,
    maxHeight: 460,
    overflowY: "auto",
    paddingRight: 4,
  },
  chatBubble: {
    borderRadius: 14,
    padding: 14,
    whiteSpace: "pre-wrap",
    fontSize: 14,
    lineHeight: 1.7,
  },
  chatComposerWrap: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 14,
  },
  suggestionBox: {
    position: "absolute",
    zIndex: 10,
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
    marginTop: 6,
    overflow: "hidden",
  },
  suggestionItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 14,
    border: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  },
  loanOfficerActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 16,
  },
  assignedOfficerBox: {
    marginTop: 18,
    backgroundColor: "#f8fbff",
    border: "1px solid #dbe3f0",
    borderRadius: 14,
    padding: 16,
  },
  assignedOfficerTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64748b",
    marginBottom: 6,
  },
  assignedOfficerText: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 4,
  },
  assignedOfficerSubtext: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#475569",
  },
  actionButtonWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  actionLinkPrimary: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    color: "#ffffff",
    backgroundColor: "#263366",
    borderRadius: 12,
    padding: "13px 18px",
    fontWeight: 700,
  },
  actionLinkSecondary: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    color: "#ffffff",
    backgroundColor: "#0096C7",
    borderRadius: 12,
    padding: "13px 18px",
    fontWeight: 700,
  },
  actionLinkOutline: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    color: "#263366",
    backgroundColor: "#ffffff",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "13px 18px",
    fontWeight: 700,
  },
};
