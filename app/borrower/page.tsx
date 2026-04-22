"use client";

import React, { useMemo, useState } from "react";

type LanguageCode = "en" | "pt" | "es";
type TransactionType = "purchase" | "refinance" | "investment" | "";
type RealtorStatus = "yes" | "no" | "not_sure" | "";
type OccupancyType =
  | "primary_residence"
  | "second_home"
  | "investment_property"
  | "";

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

type PreferredLanguage = "English" | "Português" | "Español";
type SummaryTrigger = "ai" | "apply" | "schedule" | "contact";

type IntakeFormState = {
  fullName: string;
  email: string;
  phone: string;
  credit: string;
  income: string;
  debt: string;
  currentState: string;
  targetState: string;
  realtorName: string;
  realtorPhone: string;
};

const APPLY_NOW_URL = "https://www.beyondfinancing.com/apply-now";

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
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
    id: "warren-wendt",
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
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const DEFAULT_LOAN_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

const COPY = {
  en: {
    heroTitle: "Finley Beyond Powered by Beyond Intelligence™",
    heroText: "Start your guided mortgage conversation with Finley Beyond.",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, title, appraisal, and current investor or agency guidelines.",
    acceptText: "I acknowledge and accept this disclaimer.",
    scenarioDirectionTitle: "Internal Scenario Direction",
    scenarioDirectionText:
      "This section reflects Finley Beyond’s internal matching direction and is used to guide the conversation and routing.",
    scenarioDirectionReady:
      "Preliminary review completed. Internal match direction generated.",
    purchase: "Purchase",
    refinance: "Refinance",
    investment: "Investment",
    borrowerName: "Borrower Name",
    email: "Email",
    phone: "Phone",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt",
    currentState: "Current State",
    targetState: "Target State",
    workingWithRealtor: "Are you working with a Realtor?",
    yes: "Yes",
    no: "No",
    notSure: "Not Sure",
    realtorName: "Realtor Name",
    realtorPhone: "Realtor Phone",
    loanOfficer: "Loan Officer Name or NMLS #",
    loanOfficerPlaceholder: "Start typing to see matching loan officers.",
    confirmLoanOfficer: "Confirm Loan Officer",
    confirmedLoanOfficer: "Loan Officer Confirmed",
    unknownLoanOfficer: "I Do Not Know My Loan Officer",
    assignedRouting: "Assigned Routing",
    routingPrefix: "Internal summary will route to",
    runPreliminaryReview: "Run Preliminary Review",
    propertyScenario: "Property Scenario",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    primaryResidence: "Primary Residence",
    secondHome: "Second Home",
    investmentProperty: "Investment Property",
    estimatedLoanAmount: "Estimated Loan Amount",
    estimatedLtv: "Estimated LTV",
    continueScenario: "Continue with This Scenario",
    scenarioConfirmed: "Scenario Confirmed",
    conversationTitle: "Conversation with Finley Beyond",
    conversationPlaceholder:
      "Complete the intake, confirm the loan officer, and confirm the property scenario to begin the conversation.",
    chatPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
    sendMessage: "Send Message",
    nextActions: "Next Actions",
    applyNow: "Apply Now",
    schedule: "Schedule with Loan Officer",
    emailOfficer: "Email Loan Officer",
    callOfficer: "Call Loan Officer",
    loading: "Loading...",
  },
} as const;

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumberInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  let normalized = digits;
  if (digits.length === 10) {
    normalized = `1${digits}`;
  }

  if (!normalized) return "+1.";

  const country = normalized.slice(0, 1);
  const area = normalized.slice(1, 4);
  const mid = normalized.slice(4, 7);
  const last = normalized.slice(7, 11);

  let result = `+${country}`;
  if (area) result += `.${area}`;
  if (mid) result += `.${mid}`;
  if (last) result += `.${last}`;

  return result;
}

function normalizeDigitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhoneForSms(value: string) {
  const digits = normalizeDigitsOnly(value);
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value;
  return `+${digits}`;
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
      nextQuestion?: string;
    };

    return (
      obj.choices?.[0]?.message?.content ||
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
      obj.nextQuestion ||
      ""
    );
  }

  return "";
}

