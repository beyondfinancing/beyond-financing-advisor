"use client";

import React, { useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type LoanOfficer = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  applyUrl: string;
  scheduleUrl: string;
};

const LOAN_OFFICERS: LoanOfficer[] = [
  {
    id: "sandro",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://calendly.com/sandropansini",
  },
  {
    id: "warren",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "finley",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const DEFAULT_LO = LOAN_OFFICERS[2];
export default function BorrowerPage() {
  const [accepted, setAccepted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loanOfficer, setLoanOfficer] = useState<LoanOfficer>(DEFAULT_LO);

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [loading, setLoading] = useState(false);

  const resetSession = () => {
    setConversation([]);
    setChatInput("");
  };

  const sendSummary = async (trigger: "apply" | "schedule" | "contact") => {
    try {
      await fetch("/api/chat-summary", {
        method: "POST",
        body: JSON.stringify({
          lead: {
            fullName: name,
            email,
            phone: "Not provided",
            preferredLanguage: "English",
            loanOfficer: loanOfficer.id,
            assignedEmail: loanOfficer.email,
          },
          messages: conversation,
          trigger,
        }),
      });
    } catch (err) {
      console.error("Summary error:", err);
    }
  };
    const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const updated = [
      ...conversation,
      { role: "user", content: chatInput },
    ];

    setConversation(updated);
    setChatInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: updated,
        }),
      });

      const data = await res.json();

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data?.reply ||
            "I will organize this for your loan officer and guide next steps.\n\nTo move forward efficiently, I recommend clicking Apply Now so we can structure your file properly.\n\nNext question:\nIs this for a primary residence, second home, or investment property?",
        },
      ]);
    } catch {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I will organize this for your loan officer and guide next steps.\n\nTo move forward efficiently, I recommend clicking Apply Now.\n\nNext question:\nWhat type of property are you considering?",
        },
      ]);
    }

    setLoading(false);
  };
    const handleApply = async () => {
    await sendSummary("apply");
    window.open(loanOfficer.applyUrl, "_blank");
    resetSession();
  };

  const handleSchedule = async () => {
    await sendSummary("schedule");
    window.open(loanOfficer.scheduleUrl, "_blank");
    resetSession();
  };

  const handleEmail = async () => {
    await sendSummary("contact");
    window.location.href = `mailto:${loanOfficer.email}`;
    resetSession();
  };
    return (
    <main style={{ padding: 40 }}>
      <h1>Finley Beyond</h1>

      {!accepted && (
        <>
          <p>
            This system provides preliminary guidance only and must be reviewed
            by a licensed loan officer.
          </p>

          <button onClick={() => setAccepted(true)}>
            Accept & Continue
          </button>
        </>
      )}

      {accepted && (
        <>
          <input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <h3>Conversation</h3>

          <div style={{ minHeight: 200 }}>
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

          <button onClick={sendMessage} disabled={loading}>
            Send
          </button>

          <hr />

          <button onClick={handleApply}>Apply Now</button>
          <button onClick={handleSchedule}>Schedule</button>
          <button onClick={handleEmail}>Email</button>
        </>
      )}
    </main>
  );
}
