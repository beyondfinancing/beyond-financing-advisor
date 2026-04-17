import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

function cardStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontWeight: 700,
    marginBottom: 8,
    color: "#263366",
  };
}

function buttonPrimaryStyle(): React.CSSProperties {
  return {
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function pillStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#E8EEF8",
    color: "#263366",
    fontSize: 12,
    fontWeight: 700,
  };
}

type LenderRow = {
  id: string;
  name: string | null;
};

type ProgramRow = {
  id: string;
  name: string | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  occupancy: string | null;
  notes: string | null;
  created_at: string | null;
  lenders: {
    name: string | null;
  } | null;
};

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  const { data: lenders } = await supabaseAdmin
    .from("lenders")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: programs } = await supabaseAdmin
    .from("programs")
    .select("*, lenders(name)")
    .order("created_at", { ascending: false });

  const safeLenders = (lenders || []) as LenderRow[];
  const safePrograms = (programs || []) as ProgramRow[];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                background: "#E8EEF8",
                color: "#263366",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              PROGRAM ENGINE
            </div>

            <h1
              style={{
                margin: "0 0 8px",
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1.1,
              }}
            >
              Manage Programs
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 17,
                maxWidth: 900,
              }}
            >
              Build the lender-program engine that powers scenario direction.
              Add qualification thresholds, occupancy rules, and notes for each
              lender program.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/admin"
              style={{
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
                alignSelf: "center",
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
              border: "1px solid #B7D7B0",
              color: "#2E6B2E",
              borderRadius: 16,
              padding: 14,
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
              border: "1px solid #F3C5BC",
              color: "#8A3B2F",
              borderRadius: 16,
              padding: 14,
              lineHeight: 1.6,
            }}
          >
            {params.error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 430px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Create Program</h2>

            {safeLenders.length === 0 ? (
              <div
                style={{
                  border: "1px solid #E9D4A7",
                  background: "#FFF9EC",
                  color: "#8A6A1F",
                  borderRadius: 16,
                  padding: 16,
                  lineHeight: 1.7,
                }}
              >
                Create at least one lender first before adding programs.
              </div>
            ) : (
              <form
                action="/api/programs"
                method="POST"
                style={{ display: "grid", gap: 16 }}
              >
                <div>
                  <label style={labelStyle()}>Lender</label>
                  <select name="lender_id" required style={inputStyle()}>
                    <option value="">Select lender</option>
                    {safeLenders.map((lender) => (
                      <option key={lender.id} value={lender.id}>
                        {lender.name || "Unnamed Lender"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle()}>Program Name</label>
                  <input
                    name="name"
                    required
                    style={inputStyle()}
                    placeholder="Example: DSCR, FHA, Conventional, Bank Statement"
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Minimum Credit Score</label>
                  <input
                    name="min_credit"
                    type="number"
                    required
                    style={inputStyle()}
                    placeholder="680"
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Maximum LTV</label>
                  <input
                    name="max_ltv"
                    type="number"
                    required
                    style={inputStyle()}
                    placeholder="80"
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Maximum DTI</label>
                  <input
                    name="max_dti"
                    type="number"
                    required
                    style={inputStyle()}
                    placeholder="50"
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Occupancy</label>
                  <select name="occupancy" required style={inputStyle()}>
                    <option value="">Select occupancy</option>
                    <option value="Primary">Primary</option>
                    <option value="Second">Second</option>
                    <option value="Investment">Investment</option>
                    <option value="Mixed-Use">Mixed-Use</option>
                    <option value="All">All</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle()}>Notes</label>
                  <textarea
                    name="notes"
                    rows={5}
                    style={{
                      ...inputStyle(),
                      resize: "vertical",
                      minHeight: 120,
                    }}
                    placeholder="Example: Investor program, reserves required, special overlay notes."
                  />
                </div>

                <button type="submit" style={buttonPrimaryStyle()}>
                  Create Program
                </button>
              </form>
            )}
          </section>

          <section style={cardStyle()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 24 }}>Current Programs</h2>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#5A6A84",
                    lineHeight: 1.7,
                  }}
                >
                  Total programs: <strong>{safePrograms.length}</strong>
                </p>
              </div>
            </div>

            {safePrograms.length === 0 ? (
              <div
                style={{
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  padding: 18,
                  background: "#F8FAFC",
                  color: "#5A6A84",
                  lineHeight: 1.7,
                }}
              >
                No programs have been created yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {safePrograms.map((program) => (
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
                        flexWrap: "wrap",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>
                          {program.name || "Unnamed Program"}
                        </div>
                        <div
                          style={{
                            color: "#5A6A84",
                            marginTop: 6,
                            lineHeight: 1.7,
                          }}
                        >
                          Lender: <strong>{program.lenders?.name || "-"}</strong>
                        </div>
                      </div>

                      <div>
                        <span style={pillStyle()}>
                          {program.occupancy || "No occupancy"}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 12,
                        color: "#4B5C78",
                        lineHeight: 1.7,
                      }}
                    >
                      <div>
                        <strong>Min Credit:</strong>
                        <br />
                        {program.min_credit ?? "-"}
                      </div>

                      <div>
                        <strong>Max LTV:</strong>
                        <br />
                        {program.max_ltv ?? "-"}%
                      </div>

                      <div>
                        <strong>Max DTI:</strong>
                        <br />
                        {program.max_dti ?? "-"}%
                      </div>

                      <div>
                        <strong>Created:</strong>
                        <br />
                        {program.created_at
                          ? new Date(program.created_at).toLocaleString()
                          : "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        padding: 14,
                        borderRadius: 14,
                        background: "#FFFFFF",
                        border: "1px solid #D9E1EC",
                        lineHeight: 1.7,
                        color: "#4B5C78",
                      }}
                    >
                      <strong>Notes:</strong>
                      <br />
                      {program.notes || "No notes entered."}
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
