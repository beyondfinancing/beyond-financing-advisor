import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type LenderRow = {
  id: string;
  name: string | null;
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
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
    borderRadius: 14,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    background: "#FFFFFF",
    color: "#263366",
  };
}

function multiSelectStyle(height = 120): CSSProperties {
  return {
    ...inputStyle(),
    height,
    padding: 12,
  };
}

function primaryButtonStyle(): CSSProperties {
  return {
    width: "100%",
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 14,
    padding: "16px 18px",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  };
}

function badgeStyle(): CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#E8EEF8",
    color: "#263366",
    fontSize: 12,
    fontWeight: 800,
    marginRight: 8,
    marginBottom: 8,
  };
}

export default async function AdminLendersPage() {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    redirect("/admin/login");
  }

  const { data, error } = await supabaseAdmin
    .from("lenders")
    .select("id, name, channel, states, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const lenders: LenderRow[] = Array.isArray(data) ? (data as LenderRow[]) : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "34px 18px 48px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                background: "#E8EEF8",
                color: "#263366",
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              LENDER MANAGEMENT
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(42px, 7vw, 72px)",
                lineHeight: 1.04,
              }}
            >
              Manage Lenders
            </h1>

            <p
              style={{
                margin: "14px 0 0",
                color: "#52637D",
                lineHeight: 1.55,
                fontSize: 18,
                maxWidth: 980,
              }}
            >
              Create lenders here. Click any lender to open its dedicated detail
              page for editing, deletion, file tracking, and future overlay logic.
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              color: "#263366",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            Back to Admin Home
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 18 }}>
              Create Lender
            </h2>

            <p
              style={{
                marginTop: 0,
                color: "#52637D",
                lineHeight: 1.6,
                fontSize: 16,
              }}
            >
              Use one lender record per institution. Add all active channels under
              that one lender.
            </p>

            <form
              action="/api/admin/lenders"
              method="post"
              style={{ display: "grid", gap: 16 }}
            >
              <div>
                <label
                  htmlFor="name"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 15,
                  }}
                >
                  Lender Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Example: UWM"
                  style={inputStyle()}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="channels"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 15,
                  }}
                >
                  Channels
                </label>
                <select
                  id="channels"
                  name="channels"
                  multiple
                  style={multiSelectStyle(118)}
                  required
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Correspondent">Correspondent</option>
                </select>
                <div
                  style={{
                    marginTop: 8,
                    color: "#6A7A92",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Hold Ctrl on Windows or Command on Mac to select more than one.
                </div>
              </div>

              <div>
                <label
                  htmlFor="ownerOccupiedStates"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 15,
                  }}
                >
                  Owner-Occupied States
                </label>
                <select
                  id="ownerOccupiedStates"
                  name="ownerOccupiedStates"
                  multiple
                  style={multiSelectStyle(220)}
                >
                  {US_STATES.map((state) => (
                    <option key={`oo-${state}`} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="nonOwnerOccupiedStates"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 15,
                  }}
                >
                  Non-Owner-Occupied States
                </label>
                <select
                  id="nonOwnerOccupiedStates"
                  name="nonOwnerOccupiedStates"
                  multiple
                  style={multiSelectStyle(220)}
                >
                  {US_STATES.map((state) => (
                    <option key={`noo-${state}`} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    marginTop: 8,
                    color: "#6A7A92",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  This structure lets the qualification engine distinguish
                  owner-occupied licensing from non-owner-occupied licensing.
                </div>
              </div>

              <button type="submit" style={primaryButtonStyle()}>
                Create Lender
              </button>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>
              Current Lenders
            </h2>

            <div
              style={{
                color: "#6A7A92",
                fontSize: 16,
                marginBottom: 20,
              }}
            >
              Total lenders: {lenders.length}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {lenders.map((lender) => (
                <div
                  key={lender.id}
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 22,
                    padding: 18,
                    background: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 420px" }}>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          lineHeight: 1.35,
                          marginBottom: 10,
                        }}
                      >
                        {lender.name || "Unnamed Lender"}
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        {(lender.channel || []).map((channel) => (
                          <span key={`${lender.id}-${channel}`} style={badgeStyle()}>
                            {channel}
                          </span>
                        ))}
                      </div>

                      <div
                        style={{
                          color: "#5A6A84",
                          fontSize: 16,
                          lineHeight: 1.5,
                        }}
                      >
                        States: {(lender.states || []).length > 0
                          ? lender.states?.join(", ")
                          : "None listed"}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        minWidth: 180,
                      }}
                    >
                      <div
                        style={{
                          color: "#6A7A92",
                          fontSize: 15,
                          marginBottom: 8,
                        }}
                      >
                        {lender.created_at
                          ? new Date(lender.created_at).toLocaleString()
                          : "No date"}
                      </div>

                      <Link
                        href={`/admin/lenders/${lender.id}`}
                        style={{
                          color: "#0096C7",
                          textDecoration: "none",
                          fontWeight: 900,
                          fontSize: 16,
                        }}
                      >
                        Open Lender →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {lenders.length === 0 && (
                <div
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 18,
                    padding: 18,
                    color: "#6A7A92",
                    background: "#FFFFFF",
                  }}
                >
                  No lenders created yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
