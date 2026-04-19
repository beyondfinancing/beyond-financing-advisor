import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

function secondaryButtonStyle(): CSSProperties {
  return {
    background: "#0096C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function dangerButtonStyle(): CSSProperties {
  return {
    background: "#D9412E",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
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

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const successMessage = Array.isArray(resolvedSearchParams.success)
    ? resolvedSearchParams.success[0]
    : resolvedSearchParams.success;

  const errorMessage = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;

  async function updateUser(formData: FormData) {
    "use server";

    const userId = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const nmls = String(formData.get("nmls") || "").trim();
    const role = String(formData.get("role") || "").trim();
    const companyName = String(formData.get("company_name") || "").trim();

    if (!userId || !name || !email || !nmls || !role || !companyName) {
      redirect(
        `/admin/users/${encodeURIComponent(
          userId || id
        )}?error=Please complete all user fields, including Company Name.`
      );
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        name,
        email,
        nmls,
        role,
        company_name: companyName,
      })
      .eq("id", userId);

    if (error) {
      redirect(
        `/admin/users/${encodeURIComponent(userId)}?error=${encodeURIComponent(
          error.message
        )}`
      );
    }

    redirect(
      `/admin/users/${encodeURIComponent(
        userId
      )}?success=User updated successfully.`
    );
  }

  async function deleteUser(formData: FormData) {
    "use server";

    const userId = String(formData.get("id") || "").trim();

    if (!userId) {
      redirect("/admin/users?error=User ID was missing.");
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", userId);

    if (error) {
      redirect(
        `/admin/users/${encodeURIComponent(userId)}?error=${encodeURIComponent(
          error.message
        )}`
      );
    }

    redirect("/admin/users?success=User deleted successfully.");
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .single<UserRow>();

  if (error || !user) {
    notFound();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
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
              USER DETAIL
            </div>

            <h1
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(34px, 6vw, 58px)",
                lineHeight: 1.08,
              }}
            >
              {user.name || "Unnamed User"}
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              Edit this user record or remove it from the system.
            </p>
          </div>

          <div style={{ alignSelf: "flex-start" }}>
            <Link
              href="/admin/users"
              style={{
                color: "#263366",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ← Back to Users
            </Link>
          </div>
        </div>

        {successMessage ? (
          <div style={alertStyle(true)}>{successMessage}</div>
        ) : null}

        {errorMessage ? (
          <div style={alertStyle(false)}>{errorMessage}</div>
        ) : null}

        <section style={cardStyle()}>
          <form action={updateUser} style={{ display: "grid", gap: 18 }}>
            <input type="hidden" name="id" value={user.id} />

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Full Name</div>
              <input
                name="name"
                defaultValue={user.name || ""}
                style={inputStyle()}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Email</div>
              <input
                name="email"
                type="email"
                defaultValue={user.email || ""}
                style={inputStyle()}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                NMLS / Login ID
              </div>
              <input
                name="nmls"
                defaultValue={user.nmls || ""}
                style={inputStyle()}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Company Name
              </div>
              <input
                name="company_name"
                defaultValue={user.company_name || ""}
                style={inputStyle()}
                placeholder="Example: Beyond Financing, Inc."
              />
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Role</div>
              <select
                name="role"
                defaultValue={user.role || "Loan Officer"}
                style={inputStyle()}
              >
                <option>Loan Officer</option>
                <option>Loan Officer Assistant</option>
                <option>Processor</option>
                <option>Real Estate Agent</option>
                <option>Admin</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button type="submit" style={secondaryButtonStyle()}>
                Save Changes
              </button>
            </div>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid #D9E1EC",
            }}
          >
            <form action={deleteUser}>
              <input type="hidden" name="id" value={user.id} />
              <button type="submit" style={dangerButtonStyle()}>
                Delete User
              </button>
            </form>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid #D9E1EC",
              color: "#6A7890",
              lineHeight: 1.8,
            }}
          >
            <div>
              Created:{" "}
              {user.created_at
                ? new Date(user.created_at).toLocaleString()
                : "-"}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
