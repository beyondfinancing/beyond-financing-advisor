import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type LenderRow = {
  id: string;
  name: string | null;
};

type GuidelineOption = {
  id: string;
  agency: string | null;
  program_name: string | null;
};

type OverlayRow = {
  id: string;
  overlay_name: string | null;
  document_type: string | null;
  occupancy: string[] | null;
  income_types: string[] | null;
  states: string[] | null;
  min_credit: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  max_units: number | null;
  notes: string | null;
  source_name: string | null;
  effective_date: string | null;
  created_at: string | null;
  lenders: { name: string | null } | { name: string | null }[] | null;
  global_guidelines:
    | { agency: string | null; program_name: string | null }
    | { agency: string | null; program_name: string | null }[]
    | null;
};

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
  };
}

function buttonPrimaryStyle(): CSSProperties {
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function readSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AdminOverlaysPage({
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

  const { data: guidelineOptions } = await supabaseAdmin
    .from("global_guidelines")
    .select("id, agency, program_name")
    .eq("is_active", true)
    .order("agency", { ascending: true });

  const { data: overlays } = await supabaseAdmin
    .from("lender_overlays")
    .select(`
      *,
      lenders(name),
      global_guidelines(agency, program_name)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const lenderRows = (lenders || []) as LenderRow[];
  const guidelineRows = (guidelineOptions || []) as GuidelineOption[];
  const overlayRows = (overlays || []) as OverlayRow[];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 28 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "#E8EEF8",
                color: "#263366",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              LENDER OVERLAYS
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 58px)" }}>
              Manage Lender Overlays
            </h1>
            <p style={{ maxWidth: 980, color: "#5A6A84", lineHeight: 1.7 }}>
              Use overlays when a lender is more restrictive than the global guideline
              base. Example: global conventional may allow something broadly, but a
              specific lender can tighten credit, LTV, occupancy, or state coverage here.
            </p>
          </div>

          <div>
            <Link
              href="/admin"
              style={{
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
              }}
            >
              Back to Admin Home
            </Link>
          </div>
        </div>

        {params.success ? (
          <div
            style={{
              marginBottom: 18,
              background: "#EAF7E8",
              border: "1px solid #B9D9B0",
              color: "#256029",
              borderRadius: 14,
              padding: 14,
            }}
          >
            {params.success}
          </div>
        ) : null}

        {params.error ? (
          <div
            style={{
              marginBottom: 18,
              background: "#FFF4F2",
              border: "1px solid #F3C5BC",
              color: "#8A3B2F",
              borderRadius: 14,
              padding: 14,
            }}
          >
            {params.error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(360px, 460px) 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Create Lender Overlay</h2>

            <form action="/api/admin/overlays" method="POST">
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Lender</div>
                  <select name="lender_id" style={inputStyle()} required>
                    <option value="">Select lender</option>
                    {lenderRows.map((lender) => (
                      <option key={lender.id} value={lender.id}>
                        {lender.name || "Unnamed lender"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Related Global Guideline
                  </div>
                  <select name="global_guideline_id" style={inputStyle()}>
                    <option value="">Optional</option>
                    {guidelineRows.map((guideline) => (
                      <option key={guideline.id} value={guideline.id}>
                        {(guideline.agency || "Agency")} — {guideline.program_name || "Program"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Overlay Name</div>
                  <input name="overlay_name" placeholder="Example: UWM Conventional Overlay" style={inputStyle()} required />
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Document Type</div>
                  <select name="document_type" style={inputStyle()}>
                    <option value="overlay">Overlay</option>
                    <option value="announcement">Announcement</option>
                    <option value="matrix">Matrix</option>
                    <option value="pricing">Pricing</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <input name="occupancy" placeholder="Occupancy comma separated: Primary, Second, Investment" style={inputStyle()} />
                <input name="income_types" placeholder="Income types comma separated: W2, Self-Employed, 1099" style={inputStyle()} />
                <input name="states" placeholder="States comma separated: MA, NH, RI" style={inputStyle()} />
                <input name="min_credit" type="number" placeholder="Minimum Credit Score" style={inputStyle()} />
                <input name="max_ltv" type="number" step="0.01" placeholder="Maximum LTV" style={inputStyle()} />
                <input name="max_dti" type="number" step="0.01" placeholder="Maximum DTI" style={inputStyle()} />
                <input name="max_units" type="number" placeholder="Maximum Units" style={inputStyle()} />
                <input name="source_name" placeholder="Source document name" style={inputStyle()} />
                <input name="effective_date" type="date" style={inputStyle()} />
                <textarea
                  name="notes"
                  placeholder="Notes"
                  style={{ ...inputStyle(), minHeight: 120, resize: "vertical" }}
                />

                <button type="submit" style={buttonPrimaryStyle()}>
                  Create Lender Overlay
                </button>
              </div>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Current Lender Overlays</h2>
            <div style={{ color: "#5A6A84", marginBottom: 16 }}>
              Total active overlays: {overlayRows.length}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {overlayRows.length === 0 ? (
                <div
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 18,
                    background: "#F8FAFC",
                    color: "#6B7A90",
                  }}
                >
                  No lender overlays created yet.
                </div>
              ) : (
                overlayRows.map((row) => {
                  const lender = readSingleRelation(row.lenders);
                  const guideline = readSingleRelation(row.global_guidelines);

                  return (
                    <div
                      key={row.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 18,
                        padding: 18,
                        background: "#F8FAFC",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 28, fontWeight: 800 }}>{row.overlay_name || "Unnamed Overlay"}</div>
                          <div style={{ color: "#5A6A84", marginTop: 6 }}>
                            Lender: {lender?.name || "—"}
                          </div>
                          <div style={{ color: "#5A6A84", marginTop: 4 }}>
                            Global Base: {guideline ? `${guideline.agency || "Agency"} / ${guideline.program_name || "Program"}` : "—"}
                          </div>
                        </div>
                        <div
                          style={{
                            alignSelf: "start",
                            padding: "8px 12px",
                            borderRadius: 999,
                            background: "#E8EEF8",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {row.document_type || "overlay"}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div><strong>Min Credit:</strong> {row.min_credit ?? "—"}</div>
                        <div><strong>Max LTV:</strong> {row.max_ltv ?? "—"}</div>
                        <div><strong>Max DTI:</strong> {row.max_dti ?? "—"}</div>
                        <div><strong>Max Units:</strong> {row.max_units ?? "—"}</div>
                        <div><strong>Effective:</strong> {row.effective_date ?? "—"}</div>
                        <div><strong>Created:</strong> {formatDate(row.created_at)}</div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <strong>Occupancy:</strong>{" "}
                        {(row.occupancy || []).length ? row.occupancy?.join(", ") : "—"}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <strong>Income Types:</strong>{" "}
                        {(row.income_types || []).length ? row.income_types?.join(", ") : "—"}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <strong>States:</strong>{" "}
                        {(row.states || []).length ? row.states?.join(", ") : "—"}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <strong>Source Name:</strong> {row.source_name || "—"}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <strong>Notes:</strong> {row.notes || "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
