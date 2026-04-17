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
    fontSize: 14,
    fontWeight: 700,
    color: "#263366",
    marginBottom: 8,
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    color: "#263366",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

type PageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

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
            gap: 12,
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
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              ADMIN AREA
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 40 }}>Manage Users</h1>
            <p style={{ margin: 0, color: "#5A6A84", lineHeight: 1.7 }}>
              Create and manage professional access under admin control.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/admin" style={secondaryButtonStyle()}>
              Back to Admin
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button type="submit" style={primaryButtonStyle()}>
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {params.success && (
          <div
            style={{
              marginBottom: 18,
              background: "#EEF9F1",
              border: "1px solid #B9E2C2",
              color: "#256B3C",
              borderRadius: 14,
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
              borderRadius: 14,
              padding: 14,
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
              border: "1px solid #F3C5BC",
              color: "#8A3B2F",
              borderRadius: 14,
              padding: 14,
              lineHeight: 1.6,
            }}
          >
            Unable to load users: {error.message}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(340px, 420px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 22 }}>Create User</h2>

            <form action="/api/admin/users" method="POST">
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label htmlFor="name" style={labelStyle()}>
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Example: Warren Wendt"
                    required
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label htmlFor="email" style={labelStyle()}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@beyondfinancing.com"
                    required
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label htmlFor="nmls" style={labelStyle()}>
                    NMLS / Login ID
                  </label>
                  <input
                    id="nmls"
                    name="nmls"
                    type="text"
                    placeholder="1625542 or 2394496BM"
                    required
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label htmlFor="role" style={labelStyle()}>
                    Role
                  </label>
                  <select id="role" name="role" required style={inputStyle()}>
                    <option value="Loan Officer">Loan Officer</option>
                    <option value="Loan Officer Assistant">
                      Loan Officer Assistant
                    </option>
                    <option value="Processor">Processor</option>
                    <option value="Real Estate Agent">
                      Real Estate Agent
                    </option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="password" style={labelStyle()}>
                    Temporary Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="text"
                    placeholder="Create a temporary password"
                    required
                    style={inputStyle()}
                  />
                </div>

                <button type="submit" style={primaryButtonStyle()}>
                  Create User
                </button>
              </div>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 22 }}>Current Users</h2>

            {!users || users.length === 0 ? (
              <div style={{ color: "#70819A", lineHeight: 1.7 }}>
                No users have been created yet.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  border: "1px solid #E1E8F0",
                  borderRadius: 16,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 760,
                    background: "#FFFFFF",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          borderBottom: "1px solid #E1E8F0",
                          fontSize: 14,
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          borderBottom: "1px solid #E1E8F0",
                          fontSize: 14,
                        }}
                      >
                        Email
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          borderBottom: "1px solid #E1E8F0",
                          fontSize: 14,
                        }}
                      >
                        Login ID
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          borderBottom: "1px solid #E1E8F0",
                          fontSize: 14,
                        }}
                      >
                        Role
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          borderBottom: "1px solid #E1E8F0",
                          fontSize: 14,
                        }}
                      >
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user: any) => (
                      <tr key={user.id}>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #EEF2F7",
                          }}
                        >
                          {user.name || "-"}
                        </td>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #EEF2F7",
                          }}
                        >
                          {user.email || "-"}
                        </td>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #EEF2F7",
                          }}
                        >
                          {user.nmls || "-"}
                        </td>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #EEF2F7",
                          }}
                        >
                          {user.role || "-"}
                        </td>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #EEF2F7",
                          }}
                        >
                          {user.created_at
                            ? new Date(user.created_at).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
