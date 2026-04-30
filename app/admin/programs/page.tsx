// =============================================================================
// PHASE 7.2 — Add source filter tabs + Approve & Activate to /admin/programs
//
// Replace your existing file at:
//     app/admin/programs/page.tsx
//
// What changed:
//   - Three tabs at the top: "All", "Active", "Drafts (Extracted)"
//   - When ?source=extracted is in the URL, defaults to Drafts tab
//   - Each program card shows a Source badge: "Manual" or "Extracted (Draft)"
//   - Extracted drafts (is_active=false, source='extracted') show:
//       * Confidence badge (high/medium/low) from extraction_metadata
//       * Source quote excerpt from extraction_metadata
//       * Document filename it came from
//       * "Approve & Activate" button that flips is_active=true via
//         the existing /api/admin/programs handler with action=update
//   - Existing manual programs show as before
//   - All existing edit/delete forms preserved exactly
//
// The page already POSTs to /api/admin/programs — that handler is reused.
// We simply add is_active=true as a hidden input on the Approve form.
// =============================================================================

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import AdminNav from "@/app/components/AdminNav";

type LenderOption = {
  id: string;
  name: string | null;
};

type ExtractionMetadata = {
  documentId?: string;
  documentFilename?: string;
  documentType?: string;
  documentGroup?: string;
  extractedAt?: string;
  confidence?: 'high' | 'medium' | 'low';
  sourceQuote?: string | null;
  documentSummary?: string;
  documentWarnings?: string[];
} | null;

type ProgramRow = {
  id: string;
  lender_id: string | null;
  name: string | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  occupancy: string | null;
  notes: string | null;
  loan_category: string | null;
  is_active: boolean | null;
  source: string | null;
  underwriting_method: string | null;
  extraction_metadata: ExtractionMetadata;
  created_at: string | null;
  lenders?: {
    name: string | null;
  } | null;
};

const OCCUPANCY_OPTIONS = [
  "Primary",
  "Second Home",
  "Investment",
  "Mixed-Use",
];

const UNDERWRITING_METHOD_OPTIONS: Array<{
  value: 'either' | 'du' | 'lpa' | 'manual';
  label: string;
}> = [
  { value: 'either', label: 'Either DU or LPA (default)' },
  { value: 'du', label: 'DU only (Fannie Mae Desktop Underwriter)' },
  { value: 'lpa', label: 'LPA only (Freddie Mac Loan Product Advisor)' },
  { value: 'manual', label: 'Manual Underwriting only' },
];

function formatUnderwritingMethod(method: string | null | undefined): string {
  switch (method) {
    case 'du':
      return 'AUS: DU only';
    case 'lpa':
      return 'AUS: LPA only';
    case 'manual':
      return 'AUS: Manual UW';
    case 'either':
    default:
      return 'AUS: Either';
  }
}

type SourceTab = 'all' | 'active' | 'extracted';

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

function buttonApproveStyle(): CSSProperties {
  return {
    background: "#16a34a",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };
}

function buttonDangerStyle(): CSSProperties {
  return {
    background: "#B42318",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };
}

function badgeStyle(background = "#E8EEF8", color = "#263366"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    fontWeight: 700,
    marginRight: 6,
  };
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 12,
    border: active ? "2px solid #263366" : "1px solid #D9E1EC",
    background: active ? "#263366" : "#FFFFFF",
    color: active ? "#FFFFFF" : "#263366",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    cursor: "pointer",
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

