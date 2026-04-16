"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { evaluateFannieMaeSingleFamily } from "@/lib/lender-guidelines/fannie-mae/single-family/data";
import { evaluateFannieMaeMultifamily } from "@/lib/lender-guidelines/fannie-mae/multi-family/data";
import { evaluateFreddieMacSingleFamily } from "@/lib/lender-guidelines/freddie-mac/single-family/data";
import { evaluateFreddieMacMultifamily } from "@/lib/lender-guidelines/freddie-mac/multi-family/data";

type TeamRole = "Loan Officer" | "Loan Officer Assistant" | "Processor";
type LoanPurpose = "Purchase" | "Refinance" | "Investment";

type TeamChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TeamScenario = {
  borrowerName: string;
  professionalName: string;
  professionalEmail: string;
  role: TeamRole;
  borrowerCurrentState: string;
  borrowerTargetState: string;
  loanPurpose: LoanPurpose;
  credit: string;
  income: string;
  debt: string;
  homePrice: string;
  downPayment: string;
  occupancy: string;
  incomeType: string;
  units: string;
  dscr: string;
};

function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 20,
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
    minWidth: 0,
    boxSizing: "border-box",
  };
}

function buttonPrimaryStyle(disabled = false): React.CSSProperties {
  return {
    background: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
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

function normalizeOccupancy(
  value: string
): "primary" | "second" | "investment" | "mixed-use" | "other" {
  const lower = value.toLowerCase();
  if (lower.includes("primary")) return "primary";
  if (lower.includes("second")) return "second";
  if (lower.includes("investment")) return "investment";
  if (lower.includes("mixed")) return "mixed-use";
  return "other";
}

export default function TeamPage() {
  const [scenario, setScenario] = useState<TeamScenario>({
    borrowerName: "",
    professionalName: "",
    professionalEmail: "",
    role: "Loan Officer",
    borrowerCurrentState: "",
    borrowerTargetState: "",
    loanPurpose: "Purchase",
    credit: "",
    income: "",
    debt: "",
    homePrice: "",
    downPayment: "",
    occupancy: "",
    incomeType: "",
    units: "",
    dscr: "",
  });

  const [messages, setMessages] = useState<TeamChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to the Beyond Intelligence team workspace. Enter the borrower scenario name and key details, then collaborate with Finley Beyond to narrow likely program direction.",
    },
  ]);

  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(scenario.homePrice || 0);
    const downPayment = Number(scenario.downPayment || 0);
    const value = Math.max(homePrice - downPayment, 0);
    return value > 0 ? value : 0;
  }, [scenario.homePrice, scenario.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenario.homePrice || 0);
    const downPayment = Number(scenario.downPayment || 0);
    if (!homePrice) return 0;
    return Math.max(0, Math.round(((homePrice - downPayment) / homePrice) * 100));
  }, [scenario.homePrice, scenario.downPayment]);

  const onScreenSuggestions = useMemo(() => {
    const credit = Number(scenario.credit || 0);
    const ltv = estimatedLtv;
    const occupancy = normalizeOccupancy(scenario.occupancy);
    const dti =
      Number(scenario.income || 0) > 0
        ? (Number(scenario.debt || 0) / Number(scenario.income || 0)) * 100
        : undefined;

    const units = Number(scenario.units || 0) || undefined;
    const dscr = Number(scenario.dscr || 0) || undefined;
    const isMulti = (units || 0) >= 5;

    if (!credit || !ltv) return [];

    if (!isMulti) {
      const fannie = evaluateFannieMaeSingleFamily({
        creditScore: credit,
        ltv,
        dti,
        occupancy:
          occupancy === "primary" || occupancy === "second" || occupancy === "investment"
            ? occupancy
            : "primary",
        firstTimeBuyer: false,
      }).filter((x) => x.eligible);

      const freddie = evaluateFreddieMacSingleFamily({
        creditScore: credit,
        ltv,
        dti,
        occupancy:
          occupancy === "primary" || occupancy === "second" || occupancy === "investment"
            ? occupancy
            : "primary",
        firstTimeBuyer: false,
      }).filter((x) => x.eligible);

      return [...fannie, ...freddie].slice(0, 5).map((item) => ({
        program: item.program,
        strength: item.strength,
        notes: item.notes,
      }));
    }

    const fannieMf = evaluateFannieMaeMultifamily({
      creditScore: credit || undefined,
      ltv,
      dscr,
      occupancy: occupancy === "mixed-use" ? "mixed-use" : "investment",
      units,
      experienceLevel: "experienced-investor",
    }).filter((x) => x.eligible);

    const freddieMf = evaluateFreddieMacMultifamily({
      creditScore: credit || undefined,
      ltv,
      dscr,
      occupancy: occupancy === "mixed-use" ? "mixed-use" : "investment",
      units,
      experienceLevel: "experienced-investor",
    }).filter((x) => x.eligible);

    return [...fannieMf, ...freddieMf].slice(0, 5).map((item) => ({
      program: item.program,
      strength: item.strength,
      notes: item.notes,
    }));
  }, [
    scenario.credit,
    scenario.occupancy,
    scenario.income,
    scenario.debt,
    scenario.units,
    scenario.dscr,
    estimatedLtv,
  ]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    if (!scenario.borrowerName.trim()) {
      alert("Please enter a Borrower Scenario Name first.");
      return;
    }

    setSending(true);

    const nextMessages = [
      ...messages,
      { role: "user" as const, content: chatInput.trim() },
    ];

    try {
      const response = await fetch("/api/team-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          scenario,
          messages: nextMessages,
          suggestions: onScreenSuggestions,
        }),
      });

      const data = await response.json();

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            data.reply ||
            "Scenario recorded. Continue refining the structure with Finley Beyond.",
        },
      ]);

      setChatInput("");
    } finally {
      setSending(false);
    }
  };

  const emailSummary = async () => {
    if (!scenario.borrowerName.trim()) {
      alert("Borrower Scenario Name is required.");
      return;
    }

    if (!scenario.professionalEmail.trim()) {
      alert("Professional Email is required.");
      return;
    }

    setEmailing(true);

    try {
      const response = await fetch("/api/team-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          scenario,
          messages,
          suggestions: onScreenSuggestions,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Summary emailed successfully.");
      } else {
        alert(data.error || "Summary email could not be sent.");
      }
    } finally {
      setEmailing(false);
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
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: 20 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
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
              TEAM WORKSPACE
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(34px, 6vw, 54px)",
                lineHeight: 1.15,
              }}
            >
              Finley Beyond for Professionals
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: "clamp(16px, 2.5vw, 18px)",
              }}
            >
              Loan officers, loan officer assistants, and processors can discuss
              borrower scenarios with Finley Beyond and receive a professional
              summary by email when the review is complete.
            </p>
          </div>

          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "#263366",
              fontWeight: 700,
              alignSelf: "center",
            }}
          >
            Back to Beyond Intelligence
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Scenario Setup</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <input
                  placeholder="Borrower Scenario Name"
                  value={scenario.borrowerName}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      borrowerName: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Professional Name"
                  value={scenario.professionalName}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      professionalName: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Professional Email"
                  value={scenario.professionalEmail}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      professionalEmail: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <select
                  value={scenario.role}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      role: e.target.value as TeamRole,
                    }))
                  }
                  style={inputStyle()}
                >
                  <option>Loan Officer</option>
                  <option>Loan Officer Assistant</option>
                  <option>Processor</option>
                </select>
                <input
                  placeholder="Borrower Current State"
                  value={scenario.borrowerCurrentState}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      borrowerCurrentState: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Borrower Target State"
                  value={scenario.borrowerTargetState}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      borrowerTargetState: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  Loan Purpose
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {(["Purchase", "Refinance", "Investment"] as LoanPurpose[]).map(
                    (purpose) => (
                      <button
                        key={purpose}
                        type="button"
                        onClick={() =>
                          setScenario((prev) => ({ ...prev, loanPurpose: purpose }))
                        }
                        style={buttonSecondaryStyle(scenario.loanPurpose === purpose)}
                      >
                        {purpose}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <input
                  placeholder="Estimated Credit Score"
                  value={scenario.credit}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, credit: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Gross Monthly Income"
                  value={scenario.income}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, income: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Monthly Debt"
                  value={scenario.debt}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, debt: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Estimated Home Price"
                  value={scenario.homePrice}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, homePrice: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Estimated Down Payment"
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
                  value={scenario.occupancy}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, occupancy: e.target.value }))
                  }
                  style={inputStyle()}
                >
                  <option value="">Occupancy</option>
                  <option value="Primary residence">Primary residence</option>
                  <option value="Second home">Second home</option>
                  <option value="Investment property">Investment property</option>
                  <option value="Mixed-use">Mixed-use</option>
                </select>
                <input
                  placeholder="Income Type"
                  value={scenario.incomeType}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, incomeType: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Units"
                  value={scenario.units}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, units: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="DSCR"
                  value={scenario.dscr}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, dscr: e.target.value }))
                  }
                  style={inputStyle()}
                />
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 16,
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div>
                  <strong>Estimated Loan Amount:</strong> {estimatedLoanAmount || 0}
                </div>
                <div>
                  <strong>Estimated LTV:</strong> {estimatedLtv || 0}%
                </div>
              </div>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                Conversation with Finley Beyond
              </h2>

              <div
                style={{
                  minHeight: 320,
                  maxHeight: 560,
                  overflowY: "auto",
                  padding: 14,
                  borderRadius: 16,
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                }}
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    style={{
                      marginBottom: 14,
                      padding: 14,
                      borderRadius: 14,
                      background: message.role === "assistant" ? "#FFFFFF" : "#DBEAFE",
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
                        : scenario.professionalName || "Professional"}
                    </div>
                    <div>{message.content}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Discuss the scenario with Finley Beyond. Example: This borrower is W-2 salaried, primary residence, 90% LTV, strong reserves. What should I narrow next?"
                  rows={5}
                  style={{
                    ...inputStyle(),
                    resize: "vertical",
                    minHeight: 120,
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending}
                    style={buttonPrimaryStyle(sending)}
                  >
                    {sending ? "Sending..." : "Send to Finley Beyond"}
                  </button>

                  <button
                    type="button"
                    onClick={emailSummary}
                    disabled={emailing}
                    style={buttonSecondaryStyle(true)}
                  >
                    {emailing
                      ? "Emailing Summary..."
                      : "Complete Review & Email Summary"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                On-Screen Program Direction
              </h2>

              {onScreenSuggestions.length === 0 ? (
                <div style={{ color: "#70819A", lineHeight: 1.7 }}>
                  Enter credit score, price, down payment, and occupancy to begin
                  displaying possible program direction on screen.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {onScreenSuggestions.map((item, index) => (
                    <div
                      key={`${item.program}-${index}`}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        background: "#F8FAFC",
                        padding: 16,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{item.program}</div>
                      <div style={{ marginTop: 6, color: "#0096C7", fontWeight: 700 }}>
                        {String(item.strength).toUpperCase()} alignment
                      </div>
                      <ul style={{ margin: "10px 0 0 18px", padding: 0, lineHeight: 1.7 }}>
                        {item.notes.map((note, noteIndex) => (
                          <li key={noteIndex}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                Professional Testing Notes
              </h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                <li>Borrower Scenario Name is required before starting.</li>
                <li>
                  Loan Purpose is selected upfront so Finley Beyond does not need
                  to re-ask it.
                </li>
                <li>
                  Current borrower state and target state are included from the
                  beginning.
                </li>
                <li>
                  When the review is complete, the summary is emailed to the
                  professional who interacted with the system.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
