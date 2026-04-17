"use client";

import React, { useMemo, useState } from "react";

/* ---------- TYPES ---------- */
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

/* ---------- DATA ---------- */

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

const DEFAULT_LOAN_OFFICER = LOAN_OFFICERS[2];

/* ---------- COMPONENT ---------- */

export default function Page() {
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

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

  const [officer, setOfficer] = useState<LoanOfficerRecord>(
    DEFAULT_LOAN_OFFICER
  );

  const estimatedLoan = useMemo(() => {
    return Math.max(
      Number(scenario.homePrice) - Number(scenario.downPayment),
      0
    );
  }, [scenario]);

  /* ---------- ACTIONS ---------- */

  const runReview = async () => {
    setSubmitted(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Start borrower intake conversation.",
          },
        ],
      }),
    });

    const data = await res.json();

    setConversation([
      {
        role: "assistant",
        content: data.reply || "No response",
      },
    ]);
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const updated = [
      ...conversation,
      { role: "user", content: chatInput },
    ];

    setConversation(updated);
    setChatInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: updated }),
    });

    const data = await res.json();

    setConversation([
      ...updated,
      { role: "assistant", content: data.reply || "No response" },
    ]);
  };

  /* ---------- UI ---------- */

  return (
    <div style={{ padding: 30 }}>
      <h1>Finley Beyond</h1>

      <h3>Disclaimer</h3>
      <label>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        Accept Disclaimer
      </label>

      <h3>Borrower Intake</h3>

      <input
        placeholder="Name"
        value={intake.name}
        onChange={(e) =>
          setIntake({ ...intake, name: e.target.value })
        }
      />
      <input
        placeholder="Email"
        value={intake.email}
        onChange={(e) =>
          setIntake({ ...intake, email: e.target.value })
        }
      />

      <br />
      <button disabled={!accepted} onClick={runReview}>
        Run Review
      </button>

      <h3>Scenario</h3>

      <input
        placeholder="Home Price"
        value={scenario.homePrice}
        onChange={(e) =>
          setScenario({ ...scenario, homePrice: e.target.value })
        }
      />
      <input
        placeholder="Down Payment"
        value={scenario.downPayment}
        onChange={(e) =>
          setScenario({
            ...scenario,
            downPayment: e.target.value,
          })
        }
      />

      <p>Estimated Loan: ${estimatedLoan}</p>

      <h3>Chat</h3>

      <div>
        {conversation.map((m, i) => (
          <div key={i}>
            <b>{m.role}:</b> {m.content}
          </div>
        ))}
      </div>

      <textarea
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
      />

      <br />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
