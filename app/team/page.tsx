"use client";

import React, { useEffect, useMemo, useState } from "react";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Real Estate Agent";

type FileStage =
  | "intake"
  | "disclosures"
  | "processing"
  | "underwriting"
  | "conditional_approval"
  | "clear_to_close"
  | "closing"
  | "closed";

type MilestoneStatus = "pending" | "completed";

type TeamUser = {
  id: string;
  name: string;
  role: TeamRole;
  nmls?: string;
  email: string;
  company: string;
};

type TeamFile = {
  id: string;
  fileNumber: string;
  borrowerName: string;
  coborrowerName?: string;
  email: string;
  phone: string;
  preferredLanguage: "English" | "Português" | "Español";
  loanOfficerId: string;
  processorId?: string;
  loaId?: string;
  propertyAddress: string;
  state: string;
  occupancy: "Primary Residence" | "Second Home" | "Investment Property";
  transactionType:
    | "Purchase"
    | "Rate/Term Refinance"
    | "Cash-Out Refinance"
    | "HELOC"
    | "DSCR"
    | "Bank Statement"
    | "ITIN";
  loanAmount: number;
  homeValue: number;
  downPayment?: number;
  fico?: number;
  monthlyIncome?: number;
  monthlyDebt?: number;
  assets?: number;
  notes: string;
  stage: FileStage;
  lastUpdated: string;
  audit: {
    docsReviewed: MilestoneStatus;
    finleyAnalysisRequested: MilestoneStatus;
    sentToProcessing: MilestoneStatus;
    underwritingSubmitted: MilestoneStatus;
    clearToCloseIssued: MilestoneStatus;
  };
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type AnalysisCard = {
  fileSummary: string;
  riskFlags: string[];
  missingItems: string[];
  nextBestStep: string;
  directionalPrograms: string[];
};

const CHAT_API_PATH = "/api/chat";
const SUMMARY_API_PATH = "/api/chat-summary";

const TEAM_USERS: TeamUser[] = [
  {
    id: "sandro",
    name: "Sandro Pansini Souza",
    role: "Loan Officer",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    company: "Beyond Financing",
  },
  {
    id: "warren",
    name: "Warren Wendt",
    role: "Loan Officer",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    company: "Beyond Financing",
  },
  {
    id: "bia",
    name: "Bia Marques",
    role: "Loan Officer Assistant",
    email: "bia@beyondfinancing.com",
    company: "Beyond Financing",
  },
  {
    id: "amarilis",
    name: "Amarilis Santos",
    role: "Processor",
    email: "amarilis@beyondfinancing.com",
    company: "Beyond Financing",
  },
  {
    id: "kyle",
    name: "Kyle Nicholson",
    role: "Processor",
    email: "kyle@beyondfinancing.com",
    company: "Beyond Financing",
  },
];

const INITIAL_FILES: TeamFile[] = [
  {
    id: "file-1001",
    fileNumber: "BF-1001",
    borrowerName: "Maria Oliveira",
    coborrowerName: "João Oliveira",
    email: "maria@example.com",
    phone: "617-555-0144",
    preferredLanguage: "Português",
    loanOfficerId: "sandro",
    processorId: "amarilis",
    loaId: "bia",
    propertyAddress: "12 Sample Street, Saugus, MA",
    state: "MA",
    occupancy: "Primary Residence",
    transactionType: "Purchase",
    loanAmount: 540000,
    homeValue: 600000,
    downPayment: 60000,
    fico: 702,
    monthlyIncome: 12800,
    monthlyDebt: 950,
    assets: 72000,
    notes:
      "Borrower is looking for owner-occupied purchase. Portuguese-speaking household. Initial docs partially in.",
    stage: "processing",
    lastUpdated: new Date().toISOString(),
    audit: {
      docsReviewed: "completed",
      finleyAnalysisRequested: "pending",
      sentToProcessing: "completed",
      underwritingSubmitted: "pending",
      clearToCloseIssued: "pending",
    },
  },
  {
    id: "file-1002",
    fileNumber: "BF-1002",
    borrowerName: "Carlos Ramirez",
    email: "carlos@example.com",
    phone: "857-555-0198",
    preferredLanguage: "Español",
    loanOfficerId: "warren",
    processorId: "kyle",
    propertyAddress: "88 Market Ave, Lynn, MA",
    state: "MA",
    occupancy: "Investment Property",
    transactionType: "DSCR",
    loanAmount: 410000,
    homeValue: 575000,
    fico: 689,
    monthlyIncome: 0,
    monthlyDebt: 0,
    assets: 98000,
    notes:
      "Investor scenario. Needs cleaner rent support and entity review. Finley should identify missing items and likely direction.",
    stage: "underwriting",
    lastUpdated: new Date().toISOString(),
    audit: {
      docsReviewed: "completed",
      finleyAnalysisRequested: "completed",
      sentToProcessing: "completed",
      underwritingSubmitted: "completed",
      clearToCloseIssued: "pending",
    },
  },
  {
    id: "file-1003",
    fileNumber: "BF-1003",
    borrowerName: "Ana Costa",
    email: "ana@example.com",
    phone: "781-555-0183",
    preferredLanguage: "English",
    loanOfficerId: "sandro",
    processorId: "amarilis",
    propertyAddress: "3 Ocean View Rd, Revere, MA",
    state: "MA",
    occupancy: "Primary Residence",
    transactionType: "Bank Statement",
    loanAmount: 625000,
    homeValue: 760000,
    downPayment: 135000,
    fico: 719,
    monthlyIncome: 15400,
    monthlyDebt: 1200,
    assets: 161000,
    notes:
      "Self-employed borrower. Bank-statement direction likely. Need clearer business seasoning and liquidity organization.",
    stage: "conditional_approval",
    lastUpdated: new Date().toISOString(),
    audit: {
      docsReviewed: "completed",
      finleyAnalysisRequested: "pending",
      sentToProcessing: "completed",
      underwritingSubmitted: "completed",
      clearToCloseIssued: "pending",
    },
  },
];

function currency(value?: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function percent(numerator?: number, denominator?: number) {
  if (!numerator || !denominator || denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function titleizeStage(stage: FileStage) {
  return stage
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function getUserById(id?: string) {
  return TEAM_USERS.find((user) => user.id === id) || null;
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
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
      answer?: string;
    };

    return (
      obj.choices?.[0]?.message?.content ||
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
      obj.answer ||
      obj.nextQuestion ||
      JSON.stringify(obj, null, 2)
    );
  }

  return "";
}

function parseAnalysisBlock(text: string): AnalysisCard {
  const fallback: AnalysisCard = {
    fileSummary: text,
    riskFlags: [],
    missingItems: [],
    nextBestStep: "Review the response and move the file to the next documented milestone.",
    directionalPrograms: [],
  };

  const summaryMatch = text.match(/FILE_SUMMARY:\s*([\s\S]*?)\nRISK_FLAGS:/i);
  const riskMatch = text.match(/RISK_FLAGS:\s*([\s\S]*?)\nMISSING_ITEMS:/i);
  const missingMatch = text.match(/MISSING_ITEMS:\s*([\s\S]*?)\nNEXT_BEST_STEP:/i);
  const nextStepMatch = text.match(/NEXT_BEST_STEP:\s*([\s\S]*?)\nDIRECTIONAL_PROGRAMS:/i);
  const programsMatch = text.match(/DIRECTIONAL_PROGRAMS:\s*([\s\S]*)$/i);

  const toList = (block?: string | null) =>
    (block || "")
      .split("\n")
      .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
      .filter(Boolean);

  return {
    fileSummary: summaryMatch?.[1]?.trim() || fallback.fileSummary,
    riskFlags: toList(riskMatch?.[1]),
    missingItems: toList(missingMatch?.[1]),
    nextBestStep: nextStepMatch?.[1]?.trim() || fallback.nextBestStep,
    directionalPrograms: toList(programsMatch?.[1]),
  };
}

export default function TeamPage() {
  const [teamFiles, setTeamFiles] = useState<TeamFile[]>(INITIAL_FILES);
  const [selectedFileId, setSelectedFileId] = useState<string>(INITIAL_FILES[0].id);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "audit">(
    "overview"
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [analysisCard, setAnalysisCard] = useState<AnalysisCard | null>(null);

  const [summaryLoading, setSummaryLoading] = useState<null | "ai" | "processing" | "milestone">(
    null
  );
  const [summaryMessage, setSummaryMessage] = useState("");
  const [localUser] = useState<TeamUser>(TEAM_USERS[0]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamFiles;

    return teamFiles.filter((file) => {
      const loanOfficer = getUserById(file.loanOfficerId);
      const processor = getUserById(file.processorId);

      return [
        file.fileNumber,
        file.borrowerName,
        file.coborrowerName || "",
        file.propertyAddress,
        file.transactionType,
        file.stage,
        loanOfficer?.name || "",
        processor?.name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [search, teamFiles]);

  const selectedFile =
    teamFiles.find((file) => file.id === selectedFileId) || teamFiles[0];

  const loanOfficer = getUserById(selectedFile?.loanOfficerId);
  const processor = getUserById(selectedFile?.processorId);
  const loa = getUserById(selectedFile?.loaId);

  useEffect(() => {
    setChatMessages([]);
    setChatInput("");
    setChatError("");
    setAnalysisCard(null);
    setSummaryMessage("");
  }, [selectedFileId]);

  const ltvText = useMemo(() => {
    if (!selectedFile) return "0%";
    return percent(selectedFile.loanAmount, selectedFile.homeValue);
  }, [selectedFile]);

  const fileContext = useMemo(() => {
    if (!selectedFile) return "";

    return `
TCC FILE CONTEXT
- File Number: ${selectedFile.fileNumber}
- Borrower: ${selectedFile.borrowerName}
- Co-Borrower: ${selectedFile.coborrowerName || "Not provided"}
- Email: ${selectedFile.email}
- Phone: ${selectedFile.phone}
- Preferred Language: ${selectedFile.preferredLanguage}
- Property Address: ${selectedFile.propertyAddress}
- State: ${selectedFile.state}
- Transaction Type: ${selectedFile.transactionType}
- Occupancy: ${selectedFile.occupancy}
- Loan Amount: ${selectedFile.loanAmount}
- Home Value: ${selectedFile.homeValue}
- Down Payment: ${selectedFile.downPayment || 0}
- Estimated LTV: ${ltvText}
- FICO: ${selectedFile.fico || 0}
- Monthly Income: ${selectedFile.monthlyIncome || 0}
- Monthly Debt: ${selectedFile.monthlyDebt || 0}
- Assets: ${selectedFile.assets || 0}
- Stage: ${titleizeStage(selectedFile.stage)}
- Assigned Loan Officer: ${loanOfficer?.name || "Not assigned"}
- Assigned Loan Officer NMLS: ${loanOfficer?.nmls || "Not provided"}
- Assigned Processor: ${processor?.name || "Not assigned"}
- Assigned LOA: ${loa?.name || "Not assigned"}
- Notes: ${selectedFile.notes}

AUDIT STATUS
- Docs Reviewed: ${selectedFile.audit.docsReviewed}
- Finley Analysis Requested: ${selectedFile.audit.finleyAnalysisRequested}
- Sent To Processing: ${selectedFile.audit.sentToProcessing}
- Underwriting Submitted: ${selectedFile.audit.underwritingSubmitted}
- Clear To Close Issued: ${selectedFile.audit.clearToCloseIssued}
    `.trim();
  }, [selectedFile, loanOfficer, processor, loa, ltvText]);

  const buildFinleySystemPrompt = (mode: "initial" | "follow_up") => {
    return `
You are Finley Beyond inside the Team Command Center for licensed mortgage professionals.

Your audience is an internal mortgage operations user, not the borrower.

Your job:
- analyze the selected loan file
- identify risk, missing documentation, and next step
- provide directional program thinking only
- do not promise approval
- do not fabricate lender overlays
- stay practical and execution-oriented
- think like an elite mortgage advisor and production desk

Important output rules:
- be concise but useful
- if facts are missing, say exactly what is missing
- directional program discussion can include agency, FHA, VA, bank statement, DSCR, ITIN, asset utilization, HELOC, non-QM style direction when supported by the file
- no exact rates
- no false certainty

If mode is initial, return in this exact format:

FILE_SUMMARY:
<short paragraph>

RISK_FLAGS:
- item
- item

MISSING_ITEMS:
- item
- item

NEXT_BEST_STEP:
<one actionable next step>

DIRECTIONAL_PROGRAMS:
- item
- item

If mode is follow_up, answer the user’s internal question directly, then end with:
NEXT_STEP:
<one actionable next step>
    `.trim();
  };

  async function callFinley(mode: "initial" | "follow_up", prompt: string) {
    const conversationToSend =
      mode === "initial"
        ? [{ role: "user", content: prompt }]
        : [
            ...chatMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: "user", content: prompt },
          ];

    const response = await fetch(CHAT_API_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: mode === "initial" ? "team_tcc_initial" : "team_tcc_follow_up",
        teamMode: true,
        messages: [
          {
            role: "user",
            content: `${buildFinleySystemPrompt(mode)}

${fileContext}

INTERNAL USER:
${prompt}`,
          },
          ...conversationToSend,
        ],
        routing: {
          teamUser: {
            id: localUser.id,
            name: localUser.name,
            role: localUser.role,
            email: localUser.email,
          },
          file: {
            id: selectedFile.id,
            fileNumber: selectedFile.fileNumber,
            borrowerName: selectedFile.borrowerName,
            email: selectedFile.email,
            phone: selectedFile.phone,
            preferredLanguage: selectedFile.preferredLanguage,
            loanOfficer: loanOfficer?.name || "",
            assignedEmail: loanOfficer?.email || "finley@beyondfinancing.com",
            processor: processor?.name || "",
            stage: selectedFile.stage,
            transactionType: selectedFile.transactionType,
          },
        },
      }),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(extractAiText(data) || "Finley request failed.");
    }

    return extractAiText(data);
  }

  async function runInitialAnalysis() {
    if (!selectedFile) return;

    setChatLoading(true);
    setChatError("");
    setSummaryMessage("");

    const openingPrompt = `
Please analyze this TCC file for the internal team.
Identify the file summary, risk flags, missing items, next best step, and directional program direction.
    `.trim();

    try {
      const finalText =
        (await callFinley("initial", openingPrompt)) ||
        "No analysis was returned from Finley.";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: finalText,
      };

      setChatMessages([assistantMessage]);
      setAnalysisCard(parseAnalysisBlock(finalText));

      setTeamFiles((prev) =>
        prev.map((file) =>
          file.id === selectedFile.id
            ? {
                ...file,
                lastUpdated: new Date().toISOString(),
                audit: {
                  ...file.audit,
                  finleyAnalysisRequested: "completed",
                },
              }
            : file
        )
      );
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to complete Finley analysis."
      );
      setChatMessages([]);
      setAnalysisCard(null);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendFollowUpMessage() {
    if (!selectedFile || !chatInput.trim()) return;

    setChatLoading(true);
    setChatError("");
    setSummaryMessage("");

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
    };

    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");

    try {
      const finalText =
        (await callFinley("follow_up", userMessage.content)) ||
        "No response was returned from Finley.";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: finalText,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setChatMessages((prev) => prev.slice(0, -1));
      setChatError(
        error instanceof Error ? error.message : "Unable to continue the Finley conversation."
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function sendSummaryEmail(trigger: "ai" | "processing" | "milestone") {
    if (!selectedFile || !loanOfficer) return;

    setSummaryLoading(trigger);
    setSummaryMessage("");
    setChatError("");

    try {
      const summaryTriggerMap = {
        ai: "ai",
        processing: "contact",
        milestone: "schedule",
      } as const;

      const summaryBody = {
        lead: {
          fullName: selectedFile.borrowerName,
          email: selectedFile.email,
          phone: selectedFile.phone,
          preferredLanguage: selectedFile.preferredLanguage,
          loanOfficer: loanOfficer.name.toLowerCase().includes("sandro")
            ? "sandro"
            : loanOfficer.name.toLowerCase().includes("warren")
            ? "warren"
            : "finley",
          assignedEmail: loanOfficer.email,
        },
        trigger: summaryTriggerMap[trigger],
        messages:
          chatMessages.length > 0
            ? chatMessages
            : [
                {
                  role: "assistant",
                  content: `Internal TCC summary request for ${selectedFile.fileNumber}. ${selectedFile.notes}`,
                },
              ],
      };

      const response = await fetch(SUMMARY_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(summaryBody),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(extractAiText(data) || "Summary email failed.");
      }

      if (trigger === "processing") {
        setTeamFiles((prev) =>
          prev.map((file) =>
            file.id === selectedFile.id
              ? {
                  ...file,
                  stage:
                    file.stage === "intake" || file.stage === "disclosures"
                      ? "processing"
                      : file.stage,
                  lastUpdated: new Date().toISOString(),
                  audit: {
                    ...file.audit,
                    sentToProcessing: "completed",
                  },
                }
              : file
          )
        );
      }

      if (trigger === "milestone") {
        setTeamFiles((prev) =>
          prev.map((file) =>
            file.id === selectedFile.id
              ? {
                  ...file,
                  lastUpdated: new Date().toISOString(),
                  audit: {
                    ...file.audit,
                    docsReviewed: "completed",
                  },
                }
              : file
          )
        );
      }

      setSummaryMessage("Internal summary email sent successfully.");
    } catch (error) {
      setSummaryMessage(
        error instanceof Error ? error.message : "Unable to send the summary email."
      );
    } finally {
      setSummaryLoading(null);
    }
  }

  function updateAuditStatus(key: keyof TeamFile["audit"], value:
