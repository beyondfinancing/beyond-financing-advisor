"use client";

import React, { useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type MatchResponse = {
  strong_matches: Array<{
    lender_name: string;
    program_name: string;
    program_slug: string;
    loan_category: string | null;
    guideline_summary: string | null;
    overlay_notes: string | null;
    missing_items_prompt: string | null;
    missing_items: string[];
    soft_flags: string[];
  }>;
  conditional_matches: Array<{
    lender_name: string;
    program_name: string;
    program_slug: string;
    loan_category: string | null;
    guideline_summary: string | null;
    overlay_notes: string | null;
    missing_items_prompt: string | null;
    missing_items: string[];
    soft_flags: string[];
  }>;
  eliminated_matches: Array<{
    lender_name: string;
    program_name: string;
    program_slug: string;
    loan_category: string | null;
    hard_fails: string[];
  }>;
  missing_items: string[];
};

type NextQuestionResponse = {
  nextQuestion: string | null;
  nextField: string | null;
};

type QualificationState = {
  borrowerStatus: string;
  occupancyType: string;
  transactionType: string;
  incomeType: string;
  propertyType: string;
  creditScore: string;
  ltv: string;
  dti: string;
  loanAmount: string;
  units: string;
  firstTimeHomebuyer: string;
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#263366",
  },
  wrap: {
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 18px 40px",
  },
  hero: {
    borderRadius: 24,
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    color: "#fff",
    padding: "26px 28px",
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.9,
    marginBottom: 10,
  },
  heroTitle: {
    margin: 0,
    fontSize: 48,
    lineHeight: 1.05,
    fontWeight: 700,
  },
  heroText: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 18,
    lineHeight: 1.6,
    maxWidth: 940,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 32,
    fontWeight: 400,
  },
  sectionText: {
    marginTop: 0,
    color: "#51688f",
    lineHeight: 1.7,
    fontSize: 15,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    border: "1px solid #c8d5eb",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 15,
    background: "#fff",
  },
  textarea: {
    width: "100%",
    border: "1px solid #c8d5eb",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 15,
    resize: "vertical",
    minHeight: 110,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryButton: {
    background: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#0096C7",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  mutedButton: {
    background: "#eef4ff",
    color: "#263366",
    border: "1px solid #c8d5eb",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  infoBox: {
    background: "#f8fbff",
    border: "1px solid #d9e6f7",
    borderRadius: 16,
    padding: 14,
    color: "#51688f",
    lineHeight: 1.7,
    marginBottom: 16,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  successBox: {
    background: "#ecfdf3",
    border: "1px solid #86efac",
    color: "#166534",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  resultCard: {
    border: "1px solid #d7e2f2",
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  resultTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
  },
  resultSub: {
    marginTop: 8,
    marginBottom: 0,
    color: "#4b628c",
    lineHeight: 1.7,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: "#eef4ff",
    color: "#1e3a8a",
  },
  chatWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    background: "#263366",
    color: "#fff",
    borderRadius: 16,
    padding: 14,
    maxWidth: "90%",
    lineHeight: 1.7,
  },
  bubbleAssistant: {
    alignSelf: "stretch",
    background: "#f8fbff",
    color: "#263366",
    border: "1px solid #d9e6f7",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.8,
  },
};

export default function FinleyPage() {
  const [mode, setMode] = useState<"borrower" | "professional">("professional");
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);

  const [form, setForm] = useState<QualificationState>({
    borrowerStatus: "",
    occupancyType: "",
    transactionType: "",
    incomeType: "",
    propertyType: "",
    creditScore: "",
    ltv: "",
    dti: "",
    loanAmount: "",
    units: "",
    firstTimeHomebuyer: "",
  });

  const summaryText = useMemo(() => {
    return [
      `Borrower Status: ${form.borrowerStatus || "Unknown"}`,
      `Occupancy Type: ${form.occupancyType || "Unknown"}`,
      `Transaction Type: ${form.transactionType || "Unknown"}`,
      `Income Type: ${form.incomeType || "Unknown"}`,
      `Property Type: ${form.propertyType || "Unknown"}`,
      `Credit Score: ${form.creditScore || "Unknown"}`,
      `LTV: ${form.ltv || "Unknown"}`,
      `DTI: ${form.dti || "Unknown"}`,
      `Loan Amount: ${form.loanAmount || "Unknown"}`,
      `Units: ${form.units || "Unknown"}`,
      `First-Time Homebuyer: ${form.firstTimeHomebuyer || "Unknown"}`,
    ].join("\n");
  }, [form]);

  function setField<K extends keyof QualificationState>(
    key: K,
    value: QualificationState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function runMatching() {
    setLoading(true);
    setMatchLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          borrowerStatus: form.borrowerStatus || undefined,
          occupancyType: form.occupancyType || undefined,
          transactionType: form.transactionType || undefined,
          incomeType: form.incomeType || undefined,
          propertyType: form.propertyType || undefined,
          creditScore: form.creditScore ? Number(form.creditScore) : null,
          ltv: form.ltv ? Number(form.ltv) : null,
          dti: form.dti ? Number(form.dti) : null,
          loanAmount: form.loanAmount ? Number(form.loanAmount) : null,
          units: form.units ? Number(form.units) : null,
          firstTimeHomebuyer:
            form.firstTimeHomebuyer === "yes"
              ? true
              : form.firstTimeHomebuyer === "no"
              ? false
              : null,
        }),
      });

      const matchJson = (await matchRes.json()) as MatchResponse & {
        error?: string;
      };

      if (!matchRes.ok) {
        throw new Error(matchJson.error || "Matching failed.");
      }

      setMatchResult(matchJson);

      const questionRes = await fetch("/api/qualify/next-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          missingItems: matchJson.missing_items || [],
        }),
      });

      const questionJson = (await questionRes.json()) as NextQuestionResponse & {
        error?: string;
      };

      if (!questionRes.ok) {
        throw new Error(questionJson.error || "Failed to determine next question.");
      }

      setNextQuestion(questionJson.nextQuestion || null);

      const initialReplyRes = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          match: matchJson,
          nextQuestion: questionJson.nextQuestion,
          messages: [
            {
              role: "user",
              content: `Initial qualification summary:\n${summaryText}`,
            },
          ],
        }),
      });

      const initialReplyJson = (await initialReplyRes.json()) as {
        reply?: string;
        error?: string;
      };

      if (!initialReplyRes.ok) {
        throw new Error(initialReplyJson.error || "Failed to generate Finley response.");
      }

      setConversation([
        {
          role: "assistant",
          content: initialReplyJson.reply || "No response returned.",
        },
      ]);

      setSuccessMessage("Match analysis completed successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Match analysis failed.");
    } finally {
      setLoading(false);
      setMatchLoading(false);
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !matchResult) return;

    setChatLoading(true);
    setErrorMessage("");

    const nextConversation: ChatMessage[] = [
      ...conversation,
      { role: "user", content: chatInput.trim() },
    ];
    setConversation(nextConversation);
    setChatInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          match: matchResult,
          nextQuestion,
          messages: nextConversation,
        }),
      });

      const json = (await res.json()) as {
        reply?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || "Chat response failed.");
      }

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.reply || "No response returned.",
        },
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Chat failed.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>Beyond Intelligence™</div>
          <h1 style={styles.heroTitle}>Finley Beyond</h1>
          <p style={styles.heroText}>
            AI-powered mortgage qualification and program matching supervised by an
            Independent Certified Mortgage Advisor.
          </p>
        </div>

        {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}
        {successMessage ? <div style={styles.successBox}>{successMessage}</div> : null}

        <div style={styles.mainGrid}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Qualification Intake</h2>
            <p style={styles.sectionText}>
              Use this screen to gather decisive qualification facts, eliminate ineligible
              paths, and surface lender/program combinations still in play.
            </p>

            <div style={styles.infoBox}>
              Finley Beyond should think like a real mortgage professional: collect missing
              qualification facts, eliminate impossible paths, and narrow the best program
              options instead of stopping at incomplete intake.
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={() => setMode("professional")}
                style={mode === "professional" ? styles.primaryButton : styles.mutedButton}
              >
                Professional Mode
              </button>

              <button
                type="button"
                onClick={() => setMode("borrower")}
                style={mode === "borrower" ? styles.secondaryButton : styles.mutedButton}
              >
                Borrower Mode
              </button>
            </div>

            <div style={{ height: 16 }} />

            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Borrower Status</label>
                <select
                  style={styles.input}
                  value={form.borrowerStatus}
                  onChange={(e) => setField("borrowerStatus", e.target.value)}
                >
                  <option value="">Select status</option>
                  <option value="citizen">U.S. Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="non_permanent_resident">Non-Permanent Resident</option>
                  <option value="itin">ITIN Borrower</option>
                  <option value="daca">DACA</option>
                  <option value="foreign_national">Foreign National</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Occupancy Type</label>
                <select
                  style={styles.input}
                  value={form.occupancyType}
                  onChange={(e) => setField("occupancyType", e.target.value)}
                >
                  <option value="">Select occupancy</option>
                  <option value="primary">Primary Residence</option>
                  <option value="second_home">Second Home</option>
                  <option value="investment">Investment Property</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Transaction Type</label>
                <select
                  style={styles.input}
                  value={form.transactionType}
                  onChange={(e) => setField("transactionType", e.target.value)}
                >
                  <option value="">Select transaction type</option>
                  <option value="purchase">Purchase</option>
                  <option value="rate_term">Rate / Term Refinance</option>
                  <option value="cash_out">Cash-Out Refinance</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Income Type</label>
                <select
                  style={styles.input}
                  value={form.incomeType}
                  onChange={(e) => setField("incomeType", e.target.value)}
                >
                  <option value="">Select income type</option>
                  <option value="w2">W-2</option>
                  <option value="self_employed_tax_returns">Self-Employed / Tax Returns</option>
                  <option value="bank_statements">Bank Statements</option>
                  <option value="1099">1099</option>
                  <option value="p_and_l">Profit and Loss</option>
                  <option value="asset_utilization">Asset Utilization</option>
                  <option value="dscr">DSCR</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Property Type</label>
                <select
                  style={styles.input}
                  value={form.propertyType}
                  onChange={(e) => setField("propertyType", e.target.value)}
                >
                  <option value="">Select property type</option>
                  <option value="single_family">Single Family</option>
                  <option value="condo">Condo</option>
                  <option value="multi_family">Multi-Family</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="manufactured">Manufactured</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Credit Score</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.creditScore}
                  onChange={(e) => setField("creditScore", e.target.value)}
                />
              </div>

              <div>
                <label style={styles.label}>LTV %</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.ltv}
                  onChange={(e) => setField("ltv", e.target.value)}
                />
              </div>

              <div>
                <label style={styles.label}>DTI %</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.dti}
                  onChange={(e) => setField("dti", e.target.value)}
                />
              </div>

              <div>
                <label style={styles.label}>Loan Amount</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.loanAmount}
                  onChange={(e) => setField("loanAmount", e.target.value)}
                />
              </div>

              <div>
                <label style={styles.label}>Units</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.units}
                  onChange={(e) => setField("units", e.target.value)}
                />
              </div>

              <div>
                <label style={styles.label}>First-Time Homebuyer</label>
                <select
                  style={styles.input}
                  value={form.firstTimeHomebuyer}
                  onChange={(e) => setField("firstTimeHomebuyer", e.target.value)}
                >
                  <option value="">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={runMatching}
                style={styles.primaryButton}
                disabled={loading}
              >
                {matchLoading ? "Analyzing..." : "Run Qualification Match"}
              </button>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Finley Conversation</h2>

            {!matchResult ? (
              <div style={styles.infoBox}>
                Run the qualification match first. Finley will then identify the next best
                question and explain which lender/program paths remain viable.
              </div>
            ) : (
              <>
                {nextQuestion ? (
                  <div style={styles.infoBox}>
                    <strong>Next Best Question:</strong>
                    <div style={{ marginTop: 8 }}>{nextQuestion}</div>
                  </div>
                ) : null}

                <div style={styles.chatWrap}>
                  {conversation.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={
                        message.role === "user"
                          ? styles.bubbleUser
                          : styles.bubbleAssistant
                      }
                    >
                      {message.content}
                    </div>
                  ))}
                </div>

                <div style={{ height: 16 }} />

                <textarea
                  style={styles.textarea}
                  placeholder="Continue the qualification conversation here..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />

                <div style={styles.buttonRow}>
                  <button
                    type="button"
                    onClick={sendChatMessage}
                    style={styles.secondaryButton}
                    disabled={chatLoading}
                  >
                    {chatLoading ? "Sending..." : "Send to Finley"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        {matchResult ? (
          <div style={{ marginTop: 20, display: "grid", gap: 20 }}>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Strong Matches</h2>
              {matchResult.strong_matches.length === 0 ? (
                <p style={styles.sectionText}>No strong matches yet.</p>
              ) : (
                matchResult.strong_matches.map((item, index) => (
                  <div key={`${item.program_slug}-${index}`} style={styles.resultCard}>
                    <h3 style={styles.resultTitle}>
                      {item.lender_name} — {item.program_name}
                    </h3>
                    <div style={styles.badgeRow}>
                      <span style={styles.badge}>
                        {item.loan_category || "Uncategorized"}
                      </span>
                    </div>
                    <p style={styles.resultSub}>
                      {item.guideline_summary || "No summary yet."}
                    </p>
                    {item.overlay_notes ? (
                      <p style={styles.resultSub}>
                        <strong>Overlay Notes:</strong> {item.overlay_notes}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Conditional Matches</h2>
              {matchResult.conditional_matches.length === 0 ? (
                <p style={styles.sectionText}>No conditional matches.</p>
              ) : (
                matchResult.conditional_matches.map((item, index) => (
                  <div key={`${item.program_slug}-${index}`} style={styles.resultCard}>
                    <h3 style={styles.resultTitle}>
                      {item.lender_name} — {item.program_name}
                    </h3>
                    <div style={styles.badgeRow}>
                      <span style={styles.badge}>
                        {item.loan_category || "Uncategorized"}
                      </span>
                    </div>
                    <p style={styles.resultSub}>
                      {item.guideline_summary || "No summary yet."}
                    </p>
                    {item.soft_flags?.length ? (
                      <p style={styles.resultSub}>
                        <strong>Needs Confirmation:</strong> {item.soft_flags.join(", ")}
                      </p>
                    ) : null}
                    {item.missing_items?.length ? (
                      <p style={styles.resultSub}>
                        <strong>Missing Items:</strong> {item.missing_items.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Eliminated Paths</h2>
              {matchResult.eliminated_matches.length === 0 ? (
                <p style={styles.sectionText}>No eliminated paths yet.</p>
              ) : (
                matchResult.eliminated_matches.map((item, index) => (
                  <div key={`${item.program_slug}-${index}`} style={styles.resultCard}>
                    <h3 style={styles.resultTitle}>
                      {item.lender_name} — {item.program_name}
                    </h3>
                    <p style={styles.resultSub}>
                      <strong>Reason:</strong> {item.hard_fails.join(" / ")}
                    </p>
                  </div>
                ))
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
