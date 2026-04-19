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
  company_name: string | null;
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
  };
}

function alertStyle(success = true): CSSProperties {
  return {
    border: success ? "1px solid #BADBCC" : "1px solid #F3C5BC",
    background: success ? "#F0FFF4" : "#FFF4F2",
    color: success ? "#0F5132" : "#8A3B2F",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const successMessage = Array.isArray(resolvedSearchParams.success)
    ? resolvedSearchParams.success[0]
    : resolvedSearchParams.success;
  const errorMessage = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;

  async function createUser(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const nmls = String(formData.get("nmls") || "").trim();
    const role = String(formData.get("role") || "").trim();
    const companyName = String(formData.get("company_name") || "").trim();

    if (!name || !email || !nmls || !role || !companyName) {
      redirect("/admin/users?error=Please complete all user fields, including Company Name.");
    }

    const { error } = await supabaseAdmin.from("users").insert({
      name,
      email,
      nmls,
      role,
      company_name: companyName,
    });

    if (error) {
      redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/admin/users?success=User created successfully.");
  }

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  const userList: UserRow[] = users || [];

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
              ACCESS MANAGEMENT
            </div>

            <h1
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(34px, 6vw, 58px)",
                lineHeight: 1.08,
              }}
            >
              Manage Users
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                fontSize: 18,
                lineHeight: 1.6,
                maxWidth: 900,
              }}
            >
              Create professional users here. Click any existing user to open that
              user’s dedicated detail page for editing or deletion.
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

        {successMessage ? (
          <div style={alertStyle(true)}>{successMessage}</div>
        ) : null}

        {errorMessage ? (
          <div style={alertStyle(false)}>{errorMessage}</div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create User</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Add new loan officers, assistants, processors, agents, and future
              admin users from here.
            </p>

            <form action={createUser} style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Full Name</div>
                <input name="name" style={inputStyle()} />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Email</div>
                <input name="email" type="email" style={inputStyle()} />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  NMLS / Login ID
                </div>
                <input
                  name="nmls"
                  style={inputStyle()}
                  placeholder="Example: 1625542 or 2394496BM"
                />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Company Name</div>
                <input
                  name="company_name"
                  style={inputStyle()}
                  placeholder="Example: Beyond Financing, Inc."
                  defaultValue="Beyond Financing, Inc."
                />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Role</div>
                <select name="role" style={inputStyle()}>
                  <option>Loan Officer</option>
                  <option>Loan Officer Assistant</option>
                  <option>Processor</option>
                  <option>Real Estate Agent</option>
                  <option>Admin</option>
                </select>
              </div>

              <button type="submit" style={primaryButtonStyle()}>
                Create User
              </button>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Current Users</h2>
            <div style={{ color: "#5A6A84", marginBottom: 16 }}>
              Total users: {userList.length}
            </div>

            {error ? (
              <div
                style={{
                  border: "1px solid #F3C5BC",
                  background: "#FFF4F2",
                  color: "#8A3B2F",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                {error.message}
              </div>
            ) : userList.length === 0 ? (
              <div
                style={{
                  border: "1px solid #D9E1EC",
                  background: "#F8FAFC",
                  color: "#6A7890",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                No users found yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {userList.map((user) => (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
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
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                          {user.name || "Unnamed User"}
                        </div>
                        <div style={{ marginTop: 8, color: "#5A6A84" }}>
                          {user.email || "No email"}
                        </div>
                        <div style={{ marginTop: 8, color: "#5A6A84" }}>
                          NMLS / Login ID: {user.nmls || "-"}
                        </div>
                        <div style={{ marginTop: 8, color: "#5A6A84" }}>
                          Company Name: {user.company_name || "-"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={pillStyle()}>{user.role || "Unknown"}</div>
                        <div style={{ marginTop: 10, color: "#5A6A84" }}>
                          {user.created_at
                            ? new Date(user.created_at).toLocaleString()
                            : "-"}
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            fontWeight: 700,
                            color: "#0096C7",
                          }}
                        >
                          Open User →
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
