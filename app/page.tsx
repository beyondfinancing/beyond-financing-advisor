import Link from "next/link";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f4f6fb",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#263366",
  },
  wrap: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "28px 20px 48px",
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#e9eef8",
    color: "#263366",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(44px, 7vw, 86px)",
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: -2,
    maxWidth: 1120,
  },
  heroTitleBlue: {
    color: "#0096C7",
    display: "block",
    marginTop: 10,
  },
  intro: {
    marginTop: 24,
    fontSize: "clamp(18px, 2vw, 24px)",
    lineHeight: 1.45,
    maxWidth: 1140,
    color: "#314b78",
  },
  buttonRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 24,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 210,
    padding: "17px 24px",
    borderRadius: 18,
    backgroundColor: "#263366",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 700,
    boxShadow: "0 8px 18px rgba(38,51,102,0.15)",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 240,
    padding: "17px 24px",
    borderRadius: 18,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 700,
    boxShadow: "0 8px 18px rgba(0,150,199,0.18)",
  },
  disclaimer: {
    marginTop: 20,
    maxWidth: 1160,
    fontSize: 15,
    lineHeight: 1.65,
    color: "#5b7097",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 20,
    marginTop: 42,
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2f2",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 6px 20px rgba(15,23,42,0.03)",
    minHeight: 320,
  },
  cardEyebrow: {
    margin: 0,
    color: "#0096C7",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cardTitle: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: "clamp(28px, 2.7vw, 38px)",
    lineHeight: 1.15,
    fontWeight: 500,
    color: "#263366",
  },
  cardText: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.65,
    color: "#435b83",
  },
};

export default function HomePage() {
  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.badge}>BEYOND INTELLIGENCE™</div>

        <h1 style={styles.heroTitle}>
          AI-Powered Mortgage
          <br />
          Decision Support
          <span style={styles.heroTitleBlue}>
            for Borrowers and Mortgage
            <br />
            Professionals
          </span>
        </h1>

        <p style={styles.intro}>
          Beyond Intelligence helps borrowers prepare for mortgage review and
          helps loan officers, loan officer assistants, and processors sharpen
          program direction, identify missing information, and move files
          forward with greater structure and speed.
        </p>

        <div style={styles.buttonRow}>
          <Link href="/finley" style={styles.primaryButton}>
            Start as Borrower
          </Link>

          <Link href="/finley?mode=team" style={styles.secondaryButton}>
            Enter Team Workspace
          </Link>
        </div>

        <p style={styles.disclaimer}>
          Beyond Intelligence provides preliminary decision support only. All
          scenarios remain subject to licensed loan officer review, investor and
          agency guidelines, full documentation, verification, underwriting,
          appraisal, title, and program requirements.
        </p>

        <div style={styles.cardGrid} className="bi-card-grid">
          <section style={styles.card}>
            <p style={styles.cardEyebrow}>CLIENT / BORROWER</p>
            <h2 style={styles.cardTitle}>
              Prepare before you
              <br />
              speak with your loan
              <br />
              officer
            </h2>
            <p style={styles.cardText}>
              Finley Beyond gathers intake details, target property scenario,
              loan purpose, current state, move-to state, optional Realtor
              information, and follow-up questions so the loan officer begins
              with a stronger picture of the file.
            </p>
          </section>

          <section style={styles.card}>
            <p style={styles.cardEyebrow}>LOAN OFFICER TEAM</p>
            <h2 style={styles.cardTitle}>
              Collaborate with Finley
              <br />
              Beyond on program
              <br />
              direction
            </h2>
            <p style={styles.cardText}>
              Loan officers, assistants, and processors can test scenarios,
              narrow possible program paths, discuss borrower structure with
              Finley Beyond, and receive an emailed summary of the professional
              conversation.
            </p>
          </section>

          <section style={styles.card}>
            <p style={styles.cardEyebrow}>GROWTH ENGINE</p>
            <h2 style={styles.cardTitle}>
              Built for Institutional-
              <br />
              Grade Mortgage
              <br />
              Decision Support
            </h2>
            <p style={styles.cardText}>
              As Beyond Intelligence expands through agency guidance, investor
              overlays, niche loan products, and real-world workflow
              intelligence, it evolves into a more powerful decision-support
              platform for borrowers, loan officers, assistants, processors, and
              scalable mortgage operations.
            </p>
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .bi-card-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          .bi-card-grid {
            gap: 16px !important;
          }
        }
      `}</style>
    </main>
  );
}
