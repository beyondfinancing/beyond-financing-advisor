"use client";

import React, { useMemo, useState } from "react";

type BorrowerStatus =
  | ""
  | "citizen"
  | "permanent_resident"
  | "non_permanent_resident"
  | "itin_borrower"
  | "daca"
  | "foreign_national";

type OccupancyType =
  | ""
  | "primary_residence"
  | "second_home"
  | "investment_property";

type TransactionType =
  | ""
  | "purchase"
  | "rate_term_refinance"
  | "cash_out_refinance"
  | "second_lien";

type IncomeType =
  | ""
  | "full_doc"
  | "express_doc"
  | "bank_statements"
  | "1099"
  | "pnl"
  | "asset_utilization"
  | "dscr"
  | "no_ratio"
  | "wvoe";

type PropertyType =
  | ""
  | "single_family"
  | "condo"
  | "townhouse"
  | "2_unit"
  | "3_unit"
  | "4_unit"
  | "mixed_use"
  | "5_to_8_units";

type QualificationInput = {
  borrower_status: BorrowerStatus;
  occupancy_type: OccupancyType;
  transaction_type: TransactionType;
  income_type: IncomeType;
  property_type: PropertyType;
  credit_score: string;
  ltv: string;
  dti: string;
  loan_amount: string;
  units: string;
  first_time_homebuyer: "" | "yes" | "no";
};

type MatchBucket = {
  lender_name?: string;
  lender_id?: string;
  program_name?: string;
  program_slug?: string;
  loan_category?: string | null;
  guideline_id?: string;
  notes?: string[] | null;
  missing_items?: string[] | null;
  blockers?: string[] | null;
  score?: number;
};

type MatchResponse = {
  success: boolean;
  error?: string;
  next_question?: string;
  strong_matches?: MatchBucket[] | null;
  conditional_matches?: MatchBucket[] | null;
  eliminated_paths?: MatchBucket[] | null;
  summary?: {
    total_guidelines_checked?: number;
    strong_count?: number;
    conditional_count?: number;
    eliminated_count?: number;
  };
};

