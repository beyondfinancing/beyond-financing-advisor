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
    background: "#C0392B",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .single<UserRow>();

  if (!user) {
    notFound();
  }

  async function updateUser(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const nmls = String(formData.get("nmls") || "").trim();
    const role = String(formData.get("role") || "").trim();

    const { error } = await supabaseAdmin
      .from("users")
      .update({ name, email, nmls, role })
      .eq("id", id);

    if (error) {
      redirect(`/admin/users/${id}?error=${encodeURIComponent(error.message)}`);
    }

    redirect(`/admin/users/${id}?success=User updated successfully.`);
  }

  async function deleteUser() {
    "use server";

    const { error } = await supabaseAdmin.from("users").delete().eq("id", id);

    if (error) {
      redirect(`/admin/users/${id}?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/admin/users?success=User deleted successfully.");
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
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
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
                margin: "0 0 10px",
                fontSize: "clamp(32px, 5vw, 52px)",
                lineHeight: 1.1,
              }}
            >
              {user.name || "Unnamed User"}
            </h1>

            <p style={{ margin: 0, color: "#5A6A84", fontSize: 18 }}>
              Edit this user record or remove it from the system.
            </p>
          </div>

          <div style={{ alignSelf: "flex-start" }}>
            <Link
              href="/admin/users"
              style={{
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
              }}
            >
              ← Back to Users
            </Link>
          </div>
        </div>

        <section style={cardStyle()}>
          <form action={updateUser} style={{ display: "grid", gap: 16 }}>
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
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Role</div>
              <select name="role" defaultValue={user.role || ""} style={inputStyle()}>
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
                gap: 12,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              <button type="submit" style={primaryButtonStyle()}>
                Save Changes
              </button>
            </div>
          </form>

          <form action={deleteUser} style={{ marginTop: 18 }}>
            <button type="submit" style={dangerButtonStyle()}>
              Delete User
            </button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid #E0E7F0",
              color: "#6A7890",
            }}
          >
            Created:{" "}
            {user.created_at ? new Date(user.created_at).toLocaleString() : "-"}
          </div>
        </section>
      </div>
    </main>
  );
}
