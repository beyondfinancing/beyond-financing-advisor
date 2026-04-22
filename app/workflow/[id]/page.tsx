"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Branch Manager"
  | "Real Estate Agent";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  role: TeamRole;
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

type WorkflowFile = {
  id: string;
  loanNumber: string;
  borrowerName: string;
  purpose: string;
  amount: number;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  loanOfficer: string;
  processor: string;
  productionManager: string;
  requestedProcessorNote: string;
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
  file_number?: string | null;
  borrower_name: string;
  purpose: string;
  amount: number | string | null;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  loan_officer: string;
  processor: string | null;
  production_manager?: string | null;
  requested_processor_note?: string | null;
  target_close: string | null;
  file_age_days: number | null;
  occupancy: string;
  blocker: string;
  next_internal_action: string;
  next_borrower_action: string;
  latest_update: string;
};

type FeedItem = {
  id: string;
  author: string;
  role: string;
  text: string;
  created_at: string;
};

type WorkflowRouteRole =
  | "loan_officer"
  | "processing"
  | "assistant";

type NotificationTarget = {
  role: WorkflowRouteRole;
  name: string;
  email: string;
};

const PROCESSORS = [
  "Unassigned",
  "Amarilis Santos",
  "Kyle Nicholson",
  "Bia Marques",
];

const DEFAULT_PROCESSING_EMAIL = "myloan@beyondfinancing.com";

const PROCESSOR_EMAILS: Record<string, string> = {
  "Amarilis Santos": "amarilis@beyondfinancing.com",
  "Kyle Nicholson": "kyle@beyondfinancing.com",
  "Bia Marques": "bia@beyondfinancing.com",
};

const LOAN_OFFICER_EMAILS: Record<string, string> = {
  "Sandro Pansini Souza": "pansini@beyondfinancing.com",
  "Warren Wendt": "warren@beyondfinancing.com",
  "Finley Beyond": "finley@beyondfinancing.com",
};

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTargetClose(value: string) {
  if (!value) return "No date set";
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
      return { bg: "#EEF2FF", border: "#C7D2FE", text: "#3755A5" };
    case "pre_approval_review":
      return { bg: "#F3F0FF", border: "#D8CCFF", text: "#5B3DB4" };
    case "sent_to_processing":
      return { bg: "#ECFEFF", border: "#A5F3FC", text: "#0E7490" };
    case "processing_active":
      return { bg: "#ECFDF3", border: "#BBF7D0", text: "#15803D" };
    case "submitted_to_lender":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    case "conditional_approval":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    case "clear_to_close":
      return { bg: "#ECFDF3", border: "#86EFAC", text: "#047857" };
    case "closed":
      return { bg: "#F3F4F6", border: "#D1D5DB", text: "#374151" };
    default:
      return { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" };
  }
}

