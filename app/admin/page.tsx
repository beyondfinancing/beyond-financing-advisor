import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminEmail, isAdminSignedIn } from "@/lib/admin-auth";

function cardStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

export default async function AdminDashboardPage() {
  if (!(await isAdminSignedIn())) {
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
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 24,
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
              ADMIN DASHBOARD
            </div>

            <h1
              style={{
                margin: "0 0 8px",
                fontSize: "clamp(34px, 6vw, 54px)",
                lineHeight: 1.1,
              }}
            >
              Beyond Intelligence Control Center
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 17,
                maxWidth: 920,
              }}
            >
              Secure administration area for users, lenders, programs, and the
              next file-intake layer for selling guides, pricing sheets,
              overlays, matrices, and qualification support files.
            </p>

            <div
              style={{
                marginTop: 14,
                color: "#5A6A84",
                fontSize: 14,
              }}
            >
              Signed in as <strong>{getAdminEmail()}</strong>
            </div>
          </div>

          <form method="POST" action="/api/admin/logout">
            <button
              type="submit"
              style={{
                background: "#FFFFFF",
                color: "#263366",
                border: "1px solid #263366",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </form>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <div style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Manage Users</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Create and manage loan officers, assistants, processors, and agent
              access under admin control only.
            </p>
            <Link
              href="/admin/users"
              style={{ color: "#0096C7", fontWeight: 700, textDecoration: "none" }}
            >
              Open Users →
            </Link>
          </div>

          <div style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Manage Lenders</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Add lender relationships, channels, and licensed states in a clean
              structured format.
            </p>
            <Link
              href="/admin/lenders"
              style={{ color: "#0096C7", fontWeight: 700, textDecoration: "none" }}
            >
              Open Lenders →
            </Link>
          </div>

          <div style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Manage Programs</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Add lender programs with minimum credit, max LTV, max DTI,
              occupancy, and notes for matching.
            </p>
            <Link
              href="/admin/programs"
              style={{ color: "#0096C7", fontWeight: 700, textDecoration: "none" }}
            >
              Open Programs →
            </Link>
          </div>

          <div style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Phase 2 File Intake</h2>
            <p style={{ color: "#5A6A84", lineHeight: 1.7 }}>
              Next, we will add file upload and classification for selling
              guides, pricing sheets, overlays, program matrices, and other
              lender documents.
            </p>
            <div style={{ color: "#263366", fontWeight: 700 }}>
              Coming in the next script set
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
