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
    id: "sandro",
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
    id: "warren",
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
    id: "finley",
    name: "Finley Beyond",
    nmls: "BF-AI",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const DEFAULT_LOAN_OFFICER: LoanOfficerRecord = LOAN_OFFICERS[2];

const COPY: Record<
  LanguageCode,
  {
    title: string;
    subtitle: string;
    disclaimerTitle: string;
    disclaimerText: string;
    acceptText: string;
    borrowerIntake: string;
    scenarioTitle: string;
    estimatedLoan: string;
    runReview: string;
    chatTitle: string;
    send: string;
    name: string;
    email: string;
    credit: string;
    income: string;
    debt: string;
    homePrice: string;
    downPayment: string;
    conversationPlaceholder: string;
    chatPlaceholder: string;
    assignedOfficer: string;
  }
> = {
  en: {
    title: "Finley Beyond",
    subtitle:
      "AI-Powered Mortgage Decision System supervised by a Certified Mortgage Advisor.",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It does not constitute a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program eligibility determination. All scenarios must be independently reviewed and confirmed by a licensed loan officer.",
    acceptText:
      "I acknowledge and accept this disclaimer before using the system.",
    borrowerIntake: "Borrower Intake",
    scenarioTitle: "Property Scenario",
    estimatedLoan: "Estimated Loan Amount",
    runReview: "Run Preliminary Review",
    chatTitle: "Conversation with Finley",
    send: "Send",
    name: "Name",
    email: "Email",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt",
    homePrice: "Home Price",
    downPayment: "Down Payment",
    conversationPlaceholder: "Run the review to start the conversation.",
    chatPlaceholder: "Ask a question or continue the conversation.",
    assignedOfficer: "Assigned Loan Officer",
  },
  pt: {
    title: "Finley Beyond",
    subtitle:
      "Sistema de orientação hipotecária com IA supervisionado por um Certified Mortgage Advisor.",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimerText:
      "Este sistema fornece apenas orientação preliminar. Não constitui aprovação de empréstimo, decisão de underwriting, compromisso de conceder crédito, aconselhamento jurídico, aconselhamento fiscal ou determinação final de elegibilidade de programa. Todos os cenários devem ser analisados e confirmados por um loan officer licenciado.",
    acceptText: "Reconheço e aceito este aviso antes de usar o sistema.",
    borrowerIntake: "Informações do Cliente",
    scenarioTitle: "Cenário do Imóvel",
    estimatedLoan: "Valor Estimado do Empréstimo",
    runReview: "Executar Revisão Preliminar",
    chatTitle: "Conversa com Finley",
    send: "Enviar",
    name: "Nome",
    email: "Email",
    credit: "Pontuação de Crédito Estimada",
    income: "Renda Bruta Mensal",
    debt: "Dívida Mensal",
    homePrice: "Valor do Imóvel",
    downPayment: "Entrada",
    conversationPlaceholder: "Execute a revisão para iniciar a conversa.",
    chatPlaceholder: "Faça uma pergunta ou continue a conversa.",
    assignedOfficer: "Loan Officer Designado",
  },
  es: {
    title: "Finley Beyond",
    subtitle:
      "Sistema de orientación hipotecaria con IA supervisado por un Certified Mortgage Advisor.",
    disclaimerTitle: "Aviso Requerido",
    disclaimerText:
      "Este sistema proporciona únicamente orientación preliminar. No constituye aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, asesoría fiscal ni determinación final de elegibilidad de programa. Todos los escenarios deben ser revisados y confirmados por un loan officer con licencia.",
    acceptText: "Reconozco y acepto este aviso antes de usar el sistema.",
    borrowerIntake: "Información del Cliente",
    scenarioTitle: "Escenario de la Propiedad",
    estimatedLoan: "Monto Estimado del Préstamo",
    runReview: "Ejecutar Revisión Preliminar",
    chatTitle: "Conversación con Finley",
    send: "Enviar",
    name: "Nombre",
    email: "Correo Electrónico",
    credit: "Puntaje de Crédito Estimado",
    income: "Ingreso Bruto Mensual",
    debt: "Deuda Mensual",
    homePrice: "Precio de la Vivienda",
    downPayment: "Pago Inicial",
    conversationPlaceholder: "Ejecute la revisión para iniciar la conversación.",
    chatPlaceholder: "Haga una pregunta o continúe la conversación.",
    assignedOfficer: "Loan Officer Asignado",
  },
};

