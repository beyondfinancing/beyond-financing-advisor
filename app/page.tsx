"use client";
import React, { useMemo, useState } from "react";

export default function Page() {
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    credit: "700",
    income: "12000",
    debt: "1200",
    down: "50000",
  });

  const setField = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  // Basic math engine (kept)
  const results = useMemo(() => {
    const income = Number(form.income);
    const debt = Number(form.debt);
    const down = Number(form.down);

    const available = income * 0.45 - debt;
    const rate = 0.075 / 12;
    const months = 360;

    const loan =
      available > 0
        ? (available * (1 - Math.pow(1 + rate, -months))) / rate
        : 0;

    const home = loan + down;
    const ltv = home > 0 ? loan / home : 0;

    return {
      home,
      loan,
      ltv,
    };
  }, [form]);

  const runAnalysis = async () => {
    setSubmitted(true);
    setAiResponse("Analyzing scenario with Finley Beyond...");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `
Borrower scenario:
Name: ${form.name}
Email: ${form.email}
Credit Score: ${form.credit}
Monthly Income: ${form.income}
Monthly Debt: ${form.debt}
Down Payment: ${form.down}

Act as a Certified Mortgage Advisor and provide:
1. Best loan direction
2. Risk flags
3. Recommended next steps
`,
            },
          ],
        }),
      });

      const data = await res.json();

      // Adjust depending on your API response structure
      const text =
        data?.message ||
        data?.response ||
        JSON.stringify(data, null, 2);

      setAiResponse(text);
    } catch (err) {
      setAiResponse("Error connecting to AI system.");
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>Beyond Intelligence — Finley System</h1>

      {/* DISCLAIMER */}
      <div style={{ border: "1px solid #ccc", padding: 15, marginBottom: 20 }}>
        <p>
          This system provides preliminary guidance only. It is not a loan
          approval. All scenarios must be reviewed by a licensed loan officer.
        </p>

        <label>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />{" "}
          I accept the disclaimer
        </label>
      </div>

      {/* FORM */}
      <div style={{ opacity: accepted ? 1 : 0.5 }}>
        <input
          placeholder="Name"
          disabled={!accepted}
          onChange={(e) => setField("name", e.target.value)}
        />
        <br />

        <input
          placeholder="Email"
          disabled={!accepted}
          onChange={(e) => setField("email", e.target.value)}
        />
        <br />

        <input
          placeholder="Credit Score"
          disabled={!accepted}
          value={form.credit}
          onChange={(e) => setField("credit", e.target.value)}
        />
        <br />

        <input
          placeholder="Monthly Income"
          disabled={!accepted}
          value={form.income}
          onChange={(e) => setField("income", e.target.value)}
        />
        <br />

        <input
          placeholder="Monthly Debt"
          disabled={!accepted}
          value={form.debt}
          onChange={(e) => setField("debt", e.target.value)}
        />
        <br />

        <input
          placeholder="Down Payment"
          disabled={!accepted}
          value={form.down}
          onChange={(e) => setField("down", e.target.value)}
        />
        <br />

        <button disabled={!accepted} onClick={runAnalysis}>
          Run Full Analysis
        </button>
      </div>

      {/* RESULTS */}
      {submitted && (
        <div style={{ marginTop: 30 }}>
          <h2>Financial Snapshot</h2>
          <p>Estimated Home Price: ${Math.round(results.home)}</p>
          <p>Estimated Loan: ${Math.round(results.loan)}</p>
          <p>LTV: {Math.round(results.ltv * 100)}%</p>

          <h2>AI Mortgage Advisor (Finley)</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f5f5f5",
              padding: 15,
              marginTop: 10,
            }}
          >
            {aiResponse}
          </pre>
        </div>
      )}
    </div>
  );
}
