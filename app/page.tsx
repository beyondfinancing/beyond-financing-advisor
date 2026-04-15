"use client";
import React, { useMemo, useState } from "react";

export default function Page() {
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    const ltv = loan / home;

    return {
      home,
      loan,
      ltv,
    };
  }, [form]);

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>Beyond Intelligence — Prototype</h1>

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

        <button disabled={!accepted} onClick={() => setSubmitted(true)}>
          Run Analysis
        </button>
      </div>

      {/* RESULTS */}
      {submitted && (
        <div style={{ marginTop: 30 }}>
          <h2>Results</h2>
          <p>Estimated Home Price: ${Math.round(results.home)}</p>
          <p>Estimated Loan: ${Math.round(results.loan)}</p>
          <p>LTV: {Math.round(results.ltv * 100)}%</p>

          <h3>Next Step</h3>
          <p>
            This scenario should be reviewed by a licensed loan officer and
            matched with an investor.
          </p>
        </div>
      )}
    </div>
  );
}
