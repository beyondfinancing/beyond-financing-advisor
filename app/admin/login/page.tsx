import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";

function cardStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 24,
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

function buttonSecondaryStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    color: "#263366",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdminSignedIn()) {
    redirect("/admin");
  }

  const params = await searchParams;
  const error = params?.error || "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "28px 20px 48px",
        }}
      >
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
          ADMIN ACCESS
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "clamp(34px, 6vw, 54px)",
            lineHeight: 1.15,
          }}
        >
          Beyond Intelligence Admin Login
        </h1>

        <p
          style={{
            margin: "0 0 22px",
            color: "#5A6A84",
            lineHeight: 1.7,
            fontSize: "clamp(16px, 2.3vw, 18px)",
          }}
        >
          This area is restricted to the system administrator. Sign in to manage
          users, lenders, programs, files, and future investor controls.
        </p>

        <div style={cardStyle()}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Administrator Sign In</h2>

          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #D9E1EC",
              borderRadius: 16,
              padding: 16,
              lineHeight: 1.8,
              marginBottom: 18,
              color: "#4B5C78",
            }}
          >
            <div>
              <strong>Authorized admin:</strong> Beyond Intelligence system
              administrator
            </div>
            <div>
              <strong>Protected pages:</strong> /admin, /admin/users,
              /admin/lenders, /admin/programs
            </div>
          </div>

          <form
            action="/api/admin/login"
            method="POST"
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            <input
              type="email"
              name="email"
              placeholder="Admin Email"
              autoComplete="email"
              required
              style={inputStyle()}
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              style={inputStyle()}
            />

            {error ? (
              <div
                style={{
                  marginTop: 4,
                  background: "#FFF4F2",
                  border: "1px solid #F3C5BC",
                  color: "#8A3B2F",
                  borderRadius: 14,
                  padding: 14,
                  lineHeight: 1.6,
                }}
              >
                {error}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 6,
              }}
            >
              <button type="submit" style={buttonPrimaryStyle()}>
                Sign In as Admin
              </button>

              <Link href="/" style={buttonSecondaryStyle()}>
                Back to Beyond Intelligence
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
