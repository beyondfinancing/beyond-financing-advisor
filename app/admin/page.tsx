import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";

function cardStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function actionCardStyle(): React.CSSProperties {
  return {
    ...cardStyle(),
    textDecoration: "none",
    color: "#263366",
    display: "block",
    minHeight: 180,
  };
}

function buttonStyle(): React.CSSProperties {
  return {
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default async function AdminHomePage() {
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
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
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
              ADMIN CONTROL CENTER
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(34px, 6vw, 54px)",
                lineHeight: 1.1,
              }}
            >
              Beyond Intelligence Admin
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 18,
                maxWidth: 900,
              }}
            >
              Manage professional users, lenders, programs, file intake, and the
              future data structure that powers Finley Beyond.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
              }}
            >
              Back to Beyond Intelligence
            </Link>

            <form action="/api/admin/logout" method="POST">
              <button type="submit" style={buttonStyle()}>
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <Link href="/admin/users" style={actionCardStyle()}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              ACCESS MANAGEMENT
            </div>
            <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>Manage Users</h2>
            <p style={{ margin: 0, color: "#5A6A84", lineHeight: 1.7 }}>
              Create, review, and organize loan officers, assistants,
              processors, real estate agents, and future admin roles.
            </p>
          </Link>

          <Link href="/admin/lenders" style={actionCardStyle()}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              LENDER MANAGEMENT
            </div>
            <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>Manage Lenders</h2>
            <p style={{ margin: 0, color: "#5A6A84", lineHeight: 1.7 }}>
              Add lender records, channels, state coverage, and prepare the
              structure for selling guides, pricing, overlays, and related files.
            </p>
          </Link>

          <Link href="/admin/programs" style={actionCardStyle()}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              PROGRAM ENGINE
            </div>
            <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>
              Manage Programs
            </h2>
            <p style={{ margin: 0, color: "#5A6A84", lineHeight: 1.7 }}>
              Maintain lender programs, qualification thresholds, occupancy
              rules, notes, and the matching engine that supports scenario
              direction.
            </p>
          </Link>

          <div style={cardStyle()}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              NEXT UPGRADE
            </div>
            <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>File Intake</h2>
            <p style={{ margin: 0, color: "#5A6A84", lineHeight: 1.7 }}>
              Next we will add structured lender file upload support for selling
              guides, pricing sheets, overlays, program matrices, and other
              qualification documents.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
