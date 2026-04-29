// app/handoff/forbidden/page.tsx
//
// Status page shown when a handoff link cannot be opened due to:
//   - Malformed token in URL
//   - Token does not exist
//   - Logged-in user is not active OR has a non-/finley role
//     (e.g. Real Estate Agent forwarded the email by mistake)
//
// Privacy: no borrower information is shown. The page does not
// distinguish between "link invalid" and "you're not authorized" —
// that's intentional, to avoid leaking token-existence to anyone
// fishing for valid links.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HandoffForbiddenPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Beyond Intelligence™</div>
        <h1 style={styles.title}>This link can&apos;t be opened</h1>
        <p style={styles.body}>
          The Professional Mode link you followed is either invalid, no
          longer active, or not available to your account. This experience
          is restricted to licensed mortgage professionals on the
          borrower&apos;s file.
        </p>
        <p style={styles.body}>
          If you&apos;re a real estate agent or other partner, please
          contact the borrower&apos;s loan officer directly for status
          updates — borrower financial details are reviewed only by
          licensed mortgage staff.
        </p>
        <div style={styles.actions}>
          <Link href="/" style={styles.primaryLink}>
            Return to home
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
};

