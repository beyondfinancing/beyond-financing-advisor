"use client";

import React from "react";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, #f8fbff 0%, #f3f6fb 45%, #eef2f7 100%)",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 18px 48px",
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  brand: {
    textDecoration: "none",
    color: "#263366",
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 0.2,
  },
  navLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  navLink: {
    textDecoration: "none",
    color: "#263366",
    backgroundColor: "#F7F9FD",
    border: "1px solid #C9D5EA",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 30,
    color: "#ffffff",
    boxShadow: "0 18px 40px rgba(38,51,102,0.18)",
    marginBottom: 22,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 22,
    alignItems: "start",
  },
  badge: {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: 58,
    lineHeight: 0.96,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 22,
    marginBottom: 0,
    maxWidth: 840,
    fontSize: 17,
    lineHeight: 1.75,
    color: "rgba(255,255,255,0.94)",
  },
  heroPanel: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 20,
  },
  heroPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  heroPanelText: {
    color: "rgba(255,255,255,0.94)",
    lineHeight: 1.7,
    fontSize: 15,
    marginBottom: 16,
  },
  heroPanelList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    color: "rgba(255,255,255,0.96)",
    fontSize: 15,
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
    display: "flex",
    flexDirection: "column",
    minHeight: 100,
  },
  cardEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    color: "#2D3B78",
    fontWeight: 900,
    marginBottom: 14,
  },
  cardText: {
    margin: 0,
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.75,
  },
  cardList: {
    marginTop: 18,
    marginBottom: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    color: "#526581",
    fontSize: 14,
    lineHeight: 1.6,
  },
  cardActions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: "auto",
  },
  primaryAction: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "0 10px 20px rgba(38,51,102,0.14)",
  },
  secondaryAction: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  outlineAction: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    border: "1px solid #263366",
    backgroundColor: "#ffffff",
    color: "#263366",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  architectureCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
  },
  architectureHeader: {
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    color: "#2D3B78",
    fontWeight: 900,
  },
  sectionText: {
    marginTop: 12,
    marginBottom: 0,
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.75,
    maxWidth: 920,
  },
  architectureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  architectureItem: {
    borderRadius: 22,
    border: "1px solid #D9E4F1",
    backgroundColor: "#F9FBFE",
    padding: 18,
  },
  architectureItemTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 8,
  },
  architectureItemText: {
    color: "#526581",
    fontSize: 14,
    lineHeight: 1.7,
  },
  footer: {
    marginTop: 22,
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.6,
  },
  footerTag: {
    display: "inline-block",
    marginTop: 12,
    padding: "8px 12px",
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    color: "#1D4ED8",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.4,
  },
};

const responsiveCss = `
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  @media (max-width: 1160px) {
    .bf-hero-grid,
    .bf-main-grid,
    .bf-arch-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .bf-wrap {
      padding: 18px 12px 32px !important;
    }

    .bf-hero-title {
      font-size: 38px !important;
      line-height: 1.02 !important;
    }

    .bf-card-title {
      font-size: 28px !important;
    }

    .bf-section-title {
      font-size: 28px !important;
    }
  }
`;

