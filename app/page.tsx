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

function extractAiText(data: any): string {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.reply ||
    data?.message ||
    data?.response ||
    data?.content ||
    data?.text ||
    (typeof data === "string" ? data : JSON.stringify(data, null, 2))
  );
}

function extractAiText(data: any): string {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.message ||
    data?.response ||
    data?.content ||
    data?.text ||
    (typeof data === "string" ? data : JSON.stringify(data, null, 2))
  );
}

export default function Page() {
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

  const runAnalysis = async () => {
    setSubmitted(true);
    setLoading(true);
    setErrorMessage("");
    setAiResponse("Finley Beyond is analyzing this scenario...");

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
              content: `
Borrower scenario:
Name: ${form.name || "Not provided"}
Email: ${form.email || "Not provided"}
Credit Score: ${form.credit}
Monthly Income: ${form.income}
Monthly Debt: ${form.debt}
Down Payment: ${form.down}

Act as a Certified Mortgage Advisor for Beyond Financing.

Please provide:
1. Likely loan direction
2. Main risk flags
3. Recommended next steps

Keep the answer professional, practical, and easy to understand.
              `.trim(),
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const extracted = extractAiText(data);
        throw new Error(extracted || "The AI request did not complete successfully.");
      }

      const text = extractAiText(data);
      setAiResponse(text || "No response was returned from the AI system.");
    } catch (error: any) {
      const message =
        error?.message || "There was an error connecting to the AI system.";
      setErrorMessage(message);
      setAiResponse("");
    } finally {
      setLoading(false);
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
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
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
            AI-Powered Mortgage Decision System supervised by a Certified Mortgage Advisor.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 24,
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
              This system provides preliminary guidance only. It does not constitute
              a loan approval, underwriting decision, commitment to lend, legal advice,
              tax advice, or final program eligibility determination. All scenarios must
              be independently reviewed and confirmed by a licensed loan officer using
              current investor guidelines, overlays, and program requirements.
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
                  Complete the intake and run the analysis to see the AI response.
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
                <div
                  style={{
                    backgroundColor: "#f8fbff",
                    border: "1px solid #dbeafe",
                    borderRadius: 12,
                    padding: 16,
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "#1e293b",
                    minHeight: 180,
                  }}
                >
                  {aiResponse}
                </div>
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
