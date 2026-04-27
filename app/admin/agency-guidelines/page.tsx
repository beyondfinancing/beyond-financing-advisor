// =============================================================================
// PHASE 7.5 — NEW FILE: app/admin/agency-guidelines/page.tsx
//
// Why a separate page instead of jamming a tab onto /admin/programs:
//   The schema for global_guidelines is genuinely different from programs
//   (agency, product_family, program_name vs lender_id, name, loan_category).
//   A dedicated page is cleaner and lets us show agency-appropriate columns.
//
// Functionality:
//   - View All / Active / Drafts tabs
//   - Filter by agency (Fannie Mae / Freddie Mac / All)
//   - Filter by product family (Single-Family / Multi-Family / All)
//   - Approve & Activate / Reject Draft / Delete buttons per row
//   - Shows extraction source, confidence, source document filename
// =============================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";

type AgencyGuideline = {
  id: string;
  agency: string;
  product_family: string;
  program_name: string;
  document_type: string | null;
  occupancy: string[] | null;
  income_types: string[] | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  max_units: number | null;
  notes: string | null;
  source_name: string | null;
  effective_date: string | null;
  is_active: boolean;
  created_at: string;
  source: string;
  extraction_metadata: Record<string, unknown>;
};

type Tab = "all" | "active" | "drafts";
type AgencyFilter = "all" | "Fannie Mae" | "Freddie Mac";
type FamilyFilter = "all" | "Single-Family" | "Multi-Family";

