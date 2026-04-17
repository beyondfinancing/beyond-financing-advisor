import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  nmls: string | null;
  role: string | null;
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
  };
}

function labelStyle(): CSSProperties {
  return {
    display: "block",
    fontWeight: 700,
    marginBottom: 8,
    color: "#263366",
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

function buttonSecondaryStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    color: "#263366",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function buttonDangerStyle(): CSSProperties {
  return {
    background: "#FFF4F2",
    color: "#8A3B2F",
    border: "1px solid #F3C5BC",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function pillStyle(): CSSProperties {
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
                maxWidth: 900,
              }}
            >
              Create, update, and delete professional access under admin control.
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

            <form
              action="/api/admin/users"
              method="POST"
              style={{ display: "grid", gap: 16 }}
            >
              <input type="hidden" name="_action" value="create" />

              <div>
                <label style={labelStyle()}>Full Name</label>
                <input name="name" required style={inputStyle()} />
              </div>

              <div>
                <label style={labelStyle()}>Email</label>
                <input name="email" type="email" required style={inputStyle()} />
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
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <button type="submit" style={buttonPrimaryStyle()}>
                Create User
              </button>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Current Users</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Total users: <strong>{safeUsers.length}</strong>
            </p>

            {safeUsers.length === 0 ? (
              <div
                style={{
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  padding: 18,
                  background: "#F8FAFC",
                  color: "#5A6A84",
                }}
              >
                No users found.
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
                        gap: 10,
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
                        {user.name || "Unnamed User"}
                      </div>
                      <span style={pillStyle()}>{user.role || "No role"}</span>
                    </div>

                    <form
                      action="/api/admin/users"
                      method="POST"
                      style={{ display: "grid", gap: 14 }}
                    >
                      <input type="hidden" name="_action" value="update" />
                      <input type="hidden" name="id" value={user.id} />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <label style={labelStyle()}>Full Name</label>
                          <input
                            name="name"
                            defaultValue={user.name || ""}
                            required
                            style={inputStyle()}
                          />
                        </div>

                        <div>
                          <label style={labelStyle()}>Email</label>
                          <input
                            name="email"
                            type="email"
                            defaultValue={user.email || ""}
                            required
                            style={inputStyle()}
                          />
                        </div>

                        <div>
                          <label style={labelStyle()}>NMLS / Login ID</label>
                          <input
                            name="nmls"
                            defaultValue={user.nmls || ""}
                            required
                            style={inputStyle()}
                          />
                        </div>

                        <div>
                          <label style={labelStyle()}>Role</label>
                          <select
                            name="role"
                            defaultValue={user.role || "Loan Officer"}
                            required
                            style={inputStyle()}
                          >
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
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(160px, max-content))",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <button type="submit" style={buttonSecondaryStyle()}>
                          Save Changes
                        </button>
                      </div>
                    </form>

                    <form
                      action="/api/admin/users"
                      method="POST"
                      style={{ marginTop: 12 }}
                    >
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="id" value={user.id} />
                      <button
                        type="submit"
                        style={buttonDangerStyle()}
                        onClick={(e) => {
                          if (
                            !confirm(
                              `Delete user "${user.name || "Unnamed User"}"?`
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete User
                      </button>
                    </form>

                    <div
                      style={{
                        marginTop: 12,
                        color: "#5A6A84",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Created:</strong>{" "}
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString()
                        : "-"}
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
