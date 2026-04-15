"use client";

import React, { useMemo, useState } from "react";

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
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
  },
];

const DEFAULT_LOAN_OFFICER = LOAN_OFFICERS.find(
  (officer) => officer.id === "finley-beyond"
)!;

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

You are Finley Beyond, an AI-powered mortgage decision support assistant supervised by a Certified Mortgage Advisor at Beyond Financing.
This is a borrower-facing conversation.
Do not present exact loan approvals, underwriting decisions, exact program recommendations, lender matches, or commitments to lend.
Do not state that the borrower qualifies for a specific loan program.
Keep the response educational, practical, professional, and preliminary.
Always remind the borrower that final guidance must come from a licensed loan officer using current investor guidelines, overlays, and program requirements.
    `.trim();
  };

  const buildRoutingPayload = () => ({
    loanOfficerQuery,
    selectedOfficer: {
      id: activeOfficer.id,
      name: activeOfficer.name,
      nmls: activeOfficer.nmls,
      email: activeOfficer.email,
      assistantEmail: activeOfficer.assistantEmail,
      mobile: activeOfficer.mobile,
      assistantMobile: activeOfficer.assistantMobile,
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
  });

  const confirmOfficerSelection = () => {
    const matched = resolveOfficerFromQuery(loanOfficerQuery);
    if (matched) {
      setSelectedOfficer(matched);
      setLoanOfficerQuery(`${matched.name} — NMLS ${matched.nmls}`);
    } else {
      setSelectedOfficer(DEFAULT_LOAN_OFFICER);
      setLoanOfficerQuery(`${DEFAULT_LOAN_OFFICER.name} — NMLS ${DEFAULT_LOAN_OFFICER.nmls}`);
    }
  };

  const useDefaultFinley = () => {
    setSelectedOfficer(DEFAULT_LOAN_OFFICER);
    setLoanOfficerQuery(`${DEFAULT_LOAN_OFFICER.name} — NMLS ${DEFAULT_LOAN_OFFICER.nmls}`);
  };

  const runPreliminaryReview = async () => {
    setSubmitted(true);
    setLoading(true);
    setErrorMessage("");
    setChatError("");
    setConversation([]);

    const resolvedOfficer =
      selectedOfficer || resolveOfficerFromQuery(loanOfficerQuery) || DEFAULT_LOAN_OFFICER;

    if (!selectedOfficer || selectedOfficer.id !== resolvedOfficer.id) {
      setSelectedOfficer(resolvedOfficer);
      setLoanOfficerQuery(`${resolvedOfficer.name} — NMLS ${resolvedOfficer.nmls}`);
    }

    try {
      const initialPrompt = `
${buildBorrowerContext()}

Please provide a borrower-facing preliminary review with:
1. General strengths based on the borrower information currently entered
2. General areas that may need attention
3. Clear next steps for the borrower
4. A reminder that the borrower should next enter the target home price and down payment to continue the scenario review

Do not identify a specific loan program.
Do not identify a lender.
Keep the tone professional, clear, and easy to understand.
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
Please provide:
1. A borrower-facing explanation of what this target scenario means at a high level
2. General items the borrower should be prepared to discuss with a licensed loan officer
3. General factors that may influence whether this target scenario is workable
4. A reminder that final guidance must come from a licensed loan officer

