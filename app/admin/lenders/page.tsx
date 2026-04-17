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

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
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

function multiSelectStyle(): CSSProperties {
  return {
    ...inputStyle(),
    minHeight: 160,
    padding: 12,
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

function parseChannels(channel: string | null): string[] {
  if (!channel) return [];
  return channel
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

  const { data, error } = await supabaseAdmin
    .from("lenders")
    .select("*")
    .order("created_at", { ascending: false });

  const lenders: LenderRow[] =
    error || !Array.isArray(data) ? [] : (data as LenderRow[]);

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
          <div style={{ maxWidth: 960 }}>
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
              Create, edit, and delete lender records, available channels, and
              state coverage. Use one lender record per institution and keep all
              active channels inside the same record.
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

        {error && (
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
            Database read error: {error.message}
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
              available in more than one channel, select all applicable channels
              in the same record.
            </p>

            <form action="/api/admin/lenders" method="POST">
              <input type="hidden" name="action" value="create" />

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
                    name="channels"
                    multiple
                    required
                    style={multiSelectStyle()}
                  >
                    {CHANNEL_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 8, color: "#6A7890", fontSize: 13, lineHeight: 1.6 }}>
                    Hold Ctrl on Windows or Command on Mac to select more than one.
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    States
                  </label>
                  <select
                    name="states"
                    multiple
                    required
                    style={multiSelectStyle()}
                  >
                    {US_STATES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 8, color: "#6A7890", fontSize: 13, lineHeight: 1.6 }}>
                    Multi-select the states where this lender/channel relationship is active.
                  </div>
                </div>

                <button type="submit" style={buttonPrimaryStyle()}>
                  Create Lender
                </button>
              </div>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Current Lenders</h2>

            <div style={{ color: "#5A6A84", marginBottom: 18, fontSize: 14 }}>
              Total lenders: {lenders.length}
            </div>

            {lenders.length === 0 ? (
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
              <div style={{ display: "grid", gap: 16 }}>
                {lenders.map((lender) => {
                  const lenderChannels = parseChannels(lender.channel);
                  const lenderStates = Array.isArray(lender.states) ? lender.states : [];

                  return (
                    <div
                      key={lender.id}
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
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 800,
                              marginBottom: 10,
                            }}
                          >
                            {lender.name || "Unnamed lender"}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                            {lenderChannels.length === 0 ? (
                              <span style={badgeStyle()}>No channels</span>
                            ) : (
                              lenderChannels.map((item) => (
                                <span key={item} style={badgeStyle()}>
                                  {item}
                                </span>
                              ))
                            )}
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: 12,
                              color: "#4B5C78",
                              lineHeight: 1.7,
                            }}
                          >
                            <div>
                              <strong style={{ color: "#263366" }}>States:</strong>
                              <br />
                              {lenderStates.length ? lenderStates.join(", ") : "—"}
                            </div>
                            <div>
                              <strong style={{ color: "#263366" }}>Created:</strong>
                              <br />
                              {formatDate(lender.created_at)}
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
                        <form action="/api/admin/lenders" method="POST">
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="id" value={lender.id} />

                          <div style={{ display: "grid", gap: 12 }}>
                            <input
                              type="text"
                              name="name"
                              defaultValue={lender.name || ""}
                              style={inputStyle()}
                              placeholder="Lender Name"
                              required
                            />

                            <select
                              name="channels"
                              multiple
                              defaultValue={lenderChannels}
                              style={multiSelectStyle()}
                              required
                            >
                              {CHANNEL_OPTIONS.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>

                            <select
                              name="states"
                              multiple
                              defaultValue={lenderStates}
                              style={multiSelectStyle()}
                              required
                            >
                              {US_STATES.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <button type="submit" style={buttonSecondaryStyle()}>
                              Save Changes
                            </button>
                          </div>
                        </form>

                        <form action="/api/admin/lenders" method="POST">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="id" value={lender.id} />
                          <button type="submit" style={buttonDangerStyle()}>
                            Delete
                          </button>
                        </form>
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
