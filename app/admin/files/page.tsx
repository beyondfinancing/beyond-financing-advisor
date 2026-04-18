"use client";

import React, { useEffect, useMemo, useState } from "react";

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

type UploadFormState = {
  lenderId: string;
  documentType: string;
  documentGroup: string;
  programId: string;
  effectiveDate: string;
  notes: string;
  file: File | null;
};

export default function ManageLenderFilesPage() {
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [activeDocuments, setActiveDocuments] = useState<ActiveDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState<UploadFormState>({
    lenderId: "",
    documentType: "",
    documentGroup: "Master",
    programId: "",
    effectiveDate: "",
    notes: "",
    file: null,
  });

  useEffect(() => {
    void loadPageData();
  }, []);

  const filteredPrograms = useMemo(() => {
    if (!form.lenderId) return [];
    return programs.filter((program) => program.lender_id === form.lenderId);
  }, [programs, form.lenderId]);

  const groupRequired = useMemo(() => {
    return (
      form.documentType === "Program Matrix" ||
      form.documentType === "Programs" ||
      form.documentType === "Qualification Guide" ||
      form.documentType === "Overlays"
    );
  }, [form.documentType]);

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

      if (!lendersRes.ok) throw new Error(lendersJson?.error || "Failed to load lenders.");
      if (!programsRes.ok) throw new Error(programsJson?.error || "Failed to load programs.");
      if (!docsRes.ok) throw new Error(docsJson?.error || "Failed to load active documents.");

      setLenders(Array.isArray(lendersJson?.lenders) ? lendersJson.lenders : []);
      setPrograms(Array.isArray(programsJson?.programs) ? programsJson.programs : []);
      setActiveDocuments(Array.isArray(docsJson?.documents) ? docsJson.documents : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load page data.");
    } finally {
      setLoading(false);
    }
  }

  function updateForm<K extends keyof UploadFormState>(key: K, value: UploadFormState[K]) {
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
    }));
  }

  function handleProgramGroupChange(value: string) {
    const matchedProgram = filteredPrograms.find((program) => program.name === value);

    setForm((prev) => ({
      ...prev,
      documentGroup: value,
      programId: matchedProgram?.id || "",
    }));
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!form.lenderId) {
      setErrorMessage("Please select a lender.");
      return;
    }

    if (!form.documentType) {
      setErrorMessage("Please select a document type.");
      return;
    }

    if (groupRequired && !form.documentGroup.trim()) {
      setErrorMessage("Please select or enter a program/document group.");
      return;
    }

    if (!groupRequired && !form.documentGroup.trim()) {
      setErrorMessage("Document group is required.");
      return;
    }

    if (!form.file) {
      setErrorMessage("Please choose a file.");
      return;
    }

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

      if (!response.ok) {
        throw new Error(json?.error || "Upload failed.");
      }

      setMessage(
        `Upload successful. Active slot updated for ${json?.slotLabel || "selected document slot"}.`
      );

      setForm({
        lenderId: "",
        documentType: "",
        documentGroup: "Master",
        programId: "",
        effectiveDate: "",
        notes: "",
        file: null,
      });

      const fileInput = document.getElementById("lender-file-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleArchiveNow(documentId: string) {
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/lender-files/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentId }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Archive failed.");
      }

      setMessage("Document archived successfully.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Archive failed.");
    }
  }

  const groupedDocuments = useMemo(() => {
    return [...activeDocuments].sort((a, b) => {
      const lenderCompare = a.lender_name.localeCompare(b.lender_name);
      if (lenderCompare !== 0) return lenderCompare;

      const typeCompare = a.document_type.localeCompare(b.document_type);
      if (typeCompare !== 0) return typeCompare;

      return a.document_group.localeCompare(b.document_group);
    });
  }, [activeDocuments]);

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.eyebrow}>FILE INTAKE</div>
            <h1 style={styles.title}>Manage Lender Files</h1>
            <p style={styles.subtitle}>
              Upload lender documents by type and program group. When a new file is uploaded for
              the same lender, document type, and document group, the system keeps the new one active
              and archives the previous one as backup.
            </p>
          </div>

          <a href="/admin" style={styles.backLink}>
            Back to Admin Home
          </a>
        </div>

        {message ? <div style={styles.successBox}>{message}</div> : null}
        {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Upload New File</h2>
            <p style={styles.cardText}>
              This upload flow is classification-first. The selected lender, document type,
              and program/document group determine which active version it replaces.
            </p>

            <form onSubmit={handleUpload}>
              <label style={styles.label}>Lender</label>
              <select
                style={styles.input}
                value={form.lenderId}
                onChange={(e) => handleLenderChange(e.target.value)}
              >
                <option value="">Select lender</option>
                {lenders.map((lender) => (
                  <option key={lender.id} value={lender.id}>
                    {lender.name}
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
                {DOCUMENT_TYPES.map((docType) => (
                  <option key={docType} value={docType}>
                    {docType}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Program / Document Group</label>
              <select
                style={styles.input}
                value={form.documentGroup}
                onChange={(e) => handleProgramGroupChange(e.target.value)}
              >
                {!groupRequired && MASTER_GROUP_OPTIONS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}

                {groupRequired && (
                  <>
                    <option value="">Select document group</option>
                    <option value="Master">Master</option>
                    {filteredPrograms.map((program) => (
                      <option key={program.id} value={program.name}>
                        {program.name}
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
                placeholder="Optional notes such as lender bulletin date, pricing release note, or admin comments."
              />

              <label style={styles.label}>File</label>
              <input
                id="lender-file-input"
                style={styles.input}
                type="file"
                onChange={(e) => updateForm("file", e.target.files?.[0] || null)}
              />

              <button type="submit" style={styles.primaryButton} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload File"}
              </button>
            </form>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Active Documents</h2>
            <p style={styles.cardText}>Active files: {groupedDocuments.length}</p>

            {loading ? (
              <div style={styles.infoBox}>Loading...</div>
            ) : groupedDocuments.length === 0 ? (
              <div style={styles.infoBox}>No active documents found.</div>
            ) : (
              groupedDocuments.map((doc) => (
                <div key={doc.id} style={styles.docCard}>
                  <div style={styles.docHeader}>
                    <div>
                      <h3 style={styles.docTitle}>{doc.lender_name}</h3>
                      <div style={styles.badgeRow}>
                        <span style={styles.badge}>{doc.document_type}</span>
                        <span style={styles.badgeSecondary}>{doc.document_group || "Master"}</span>
                        <span style={styles.badgeSecondary}>ACTIVE</span>
                      </div>
                    </div>

                    <button
                      style={styles.archiveButton}
                      onClick={() => handleArchiveNow(doc.id)}
                    >
                      Archive Now
                    </button>
                  </div>

                  <div style={styles.docMetaGrid}>
                    <div>
                      <strong>Original File:</strong>
                      <div>{doc.original_filename}</div>
                    </div>

                    <div>
                      <strong>Effective Date:</strong>
                      <div>{doc.effective_date || "—"}</div>
                    </div>

                    <div>
                      <strong>Uploaded:</strong>
                      <div>{new Date(doc.uploaded_at).toLocaleString()}</div>
                    </div>

                    <div>
                      <strong>Size:</strong>
                      <div>
                        {doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB` : "—"}
                      </div>
                    </div>
                  </div>

                  <div style={styles.notesBox}>
                    <strong>Notes:</strong>
                    <div>{doc.notes || "—"}</div>
                  </div>
                </div>
              ))
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
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "28px 18px 40px",
  },
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
  title: {
    fontSize: 60,
    lineHeight: 1.05,
    margin: 0,
    fontWeight: 400,
  },
  subtitle: {
    maxWidth: 980,
    fontSize: 16,
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    marginBottom: 8,
  },
  cardText: {
    color: "#4b628c",
    lineHeight: 1.6,
    marginTop: 0,
    marginBottom: 14,
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
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 15,
    backgroundColor: "#fff",
  },
  textarea: {
    width: "100%",
    minHeight: 110,
    border: "1px solid #c8d5eb",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 15,
    resize: "vertical",
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
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
  docCard: {
    border: "1px solid #d7e2f2",
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
  },
  docHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  docTitle: {
    margin: 0,
    fontSize: 20,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#eef4ff",
    color: "#1e3a8a",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 700,
  },
  badgeSecondary: {
    display: "inline-block",
    backgroundColor: "#f4f6fb",
    color: "#263366",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 700,
  },
  archiveButton: {
    backgroundColor: "#0096C7",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  docMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 14,
    lineHeight: 1.6,
  },
  notesBox: {
    backgroundColor: "#f8fbff",
    border: "1px solid #d9e6f7",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
  },
};
