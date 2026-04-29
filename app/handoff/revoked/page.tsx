// app/handoff/revoked/page.tsx
//
// Status page shown when a handoff token has been administratively
// revoked (revoked_at is set). The intake session remains, but this
// specific link will never work again. A fresh token would have to
// be issued through normal channels.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HandoffRevokedPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Beyond Intelligence™</div>
        <h1 style={styles.title}>This link has been revoked</h1>
        <p style={styles.body}>
          The Professional Mode link you followed has been disabled by
          an administrator. The borrower&apos;s intake session itself
          is unaffected — you can still find this file from /finley or
          your workflow workspace.
        </p>
        <p style={styles.body}>
          If you believe this is in error, contact the file&apos;s
          Branch Manager or Production Manager to have a fresh handoff
          link issued.
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