function confidenceBadgeColors(confidence: string | undefined): {
  bg: string;
  fg: string;
} {
  switch (confidence) {
    case 'high':
      return { bg: '#dcfce7', fg: '#166534' };
    case 'medium':
      return { bg: '#fef3c7', fg: '#92400e' };
    case 'low':
      return { bg: '#fee2e2', fg: '#991b1b' };
    default:
      return { bg: '#e5e7eb', fg: '#374151' };
  }
}

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; source?: string; tab?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  // Determine active tab. Default to 'all'. ?source=extracted goes to extracted.
  // Explicit ?tab= wins over ?source=.
  let activeTab: SourceTab = 'all';
  if (params.tab === 'active') activeTab = 'active';
  else if (params.tab === 'extracted') activeTab = 'extracted';
  else if (params.source === 'extracted') activeTab = 'extracted';

  // Build query based on active tab.
  let query = supabaseAdmin
    .from("programs")
    .select("*, lenders(name)")
    .order("created_at", { ascending: false });

  if (activeTab === 'active') {
    query = query.eq('is_active', true);
  } else if (activeTab === 'extracted') {
    query = query.eq('source', 'extracted').eq('is_active', false);
  }

  const [{ data: lendersData, error: lendersError }, { data: programsData, error: programsError }] =
    await Promise.all([
      supabaseAdmin.from("lenders").select("id, name").order("name", { ascending: true }),
      query,
    ]);

  const lenders: LenderOption[] =
    lendersError || !Array.isArray(lendersData) ? [] : (lendersData as LenderOption[]);

  const programs: ProgramRow[] =
    programsError || !Array.isArray(programsData) ? [] : (programsData as ProgramRow[]);

  // Counts for tab labels.
  const [{ count: allCount }, { count: activeCount }, { count: draftCount }] =
    await Promise.all([
      supabaseAdmin.from('programs').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('programs')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabaseAdmin
        .from('programs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'extracted')
        .eq('is_active', false),
    ]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: 24 }}>
        <AdminNav />

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
          <div style={{ maxWidth: 980 }}>
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
              PROGRAM ENGINE
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(40px, 7vw, 58px)",
                lineHeight: 1.05,
              }}
            >
              Manage Programs
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 16,
                maxWidth: 980,
              }}
            >
              Create, edit, and delete lender programs that power scenario direction.
              Programs created via AI extraction from lender PDFs land in the{" "}
              <strong>Drafts (Extracted)</strong> tab as inactive — review and approve them
              there to make them live.
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

        {/* TAB BAR */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/admin/programs?tab=all" style={tabStyle(activeTab === 'all')}>
            All ({allCount ?? 0})
          </Link>
          <Link href="/admin/programs?tab=active" style={tabStyle(activeTab === 'active')}>
            Active ({activeCount ?? 0})
          </Link>
          <Link href="/admin/programs?tab=extracted" style={tabStyle(activeTab === 'extracted')}>
            Drafts — Extracted ({draftCount ?? 0})
          </Link>
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

        {(lendersError || programsError) && (
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
            Database read error: {lendersError?.message || programsError?.message}
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
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create Program</h2>

            <p
              style={{
                marginTop: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              Manually add a program here. To extract programs from a lender PDF instead, go to{" "}
              <Link href="/admin/files" style={{ color: '#0096C7', fontWeight: 700 }}>
                Manage Lender Files
              </Link>{" "}
              and click <strong>Extract Programs</strong> on any uploaded matrix.
            </p>

            <form action="/api/admin/programs" method="POST">
              <input type="hidden" name="action" value="create" />

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
                    Program Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    style={inputStyle()}
                    placeholder="Example: DSCR, FHA, Conventional, Bank Statement"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Minimum Credit Score
                  </label>
                  <input type="number" name="min_credit" required style={inputStyle()} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Maximum LTV
                  </label>
                  <input type="number" name="max_ltv" required style={inputStyle()} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Maximum DTI
                  </label>
                  <input type="number" name="max_dti" required style={inputStyle()} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Occupancy
                  </label>
                  <select name="occupancy" required style={inputStyle()}>
                    <option value="">Select occupancy</option>
                    {OCCUPANCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    AUS / Underwriting Method
                  </label>
                  <select
                    name="underwriting_method"
                    defaultValue="either"
                    required
                    style={inputStyle()}
                  >
                    {UNDERWRITING_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={4}
                    style={{ ...inputStyle(), resize: "vertical", minHeight: 110 }}
                    placeholder="Example: Investor program, reserves required, special overlay notes."
                  />
                </div>

                <button type="submit" style={buttonPrimaryStyle()}>
                  Create Program
                </button>
              </div>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>
              {activeTab === 'extracted'
                ? 'Draft Programs Awaiting Review'
                : activeTab === 'active'
                ? 'Active Programs'
                : 'All Programs'}
            </h2>

            <div style={{ color: "#5A6A84", marginBottom: 18, fontSize: 14 }}>
              Showing: {programs.length}
            </div>

            {programs.length === 0 ? (
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
                {activeTab === 'extracted'
                  ? 'No draft programs awaiting review. Extract programs from /admin/files to populate this tab.'
                  : 'No programs found in this view.'}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {programs.map((program) => {
                  const isExtractedDraft =
                    program.source === 'extracted' && program.is_active === false;

                  const meta = program.extraction_metadata || null;
                  const confidence = meta?.confidence;
                  const confColors = confidenceBadgeColors(confidence);

                  return (
                    <div
                      key={program.id}
                      style={{
                        border: isExtractedDraft
                          ? "2px solid #fbbf24"
                          : "1px solid #D9E1EC",
                        borderRadius: 18,
                        padding: 18,
                        background: isExtractedDraft ? '#fffbeb' : "#F8FAFC",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 14,
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginBottom: 10,
                            }}
                          >
                            {isExtractedDraft ? (
                              <span style={badgeStyle('#fef3c7', '#92400e')}>
                                ⚠ DRAFT — EXTRACTED
                              </span>
                            ) : program.source === 'extracted' ? (
                              <span style={badgeStyle('#dbeafe', '#1e40af')}>
                                EXTRACTED (ACTIVE)
                              </span>
                            ) : (
                              <span style={badgeStyle('#f3f4f6', '#374151')}>
                                MANUAL
                              </span>
                            )}

                            {program.is_active ? (
                              <span style={badgeStyle('#dcfce7', '#166534')}>ACTIVE</span>
                            ) : (
                              <span style={badgeStyle('#e5e7eb', '#374151')}>
                                INACTIVE
                              </span>
                            )}

                            {confidence && (
                              <span
                                style={badgeStyle(confColors.bg, confColors.fg)}
                              >
                                Confidence: {confidence}
                              </span>
                            )}

                            {program.occupancy && (
                              <span style={badgeStyle()}>{program.occupancy}</span>
                            )}

                            <span style={badgeStyle('#cffafe', '#155e75')}>
                              {formatUnderwritingMethod(program.underwriting_method)}
                            </span>
                          </div>

                          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                            {program.name || "Unnamed program"}
                          </div>

                          <div style={{ color: "#4B5C78", lineHeight: 1.7, marginBottom: 10 }}>
                            Lender: <strong style={{ color: "#263366" }}>
                              {program.lenders?.name || "—"}
                            </strong>
                            {program.loan_category && (
                              <>
                                {" · "}Category:{" "}
                                <strong style={{ color: "#263366" }}>
                                  {program.loan_category}
                                </strong>
                              </>
                            )}
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                              gap: 12,
                              color: "#4B5C78",
                              lineHeight: 1.7,
                              marginBottom: 14,
                            }}
                          >
                            <div>
                              <strong style={{ color: "#263366" }}>Min Credit:</strong>
                              <br />
                              {program.min_credit ?? "—"}
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Max LTV:</strong>
                              <br />
                              {program.max_ltv ?? "—"}%
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Max DTI:</strong>
                              <br />
                              {program.max_dti ?? "—"}%
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Created:</strong>
                              <br />
                              {formatDate(program.created_at)}
                            </div>
                          </div>

                          {/* Extraction metadata block (drafts only) */}
                          {isExtractedDraft && meta && (
                            <div
                              style={{
                                border: '1px solid #fbbf24',
                                background: '#fffbeb',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 12,
                                fontSize: 14,
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                📄 Extracted from: {meta.documentFilename || 'Unknown PDF'}
                              </div>
                              {meta.documentType && meta.documentGroup && (
                                <div style={{ color: '#78716c', marginBottom: 6 }}>
                                  {meta.documentType} · {meta.documentGroup}
                                </div>
                              )}
                              {meta.sourceQuote && (
                                <div
                                  style={{
                                    fontStyle: 'italic',
                                    color: '#57534e',
                                    borderLeft: '3px solid #fbbf24',
                                    paddingLeft: 10,
                                    marginTop: 8,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  &ldquo;{meta.sourceQuote}&rdquo;
                                </div>
                              )}
                              {meta.documentWarnings &&
                                meta.documentWarnings.length > 0 && (
                                  <div style={{ marginTop: 10 }}>
                                    <strong>Warnings to review:</strong>
                                    <ul
                                      style={{
                                        margin: '6px 0 0',
                                        paddingLeft: 18,
                                        color: '#92400e',
                                      }}
                                    >
                                      {meta.documentWarnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                            </div>
                          )}

                          <div
                            style={{
                              border: "1px solid #D9E1EC",
                              borderRadius: 14,
                              padding: 14,
                              background: "#FFFFFF",
                              marginBottom: 12,
                            }}
                          >
                            <strong style={{ color: "#263366" }}>Notes:</strong>
                            <div style={{ marginTop: 6, color: "#4B5C78", lineHeight: 1.7 }}>
                              {program.notes || "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 18,
                          paddingTop: 18,
                          borderTop: "1px solid #D9E1EC",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 14,
                          alignItems: "end",
                        }}
                      >
                        <form action="/api/admin/programs" method="POST">
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="id" value={program.id} />

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                              gap: 12,
                            }}
                          >
                            <select
                              name="lender_id"
                              defaultValue={program.lender_id || ""}
                              required
                              style={inputStyle()}
                            >
                              <option value="">Select lender</option>
                              {lenders.map((lender) => (
                                <option key={lender.id} value={lender.id}>
                                  {lender.name || "Unnamed lender"}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              name="name"
                              defaultValue={program.name || ""}
                              required
                              style={inputStyle()}
                              placeholder="Program Name"
                            />

                            <input
                              type="number"
                              name="min_credit"
                              defaultValue={program.min_credit ?? ""}
                              required
                              style={inputStyle()}
                              placeholder="Min Credit"
                            />

                            <input
                              type="number"
                              name="max_ltv"
                              defaultValue={program.max_ltv ?? ""}
                              required
                              style={inputStyle()}
                              placeholder="Max LTV"
                            />

                            <input
                              type="number"
                              name="max_dti"
                              defaultValue={program.max_dti ?? ""}
                              required
                              style={inputStyle()}
                              placeholder="Max DTI"
                            />

                            <select
                              name="occupancy"
                              defaultValue={program.occupancy || ""}
                              required
                              style={inputStyle()}
                            >
                              <option value="">Select occupancy</option>
                              {OCCUPANCY_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>

                            <select
                              name="underwriting_method"
                              defaultValue={program.underwriting_method || "either"}
                              required
                              style={inputStyle()}
                            >
                              {UNDERWRITING_METHOD_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <textarea
                              name="notes"
                              defaultValue={program.notes || ""}
                              rows={4}
                              style={{ ...inputStyle(), resize: "vertical", minHeight: 100 }}
                              placeholder="Notes"
                            />
                          </div>

                          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button type="submit" style={buttonSecondaryStyle()}>
                              Save Changes
                            </button>
                          </div>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Approve & Activate — drafts only */}
                          {isExtractedDraft && (
                            <form action="/api/admin/programs" method="POST">
                              <input type="hidden" name="action" value="update" />
                              <input type="hidden" name="id" value={program.id} />
                              <input type="hidden" name="lender_id" value={program.lender_id || ''} />
                              <input type="hidden" name="name" value={program.name || ''} />
                              <input
                                type="hidden"
                                name="min_credit"
                                value={program.min_credit ?? ''}
                              />
                              <input
                                type="hidden"
                                name="max_ltv"
                                value={program.max_ltv ?? ''}
                              />
                              <input
                                type="hidden"
                                name="max_dti"
                                value={program.max_dti ?? ''}
                              />
                              <input
                                type="hidden"
                                name="occupancy"
                                value={program.occupancy || ''}
                              />
                              <input type="hidden" name="notes" value={program.notes || ''} />
                              <input
                                type="hidden"
                                name="underwriting_method"
                                value={program.underwriting_method || 'either'}
                              />
                              <input type="hidden" name="is_active" value="true" />
                              <button type="submit" style={buttonApproveStyle()}>
                                Approve & Activate
                              </button>
                            </form>
                          )}

                          <form action="/api/admin/programs" method="POST">
                            <input type="hidden" name="action" value="delete" />
                            <input type="hidden" name="id" value={program.id} />
                            <button type="submit" style={buttonDangerStyle()}>
                              {isExtractedDraft ? 'Reject Draft' : 'Delete'}
                            </button>
                          </form>
                        </div>
                      </div>
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
