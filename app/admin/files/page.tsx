// =============================================================================
// PHASE 7.5b — REPLACEMENT for app/admin/files/page.tsx
//
// What's new vs Phase 7.3.5 redesign:
//   1. When document_type = "Selling Guide", the form switches to a
//      multi-part upload flow:
//      - Product Family dropdown (Single-Family / Multi-Family) — required
//      - 9 file slots: Whole Document, Part 1, Part 2 ... Part 8
//      - Pick files for whichever slots apply, leave others blank
//      - Single "Upload All Selected Files" button
//      - Files upload SEQUENTIALLY with a clear "Uploading X of Y..." indicator
//      - Each part becomes its own document_group: "Single-Family Whole Document",
//        "Single-Family Part 1", "Single-Family Part 2", etc.
//      - Replace strategy fires per-part, never overwrites other parts
//
//   2. For all OTHER document types (Program Matrix, Pricing Sheet, etc.),
//      the form keeps the existing single-file flow EXACTLY as before. Zero
//      change for ClearEdge / FNBA / future lender uploads.
//
//   3. Lender-card layout, search, polling, expand/collapse, status badges,
//      and all action buttons are unchanged from Phase 7.3.5.
// =============================================================================

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import AdminNav from "@/app/components/AdminNav";

type LenderOption = {
  id: string;
  name: string;
};

type ProgramOption = {
  id: string;
  lender_id: string;
  name: string;
  slug: string;
};

type ExtractionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

type ActiveDocument = {
  id: string;
  lender_id: string;
  lender_name: string;
  document_type: string;
  document_group: string;
  program_id: string | null;
  original_filename: string;
  effective_date: string | null;
  uploaded_at: string;
  is_active: boolean;
  notes: string | null;
  size_bytes: number | null;
  extraction_status?: ExtractionStatus;
  extraction_started_at?: string | null;
  extraction_completed_at?: string | null;
  extraction_error?: string | null;
  extraction_drafts_count?: number;
};

type LenderGroup = {
  lender_id: string;
  lender_name: string;
  docs: ActiveDocument[];
  pendingOrRunningCount: number;
  draftsReadyCount: number;
  failedCount: number;
  totalDraftsAcrossDocs: number;
  lastUploadedAt: string | null;
};

type ActionStatus = {
  state: "idle" | "busy" | "success" | "error";
  message?: string;
};

const DOCUMENT_TYPES = [
  "Selling Guide",
  "Programs",
  "Pricing Sheet",
  "Overlays",
  "Program Matrix",
  "Qualification Guide",
  "Other",
] as const;

const MASTER_GROUP_OPTIONS = [
  "Master",
  "General",
  "All Programs",
] as const;

// Selling Guide-specific
const PRODUCT_FAMILIES = ["Single-Family", "Multi-Family"] as const;
const PART_OPTIONS = [
  "Whole Document",
  "Part 1",
  "Part 2",
  "Part 3",
  "Part 4",
  "Part 5",
  "Part 6",
  "Part 7",
  "Part 8",
] as const;

type ProductFamily = (typeof PRODUCT_FAMILIES)[number];
type PartName = (typeof PART_OPTIONS)[number];

type UploadFormState = {
  lenderId: string;
  documentType: string;
  documentGroup: string;
  programId: string;
  effectiveDate: string;
  notes: string;
  file: File | null;
  // Selling Guide multi-part state
  productFamily: ProductFamily | "";
  partFiles: Partial<Record<PartName, File | null>>;
};

type BatchUploadProgress = {
  total: number;
  current: number;
  currentPartName: string;
  successes: string[];
  failures: { partName: string; error: string }[];
} | null;

