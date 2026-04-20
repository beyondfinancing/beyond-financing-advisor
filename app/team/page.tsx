"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FileStage =
  | "new_scenario"
  | "pre_approval_review"
  | "sent_to_processing"
  | "processing_active"
  | "submitted_to_lender"
  | "conditional_approval"
  | "clear_to_close"
  | "closed";

type PriorityLevel = "standard" | "priority" | "rush";

type TeamFile = {
  id: string;
  borrowerName: string;
  loanOfficer: string;
  processor: string;
  purpose: string;
  occupancy: string;
  amount: string;
  targetCloseDate: string;
  stage: FileStage;
  priority: PriorityLevel;
  ageDays: number;
  lastUpdate: string;
  blocker: string;
  nextInternalAction: string;
  nextBorrowerAction: string;
};

type FileUpdate = {
  id: string;
  fileId: string;
  author: string;
  role: "Loan Officer" | "Processor" | "Assistant" | "System";
  time: string;
  text: string;
};

type FinleyChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STAGE_LABELS: Record<FileStage, string> = {
  new_scenario: "New Scenario",
  pre_approval_review: "Pre-Approval Review",
  sent_to_processing: "Sent to Processing",
  processing_active: "Processing Active",
  submitted_to_lender: "Submitted to Lender",
  conditional_approval: "Conditional Approval",
  clear_to_close: "Clear to Close",
  closed: "Closed",
};

const STAGE_ORDER: FileStage[] = [
  "new_scenario",
  "pre_approval_review",
  "sent_to_processing",
  "processing_active",
  "submitted_to_lender",
  "conditional_approval",
  "clear_to_close",
  "closed",
];

const mockFiles: TeamFile[] = [
  {
    id: "BF-24001",
    borrowerName: "Mariana Costa",
    loanOfficer: "Sandro Pansini Souza",
    processor: "Amarilis Santos",
    purpose: "Purchase",
    occupancy: "Primary Residence",
    amount: "$612,000",
    targetCloseDate: "2026-05-18",
    stage: "sent_to_processing",
    priority: "priority",
    ageDays: 2,
    lastUpdate: "Initial processor handoff completed. Income docs under review.",
    blocker: "Awaiting updated bank statements.",
    nextInternalAction: "Processor to issue first doc checklist.",
    nextBorrowerAction: "Upload latest 2 months asset statements.",
  },
  {
    id: "BF-24002",
    borrowerName: "Daniel Ribeiro",
    loanOfficer: "Warren Wendt",
    processor: "Kyle Nicholson",
    purpose: "Rate/Term Refinance",
    occupancy: "Primary Residence",
    amount: "$438,500",
    targetCloseDate: "2026-05-11",
    stage: "processing_active",
    priority: "standard",
    ageDays: 6,
    lastUpdate: "VOE and title request in progress.",
    blocker: "Need homeowners insurance dec page.",
    nextInternalAction: "Processor to confirm title status.",
    nextBorrowerAction: "Provide current insurance declaration page.",
  },
  {
    id: "BF-24003",
    borrowerName: "Patricia Mendez",
    loanOfficer: "Sandro Pansini Souza",
    processor: "Bia Marques",
    purpose: "Purchase",
    occupancy: "Investment Property",
    amount: "$829,000",
    targetCloseDate: "2026-05-27",
    stage: "conditional_approval",
    priority: "rush",
    ageDays: 14,
    lastUpdate: "Conditional approval issued. Appraisal acceptable.",
    blocker: "Conditions package not fully cleared.",
    nextInternalAction: "LO and processor to split borrower conditions.",
    nextBorrowerAction: "Provide updated operating agreement and reserves proof.",
  },
  {
    id: "BF-24004",
    borrowerName: "Lucas Andrade",
    loanOfficer: "Nate Hubley",
    processor: "Amarilis Santos",
    purpose: "HELOC",
    occupancy: "Primary Residence",
    amount: "$185,000",
    targetCloseDate: "2026-05-08",
    stage: "submitted_to_lender",
    priority: "priority",
    ageDays: 5,
    lastUpdate: "Submission sent. Awaiting lender acknowledgment.",
    blocker: "None currently.",
    nextInternalAction: "Monitor lender touchpoint turnaround.",
    nextBorrowerAction: "Stand by for any lender conditions.",
  },
];

const initialUpdates: FileUpdate[] = [
  {
    id: "U-1",
    fileId: "BF-24001",
    author: "Sandro Pansini Souza",
    role: "Loan Officer",
    time: "Today · 9:18 AM",
    text: "Borrower verbally confirmed funds are seasoned. Processor may proceed with checklist.",
  },
  {
    id: "U-2",
    fileId: "BF-24001",
    author: "Amarilis Santos",
    role: "Processor",
    time: "Today · 10:02 AM",
    text: "Checklist drafted. Waiting on updated statements before I issue final processing request.",
  },
  {
    id: "U-3",
    fileId: "BF-24003",
    author: "System",
    role: "System",
    time: "Today · 8:21 AM",
    text: "Conditional approval milestone updated. File elevated to rush priority.",
  },
  {
    id: "U-4",
    fileId: "BF-24002",
    author: "Kyle Nicholson",
    role: "Processor",
    time: "Yesterday · 4:37 PM",
    text: "VOE ordered. Insurance still outstanding.",
  },
];

