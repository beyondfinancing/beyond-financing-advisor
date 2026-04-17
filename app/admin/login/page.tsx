import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdminSignedIn()) {
    redirect("/admin");
  }

  const params = await searchParams;
  const hasError = params.error === "invalid";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#FFFFFF",
          border: "1px solid #D9E1EC",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 16px 40px rgba(38,51,102,0.08)",
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
            marginBottom: 16,
          }}
        >
          ADMIN ACCESS
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(34px, 6vw, 48px)",
            lineHeight: 1.1,
          }}
        >
          Beyond Intelligence Admin
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            color: "#5A6A84",
            lineHeight: 1.7,
            fontSize: 16,
          }}
        >
          Secure administrator login for user management, lender management,
          program management, and future file intake.
        </p>

        <form
          method="POST"
          action="/api/admin/login"
          style={{ display: "grid", gap: 14 }}
        >
          <input
            name="email"
            type="email"
            placeholder="Admin email"
            defaultValue="pansini@beyondfinancing.com"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #C8D3E3",
              fontSize: 16,
              outline: "none",
              boxSizing: "border-box",
            }}
            required
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #C8D3E3",
              fontSize: 16,
              outline: "none",
              boxSizing: "border-box",
            }}
            required
          />

          {hasError && (
            <div
              style={{
                background: "#FFF4F2",
                border: "1px solid #F3C5BC",
                color: "#8A3B2F",
                borderRadius: 14,
                padding: 14,
                lineHeight: 1.6,
              }}
            >
              Invalid admin email or password.
            </div>
          )}

          <button
            type="submit"
            style={{
              background: "#263366",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 12,
              padding: "14px 18px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              marginTop: 6,
            }}
          >
            Sign In as Admin
          </button>
        </form>
      </div>
    </main>
  );
}
