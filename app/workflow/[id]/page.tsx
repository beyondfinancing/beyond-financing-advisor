
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Branch Manager"
  | "Real Estate Agent";

type TeamUser = {
  id?: string;
  name: string;
  email: string;
  nmls?: string;
  role: TeamRole | string;
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
  id?: string;
  borrower_name?: string;
  purpose?: string;
  amount?: number | string | null;
  status?: WorkflowStatus;
  urgency?: WorkflowUrgency;
  loan_officer?: string;
  processor?: string;
  target_close?: string;
  file_age_days?: number | string | null;
  occupancy?: string;
  blocker?: string;
  next_internal_action?: string;
  next_borrower_action?: string;
  latest_update?: string;
};

type FeedItem = {
  id: string;
  author: string;
  role: string;
  timeLabel: string;
  text: string;
  createdAt?: string;
};

type WorkflowFeedApiItem = {
  id?: string;
  author?: string;
  role?: string;
  text?: string;
  created_at?: string;
};

const PROCESSORS = [
  "Amarilis Santos",
  "Kyle Nicholson",
  "Bia Marques",
];

const PURPOSE_OPTIONS = [
  "Purchase",
  "Rate/Term Refinance",
  "Cash-Out Refinance",
  "HELOC",
  "Second Mortgage",
];

const OCCUPANCY_OPTIONS = [
  "Primary Residence",
  "Second Home",
  "Investment Property",
];

const STATUS_OPTIONS: WorkflowStatus[] = [
  "new_scenario",
  "pre_approval_review",
  "sent_to_processing",
  "processing_active",
  "submitted_to_lender",
  "conditional_approval",
  "clear_to_close",
  "closed",
];