function extractReply(data: unknown): string {
  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null) {
    const value = data as {
      reply?: string;
      message?: string;
      content?: string;
      error?: string;
    };

    return (
      value.reply ||
      value.message ||
      value.content ||
      value.error ||
      "No response returned."
    );
  }

  return "No response returned.";
}

export default function FinleyPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [accepted, setAccepted] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [chatInput, setChatInput] = useState<string>("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [officer] = useState<LoanOfficerRecord>(DEFAULT_LOAN_OFFICER);

  const [intake, setIntake] = useState<IntakeFormState>({
    name: "",
    email: "",
    credit: "",
    income: "",
    debt: "",
  });

  const [scenario, setScenario] = useState<ScenarioFormState>({
    homePrice: "",
    downPayment: "",
  });

  const t = COPY[language];

  const estimatedLoan = useMemo<number>(() => {
    const homePrice = Number(scenario.homePrice) || 0;
    const downPayment = Number(scenario.downPayment) || 0;
    return Math.max(homePrice - downPayment, 0);
  }, [scenario.homePrice, scenario.downPayment]);

  const runReview = async (): Promise<void> => {
    setSubmitted(true);
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Start borrower intake conversation.
Borrower name: ${intake.name || "Not provided"}
Borrower email: ${intake.email || "Not provided"}
Estimated credit: ${intake.credit || "Not provided"}
Gross monthly income: ${intake.income || "Not provided"}
Monthly debt: ${intake.debt || "Not provided"}
Language: ${language}
Assigned loan officer: ${officer.name} / NMLS ${officer.nmls}

Respond as Finley Beyond in ${
                language === "pt"
                  ? "Portuguese"
                  : language === "es"
                  ? "Spanish"
                  : "English"
              }.
Acknowledge the borrower info briefly.
Do not promise approval, rates, terms, or program eligibility.
Encourage the borrower to apply and ask the next logical qualification question.`,
            },
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(extractReply(data));
      }

      setConversation([
        {
          role: "assistant",
          content: extractReply(data),
        },
      ]);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Server error."
      );
      setConversation([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    if (!chatInput.trim()) return;

    setChatLoading(true);
    setErrorMessage("");

    const updated: ChatMessage[] = [
      ...conversation,
      { role: "user", content: chatInput.trim() },
    ];

    setConversation(updated);
    setChatInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Borrower profile context:
Name: ${intake.name || "Not provided"}
Email: ${intake.email || "Not provided"}
Estimated credit: ${intake.credit || "Not provided"}
Gross monthly income: ${intake.income || "Not provided"}
Monthly debt: ${intake.debt || "Not provided"}
Home price: ${scenario.homePrice || "Not provided"}
Down payment: ${scenario.downPayment || "Not provided"}
Estimated loan amount: ${estimatedLoan || 0}
Assigned loan officer: ${officer.name} / NMLS ${officer.nmls}
Language: ${language}

Continue the borrower conversation.
Do not promise approval, exact rates, exact terms, or final eligibility.
Encourage Apply Now when appropriate.`,
            },
            ...updated,
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(extractReply(data));
      }

      setConversation([
        ...updated,
        { role: "assistant", content: extractReply(data) },
      ]);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Server error."
      );
      setConversation(updated);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.badge}>Beyond Intelligence™</div>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtitle}>{t.subtitle}</p>
        </div>

        <div style={styles.card}>
          <div style={styles.rowBetween}>
            <h2 style={styles.sectionTitle}>{t.disclaimerTitle}</h2>

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

          <div style={styles.notice}>{t.disclaimerText}</div>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>{t.acceptText}</span>
          </label>
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.borrowerIntake}</h2>

            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>{t.name}</label>
                <input
                  style={styles.input}
                  value={intake.name}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t.name}
                  disabled={!accepted}
                />
              </div>

              <div>
                <label style={styles.label}>{t.email}</label>
                <input
                  style={styles.input}
                  value={intake.email}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder={t.email}
                  disabled={!accepted}
                />
              </div>

              <div>
                <label style={styles.label}>{t.credit}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intake.credit}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, credit: e.target.value }))
                  }
                  placeholder={t.credit}
                  disabled={!accepted}
                />
              </div>

              <div>
                <label style={styles.label}>{t.income}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intake.income}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, income: e.target.value }))
                  }
                  placeholder={t.income}
                  disabled={!accepted}
                />
              </div>

              <div>
                <label style={styles.label}>{t.debt}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intake.debt}
                  onChange={(e) =>
                    setIntake((prev) => ({ ...prev, debt: e.target.value }))
                  }
                  placeholder={t.debt}
                  disabled={!accepted}
                />
              </div>

              <div>
                <label style={styles.label}>{t.assignedOfficer}</label>
                <input
                  style={{ ...styles.input, backgroundColor: "#f8fafc" }}
                  value={`${officer.name} — NMLS ${officer.nmls}`}
                  readOnly
                />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                style={{
                  ...styles.primaryButton,
                  opacity: !accepted || loading ? 0.7 : 1,
                  cursor: !accepted || loading ? "not-allowed" : "pointer",
                }}
                onClick={runReview}
                disabled={!accepted || loading}
              >
                {loading ? "Loading..." : t.runReview}
              </button>
            </div>

            <div style={styles.divider} />

            <h2 style={styles.sectionTitle}>{t.scenarioTitle}</h2>

            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>{t.homePrice}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={scenario.homePrice}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      homePrice: e.target.value,
                    }))
                  }
                  placeholder={t.homePrice}
                />
              </div>

              <div>
                <label style={styles.label}>{t.downPayment}</label>
                <input
                  style={styles.input}
                  type="number"
                  value={scenario.downPayment}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      downPayment: e.target.value,
                    }))
                  }
                  placeholder={t.downPayment}
                />
              </div>
            </div>

            <div style={styles.metricBox}>
              <div style={styles.metricLabel}>{t.estimatedLoan}</div>
              <div style={styles.metricValue}>
                $
                {Number.isFinite(estimatedLoan)
                  ? estimatedLoan.toLocaleString("en-US")
                  : "0"}
              </div>
            </div>
          </section>

          <aside style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.chatTitle}</h2>

            {!submitted && (
              <div style={styles.placeholder}>{t.conversationPlaceholder}</div>
            )}

            {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

            {submitted && (
              <>
                <div style={styles.chatWindow}>
                  {conversation.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        ...styles.messageBubble,
                        alignSelf:
                          message.role === "user" ? "flex-end" : "flex-start",
                        backgroundColor:
                          message.role === "user" ? "#263366" : "#f1f5f9",
                        color:
                          message.role === "user" ? "#ffffff" : "#0f172a",
                      }}
                    >
                      {message.content}
                    </div>
                  ))}

                  {chatLoading && (
                    <div
                      style={{
                        ...styles.messageBubble,
                        backgroundColor: "#f1f5f9",
                        color: "#0f172a",
                      }}
                    >
                      Finley Beyond is responding...
                    </div>
                  )}
                </div>

                <textarea
                  style={styles.textarea}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t.chatPlaceholder}
                  disabled={chatLoading}
                />

                <button
                  style={{
                    ...styles.secondaryButton,
                    opacity: chatLoading || !chatInput.trim() ? 0.7 : 1,
                    cursor:
                      chatLoading || !chatInput.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                  onClick={sendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  {chatLoading ? "Loading..." : t.send}
                </button>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f4f6fb",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "32px 16px",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    color: "#ffffff",
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    boxShadow: "0 10px 30px rgba(38, 51, 102, 0.18)",
  },
  badge: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.9,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    margin: 0,
    lineHeight: 1.1,
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 860,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 24,
    color: "#263366",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  notice: {
    border: "1px solid #dbeafe",
    backgroundColor: "#f8fbff",
    borderRadius: 14,
    padding: 16,
    lineHeight: 1.6,
    color: "#334155",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    fontSize: 14,
    fontWeight: 600,
    color: "#334155",
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
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    color: "#0f172a",
    boxSizing: "border-box",
  },
  primaryButton: {
    backgroundColor: "#263366",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "14px 20px",
    fontSize: 15,
    fontWeight: 700,
  },
  secondaryButton: {
    backgroundColor: "#0096C7",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "14px 20px",
    fontSize: 15,
    fontWeight: 700,
    width: "100%",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    margin: "28px 0",
  },
  metricBox: {
    marginTop: 18,
    backgroundColor: "#f8fbff",
    border: "1px solid #dbeafe",
    borderRadius: 14,
    padding: 16,
  },
  metricLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748b",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
  },
  placeholder: {
    border: "1px dashed #cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    color: "#475569",
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    whiteSpace: "pre-wrap",
  },
  chatWindow: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxHeight: 420,
    overflowY: "auto",
    marginBottom: 16,
    paddingRight: 4,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  textarea: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    boxSizing: "border-box",
    resize: "vertical",
    marginBottom: 12,
    minHeight: 110,
  },
};
