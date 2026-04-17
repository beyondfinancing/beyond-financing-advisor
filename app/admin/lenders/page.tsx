import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type LenderRow = {
  id: string;
  name: string | null;
  channel: string | null;
  states: string[] | null;
  created_at: string | null;
};

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
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

export default async function AdminLendersPage({
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
    .select("*")
    .order("created_at", { ascending: false });

  const lenderRows: LenderRow[] = Array.isArray(lenders)
    ? (lenders as LenderRow[])
    : [];

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
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div style={{ maxWidth: 860 }}>
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
              LENDER MANAGEMENT
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(40px, 7vw, 58px)",
                lineHeight: 1.05,
              }}
            >
              Manage Lenders
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
              Create and organize lender records, available channels, and state
              coverage. Use one lender record per lender, and list all channels
              that apply to that lender inside the same record.
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(360px, 400px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create Lender</h2>

            <p
              style={{
                marginTop: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              Keep one lender record per institution. If that lender is
              available in more than one channel, enter all applicable channels
              in the same record.
            </p>

            <form action="/api/admin/lenders" method="POST">
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Lender Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    style={inputStyle()}
                    placeholder="Example: UWM"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Channels
                  </label>
                  <select
                    name="channel"
                    multiple
                    size={3}
                    required
                    style={{
                      ...inputStyle(),
                      minHeight: 118,
                    }}
                  >
                    <option value="Retail">Retail</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Correspondent">Correspondent</option>
                  </select>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "#6A7890",
                      lineHeight: 1.6,
                    }}
                  >
                    Hold Ctrl on Windows or Command on Mac to select more than
                    one.
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    States
                  </label>
                  <input
                    type="text"
                    name="states"
                    required
                    style={inputStyle()}
                    placeholder={`Example: ${US_STATES.slice(0, 6).join(", ")}`}
                  />
                </div>

                <button type="submit" style={buttonPrimaryStyle()}>
                  Create Lender
                </button>
              </div>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Current Lenders</h2>

            <div
              style={{
                color: "#5A6A84",
                marginBottom: 18,
                fontSize: 14,
              }}
            >
              Total lenders: {lenderRows.length}
            </div>

            {lenderRows.length === 0 ? (
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
                No lenders have been added yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {lenderRows.map((lender) => {
                  const channels = (lender.channel || "")
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);

                  return (
                    <div
                      key={lender.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
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
                        <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 800,
                              marginBottom: 10,
                            }}
                          >
                            {lender.name || "Unnamed lender"}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 14,
                            }}
                          >
                            {channels.length > 0 ? (
                              channels.map((channel) => (
                                <span key={channel} style={badgeStyle()}>
                                  {channel}
                                </span>
                              ))
                            ) : (
                              <span style={badgeStyle()}>No channel listed</span>
                            )}
                          </div>

                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            States:
                          </div>
                          <div style={{ color: "#4B5C78", lineHeight: 1.7 }}>
                            {Array.isArray(lender.states) && lender.states.length > 0
                              ? lender.states.join(", ")
                              : "—"}
                          </div>
                        </div>

                        <div style={{ minWidth: 180 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            Created:
                          </div>
                          <div style={{ color: "#4B5C78", lineHeight: 1.7 }}>
                            {formatDate(lender.created_at)}
                          </div>
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
