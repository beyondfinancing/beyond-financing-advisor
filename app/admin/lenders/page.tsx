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
    borderRadius: 12,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    background: "#FFFFFF",
    color: "#263366",
  };
}

function primaryButtonStyle(): CSSProperties {
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

function pillStyle(): CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#EEF4FF",
    color: "#263366",
    fontSize: 12,
    fontWeight: 700,
    marginRight: 8,
    marginBottom: 8,
  };
}

export default async function AdminLendersPage() {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  async function createLender(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const channels = formData.getAll("channels").map(String);
    const states = formData.getAll("states").map(String);

    if (!name || channels.length === 0 || states.length === 0) {
      redirect("/admin/lenders?error=Please complete lender name, channels, and states.");
    }

    const { error } = await supabaseAdmin.from("lenders").insert({
      name,
      channel: channels.join(", "),
      states,
    });

    if (error) {
      redirect(`/admin/lenders?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/admin/lenders?success=Lender created successfully.");
  }

  const { data: lenders } = await supabaseAdmin
    .from("lenders")
    .select("*")
    .order("created_at", { ascending: false });

  const lenderList: LenderRow[] = lenders || [];

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
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
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
                marginBottom: 12,
              }}
            >
              LENDER MANAGEMENT
            </div>

            <h1
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(34px, 6vw, 58px)",
                lineHeight: 1.08,
              }}
            >
              Manage Lenders
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                fontSize: 18,
                lineHeight: 1.6,
                maxWidth: 920,
              }}
            >
              Create lenders here. Click any lender to open its dedicated detail
              page for editing, deletion, file tracking, and future overlay logic.
            </p>
          </div>

          <div style={{ alignSelf: "flex-start" }}>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create Lender</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Use one lender record per institution. Add all active channels under
              that one lender.
            </p>

            <form action={createLender} style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Lender Name</div>
                <input name="name" style={inputStyle()} placeholder="Example: UWM" />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Channels</div>
                <select name="channels" multiple size={3} style={{ ...inputStyle(), height: 118 }}>
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Correspondent">Correspondent</option>
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>States</div>
                <select name="states" multiple size={10} style={{ ...inputStyle(), height: 230 }}>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" style={primaryButtonStyle()}>
                Create Lender
              </button>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Current Lenders</h2>
            <div style={{ color: "#5A6A84", marginBottom: 16 }}>
              Total lenders: {lenderList.length}
            </div>

            {lenderList.length === 0 ? (
              <div
                style={{
                  border: "1px solid #D9E1EC",
                  background: "#F8FAFC",
                  color: "#6A7890",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                No lenders found yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {lenderList.map((lender) => {
                  const channels = (lender.channel || "")
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);

                  return (
                    <Link
                      key={lender.id}
                      href={`/admin/lenders/${lender.id}`}
                      style={{
                        ...cardStyle(),
                        textDecoration: "none",
                        color: "#263366",
                        padding: 18,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>
                            {lender.name || "Unnamed Lender"}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            {channels.map((channel) => (
                              <span key={channel} style={pillStyle()}>
                                {channel}
                              </span>
                            ))}
                          </div>

                          <div style={{ marginTop: 10, color: "#5A6A84" }}>
                            States: {(lender.states || []).join(", ") || "-"}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#5A6A84" }}>
                            {lender.created_at
                              ? new Date(lender.created_at).toLocaleString()
                              : "-"}
                          </div>
                          <div
                            style={{
                              marginTop: 10,
                              fontWeight: 700,
                              color: "#0096C7",
                            }}
                          >
                            Open Lender →
                          </div>
                        </div>
                      </div>
                    </Link>
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