export default function HomePage() {
  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <nav style={styles.nav}>
          <a href="/" style={styles.brand}>
            Beyond Intelligence™
          </a>

          <div style={styles.navLinks}>
            <a href="/borrower" style={styles.navLink}>
              Borrower Intelligence
            </a>
            <a href="/team" style={styles.navLink}>
              Team Mortgage Intelligence
            </a>
            <a href="/workflow" style={styles.navLink}>
              Team Workflow Intelligence
            </a>
          </div>
        </nav>

        <section style={styles.hero}>
          <div className="bf-hero-grid" style={styles.heroGrid}>
            <div>
              <div style={styles.badge}>BEYOND INTELLIGENCE™</div>

              <h1 className="bf-hero-title" style={styles.heroTitle}>
                Mortgage intelligence
                <br />
                for borrower guidance,
                <br />
                professional analysis,
                <br />
                and workflow execution.
              </h1>

              <p style={styles.heroText}>
                Beyond Intelligence™ is an AI-powered mortgage operating system
                supervised by an Independent Certified Mortgage Advisor. It is
                designed to separate borrower interaction, professional mortgage
                thinking, and team workflow execution into disciplined product
                layers that scale cleanly.
              </p>
            </div>

            <div style={styles.heroPanel}>
              <div style={styles.heroPanelTitle}>PLATFORM STRUCTURE</div>

              <div style={styles.heroPanelText}>
                One system. Three environments. Each with a distinct role in the
                mortgage journey.
              </div>

              <div style={styles.heroPanelList}>
                <div>• Borrower Intelligence for guided client interaction.</div>
                <div>• Team Mortgage Intelligence for professional analysis.</div>
                <div>• Team Workflow Intelligence for execution and file command.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bf-main-grid" style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardEyebrow}>BORROWER EXPERIENCE</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              Borrower
              <br />
              Intelligence
            </h2>

            <p style={styles.cardText}>
              Client-facing intake, mortgage guidance, routed loan officer
              matching, and Finley Beyond conversation flow with required
              disclaimer handling.
            </p>

            <div style={styles.cardList}>
              <div>• Guided mortgage intake</div>
              <div>• Loan officer routing</div>
              <div>• Scenario review and borrower chat</div>
              <div>• Apply, schedule, and contact actions</div>
            </div>

            <div style={styles.cardActions}>
              <a href="/borrower" style={styles.primaryAction}>
                Open Borrower Intelligence
              </a>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardEyebrow}>PROFESSIONAL THINKING LAYER</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              Team Mortgage
              <br />
              Intelligence
            </h2>

            <p style={styles.cardText}>
              Internal borrower analysis, directional program thinking, summary
              generation, and professional review support for licensed mortgage
              teams.
            </p>

            <div style={styles.cardList}>
              <div>• Borrower scenario review</div>
              <div>• Directional program analysis</div>
              <div>• Finley professional decision support</div>
              <div>• Internal summary email generation</div>
            </div>

            <div style={styles.cardActions}>
              <a href="/team" style={styles.secondaryAction}>
                Enter Mortgage Intelligence
              </a>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardEyebrow}>PROFESSIONAL EXECUTION LAYER</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              Team Workflow
              <br />
              Intelligence
            </h2>

            <p style={styles.cardText}>
              Command-center visibility for processing handoff, internal file
              coordination, milestone tracking, blockers, urgency, and close
              management.
            </p>

            <div style={styles.cardList}>
              <div>• Processing handoff</div>
              <div>• Active file queue and command panel</div>
              <div>• Milestones, blockers, and urgency</div>
              <div>• Internal file feed and execution tracking</div>
            </div>

            <div style={styles.cardActions}>
              <a href="/workflow" style={styles.outlineAction}>
                Enter Workflow Intelligence
              </a>
            </div>
          </div>
        </section>

        <section style={styles.architectureCard}>
          <div style={styles.architectureHeader}>
            <div style={styles.sectionEyebrow}>PRODUCT ARCHITECTURE</div>
            <h2 className="bf-section-title" style={styles.sectionTitle}>
              A cleaner operating system for mortgage teams
            </h2>
            <p style={styles.sectionText}>
              The platform now separates interaction, analysis, and execution so
              each environment can become stronger without overcrowding the
              others. This gives Beyond Intelligence™ a more disciplined,
              premium, and scalable product structure.
            </p>
          </div>

          <div className="bf-arch-grid" style={styles.architectureGrid}>
            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>Borrower Interaction</div>
              <div style={styles.architectureItemText}>
                The borrower-facing environment captures the scenario, educates
                the client, and moves the conversation toward a licensed advisor.
              </div>
            </div>

            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>Mortgage Thinking</div>
              <div style={styles.architectureItemText}>
                The professional intelligence layer helps the team reason
                through structure, fit, missing items, and the next best action.
              </div>
            </div>

            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>Workflow Execution</div>
              <div style={styles.architectureItemText}>
                The command layer keeps handoff, processing, blockers, and
                closing visibility aligned from pre-approval through funding.
              </div>
            </div>
          </div>
        </section>

        <div style={styles.footer}>
          Beyond Intelligence™ helps organize borrower guidance, mortgage
          analysis, and professional workflow execution under one supervised
          system.
          <div style={styles.footerTag}>MultiLender Intelligence™</div>
        </div>
      </div>
    </main>
  );
}