const initialForm: QualificationInput = {
  borrower_status: "",
  occupancy_type: "",
  transaction_type: "",
  income_type: "",
  property_type: "",
  credit_score: "",
  ltv: "",
  dti: "",
  loan_amount: "",
  units: "",
  first_time_homebuyer: "",
};

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function labelize(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildChatSummary(data: MatchResponse): string {
  const strong = safeArray(data.strong_matches);
  const conditional = safeArray(data.conditional_matches);
  const eliminated = safeArray(data.eliminated_paths);

  if (!data.success) {
    return data.error || "Match request failed.";
  }

  if (strong.length > 0) {
    const top = strong[0];
    return `I found ${strong.length} strong match(es). The top current direction is ${top.program_name || "a program"} with ${top.lender_name || "a lender"}. ${data.next_question || ""}`.trim();
  }

  if (conditional.length > 0) {
    return `I found ${conditional.length} conditional path(s). We are close, but I still need more qualification detail before presenting a stronger direction. ${data.next_question || ""}`.trim();
  }

  if (eliminated.length > 0) {
    return `The currently loaded guidelines appear to eliminate the visible paths for this exact combination so far. ${data.next_question || "Please adjust or confirm the qualification data so I can reassess."}`.trim();
  }

  return data.next_question || "No visible paths were identified yet. Please confirm the next qualification detail.";
}

export default function FinleyPage() {
  const [form, setForm] = useState<QualificationInput>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [nextQuestion, setNextQuestion] = useState(
    "Run the qualification match first. Finley will then identify the next best question and explain which lender/program paths remain viable."
  );
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "assistant" | "user"; content: string }[]
  >([]);
  const [strongMatches, setStrongMatches] = useState<MatchBucket[]>([]);
  const [conditionalMatches, setConditionalMatches] = useState<MatchBucket[]>([]);
  const [eliminatedPaths, setEliminatedPaths] = useState<MatchBucket[]>([]);

  const hasResults =
    strongMatches.length > 0 ||
    conditionalMatches.length > 0 ||
    eliminatedPaths.length > 0;

  const summaryText = useMemo(() => {
    return {
      strong: strongMatches.length,
      conditional: conditionalMatches.length,
      eliminated: eliminatedPaths.length,
    };
  }, [strongMatches, conditionalMatches, eliminatedPaths]);

  function updateField<K extends keyof QualificationInput>(
    key: K,
    value: QualificationInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function runQualificationMatch() {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        borrower_status: form.borrower_status,
        occupancy_type: form.occupancy_type,
        transaction_type: form.transaction_type,
        income_type: form.income_type,
        property_type: form.property_type,
        credit_score: form.credit_score,
        ltv: form.ltv,
        dti: form.dti,
        loan_amount: form.loan_amount,
        units: form.units,
        first_time_homebuyer:
          form.first_time_homebuyer === ""
            ? ""
            : form.first_time_homebuyer === "yes",
      };

      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: MatchResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Match request failed.");
      }

      const normalizedStrong = safeArray(data.strong_matches);
      const normalizedConditional = safeArray(data.conditional_matches);
      const normalizedEliminated = safeArray(data.eliminated_paths);

      setStrongMatches(normalizedStrong);
      setConditionalMatches(normalizedConditional);
      setEliminatedPaths(normalizedEliminated);
      setNextQuestion(
        data.next_question ||
          "Please continue by providing the next missing qualification detail so I can narrow lender and program fit more precisely."
      );
      setSuccessMessage("Match analysis completed successfully.");

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: buildChatSummary({
            ...data,
            strong_matches: normalizedStrong,
            conditional_matches: normalizedConditional,
            eliminated_paths: normalizedEliminated,
          }),
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error running match.";
      setError(message);
      setStrongMatches([]);
      setConditionalMatches([]);
      setEliminatedPaths([]);
    } finally {
      setLoading(false);
    }
  }

  function sendToFinley() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: nextQuestion },
    ]);
    setChatInput("");
  }

  function renderBucketCard(item: MatchBucket, type: "strong" | "conditional" | "eliminated", index: number) {
    const notes = safeArray(item.notes);
    const missingItems = safeArray(item.missing_items);
    const blockers = safeArray(item.blockers);

    return (
      <div
        key={`${type}-${item.guideline_id || item.program_slug || index}`}
        style={{
          border: "1px solid #d9e1ec",
          borderRadius: 18,
          padding: 18,
          marginBottom: 16,
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 8px 0", color: "#263366" }}>
              {item.program_name || "Unknown Program"}
            </h3>
            <div style={{ color: "#4b5d7a", marginBottom: 10 }}>
              {item.lender_name || "Unknown Lender"}
            </div>
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background:
                type === "strong"
                  ? "#e8f7ee"
                  : type === "conditional"
                  ? "#fff6e5"
                  : "#fdecec",
              color:
                type === "strong"
                  ? "#157347"
                  : type === "conditional"
                  ? "#946200"
                  : "#b42318",
              fontWeight: 700,
              height: "fit-content",
            }}
          >
            Score: {item.score ?? 0}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <strong>Program Slug:</strong> {item.program_slug || "—"}
          </div>
          <div>
            <strong>Loan Category:</strong> {labelize(item.loan_category)}
          </div>
          <div>
            <strong>Guideline ID:</strong> {item.guideline_id || "—"}
          </div>
        </div>

        {notes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>Notes</strong>
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {notes.map((note, i) => (
                <li key={`note-${i}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {missingItems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>Missing Items</strong>
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {missingItems.map((itemText, i) => (
                <li key={`missing-${i}`}>{itemText}</li>
              ))}
            </ul>
          </div>
        )}

        {blockers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>Blockers</strong>
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {blockers.map((blocker, i) => (
                <li key={`blocker-${i}`}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f6fb",
        padding: "28px 20px 60px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#263366",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <section
          style={{
            background: "linear-gradient(90deg, #263366 0%, #0096C7 100%)",
            borderRadius: 28,
            padding: "28px 28px 30px",
            color: "#ffffff",
            marginBottom: 22,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9, marginBottom: 8 }}>
            BEYOND INTELLIGENCE™
          </div>
          <h1 style={{ fontSize: 56, lineHeight: 1, margin: "0 0 12px 0" }}>Finley Beyond</h1>
          <div style={{ fontSize: 20, lineHeight: 1.45 }}>
            AI-powered mortgage qualification and program matching supervised by an Independent Certified Mortgage Advisor.
          </div>
        </section>

        {successMessage && (
          <div
            style={{
              background: "#e8f7ee",
              border: "1px solid #86d19c",
              color: "#157347",
              borderRadius: 18,
              padding: "16px 18px",
              marginBottom: 18,
            }}
          >
            {successMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fdecec",
              border: "1px solid #f5a4a4",
              color: "#b42318",
              borderRadius: 18,
              padding: "16px 18px",
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              borderRadius: 28,
              padding: 24,
              boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
            }}
          >
            <h2 style={{ fontSize: 32, margin: "0 0 14px 0" }}>Qualification Intake</h2>
            <p style={{ color: "#4b5d7a", lineHeight: 1.6 }}>
              Use this screen to gather decisive qualification facts, eliminate ineligible paths, and surface lender/program combinations still in play.
            </p>

            <div
              style={{
                marginTop: 14,
                background: "#f8fbff",
                border: "1px solid #cfe0f6",
                borderRadius: 18,
                padding: 18,
                color: "#4b5d7a",
                lineHeight: 1.65,
              }}
            >
              Finley Beyond should think like a real mortgage professional: collect missing qualification facts, eliminate impossible paths, and narrow the best program options instead of stopping at incomplete intake.
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 18, marginBottom: 18 }}>
              <button
                type="button"
                style={{
                  background: "#263366",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 16,
                  padding: "14px 18px",
                  fontWeight: 700,
                }}
              >
                Professional Mode
              </button>
              <button
                type="button"
                style={{
                  background: "#eef4fb",
                  color: "#263366",
                  border: "1px solid #c7d7eb",
                  borderRadius: 16,
                  padding: "14px 18px",
                  fontWeight: 700,
                }}
              >
                Borrower Mode
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Borrower Status</label>
                <select value={form.borrower_status} onChange={(e) => updateField("borrower_status", e.target.value as BorrowerStatus)} style={inputStyle}>
                  <option value="">Select status</option>
                  <option value="citizen">U.S. Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="non_permanent_resident">Non-Permanent Resident</option>
                  <option value="itin_borrower">ITIN Borrower</option>
                  <option value="daca">DACA</option>
                  <option value="foreign_national">Foreign National</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Occupancy Type</label>
                <select value={form.occupancy_type} onChange={(e) => updateField("occupancy_type", e.target.value as OccupancyType)} style={inputStyle}>
                  <option value="">Select occupancy</option>
                  <option value="primary_residence">Primary Residence</option>
                  <option value="second_home">Second Home</option>
                  <option value="investment_property">Investment Property</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Transaction Type</label>
                <select value={form.transaction_type} onChange={(e) => updateField("transaction_type", e.target.value as TransactionType)} style={inputStyle}>
                  <option value="">Select transaction type</option>
                  <option value="purchase">Purchase</option>
                  <option value="rate_term_refinance">Rate-Term Refinance</option>
                  <option value="cash_out_refinance">Cash-Out Refinance</option>
                  <option value="second_lien">Second Lien</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Income Type</label>
                <select value={form.income_type} onChange={(e) => updateField("income_type", e.target.value as IncomeType)} style={inputStyle}>
                  <option value="">Select income type</option>
                  <option value="full_doc">Full Doc</option>
                  <option value="express_doc">Express Doc</option>
                  <option value="bank_statements">Bank Statements</option>
                  <option value="1099">1099</option>
                  <option value="pnl">P&amp;L</option>
                  <option value="asset_utilization">Asset Utilization</option>
                  <option value="dscr">DSCR</option>
                  <option value="no_ratio">No Ratio</option>
                  <option value="wvoe">WVOE</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Property Type</label>
                <select value={form.property_type} onChange={(e) => updateField("property_type", e.target.value as PropertyType)} style={inputStyle}>
                  <option value="">Select property type</option>
                  <option value="single_family">Single Family</option>
                  <option value="condo">Condo</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="2_unit">2 Unit</option>
                  <option value="3_unit">3 Unit</option>
                  <option value="4_unit">4 Unit</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="5_to_8_units">5 to 8 Units</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Credit Score</label>
                <input value={form.credit_score} onChange={(e) => updateField("credit_score", e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>LTV %</label>
                <input value={form.ltv} onChange={(e) => updateField("ltv", e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>DTI %</label>
                <input value={form.dti} onChange={(e) => updateField("dti", e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Loan Amount</label>
                <input value={form.loan_amount} onChange={(e) => updateField("loan_amount", e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Units</label>
                <input value={form.units} onChange={(e) => updateField("units", e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>First-Time Homebuyer</label>
                <select value={form.first_time_homebuyer} onChange={(e) => updateField("first_time_homebuyer", e.target.value as "" | "yes" | "no")} style={inputStyle}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <button
                type="button"
                onClick={runQualificationMatch}
                disabled={loading}
                style={{
                  background: "#263366",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Running..." : "Run Qualification Match"}
              </button>
            </div>
          </section>

          <section
            style={{
              background: "#ffffff",
              borderRadius: 28,
              padding: 24,
              boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
            }}
          >
            <h2 style={{ fontSize: 32, margin: "0 0 14px 0" }}>Finley Conversation</h2>

            <div
              style={{
                background: "#f8fbff",
                border: "1px solid #cfe0f6",
                borderRadius: 18,
                padding: 18,
                color: "#4b5d7a",
                lineHeight: 1.6,
                marginBottom: 18,
              }}
            >
              {nextQuestion}
            </div>

            {chatMessages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      alignSelf: msg.role === "user" ? "flex-end" : "stretch",
                      background: msg.role === "user" ? "#263366" : "#f8fbff",
                      color: msg.role === "user" ? "#ffffff" : "#263366",
                      border: msg.role === "user" ? "none" : "1px solid #cfe0f6",
                      borderRadius: 18,
                      padding: "14px 16px",
                      maxWidth: msg.role === "user" ? "85%" : "100%",
                      lineHeight: 1.6,
                    }}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Continue the qualification conversation here..."
              style={{
                width: "100%",
                minHeight: 110,
                resize: "vertical",
                borderRadius: 16,
                border: "1px solid #c7d7eb",
                padding: 16,
                fontSize: 16,
                outline: "none",
                marginBottom: 16,
              }}
            />

            <button
              type="button"
              onClick={sendToFinley}
              style={{
                background: "#0096C7",
                color: "#ffffff",
                border: "none",
                borderRadius: 16,
                padding: "14px 20px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Send to Finley
            </button>

            <div style={{ marginTop: 24, color: "#4b5d7a", lineHeight: 1.7 }}>
              <div><strong>Strong Matches:</strong> {summaryText.strong}</div>
              <div><strong>Conditional Matches:</strong> {summaryText.conditional}</div>
              <div><strong>Eliminated Paths:</strong> {summaryText.eliminated}</div>
              {!hasResults && <div style={{ marginTop: 8 }}>Run the qualification match first.</div>}
            </div>
          </section>
        </div>

        <section
          style={{
            background: "#ffffff",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
            marginTop: 22,
          }}
        >
          <h2 style={{ fontSize: 30, margin: "0 0 16px 0" }}>Strong Matches</h2>
          {strongMatches.length === 0 ? (
            <div style={{ color: "#4b5d7a" }}>No strong matches yet.</div>
          ) : (
            strongMatches.map((item, index) => renderBucketCard(item, "strong", index))
          )}
        </section>

        <section
          style={{
            background: "#ffffff",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
            marginTop: 22,
          }}
        >
          <h2 style={{ fontSize: 30, margin: "0 0 16px 0" }}>Conditional Matches</h2>
          {conditionalMatches.length === 0 ? (
            <div style={{ color: "#4b5d7a" }}>No conditional matches.</div>
          ) : (
            conditionalMatches.map((item, index) => renderBucketCard(item, "conditional", index))
          )}
        </section>

        <section
          style={{
            background: "#ffffff",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
            marginTop: 22,
          }}
        >
          <h2 style={{ fontSize: 30, margin: "0 0 16px 0" }}>Eliminated Paths</h2>
          {eliminatedPaths.length === 0 ? (
            <div style={{ color: "#4b5d7a" }}>No eliminated paths yet.</div>
          ) : (
            eliminatedPaths.map((item, index) => renderBucketCard(item, "eliminated", index))
          )}
        </section>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #c7d7eb",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
  background: "#ffffff",
  color: "#263366",
};
