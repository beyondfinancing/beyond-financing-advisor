"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Real Estate Agent";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  role: TeamRole;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
};

type WorkflowStatus =
  | "new_scenario"
  | "pre_approval_review"
  | "sent_to_processing"
  | "processing_active"
  | "submitted_to_lender"
  | "conditional_approval"
  | "clear_to_close"
  | "closed";

type WorkflowUrgency = "Standard" | "Priority" | "Rush";

type ProcessorOption = {
  id: string;
  name: string;
  email: string;
};

type WorkflowFile = {
  id: string;
  borrowerName: string;
  purpose: string;
  amount: number;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  loanOfficer: string;
  processor: string;
  targetClose: string;
  fileAgeDays: number;
  occupancy: string;
  blocker: string;
  nextInternalAction: string;
  nextBorrowerAction: string;
  latestUpdate: string;
};

type WorkflowApiFile = {
  id: string;
  borrower_name: string;
  purpose: string;
  amount: number | string | null;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  loan_officer: string;
  processor: string;
  target_close: string | null;
  file_age_days: number | null;
  occupancy: string;
  blocker: string;
  next_internal_action: string;
  next_borrower_action: string;
  latest_update: string;
};

type WorkflowFeedApiItem = {
  id: string;
  workflow_file_id: string;
  author: string;
  role: string;
  text: string;
  created_at: string;
};

type FeedItem = {
  id: string;
  author: string;
  role: string;
  timeLabel: string;
  text: string;
};

const PROCESSORS: ProcessorOption[] = [
  {
    id: "amarilis-santos",
    name: "Amarilis Santos",
    email: "amarilis@beyondfinancing.com",
  },
  {
    id: "kyle-nicholson",
    name: "Kyle Nicholson",
    email: "kyle@beyondfinancing.com",
  },
  {
    id: "bia-marques",
    name: "Bia Marques",
    email: "bia@beyondfinancing.com",
  },
];

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTargetClose(value: string) {
  if (!value) return "";
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!isoMatch) return value;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US").format(date);
}

function toDateInputValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFeedTime(value: string) {
  if (!value) return "Recent";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recent";

  const now = new Date();
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);

  if (sameDay) {
    return `Today · ${time}`;
  }

  const date = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(parsed);

  return `${date} · ${time}`;
}

function getStatusLabel(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return "New Scenario";
    case "pre_approval_review":
      return "Pre-Approval Review";
    case "sent_to_processing":
      return "Sent to Processing";
    case "processing_active":
      return "Processing Active";
    case "submitted_to_lender":
      return "Submitted to Lender";
    case "conditional_approval":
      return "Conditional Approval";
    case "clear_to_close":
      return "Clear to Close";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function getStatusTone(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return {
        bg: "#EEF2FF",
        border: "#C7D2FE",
        text: "#3755A5",
      };
    case "pre_approval_review":
      return {
        bg: "#F3F0FF",
        border: "#D8CCFF",
        text: "#5B3DB4",
      };
    case "sent_to_processing":
      return {
        bg: "#ECFEFF",
        border: "#A5F3FC",
        text: "#0E7490",
      };
    case "processing_active":
      return {
        bg: "#ECFDF3",
        border: "#BBF7D0",
        text: "#15803D",
      };
    case "submitted_to_lender":
      return {
        bg: "#FFF7ED",
        border: "#FDBA74",
        text: "#C2410C",
      };
    case "conditional_approval":
      return {
        bg: "#FFF7ED",
        border: "#FDBA74",
        text: "#C2410C",
      };
    case "clear_to_close":
      return {
        bg: "#ECFDF3",
        border: "#86EFAC",
        text: "#047857",
      };
    case "closed":
      return {
        bg: "#F3F4F6",
        border: "#D1D5DB",
        text: "#374151",
      };
    default:
      return {
        bg: "#F8FAFC",
        border: "#CBD5E1",
        text: "#475569",
      };
  }
}

function getUrgencyTone(urgency: WorkflowUrgency) {
  switch (urgency) {
    case "Rush":
      return {
        bg: "#FDF2F8",
        border: "#F9A8D4",
        text: "#BE185D",
      };
    case "Priority":
      return {
        bg: "#FFF7ED",
        border: "#FDBA74",
        text: "#C2410C",
      };
    default:
      return {
        bg: "#F8FAFC",
        border: "#CBD5E1",
        text: "#475569",
      };
  }
}

function getUrgencyRank(urgency: WorkflowUrgency) {
  switch (urgency) {
    case "Rush":
      return 3;
    case "Priority":
      return 2;
    default:
      return 1;
  }
}

function getStatusRank(status: WorkflowStatus) {
  switch (status) {
    case "conditional_approval":
      return 8;
    case "submitted_to_lender":
      return 7;
    case "processing_active":
      return 6;
    case "sent_to_processing":
      return 5;
    case "pre_approval_review":
      return 4;
    case "new_scenario":
      return 3;
    case "clear_to_close":
      return 2;
    case "closed":
      return 1;
    default:
      return 0;
  }
}

