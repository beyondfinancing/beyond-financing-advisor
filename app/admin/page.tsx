import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn, clearAdminSession } from "@/lib/admin-auth";

function cardStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
    minHeight: 210,
  };
}

export default async function AdminHomePage() {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  async function signOutAction() {
    "use server";
    await clearAdminSession();
    redirect("/admin/login");
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
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 26,
          }}
        >
          <div style={{ maxWidth: 980 }}>
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
              ADMIN CONTROL CENTER
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(42px, 7vw, 64px)",
                lineHeight: 1.05,
              }}
            >
              Beyond Intelligence Admin
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.6,
                fontSize: 16,
                maxWidth: 980,
              }}
            >
              Manage professional users, lenders, programs, file intake, and the
              data structure that powers Finley Beyond.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              paddingTop: 6,
            }}
          >
            <Link
              href="/"
              style={{
                color: "#263366",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to Beyond Intelligence
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                style={{
                  background: "#263366",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 12,
                  padding: "14px 18px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: 18,
          }}
        >
          <Link href="/admin/users" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={cardStyle()}>
              <div
                style={{
                  color: "#0096C7",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.3,
                  marginBottom: 16,
                }}
              >
                ACCESS MANAGEMENT
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Manage Users
              </div>
              <div style={{ color: "#5A6A84", lineHeight: 1.7, fontSize: 15 }}>
                Create, review, edit, and delete loan officers, assistants,
                processors, real estate agents, and future admin roles.
              </div>
            </div>
          </Link>

          <Link href="/admin/lenders" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={cardStyle()}>
              <div
                style={{
                  color: "#0096C7",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.3,
                  marginBottom: 16,
                }}
              >
                LENDER MANAGEMENT
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Manage Lenders
              </div>
              <div style={{ color: "#5A6A84", lineHeight: 1.7, fontSize: 15 }}>
                Maintain lender institutions, channels, state coverage, and the
                foundation used for intake and matching.
              </div>
            </div>
          </Link>

          <Link href="/admin/programs" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={cardStyle()}>
              <div
                style={{
                  color: "#0096C7",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.3,
                  marginBottom: 16,
                }}
              >
                PROGRAM ENGINE
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Manage Programs
              </div>
              <div style={{ color: "#5A6A84", lineHeight: 1.7, fontSize: 15 }}>
                Maintain lender program qualification thresholds, notes, and
                scenario-direction logic.
              </div>
            </div>
          </Link>

          <Link href="/admin/files" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={cardStyle()}>
              <div
                style={{
                  color: "#0096C7",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.3,
                  marginBottom: 16,
                }}
              >
                FILE INTAKE
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Manage Lender Files
              </div>
              <div style={{ color: "#5A6A84", lineHeight: 1.7, fontSize: 15 }}>
                Upload selling guides, pricing sheets, overlays, program
                matrices, and qualification files. The newest upload becomes
                active and the previous one is archived as backup.
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