const URGENCY_OPTIONS: WorkflowUrgency[] = ["Standard", "Priority", "Rush"];

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(value?: string) {
  if (!value) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-US").format(parsed);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function toDateInputValue(value?: string) {
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

function mapApiFileToUi(file?: WorkflowApiFile | null): WorkflowFile | null {
  if (!file?.id) return null;

  return {
    id: String(file.id),
    borrowerName: String(file.borrower_name ?? ""),
    purpose: String(file.purpose ?? ""),
    amount: Number(file.amount ?? 0),
    status: (file.status ?? "new_scenario") as WorkflowStatus,
    urgency: (file.urgency ?? "Standard") as WorkflowUrgency,
    loanOfficer: String(file.loan_officer ?? ""),
    processor: String(file.processor ?? ""),
    targetClose: String(file.target_close ?? ""),
    fileAgeDays: Number(file.file_age_days ?? 0),
    occupancy: String(file.occupancy ?? ""),
    blocker: String(file.blocker ?? ""),
    nextInternalAction: String(file.next_internal_action ?? ""),
    nextBorrowerAction: String(file.next_borrower_action ?? ""),
    latestUpdate: String(file.latest_update ?? ""),
  };
}

function mapFeedItem(item: WorkflowFeedApiItem, index: number): FeedItem {
  return {
    id: String(item.id ?? `feed-${index}`),
    author: String(item.author ?? "Team User"),
    role: String(item.role ?? "Professional"),
    text: String(item.text ?? ""),
    createdAt: item.created_at,
    timeLabel: formatDateLabel(item.created_at),
  };
}

export default function WorkflowFileDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const fileId = decodeURIComponent(String(params?.id ?? ""));

  const [activeUser, setActiveUser] = useState<TeamUser | null>(null);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [file, setFile] = useState<WorkflowFile | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const [loadingFile, setLoadingFile] = useState(true);
  const [savingFile, setSavingFile] = useState(false);
  const [addingFeed, setAddingFeed] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);

  const [pageMessage, setPageMessage] = useState("");
  const [pageError, setPageError] = useState("");

  const [internalUpdateInput, setInternalUpdateInput] = useState("");

  const [editForm, setEditForm] = useState({
    borrowerName: "",
    purpose: "Purchase",
    amount: "",
    status: "new_scenario" as WorkflowStatus,
    urgency: "Standard" as WorkflowUrgency,
    loanOfficer: "",
    processor: "",
    targetClose: "",
    occupancy: "Primary Residence",
    blocker: "",
    nextInternalAction: "",
    nextBorrowerAction: "",
    latestUpdate: "",
  });

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

  const isBranchManager = useMemo(() => {
    if (!activeUser) return false;
    return (
      activeUser.role === "Branch Manager" ||
      activeUser.name === "Sandro Pansini Souza"
    );
  }, [activeUser]);

  const isProductionManager = useMemo(() => {
    if (!activeUser) return false;
    return (
      activeUser.role === "Production Manager" ||
      activeUser.name === "Amarilis Santos"
    );
  }, [activeUser]);

  const loadFileDetail = async () => {
    if (!fileId) return;

    setLoadingFile(true);
    setPageError("");
    setPageMessage("");

    try {
      const detailResponse = await fetch(`/api/workflow/${fileId}`, {
        cache: "no-store",
      });

      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        const resolvedFile = mapApiFileToUi(
          detailData?.file || detailData?.data || detailData
        );

        if (!resolvedFile) {
          throw new Error("Workflow file was not found.");
        }

        const resolvedFeed = Array.isArray(detailData?.feed)
          ? detailData.feed.map(mapFeedItem)
          : [];

        setFile(resolvedFile);
        setFeedItems(resolvedFeed);
        return;
      }

      const fallbackResponse = await fetch("/api/workflow", {
        cache: "no-store",
      });

      if (!fallbackResponse.ok) {
        throw new Error("Unable to load workflow file.");
      }

      const fallbackData = await fallbackResponse.json();
      const files = Array.isArray(fallbackData?.files) ? fallbackData.files : [];
      const matched = files.find(
        (item: WorkflowApiFile) => String(item?.id ?? "") === fileId
      );

      const resolvedFallbackFile = mapApiFileToUi(matched);
      if (!resolvedFallbackFile) {
        throw new Error("Workflow file was not found.");
      }

      setFile(resolvedFallbackFile);
      setFeedItems([]);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load the workflow detail page."
      );
      setFile(null);
      setFeedItems([]);
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    loadFileDetail();
  }, [fileId]);

  useEffect(() => {
    if (!file) return;

    setEditForm({
      borrowerName: file.borrowerName,
      purpose: file.purpose || "Purchase",
      amount: String(file.amount || ""),
      status: file.status,
      urgency: file.urgency,
      loanOfficer: file.loanOfficer,
      processor: file.processor,
      targetClose: toDateInputValue(file.targetClose),
      occupancy: file.occupancy || "Primary Residence",
      blocker: file.blocker,
      nextInternalAction: file.nextInternalAction,
      nextBorrowerAction: file.nextBorrowerAction,
      latestUpdate: file.latestUpdate,
    });
  }, [file]);

  const handleEditField = (
    key: keyof typeof editForm,
    value: string | WorkflowStatus | WorkflowUrgency
  ) => {
    setEditForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveFile = async () => {
    if (!file) return;

    setSavingFile(true);
    setPageError("");
    setPageMessage("");

    try {
      const payload: Record<string, unknown> = {
        borrower_name: editForm.borrowerName,
        purpose: editForm.purpose,
        amount: Number(editForm.amount || 0),
        status: editForm.status,
        urgency: editForm.urgency,
        loan_officer: editForm.loanOfficer,
        target_close: editForm.targetClose || null,
        occupancy: editForm.occupancy,
        blocker: editForm.blocker,
        next_internal_action: editForm.nextInternalAction,
        next_borrower_action: editForm.nextBorrowerAction,
        latest_update: editForm.latestUpdate,
      };

      if (isProductionManager) {
        payload.processor = editForm.processor;
      }

      const response = await fetch(`/api/workflow/${file.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to save workflow file changes."
        );
      }

      const updatedFile = mapApiFileToUi(data?.file || data?.data || data);
      if (updatedFile) {
        setFile(updatedFile);
      } else {
        await loadFileDetail();
      }

      setPageMessage("Workflow file updated successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to save workflow file."
      );
    } finally {
      setSavingFile(false);
    }
  };

  const addInternalUpdate = async () => {
    if (!file || !internalUpdateInput.trim()) return;

    setAddingFeed(true);
    setPageError("");
    setPageMessage("");

    try {
      const response = await fetch(`/api/workflow/${file.id}/feed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author: activeUser?.name || "Team User",
          role: activeUser?.role || "Professional",
          text: internalUpdateInput.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to add internal update.");
      }

      const createdFeed = data?.feed
        ? mapFeedItem(data.feed, 0)
        : {
            id: `feed-${Date.now()}`,
            author: activeUser?.name || "Team User",
            role: activeUser?.role || "Professional",
            text: internalUpdateInput.trim(),
            timeLabel: "Just now",
          };

      setFeedItems((prev) => [createdFeed, ...prev]);
      setInternalUpdateInput("");
      setPageMessage("Internal update added successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to add internal update."
      );
    } finally {
      setAddingFeed(false);
    }
  };

  const deleteFile = async () => {
    if (!file || !isBranchManager) return;

    const confirmed = window.confirm(
      `Delete workflow file for ${file.borrowerName}? This action should be limited to the Branch Manager.`
    );

    if (!confirmed) return;

    setDeletingFile(true);
    setPageError("");
    setPageMessage("");

    try {
      const response = await fetch(`/api/workflow/${file.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to delete workflow file.");
      }

      router.push("/workflow");
      router.refresh();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to delete workflow file."
      );
      setDeletingFile(false);
    }
  };

  if (authCheckLoading || loadingFile) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="wf-wrap" style={styles.wrap}>
          <TopNav active="workflow" />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
            <h1 style={styles.heroTitle}>Loading operational record...</h1>
            <p style={styles.heroText}>
              Building the full file command view.
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
        <div className="wf-wrap" style={styles.wrap}>
          <TopNav active="workflow" />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
            <h1 style={styles.heroTitle}>Protected workflow access</h1>
            <p style={styles.heroText}>
              Please sign in through Team Mortgage Intelligence first.
            </p>
          </section>

          <div style={styles.card}>
            <a href="/team" style={styles.primaryLinkButton}>
              Go to Mortgage Intelligence Login
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!file) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="wf-wrap" style={styles.wrap}>
          <TopNav active="workflow" />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
            <h1 style={styles.heroTitle}>Workflow file not found</h1>
            <p style={styles.heroText}>
              {pageError || "This operational record could not be loaded."}
            </p>
          </section>

          <div style={styles.card}>
            <Link href="/workflow" style={styles.secondaryLinkButton}>
              Back to Workflow Intelligence
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const statusTone = getStatusTone(file.status);
  const urgencyTone = getUrgencyTone(file.urgency);

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="wf-wrap" style={styles.wrap}>
        <TopNav active="workflow" />

        <section style={styles.hero}>
          <div className="wf-hero-grid" style={styles.heroGrid}>
            <div>
              <div style={styles.heroBadge}>WORKFLOW FILE DETAIL</div>
              <h1 style={styles.heroTitle}>{file.borrowerName}</h1>
              <p style={styles.heroText}>
                Operational record for this loan file, including status,
                borrower actions, internal actions, file notes, and controlled
                update permissions.
              </p>

              <div style={styles.heroActionRow}>
                <Link href="/workflow" style={styles.heroActionOutline}>
                  Back to Workflow Intelligence
                </Link>
                <button
                  type="button"
                  onClick={loadFileDetail}
                  style={styles.heroActionGhost}
                >
                  Refresh File
                </button>
              </div>
            </div>

            <div style={styles.heroSideCard}>
              <div style={styles.userBadgeTitle}>Logged in as: {activeUser.name}</div>
              <div style={styles.userBadgeSubtext}>
                Role: {activeUser.role} · {activeUser.email}
              </div>

              <div style={styles.permissionBox}>
                <div style={styles.permissionTitle}>Permission Rules</div>
                <div style={styles.permissionText}>
                  Processor assignment can only be changed by the Production
                  Manager. File deletion can only be done by the Branch Manager.
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
          </div>
        </section>

        {pageMessage ? <div style={styles.successBox}>{pageMessage}</div> : null}
        {pageError ? <div style={styles.errorBox}>{pageError}</div> : null}

        <div className="wf-main-grid" style={styles.mainGrid}>
          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>FILE SNAPSHOT</div>
              <h2 style={styles.sectionTitle}>Current operational profile</h2>

              <div className="wf-mini-grid" style={styles.miniGrid}>
                <MiniDataCard label="FILE ID" value={file.id} />
                <MiniDataCard label="LOAN PURPOSE" value={file.purpose} />
                <MiniDataCard label="AMOUNT" value={formatCurrency(file.amount)} />
                <MiniDataCard label="TARGET CLOSE" value={formatDateLabel(file.targetClose)} />
                <MiniDataCard label="LOAN OFFICER" value={file.loanOfficer} />
                <MiniDataCard label="PROCESSOR" value={file.processor || "Unassigned"} />
                <MiniDataCard label="OCCUPANCY" value={file.occupancy} />
                <MiniDataCard label="FILE AGE" value={`${file.fileAgeDays} days`} />
              </div>

              <div style={styles.commandNote}>
                <strong>Current blocker:</strong> {file.blocker || "None currently."}
              </div>
              <div style={styles.commandNote}>
                <strong>Next internal action:</strong> {file.nextInternalAction || "—"}
              </div>
              <div style={styles.commandNote}>
                <strong>Next borrower action:</strong> {file.nextBorrowerAction || "—"}
              </div>
              <div style={styles.commandNote}>
                <strong>Latest file update:</strong> {file.latestUpdate || "—"}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>INTERNAL FILE FEED</div>
              <h2 style={styles.sectionTitle}>Timeline and internal updates</h2>

              <label style={styles.label}>Add internal update</label>
              <textarea
                value={internalUpdateInput}
                onChange={(e) => setInternalUpdateInput(e.target.value)}
                placeholder="Post a structured internal update for this active file."
                rows={4}
                style={styles.textarea}
              />
              <button
                type="button"
                onClick={addInternalUpdate}
                disabled={addingFeed || !internalUpdateInput.trim()}
                style={{
                  ...styles.gradientButton,
                  opacity: addingFeed || !internalUpdateInput.trim() ? 0.7 : 1,
                  cursor:
                    addingFeed || !internalUpdateInput.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {addingFeed ? "Adding Update..." : "Add Internal Update"}
              </button>

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
            </div>
          </section>

          <aside style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>EDIT FILE</div>
              <h2 style={styles.sectionTitle}>Update operational details</h2>

              <label style={styles.label}>Borrower full name</label>
              <input
                value={editForm.borrowerName}
                onChange={(e) => handleEditField("borrowerName", e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Loan purpose</label>
              <select
                value={editForm.purpose}
                onChange={(e) => handleEditField("purpose", e.target.value)}
                style={styles.input}
              >
                {PURPOSE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Amount</label>
              <input
                value={editForm.amount}
                onChange={(e) => handleEditField("amount", e.target.value)}
                style={styles.input}
                type="number"
              />

              <label style={styles.label}>Loan officer</label>
              <input
                value={editForm.loanOfficer}
                onChange={(e) => handleEditField("loanOfficer", e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Status</label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  handleEditField("status", e.target.value as WorkflowStatus)
                }
                style={styles.input}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getStatusLabel(option)}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Urgency</label>
              <select
                value={editForm.urgency}
                onChange={(e) =>
                  handleEditField("urgency", e.target.value as WorkflowUrgency)
                }
                style={styles.input}
              >
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Target close date</label>
              <input
                type="date"
                value={editForm.targetClose}
                onChange={(e) => handleEditField("targetClose", e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Occupancy</label>
              <select
                value={editForm.occupancy}
                onChange={(e) => handleEditField("occupancy", e.target.value)}
                style={styles.input}
              >
                {OCCUPANCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Assigned processor</label>
              <select
                value={editForm.processor}
                onChange={(e) => handleEditField("processor", e.target.value)}
                style={{
                  ...styles.input,
                  backgroundColor: isProductionManager ? "#ffffff" : "#F8FAFC",
                  opacity: isProductionManager ? 1 : 0.85,
                }}
                disabled={!isProductionManager}
              >
                <option value="">Unassigned</option>
                {PROCESSORS.map((processor) => (
                  <option key={processor} value={processor}>
                    {processor}
                  </option>
                ))}
              </select>
              <div style={styles.helperText}>
                Only the Production Manager can change the assigned processor.
              </div>

              <label style={styles.label}>Current blocker</label>
              <textarea
                value={editForm.blocker}
                onChange={(e) => handleEditField("blocker", e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Next internal action</label>
              <textarea
                value={editForm.nextInternalAction}
                onChange={(e) =>
                  handleEditField("nextInternalAction", e.target.value)
                }
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Next borrower action</label>
              <textarea
                value={editForm.nextBorrowerAction}
                onChange={(e) =>
                  handleEditField("nextBorrowerAction", e.target.value)
                }
                rows={3}
                style={styles.textarea}
              />

              <label style={styles.label}>Latest file update</label>
              <textarea
                value={editForm.latestUpdate}
                onChange={(e) => handleEditField("latestUpdate", e.target.value)}
                rows={3}
                style={styles.textarea}
              />

              <button
                type="button"
                onClick={saveFile}
                disabled={savingFile}
                style={{
                  ...styles.commandButton,
                  opacity: savingFile ? 0.75 : 1,
                  cursor: savingFile ? "not-allowed" : "pointer",
                }}
              >
                {savingFile ? "Saving Changes..." : "Save File Changes"}
              </button>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>CONTROLLED ACTIONS</div>
              <h2 style={styles.sectionTitle}>Restricted file controls</h2>

              <div style={styles.commandNote}>
                <strong>Branch Manager delete authority:</strong>{" "}
                {isBranchManager ? "Enabled for this session." : "Not available for this session."}
              </div>

              <button
                type="button"
                onClick={deleteFile}
                disabled={!isBranchManager || deletingFile}
                style={{
                  ...styles.deleteButton,
                  opacity: !isBranchManager || deletingFile ? 0.55 : 1,
                  cursor:
                    !isBranchManager || deletingFile ? "not-allowed" : "pointer",
                }}
              >
                {deletingFile ? "Deleting File..." : "Delete Workflow File"}
              </button>

              <div style={styles.helperText}>
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
            active === "team" ? navStyles.topBarLinkActive : navStyles.topBarLink
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
    .wf-main-grid {
      grid-template-columns: 1fr !important;
    }

    .wf-hero-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 920px) {
    .wf-mini-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 680px) {
    .wf-wrap {
      padding: 18px 12px 32px !important;
    }

    .wf-mini-grid {
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
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 22,
    alignItems: "start",
  },
  heroSideCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 18,
  },
  permissionBox: {
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 18,
    padding: 14,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    lineHeight: 1.6,
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
    fontSize: 54,
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
  heroActionGhost: {
    border: "1px solid rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: "#ffffff",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
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
    marginBottom: 14,
  },
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
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
  helperText: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 1.55,
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
    boxShadow: "0 10px 20px rgba(38,51,102,0.16)",
  },
  deleteButton: {
    width: "100%",
    marginTop: 18,
    border: "none",
    borderRadius: 20,
    backgroundColor: "#B42318",
    color: "#ffffff",
    padding: "16px 20px",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 10px 20px rgba(180,35,24,0.16)",
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
  successBox: {
    marginBottom: 16,
    backgroundColor: "#ECFDF3",
    color: "#166534",
    border: "1px solid #BBF7D0",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  errorBox: {
    marginBottom: 16,
    backgroundColor: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FECACA",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  badgeRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  badge: {
    borderRadius: 999,
    border: "1px solid",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
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
    display: "inline-block",
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
    display: "inline-block",
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