function compareWorkflowFiles(a: WorkflowFile, b: WorkflowFile) {
  const urgencyDiff = getUrgencyRank(b.urgency) - getUrgencyRank(a.urgency);
  if (urgencyDiff !== 0) return urgencyDiff;

  const statusDiff = getStatusRank(b.status) - getStatusRank(a.status);
  if (statusDiff !== 0) return statusDiff;

  const ageDiff = b.fileAgeDays - a.fileAgeDays;
  if (ageDiff !== 0) return ageDiff;

  return a.borrowerName.localeCompare(b.borrowerName);
}

export default function WorkflowPage() {
  const [activeUser, setActiveUser] = useState<TeamUser | null>(null);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);

  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const [assignedProcessor, setAssignedProcessor] =
    useState<string>("Amarilis Santos");
  const [targetCloseDate, setTargetCloseDate] = useState("");
  const [handoffUrgency, setHandoffUrgency] =
    useState<WorkflowUrgency>("Priority");
  const [handoffNote, setHandoffNote] = useState("");
  const [handoffStatus, setHandoffStatus] = useState("");

  const [internalUpdateInput, setInternalUpdateInput] = useState("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const [createBorrowerName, setCreateBorrowerName] = useState("");
  const [createPurpose, setCreatePurpose] = useState("Purchase");
  const [createAmount, setCreateAmount] = useState("");
  const [createLoanOfficer, setCreateLoanOfficer] = useState("");
  const [createProcessor, setCreateProcessor] = useState("Amarilis Santos");
  const [createTargetClose, setCreateTargetClose] = useState("");
  const [createUrgency, setCreateUrgency] =
    useState<WorkflowUrgency>("Priority");
  const [createOccupancy, setCreateOccupancy] =
    useState("Primary Residence");
  const [createBlocker, setCreateBlocker] = useState("None currently.");
  const [createStatusMessage, setCreateStatusMessage] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isSavingFeed, setIsSavingFeed] = useState(false);
  const [isSavingHandoff, setIsSavingHandoff] = useState(false);

  const loadFiles = useCallback(async (preferredSelectedFileId?: string) => {
    try {
      setFilesLoading(true);

      const res = await fetch("/api/workflow", { cache: "no-store" });
      const data = await res.json();

      const mappedFiles: WorkflowFile[] = Array.isArray(data?.files)
        ? (data.files as WorkflowApiFile[]).map((f) => ({
            id: String(f.id ?? ""),
            borrowerName: String(f.borrower_name ?? ""),
            purpose: String(f.purpose ?? ""),
            amount: Number(f.amount ?? 0),
            status: f.status,
            urgency: f.urgency,
            loanOfficer: String(f.loan_officer ?? ""),
            processor: String(f.processor ?? ""),
            targetClose: String(f.target_close ?? ""),
            fileAgeDays: Number(f.file_age_days ?? 0),
            occupancy: String(f.occupancy ?? ""),
            blocker: String(f.blocker ?? ""),
            nextInternalAction: String(f.next_internal_action ?? ""),
            nextBorrowerAction: String(f.next_borrower_action ?? ""),
            latestUpdate: String(f.latest_update ?? ""),
          }))
        : [];

      setFiles(mappedFiles);

      if (preferredSelectedFileId) {
        setSelectedFileId(preferredSelectedFileId);
      } else if (!selectedFileId && mappedFiles[0]) {
        setSelectedFileId(mappedFiles[0].id);
      }
    } catch (err) {
      console.error("Failed to load workflow files", err);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [selectedFileId]);

  const loadFeed = useCallback(async (workflowFileId: string) => {
    if (!workflowFileId) {
      setFeedItems([]);
      return;
    }

    try {
      setFeedLoading(true);

      const res = await fetch(`/api/workflow?fileId=${workflowFileId}`, {
        cache: "no-store",
      });
      const data = await res.json();

      const mappedFeed: FeedItem[] = Array.isArray(data?.feed)
        ? (data.feed as WorkflowFeedApiItem[]).map((item) => ({
            id: String(item.id),
            author: String(item.author ?? ""),
            role: String(item.role ?? ""),
            timeLabel: formatFeedTime(String(item.created_at ?? "")),
            text: String(item.text ?? ""),
          }))
        : [];

      setFeedItems(mappedFeed);
    } catch (err) {
      console.error("Failed to load workflow feed", err);
      setFeedItems([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/team-auth/me");

        if (response.ok) {
          const data = await response.json();

          if (data?.authenticated && data?.user) {
            setActiveUser(data.user);
            setCreateLoanOfficer(data.user.name || "");
          }
        }
      } catch {
        // no-op
      } finally {
        setAuthCheckLoading(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const sortedFiles = useMemo(() => {
    return [...files].sort(compareWorkflowFiles);
  }, [files]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedFiles;

    return sortedFiles.filter((file) => {
      const haystack = [
        file.borrowerName,
        file.loanOfficer,
        file.processor,
        file.id,
        file.purpose,
        getStatusLabel(file.status),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [sortedFiles, searchQuery]);

  const selectedFile =
    filteredFiles.find((file) => file.id === selectedFileId) ||
    sortedFiles.find((file) => file.id === selectedFileId) ||
    filteredFiles[0] ||
    sortedFiles[0] ||
    null;

  useEffect(() => {
    if (!selectedFile && filteredFiles.length === 0) return;

    if (!selectedFileId && filteredFiles[0]) {
      setSelectedFileId(filteredFiles[0].id);
      return;
    }

    const exists = filteredFiles.some((file) => file.id === selectedFileId);
    if (!exists && filteredFiles[0]) {
      setSelectedFileId(filteredFiles[0].id);
    }
  }, [filteredFiles, selectedFile, selectedFileId]);

  useEffect(() => {
    if (!selectedFile) {
      setFeedItems([]);
      return;
    }

    setAssignedProcessor(selectedFile.processor || "Amarilis Santos");
    setHandoffUrgency(selectedFile.urgency || "Priority");
    setTargetCloseDate(toDateInputValue(selectedFile.targetClose));
    loadFeed(selectedFile.id);
  }, [selectedFile, loadFeed]);

  const handleSignOut = async () => {
    await fetch("/api/team-auth/logout", { method: "POST" });
    setActiveUser(null);
  };

  const pipelineCounts = useMemo(() => {
    return {
      newScenario: files.filter((f) => f.status === "new_scenario").length,
      preApprovalReview: files.filter(
        (f) => f.status === "pre_approval_review"
      ).length,
      sentToProcessing: files.filter((f) => f.status === "sent_to_processing")
        .length,
      processingActive: files.filter((f) => f.status === "processing_active")
        .length,
      submittedToLender: files.filter((f) => f.status === "submitted_to_lender")
        .length,
      conditionalApproval: files.filter(
        (f) => f.status === "conditional_approval"
      ).length,
      clearToClose: files.filter((f) => f.status === "clear_to_close").length,
      closed: files.filter((f) => f.status === "closed").length,
    };
  }, [files]);

  const processingActiveCount = files.filter(
    (f) =>
      f.status === "sent_to_processing" ||
      f.status === "processing_active" ||
      f.status === "submitted_to_lender" ||
      f.status === "conditional_approval"
  ).length;

  const nearingCloseCount = files.filter(
    (f) => f.status === "conditional_approval" || f.status === "clear_to_close"
  ).length;

  const rushFilesCount = files.filter((f) => f.urgency === "Rush").length;

  const averageAge = files.length
    ? Math.round(
        files.reduce((sum, file) => sum + file.fileAgeDays, 0) / files.length
      )
    : 0;

  const urgentItems = useMemo(() => {
    return [...files]
      .filter(
        (file) =>
          file.urgency !== "Standard" ||
          file.blocker.toLowerCase() !== "none currently."
      )
      .sort(compareWorkflowFiles);
  }, [files]);

  const createWorkflowFile = async () => {
    const borrowerName = createBorrowerName.trim();
    const loanOfficer = createLoanOfficer.trim() || activeUser?.name || "";

    if (!borrowerName || !loanOfficer) {
      setCreateStatusMessage(
        "Borrower name and loan officer are required to create a workflow file."
      );
      return;
    }

    try {
      setIsCreatingFile(true);
      setCreateStatusMessage("");

      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_file",
          borrowerName,
          purpose: createPurpose,
          amount: Number(createAmount || 0),
          loanOfficer,
          processor: createProcessor,
          targetClose: createTargetClose,
          urgency: createUrgency,
          occupancy: createOccupancy,
          blocker: createBlocker,
          author: activeUser?.name || "Team User",
          role: activeUser?.role || "Professional",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setCreateStatusMessage(
          data?.error || "Unable to create workflow file."
        );
        return;
      }

      const newId = String(data?.file?.id ?? "");

      setCreateBorrowerName("");
      setCreatePurpose("Purchase");
      setCreateAmount("");
      setCreateProcessor("Amarilis Santos");
      setCreateTargetClose("");
      setCreateUrgency("Priority");
      setCreateOccupancy("Primary Residence");
      setCreateBlocker("None currently.");
      setCreateStatusMessage("Workflow file created successfully.");

      await loadFiles(newId);
      if (newId) {
        await loadFeed(newId);
      }
    } catch (err) {
      console.error(err);
      setCreateStatusMessage("Unable to create workflow file.");
    } finally {
      setIsCreatingFile(false);
    }
  };

  const submitProcessingHandoff = async () => {
    if (!selectedFile) return;

    try {
      setIsSavingHandoff(true);
      setHandoffStatus("");

      const response = await fetch("/api/workflow", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "handoff",
          workflowFileId: selectedFile.id,
          processor: assignedProcessor,
          targetClose: targetCloseDate,
          urgency: handoffUrgency,
          handoffNote,
          author: activeUser?.name || "Team User",
          role: activeUser?.role || "Professional",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setHandoffStatus(data?.error || "Unable to save handoff.");
        return;
      }

      await loadFiles(selectedFile.id);
      await loadFeed(selectedFile.id);

      setHandoffStatus("Processing handoff triggered successfully.");
      setHandoffNote("");
    } catch (err) {
      console.error(err);
      setHandoffStatus("Unable to save handoff.");
    } finally {
      setIsSavingHandoff(false);
    }
  };

  const addInternalUpdate = async () => {
    const trimmed = internalUpdateInput.trim();
    if (!trimmed || !selectedFile) return;

    try {
      setIsSavingFeed(true);

      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add_feed",
          workflowFileId: selectedFile.id,
          author: activeUser?.name || "Team User",
          role: activeUser?.role || "Professional",
          text: trimmed,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        return;
      }

      setInternalUpdateInput("");
      await loadFeed(selectedFile.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingFeed(false);
    }
  };

  if (authCheckLoading) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="bf-wrap" style={styles.wrap}>
          <TopNav />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>TEAM WORKFLOW INTELLIGENCE</div>
            <h1 style={styles.heroTitle}>
              Beyond Intelligence™ Team Workflow Intelligence
            </h1>
            <p style={styles.heroText}>
              Loading protected workflow command center...
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!activeUser) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="bf-wrap" style={styles.wrap}>
          <TopNav />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>TEAM WORKFLOW INTELLIGENCE</div>
            <h1 style={styles.heroTitle}>
              Beyond Intelligence™ Team Workflow Intelligence
            </h1>
            <p style={styles.heroText}>
              Processing handoff, file command, milestone visibility, and
              execution tracking from pre-approval through closing.
            </p>
          </section>

          <div style={styles.loginCard}>
            <h2 style={styles.sectionTitle}>Protected Professional Access</h2>
            <p style={styles.sectionText}>
              This page uses the same professional authentication layer as Team
              Mortgage Intelligence. Please sign in through your protected team
              access first.
            </p>

            <div style={styles.loginActions}>
              <a href="/team" style={styles.primaryLinkButton}>
                Go to Mortgage Intelligence Login
              </a>
              <a href="/" style={styles.secondaryLinkButton}>
                Back to Homepage
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <TopNav active="workflow" />

        <section style={styles.hero}>
          <div
            className="bf-workflow-hero-top"
            style={styles.workflowHeroTopBar}
          >
            <div style={styles.workflowHeroLeft}>
              <div style={styles.heroBadge}>TEAM COMMAND CENTER</div>
              <h1 style={styles.heroTitle}>
                Mortgage workflow intelligence
                <br />
                from pre-approval handoff
                <br />
                through closing.
              </h1>
              <p style={styles.heroText}>
                Built for loan officers, processors, assistants, and leadership
                teams who need one disciplined operating layer to manage file
                handoff, milestone visibility, accountability, and internal
                communication from processing entry to clear-to-close.
              </p>
            </div>

            <div style={styles.workflowHeroRight}>
              <div style={styles.userBadge}>
                <div style={styles.userBadgeTitle}>
                  Logged in as: {activeUser.name}
                </div>
                <div style={styles.userBadgeSubtext}>
                  Role: {activeUser.role} · {activeUser.email}
                </div>
              </div>

              <div style={styles.heroPurposeCard}>
                <div style={styles.heroPurposeTitle}>COMMAND PURPOSE</div>
                <div style={styles.heroPurposeList}>
                  <div>
                    • Trigger processing handoff with structure and urgency.
                  </div>
                  <div>
                    • Keep loan officer and processor aligned in one file room.
                  </div>
                  <div>
                    • Track milestones, blockers, and next actions visibly.
                  </div>
                  <div>• Reduce drift between pre-approval and close.</div>
                </div>

                <div style={styles.heroActionRow}>
                  <a href="/" style={styles.heroActionOutline}>
                    Back to Homepage
                  </a>
                  <a href="/borrower" style={styles.heroActionGhost}>
                    Open Borrower Experience
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                style={styles.signOutButton}
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        <div className="bf-stat-grid" style={styles.statGrid}>
          <StatCard
            title="Processing Active"
            value={String(processingActiveCount)}
            subtext="Files currently in execution"
          />
          <StatCard
            title="Nearing Close"
            value={String(nearingCloseCount)}
            subtext="Conditional approval or better"
          />
          <StatCard
            title="Rush Files"
            value={String(rushFilesCount)}
            subtext="Priority oversight required"
          />
          <StatCard
            title="Average Age"
            value={`${averageAge}d`}
            subtext="Average file age in command center"
          />
        </div>

        <section style={styles.card}>
          <div style={styles.pipelineHeader}>
            <div>
              <div style={styles.sectionEyebrow}>PIPELINE</div>
              <h2 style={styles.sectionTitle}>Live command pipeline</h2>
            </div>

            <div style={styles.searchWrap}>
              <label style={styles.searchLabel}>Search files</label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search borrower, loan officer, processor, file ID, or purpose"
                style={styles.searchInput}
              />
            </div>
          </div>

          <div className="bf-pipeline-grid" style={styles.pipelineGrid}>
            <PipelineCard
              label="New Scenario"
              value={pipelineCounts.newScenario}
              status="new_scenario"
            />
            <PipelineCard
              label="Pre-Approval Review"
              value={pipelineCounts.preApprovalReview}
              status="pre_approval_review"
            />
            <PipelineCard
              label="Sent to Processing"
              value={pipelineCounts.sentToProcessing}
              status="sent_to_processing"
            />
            <PipelineCard
              label="Processing Active"
              value={pipelineCounts.processingActive}
              status="processing_active"
            />
            <PipelineCard
              label="Submitted to Lender"
              value={pipelineCounts.submittedToLender}
              status="submitted_to_lender"
            />
            <PipelineCard
              label="Conditional Approval"
              value={pipelineCounts.conditionalApproval}
              status="conditional_approval"
            />
            <PipelineCard
              label="Clear to Close"
              value={pipelineCounts.clearToClose}
              status="clear_to_close"
            />
            <PipelineCard
              label="Closed"
              value={pipelineCounts.closed}
              status="closed"
            />
          </div>
        </section>

        <div className="bf-main-grid" style={styles.mainGrid}>
          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>ACTIVE FILES</div>
              <h2 style={styles.sectionTitle}>Processing and handoff queue</h2>

              {filesLoading ? (
                <div style={styles.placeholderBox}>Loading workflow files...</div>
              ) : (
                <div style={styles.fileList}>
                  {filteredFiles.map((file) => {
                    const statusTone = getStatusTone(file.status);
                    const urgencyTone = getUrgencyTone(file.urgency);
                    const isSelected = selectedFile?.id === file.id;

                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          setSelectedFileId(file.id);
                          setAssignedProcessor(file.processor);
                          setHandoffUrgency(file.urgency);
                          setTargetCloseDate(toDateInputValue(file.targetClose));
                          setHandoffStatus("");
                        }}
                        style={{
                          ...styles.fileCard,
                          ...(isSelected ? styles.fileCardSelected : {}),
                        }}
                      >
                        <div style={styles.fileCardTop}>
                          <div>
                            <div style={styles.fileBorrower}>
                              {file.borrowerName}
                            </div>
                            <div style={styles.fileMeta}>
                              {file.id} · {file.purpose} ·{" "}
                              {formatCurrency(file.amount)}
                            </div>
                          </div>

                          <div style={styles.badgeRow}>
                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: statusTone.bg,
                                borderColor: statusTone.border,
                                color: statusTone.text,
                              }}
                            >
                              {getStatusLabel(file.status)}
                            </span>

                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: urgencyTone.bg,
                                borderColor: urgencyTone.border,
                                color: urgencyTone.text,
                              }}
                            >
                              {file.urgency}
                            </span>
                          </div>
                        </div>

                        <div className="bf-mini-grid" style={styles.miniGrid}>
                          <MiniDataCard
                            label="LOAN OFFICER"
                            value={file.loanOfficer}
                          />
                          <MiniDataCard
                            label="PROCESSOR"
                            value={file.processor}
                          />
                          <MiniDataCard
                            label="TARGET CLOSE"
                            value={formatTargetClose(file.targetClose)}
                          />
                          <MiniDataCard
                            label="FILE AGE"
                            value={`${file.fileAgeDays} days`}
                          />
                        </div>
                      </button>
                    );
                  })}

                  {filteredFiles.length === 0 ? (
                    <div style={styles.placeholderBox}>
                      No files match the current search.
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>URGENT OVERSIGHT</div>
              <h2 style={styles.sectionTitle}>Files needing attention</h2>

              <div style={styles.attentionList}>
                {urgentItems.length === 0 ? (
                  <div style={styles.placeholderBox}>
                    No urgent items are currently flagged.
                  </div>
                ) : (
                  urgentItems.map((item) => (
                    <div key={`urgent-${item.id}`} style={styles.attentionCard}>
                      <div>
                        <div style={styles.attentionName}>
                          {item.borrowerName}
                        </div>
                        <div style={styles.attentionMeta}>
                          {getStatusLabel(item.status)} · {item.fileAgeDays} days
                          in workflow
                        </div>
                      </div>
                      <div style={styles.attentionIssue}>{item.blocker}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>INTERNAL FILE FEED</div>
              <h2 style={styles.sectionTitle}>
                Loan officer and processor activity
              </h2>

              <label style={styles.label}>Add internal update</label>
              <textarea
                value={internalUpdateInput}
                onChange={(e) => setInternalUpdateInput(e.target.value)}
                placeholder="Post a structured internal update for the active file."
                rows={3}
                style={styles.textarea}
              />
              <button
                type="button"
                onClick={addInternalUpdate}
                style={styles.gradientButton}
                disabled={!selectedFile || isSavingFeed}
              >
                {isSavingFeed ? "Saving Update..." : "Add Internal Update"}
              </button>

              {feedLoading ? (
                <div style={styles.placeholderBox}>Loading file activity...</div>
              ) : (
                <div style={styles.feedList}>
                  {feedItems.length === 0 ? (
                    <div style={styles.placeholderBox}>
                      No internal updates yet for this file.
                    </div>
                  ) : (
                    feedItems.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedHeader}>
                          <div style={styles.feedAuthor}>{item.author}</div>
                          <div style={styles.feedMeta}>
                            {item.role} · {item.timeLabel}
                          </div>
                        </div>
                        <div style={styles.feedText}>{item.text}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>

          <aside style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>ADD LOAN APP</div>
              <h2 style={styles.sectionTitle}>Create workflow file</h2>

              <label style={styles.label}>Borrower full name</label>
              <input
                value={createBorrowerName}
                onChange={(e) => setCreateBorrowerName(e.target.value)}
                style={styles.input}
                placeholder="Borrower full name"
              />

              <label style={styles.label}>Loan purpose</label>
              <select
                value={createPurpose}
                onChange={(e) => setCreatePurpose(e.target.value)}
                style={styles.input}
              >
                <option value="Purchase">Purchase</option>
                <option value="Rate/Term Refinance">Rate/Term Refinance</option>
                <option value="Cash-Out Refinance">Cash-Out Refinance</option>
                <option value="HELOC">HELOC</option>
                <option value="DSCR">DSCR</option>
              </select>

              <label style={styles.label}>Amount</label>
              <input
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                style={styles.input}
                placeholder="612000"
              />

              <label style={styles.label}>Loan officer</label>
              <input
                value={createLoanOfficer}
                onChange={(e) => setCreateLoanOfficer(e.target.value)}
                style={styles.input}
                placeholder="Loan officer name"
              />

              <label style={styles.label}>Assign processor</label>
              <select
                value={createProcessor}
                onChange={(e) => setCreateProcessor(e.target.value)}
                style={styles.input}
              >
                {PROCESSORS.map((processor) => (
                  <option key={processor.id} value={processor.name}>
                    {processor.name}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Target close date</label>
              <input
                type="date"
                value={createTargetClose}
                onChange={(e) => setCreateTargetClose(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Urgency</label>
              <select
                value={createUrgency}
                onChange={(e) =>
                  setCreateUrgency(e.target.value as WorkflowUrgency)
                }
                style={styles.input}
              >
                <option value="Standard">Standard</option>
                <option value="Priority">Priority</option>
                <option value="Rush">Rush</option>
              </select>

              <label style={styles.label}>Occupancy</label>
              <input
                value={createOccupancy}
                onChange={(e) => setCreateOccupancy(e.target.value)}
                style={styles.input}
                placeholder="Primary Residence"
              />

              <label style={styles.label}>Current blocker</label>
              <textarea
                value={createBlocker}
                onChange={(e) => setCreateBlocker(e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <button
                type="button"
                onClick={createWorkflowFile}
                style={styles.commandButton}
                disabled={isCreatingFile}
              >
                {isCreatingFile ? "Creating File..." : "Add to Workflow"}
              </button>

              {createStatusMessage ? (
                <div style={styles.infoBox}>{createStatusMessage}</div>
              ) : null}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>FILE COMMAND</div>

              {selectedFile ? (
                <>
                  <div style={styles.commandTopRow}>
                    <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
                      {selectedFile.borrowerName}
                    </h2>

                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: getStatusTone(selectedFile.status).bg,
                        borderColor: getStatusTone(selectedFile.status).border,
                        color: getStatusTone(selectedFile.status).text,
                      }}
                    >
                      {getStatusLabel(selectedFile.status)}
                    </span>
                  </div>

                  <div className="bf-command-grid" style={styles.commandGrid}>
                    <MiniDataCard
                      label="LOAN OFFICER"
                      value={selectedFile.loanOfficer}
                    />
                    <MiniDataCard
                      label="PROCESSOR"
                      value={selectedFile.processor}
                    />
                    <MiniDataCard
                      label="TARGET CLOSE"
                      value={formatTargetClose(selectedFile.targetClose)}
                    />
                    <MiniDataCard
                      label="LOAN PURPOSE"
                      value={selectedFile.purpose}
                    />
                    <MiniDataCard
                      label="OCCUPANCY"
                      value={selectedFile.occupancy}
                    />
                    <MiniDataCard
                      label="AMOUNT"
                      value={formatCurrency(selectedFile.amount)}
                    />
                  </div>

                  <div style={styles.commandNote}>
                    <strong>Current blocker:</strong> {selectedFile.blocker}
                  </div>
                  <div style={styles.commandNote}>
                    <strong>Next internal action:</strong>{" "}
                    {selectedFile.nextInternalAction}
                  </div>
                  <div style={styles.commandNote}>
                    <strong>Next borrower action:</strong>{" "}
                    {selectedFile.nextBorrowerAction}
                  </div>
                  <div style={styles.commandNote}>
                    <strong>Latest file update:</strong>{" "}
                    {selectedFile.latestUpdate}
                  </div>
                </>
              ) : (
                <div style={styles.placeholderBox}>
                  Select a file to view command details.
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>PROCESSING HANDOFF</div>
              <h2 style={styles.sectionTitle}>Trigger and alert processing</h2>

              <label style={styles.label}>Assign processor</label>
              <select
                value={assignedProcessor}
                onChange={(e) => setAssignedProcessor(e.target.value)}
                style={styles.input}
              >
                {PROCESSORS.map((processor) => (
                  <option key={processor.id} value={processor.name}>
                    {processor.name}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Target close date</label>
              <input
                type="date"
                value={targetCloseDate}
                onChange={(e) => setTargetCloseDate(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Urgency</label>
              <select
                value={handoffUrgency}
                onChange={(e) =>
                  setHandoffUrgency(e.target.value as WorkflowUrgency)
                }
                style={styles.input}
              >
                <option value="Standard">Standard</option>
                <option value="Priority">Priority</option>
                <option value="Rush">Rush</option>
              </select>

              <label style={styles.label}>Handoff note</label>
              <textarea
                value={handoffNote}
                onChange={(e) => setHandoffNote(e.target.value)}
                rows={4}
                placeholder="Example: Borrower already reviewed pre-approval terms. Income profile is stable. Please issue first processing checklist today."
                style={styles.textarea}
              />

              <button
                type="button"
                onClick={submitProcessingHandoff}
                style={styles.commandButton}
                disabled={!selectedFile || isSavingHandoff}
              >
                {isSavingHandoff ? "Saving..." : "Send to Processing"}
              </button>

              {handoffStatus ? (
                <div style={styles.infoBox}>{handoffStatus}</div>
              ) : null}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>COMMAND PACKAGE</div>
              <h2 style={styles.sectionTitle}>What this module becomes</h2>

              <div style={styles.moduleStack}>
                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>Processing Handoff</div>
                  <div style={styles.moduleText}>
                    Loan officer triggers file handoff with processor
                    assignment, urgency, and operational note in one action.
                  </div>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>Open File Communication</div>
                  <div style={styles.moduleText}>
                    Shared internal updates keep loan officer and processor
                    aligned from handoff through close.
                  </div>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>Timeline Visibility</div>
                  <div style={styles.moduleText}>
                    File age, milestone stage, target close date, and blockers
                    stay visible to the team without losing context.
                  </div>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>Future LOS Connection</div>
                  <div style={styles.moduleText}>
                    This command layer can later sit above systems like ARIVE as
                    the coordination and intelligence layer rather than
                    replacing the LOS.
                  </div>
                </div>
              </div>

              <div style={styles.footerBrand}>
                Powered and Designed by Beyond Intelligence™ © 2026
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function TopNav({ active = "workflow" }: { active?: "team" | "workflow" }) {
  return (
    <div style={navStyles.topBar}>
      <a href="/" style={navStyles.brand}>
        Beyond Intelligence™
      </a>

      <div style={navStyles.topBarLinks}>
        <a href="/" style={navStyles.topBarLink}>
          Home
        </a>
        <a href="/borrower" style={navStyles.topBarLink}>
          Borrower Experience
        </a>
        <a
          href="/team"
          style={
            active === "team"
              ? navStyles.topBarLinkActive
              : navStyles.topBarLink
          }
        >
          Mortgage Intelligence
        </a>
        <a
          href="/workflow"
          style={
            active === "workflow"
              ? navStyles.topBarLinkActive
              : navStyles.topBarLink
          }
        >
          Workflow Intelligence
        </a>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string;
  subtext: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSubtext}>{subtext}</div>
    </div>
  );
}

function PipelineCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: WorkflowStatus;
}) {
  const tone = getStatusTone(status);

  return (
    <div
      style={{
        ...styles.pipelineCard,
        backgroundColor: tone.bg,
        borderColor: tone.border,
      }}
    >
      <div style={{ ...styles.pipelineLabel, color: tone.text }}>{label}</div>
      <div style={{ ...styles.pipelineValue, color: tone.text }}>{value}</div>
    </div>
  );
}

function MiniDataCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniCard}>
      <div style={styles.miniLabel}>{label}</div>
      <div style={styles.miniValue}>{value}</div>
    </div>
  );
}

const responsiveCss = `
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  @media (max-width: 1160px) {
    .bf-main-grid {
      grid-template-columns: 1fr !important;
    }

    .bf-hero-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 1080px) {
    .bf-workflow-hero-top {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 920px) {
    .bf-stat-grid,
    .bf-pipeline-grid,
    .bf-command-grid,
    .bf-mini-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 680px) {
    .bf-wrap {
      padding: 18px 12px 32px !important;
    }

    .bf-stat-grid,
    .bf-pipeline-grid,
    .bf-command-grid,
    .bf-mini-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F3F6FB",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 18px 40px",
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 28,
    color: "#ffffff",
    boxShadow: "0 16px 34px rgba(38,51,102,0.16)",
    marginBottom: 20,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 22,
    alignItems: "start",
  },
  workflowHeroTopBar: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 22,
    alignItems: "start",
  },
  workflowHeroLeft: {
    minWidth: 0,
  },
  workflowHeroRight: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 320,
  },
  userBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 20,
    padding: 16,
  },
  userBadgeTitle: {
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 4,
    color: "#ffffff",
  },
  userBadgeSubtext: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.92)",
  },
  signOutButton: {
    border: "1px solid rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    borderRadius: 16,
    padding: "14px 16px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15,
  },
  heroBadge: {
    display: "inline-block",
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: 800,
    opacity: 0.98,
    backgroundColor: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: "10px 14px",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontWeight: 900,
    fontSize: 56,
    lineHeight: 0.95,
  },
  heroText: {
    marginTop: 22,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 820,
    color: "rgba(255,255,255,0.94)",
  },
  heroPurposeCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 18,
  },
  heroPurposeTitle: {
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  heroPurposeList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 18,
  },
  heroActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  heroActionOutline: {
    textDecoration: "none",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
  },
  heroActionGhost: {
    textDecoration: "none",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
  },
  loginCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
    maxWidth: 760,
    margin: "0 auto",
  },
  loginActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryLinkButton: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 14,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  secondaryLinkButton: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 14,
    border: "1px solid #263366",
    backgroundColor: "#ffffff",
    color: "#263366",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
  },
  statTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0284C7",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 10,
  },
  statSubtext: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.5,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
    marginBottom: 20,
  },
  sectionEyebrow: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: 0,
    color: "#2D3B78",
    fontSize: 28,
    lineHeight: 1.15,
    fontWeight: 900,
  },
  sectionText: {
    color: "#64748B",
    lineHeight: 1.7,
    fontSize: 15,
    marginTop: 10,
    marginBottom: 0,
  },
  pipelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  searchWrap: {
    minWidth: 320,
    flex: "0 1 420px",
  },
  searchLabel: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    color: "#2D3B78",
    marginBottom: 8,
  },
  searchInput: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #B6C6E1",
    padding: "13px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0F172A",
    backgroundColor: "#ffffff",
  },
  pipelineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gap: 10,
  },
  pipelineCard: {
    borderRadius: 18,
    border: "1px solid",
    padding: 14,
    minHeight: 108,
  },
  pipelineLabel: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.4,
    marginBottom: 12,
  },
  pipelineValue: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 0.9fr",
    gap: 20,
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 8,
  },
  fileCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: 24,
    border: "1px solid #D7E2F0",
    backgroundColor: "#ffffff",
    padding: 16,
    cursor: "pointer",
  },
  fileCardSelected: {
    backgroundColor: "#F4FBFF",
    border: "1px solid #A5E3F5",
    boxShadow: "inset 0 0 0 1px rgba(0,150,199,0.08)",
  },
  fileCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  fileBorrower: {
    fontSize: 22,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 6,
  },
  fileMeta: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  badgeRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    borderRadius: 999,
    border: "1px solid",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  miniCard: {
    borderRadius: 18,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F9FBFE",
    padding: 14,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748B",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  miniValue: {
    fontSize: 16,
    fontWeight: 800,
    color: "#2D3B78",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  commandTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  commandGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginBottom: 18,
  },
  commandNote: {
    borderRadius: 18,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F8FAFC",
    padding: "14px 16px",
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.65,
    marginTop: 12,
    wordBreak: "break-word",
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    color: "#2D3B78",
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #B6C6E1",
    padding: "13px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0F172A",
    backgroundColor: "#ffffff",
  },
  textarea: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #B6C6E1",
    padding: "13px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0F172A",
    backgroundColor: "#ffffff",
    resize: "vertical",
  },
  commandButton: {
    width: "100%",
    marginTop: 18,
    border: "none",
    borderRadius: 20,
    backgroundColor: "#3E4E93",
    color: "#ffffff",
    padding: "16px 20px",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(38,51,102,0.16)",
  },
  infoBox: {
    marginTop: 14,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    color: "#1E3A8A",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  attentionList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },
  attentionCard: {
    borderRadius: 20,
    border: "1px solid #F2C086",
    backgroundColor: "#FFF9F2",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  attentionName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 4,
  },
  attentionMeta: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.5,
  },
  attentionIssue: {
    color: "#9A3412",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.5,
  },
  gradientButton: {
    width: "100%",
    marginTop: 14,
    border: "none",
    borderRadius: 18,
    background: "linear-gradient(90deg, #109BC9 0%, #34B7E2 100%)",
    color: "#ffffff",
    padding: "15px 18px",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  },
  feedList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 18,
  },
  feedCard: {
    borderRadius: 20,
    border: "1px solid #E2E8F0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  feedHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },
  feedAuthor: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
  },
  feedMeta: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 1.5,
  },
  feedText: {
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.7,
  },
  moduleStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },
  moduleCard: {
    borderRadius: 20,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F9FBFE",
    padding: 16,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 8,
  },
  moduleText: {
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.7,
  },
  footerBrand: {
    textAlign: "center",
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid #E2E8F0",
    color: "#64748B",
    fontSize: 14,
  },
  placeholderBox: {
    borderRadius: 18,
    border: "1px dashed #CBD5E1",
    backgroundColor: "#F8FAFC",
    color: "#475569",
    padding: 16,
    lineHeight: 1.7,
    fontSize: 14,
    marginTop: 10,
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
  topBarLinkActive: {
    textDecoration: "none",
    color: "#ffffff",
    background: "#263366",
    border: "1px solid #263366",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  },
};
