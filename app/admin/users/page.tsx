import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  nmls: string | null;
  created_at: string | null;
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  const users: UserRow[] = error || !Array.isArray(data) ? [] : (data as UserRow[]);

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
          <div style={{ maxWidth: 920 }}>
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
              ACCESS MANAGEMENT
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(40px, 7vw, 58px)",
                lineHeight: 1.05,
              }}
            >
              Manage Users
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
              Create, edit, and delete professional access under admin control.
              This page is restricted to the Beyond Intelligence administrator.
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
            gridTemplateColumns: "minmax(360px, 420px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create User</h2>

            <p
              style={{
                marginTop: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              Create loan officers, loan officer assistants, processors, real
              estate agents, and future admin users from the admin workspace
              only.
            </p>

            <form action="/api/admin/users" method="POST">
              <input type="hidden" name="action" value="create" />

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Full Name
                  </label>
                  <input type="text" name="name" required style={inputStyle()} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Email
                  </label>
                  <input type="email" name="email" required style={inputStyle()} />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    NMLS / Login ID
                  </label>
                  <input
                    type="text"
                    name="nmls"
                    required
                    style={inputStyle()}
                    placeholder="Example: 1625542 or 2394496BM"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Role
                  </label>
                  <select name="role" required style={inputStyle()}>
                    <option value="Loan Officer">Loan Officer</option>
                    <option value="Loan Officer Assistant">Loan Officer Assistant</option>
                    <option value="Processor">Processor</option>
                    <option value="Real Estate Agent">Real Estate Agent</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <button type="submit" style={buttonPrimaryStyle()}>
                  Create User
                </button>
              </div>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Current Users</h2>

            <div
              style={{
                color: "#5A6A84",
                marginBottom: 18,
                fontSize: 14,
              }}
            >
              Total users: {users.length}
            </div>

            {users.length === 0 ? (
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
                No users have been added yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {users.map((user) => (
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
                            marginBottom: 8,
                          }}
                        >
                          {user.name || "Unnamed user"}
                        </div>

                        <div
                          style={{
                            color: "#4B5C78",
                            lineHeight: 1.7,
                            marginBottom: 10,
                          }}
                        >
                          {user.email || "—"}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 12,
                            color: "#4B5C78",
                            lineHeight: 1.7,
                          }}
                        >
                          <div>
                            <strong style={{ color: "#263366" }}>NMLS / Login ID:</strong>
                            <br />
                            {user.nmls || "—"}
                          </div>
                          <div>
                            <strong style={{ color: "#263366" }}>Created:</strong>
                            <br />
                            {formatDate(user.created_at)}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          alignItems: "flex-end",
                          minWidth: 180,
                        }}
                      >
                        <span style={badgeStyle()}>{user.role || "No role"}</span>
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
                      <form action="/api/admin/users" method="POST">
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="id" value={user.id} />

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 12,
                          }}
                        >
                          <input
                            type="text"
                            name="name"
                            defaultValue={user.name || ""}
                            style={inputStyle()}
                            placeholder="Full Name"
                            required
                          />
                          <input
                            type="email"
                            name="email"
                            defaultValue={user.email || ""}
                            style={inputStyle()}
                            placeholder="Email"
                            required
                          />
                          <input
                            type="text"
                            name="nmls"
                            defaultValue={user.nmls || ""}
                            style={inputStyle()}
                            placeholder="NMLS / Login ID"
                            required
                          />
                          <select
                            name="role"
                            defaultValue={user.role || "Loan Officer"}
                            style={inputStyle()}
                            required
                          >
                            <option value="Loan Officer">Loan Officer</option>
                            <option value="Loan Officer Assistant">
                              Loan Officer Assistant
                            </option>
                            <option value="Processor">Processor</option>
                            <option value="Real Estate Agent">Real Estate Agent</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <button type="submit" style={buttonSecondaryStyle()}>
                            Save Changes
                          </button>
                        </div>
                      </form>

                      <form
                        action="/api/admin/users"
                        method="POST"
                        onSubmit={undefined}
                      >
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={user.id} />
                        <button
                          type="submit"
                          style={buttonDangerStyle()}
                          formAction="/api/admin/users"
                        >
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