export default function AgencyGuidelinesPage() {
  const [guidelines, setGuidelines] = useState<AgencyGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("drafts");
  const [agencyFilter, setAgencyFilter] = useState<AgencyFilter>("all");
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>("all");

  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    void loadGuidelines();
  }, []);

  async function loadGuidelines() {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/agency-guidelines", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to load agency guidelines.");
      }
      setGuidelines(Array.isArray(json.guidelines) ? json.guidelines : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load."
      );
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const all = guidelines.length;
    const active = guidelines.filter((g) => g.is_active).length;
    const drafts = guidelines.filter((g) => !g.is_active).length;
    return { all, active, drafts };
  }, [guidelines]);

  const filtered = useMemo(() => {
    let items = guidelines;
    if (activeTab === "active") items = items.filter((g) => g.is_active);
    if (activeTab === "drafts") items = items.filter((g) => !g.is_active);
    if (agencyFilter !== "all")
      items = items.filter((g) => g.agency === agencyFilter);
    if (familyFilter !== "all")
      items = items.filter((g) => g.product_family === familyFilter);
    return items.sort((a, b) => {
      const ag = a.agency.localeCompare(b.agency);
      if (ag !== 0) return ag;
      const pf = a.product_family.localeCompare(b.product_family);
      if (pf !== 0) return pf;
      return a.program_name.localeCompare(b.program_name);
    });
  }, [guidelines, activeTab, agencyFilter, familyFilter]);

  async function handleActivate(id: string) {
    setBusyId(id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch("/api/admin/agency-guidelines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to activate.");
      }
      setStatusMessage("Agency guideline activated.");
      await loadGuidelines();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Activate failed."
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleReject(id: string) {
    if (!window.confirm("Reject and delete this draft?")) return;
    setBusyId(id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch(`/api/admin/agency-guidelines?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to delete.");
      }
      setStatusMessage("Agency guideline deleted.");
      await loadGuidelines();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Delete failed."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.eyebrow}>AGENCY ENGINE</div>
            <h1 style={styles.title}>Manage Agency Guidelines</h1>
            <p style={styles.subtitle}>
              Fannie Mae and Freddie Mac selling guide programs. Drafts come
              from AI extraction of the official Selling Guides — review and
              approve them here to make them live and queryable by the matcher.
            </p>
          </div>
          <a href="/admin" style={styles.backLink}>
            Back to Admin Home
          </a>
        </div>

        {statusMessage ? <div style={styles.successBox}>{statusMessage}</div> : null}
        {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}

        <div style={styles.tabRow}>
          <button
            style={activeTab === "all" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("all")}
          >
            All ({counts.all})
          </button>
          <button
            style={activeTab === "active" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("active")}
          >
            Active ({counts.active})
          </button>
          <button
            style={activeTab === "drafts" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("drafts")}
          >
            Drafts ({counts.drafts})
          </button>
        </div>

        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Agency:</label>
            <select
              style={styles.filterSelect}
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value as AgencyFilter)}
            >
              <option value="all">All</option>
              <option value="Fannie Mae">Fannie Mae</option>
              <option value="Freddie Mac">Freddie Mac</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Product Family:</label>
            <select
              style={styles.filterSelect}
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value as FamilyFilter)}
            >
              <option value="all">All</option>
              <option value="Single-Family">Single-Family</option>
              <option value="Multi-Family">Multi-Family</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={styles.infoBox}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.infoBox}>
            No agency guidelines match the current filters.
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map((g) => {
              const meta = g.extraction_metadata || {};
              const confidence = (meta as { confidence?: string }).confidence;
              const sourceQuote = (meta as { sourceQuote?: string }).sourceQuote;
              const isBusy = busyId === g.id;

              return (
                <div
                  key={g.id}
                  style={{
                    ...styles.card,
                    borderColor: g.is_active ? "#d7e2f2" : "#facc15",
                    backgroundColor: g.is_active ? "#fff" : "#fffbeb",
                  }}
                >
                  <div style={styles.badgeRow}>
                    <span
                      style={{
                        ...styles.badge,
                        ...(g.is_active
                          ? styles.badgeActive
                          : styles.badgeDraft),
                      }}
                    >
                      {g.is_active ? "ACTIVE" : "DRAFT"}
                    </span>
                    <span style={{ ...styles.badge, ...styles.badgePrimary }}>
                      {g.agency}
                    </span>
                    <span style={{ ...styles.badge, ...styles.badgeNeutral }}>
                      {g.product_family}
                    </span>
                    {g.source === "extracted" && (
                      <span style={{ ...styles.badge, ...styles.badgeNeutral }}>
                        EXTRACTED
                      </span>
                    )}
                    {confidence && (
                      <span
                        style={{
                          ...styles.badge,
                          ...(confidence === "high"
                            ? styles.badgeSuccess
                            : confidence === "medium"
                            ? styles.badgeNeutral
                            : styles.badgeError),
                        }}
                      >
                        Confidence: {confidence}
                      </span>
                    )}
                  </div>

                  <h2 style={styles.programName}>{g.program_name}</h2>

                  <div style={styles.statsGrid}>
                    <div>
                      <strong>Min Credit:</strong>
                      <div>{g.min_credit ?? "—"}</div>
                    </div>
                    <div>
                      <strong>Max LTV:</strong>
                      <div>{g.max_ltv != null ? `${g.max_ltv}%` : "—"}</div>
                    </div>
                    <div>
                      <strong>Max DTI:</strong>
                      <div>{g.max_dti != null ? `${g.max_dti}%` : "—"}</div>
                    </div>
                    <div>
                      <strong>Max Units:</strong>
                      <div>{g.max_units ?? "—"}</div>
                    </div>
                    <div>
                      <strong>Occupancy:</strong>
                      <div>
                        {g.occupancy && g.occupancy.length > 0
                          ? g.occupancy.join(", ")
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <strong>Income Types:</strong>
                      <div>
                        {g.income_types && g.income_types.length > 0
                          ? g.income_types.join(", ")
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <strong>Effective Date:</strong>
                      <div>{g.effective_date || "—"}</div>
                    </div>
                    <div>
                      <strong>Source:</strong>
                      <div style={styles.sourceText}>
                        {g.source_name || "—"}
                      </div>
                    </div>
                  </div>

                  {g.notes && (
                    <div style={styles.notesBox}>
                      <strong>Notes:</strong>
                      <div style={styles.notesText}>{g.notes}</div>
                    </div>
                  )}

                  {sourceQuote && (
                    <div style={styles.quoteBox}>
                      <strong>Source quote:</strong>
                      <div style={styles.quoteText}>{`"${sourceQuote}"`}</div>
                    </div>
                  )}

                  <div style={styles.actionRow}>
                    {!g.is_active && (
                      <button
                        type="button"
                        style={{
                          ...styles.approveButton,
                          opacity: isBusy ? 0.6 : 1,
                          cursor: isBusy ? "wait" : "pointer",
                        }}
                        onClick={() => handleActivate(g.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Activating…" : "Approve & Activate"}
                      </button>
                    )}
                    <button
                      type="button"
                      style={{
                        ...styles.rejectButton,
                        opacity: isBusy ? 0.6 : 1,
                        cursor: isBusy ? "wait" : "pointer",
                      }}
                      onClick={() => handleReject(g.id)}
                      disabled={isBusy}
                    >
                      {g.is_active ? "Delete" : "Reject Draft"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  tabRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  tab: {
    padding: "10px 18px",
    borderRadius: 999,
    border: "1px solid #d7e2f2",
    backgroundColor: "#fff",
    color: "#263366",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabActive: {
    padding: "10px 18px",
    borderRadius: 999,
    border: "1px solid #263366",
    backgroundColor: "#263366",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  filterRow: {
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    marginBottom: 16,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    border: "1px solid #d7e2f2",
  },
  filterGroup: { display: "flex", alignItems: "center", gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: 700, color: "#4b628c" },
  filterSelect: {
    border: "1px solid #c8d5eb",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#263366",
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
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: {
    border: "1px solid",
    borderRadius: 18,
    padding: 18,
  },
  badgeRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  badge: {
    display: "inline-block",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  badgePrimary: { backgroundColor: "#eef4ff", color: "#1e3a8a" },
  badgeNeutral: { backgroundColor: "#f4f6fb", color: "#263366" },
  badgeActive: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeDraft: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeSuccess: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeError: { backgroundColor: "#fee2e2", color: "#991b1b" },
  programName: { fontSize: 22, margin: "0 0 12px 0", fontWeight: 700 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 14,
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 1.5,
  },
  notesBox: {
    backgroundColor: "#f8fbff",
    border: "1px solid #d9e6f7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  notesText: {
    marginTop: 6,
    lineHeight: 1.6,
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
  quoteBox: {
    backgroundColor: "#fff",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 13,
  },
  quoteText: { marginTop: 6, fontStyle: "italic", color: "#4b628c" },
  sourceText: { fontSize: 13, color: "#5b7097", wordBreak: "break-word" },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  approveButton: {
    backgroundColor: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: 14,
  },
  rejectButton: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: 14,
  },
};

