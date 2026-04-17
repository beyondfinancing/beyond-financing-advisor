import Link from "next/link";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f4f6fb",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#263366",
  },
  wrap: {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "40px 24px 56px",
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#e9eef8",
    color: "#263366",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.3,
    marginBottom: 24,
  },
  heroTitle: {
    margin: 0,
    fontSize: 78,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: -2.2,
    maxWidth: 1080,
  },
  heroTitleBlue: {
    color: "#0096C7",
    display: "block",
    marginTop: 10,
  },
  intro: {
    marginTop: 28,
    fontSize: 24,
    lineHeight: 1.45,
    maxWidth: 1180,
    color: "#314b78",
  },
  buttonRow: {
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    marginTop: 28,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 210,
    padding: "18px 24px",
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
    padding: "18px 24px",
    borderRadius: 18,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 700,
    boxShadow: "0 8px 18px rgba(0,150,199,0.18)",
  },
  disclaimer: {
    marginTop: 24,
    maxWidth: 1180,
    fontSize: 15,
    lineHeight: 1.65,
    color: "#5b7097",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 22,
    marginTop: 54,
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2f2",
    borderRadius: 28,
    padding: 26,
    boxShadow: "0 6px 20px rgba(15,23,42,0.03)",
    minHeight: 350,
  },
  cardEyebrow: {
    margin: 0,
    color: "#0096C7",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  cardTitle: {
    marginTop: 18,
    marginBottom: 18,
    fontSize: 38,
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
  responsive: {
    width: "100%",
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

        <div
          style={styles.cardGrid}
          className="bi-card-grid"
        >
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
        @media (max-width: 1200px) {
          .bi-card-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 980px) {
          h1 {
            font-size: 58px !important;
            line-height: 1 !important;
          }
        }

        @media (max-width: 700px) {
          h1 {
            font-size: 42px !important;
            letter-spacing: -1px !important;
          }
        }
      `}</style>
    </main>
  );
}