function stageColor(stage: FileStage) {
  switch (stage) {
    case "new_scenario":
      return { bg: "#EEF4FF", text: "#3451A3", border: "#D8E3FF" };
    case "pre_approval_review":
      return { bg: "#F5F3FF", text: "#5B3FA8", border: "#E1D9FF" };
    case "sent_to_processing":
      return { bg: "#ECFEFF", text: "#0F7490", border: "#BDEFF5" };
    case "processing_active":
      return { bg: "#EFFCF5", text: "#157347", border: "#C9F0D9" };
    case "submitted_to_lender":
      return { bg: "#FFF7ED", text: "#B45309", border: "#FED7AA" };
    case "conditional_approval":
      return { bg: "#FFF7ED", text: "#C2410C", border: "#FDBA74" };
    case "clear_to_close":
      return { bg: "#ECFDF3", text: "#047857", border: "#A7F3D0" };
    case "closed":
      return { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" };
    default:
      return { bg: "#F8FAFC", text: "#334155", border: "#E2E8F0" };
  }
}

function priorityColor(priority: PriorityLevel) {
  switch (priority) {
    case "rush":
      return { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" };
    case "priority":
      return { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" };
    default:
      return { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" };
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTimeNow() {
  return new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function metricCard(
  _label: string,
  _value: string,
  _subtext: string
): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(217,225,236,0.92)",
    borderRadius: 24,
    padding: 20,
    boxShadow:
      "0 16px 36px rgba(38,51,102,0.06), inset 0 1px 0 rgba(255,255,255,0.72)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  };
}

function buildTeamFileContext(file: TeamFile) {
  return `
Team Command Center file context:

- File ID: ${file.id}
- Borrower Name: ${file.borrowerName}
- Loan Officer: ${file.loanOfficer}
- Processor: ${file.processor}
- Loan Purpose: ${file.purpose}
- Occupancy: ${file.occupancy}
- Loan Amount: ${file.amount}
- Target Close Date: ${file.targetCloseDate}
- File Stage: ${STAGE_LABELS[file.stage]}
- Priority: ${file.priority}
- File Age Days: ${file.ageDays}
- Current Blocker: ${file.blocker}
- Latest Update: ${file.lastUpdate}
- Next Internal Action: ${file.nextInternalAction}
- Next Borrower Action: ${file.nextBorrowerAction}

You are Finley Beyond inside the Team Command Center.
You are assisting internal mortgage professionals.
Be practical, concise, operational, and realistic.
Do not guarantee approval.
Do not state rates or terms as final.
Do not invent lender approvals.
Focus on:
1. file risk
2. missing documentation
3. next best internal action
4. borrower communication strategy
5. possible mortgage direction at a high level
`.trim();
}

function extractAiText(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;

  if (typeof record.reply === "string" && record.reply.trim()) {
    return record.reply.trim();
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.content === "string" && record.content.trim()) {
    return record.content.trim();
  }

  if (typeof record.output === "string" && record.output.trim()) {
    return record.output.trim();
  }

  if (Array.isArray(record.messages)) {
    const assistant = [...record.messages]
      .reverse()
      .find((item) => {
        if (!item || typeof item !== "object") return false;
        const msg = item as Record<string, unknown>;
        return (
          msg.role === "assistant" &&
          typeof msg.content === "string" &&
          msg.content.trim()
        );
      }) as Record<string, unknown> | undefined;

    if (assistant && typeof assistant.content === "string") {
      return assistant.content.trim();
    }
  }

  if (Array.isArray(record.choices)) {
    const firstChoice = record.choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const choice = firstChoice as Record<string, unknown>;
      const message = choice.message as Record<string, unknown> | undefined;
      if (message && typeof message.content === "string" && message.content.trim()) {
        return message.content.trim();
      }
    }
  }

  return "";
}

export default function TeamPage() {
  const [files, setFiles] = useState<TeamFile[]>(mockFiles);
  const [updates, setUpdates] = useState<FileUpdate[]>(initialUpdates);
  const [selectedFileId, setSelectedFileId] = useState<string>(
    mockFiles[0]?.id ?? ""
  );
  const [search, setSearch] = useState("");
  const [handoffProcessor, setHandoffProcessor] = useState("Amarilis Santos");
  const [handoffTargetClose, setHandoffTargetClose] = useState("");
  const [handoffUrgency, setHandoffUrgency] =
    useState<PriorityLevel>("priority");
  const [handoffNote, setHandoffNote] = useState("");
  const [activityInput, setActivityInput] = useState("");
  const [banner, setBanner] = useState("");

  const [finleyInput, setFinleyInput] = useState("");
  const [finleyConversation, setFinleyConversation] = useState<FinleyChatMessage[]>([]);
  const [finleyLoading, setFinleyLoading] = useState(false);
  const [finleyError, setFinleyError] = useState("");

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return files;

    return files.filter((file) => {
      return (
        file.borrowerName.toLowerCase().includes(query) ||
        file.loanOfficer.toLowerCase().includes(query) ||
        file.processor.toLowerCase().includes(query) ||
        file.id.toLowerCase().includes(query) ||
        file.purpose.toLowerCase().includes(query)
      );
    });
  }, [files, search]);

  const selectedFile =
    filteredFiles.find((file) => file.id === selectedFileId) ||
    files.find((file) => file.id === selectedFileId) ||
    filteredFiles[0] ||
    files[0] ||
    null;

  const selectedFileUpdates = useMemo(() => {
    if (!selectedFile) return [];
    return updates.filter((update) => update.fileId === selectedFile.id);
  }, [updates, selectedFile]);

  const pipelineCounts = useMemo(() => {
    return STAGE_ORDER.map((stage) => ({
      stage,
      count: files.filter((file) => file.stage === stage).length,
    }));
  }, [files]);

  const urgentFiles = useMemo(() => {
    return files.filter(
      (file) => file.priority !== "standard" || file.ageDays >= 10
    );
  }, [files]);

  const kpis = useMemo(() => {
    const activeProcessing = files.filter(
      (file) =>
        file.stage === "sent_to_processing" ||
        file.stage === "processing_active" ||
        file.stage === "submitted_to_lender" ||
        file.stage === "conditional_approval"
    ).length;

    const nearingClose = files.filter(
      (file) =>
        file.stage === "conditional_approval" ||
        file.stage === "clear_to_close"
    ).length;

    const rush = files.filter((file) => file.priority === "rush").length;

    const avgAge =
      files.length > 0
        ? Math.round(
            files.reduce((sum, file) => sum + file.ageDays, 0) / files.length
          )
        : 0;

    return {
      activeProcessing,
      nearingClose,
      rush,
      avgAge,
    };
  }, [files]);

  useEffect(() => {
    setFinleyConversation([]);
    setFinleyInput("");
    setFinleyError("");
  }, [selectedFileId]);

  function handleSendToProcessing() {
    if (!selectedFile) return;

    const nextFiles = files.map((file) =>
      file.id === selectedFile.id
        ? {
            ...file,
            processor: handoffProcessor,
            stage: "sent_to_processing" as FileStage,
            priority: handoffUrgency,
            targetCloseDate: handoffTargetClose || file.targetCloseDate,
            lastUpdate: handoffNote.trim()
              ? `Processing handoff sent. ${handoffNote.trim()}`
              : "Processing handoff sent from Team Command Center.",
            nextInternalAction:
              "Processor to acknowledge handoff and open checklist.",
            nextBorrowerAction:
              "Stand by for processing checklist and conditions.",
          }
        : file
    );

    setFiles(nextFiles);

    const newUpdate: FileUpdate = {
      id: `U-${Date.now()}`,
      fileId: selectedFile.id,
      author: "System",
      role: "System",
      time: "Just now",
      text: handoffNote.trim()
        ? `File sent to processing. Assigned to ${handoffProcessor}. Note: ${handoffNote.trim()}`
        : `File sent to processing. Assigned to ${handoffProcessor}.`,
    };

    setUpdates((prev) => [newUpdate, ...prev]);
    setBanner(`Processing alerted for ${selectedFile.borrowerName}.`);
    setHandoffNote("");
  }

  function handleAddInternalUpdate() {
    if (!selectedFile || !activityInput.trim()) return;

    const newUpdate: FileUpdate = {
      id: `U-${Date.now()}`,
      fileId: selectedFile.id,
      author: "Team Command Center",
      role: "Assistant",
      time: "Just now",
      text: activityInput.trim(),
    };

    setUpdates((prev) => [newUpdate, ...prev]);
    setFiles((prev) =>
      prev.map((file) =>
        file.id === selectedFile.id
          ? {
              ...file,
              lastUpdate: activityInput.trim(),
            }
          : file
      )
    );
    setActivityInput("");
    setBanner(`Internal update added to ${selectedFile.borrowerName}.`);
  }

  async function handleAskFinley() {
    const trimmed = finleyInput.trim();

    if (!selectedFile || !trimmed) return;

    setFinleyLoading(true);
    setFinleyError("");

    const nextConversation: FinleyChatMessage[] = [
      ...finleyConversation,
      { role: "user", content: trimmed },
    ];

    setFinleyConversation(nextConversation);
    setFinleyInput("");

    try {
      const prompt = `
${buildTeamFileContext(selectedFile)}

Existing internal Finley conversation:
${nextConversation
  .map((message, index) => `${index + 1}. ${message.role}: ${message.content}`)
  .join("\n")}

Latest internal question from the team:
${trimmed}

Respond as Finley Beyond inside the Team Command Center.
Keep it concise, practical, and operational.
Prefer short paragraphs or bullets.
Include:
- immediate read
- missing items or risks
- best next step
- optional borrower-facing phrasing if useful
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "team_command",
          routing: {
            source: "team_command_center",
            fileId: selectedFile.id,
            borrowerName: selectedFile.borrowerName,
            loanOfficer: selectedFile.loanOfficer,
            processor: selectedFile.processor,
            purpose: selectedFile.purpose,
            occupancy: selectedFile.occupancy,
            amount: selectedFile.amount,
            targetCloseDate: selectedFile.targetCloseDate,
            stageLabel: STAGE_LABELS[selectedFile.stage],
            priority: selectedFile.priority,
            blocker: selectedFile.blocker,
            nextInternalAction: selectedFile.nextInternalAction,
            nextBorrowerAction: selectedFile.nextBorrowerAction,
            conversation: nextConversation,
          },
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const extracted = extractAiText(data);
        throw new Error(extracted || "Finley did not complete the request.");
      }

      const aiText =
        extractAiText(data) ||
        "Finley returned no visible guidance for this request.";

      setFinleyConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiText,
        },
      ]);

      setUpdates((prev) => [
        {
          id: `U-${Date.now()}`,
          fileId: selectedFile.id,
          author: "Finley Beyond",
          role: "Assistant",
          time: formatDateTimeNow(),
          text: aiText,
        },
        ...prev,
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "There was an error connecting to Finley.";
      setFinleyError(message);
      setFinleyConversation((prev) => prev.slice(0, -1));
    } finally {
      setFinleyLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,150,199,0.08) 0%, rgba(0,150,199,0) 28%), radial-gradient(circle at top right, rgba(38,51,102,0.08) 0%, rgba(38,51,102,0) 30%), linear-gradient(180deg, #F5F7FB 0%, #EEF2F8 100%)",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
        }
        @media (max-width: 1180px) {
          .tc-main-grid {
            grid-template-columns: 1fr !important;
          }
          .tc-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .tc-bottom-grid {
            grid-template-columns: 1fr !important;
          }
          .tc-command-grid {
            grid-template-columns: 1fr !important;
          }
          .tc-command-top-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 760px) {
          .tc-wrap {
            padding: 18px !important;
          }
          .tc-hero,
          .tc-card {
            padding: 20px !important;
            border-radius: 22px !important;
          }
          .tc-kpi-grid {
            grid-template-columns: 1fr !important;
          }
          .tc-hero-title {
            font-size: 38px !important;
            line-height: 0.98 !important;
          }
          .tc-pipeline-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .tc-command-top-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 520px) {
          .tc-pipeline-grid {
            grid-template-columns: 1fr !important;
          }
          .tc-hero-title {
            font-size: 31px !important;
          }
        }
      `}</style>

      <div
        className="tc-wrap"
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "24px 20px 40px",
        }}
      >
        <section
          className="tc-hero"
          style={{
            borderRadius: 30,
            padding: 28,
            background:
              "linear-gradient(135deg, #263366 0%, #1A5F95 48%, #0096C7 100%)",
            color: "#FFFFFF",
            boxShadow:
              "0 22px 48px rgba(38,51,102,0.18), inset 0 1px 0 rgba(255,255,255,0.14)",
            position: "relative",
            overflow: "hidden",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 16% 18%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 20%), radial-gradient(circle at 90% 14%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 18%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gridTemplateColumns: "1.45fr 0.95fr",
              gap: 18,
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  marginBottom: 18,
                }}
              >
                TEAM COMMAND CENTER
              </div>

              <h1
                className="tc-hero-title"
                style={{
                  margin: 0,
                  fontSize: 54,
                  lineHeight: 0.94,
                  letterSpacing: -1.6,
                  fontWeight: 900,
                  maxWidth: 900,
                }}
              >
                Mortgage workflow intelligence
                <br />
                <span style={{ color: "#C4EEFF" }}>
                  from pre-approval handoff
                </span>
                <br />
                through closing.
              </h1>

              <p
                style={{
                  margin: "22px 0 0",
                  maxWidth: 920,
                  fontSize: 17,
                  lineHeight: 1.66,
                  color: "rgba(255,255,255,0.95)",
                }}
              >
                Built for loan officers, processors, assistants, and leadership
                teams who need one disciplined operating layer to manage file
                handoff, milestone visibility, accountability, and internal
                communication from processing entry to clear-to-close.
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 24,
                padding: 18,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#D9F6FF",
                  marginBottom: 10,
                  letterSpacing: 0.35,
                }}
              >
                COMMAND PURPOSE
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                <div>• Trigger processing handoff with structure and urgency.</div>
                <div>• Keep loan officer and processor aligned in one file room.</div>
                <div>• Track milestones, blockers, and next actions visibly.</div>
                <div>• Reduce drift between pre-approval and close.</div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link href="/" style={styles.heroGhostButton}>
                  Back to Homepage
                </Link>
                <Link href="/borrower" style={styles.heroGhostButton}>
                  Open Borrower Experience
                </Link>
              </div>
            </div>
          </div>
        </section>

        {banner ? (
          <div
            style={{
              marginBottom: 18,
              padding: "14px 18px",
              borderRadius: 18,
              background: "rgba(236,253,243,0.95)",
              border: "1px solid #A7F3D0",
              color: "#047857",
              fontWeight: 800,
            }}
          >
            {banner}
          </div>
        ) : null}

        <section
          className="tc-kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div
            style={metricCard(
              "Processing Active",
              String(kpis.activeProcessing),
              "Files currently in execution"
            )}
          >
            <div style={styles.metricLabel}>Processing Active</div>
            <div style={styles.metricValue}>{kpis.activeProcessing}</div>
            <div style={styles.metricSubtext}>Files currently in execution</div>
          </div>

          <div
            style={metricCard(
              "Nearing Close",
              String(kpis.nearingClose),
              "Conditional approval or better"
            )}
          >
            <div style={styles.metricLabel}>Nearing Close</div>
            <div style={styles.metricValue}>{kpis.nearingClose}</div>
            <div style={styles.metricSubtext}>Conditional approval or better</div>
          </div>

          <div
            style={metricCard(
              "Rush Files",
              String(kpis.rush),
              "Priority oversight required"
            )}
          >
            <div style={styles.metricLabel}>Rush Files</div>
            <div style={styles.metricValue}>{kpis.rush}</div>
            <div style={styles.metricSubtext}>Priority oversight required</div>
          </div>

          <div
            style={metricCard(
              "Average Age",
              `${kpis.avgAge}d`,
              "Average file age in command center"
            )}
          >
            <div style={styles.metricLabel}>Average Age</div>
            <div style={styles.metricValue}>{kpis.avgAge}d</div>
            <div style={styles.metricSubtext}>Average file age in command center</div>
          </div>
        </section>

        <section
          className="tc-card"
          style={{
            ...styles.card,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "end",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={styles.sectionEyebrow}>PIPELINE</div>
              <h2 style={styles.sectionTitle}>Live command pipeline</h2>
            </div>

            <div style={{ minWidth: 280, flex: "1 1 320px", maxWidth: 420 }}>
              <label style={styles.label}>Search files</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search borrower, loan officer, processor, file ID, or purpose"
                style={styles.input}
              />
            </div>
          </div>

          <div
            className="tc-pipeline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {pipelineCounts.map((item) => {
              const tone = stageColor(item.stage);

              return (
                <div
                  key={item.stage}
                  style={{
                    borderRadius: 18,
                    padding: 14,
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    color: tone.text,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>
                    {STAGE_LABELS[item.stage]}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 26,
                      fontWeight: 900,
                    }}
                  >
                    {item.count}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ ...styles.card, marginBottom: 18 }}>
          <div style={styles.sectionEyebrow}>CLOSED LOANS</div>
          <h2 style={styles.sectionTitle}>2026</h2>

          <div
            style={{
              color: "#64748B",
              lineHeight: 1.7,
              marginTop: 12,
            }}
          >
            Closed loans will be archived here by year. Loans remain in the active
            pipeline until the file is fully closed.
          </div>
        </div>

        <section
          className="tc-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "0.94fr 1.06fr",
            gap: 18,
            alignItems: "start",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>ACTIVE FILES</div>
              <h2 style={styles.sectionTitle}>Processing and handoff queue</h2>

              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {filteredFiles.map((file) => {
                  const stageTone = stageColor(file.stage);
                  const priorityTone = priorityColor(file.priority);
                  const selected = selectedFile?.id === file.id;

                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setSelectedFileId(file.id)}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        borderRadius: 20,
                        padding: 16,
                        background: selected ? "rgba(0,150,199,0.08)" : "#FFFFFF",
                        border: selected
                          ? "1px solid rgba(0,150,199,0.24)"
                          : "1px solid rgba(217,225,236,0.92)",
                        boxShadow: selected
                          ? "0 12px 28px rgba(0,150,199,0.08)"
                          : "none",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 19,
                              fontWeight: 900,
                              color: "#263366",
                              marginBottom: 4,
                            }}
                          >
                            {file.borrowerName}
                          </div>
                          <div style={styles.metaLine}>
                            {file.id} · {file.purpose} · {file.amount}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              background: stageTone.bg,
                              color: stageTone.text,
                              border: `1px solid ${stageTone.border}`,
                            }}
                          >
                            {STAGE_LABELS[file.stage]}
                          </span>
                          <span
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              background: priorityTone.bg,
                              color: priorityTone.text,
                              border: `1px solid ${priorityTone.border}`,
                              textTransform: "capitalize",
                            }}
                          >
                            {file.priority}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        <div style={styles.detailMiniBox}>
                          <div style={styles.detailMiniLabel}>Loan Officer</div>
                          <div style={styles.detailMiniValue}>{file.loanOfficer}</div>
                        </div>
                        <div style={styles.detailMiniBox}>
                          <div style={styles.detailMiniLabel}>Processor</div>
                          <div style={styles.detailMiniValue}>{file.processor}</div>
                        </div>
                        <div style={styles.detailMiniBox}>
                          <div style={styles.detailMiniLabel}>Target Close</div>
                          <div style={styles.detailMiniValue}>
                            {formatDate(file.targetCloseDate)}
                          </div>
                        </div>
                        <div style={styles.detailMiniBox}>
                          <div style={styles.detailMiniLabel}>File Age</div>
                          <div style={styles.detailMiniValue}>{file.ageDays} days</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>URGENT OVERSIGHT</div>
              <h2 style={styles.sectionTitle}>Files needing attention</h2>

              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {urgentFiles.map((file) => (
                  <div key={`urgent-${file.id}`} style={styles.urgentRow}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#263366" }}>
                        {file.borrowerName}
                      </div>
                      <div style={styles.metaLine}>
                        {STAGE_LABELS[file.stage]} · {file.ageDays} days in workflow
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: "#8A2D0D", fontWeight: 700 }}>
                      {file.blocker}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={styles.sectionEyebrow}>FILE COMMAND</div>
                  <h2 style={styles.sectionTitle}>
                    {selectedFile ? selectedFile.borrowerName : "Select a file"}
                  </h2>
                </div>

                {selectedFile ? (
                  <span
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      background: stageColor(selectedFile.stage).bg,
                      color: stageColor(selectedFile.stage).text,
                      border: `1px solid ${stageColor(selectedFile.stage).border}`,
                    }}
                  >
                    {STAGE_LABELS[selectedFile.stage]}
                  </span>
                ) : null}
              </div>

              {selectedFile ? (
                <>
                  <div
                    className="tc-command-top-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 12,
                      marginTop: 16,
                    }}
                  >
                    <div style={styles.commandBox}>
                      <div style={styles.commandLabel}>Loan Officer</div>
                      <div style={styles.commandValue}>{selectedFile.loanOfficer}</div>
                    </div>
                    <div style={styles.commandBox}>
                      <div style={styles.commandLabel}>Processor</div>
                      <div style={styles.commandValue}>{selectedFile.processor}</div>
                    </div>
                    <div style={styles.commandBox}>
                      <div style={styles.commandLabel}>Target Close</div>
                      <div style={styles.commandValue}>
                        {formatDate(selectedFile.targetCloseDate)}
                      </div>
                    </div>
                    <div style={styles.commandBox}>
                      <div style={styles.commandLabel}>Loan Purpose</div>
                      <div style={styles.commandValue}>{selectedFile.purpose}</div>
                    </div>
                    <div style={styles.commandBox}>
                      <div style={styles.commandLabel}>Occupancy</div>
                      <div style={styles.commandValue}>{selectedFile.occupancy}</div>
                    </div>
                    <div style={styles.commandBox}>
                      <div style={styles.commandLabel}>Amount</div>
                      <div style={styles.commandValue}>{selectedFile.amount}</div>
                    </div>
                  </div>

                  <div
                    className="tc-command-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 18,
                      marginTop: 18,
                    }}
                  >
                    <div style={{ display: "grid", gap: 18 }}>
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={styles.statusNote}>
                          <strong>Current blocker:</strong> {selectedFile.blocker}
                        </div>
                        <div style={styles.statusNote}>
                          <strong>Next internal action:</strong>{" "}
                          {selectedFile.nextInternalAction}
                        </div>
                        <div style={styles.statusNote}>
                          <strong>Next borrower action:</strong>{" "}
                          {selectedFile.nextBorrowerAction}
                        </div>
                        <div style={styles.statusNote}>
                          <strong>Latest file update:</strong> {selectedFile.lastUpdate}
                        </div>
                      </div>

                      <div style={styles.cardInset}>
                        <div style={styles.sectionEyebrow}>AUDIT & DATES</div>
                        <h2 style={styles.sectionTitleSmall}>Execution Tracking</h2>

                        <div style={{ display: "grid", gap: 0, marginTop: 16 }}>
                          {[
                            "Submitted to UW",
                            "Approved w/ Conditions",
                            "Clear to Close",
                            "Docs Out",
                            "Docs Signed",
                            "Loan Funded",
                            "Initial CD Sent",
                            "Intent to Proceed",
                            "Appraisal Ordered",
                            "Title Ordered",
                          ].map((item) => (
                            <div
                              key={item}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 0",
                                borderBottom: "1px solid #E2E8F0",
                              }}
                            >
                              <span style={{ color: "#334155", fontWeight: 700 }}>
                                {item}
                              </span>

                              <button
                                type="button"
                                style={{
                                  ...styles.secondaryButton,
                                  minHeight: 40,
                                  padding: "8px 14px",
                                  fontSize: 13,
                                }}
                              >
                                Mark Complete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={styles.cardInset}>
                        <div style={styles.sectionEyebrow}>PROCESSING HANDOFF</div>
                        <h2 style={styles.sectionTitleSmall}>
                          Trigger and alert processing
                        </h2>

                        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                          <div>
                            <label style={styles.label}>Assign processor</label>
                            <select
                              value={handoffProcessor}
                              onChange={(e) => setHandoffProcessor(e.target.value)}
                              style={styles.input}
                            >
                              <option>Amarilis Santos</option>
                              <option>Kyle Nicholson</option>
                              <option>Bia Marques</option>
                              <option>Processor Queue</option>
                            </select>
                          </div>

                          <div>
                            <label style={styles.label}>Target close date</label>
                            <input
                              type="date"
                              value={handoffTargetClose}
                              onChange={(e) => setHandoffTargetClose(e.target.value)}
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>Urgency</label>
                            <select
                              value={handoffUrgency}
                              onChange={(e) =>
                                setHandoffUrgency(e.target.value as PriorityLevel)
                              }
                              style={styles.input}
                            >
                              <option value="standard">Standard</option>
                              <option value="priority">Priority</option>
                              <option value="rush">Rush</option>
                            </select>
                          </div>

                          <div>
                            <label style={styles.label}>Handoff note</label>
                            <textarea
                              value={handoffNote}
                              onChange={(e) => setHandoffNote(e.target.value)}
                              rows={4}
                              placeholder="Example: Borrower already reviewed pre-approval terms. Income profile is stable. Please issue first processing checklist today."
                              style={styles.textarea}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleSendToProcessing}
                            style={styles.primaryButton}
                          >
                            Send to Processing
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 18 }}>
                      <div style={styles.cardInset}>
                        <div style={styles.sectionEyebrow}>FINLEY BEYOND™</div>
                        <h2 style={styles.sectionTitleSmall}>Command Intelligence</h2>

                        <div
                          style={{
                            marginTop: 16,
                            minHeight: 260,
                            maxHeight: 420,
                            overflowY: "auto",
                            display: "grid",
                            gap: 10,
                            paddingRight: 4,
                          }}
                        >
                          {finleyConversation.length === 0 ? (
                            <div style={styles.statusNote}>
                              Ask Finley to analyze this file for risk, missing
                              items, next best steps, borrower communication, or
                              general mortgage direction.
                            </div>
                          ) : (
                            finleyConversation.map((message, index) => (
                              <div
                                key={`${message.role}-${index}`}
                                style={{
                                  ...styles.chatBubble,
                                  background:
                                    message.role === "assistant"
                                      ? "#F8FBFF"
                                      : "#E6F7FD",
                                  borderColor:
                                    message.role === "assistant"
                                      ? "#D9E1EC"
                                      : "#BDEFF5",
                                }}
                              >
                                <div style={styles.chatRole}>
                                  {message.role === "assistant"
                                    ? "Finley Beyond"
                                    : "Team User"}
                                </div>
                                <div style={styles.chatContent}>{message.content}</div>
                              </div>
                            ))
                          )}
                        </div>

                        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                          <textarea
                            value={finleyInput}
                            onChange={(e) => setFinleyInput(e.target.value)}
                            rows={5}
                            placeholder="Ask Finley about this file... (risk, missing docs, next steps, program direction)"
                            style={styles.textarea}
                          />

                          <button
                            type="button"
                            onClick={handleAskFinley}
                            disabled={finleyLoading || !selectedFile}
                            style={{
                              ...styles.secondaryButton,
                              opacity: finleyLoading ? 0.75 : 1,
                              cursor: finleyLoading ? "not-allowed" : "pointer",
                            }}
                          >
                            {finleyLoading ? "Finley is analyzing..." : "Ask Finley"}
                          </button>

                          {finleyError ? (
                            <div
                              style={{
                                padding: 12,
                                borderRadius: 14,
                                background: "#FFF1F2",
                                border: "1px solid #FECDD3",
                                color: "#BE123C",
                                fontWeight: 700,
                                lineHeight: 1.5,
                              }}
                            >
                              {finleyError}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ marginTop: 18 }}>
                          <div style={styles.statusNote}>
                            Finley will analyze:
                            <br />• Borrower structure
                            <br />• File stage
                            <br />• Missing documentation
                            <br />• Risk of delay
                            <br />• Possible program direction
                          </div>
                        </div>
                      </div>

                      <div style={styles.cardInset}>
                        <div style={styles.sectionEyebrow}>COMMAND PACKAGE</div>
                        <h2 style={styles.sectionTitleSmall}>
                          What this module becomes
                        </h2>

                        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                          <div style={styles.packageItem}>
                            <div style={styles.packageTitle}>Processing Handoff</div>
                            <div style={styles.packageBody}>
                              Loan officer triggers file handoff with processor
                              assignment, urgency, and operational note in one action.
                            </div>
                          </div>

                          <div style={styles.packageItem}>
                            <div style={styles.packageTitle}>
                              Open File Communication
                            </div>
                            <div style={styles.packageBody}>
                              Shared internal updates keep loan officer and processor
                              aligned from handoff through close.
                            </div>
                          </div>

                          <div style={styles.packageItem}>
                            <div style={styles.packageTitle}>Timeline Visibility</div>
                            <div style={styles.packageBody}>
                              File age, milestone stage, target close date, and
                              blockers stay visible to the team without losing
                              context.
                            </div>
                          </div>

                          <div style={styles.packageItem}>
                            <div style={styles.packageTitle}>
                              Future LOS Connection
                            </div>
                            <div style={styles.packageBody}>
                              This command layer can later sit above systems like
                              ARIVE as the coordination and intelligence layer
                              rather than replacing the LOS.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 16, color: "#52627A" }}>
                  Select a file from the queue to open command controls.
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          className="tc-bottom-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 18,
          }}
        >
          <div style={styles.card}>
            <div style={styles.sectionEyebrow}>INTERNAL FILE FEED</div>
            <h2 style={styles.sectionTitle}>Loan officer and processor activity</h2>

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              <div>
                <label style={styles.label}>Add internal update</label>
                <textarea
                  value={activityInput}
                  onChange={(e) => setActivityInput(e.target.value)}
                  rows={3}
                  placeholder="Post a structured internal update for the active file."
                  style={styles.textarea}
                />
              </div>

              <button
                type="button"
                onClick={handleAddInternalUpdate}
                style={styles.secondaryButton}
              >
                Add Internal Update
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {selectedFileUpdates.map((update) => (
                <div key={update.id} style={styles.feedRow}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#263366" }}>
                      {update.author}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>
                      {update.role} · {update.time}
                    </div>
                  </div>
                  <div style={{ color: "#4F5F79", lineHeight: 1.65 }}>
                    {update.text}
                  </div>
                </div>
              ))}
            </div>

            <footer
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: "1px solid rgba(38,51,102,0.08)",
                textAlign: "center",
                fontSize: 13,
                color: "#6A7A94",
                letterSpacing: 0.2,
              }}
            >
              Powered and Designed by Beyond Intelligence™ © 2026
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(217,225,236,0.92)",
    borderRadius: 26,
    padding: 24,
    boxShadow:
      "0 18px 42px rgba(38,51,102,0.06), inset 0 1px 0 rgba(255,255,255,0.72)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },
  cardInset: {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 10px 24px rgba(38,51,102,0.04)",
  },
  sectionEyebrow: {
    color: "#0096C7",
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.38,
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.06,
    letterSpacing: -0.5,
    color: "#263366",
  },
  sectionTitleSmall: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.08,
    letterSpacing: -0.4,
    color: "#263366",
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0096C7",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  metricValue: {
    fontSize: 34,
    fontWeight: 900,
    color: "#263366",
    lineHeight: 1,
    marginBottom: 8,
  },
  metricSubtext: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "#64748B",
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 800,
    color: "#263366",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #BED0E6",
    borderRadius: 18,
    background: "#FFFFFF",
    color: "#263366",
    padding: "14px 16px",
    fontSize: 15,
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #BED0E6",
    borderRadius: 18,
    background: "#FFFFFF",
    color: "#263366",
    padding: "14px 16px",
    fontSize: 15,
    outline: "none",
    resize: "vertical",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  primaryButton: {
    minHeight: 56,
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(38,51,102,0.98) 0%, rgba(53,70,140,0.96) 100%)",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 14px 34px rgba(38,51,102,0.22), inset 0 1px 0 rgba(255,255,255,0.16)",
  },
  secondaryButton: {
    minHeight: 52,
    border: "1px solid rgba(0,150,199,0.16)",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(0,150,199,0.95) 0%, rgba(19,181,228,0.92) 100%)",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 14px 30px rgba(0,150,199,0.16), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  heroGhostButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 14,
    color: "#FFFFFF",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
  },
  metaLine: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 1.5,
  },
  detailMiniBox: {
    padding: 12,
    borderRadius: 16,
    background: "#F8FBFF",
    border: "1px solid #D9E1EC",
  },
  detailMiniLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64748B",
    fontWeight: 800,
    marginBottom: 6,
  },
  detailMiniValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#263366",
    lineHeight: 1.45,
  },
  urgentRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    padding: 14,
    borderRadius: 18,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
  },
  commandBox: {
    padding: 14,
    borderRadius: 18,
    background: "#F8FBFF",
    border: "1px solid #D9E1EC",
  },
  commandLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    color: "#64748B",
    fontWeight: 800,
    marginBottom: 6,
  },
  commandValue: {
    fontSize: 15,
    fontWeight: 800,
    color: "#263366",
    lineHeight: 1.45,
  },
  statusNote: {
    padding: 14,
    borderRadius: 18,
    background: "#FBFCFE",
    border: "1px solid #E2E8F0",
    color: "#4F5F79",
    lineHeight: 1.6,
    fontSize: 15,
  },
  chatBubble: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid #D9E1EC",
  },
  chatRole: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0096C7",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  chatContent: {
    color: "#334155",
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    fontSize: 14,
  },
  feedRow: {
    padding: 16,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    boxShadow: "0 6px 16px rgba(38,51,102,0.04)",
  },
  packageItem: {
    padding: 16,
    borderRadius: 18,
    background: "#F8FBFF",
    border: "1px solid #D9E1EC",
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#263366",
    marginBottom: 8,
  },
  packageBody: {
    fontSize: 15,
    lineHeight: 1.62,
    color: "#52627A",
  },
};
