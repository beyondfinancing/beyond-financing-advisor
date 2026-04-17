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

function parseChannels(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  channel: string | null;
  states: string[] | null;
  created_at: string | null;
};

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

  const safeLenders = (lenders || []) as LenderRow[];

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
              LENDER MANAGEMENT
            </div>

            <h1
              style={{
                margin: "0 0 8px",
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1.1,
              }}
            >
              Manage Lenders
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
              Create and organize lender records, available channels, and state
              coverage. Use one lender record per lender, and list all channels
              that apply to that lender inside the same record.
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
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Create Lender</h2>

            <p
              style={{
                marginTop: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
              }}
            >
              Keep one lender record per institution. If that lender is
              available in more than one channel, enter all applicable channels
              in the same record.
            </p>

            <form
              action="/api/lenders"
              method="POST"
              style={{ display: "grid", gap: 16 }}
            >
              <div>
                <label style={labelStyle()}>Lender Name</label>
                <input name="name" required style={inputStyle()} />
              </div>

              <div>
                <label style={labelStyle()}>
                  Channels
                </label>
                <select name="channel" required multiple style={{ ...inputStyle(), minHeight: 130 }}>
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Correspondent">Correspondent</option>
                </select>
                <div
                  style={{
                    marginTop: 8,
                    color: "#70819A",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Hold Ctrl on Windows or Command on Mac to select more than one.
                </div>
              </div>

              <div>
                <label style={labelStyle()}>
                  States
                </label>
                <input
                  name="states"
                  required
                  style={inputStyle()}
                  placeholder="Example: MA, NH, RI, CT, FL"
                />
              </div>

              <button type="submit" style={buttonPrimaryStyle()}>
                Create Lender
              </button>
            </form>
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
                <h2 style={{ margin: 0, fontSize: 24 }}>Current Lenders</h2>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#5A6A84",
                    lineHeight: 1.7,
                  }}
                >
                  Total lenders: <strong>{safeLenders.length}</strong>
                </p>
              </div>
            </div>

            {safeLenders.length === 0 ? (
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
                No lenders have been created yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {safeLenders.map((lender) => {
                  const channels = parseChannels(lender.channel);
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
                          flexWrap: "wrap",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 800 }}>
                            {lender.name || "Unnamed Lender"}
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {channels.length > 0 ? (
                              channels.map((channel) => (
                                <span key={channel} style={pillStyle()}>
                                  {channel}
                                </span>
                              ))
                            ) : (
                              <span style={pillStyle()}>No channel</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
                          color: "#4B5C78",
                          lineHeight: 1.7,
                        }}
                      >
                        <div>
                          <strong>States:</strong>
                          <br />
                          {lender.states?.length ? lender.states.join(", ") : "-"}
                        </div>

                        <div>
                          <strong>Created:</strong>
                          <br />
                          {lender.created_at
                            ? new Date(lender.created_at).toLocaleString()
                            : "-"}
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
