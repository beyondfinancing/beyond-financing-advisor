"use client";

import React, { useMemo, useState } from "react";

type FormState = {
  name: string;
  email: string;
  credit: string;
  income: string;
  debt: string;
  down: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0";
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

export default function Page() {
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    credit: "700",
    income: "12000",
    debt: "1200",
    down: "50000",
  });

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const results = useMemo(() => {
    const income = Number(form.income) || 0;
    const debt = Number(form.debt) || 0;
    const down = Number(form.down) || 0;

    const monthlyAvailable = Math.max(income * 0.45 - debt, 0);
    const monthlyRate = 0.075 / 12;
    const months = 360;

    const estimatedLoan =
      monthlyAvailable > 0
        ? (monthlyAvailable * (1 - Math.pow(1 + monthlyRate, -months))) /
          monthlyRate
        : 0;

    const estimatedHomePrice = estimatedLoan + down;
    const ltv =
      estimatedHomePrice > 0 ? estimatedLoan / estimatedHomePrice : 0;

    return {
      estimatedHomePrice,
      estimatedLoan,
      ltv,
    };
  }, [form]);

  const buildBorrowerContext = () => {
    return `
Borrower profile for context:
- Name: ${form.name || "Not provided"}
- Email: ${form.email || "Not provided"}
- Estimated Credit Score: ${form.credit}
- Gross Monthly Income: ${form.income}
- Monthly Debt: ${form.debt}
- Down Payment / Equity: ${form.down}
- Estimated Home Price: ${Math.round(results.estimatedHomePrice)}
- Estimated Loan Amount: ${Math.round(results.estimatedLoan)}
- Estimated LTV: ${Math.round(results.ltv * 100)}%

You are Finley Beyond, an AI-powered mortgage decision support assistant supervised by a Certified Mortgage Advisor at Beyond Financing.
Provide preliminary guidance only.
Do not present anything as a loan approval, underwriting decision, or commitment to lend.
Always remind the user that a licensed loan officer must review the scenario against current investor guidelines, overlays, and program requirements.
    `.trim();
  };

  const runAnalysis = async () => {
    setSubmitted(true);
    setLoading(true);
    setErrorMessage("");
    setChatError("");
    setAiResponse("Finley Beyond is analyzing this scenario...");

    try {
      const initialPrompt = `
${buildBorrowerContext()}

Please provide:
1. Likely loan direction
2. Main risk flags
3. Recommended next steps

Keep the answer professional, practical, and easy to understand.
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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

      const text = extractAiText(data);
      const finalText =
        text || "No response was returned from the AI system.";

      setAiResponse(finalText);
      setConversation([
        {
          role: "assistant",
          content: finalText,
        },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "There was an error connecting to the AI system.";
      setErrorMessage(message);
      setAiResponse("");
      setConversation([]);
    } finally {
      setLoading(false);
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
      const systemContext = buildBorrowerContext();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `${systemContext}\n\nInitial instruction: Continue the conversation naturally and answer follow-up mortgage questions based on this borrower profile.`,
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

      const text = extractAiText(data);
      const finalText =
        text || "No response was returned from the AI system.";

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
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f6fb",
        padding: "32px 20px",
        fontFamily: "Inter, Arial, Helvetica, sans-serif",
        color: "#1f2937",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
            color: "#ffffff",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 10px 30px rgba(38, 51, 102, 0.18)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 13,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              opacity: 0.9,
              marginBottom: 10,
            }}
          >
            Beyond Intelligence™
          </div>

          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.15,
              margin: 0,
              fontWeight: 700,
            }}
          >
            Finley Beyond Powered by Beyond Intelligence™
          </h1>

          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: 16,
              lineHeight: 1.6,
              maxWidth: 780,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            AI-Powered Mortgage Decision System supervised by a Certified
            Mortgage Advisor.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 16,
                fontSize: 24,
                color: "#263366",
              }}
            >
              Required Disclaimer
            </h2>

            <div
              style={{
                border: "1px solid #dbe3f0",
                backgroundColor: "#f8fbff",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
                lineHeight: 1.65,
                fontSize: 15,
              }}
            >
              This system provides preliminary guidance only. It does not
              constitute a loan approval, underwriting decision, commitment to
              lend, legal advice, tax advice, or final program eligibility
              determination. All scenarios must be independently reviewed and
              confirmed by a licensed loan officer using current investor
              guidelines, overlays, and program requirements.
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 24,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              I acknowledge and accept this disclaimer before using the system.
            </label>

            <h2
              style={{
                marginTop: 0,
                marginBottom: 16,
                fontSize: 24,
                color: "#263366",
              }}
            >
              Borrower Intake
            </h2>

            {!accepted && (
              <div
                style={{
                  backgroundColor: "#fff7ed",
                  color: "#9a3412",
                  border: "1px solid #fdba74",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 18,
                  fontSize: 14,
                }}
              >
                The intake section is locked until the disclaimer is accepted.
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                opacity: accepted ? 1 : 0.55,
                pointerEvents: accepted ? "auto" : "none",
              }}
            >
              <div>
                <label style={labelStyle}>Borrower Name</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Enter borrower name"
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label style={labelStyle}>Estimated Credit Score</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.credit}
                  onChange={(e) => setField("credit", e.target.value)}
                  placeholder="700"
                />
              </div>

              <div>
                <label style={labelStyle}>Gross Monthly Income</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.income}
                  onChange={(e) => setField("income", e.target.value)}
                  placeholder="12000"
                />
              </div>

              <div>
                <label style={labelStyle}>Monthly Debt</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.debt}
                  onChange={(e) => setField("debt", e.target.value)}
                  placeholder="1200"
                />
              </div>

              <div>
                <label style={labelStyle}>Down Payment / Equity</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.down}
                  onChange={(e) => setField("down", e.target.value)}
                  placeholder="50000"
                />
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <button
                onClick={runAnalysis}
                disabled={!accepted || loading}
                style={{
                  backgroundColor: loading ? "#7c8aa8" : "#263366",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  padding: "14px 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: !accepted || loading ? "not-allowed" : "pointer",
                  boxShadow: "0 8px 18px rgba(38, 51, 102, 0.18)",
                }}
              >
                {loading ? "Analyzing..." : "Run Full Analysis"}
              </button>
            </div>
          </section>

          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 20,
                padding: 24,
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 18,
                  fontSize: 22,
                  color: "#263366",
                }}
              >
                Financial Snapshot
              </h3>

              <MetricCard
                title="Estimated Home Price"
                value={formatCurrency(results.estimatedHomePrice)}
              />
              <MetricCard
                title="Estimated Loan Amount"
                value={formatCurrency(results.estimatedLoan)}
              />
              <MetricCard
                title="Estimated LTV"
                value={`${Math.round(results.ltv * 100)}%`}
              />
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 20,
                padding: 24,
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 16,
                  fontSize: 22,
                  color: "#263366",
                }}
              >
                Finley Analysis
              </h3>

              {!submitted && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 12,
                    padding: 16,
                    color: "#475569",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  Complete the intake and run the analysis to begin the Finley
                  Beyond conversation.
                </div>
              )}

              {submitted && errorMessage && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    borderRadius: 12,
                    padding: 16,
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {submitted && !errorMessage && (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      marginBottom: 16,
                      maxHeight: 420,
                      overflowY: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {conversation.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        style={{
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
                          borderRadius: 14,
                          padding: 14,
                          whiteSpace: "pre-wrap",
                          fontSize: 14,
                          lineHeight: 1.7,
                        }}
                      >
                        {message.content}
                      </div>
                    ))}

                    {chatLoading && (
                      <div
                        style={{
                          backgroundColor: "#f8fbff",
                          border: "1px solid #dbeafe",
                          borderRadius: 14,
                          padding: 14,
                          fontSize: 14,
                          lineHeight: 1.7,
                          color: "#1e293b",
                        }}
                      >
                        Finley Beyond is responding...
                      </div>
                    )}
                  </div>

                  {chatError && (
                    <div
                      style={{
                        backgroundColor: "#fef2f2",
                        color: "#991b1b",
                        border: "1px solid #fecaca",
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 13,
                        marginBottom: 12,
                      }}
                    >
                      {chatError}
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: 14,
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      Continue chatting with Finley Beyond
                    </label>

                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a follow-up question, such as: Would FHA be better here? What documents should I collect first?"
                      rows={4}
                      style={{
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
                      }}
                      disabled={chatLoading}
                    />

                    <button
                      onClick={sendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      style={{
                        backgroundColor:
                          chatLoading || !chatInput.trim()
                            ? "#7c8aa8"
                            : "#0096C7",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 12,
                        padding: "12px 18px",
                        fontSize: 14,
                        fontWeight: 700,
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
    <div
      style={{
        backgroundColor: "#f8fbff",
        border: "1px solid #dbe3f0",
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  backgroundColor: "#ffffff",
  color: "#111827",
};
