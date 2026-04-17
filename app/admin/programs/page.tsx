import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type LenderOption = {
  id: string;
  name: string | null;
};

type ProgramRow = {
  id: string;
  lender_id: string | null;
  name: string | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  occupancy: string | null;
  notes: string | null;
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

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  const [{ data: lendersData, error: lendersError }, { data: programsData, error: programsError }] =
    await Promise.all([
      supabaseAdmin.from("lenders").select("id, name").order("name", { ascending: true }),
      supabaseAdmin
        .from("programs")
        .select("*, lenders(name)")
        .order("created_at", { ascending: false }),
    ]);

  const lenders: LenderOption[] =
    lendersError || !Array.isArray(lendersData) ? [] : (lendersData as LenderOption[]);

  const programs: ProgramRow[] =
    programsError || !Array.isArray(programsData) ? [] : (programsData as ProgramRow[]);

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
              This page manages structured program records while we prepare the lender
              file-ingestion upgrade for bulk extraction from PDFs and spreadsheets.
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
              Build lender-program matching rules. Later, this same area will also
              support auto-created records extracted from lender files for admin review.
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
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Current Programs</h2>

            <div style={{ color: "#5A6A84", marginBottom: 18, fontSize: 14 }}>
              Total programs: {programs.length}
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
                No programs have been added yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {programs.map((program) => (
                  <div
                    key={program.id}
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
                        gap: 14,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                          {program.name || "Unnamed program"}
                        </div>

                        <div style={{ color: "#4B5C78", lineHeight: 1.7, marginBottom: 10 }}>
                          Lender: <strong style={{ color: "#263366" }}>
                            {program.lenders?.name || "—"}
                          </strong>
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

                      <div>
                        <span style={badgeStyle()}>{program.occupancy || "No occupancy"}</span>
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

                        <div style={{ marginTop: 12 }}>
                          <button type="submit" style={buttonSecondaryStyle()}>
                            Save Changes
                          </button>
                        </div>
                      </form>

                      <form action="/api/admin/programs" method="POST">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={program.id} />
                        <button type="submit" style={buttonDangerStyle()}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