Do not identify a specific loan program.
Do not identify a lender.
Do not say the borrower is approved or definitively qualifies.
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
          routing: buildRoutingPayload(),
          messages: [
            {
              role: "user",
              content: `${buildBorrowerContext()}

Continue the borrower-facing conversation naturally.
Stay general and compliant.
Avoid exact program recommendations, lender suggestions, approvals, underwriting decisions, or commitments to lend.`,
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
            Finley Beyond Powered by Beyond Intelligence™
          </h1>

          <p style={styles.heroText}>
            AI-Powered Mortgage Decision System supervised by a Certified
            Mortgage Advisor.
          </p>
        </div>

        <div className="bf-main-grid" style={styles.mainGrid}>
          <section className="bf-card" style={styles.card}>
            <h2 className="bf-section-title" style={styles.sectionTitle}>
              Required Disclaimer
            </h2>

            <div style={styles.noticeBox}>
              This system provides preliminary guidance only. It does not
              constitute a loan approval, underwriting decision, commitment to
              lend, legal advice, tax advice, or final program eligibility
              determination. All scenarios must be independently reviewed and
              confirmed by a licensed loan officer using current investor
              guidelines, overlays, and program requirements.
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              I acknowledge and accept this disclaimer before using the system.
            </label>

            <h2 className="bf-section-title" style={styles.sectionTitle}>
              Borrower Intake
            </h2>

            {!accepted && (
              <div style={styles.lockBox}>
                The intake section is locked until the disclaimer is accepted.
              </div>
            )}

            <div
              className="bf-form-grid"
              style={{
                ...styles.formGrid,
                opacity: accepted ? 1 : 0.55,
                pointerEvents: accepted ? "auto" : "none",
              }}
            >
              <div>
                <label style={styles.label}>Borrower Name</label>
                <input
                  style={styles.input}
                  type="text"
                  value={intakeForm.name}
                  onChange={(e) => setIntakeField("name", e.target.value)}
                  placeholder="Enter borrower name"
                />
              </div>

              <div>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  value={intakeForm.email}
                  onChange={(e) => setIntakeField("email", e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label style={styles.label}>Estimated Credit Score</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intakeForm.credit}
                  onChange={(e) => setIntakeField("credit", e.target.value)}
                  placeholder="Enter estimated credit score"
                />
              </div>

              <div>
                <label style={styles.label}>Gross Monthly Income</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intakeForm.income}
                  onChange={(e) => setIntakeField("income", e.target.value)}
                  placeholder="Enter gross monthly income"
                />
              </div>

              <div>
                <label style={styles.label}>Monthly Debt</label>
                <input
                  style={styles.input}
                  type="number"
                  value={intakeForm.debt}
                  onChange={(e) => setIntakeField("debt", e.target.value)}
                  placeholder="Enter monthly debt"
                />
              </div>

              <div style={{ position: "relative" }}>
                <label style={styles.label}>Loan Officer Name or NMLS #</label>
                <input
                  style={styles.input}
                  type="text"
                  value={loanOfficerQuery}
                  onChange={(e) => {
                    setLoanOfficerQuery(e.target.value);
                    setSelectedOfficer(null);
                  }}
                  placeholder="Type loan officer name or NMLS #"
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
                  Confirm Loan Officer
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
                  I Do Not Know My Loan Officer
                </button>
              </div>
            )}

            <div style={styles.assignedOfficerBox}>
              <div style={styles.assignedOfficerTitle}>Assigned Routing</div>
              <div style={styles.assignedOfficerText}>
                {activeOfficer.name} — NMLS {activeOfficer.nmls}
              </div>
              <div style={styles.assignedOfficerSubtext}>
                Internal summary will route to {activeOfficer.email} and{" "}
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
                {loading ? "Reviewing..." : "Run Preliminary Review"}
              </button>
            </div>

            {scenarioUnlocked && (
              <div style={styles.secondStepWrap}>
                <h2 className="bf-section-title" style={styles.sectionTitle}>
                  Property Target Scenario
                </h2>

                <div style={styles.infoBox}>
                  Now enter the target home price and the estimated down payment
                  so Finley Beyond can continue the scenario with the numbers you
                  are actually considering.
                </div>

                <div className="bf-form-grid" style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>Estimated Home Price</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={scenarioForm.homePrice}
                      onChange={(e) =>
                        setScenarioField("homePrice", e.target.value)
                      }
                      placeholder="Enter estimated home price"
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Estimated Down Payment</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={scenarioForm.downPayment}
                      onChange={(e) =>
                        setScenarioField("downPayment", e.target.value)
                      }
                      placeholder="Enter estimated down payment"
                    />
                  </div>
                </div>

                <div style={styles.loanPreviewBox}>
                  <div style={styles.loanPreviewTitle}>
                    Estimated Loan Amount
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
                    {chatLoading
                      ? "Updating Scenario..."
                      : "Continue with This Scenario"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside style={styles.aside}>
            {scenarioUnlocked && (
              <div className="bf-card" style={styles.card}>
                <h3 className="bf-section-title" style={styles.sectionTitleSmall}>
                  Financial Snapshot
                </h3>

                <MetricCard
                  title="Estimated Home Price"
                  value={formatCurrency(Number(scenarioForm.homePrice) || 0)}
                />
                <MetricCard
                  title="Estimated Down Payment"
                  value={formatCurrency(Number(scenarioForm.downPayment) || 0)}
                />
                <MetricCard
                  title="Estimated Loan Amount"
                  value={formatCurrency(estimatedLoanAmount)}
                />
                <MetricCard
                  title="Estimated LTV"
                  value={
                    Number(scenarioForm.homePrice) > 0
                      ? `${Math.round(estimatedLtv * 100)}%`
                      : "0%"
                  }
                />
              </div>
            )}

            <div className="bf-card" style={styles.card}>
              <h3 className="bf-section-title" style={styles.sectionTitleSmall}>
                Finley Conversation
              </h3>

              {!submitted && (
                <div style={styles.placeholderBox}>
                  Complete the intake and run the preliminary review to begin the
                  Finley Beyond conversation.
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
                    <label style={styles.label}>
                      Continue chatting with Finley Beyond
                    </label>

                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a follow-up question, such as: Can I buy a house with this information? How can I apply for a mortgage? How can I speak with a loan officer?"
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
                      {chatLoading ? "Sending..." : "Send Message"}
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
};