export default function ManageLenderFilesPage() {
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [activeDocuments, setActiveDocuments] = useState<ActiveDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lenderSearch, setLenderSearch] = useState("");
  const [batchProgress, setBatchProgress] = useState<BatchUploadProgress>(null);

  const [expandedLenders, setExpandedLenders] = useState<Set<string>>(
    new Set()
  );
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const [actionStatus, setActionStatus] = useState<
    Record<string, ActionStatus>
  >({});

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<UploadFormState>({
    lenderId: "",
    documentType: "",
    documentGroup: "Master",
    programId: "",
    effectiveDate: "",
    notes: "",
    file: null,
    productFamily: "",
    partFiles: {},
  });

  useEffect(() => {
    void loadPageData();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const hasInFlight = activeDocuments.some(
      (doc) =>
        doc.extraction_status === "pending" ||
        doc.extraction_status === "running"
    );

    if (hasInFlight) {
      pollTimerRef.current = setTimeout(() => {
        void refreshDocsOnly();
      }, 5000);
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [activeDocuments]);

  const filteredPrograms = useMemo(() => {
    if (!form.lenderId) return [];
    return programs.filter((p) => p.lender_id === form.lenderId);
  }, [programs, form.lenderId]);

  const isSellingGuide = form.documentType === "Selling Guide";

  const groupRequired = useMemo(() => {
    return (
      form.documentType === "Program Matrix" ||
      form.documentType === "Programs" ||
      form.documentType === "Qualification Guide" ||
      form.documentType === "Overlays"
    );
  }, [form.documentType]);

  const lenderGroups = useMemo<LenderGroup[]>(() => {
    const map = new Map<string, LenderGroup>();
    for (const doc of activeDocuments) {
      const key = doc.lender_id;
      if (!map.has(key)) {
        map.set(key, {
          lender_id: doc.lender_id,
          lender_name: doc.lender_name,
          docs: [],
          pendingOrRunningCount: 0,
          draftsReadyCount: 0,
          failedCount: 0,
          totalDraftsAcrossDocs: 0,
          lastUploadedAt: null,
        });
      }
      const group = map.get(key)!;
      group.docs.push(doc);
      const status = doc.extraction_status || "pending";
      if (status === "pending" || status === "running") {
        group.pendingOrRunningCount += 1;
      } else if (status === "failed") {
        group.failedCount += 1;
      } else if (
        status === "completed" &&
        (doc.extraction_drafts_count || 0) > 0
      ) {
        group.draftsReadyCount += 1;
        group.totalDraftsAcrossDocs += doc.extraction_drafts_count || 0;
      }
      if (
        !group.lastUploadedAt ||
        new Date(doc.uploaded_at) > new Date(group.lastUploadedAt)
      ) {
        group.lastUploadedAt = doc.uploaded_at;
      }
    }
    for (const g of map.values()) {
      g.docs.sort((a, b) => {
        const t = a.document_type.localeCompare(b.document_type);
        if (t !== 0) return t;
        return a.document_group.localeCompare(b.document_group);
      });
    }
    return [...map.values()].sort((a, b) =>
      a.lender_name.localeCompare(b.lender_name)
    );
  }, [activeDocuments]);

  const filteredLenderGroups = useMemo(() => {
    const q = lenderSearch.trim().toLowerCase();
    if (!q) return lenderGroups;
    return lenderGroups.filter((g) =>
      g.lender_name.toLowerCase().includes(q)
    );
  }, [lenderGroups, lenderSearch]);

  const totalStats = useMemo(() => {
    const lenderCount = lenderGroups.length;
    const docCount = activeDocuments.length;
    const inFlight = activeDocuments.filter(
      (d) =>
        d.extraction_status === "pending" || d.extraction_status === "running"
    ).length;
    const draftsReady = activeDocuments.filter(
      (d) =>
        d.extraction_status === "completed" &&
        (d.extraction_drafts_count || 0) > 0
    ).length;
    return { lenderCount, docCount, inFlight, draftsReady };
  }, [activeDocuments, lenderGroups]);

  async function loadPageData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [lendersRes, programsRes, docsRes] = await Promise.all([
        fetch("/api/admin/lenders"),
        fetch("/api/admin/programs"),
        fetch("/api/admin/lender-files/active"),
      ]);
      const lendersJson = await lendersRes.json();
      const programsJson = await programsRes.json();
      const docsJson = await docsRes.json();
      if (!lendersRes.ok)
        throw new Error(lendersJson?.error || "Failed to load lenders.");
      if (!programsRes.ok)
        throw new Error(programsJson?.error || "Failed to load programs.");
      if (!docsRes.ok)
        throw new Error(docsJson?.error || "Failed to load active documents.");
      setLenders(
        Array.isArray(lendersJson?.lenders) ? lendersJson.lenders : []
      );
      setPrograms(
        Array.isArray(programsJson?.programs) ? programsJson.programs : []
      );
      setActiveDocuments(
        Array.isArray(docsJson?.documents) ? docsJson.documents : []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load page data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshDocsOnly() {
    try {
      const res = await fetch("/api/admin/lender-files/active", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json?.documents)) {
        setActiveDocuments(json.documents);
      }
    } catch {
      // silent
    }
  }

  function updateForm<K extends keyof UploadFormState>(
    key: K,
    value: UploadFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleLenderChange(value: string) {
    setForm((prev) => ({
      ...prev,
      lenderId: value,
      programId: "",
      documentGroup: "Master",
    }));
  }

  function handleDocumentTypeChange(value: string) {
    const shouldDefaultToMaster =
      value !== "Program Matrix" &&
      value !== "Programs" &&
      value !== "Qualification Guide" &&
      value !== "Overlays";

    setForm((prev) => ({
      ...prev,
      documentType: value,
      documentGroup: shouldDefaultToMaster ? "Master" : prev.documentGroup || "",
      programId: shouldDefaultToMaster ? "" : prev.programId,
      productFamily: value === "Selling Guide" ? prev.productFamily : "",
      partFiles: {},
      file: null,
    }));
  }

  function handleProgramGroupChange(value: string) {
    const matched = filteredPrograms.find((p) => p.name === value);
    setForm((prev) => ({
      ...prev,
      documentGroup: value,
      programId: matched?.id || "",
    }));
  }

  function setPartFile(partName: PartName, file: File | null) {
    setForm((prev) => ({
      ...prev,
      partFiles: { ...prev.partFiles, [partName]: file },
    }));
  }

  function toggleLenderExpansion(lenderId: string) {
    setExpandedLenders((prev) => {
      const next = new Set(prev);
      if (next.has(lenderId)) next.delete(lenderId);
      else next.add(lenderId);
      return next;
    });
  }

  function toggleDocExpansion(docId: string) {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Single-file upload (existing flow for non-Selling-Guide docs)
  // ---------------------------------------------------------------------------
  async function handleSingleUpload() {
    setMessage("");
    setErrorMessage("");

    if (!form.lenderId) return setErrorMessage("Please select a lender.");
    if (!form.documentType)
      return setErrorMessage("Please select a document type.");
    if (groupRequired && !form.documentGroup.trim())
      return setErrorMessage("Please select or enter a program/document group.");
    if (!groupRequired && !form.documentGroup.trim())
      return setErrorMessage("Document group is required.");
    if (!form.file) return setErrorMessage("Please choose a file.");

    setUploading(true);

    try {
      const payload = new FormData();
      payload.append("lenderId", form.lenderId);
      payload.append("documentType", form.documentType);
      payload.append("documentGroup", form.documentGroup.trim());
      payload.append("programId", form.programId || "");
      payload.append("effectiveDate", form.effectiveDate || "");
      payload.append("notes", form.notes || "");
      payload.append("file", form.file);

      const response = await fetch("/api/admin/lender-files/upload", {
        method: "POST",
        body: payload,
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Upload failed.");

      const extractionMsg = json?.extractionQueued
        ? " Extraction queued — status will appear within a minute."
        : "";

      setMessage(
        `Upload successful. Active slot updated for ${
          json?.slotLabel || "selected document slot"
        }.${extractionMsg}`
      );

      resetForm();
      if (form.lenderId) {
        setExpandedLenders((prev) => {
          const next = new Set(prev);
          next.add(form.lenderId);
          return next;
        });
      }
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Batch upload (Selling Guide multi-part flow)
  // ---------------------------------------------------------------------------
  async function handleBatchUpload() {
    setMessage("");
    setErrorMessage("");

    if (!form.lenderId) return setErrorMessage("Please select a lender.");
    if (!form.productFamily)
      return setErrorMessage("Please select a product family.");

    // Collect selected parts
    const selectedParts = (PART_OPTIONS as readonly PartName[])
      .map((partName) => ({ partName, file: form.partFiles[partName] || null }))
      .filter((p): p is { partName: PartName; file: File } => Boolean(p.file));

    if (selectedParts.length === 0) {
      return setErrorMessage(
        "Please choose at least one file for one of the part slots."
      );
    }

    setUploading(true);
    setBatchProgress({
      total: selectedParts.length,
      current: 0,
      currentPartName: "",
      successes: [],
      failures: [],
    });

    const successes: string[] = [];
    const failures: { partName: string; error: string }[] = [];

    for (let i = 0; i < selectedParts.length; i++) {
      const { partName, file } = selectedParts[i];
      const documentGroup = `${form.productFamily} ${partName}`;

      setBatchProgress({
        total: selectedParts.length,
        current: i + 1,
        currentPartName: partName,
        successes: [...successes],
        failures: [...failures],
      });

      try {
        const payload = new FormData();
        payload.append("lenderId", form.lenderId);
        payload.append("documentType", "Selling Guide");
        payload.append("documentGroup", documentGroup);
        payload.append("programId", "");
        payload.append("effectiveDate", form.effectiveDate || "");
        payload.append("notes", form.notes || "");
        payload.append("file", file);

        const response = await fetch("/api/admin/lender-files/upload", {
          method: "POST",
          body: payload,
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Upload failed.");
        }
        successes.push(documentGroup);
      } catch (error) {
        failures.push({
          partName: documentGroup,
          error: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    }

    setBatchProgress({
      total: selectedParts.length,
      current: selectedParts.length,
      currentPartName: "",
      successes,
      failures,
    });

    setUploading(false);

    if (failures.length === 0) {
      setMessage(
        `Uploaded ${successes.length} part${
          successes.length === 1 ? "" : "s"
        } successfully. Extractions queued — status will appear on the lender card.`
      );
    } else if (successes.length === 0) {
      setErrorMessage(
        `All ${failures.length} uploads failed. See progress panel below for details.`
      );
    } else {
      setMessage(
        `Uploaded ${successes.length} of ${selectedParts.length}. ${failures.length} failed — see progress panel.`
      );
    }

    if (form.lenderId) {
      setExpandedLenders((prev) => {
        const next = new Set(prev);
        next.add(form.lenderId);
        return next;
      });
    }

    await loadPageData();

    // Don't auto-clear form so user can see progress; they can manually reset
  }

  function resetForm() {
    setForm({
      lenderId: "",
      documentType: "",
      documentGroup: "Master",
      programId: "",
      effectiveDate: "",
      notes: "",
      file: null,
      productFamily: "",
      partFiles: {},
    });
    setBatchProgress(null);

    const fileInput = document.getElementById(
      "lender-file-input"
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";

    for (const partName of PART_OPTIONS) {
      const partInput = document.getElementById(
        `part-input-${partName.replace(/\s+/g, "-")}`
      ) as HTMLInputElement | null;
      if (partInput) partInput.value = "";
    }
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSellingGuide) {
      void handleBatchUpload();
    } else {
      void handleSingleUpload();
    }
  }

  async function handleArchiveNow(documentId: string) {
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/admin/lender-files/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Archive failed.");
      setMessage("Document archived successfully.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Archive failed."
      );
    }
  }

  async function handleReExtract(documentId: string) {
    setActionStatus((prev) => ({ ...prev, [documentId]: { state: "busy" } }));
    try {
      const res = await fetch("/api/admin/extract-programs/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error || "Extraction failed.");
      setActionStatus((prev) => ({
        ...prev,
        [documentId]: {
          state: "success",
          message: `Created ${json.programsCreated} draft${
            json.programsCreated === 1 ? "" : "s"
          }.`,
        },
      }));
      await refreshDocsOnly();
    } catch (error) {
      setActionStatus((prev) => ({
        ...prev,
        [documentId]: {
          state: "error",
          message:
            error instanceof Error ? error.message : "Extraction failed.",
        },
      }));
    }
  }

  async function handleApproveAll(documentId: string) {
    setActionStatus((prev) => ({ ...prev, [documentId]: { state: "busy" } }));
    try {
      const res = await fetch("/api/admin/extract-programs/approve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error || "Approval failed.");
      setActionStatus((prev) => ({
        ...prev,
        [documentId]: {
          state: "success",
          message: `Activated ${json.approvedCount} program${
            json.approvedCount === 1 ? "" : "s"
          }.`,
        },
      }));
      await refreshDocsOnly();
    } catch (error) {
      setActionStatus((prev) => ({
        ...prev,
        [documentId]: {
          state: "error",
          message: error instanceof Error ? error.message : "Approval failed.",
        },
      }));
    }
  }

  function statusBadgeForDoc(doc: ActiveDocument) {
    const status = doc.extraction_status || "pending";
    const draftCount = doc.extraction_drafts_count || 0;

    if (status === "pending")
      return (
        <span style={{ ...styles.miniBadge, ...styles.miniBadgeNeutral }}>
          ⏳ Pending
        </span>
      );
    if (status === "running")
      return (
        <span style={{ ...styles.miniBadge, ...styles.miniBadgeRunning }}>
          🔄 Extracting
        </span>
      );
    if (status === "completed") {
      if (draftCount > 0)
        return (
          <span style={{ ...styles.miniBadge, ...styles.miniBadgeSuccess }}>
            ✓ {draftCount} draft{draftCount === 1 ? "" : "s"}
          </span>
        );
      return (
        <span style={{ ...styles.miniBadge, ...styles.miniBadgeNeutral }}>
          ✓ Complete (no programs)
        </span>
      );
    }
    if (status === "failed")
      return (
        <span
          style={{ ...styles.miniBadge, ...styles.miniBadgeError }}
          title={doc.extraction_error || "Extraction failed"}
        >
          ⚠ Failed
        </span>
      );
    if (status === "skipped")
      return (
        <span style={{ ...styles.miniBadge, ...styles.miniBadgeNeutral }}>
          — Not extracted
        </span>
      );
    return null;
  }

  function lenderHeaderStatus(group: LenderGroup) {
    const parts: React.ReactNode[] = [];
    parts.push(
      <span key="docs" style={styles.lenderStatChip}>
        {group.docs.length} doc{group.docs.length === 1 ? "" : "s"}
      </span>
    );
    if (group.pendingOrRunningCount > 0) {
      parts.push(
        <span
          key="pending"
          style={{ ...styles.lenderStatChip, ...styles.lenderStatChipBusy }}
        >
          🔄 {group.pendingOrRunningCount} extracting
        </span>
      );
    }
    if (group.draftsReadyCount > 0) {
      parts.push(
        <span
          key="ready"
          style={{ ...styles.lenderStatChip, ...styles.lenderStatChipReady }}
        >
          ✓ {group.totalDraftsAcrossDocs} draft
          {group.totalDraftsAcrossDocs === 1 ? "" : "s"} ready
        </span>
      );
    }
    if (group.failedCount > 0) {
      parts.push(
        <span
          key="failed"
          style={{ ...styles.lenderStatChip, ...styles.lenderStatChipError }}
        >
          ⚠ {group.failedCount} failed
        </span>
      );
    }
    return parts;
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <AdminNav />

        <div style={styles.headerRow}>
          <div>
            <div style={styles.eyebrow}>FILE INTAKE</div>
            <h1 style={styles.title}>Manage Lender Files</h1>
            <p style={styles.subtitle}>
              Upload documents per lender. PDF program matrices and guidelines
              are auto-extracted into draft programs you review and approve.
              Click a lender to expand their documents.
            </p>
          </div>
          <a href="/admin" style={styles.backLink}>
            Back to Admin Home
          </a>
        </div>

        {message ? <div style={styles.successBox}>{message}</div> : null}
        {errorMessage ? (
          <div style={styles.errorBox}>{errorMessage}</div>
        ) : null}

        <div style={styles.grid}>
          {/* Upload form */}
          <section style={styles.uploadCard}>
            <h2 style={styles.cardTitle}>Upload New File</h2>
            <p style={styles.cardText}>
              {isSellingGuide
                ? "Selling Guides may be uploaded as multiple parts. Each part becomes its own slot — re-uploading a part replaces only that part."
                : "PDF matrices, programs, qualification guides, and overlays are auto-extracted in the background after upload."}
            </p>

            <form onSubmit={handleFormSubmit}>
              <label style={styles.label}>Lender</label>
              <select
                style={styles.input}
                value={form.lenderId}
                onChange={(e) => handleLenderChange(e.target.value)}
              >
                <option value="">Select lender</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Document Type</label>
              <select
                style={styles.input}
                value={form.documentType}
                onChange={(e) => handleDocumentTypeChange(e.target.value)}
              >
                <option value="">Select document type</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Selling Guide flow */}
              {isSellingGuide ? (
                <>
                  <label style={styles.label}>Product Family</label>
                  <select
                    style={styles.input}
                    value={form.productFamily}
                    onChange={(e) =>
                      updateForm("productFamily", e.target.value as ProductFamily | "")
                    }
                  >
                    <option value="">Select product family</option>
                    {PRODUCT_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>

                  <label style={styles.label}>Effective Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => updateForm("effectiveDate", e.target.value)}
                  />

                  <label style={styles.label}>Notes</label>
                  <textarea
                    style={styles.textarea}
                    value={form.notes}
                    onChange={(e) => updateForm("notes", e.target.value)}
                    placeholder="Notes apply to all parts uploaded together."
                  />

                  <div style={styles.partsSection}>
                    <div style={styles.partsSectionTitle}>
                      Files to upload (pick at least one)
                    </div>
                    <div style={styles.partsSectionHelp}>
                      Use Whole Document if your guide fits in one PDF (under
                      600 pages). If split into chunks, use Part 1, Part 2, etc.
                      Leave unused slots blank.
                    </div>

                    {PART_OPTIONS.map((partName) => {
                      const file = form.partFiles[partName];
                      return (
                        <div key={partName} style={styles.partRow}>
                          <div style={styles.partLabel}>{partName}</div>
                          <input
                            id={`part-input-${partName.replace(/\s+/g, "-")}`}
                            type="file"
                            style={styles.partFileInput}
                            onChange={(e) =>
                              setPartFile(partName, e.target.files?.[0] || null)
                            }
                          />
                          {file ? (
                            <div style={styles.partFilename}>
                              ✓ {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {batchProgress ? (
                    <div style={styles.progressBox}>
                      <div style={styles.progressTitle}>
                        {uploading
                          ? `Uploading ${batchProgress.current} of ${batchProgress.total}…`
                          : `Batch complete: ${batchProgress.successes.length} succeeded, ${batchProgress.failures.length} failed`}
                      </div>
                      {uploading && batchProgress.currentPartName ? (
                        <div style={styles.progressCurrent}>
                          Now uploading: <strong>{batchProgress.currentPartName}</strong>
                        </div>
                      ) : null}
                      {batchProgress.successes.length > 0 ? (
                        <div style={styles.progressSuccessList}>
                          ✓ Succeeded:
                          <ul style={styles.progressList}>
                            {batchProgress.successes.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {batchProgress.failures.length > 0 ? (
                        <div style={styles.progressFailureList}>
                          ⚠ Failed:
                          <ul style={styles.progressList}>
                            {batchProgress.failures.map((f) => (
                              <li key={f.partName}>
                                <strong>{f.partName}:</strong> {f.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    style={styles.primaryButton}
                    disabled={uploading}
                  >
                    {uploading
                      ? `Uploading… (${batchProgress?.current || 0}/${batchProgress?.total || 0})`
                      : "Upload All Selected Files"}
                  </button>

                  {!uploading && batchProgress ? (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={resetForm}
                    >
                      Clear Form
                    </button>
                  ) : null}
                </>
              ) : (
                /* Single-file flow (existing) */
                <>
                  <label style={styles.label}>Program / Document Group</label>
                  <select
                    style={styles.input}
                    value={form.documentGroup}
                    onChange={(e) => handleProgramGroupChange(e.target.value)}
                  >
                    {!groupRequired &&
                      MASTER_GROUP_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}

                    {groupRequired && (
                      <>
                        <option value="">Select document group</option>
                        <option value="Master">Master</option>
                        {filteredPrograms.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>

                  <label style={styles.label}>Effective Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => updateForm("effectiveDate", e.target.value)}
                  />

                  <label style={styles.label}>Notes</label>
                  <textarea
                    style={styles.textarea}
                    value={form.notes}
                    onChange={(e) => updateForm("notes", e.target.value)}
                    placeholder="Optional notes such as bulletin date or admin comments."
                  />

                  <label style={styles.label}>File</label>
                  <input
                    id="lender-file-input"
                    style={styles.input}
                    type="file"
                    onChange={(e) =>
                      updateForm("file", e.target.files?.[0] || null)
                    }
                  />

                  <button
                    type="submit"
                    style={styles.primaryButton}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading…" : "Upload File"}
                  </button>
                </>
              )}
            </form>
          </section>

          {/* Right side: lender groups (unchanged from Phase 7.3.5) */}
          <section style={styles.listCard}>
            <div style={styles.activeHeader}>
              <div>
                <h2 style={styles.cardTitle}>Active Documents by Lender</h2>
                <div style={styles.statRow}>
                  <span style={styles.statChip}>
                    {totalStats.lenderCount} lender
                    {totalStats.lenderCount === 1 ? "" : "s"}
                  </span>
                  <span style={styles.statChip}>
                    {totalStats.docCount} doc
                    {totalStats.docCount === 1 ? "" : "s"}
                  </span>
                  {totalStats.inFlight > 0 ? (
                    <span
                      style={{ ...styles.statChip, ...styles.statChipBusy }}
                    >
                      🔄 {totalStats.inFlight} extracting
                    </span>
                  ) : null}
                  {totalStats.draftsReady > 0 ? (
                    <span
                      style={{ ...styles.statChip, ...styles.statChipReady }}
                    >
                      ✓ {totalStats.draftsReady} ready to review
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={refreshDocsOnly}
                style={styles.refreshButton}
                title="Refresh extraction status"
              >
                ↻ Refresh
              </button>
            </div>

            <input
              style={styles.searchInput}
              type="search"
              placeholder="Search lenders…"
              value={lenderSearch}
              onChange={(e) => setLenderSearch(e.target.value)}
            />

            {loading ? (
              <div style={styles.infoBox}>Loading…</div>
            ) : filteredLenderGroups.length === 0 ? (
              <div style={styles.infoBox}>
                {lenderSearch.trim()
                  ? `No lenders match "${lenderSearch}".`
                  : "No active documents found."}
              </div>
            ) : (
              <div style={styles.lenderList}>
                {filteredLenderGroups.map((group) => {
                  const isExpanded = expandedLenders.has(group.lender_id);
                  return (
                    <div key={group.lender_id} style={styles.lenderCard}>
                      <button
                        type="button"
                        onClick={() => toggleLenderExpansion(group.lender_id)}
                        style={styles.lenderHeader}
                      >
                        <div style={styles.lenderHeaderLeft}>
                          <span style={styles.chevron}>
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <span style={styles.lenderName}>
                            {group.lender_name}
                          </span>
                        </div>
                        <div style={styles.lenderHeaderRight}>
                          {lenderHeaderStatus(group)}
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={styles.docList}>
                          {group.docs.map((doc) => {
                            const isDocExpanded = expandedDocs.has(doc.id);
                            const action = actionStatus[doc.id];
                            const isBusy = action?.state === "busy";
                            const status = doc.extraction_status || "pending";
                            const draftCount = doc.extraction_drafts_count || 0;

                            return (
                              <div key={doc.id} style={styles.docCardCompact}>
                                <button
                                  type="button"
                                  onClick={() => toggleDocExpansion(doc.id)}
                                  style={styles.docRowCompact}
                                >
                                  <div style={styles.docRowLeft}>
                                    <span style={styles.chevronSmall}>
                                      {isDocExpanded ? "▼" : "▶"}
                                    </span>
                                    <span style={styles.docTypeText}>
                                      {doc.document_type}
                                    </span>
                                    <span style={styles.docGroupText}>
                                      {doc.document_group || "Master"}
                                    </span>
                                  </div>
                                  <div style={styles.docRowRight}>
                                    <span style={styles.docDateText}>
                                      {new Date(
                                        doc.uploaded_at
                                      ).toLocaleDateString()}
                                    </span>
                                    {statusBadgeForDoc(doc)}
                                  </div>
                                </button>

                                {isDocExpanded && (
                                  <div style={styles.docExpandedBody}>
                                    <div style={styles.docMetaGrid}>
                                      <div>
                                        <strong>Original File:</strong>
                                        <div style={styles.docMetaValue}>
                                          {doc.original_filename}
                                        </div>
                                      </div>
                                      <div>
                                        <strong>Effective Date:</strong>
                                        <div style={styles.docMetaValue}>
                                          {doc.effective_date || "—"}
                                        </div>
                                      </div>
                                      <div>
                                        <strong>Uploaded:</strong>
                                        <div style={styles.docMetaValue}>
                                          {new Date(
                                            doc.uploaded_at
                                          ).toLocaleString()}
                                        </div>
                                      </div>
                                      <div>
                                        <strong>Size:</strong>
                                        <div style={styles.docMetaValue}>
                                          {doc.size_bytes
                                            ? `${(
                                                doc.size_bytes / 1024
                                              ).toFixed(1)} KB`
                                            : "—"}
                                        </div>
                                      </div>
                                    </div>

                                    {doc.notes ? (
                                      <div style={styles.notesBox}>
                                        <strong>Notes:</strong>
                                        <div>{doc.notes}</div>
                                      </div>
                                    ) : null}

                                    {status === "failed" &&
                                      doc.extraction_error && (
                                        <div style={styles.errorInline}>
                                          <strong>Extraction error:</strong>{" "}
                                          {doc.extraction_error}
                                        </div>
                                      )}

                                    {action?.state === "success" && (
                                      <div style={styles.successInline}>
                                        {action.message}
                                        {status === "completed" &&
                                        draftCount === 0
                                          ? null
                                          : (
                                            <>
                                              {" "}
                                              <a
                                                href="/admin/agency-guidelines"
                                                style={styles.reviewLink}
                                              >
                                                Review →
                                              </a>
                                            </>
                                          )}
                                      </div>
                                    )}

                                    {action?.state === "error" && (
                                      <div style={styles.errorInline}>
                                        <strong>Action error:</strong>{" "}
                                        {action.message}
                                      </div>
                                    )}

                                    <div style={styles.actionButtonRow}>
                                      {status === "completed" &&
                                        draftCount > 0 && (
                                          <button
                                            type="button"
                                            style={{
                                              ...styles.approveButton,
                                              opacity: isBusy ? 0.6 : 1,
                                              cursor: isBusy
                                                ? "wait"
                                                : "pointer",
                                            }}
                                            onClick={() =>
                                              handleApproveAll(doc.id)
                                            }
                                            disabled={isBusy}
                                          >
                                            {isBusy
                                              ? "Approving…"
                                              : `Approve All ${draftCount} Draft${
                                                  draftCount === 1 ? "" : "s"
                                                }`}
                                          </button>
                                        )}

                                      {status !== "running" && (
                                        <button
                                          type="button"
                                          style={{
                                            ...styles.extractButton,
                                            opacity: isBusy ? 0.6 : 1,
                                            cursor: isBusy
                                              ? "wait"
                                              : "pointer",
                                          }}
                                          onClick={() =>
                                            handleReExtract(doc.id)
                                          }
                                          disabled={isBusy}
                                        >
                                          {isBusy
                                            ? "Extracting…"
                                            : status === "failed"
                                            ? "Retry Extraction"
                                            : status === "completed" &&
                                              draftCount > 0
                                            ? "Re-Extract"
                                            : "Extract Now"}
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        style={styles.archiveButton}
                                        onClick={() => handleArchiveNow(doc.id)}
                                        disabled={isBusy}
                                      >
                                        Archive Now
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f4f6fb",
    color: "#263366",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  wrap: { maxWidth: 1400, margin: "0 auto", padding: "28px 18px 40px" },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#5b7097",
    marginBottom: 10,
  },
  title: { fontSize: 48, lineHeight: 1.05, margin: 0, fontWeight: 400 },
  subtitle: {
    maxWidth: 980,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#4b628c",
  },
  backLink: {
    color: "#263366",
    textDecoration: "none",
    fontWeight: 700,
    marginTop: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 20,
  },
  uploadCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    alignSelf: "start",
    position: "sticky",
    top: 18,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
  },
  cardTitle: { margin: 0, fontSize: 22, marginBottom: 8 },
  cardText: {
    color: "#4b628c",
    lineHeight: 1.6,
    marginTop: 0,
    marginBottom: 14,
    fontSize: 14,
  },
  activeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  statRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  statChip: {
    backgroundColor: "#eef4ff",
    color: "#1e3a8a",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 700,
  },
  statChipBusy: { backgroundColor: "#fef3c7", color: "#92400e" },
  statChipReady: { backgroundColor: "#dcfce7", color: "#166534" },
  refreshButton: {
    background: "#fff",
    border: "1px solid #c8d5eb",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    color: "#263366",
    cursor: "pointer",
  },
  searchInput: {
    width: "100%",
    border: "1px solid #c8d5eb",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  label: {
    display: "block",
    marginTop: 14,
    marginBottom: 8,
    fontWeight: 700,
    fontSize: 14,
  },
  input: {
    width: "100%",
    border: "1px solid #c8d5eb",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    backgroundColor: "#fff",
  },
  textarea: {
    width: "100%",
    minHeight: 70,
    border: "1px solid #c8d5eb",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    resize: "vertical",
  },
  partsSection: {
    marginTop: 18,
    padding: 14,
    border: "1px solid #d7e2f2",
    borderRadius: 12,
    backgroundColor: "#f9fbff",
  },
  partsSectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  partsSectionHelp: {
    fontSize: 12,
    color: "#5b7097",
    marginBottom: 14,
    lineHeight: 1.5,
  },
  partRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #e2e8f0",
  },
  partLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#263366",
    marginBottom: 4,
  },
  partFileInput: {
    width: "100%",
    fontSize: 12,
  },
  partFilename: {
    fontSize: 11,
    color: "#16a34a",
    marginTop: 4,
    fontWeight: 700,
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "13px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 8,
    backgroundColor: "#fff",
    color: "#263366",
    border: "1px solid #c8d5eb",
    borderRadius: 12,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  progressBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#fef3c7",
    border: "1px solid #fbbf24",
    borderRadius: 12,
    fontSize: 13,
  },
  progressTitle: {
    fontWeight: 700,
    marginBottom: 6,
    color: "#92400e",
  },
  progressCurrent: {
    fontSize: 13,
    color: "#92400e",
    marginBottom: 10,
  },
  progressSuccessList: {
    fontSize: 12,
    color: "#166534",
    marginTop: 8,
  },
  progressFailureList: {
    fontSize: 12,
    color: "#991b1b",
    marginTop: 8,
  },
  progressList: {
    margin: "4px 0 0 16px",
    paddingLeft: 0,
    lineHeight: 1.7,
  },
  successBox: {
    backgroundColor: "#ecfdf3",
    border: "1px solid #86efac",
    color: "#166534",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: "#f8fbff",
    border: "1px solid #d9e6f7",
    color: "#4b628c",
    borderRadius: 14,
    padding: 14,
  },
  lenderList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  lenderCard: {
    border: "1px solid #d7e2f2",
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  lenderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "14px 16px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    color: "inherit",
  },
  lenderHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  lenderHeaderRight: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  chevron: {
    color: "#5b7097",
    fontSize: 12,
    width: 14,
    display: "inline-block",
  },
  chevronSmall: {
    color: "#5b7097",
    fontSize: 10,
    width: 12,
    display: "inline-block",
  },
  lenderName: { fontSize: 16, fontWeight: 700, color: "#263366" },
  lenderStatChip: {
    backgroundColor: "#f4f6fb",
    color: "#263366",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  lenderStatChipBusy: { backgroundColor: "#fef3c7", color: "#92400e" },
  lenderStatChipReady: { backgroundColor: "#dcfce7", color: "#166534" },
  lenderStatChipError: { backgroundColor: "#fee2e2", color: "#991b1b" },
  docList: {
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#f9fbff",
    padding: 8,
  },
  docCardCompact: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    marginBottom: 6,
    overflow: "hidden",
  },
  docRowCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "10px 14px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    color: "inherit",
    gap: 12,
  },
  docRowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  docRowRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  docTypeText: {
    fontSize: 14,
    fontWeight: 700,
    color: "#263366",
  },
  docGroupText: {
    fontSize: 13,
    color: "#5b7097",
  },
  docDateText: {
    fontSize: 12,
    color: "#5b7097",
  },
  miniBadge: {
    display: "inline-block",
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: 11,
    fontWeight: 700,
  },
  miniBadgeNeutral: { backgroundColor: "#f4f6fb", color: "#263366" },
  miniBadgeRunning: { backgroundColor: "#fef3c7", color: "#92400e" },
  miniBadgeSuccess: { backgroundColor: "#dcfce7", color: "#166534" },
  miniBadgeError: { backgroundColor: "#fee2e2", color: "#991b1b" },
  docExpandedBody: {
    padding: 14,
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#fafbfd",
  },
  docMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 12,
    lineHeight: 1.5,
    fontSize: 13,
  },
  docMetaValue: {
    color: "#5b7097",
    wordBreak: "break-word",
  },
  notesBox: {
    backgroundColor: "#fff",
    border: "1px solid #d9e6f7",
    borderRadius: 10,
    padding: 12,
    lineHeight: 1.5,
    fontSize: 13,
    marginBottom: 12,
  },
  errorInline: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  successInline: {
    backgroundColor: "#ecfdf3",
    border: "1px solid #86efac",
    color: "#166534",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  actionButtonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  extractButton: {
    backgroundColor: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  approveButton: {
    backgroundColor: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  archiveButton: {
    backgroundColor: "#0096C7",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  reviewLink: {
    color: "#0070b3",
    fontWeight: 700,
    textDecoration: "underline",
  },
};