function getUrgencyTone(urgency: WorkflowUrgency) {
  switch (urgency) {
    case "Rush":
      return { bg: "#FDF2F8", border: "#F9A8D4", text: "#BE185D" };
    case "Priority":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    default:
      return { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" };
  }
}

function formatFeedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function mapRoleToWorkflow(role: TeamRole): WorkflowRouteRole {
  if (role === "Processor") return "processing";
  if (role === "Loan Officer Assistant") return "assistant";
  return "loan_officer";
}

function getProcessorNotificationEmail(name: string) {
  return PROCESSOR_EMAILS[name] || DEFAULT_PROCESSING_EMAIL;
}

function getLoanOfficerNotificationEmail(name: string) {
  return LOAN_OFFICER_EMAILS[name] || "pansini@beyondfinancing.com";
}

function resolveNotificationTarget(
  file: WorkflowFile,
  activeUser: TeamUser
): NotificationTarget {
  if (activeUser.role === "Processor") {
    return {
      role: "loan_officer",
      name: file.loanOfficer || "Loan Officer",
      email: getLoanOfficerNotificationEmail(file.loanOfficer),
    };
  }

  return {
    role: "processing",
    name:
      file.processor && file.processor !== "Unassigned"
        ? file.processor
        : "Processing Team",
    email: getProcessorNotificationEmail(file.processor),
  };
}

function buildChangedFieldsSummary(params: {
  file: WorkflowFile;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  targetClose: string;
  occupancy: string;
  processor: string;
  requestedProcessorNote: string;
  blocker: string;
  nextInternalAction: string;
  nextBorrowerAction: string;
  latestUpdate: string;
}) {
  const {
    file,
    status,
    urgency,
    targetClose,
    occupancy,
    processor,
    requestedProcessorNote,
    blocker,
    nextInternalAction,
    nextBorrowerAction,
    latestUpdate,
  } = params;

  const changedFields: string[] = [];

  if (status !== file.status) {
    changedFields.push(
      `Status: ${getStatusLabel(file.status)} → ${getStatusLabel(status)}`
    );
  }

  if (urgency !== file.urgency) {
    changedFields.push(`Urgency: ${file.urgency} → ${urgency}`);
  }

  if ((targetClose || "") !== toDateInputValue(file.targetClose || "")) {
    changedFields.push(
      `Target close date: ${formatTargetClose(file.targetClose)} → ${formatTargetClose(targetClose)}`
    );
  }

  if ((occupancy || "").trim() !== (file.occupancy || "").trim()) {
    changedFields.push(`Occupancy: ${file.occupancy || "Not set"} → ${occupancy || "Not set"}`);
  }

  if ((processor || "").trim() !== (file.processor || "").trim()) {
    changedFields.push(`Assigned processor: ${file.processor || "Unassigned"} → ${processor || "Unassigned"}`);
  }

  if ((requestedProcessorNote || "").trim() !== (file.requestedProcessorNote || "").trim()) {
    changedFields.push("Requested processor note updated");
  }

  if ((blocker || "").trim() !== (file.blocker || "").trim()) {
    changedFields.push("Current blocker updated");
  }

  if ((nextInternalAction || "").trim() !== (file.nextInternalAction || "").trim()) {
    changedFields.push("Next internal action updated");
  }

  if ((nextBorrowerAction || "").trim() !== (file.nextBorrowerAction || "").trim()) {
    changedFields.push("Next borrower action updated");
  }

  if ((latestUpdate || "").trim() !== (file.latestUpdate || "").trim()) {
    changedFields.push("Latest file update updated");
  }

  return changedFields;
}

export default function WorkflowFileDetailPage() {
  const fileId =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean).pop() || ""
      : "";

  const [activeUser, setActiveUser] = useState<TeamUser | null>(null);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [file, setFile] = useState<WorkflowFile | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [loanNumber, setLoanNumber] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [purpose, setPurpose] = useState("Purchase");
  const [amount, setAmount] = useState("");
  const [loanOfficer, setLoanOfficer] = useState("");
  const [status, setStatus] = useState<WorkflowStatus>("new_scenario");
  const [urgency, setUrgency] = useState<WorkflowUrgency>("Priority");
  const [targetClose, setTargetClose] = useState("");
  const [occupancy, setOccupancy] = useState("Primary Residence");
  const [processor, setProcessor] = useState("Unassigned");
  const [requestedProcessorNote, setRequestedProcessorNote] = useState("");
  const [blocker, setBlocker] = useState("");
  const [nextInternalAction, setNextInternalAction] = useState("");
  const [nextBorrowerAction, setNextBorrowerAction] = useState("");
  const [latestUpdate, setLatestUpdate] = useState("");

  const [internalUpdateText, setInternalUpdateText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManageProcessing =
    activeUser?.role === "Production Manager" ||
    activeUser?.name === "Amarilis Santos";

  const canDeleteFile =
    activeUser?.role === "Branch Manager" ||
    activeUser?.name === "Sandro Pansini Souza";

  const handleSignOut = async () => {
    await fetch("/api/team-auth/logout", { method: "POST" });
    setActiveUser(null);
    window.location.href = "/team";
  };

  const mapFile = useCallback((f: WorkflowApiFile): WorkflowFile => {
    return {
      id: String(f.id ?? ""),
      loanNumber: String(f.file_number ?? ""),
      borrowerName: String(f.borrower_name ?? ""),
      purpose: String(f.purpose ?? ""),
      amount: Number(f.amount ?? 0),
      status: f.status,
      urgency: f.urgency,
      loanOfficer: String(f.loan_officer ?? ""),
      processor: String(f.processor ?? "Unassigned"),
      productionManager: String(f.production_manager ?? "Pending Assignment"),
      requestedProcessorNote: String(f.requested_processor_note ?? ""),
      targetClose: String(f.target_close ?? ""),
      fileAgeDays: Number(f.file_age_days ?? 0),
      occupancy: String(f.occupancy ?? ""),
      blocker: String(f.blocker ?? ""),
      nextInternalAction: String(f.next_internal_action ?? ""),
      nextBorrowerAction: String(f.next_borrower_action ?? ""),
      latestUpdate: String(f.latest_update ?? ""),
    };
  }, []);

  const syncForm = useCallback((f: WorkflowFile) => {
    setLoanNumber(f.loanNumber);
    setBorrowerName(f.borrowerName);
    setPurpose(f.purpose);
    setAmount(String(f.amount || ""));
    setLoanOfficer(f.loanOfficer);
    setStatus(f.status);
    setUrgency(f.urgency);
    setTargetClose(toDateInputValue(f.targetClose));
    setOccupancy(f.occupancy);
    setProcessor(f.processor || "Unassigned");
    setRequestedProcessorNote(f.requestedProcessorNote || "");
    setBlocker(f.blocker);
    setNextInternalAction(f.nextInternalAction);
    setNextBorrowerAction(f.nextBorrowerAction);
    setLatestUpdate(f.latestUpdate);
  }, []);

  const loadFile = useCallback(async () => {
    if (!fileId) return;

    try {
      setLoading(true);
      setSaveError("");
      setSaveMessage("");

      const res = await fetch(`/api/workflow/${fileId}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setSaveError(data?.error || "Unable to load workflow file.");
        setFile(null);
        setFeed([]);
        return;
      }

      const mappedFile = mapFile(data.file as WorkflowApiFile);
      setFile(mappedFile);
      syncForm(mappedFile);
      setFeed(Array.isArray(data.feed) ? data.feed : []);
    } catch (error) {
      console.error(error);
      setSaveError("Unable to load workflow file.");
    } finally {
      setLoading(false);
    }
  }, [fileId, mapFile, syncForm]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/team-auth/me");

        if (response.ok) {
          const data = await response.json();

          if (data?.authenticated && data?.user) {
            setActiveUser(data.user);
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
    loadFile();
  }, [loadFile]);

  const activeStatusTone = useMemo(
    () => getStatusTone(status),
    [status]
  );

  const activeUrgencyTone = useMemo(
    () => getUrgencyTone(urgency),
    [urgency]
  );

  const saveFileChanges = async () => {
    if (!file || !activeUser) return;

    try {
      setSaving(true);
      setSaveError("");
      setSaveMessage("");

      const payload: Record<string, unknown> = {
        loanNumber: loanNumber.trim(),
        borrowerName: borrowerName.trim(),
        purpose: purpose.trim(),
        amount: Number(amount || 0),
        loanOfficer: loanOfficer.trim(),
        status,
        urgency,
        targetClose: targetClose.trim(),
        occupancy: occupancy.trim(),
        blocker: blocker.trim(),
        nextInternalAction: nextInternalAction.trim(),
        nextBorrowerAction: nextBorrowerAction.trim(),
        latestUpdate: latestUpdate.trim(),
        requestedProcessorNote: requestedProcessorNote.trim(),
        author: activeUser.name || "Team User",
        role: activeUser.role || "Professional",
      };

      if (canManageProcessing) {
        payload.processor = processor.trim() || "Unassigned";
      }

      const response = await fetch(`/api/workflow/${file.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setSaveError(data?.error || "Unable to save workflow file changes.");
        return;
      }

      const mappedFile = mapFile(data.file as WorkflowApiFile);
      setFile(mappedFile);
      syncForm(mappedFile);

      const changedFields = buildChangedFieldsSummary({
        file,
        status,
        urgency,
        targetClose,
        occupancy,
        processor: canManageProcessing ? processor : file.processor,
        requestedProcessorNote,
        blocker,
        nextInternalAction,
        nextBorrowerAction,
        latestUpdate,
      });

      if (changedFields.length === 0) {
        setSaveMessage("Workflow file updated successfully.");
        return;
      }

      const target = resolveNotificationTarget(file, activeUser);

      try {
        const notifyResponse = await fetch("/api/workflow/file-change", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            loanId: file.loanNumber || file.borrowerName || file.id,
            fileId: file.id,
            changedByRole: mapRoleToWorkflow(activeUser.role),
            changedByName: activeUser.name,
            changedByEmail: activeUser.email,
            notifyName: target.name,
            notifyEmail: target.email,
            receiptEmail: activeUser.email,
            changeSummary: `Workflow file updated by ${activeUser.name}.`,
            changedFields,
          }),
        });

        const notifyData = await notifyResponse.json().catch(() => null);

        if (notifyResponse.ok && notifyData?.success) {
          setSaveMessage("Workflow file updated and notification emails sent.");
        } else {
          setSaveMessage(
            "Workflow file updated, but notification email could not be confirmed."
          );
        }
      } catch (notifyError) {
        console.error("WORKFLOW FILE CHANGE NOTIFY ERROR:", notifyError);
        setSaveMessage(
          "Workflow file updated, but notification email could not be confirmed."
        );
      }
    } catch (error) {
      console.error(error);
      setSaveError("Unable to save workflow file changes.");
    } finally {
      setSaving(false);
    }
  };

  const addInternalUpdate = async () => {
    if (!file || !activeUser) return;

    const trimmed = internalUpdateText.trim();
    if (!trimmed) return;

    try {
      setPostingUpdate(true);
      setSaveError("");
      setSaveMessage("");

      const response = await fetch(`/api/workflow/${file.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add_feed_entry",
          author: activeUser.name || "Team User",
          role: activeUser.role || "Professional",
          text: trimmed,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setSaveError(data?.error || "Unable to add internal update.");
        return;
      }

      const target = resolveNotificationTarget(file, activeUser);

      try {
        const noteResponse = await fetch("/api/workflow/note", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            loanId: file.loanNumber || file.borrowerName || file.id,
            fileId: file.id,
            fromRole: mapRoleToWorkflow(activeUser.role),
            fromName: activeUser.name,
            fromEmail: activeUser.email,
            toRole: target.role,
            toName: target.name,
            toEmail: target.email,
            noteType: "internal_update",
            message: trimmed,
          }),
        });

        const noteData = await noteResponse.json().catch(() => null);

        setInternalUpdateText("");
        await loadFile();

        if (noteResponse.ok && noteData?.success) {
          setSaveMessage("Internal update added and notification emails sent.");
        } else {
          setSaveMessage(
            "Internal update added, but notification email could not be confirmed."
          );
        }
      } catch (notifyError) {
        console.error("WORKFLOW NOTE NOTIFY ERROR:", notifyError);
        setInternalUpdateText("");
        await loadFile();
        setSaveMessage(
          "Internal update added, but notification email could not be confirmed."
        );
      }
    } catch (error) {
      console.error(error);
      setSaveError("Unable to add internal update.");
    } finally {
      setPostingUpdate(false);
    }
  };

  const deleteWorkflowFile = async () => {
    if (!file || !canDeleteFile) return;

    const confirmed = window.confirm(
      `Delete workflow file for ${file.borrowerName}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setSaveError("");
      setSaveMessage("");

      const response = await fetch(`/api/workflow/${file.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author: activeUser?.name || "",
          role: activeUser?.role || "",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setSaveError(data?.error || "Unable to delete workflow file.");
        return;
      }

      window.location.href = "/workflow";
    } catch (error) {
      console.error(error);
      setSaveError("Unable to delete workflow file.");
    } finally {
      setDeleting(false);
    }
  };

  if (authCheckLoading || loading) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div style={styles.wrap}>
          <section style={styles.hero}>
            <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
            <h1 style={styles.heroTitle}>Loading operational file...</h1>
          </section>
        </div>
      </main>
    );
  }

  if (!activeUser) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div style={styles.wrap}>
          <section style={styles.hero}>
            <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
            <h1 style={styles.heroTitle}>Protected Professional Access</h1>
            <p style={styles.heroText}>
              Please sign in through Team Mortgage Intelligence first.
            </p>
            <div style={styles.heroActionRow}>
              <a href="/team" style={styles.heroActionOutline}>
                Go to Login
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!file) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div style={styles.wrap}>
          <section style={styles.hero}>
            <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
            <h1 style={styles.heroTitle}>File not found</h1>
            <p style={styles.heroText}>
              The requested workflow file could not be loaded.
            </p>
            <div style={styles.heroActionRow}>
              <a href="/workflow" style={styles.heroActionOutline}>
                Back to Workflow Intelligence
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div style={styles.wrap}>
        <TopNav active="workflow" />

        <section style={styles.hero}>
          <div className="bf-detail-hero-grid" style={styles.heroGrid}>
            <div>
              <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
              <h1 style={styles.heroTitle}>{file.borrowerName}</h1>
              <p style={styles.heroText}>
                Operational record for this loan file, including status, borrower actions, internal actions, file notes, and controlled update permissions.
              </p>

              <div style={styles.heroActionRow}>
                <Link href="/workflow" style={styles.heroActionOutline}>
                  Back to Workflow Intelligence
                </Link>
                <button type="button" onClick={loadFile} style={styles.heroActionButton}>
                  Refresh File
                </button>
                <button type="button" onClick={handleSignOut} style={styles.heroActionButton}>
                  Sign Out
                </button>
              </div>
            </div>

            <div style={styles.heroRightPanel}>
              <div style={styles.userBadge}>
                <div style={styles.userBadgeTitle}>
                  Logged in as: {activeUser.name}
                </div>
                <div style={styles.userBadgeSubtext}>
                  Role: {activeUser.role} · {activeUser.email}
                </div>
              </div>

              <div style={styles.heroRuleCard}>
                <div style={styles.heroRuleTitle}>Permission Rules</div>
                <div style={styles.heroRuleText}>
                  Processor assignment can only be changed by the Production Manager.
                  <br />
                  File deletion can only be done by the Branch Manager.
                </div>
              </div>

              <div style={styles.badgeRow}>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: activeStatusTone.bg,
                    borderColor: activeStatusTone.border,
                    color: activeStatusTone.text,
                  }}
                >
                  {getStatusLabel(status)}
                </span>

                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: activeUrgencyTone.bg,
                    borderColor: activeUrgencyTone.border,
                    color: activeUrgencyTone.text,
                  }}
                >
                  {urgency}
                </span>
              </div>
            </div>
          </div>
        </section>

        {saveError ? <div style={styles.errorBox}>{saveError}</div> : null}
        {saveMessage ? <div style={styles.infoBox}>{saveMessage}</div> : null}

        <div className="bf-detail-main-grid" style={styles.mainGrid}>
          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>FILE SNAPSHOT</div>
              <h2 style={styles.sectionTitle}>Current operational profile</h2>

              <div className="bf-mini-grid" style={styles.miniGrid}>
                <MiniDataCard label="LOAN NUMBER" value={file.loanNumber || "Not Assigned"} />
                <MiniDataCard label="LOAN PURPOSE" value={file.purpose} />
                <MiniDataCard label="AMOUNT" value={formatCurrency(file.amount)} />
                <MiniDataCard label="TARGET CLOSE" value={formatTargetClose(file.targetClose)} />
                <MiniDataCard label="LOAN OFFICER" value={file.loanOfficer} />
                <MiniDataCard label="PROCESSOR" value={file.processor || "Unassigned"} />
                <MiniDataCard label="OCCUPANCY" value={file.occupancy} />
                <MiniDataCard label="FILE AGE" value={`${file.fileAgeDays} days`} />
              </div>

              <div style={styles.commandNote}>
                <strong>Current blocker:</strong> {file.blocker}
              </div>
              <div style={styles.commandNote}>
                <strong>Next internal action:</strong> {file.nextInternalAction}
              </div>
              <div style={styles.commandNote}>
                <strong>Next borrower action:</strong> {file.nextBorrowerAction}
              </div>
              <div style={styles.commandNote}>
                <strong>Latest file update:</strong> {file.latestUpdate}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>INTERNAL FILE FEED</div>
              <h2 style={styles.sectionTitle}>Timeline and internal updates</h2>

              <label style={styles.label}>Add internal update</label>
              <textarea
                value={internalUpdateText}
                onChange={(e) => setInternalUpdateText(e.target.value)}
                placeholder="Post a structured internal update for this active file."
                rows={4}
                style={styles.textarea}
              />
              <button
                type="button"
                onClick={addInternalUpdate}
                style={styles.feedButton}
                disabled={postingUpdate}
              >
                {postingUpdate ? "Adding Update..." : "Add Internal Update"}
              </button>

              <div style={styles.feedList}>
                {feed.length === 0 ? (
                  <div style={styles.placeholderBox}>
                    No internal updates yet for this file.
                  </div>
                ) : (
                  feed.map((item) => (
                    <div key={item.id} style={styles.feedCard}>
                      <div style={styles.feedHeader}>
                        <div style={styles.feedAuthor}>{item.author}</div>
                        <div style={styles.feedMeta}>
                          {item.role} · {formatFeedTime(item.created_at)}
                        </div>
                      </div>
                      <div style={styles.feedText}>{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>EDIT FILE</div>
              <h2 style={styles.sectionTitle}>Update operational details</h2>

              <label style={styles.label}>Loan number</label>
              <input
                value={loanNumber}
                onChange={(e) => setLoanNumber(e.target.value)}
                style={styles.input}
                placeholder="ARIVE / internal loan number"
              />

              <label style={styles.label}>Borrower full name</label>
              <input
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Loan purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Loan officer</label>
              <input
                value={loanOfficer}
                onChange={(e) => setLoanOfficer(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
                style={styles.input}
              >
                <option value="new_scenario">New Scenario</option>
                <option value="pre_approval_review">Pre-Approval Review</option>
                <option value="sent_to_processing">Sent to Processing</option>
                <option value="processing_active">Processing Active</option>
                <option value="submitted_to_lender">Submitted to Lender</option>
                <option value="conditional_approval">Conditional Approval</option>
                <option value="clear_to_close">Clear to Close</option>
                <option value="closed">Closed</option>
              </select>

              <label style={styles.label}>Urgency</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as WorkflowUrgency)}
                style={styles.input}
              >
                <option value="Standard">Standard</option>
                <option value="Priority">Priority</option>
                <option value="Rush">Rush</option>
              </select>

              <label style={styles.label}>Target close date</label>
              <input
                type="date"
                value={targetClose}
                onChange={(e) => setTargetClose(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Occupancy</label>
              <input
                value={occupancy}
                onChange={(e) => setOccupancy(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Requested processor note</label>
              <textarea
                value={requestedProcessorNote}
                onChange={(e) => setRequestedProcessorNote(e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Assigned processor</label>
              <select
                value={processor}
                onChange={(e) => setProcessor(e.target.value)}
                style={styles.input}
                disabled={!canManageProcessing}
              >
                {PROCESSORS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {!canManageProcessing ? (
                <div style={styles.infoBox}>
                  Only the Production Manager can change the assigned processor.
                </div>
              ) : null}

              <label style={styles.label}>Current blocker</label>
              <textarea
                value={blocker}
                onChange={(e) => setBlocker(e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Next internal action</label>
              <textarea
                value={nextInternalAction}
                onChange={(e) => setNextInternalAction(e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Next borrower action</label>
              <textarea
                value={nextBorrowerAction}
                onChange={(e) => setNextBorrowerAction(e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Latest file update</label>
              <textarea
                value={latestUpdate}
                onChange={(e) => setLatestUpdate(e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <button
                type="button"
                onClick={saveFileChanges}
                style={styles.commandButton}
                disabled={saving}
              >
                {saving ? "Saving Changes..." : "Save File Changes"}
              </button>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>CONTROLLED ACTIONS</div>
              <h2 style={styles.sectionTitle}>Restricted file controls</h2>

              <div style={styles.commandNote}>
                <strong>Branch Manager delete authority:</strong>{" "}
                {canDeleteFile ? "Enabled for this session." : "Not available in this session."}
              </div>

              <button
                type="button"
                onClick={deleteWorkflowFile}
                style={{
                  ...styles.deleteButton,
                  opacity: canDeleteFile ? 1 : 0.5,
                  cursor: canDeleteFile ? "pointer" : "not-allowed",
                }}
                disabled={!canDeleteFile || deleting}
              >
                {deleting ? "Deleting Workflow File..." : "Delete Workflow File"}
              </button>

              <div style={styles.deleteHelpText}>
                Only the Branch Manager should have file deletion authority.
                Sandro Pansini Souza is currently the sole Branch Manager.
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
    .bf-detail-main-grid,
    .bf-detail-hero-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 920px) {
    .bf-mini-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 680px) {
    .bf-detail-wrap {
      padding: 18px 12px 32px !important;
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
  heroRightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
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
  heroRuleCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 18,
  },
  heroRuleTitle: {
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 12,
  },
  heroRuleText: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "rgba(255,255,255,0.95)",
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
  heroActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 20,
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
  heroActionButton: {
    border: "1px solid rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 0.95fr",
    gap: 20,
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
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
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
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
  feedButton: {
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
  infoBox: {
    marginBottom: 14,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    color: "#1E3A8A",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  errorBox: {
    marginBottom: 14,
    backgroundColor: "#FFF1F2",
    border: "1px solid #FECDD3",
    color: "#B42318",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
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
  deleteButton: {
    width: "100%",
    marginTop: 18,
    border: "none",
    borderRadius: 20,
    backgroundColor: "#C92519",
    color: "#ffffff",
    padding: "16px 20px",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 10px 20px rgba(201,37,25,0.18)",
  },
  deleteHelpText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.6,
    marginTop: 12,
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
