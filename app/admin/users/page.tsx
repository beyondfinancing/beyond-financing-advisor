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

function badgeStyle(role: string): React.CSSProperties {
  const isOfficer = role === "Loan Officer";
  const isAssistant = role === "Loan Officer Assistant";
  const isProcessor = role === "Processor";
  const isAgent = role === "Real Estate Agent";

  let background = "#E8EEF8";
  let color = "#263366";

  if (isOfficer) {
    background = "#E8EEF8";
    color = "#263366";
  } else if (isAssistant) {
    background = "#E6F7FF";
    color = "#0B6E99";
  } else if (isProcessor) {
    background = "#EEF8EA";
    color = "#2E6B2E";
  } else if (isAgent) {
    background = "#FFF3E8";
    color = "#9A5A12";
  }

  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background,
    color,
  };
}

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  nmls: string | null;
  role: string | null;
  created_at: string | null;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  const safeUsers = (users || []) as UserRow[];

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
              ACCESS MANAGEMENT
            </div>

            <h1
              style={{
                margin: "0 0 8px",
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1.1,
              }}
            >
              Manage Users
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 17,
                maxWidth: 860,
              }}
            >
              Create and manage professional access under admin control. This
              page is now restricted to the Beyond Intelligence administrator.
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
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Create User</h2>

            <p
              style={{
                marginTop: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
              }}
            >
              Create loan officers, loan officer assistants, processors, and
              real estate agents from the admin workspace only.
            </p>

            <form
              action="/api/admin/users"
              method="POST"
              style={{ display: "grid", gap: 16 }}
            >
              <div>
                <label style={labelStyle()}>Full Name</label>
                <input name="name" required style={inputStyle()} />
              </div>

              <div>
                <label style={labelStyle()}>Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  style={inputStyle()}
                />
              </div>

              <div>
                <label style={labelStyle()}>NMLS / Login ID</label>
                <input
                  name="nmls"
                  required
                  style={inputStyle()}
                  placeholder="Example: 1625542 or 2394496BM"
                />
              </div>

              <div>
                <label style={labelStyle()}>Role</label>
                <select name="role" required style={inputStyle()}>
                  <option value="Loan Officer">Loan Officer</option>
                  <option value="Loan Officer Assistant">
                    Loan Officer Assistant
                  </option>
                  <option value="Processor">Processor</option>
                  <option value="Real Estate Agent">Real Estate Agent</option>
                </select>
              </div>

              <button type="submit" style={buttonPrimaryStyle()}>
                Create User
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
                <h2 style={{ margin: 0, fontSize: 24 }}>Current Users</h2>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#5A6A84",
                    lineHeight: 1.7,
                  }}
                >
                  Total users: <strong>{safeUsers.length}</strong>
                </p>
              </div>
            </div>

            {safeUsers.length === 0 ? (
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
                No professional users have been created yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {safeUsers.map((user) => (
                  <div
                    key={user.id}
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
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>
                          {user.name || "Unnamed User"}
                        </div>
                        <div
                          style={{
                            color: "#5A6A84",
                            marginTop: 6,
                            lineHeight: 1.7,
                          }}
                        >
                          {user.email || "No email"}
                        </div>
                      </div>

                      <div>{user.role ? <span style={badgeStyle(user.role)}>{user.role}</span> : null}</div>
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
                        <strong>NMLS / Login ID:</strong>
                        <br />
                        {user.nmls || "-"}
                      </div>

                      <div>
                        <strong>Created:</strong>
                        <br />
                        {user.created_at
                          ? new Date(user.created_at).toLocaleString()
                          : "-"}
                      </div>
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