function resolveOfficerFromQuery(query: string): LoanOfficerRecord | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;

  const exact = LOAN_OFFICERS.find((officer) => {
    const display = `${officer.name} — NMLS ${officer.nmls}`.toLowerCase();

    return (
      officer.name.toLowerCase() === trimmed ||
      officer.nmls.toLowerCase() === trimmed ||
      display === trimmed
    );
  });

  if (exact) return exact;

  return (
    LOAN_OFFICERS.find((officer) => {
      const display = `${officer.name} — NMLS ${officer.nmls}`.toLowerCase();

      return (
        officer.name.toLowerCase().includes(trimmed) ||
        officer.nmls.toLowerCase().includes(trimmed) ||
        display.includes(trimmed)
      );
    }) || null
  );
}

export default function BorrowerPage() {
  const t = COPY.en;

  const [accepted, setAccepted] = useState(false);

  const [transactionType, setTransactionType] = useState<TransactionType>("");
  const [transactionLocked, setTransactionLocked] = useState(false);

  const [realtorStatus, setRealtorStatus] = useState<RealtorStatus>("");
  const [realtorLocked, setRealtorLocked] = useState(false);

  const [loanOfficerQuery, setLoanOfficerQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] =
    useState<LoanOfficerRecord | null>(null);
  const [loanOfficerConfirmed, setLoanOfficerConfirmed] = useState(false);

  const [preliminaryReviewRan, setPreliminaryReviewRan] = useState(false);
  const [scenarioConfirmed, setScenarioConfirmed] = useState(false);

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [intakeForm, setIntakeForm] = useState<IntakeFormState>({
    fullName: "",
    email: "",
    phone: "",
    credit: "",
    income: "",
    debt: "",
    currentState: "",
    targetState: "",
    realtorName: "",
    realtorPhone: "",
  });

  const [scenario, setScenario] = useState({
    homePrice: "",
    downPayment: "",
    occupancy: "" as OccupancyType,
  });

  const officerSuggestions = useMemo(() => {
    const query = loanOfficerQuery.trim().toLowerCase();
    if (!query || loanOfficerConfirmed) return [];

    return LOAN_OFFICERS.filter((officer) => {
      const display = `${officer.name} — NMLS ${officer.nmls}`.toLowerCase();
      return (
        officer.name.toLowerCase().includes(query) ||
        officer.nmls.toLowerCase().includes(query) ||
        display.includes(query)
      );
    }).slice(0, 5);
  }, [loanOfficerQuery, loanOfficerConfirmed]);

  const matchedOfficerFromQuery = resolveOfficerFromQuery(loanOfficerQuery);

  const activeOfficer =
    selectedOfficer || matchedOfficerFromQuery || DEFAULT_LOAN_OFFICER;

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(String(scenario.homePrice).replace(/,/g, "")) || 0;
    const downPayment =
      Number(String(scenario.downPayment).replace(/,/g, "")) || 0;
    return Math.max(homePrice - downPayment, 0);
  }, [scenario.homePrice, scenario.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(String(scenario.homePrice).replace(/,/g, "")) || 0;
    if (homePrice <= 0) return 0;
    return Math.round((estimatedLoanAmount / homePrice) * 100);
  }, [scenario.homePrice, estimatedLoanAmount]);

  const intakeComplete =
    accepted &&
    !!transactionType &&
    intakeForm.fullName.trim() &&
    intakeForm.email.trim() &&
    normalizeDigitsOnly(intakeForm.phone).length >= 10 &&
    intakeForm.credit.trim() &&
    intakeForm.income.trim() &&
    intakeForm.debt.trim() &&
    intakeForm.currentState.trim() &&
    intakeForm.targetState.trim() &&
    !!realtorStatus &&
    (realtorStatus !== "yes" ||
      (intakeForm.realtorName.trim() &&
        normalizeDigitsOnly(intakeForm.realtorPhone).length >= 10)) &&
    loanOfficerConfirmed;

  const scenarioComplete =
    !!scenario.homePrice.trim() &&
    !!scenario.downPayment.trim() &&
    !!scenario.occupancy;

  const conversationReady =
    accepted &&
    intakeComplete &&
    preliminaryReviewRan &&
    scenarioConfirmed;

  const setIntakeField = (key: keyof IntakeFormState, value: string) => {
    setIntakeForm((prev) => ({ ...prev, [key]: value }));
  };

  const setScenarioField = (
    key: keyof typeof scenario,
    value: string | OccupancyType
  ) => {
    setScenario((prev) => ({ ...prev, [key]: value as never }));
  };

  const buildBorrowerContext = () => {
    const preferredLanguage: PreferredLanguage = "English";

    const occupancyLabel =
      scenario.occupancy === "primary_residence"
        ? "Primary Residence"
        : scenario.occupancy === "second_home"
        ? "Second Home"
        : scenario.occupancy === "investment_property"
        ? "Investment Property"
        : "Not provided";

    const realtorAnswer =
      realtorStatus === "yes"
        ? "Yes"
        : realtorStatus === "no"
        ? "No"
        : realtorStatus === "not_sure"
        ? "Not sure"
        : "Not provided";

    return `
Borrower profile for context:
- Preferred language: ${preferredLanguage}
- Transaction type: ${transactionType || "Not provided"}
- Borrower full name: ${intakeForm.fullName || "Not provided"}
- Borrower email: ${intakeForm.email || "Not provided"}
- Borrower phone: ${normalizePhoneForSms(intakeForm.phone) || "Not provided"}
- Estimated credit score: ${intakeForm.credit || "Not provided"}
- Gross monthly income: ${intakeForm.income || "Not provided"}
- Monthly debt: ${intakeForm.debt || "Not provided"}
- Current state: ${intakeForm.currentState || "Not provided"}
- Target state: ${intakeForm.targetState || "Not provided"}
- Working with realtor: ${realtorAnswer}
- Realtor name: ${intakeForm.realtorName || "Not provided"}
- Realtor phone: ${
      normalizePhoneForSms(intakeForm.realtorPhone) || "Not provided"
    }
- Assigned loan officer: ${activeOfficer.name}
- Assigned loan officer NMLS: ${activeOfficer.nmls}
- Assigned loan officer email: ${activeOfficer.email}
- Estimated home price: ${scenario.homePrice || "Not provided"}
- Estimated down payment: ${scenario.downPayment || "Not provided"}
- Estimated loan amount: ${
      estimatedLoanAmount > 0 ? String(estimatedLoanAmount) : "Not provided"
    }
- Occupancy: ${occupancyLabel}
- Estimated LTV: ${
      scenario.homePrice ? `${estimatedLtv}%` : "Not provided"
    }

Instructions:
- You are Finley Beyond acting like a professional mortgage advisor assistant.
- Do not ask again for information already clearly provided above.
- Only ask for the next missing item if something important is still actually missing.
- If the intake and property scenario are complete, shift into helpful borrower guidance instead of repeating intake questions.
- Never disclose specific loan program approvals, personalized rates, or definitive underwriting decisions.
- Encourage the borrower to proceed with Apply Now when appropriate.
- Make clear that the assigned licensed loan officer will personally review the scenario and advise next steps.
    `.trim();
  };

  const buildRoutingPayload = () => ({
    language: "en" as LanguageCode,
    intakeComplete,
    scenarioComplete,
    loanOfficerQuery,
    selectedOfficer: {
      id: activeOfficer.id,
      name: activeOfficer.name,
      nmls: activeOfficer.nmls,
      email: activeOfficer.email,
      assistantEmail: activeOfficer.assistantEmail,
      mobile: activeOfficer.mobile,
      assistantMobile: activeOfficer.assistantMobile,
      applyUrl: activeOfficer.applyUrl,
      scheduleUrl: activeOfficer.scheduleUrl,
    },
    borrower: {
      name: intakeForm.fullName,
      email: intakeForm.email,
      phone: normalizePhoneForSms(intakeForm.phone),
      credit: intakeForm.credit,
      income: intakeForm.income,
      debt: intakeForm.debt,
      currentState: intakeForm.currentState,
      targetState: intakeForm.targetState,
      transactionType,
      realtorStatus,
      realtorName: intakeForm.realtorName,
      realtorPhone: normalizePhoneForSms(intakeForm.realtorPhone),
    },
    scenario: {
      homePrice: scenario.homePrice,
      downPayment: scenario.downPayment,
      estimatedLoanAmount: String(estimatedLoanAmount || ""),
      estimatedLtv: scenario.homePrice ? `${estimatedLtv}%` : "",
      occupancy: scenario.occupancy,
    },
    conversation,
  });

  const resetSession = () => {
    setAccepted(false);
    setTransactionType("");
    setTransactionLocked(false);
    setRealtorStatus("");
    setRealtorLocked(false);
    setLoanOfficerQuery("");
    setSelectedOfficer(null);
    setLoanOfficerConfirmed(false);
    setPreliminaryReviewRan(false);
    setScenarioConfirmed(false);
    setConversation([]);
    setChatInput("");
    setErrorMessage("");
    setIntakeForm({
      fullName: "",
      email: "",
      phone: "",
      credit: "",
      income: "",
      debt: "",
      currentState: "",
      targetState: "",
      realtorName: "",
      realtorPhone: "",
    });
    setScenario({
      homePrice: "",
      downPayment: "",
      occupancy: "",
    });
  };

  const confirmOfficerSelection = () => {
    const matched =
      resolveOfficerFromQuery(loanOfficerQuery) || DEFAULT_LOAN_OFFICER;
    setSelectedOfficer(matched);
    setLoanOfficerQuery(`${matched.name} — NMLS ${matched.nmls}`);
    setLoanOfficerConfirmed(true);
  };

  const useDefaultFinley = () => {
    setSelectedOfficer(DEFAULT_LOAN_OFFICER);
    setLoanOfficerQuery(
      `${DEFAULT_LOAN_OFFICER.name} — NMLS ${DEFAULT_LOAN_OFFICER.nmls}`
    );
    setLoanOfficerConfirmed(true);
  };

  const runPreliminaryReview = async () => {
    if (!intakeComplete) {
      setErrorMessage(
        "Please complete the intake, realtor section, and loan officer confirmation before running the preliminary review."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      setTransactionLocked(true);
      setRealtorLocked(true);
      setPreliminaryReviewRan(true);
      setConversation([]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to run review."
      );
      setPreliminaryReviewRan(false);
    } finally {
      setLoading(false);
    }
  };

  const continueScenario = async () => {
    if (!preliminaryReviewRan || !scenarioComplete) {
      setErrorMessage(
        "Please complete the property scenario, including occupancy."
      );
      return;
    }

    setChatLoading(true);
    setErrorMessage("");

    try {
      const prompt = `
${buildBorrowerContext()}

The borrower has completed the full intake and full property scenario.

Important rules:
- Do not ask again about transaction type.
- Do not ask again about realtor involvement.
- Do not ask again about loan officer selection.
- Do not ask again about home price.
- Do not ask again about down payment.
- Do not ask again about occupancy.
- Acknowledge that the intake is complete.
- Give a concise, professional next-step response.
- Invite the borrower to ask any remaining questions.
- Remind the borrower that the assigned licensed loan officer will review the file and advise next steps.
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

      const data = await response.json();
      const finalText =
        extractAiText(data) ||
        "Thank you. Your scenario has been organized for review by the assigned loan officer. You may now ask any remaining questions while the file is being reviewed.";

      setScenarioConfirmed(true);
      setConversation([
        {
          role: "assistant",
          content: finalText,
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to continue scenario."
      );
    } finally {
      setChatLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!conversationReady) {
      setErrorMessage(
        "Please complete and confirm the full intake and property scenario before continuing the conversation."
      );
      return;
    }

    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setChatLoading(true);
    setErrorMessage("");

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
          routing: {
            ...buildRoutingPayload(),
            conversation: nextConversation,
          },
          messages: [
            {
              role: "user",
              content: `${buildBorrowerContext()}

Continue the borrower-facing conversation naturally.
Do not repeat questions that are already answered in the context.
If the borrower asks about next steps, documentation, timing, or preparation, answer helpfully.
Do not give personalized rates or approval decisions.
Keep the response practical and professional.`,
            },
            ...nextConversation.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
      });

      const data = await response.json();
      const finalText =
        extractAiText(data) ||
        "Thank you. The assigned loan officer will review the scenario and advise next steps.";

      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: finalText },
      ]);
    } catch (error) {
      setConversation((prev) => prev.slice(0, -1));
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send message."
      );
    } finally {
      setChatLoading(false);
    }
  };

  const sendSummaryTrigger = async (trigger: SummaryTrigger) => {
    const payload = {
      lead: {
        fullName: intakeForm.fullName,
        email: intakeForm.email,
        phone: normalizePhoneForSms(intakeForm.phone),
        preferredLanguage: "English" as PreferredLanguage,
        loanOfficer:
          activeOfficer.id === "sandro-pansini-souza"
            ? "sandro"
            : activeOfficer.id === "warren-wendt"
            ? "warren"
            : "finley",
        assignedEmail: activeOfficer.email,
        realtorName: intakeForm.realtorName,
        realtorPhone: normalizePhoneForSms(intakeForm.realtorPhone),
      },
      trigger,
      messages: conversation,
    };

    const response = await fetch("/api/chat-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to send summary notification.");
    }

    return response.json().catch(() => null);
  };

  const handleAction = async (
    trigger: SummaryTrigger,
    action: "apply" | "schedule" | "email" | "call"
  ) => {
    if (!conversationReady) {
      setErrorMessage(
        "Please complete the scenario before using Next Actions."
      );
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await sendSummaryTrigger(trigger);

      if (action === "apply") {
        window.open(activeOfficer.applyUrl, "_blank", "noopener,noreferrer");
      }

      if (action === "schedule") {
        window.open(activeOfficer.scheduleUrl, "_blank", "noopener,noreferrer");
      }

      if (action === "email") {
        const mailtoHref = `mailto:${activeOfficer.email}?subject=${encodeURIComponent(
          `Borrower inquiry from ${intakeForm.fullName || "Beyond Intelligence"}`
        )}&body=${encodeURIComponent(
          `Hello ${activeOfficer.name}, I would like to discuss my mortgage scenario.`
        )}`;
        window.location.href = mailtoHref;
      }

      if (action === "call") {
        const officerPhone = normalizeDigitsOnly(activeOfficer.mobile);
        if (officerPhone) {
          window.location.href = `tel:${officerPhone}`;
        }
      }

      resetSession();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to complete action."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const selectionButtonStyle = (selected: boolean, locked: boolean) => ({
    ...styles.segmentButton,
    backgroundColor: selected ? "#62B3D6" : "#ffffff",
    color: selected ? "#ffffff" : "#6D7EA8",
    border: selected ? "1px solid #62B3D6" : "1px solid #B9C7E3",
    opacity: locked && selected ? 0.9 : 1,
    cursor: locked ? "default" : "pointer",
  });

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>

        <div style={navStyles.topBar}>
          <a href="/" style={navStyles.brand}>
            Beyond Intelligence™
          </a>
          <div style={navStyles.topBarLinks}>
            <a href="/" style={navStyles.topBarLink}>Home</a>
            <a href="/borrower" style={navStyles.topBarLink}>Start as Borrower</a>
            <a href="/team" style={navStyles.topBarLink}>Team Workspace</a>
          </div>
        </div>

        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>{t.heroTitle}</h1>
          <p style={styles.heroText}>{t.heroText}</p>
        </div>

        <div style={styles.grid}>
          <section style={styles.leftColumn}>
            <div style={styles.topInfoGrid}>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>{t.disclaimerTitle}</h2>
                <p style={styles.copyBlock}>{t.disclaimerText}</p>

                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>{t.acceptText}</span>
                </label>
              </div>

              <div style={styles.card}>
                <h2 style={styles.cardTitle}>{t.scenarioDirectionTitle}</h2>
                <p style={styles.copyBlock}>{t.scenarioDirectionText}</p>
                <p style={{ ...styles.copyBlock, marginTop: 20 }}>
                  {preliminaryReviewRan ? t.scenarioDirectionReady : ""}
                </p>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.segmentRow}>
                <button
                  type="button"
                  style={selectionButtonStyle(
                    transactionType === "purchase",
                    transactionLocked
                  )}
                  onClick={() => {
                    if (!transactionLocked) setTransactionType("purchase");
                  }}
                >
                  {t.purchase}
                </button>
                <button
                  type="button"
                  style={selectionButtonStyle(
                    transactionType === "refinance",
                    transactionLocked
                  )}
                  onClick={() => {
                    if (!transactionLocked) setTransactionType("refinance");
                  }}
                >
                  {t.refinance}
                </button>
                <button
                  type="button"
                  style={selectionButtonStyle(
                    transactionType === "investment",
                    transactionLocked
                  )}
                  onClick={() => {
                    if (!transactionLocked) setTransactionType("investment");
                  }}
                >
                  {t.investment}
                </button>
              </div>

              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  value={intakeForm.fullName}
                  onChange={(e) => setIntakeField("fullName", e.target.value)}
                  placeholder={t.borrowerName}
                />
                <input
                  style={styles.input}
                  value={intakeForm.email}
                  onChange={(e) => setIntakeField("email", e.target.value)}
                  placeholder={t.email}
                  type="email"
                />
                <input
                  style={styles.input}
                  value={intakeForm.phone}
                  onChange={(e) =>
                    setIntakeField("phone", formatPhoneDisplay(e.target.value))
                  }
                  placeholder={t.phone}
                />
                <input
                  style={styles.input}
                  value={intakeForm.credit}
                  onChange={(e) => setIntakeField("credit", e.target.value)}
                  placeholder={t.credit}
                />
                <input
                  style={styles.input}
                  value={intakeForm.income}
                  onChange={(e) =>
                    setIntakeField("income", formatNumberInput(e.target.value))
                  }
                  placeholder={t.income}
                />
                <input
                  style={styles.input}
                  value={intakeForm.debt}
                  onChange={(e) =>
                    setIntakeField("debt", formatNumberInput(e.target.value))
                  }
                  placeholder={t.debt}
                />
                <input
                  style={styles.input}
                  value={intakeForm.currentState}
                  onChange={(e) =>
                    setIntakeField("currentState", e.target.value.toUpperCase())
                  }
                  placeholder={t.currentState}
                  maxLength={2}
                />
                <input
                  style={styles.input}
                  value={intakeForm.targetState}
                  onChange={(e) =>
                    setIntakeField("targetState", e.target.value.toUpperCase())
                  }
                  placeholder={t.targetState}
                  maxLength={2}
                />
              </div>

              <div style={styles.sectionLabel}>{t.workingWithRealtor}</div>

              <div style={styles.segmentRowSmall}>
                <button
                  type="button"
                  style={selectionButtonStyle(
                    realtorStatus === "yes",
                    realtorLocked
                  )}
                  onClick={() => {
                    if (!realtorLocked) setRealtorStatus("yes");
                  }}
                >
                  {t.yes}
                </button>
                <button
                  type="button"
                  style={selectionButtonStyle(
                    realtorStatus === "no",
                    realtorLocked
                  )}
                  onClick={() => {
                    if (!realtorLocked) {
                      setRealtorStatus("no");
                      setIntakeField("realtorName", "");
                      setIntakeField("realtorPhone", "");
                    }
                  }}
                >
                  {t.no}
                </button>
                <button
                  type="button"
                  style={selectionButtonStyle(
                    realtorStatus === "not_sure",
                    realtorLocked
                  )}
                  onClick={() => {
                    if (!realtorLocked) {
                      setRealtorStatus("not_sure");
                      setIntakeField("realtorName", "");
                      setIntakeField("realtorPhone", "");
                    }
                  }}
                >
                  {t.notSure}
                </button>
              </div>

              {realtorStatus === "yes" && (
                <div style={{ ...styles.formGrid, marginTop: 12 }}>
                  <input
                    style={styles.input}
                    value={intakeForm.realtorName}
                    onChange={(e) =>
                      setIntakeField("realtorName", e.target.value)
                    }
                    placeholder={t.realtorName}
                  />
                  <input
                    style={styles.input}
                    value={intakeForm.realtorPhone}
                    onChange={(e) =>
                      setIntakeField(
                        "realtorPhone",
                        formatPhoneDisplay(e.target.value)
                      )
                    }
                    placeholder={t.realtorPhone}
                  />
                </div>
              )}

              <div style={{ marginTop: 16, position: "relative" }}>
                <input
                  style={styles.input}
                  value={loanOfficerQuery}
                  onChange={(e) => {
                    if (!loanOfficerConfirmed) {
                      setLoanOfficerQuery(e.target.value);
                      setSelectedOfficer(null);
                    }
                  }}
                  placeholder={t.loanOfficerPlaceholder}
                />

                {!loanOfficerConfirmed && officerSuggestions.length > 0 && (
                  <div style={styles.suggestionBox}>
                    {officerSuggestions.map((officer) => (
                      <button
                        key={officer.id}
                        type="button"
                        style={styles.suggestionItem}
                        onClick={() => {
                          setSelectedOfficer(officer);
                          setLoanOfficerQuery(
                            `${officer.name} — NMLS ${officer.nmls}`
                          );
                        }}
                      >
                        {officer.name} — NMLS {officer.nmls}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.helperText}>{t.loanOfficerPlaceholder}</div>

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={confirmOfficerSelection}
                  disabled={loanOfficerConfirmed}
                  style={{
                    ...styles.primaryButton,
                    backgroundColor: loanOfficerConfirmed
                      ? "#8BB7CC"
                      : "#62B3D6",
                    cursor: loanOfficerConfirmed ? "default" : "pointer",
                    opacity: loanOfficerConfirmed ? 0.9 : 1,
                  }}
                >
                  {loanOfficerConfirmed
                    ? t.confirmedLoanOfficer
                    : t.confirmLoanOfficer}
                </button>

                <button
                  type="button"
                  onClick={useDefaultFinley}
                  disabled={loanOfficerConfirmed}
                  style={{
                    ...styles.outlineButton,
                    opacity: loanOfficerConfirmed ? 0.7 : 1,
                    cursor: loanOfficerConfirmed ? "default" : "pointer",
                  }}
                >
                  {t.unknownLoanOfficer}
                </button>
              </div>

              <div style={styles.routingBox}>
                <div style={styles.routingEyebrow}>{t.assignedRouting}</div>
                <div style={styles.routingTitle}>
                  {activeOfficer.name} — NMLS {activeOfficer.nmls}
                </div>
                <div style={styles.routingText}>
                  {t.routingPrefix} {activeOfficer.email} and{" "}
                  {activeOfficer.assistantEmail}.
                </div>
              </div>

              <button
                type="button"
                onClick={runPreliminaryReview}
                disabled={loading}
                style={{
                  ...styles.primaryButton,
                  marginTop: 16,
                  backgroundColor: "#1493C7",
                }}
              >
                {loading ? t.loading : t.runPreliminaryReview}
              </button>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>{t.propertyScenario}</h2>

              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  value={scenario.homePrice}
                  onChange={(e) =>
                    setScenarioField(
                      "homePrice",
                      formatNumberInput(e.target.value)
                    )
                  }
                  placeholder={t.homePrice}
                  disabled={scenarioConfirmed}
                />
                <input
                  style={styles.input}
                  value={scenario.downPayment}
                  onChange={(e) =>
                    setScenarioField(
                      "downPayment",
                      formatNumberInput(e.target.value)
                    )
                  }
                  placeholder={t.downPayment}
                  disabled={scenarioConfirmed}
                />
              </div>

              <select
                style={{
                  ...styles.input,
                  marginTop: 14,
                  opacity: scenarioConfirmed ? 0.9 : 1,
                }}
                value={scenario.occupancy}
                onChange={(e) =>
                  setScenarioField("occupancy", e.target.value as OccupancyType)
                }
                disabled={scenarioConfirmed}
              >
                <option value="">{t.occupancy}</option>
                <option value="primary_residence">{t.primaryResidence}</option>
                <option value="second_home">{t.secondHome}</option>
                <option value="investment_property">
                  {t.investmentProperty}
                </option>
              </select>

              <div style={styles.loanBox}>
                <div style={styles.loanEyebrow}>{t.estimatedLoanAmount}</div>
                <div style={styles.loanAmount}>
                  {formatCurrency(estimatedLoanAmount)}
                </div>
                <div style={styles.loanLtv}>
                  {t.estimatedLtv}: {estimatedLtv || 0}%
                </div>
              </div>

              <button
                type="button"
                onClick={continueScenario}
                disabled={chatLoading || scenarioConfirmed}
                style={{
                  ...styles.secondaryButton,
                  backgroundColor: "#8A95B8",
                  opacity: scenarioConfirmed ? 0.9 : 1,
                  cursor: scenarioConfirmed ? "default" : "pointer",
                }}
              >
                {scenarioConfirmed ? t.scenarioConfirmed : t.continueScenario}
              </button>
            </div>
          </section>

          <section style={styles.rightColumn}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>{t.conversationTitle}</h2>

              {!conversationReady && (
                <div style={styles.placeholderBox}>
                  {t.conversationPlaceholder}
                </div>
              )}

                            <div style={styles.chatArea}>
                {conversation.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    style={{
                      ...styles.chatBubble,
                      backgroundColor:
                        message.role === "assistant" ? "#F4F7FC" : "#263366",
                      color:
                        message.role === "assistant" ? "#334A7D" : "#ffffff",
                    }}
                  >
                    {message.content}
                  </div>
                ))}
              </div>

              <textarea
                style={styles.textarea}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t.chatPlaceholder}
                disabled={!conversationReady || chatLoading}
              />

              <button
                type="button"
                onClick={sendChatMessage}
                disabled={!conversationReady || chatLoading || !chatInput.trim()}
                style={{
                  ...styles.sendButton,
                  backgroundColor:
                    !conversationReady || chatLoading || !chatInput.trim()
                      ? "#B7C0D6"
                      : "#8A95B8",
                  cursor:
                    !conversationReady || chatLoading || !chatInput.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {chatLoading ? t.loading : t.sendMessage}
              </button>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>{t.nextActions}</h2>

              <div style={styles.actionStack}>
                <button
                  type="button"
                  onClick={() => handleAction("apply", "apply")}
                  disabled={actionLoading}
                  style={styles.actionPrimary}
                >
                  {t.applyNow}
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("schedule", "schedule")}
                  disabled={actionLoading}
                  style={styles.actionPrimary}
                >
                  {t.schedule}
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("contact", "email")}
                  disabled={actionLoading}
                  style={styles.actionOutline}
                >
                  {t.emailOfficer}
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("contact", "call")}
                  disabled={actionLoading}
                  style={styles.actionOutline}
                >
                  {t.callOfficer}
                </button>
              </div>
            </div>

            {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#EEF2F8",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#263366",
  },
  wrap: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "24px 18px 32px",
  },
  hero: {
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
    color: "#22396F",
  },
  heroText: {
    marginTop: 8,
    fontSize: 16,
    color: "#5C709A",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 18,
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  topInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  card: {
    background: "#F7F9FD",
    border: "1px solid #C9D5EA",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset",
  },
  cardTitle: {
    margin: 0,
    marginBottom: 14,
    fontSize: 18,
    fontWeight: 800,
    color: "#203A76",
  },
  copyBlock: {
    margin: 0,
    lineHeight: 1.75,
    fontSize: 14,
    color: "#6B7DA5",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    fontSize: 14,
  },
  segmentRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  segmentRowSmall: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  segmentButton: {
    padding: "13px 16px",
    borderRadius: 16,
    fontWeight: 700,
    fontSize: 14,
    minHeight: 48,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  input: {
    width: "100%",
    border: "1px solid #C8D4E8",
    borderRadius: 16,
    padding: "14px 14px",
    fontSize: 14,
    color: "#233B73",
    background: "#FDFEFE",
    outline: "none",
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: 700,
    color: "#6A7DA8",
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: "#92A0C0",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  primaryButton: {
    border: "none",
    borderRadius: 16,
    color: "#ffffff",
    padding: "12px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  secondaryButton: {
    border: "none",
    borderRadius: 16,
    color: "#ffffff",
    padding: "12px 18px",
    fontWeight: 800,
    fontSize: 14,
    marginTop: 16,
  },
  outlineButton: {
    border: "1px solid #B9C7E3",
    borderRadius: 16,
    color: "#6D7EA8",
    background: "#FDFEFE",
    padding: "12px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  routingBox: {
    marginTop: 14,
    border: "1px solid #C8D4E8",
    borderRadius: 18,
    padding: 16,
    background: "#F1F5FB",
  },
  routingEyebrow: {
    fontSize: 12,
    fontWeight: 800,
    color: "#94A3C4",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  routingTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#5C709A",
    marginBottom: 8,
  },
  routingText: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#8A9AB8",
  },
  loanBox: {
    marginTop: 16,
    border: "1px solid #C8D4E8",
    borderRadius: 18,
    padding: 16,
    background: "#F1F5FB",
  },
  loanEyebrow: {
    fontSize: 12,
    fontWeight: 800,
    color: "#94A3C4",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  loanAmount: {
    fontSize: 18,
    fontWeight: 800,
    color: "#5C709A",
    marginBottom: 8,
  },
  loanLtv: {
    fontSize: 14,
    color: "#7A8DB3",
  },
  placeholderBox: {
    border: "1px solid #D5DEEE",
    background: "#F6F8FD",
    borderRadius: 18,
    padding: 16,
    fontSize: 14,
    color: "#7B8EBA",
    lineHeight: 1.7,
    marginBottom: 14,
  },
  chatArea: {
    maxHeight: 420,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 12,
  },
  chatBubble: {
    borderRadius: 18,
    padding: 16,
    lineHeight: 1.7,
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
  textarea: {
    width: "100%",
    minHeight: 105,
    border: "1px solid #C8D4E8",
    borderRadius: 18,
    padding: 14,
    fontSize: 14,
    resize: "vertical",
    outline: "none",
    color: "#233B73",
    background: "#FDFEFE",
  },
  sendButton: {
    width: "100%",
    border: "none",
    borderRadius: 16,
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 800,
    fontSize: 14,
    marginTop: 14,
    cursor: "pointer",
  },
  actionStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  actionPrimary: {
    border: "none",
    borderRadius: 16,
    color: "#ffffff",
    background: "#1493C7",
    padding: "14px 18px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  actionOutline: {
    border: "1px solid #233B73",
    borderRadius: 16,
    color: "#233B73",
    background: "#FDFEFE",
    padding: "14px 18px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  errorBox: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#991B1B",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    lineHeight: 1.6,
  },
  suggestionBox: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    background: "#ffffff",
    border: "1px solid #CBD5E1",
    borderRadius: 14,
    overflow: "hidden",
    zIndex: 20,
  },
  suggestionItem: {
    width: "100%",
    border: "none",
    background: "#ffffff",
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 14,
    color: "#233B73",
    cursor: "pointer",
  },
};
const navStyles: Record<string, React.CSSProperties> = {
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
    padding: "4px 2px",
    flexWrap: "wrap",
  },
  brand: {
    textDecoration: "none",
    color: "#263366",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  topBarLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  topBarLink: {
    textDecoration: "none",
    color: "#263366",
    background: "#F7F9FD",
    border: "1px solid #C9D5EA",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  },
};
