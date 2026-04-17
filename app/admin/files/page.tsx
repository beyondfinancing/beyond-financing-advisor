import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type LenderRow = {
  id: string;
  name: string | null;
};

type LenderDocumentRow = {
  id: string;
  lender_id: string;
  document_type: string | null;
  original_filename: string | null;
  stored_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: string | null;
  effective_date: string | null;
  notes: string | null;
  uploaded_at: string | null;
  archived_at: string | null;
};

const DOCUMENT_TYPES = [
  "Selling Guide",
  "Programs",
  "Pricing Sheet",
  "Overlays",
  "Program Matrix",
  "Qualification Guide",
  "Other",
];

function cardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    background: "#FFFFFF",
    color: "#263366",
  };
}

function textareaStyle(): CSSProperties {
  return {
    ...inputStyle(),
    minHeight: 110,
    resize: "vertical",
  };
}

function buttonPrimaryStyle(): CSSProperties {
  return {
    width: "100%",
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  };
}

function buttonSecondaryStyle(): CSSProperties {
  return {
    background: "#0096C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };
}

function badgeStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#E8EEF8",
    color: "#263366",
    fontSize: 12,
    fontWeight: 700,
  };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(size: number | null): string {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  const [{ data: lendersData, error: lendersError }, { data: docsData, error: docsError }] =
    await Promise.all([
      supabaseAdmin.from("lenders").select("id, name").order("name", { ascending: true }),
      supabaseAdmin
        .from("lender_documents")
        .select("*")
        .order("uploaded_at", { ascending: false }),
    ]);

  const lenders: LenderRow[] =
    lendersError || !Array.isArray(lendersData) ? [] : (lendersData as LenderRow[]);

  const documents: LenderDocumentRow[] =
    docsError || !Array.isArray(docsData) ? [] : (docsData as LenderDocumentRow[]);

  const lenderMap = new Map(lenders.map((lender) => [lender.id, lender.name || "Unnamed lender"]));
  const activeDocuments = documents.filter((doc) => doc.status === "active");
  const archivedDocuments = documents.filter((doc) => doc.status === "archived");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1420, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div style={{ maxWidth: 1000 }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                background: "#E8EEF8",
                color: "#263366",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              FILE INTAKE
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(40px, 7vw, 58px)",
                lineHeight: 1.05,
              }}
            >
              Manage Lender Files
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 16,
                maxWidth: 1020,
              }}
            >
              Upload lender documents by type. When a new file is uploaded for the
              same lender and document type, the system keeps the new one active
              and archives the previous one as backup.
            </p>
          </div>

          <div style={{ paddingTop: 10 }}>
            <Link
              href="/admin"
              style={{
                color: "#263366",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to Admin Home
            </Link>
          </div>
        </div>

        {params.success && (
          <div
            style={{
              marginBottom: 18,
              background: "#EEF8EA",
              color: "#2F6B2F",
              border: "1px solid #B9D7AF",
              borderRadius: 14,
              padding: 16,
              lineHeight: 1.6,
            }}
          >
            {params.success}
          </div>
        )}

        {params.error && (
          <div
            style={{
              marginBottom: 18,
              background: "#FFF4F2",
              color: "#8A3B2F",
              border: "1px solid #F3C5BC",
              borderRadius: 14,
              padding: 16,
              lineHeight: 1.6,
            }}
          >
            {params.error}
          </div>
        )}

        {(lendersError || docsError) && (
          <div
            style={{
              marginBottom: 18,
              background: "#FFF4F2",
              color: "#8A3B2F",
              border: "1px solid #F3C5BC",
              borderRadius: 14,
              padding: 16,
              lineHeight: 1.6,
            }}
          >
            Database read error: {lendersError?.message || docsError?.message}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(360px, 430px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Upload New File</h2>

            <p
              style={{
                marginTop: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              This upload flow is classification-first. The selected document type
              determines how the system tracks the file and which active version
              it replaces.
            </p>

            <form
              action="/api/admin/files"
              method="POST"
              encType="multipart/form-data"
            >
              <input type="hidden" name="action" value="upload" />

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Lender
                  </label>
                  <select name="lender_id" required style={inputStyle()}>
                    <option value="">Select lender</option>
                    {lenders.map((lender) => (
                      <option key={lender.id} value={lender.id}>
                        {lender.name || "Unnamed lender"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Document Type
                  </label>
                  <select name="document_type" required style={inputStyle()}>
                    <option value="">Select document type</option>
                    {DOCUMENT_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Effective Date
                  </label>
                  <input type="date" name="effective_date" style={inputStyle()} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    style={textareaStyle()}
                    placeholder="Optional notes such as lender bulletin date, pricing release note, or admin comments."
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    File
                  </label>
                  <input
                    type="file"
                    name="file"
                    required
                    style={inputStyle()}
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                  />
                </div>

                <button type="submit" style={buttonPrimaryStyle()}>
                  Upload & Activate File
                </button>
              </div>
            </form>
          </section>

          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Active Documents</h2>
              <div style={{ color: "#5A6A84", marginBottom: 18, fontSize: 14 }}>
                Active files: {activeDocuments.length}
              </div>

              {activeDocuments.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 18,
                    color: "#5A6A84",
                    lineHeight: 1.7,
                  }}
                >
                  No active lender documents have been uploaded yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {activeDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 18,
                        padding: 18,
                        background: "#F8FAFC",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                            {lenderMap.get(doc.lender_id) || "Unknown lender"}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                            <span style={badgeStyle()}>{doc.document_type || "Unknown Type"}</span>
                            <span style={badgeStyle()}>ACTIVE</span>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                              gap: 12,
                              color: "#4B5C78",
                              lineHeight: 1.7,
                              marginBottom: 12,
                            }}
                          >
                            <div>
                              <strong style={{ color: "#263366" }}>Original File:</strong>
                              <br />
                              {doc.original_filename || "—"}
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Effective Date:</strong>
                              <br />
                              {doc.effective_date || "—"}
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Uploaded:</strong>
                              <br />
                              {formatDate(doc.uploaded_at)}
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Size:</strong>
                              <br />
                              {formatFileSize(doc.file_size)}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#FFFFFF",
                              border: "1px solid #D9E1EC",
                              borderRadius: 14,
                              padding: 14,
                              color: "#4B5C78",
                              lineHeight: 1.7,
                            }}
                          >
                            <strong style={{ color: "#263366" }}>Notes:</strong>
                            <div style={{ marginTop: 6 }}>{doc.notes || "—"}</div>
                          </div>
                        </div>

                        <form action="/api/admin/files" method="POST">
                          <input type="hidden" name="action" value="archive" />
                          <input type="hidden" name="id" value={doc.id} />
                          <button type="submit" style={buttonSecondaryStyle()}>
                            Archive Now
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Archived Backup Documents</h2>
              <div style={{ color: "#5A6A84", marginBottom: 18, fontSize: 14 }}>
                Archived files: {archivedDocuments.length}
              </div>

              {archivedDocuments.length === 0 ? (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 18,
                    color: "#5A6A84",
                    lineHeight: 1.7,
                  }}
                >
                  No archived backup files yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {archivedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        padding: 16,
                        background: "#F8FAFC",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>
                        {lenderMap.get(doc.lender_id) || "Unknown lender"} — {doc.document_type || "Unknown Type"}
                      </div>
                      <div style={{ color: "#5A6A84", lineHeight: 1.7 }}>
                        Original file: {doc.original_filename || "—"}
                        <br />
                        Effective date: {doc.effective_date || "—"}
                        <br />
                        Uploaded: {formatDate(doc.uploaded_at)}
                        <br />
                        Archived: {formatDate(doc.archived_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
