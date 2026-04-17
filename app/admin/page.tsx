import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSignedIn, clearAdminSession } from "@/lib/admin-auth";

function cardStyle() {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
    textDecoration: "none",
    color: "#263366",
    display: "block",
  } as const;
}

async function signOutAction() {
  "use server";
  await clearAdminSession();
  redirect("/admin/login");
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
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 28 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "#E8EEF8",
                color: "#263366",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              ADMIN CONTROL CENTER
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(40px, 7vw, 64px)" }}>
              Beyond Intelligence Admin
            </h1>
            <p
              style={{
                maxWidth: 900,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 18,
              }}
            >
              Manage professional users, lenders, programs, file intake, and the future
              data structure that powers Finley Beyond.
            </p>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
                alignSelf: "center",
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
                  borderRadius: 14,
                  padding: "14px 18px",
                  fontWeight: 800,
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
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          <Link href="/admin/users" style={cardStyle()}>
            <div style={{ color: "#0096C7", fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
              ACCESS MANAGEMENT
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Manage Users
            </div>
            <div style={{ color: "#5A6A84", lineHeight: 1.8 }}>
              Create, review, and organize loan officers, assistants, processors,
              real estate agents, and future admin roles.
            </div>
          </Link>

          <Link href="/admin/lenders" style={cardStyle()}>
            <div style={{ color: "#0096C7", fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
              LENDER MANAGEMENT
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Manage Lenders
            </div>
            <div style={{ color: "#5A6A84", lineHeight: 1.8 }}>
              Add lender records, channels, state coverage, and prepare the structure
              for selling guides, pricing, overlays, and related files.
            </div>
          </Link>

          <Link href="/admin/programs" style={cardStyle()}>
            <div style={{ color: "#0096C7", fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
              PROGRAM ENGINE
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Manage Programs
            </div>
            <div style={{ color: "#5A6A84", lineHeight: 1.8 }}>
              Maintain lender-specific programs, qualification thresholds,
              occupancy rules, notes, and scenario-direction logic.
            </div>
          </Link>

          <Link href="/admin/guidelines" style={cardStyle()}>
            <div style={{ color: "#0096C7", fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
              GLOBAL LIBRARY
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Global Guidelines
            </div>
            <div style={{ color: "#5A6A84", lineHeight: 1.8 }}>
              Store shared Fannie Mae, Freddie Mac, FHA, VA, USDA, Jumbo, and Non-QM
              baseline rules once for reuse across the platform.
            </div>
          </Link>

          <Link href="/admin/overlays" style={cardStyle()}>
            <div style={{ color: "#0096C7", fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
              OVERLAY ENGINE
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Lender Overlays
            </div>
            <div style={{ color: "#5A6A84", lineHeight: 1.8 }}>
              Record lender-specific restrictions that override or tighten shared
              global rules for scenario matching.
            </div>
          </Link>

          <Link href="/admin/files" style={cardStyle()}>
            <div style={{ color: "#0096C7", fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
              FILE INTAKE
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
              Manage Lender Files
            </div>
            <div style={{ color: "#5A6A84", lineHeight: 1.8 }}>
              Upload selling guides, pricing sheets, overlays, matrices, and other
              lender documents while preserving archived backups.
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
