// app/handoff/expired/page.tsx
//
// Status page shown when a handoff link's expires_at has passed.
// Tokens default to a 14-day lifetime. The borrower's intake session
// itself is preserved — the LO can still access it from inside /finley
// or have a fresh handoff token issued on the next chat-summary email.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HandoffExpiredPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Beyond Intelligence™</div>
        <h1 style={styles.title}>This link has expired</h1>
        <p style={styles.body}>
          Professional Mode handoff links are valid for 14 days from
          when they were issued. The borrower&apos;s intake session is
          still preserved on the file — you can find it from your
          workflow file in /finley, or a fresh link will be included
          in the next conversation summary email if the borrower
          continues to engage.
        </p>
        <div style={styles.actions}>
          <Link href="/finley" style={styles.primaryLink}>
            Go to /finley
          </Link>
          <Link href="/team" style={styles.secondaryLink}>
            Return to team workspace
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)",
    padding: "24px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  card: {
    maxWidth: "520px",
    width: "100%",
    background: "#ffffff",
    border: "1px solid #d9e1ec",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 4px 24px rgba(36, 63, 124, 0.08)",
  },
  badge: {
    display: "inline-block",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: "#0096C7",
    textTransform: "uppercase",
    marginBottom: "12px",
  },
  title: {
    margin: "0 0 16px 0",
    color: "#243F7C",
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.3,
  },
  body: {
    margin: "0 0 14px 0",
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  actions: {
    marginTop: "24px",
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryLink: {
    display: "inline-block",
    background: "#0096C7",
    color: "#ffffff",
    textDecoration: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "14px",
  },
  secondaryLink: {
    display: "inline-block",
    background: "transparent",
    color: "#243F7C",
    textDecoration: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "14px",
    border: "1px solid #243F7C",
  },
};

