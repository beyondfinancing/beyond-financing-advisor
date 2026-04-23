"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

function ctaStyle(kind: "primary" | "secondary" | "tertiary"): CSSProperties {
  if (kind === "secondary") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      minHeight: 58,
      padding: "16px 22px",
      borderRadius: 18,
      fontWeight: 800,
      fontSize: 16,
      lineHeight: 1,
      border: "1px solid #C8D4E8",
      color: "#263366",
      background: "#FFFFFF",
      boxShadow: "0 10px 22px rgba(38, 51, 102, 0.06)",
    };
  }

  if (kind === "tertiary") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      minHeight: 50,
      padding: "14px 18px",
      borderRadius: 16,
      fontWeight: 700,
      fontSize: 14,
      lineHeight: 1,
      border: "1px solid #D6E2F3",
      color: "#35507C",
      background: "#F8FBFF",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    minHeight: 58,
    padding: "16px 22px",
    borderRadius: 18,
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1,
    border: "1px solid #263366",
    color: "#FFFFFF",
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    boxShadow: "0 14px 28px rgba(38, 51, 102, 0.18)",
  };
}

function sectionCardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    borderRadius: 26,
    border: "1px solid #E2EAF4",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
    padding: 24,
  };
}

function smallMetricCardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    borderRadius: 24,
    border: "1px solid #E2EAF4",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
    padding: 22,
    minHeight: 150,
  };
}

export default function HomePage() {
  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <TopNav />

        <section style={styles.hero}>
          <div className="bf-hero-grid" style={styles.heroGrid}>
            <div>
              <div style={styles.eyebrow}>BEYOND INTELLIGENCE™</div>

              <h1 style={styles.heroTitle}>
                The mortgage decision system
                <br />
                built to think before
                <br />
                the industry asks.
              </h1>

              <p style={styles.heroText}>
                Beyond Intelligence™ is an AI-powered mortgage decision system
                supervised by an Independent Certified Mortgage Advisor. It is
                designed to guide borrowers, support loan officers, structure
                internal workflow, and create a more intelligent path from first
                conversation to clear-to-close.
              </p>

              <div style={styles.heroButtonRow}>
                <Link href="/borrower" style={ctaStyle("primary")}>
                  Open Borrower Experience
                </Link>
                <Link href="/team" style={ctaStyle("secondary")}>
                  Open Mortgage Intelligence
                </Link>
              </div>

              <div style={styles.heroSubActions}>
                <Link href="/workflow" style={ctaStyle("tertiary")}>
                  Workflow Intelligence
                </Link>
              </div>
            </div>

            <div style={styles.heroRightColumn}>
              <div style={styles.heroPanel}>
                <div style={styles.heroPanelTitle}>SYSTEM POSITIONING</div>
                <div style={styles.heroPanelText}>
                  Built for borrower guidance, professional analysis, file
                  command, and long-term mortgage operating scale.
                </div>
              </div>

              <div style={styles.heroPanel}>
                <div style={styles.heroPanelTitle}>COMPLIANCE DIRECTION</div>
                <div style={styles.heroPanelText}>
                  Educational and preliminary in nature. All scenario direction,
                  eligibility review, and final loan recommendations remain
                  subject to licensed loan officer review and current investor
                  guidelines.
                </div>
              </div>

              <div style={styles.heroPanel}>
                <div style={styles.heroPanelTitle}>PLATFORM PATHS</div>
                <div style={styles.heroPanelList}>
                  <div>• Borrower intake and guided conversation</div>
                  <div>• Loan officer and team intelligence layer</div>
                  <div>• Workflow command center and milestone visibility</div>
                  <div>• Notification and operating system expansion</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bf-metric-grid" style={styles.metricGrid}>
          <MetricCard
            title="Borrower Experience"
            value="24/7"
            subtext="Guided intake and conversation entry point"
          />
          <MetricCard
            title="Professional Layer"
            value="Team"
            subtext="Mortgage Intelligence access for professionals"
          />
          <MetricCard
            title="Workflow Layer"
            value="Live"
            subtext="Execution visibility from handoff through closing"
          />
          <MetricCard
            title="System Goal"
            value="CTC"
            subtext="Designed to support a more disciplined clear-to-close path"
          />
        </section>

        <section style={styles.twoColumnSection}>
          <div style={sectionCardStyle()}>
            <div style={styles.sectionEyebrow}>PLATFORM ENTRY</div>
            <h2 style={styles.sectionTitle}>Choose the right operating layer</h2>
            <p style={styles.sectionText}>
              Each route serves a distinct purpose inside Beyond Intelligence™.
              The system is structured so that the borrower, the loan officer,
              and the internal operations team each enter through the correct
              experience.
            </p>

            <div style={styles.featureStack}>
              <FeatureRow
                title="Borrower Experience"
                text="A guided intake and conversation flow designed to help the borrower organize their scenario before licensed review."
              />
              <FeatureRow
                title="Mortgage Intelligence"
                text="The professional workspace for team users who need analysis, internal tools, and controlled access."
              />
              <FeatureRow
                title="Workflow Intelligence"
                text="The operational command center for handoff, visibility, accountability, processor coordination, and file progress."
              />
            </div>

            <div style={styles.inlineCtaRow}>
              <Link href="/borrower" style={ctaStyle("secondary")}>
                Go to Borrower Experience
              </Link>
              <Link href="/team" style={ctaStyle("secondary")}>
                Go to Mortgage Intelligence
              </Link>
            </div>
          </div>

          <div style={sectionCardStyle()}>
            <div style={styles.sectionEyebrow}>WHY THIS SYSTEM</div>
            <h2 style={styles.sectionTitle}>Built to solve the problems others do not see yet</h2>
            <p style={styles.sectionText}>
              Beyond Intelligence™ is not meant to be another static mortgage
              website. It is being built as a decision and execution framework
              for a mortgage environment that increasingly requires speed,
              clarity, discipline, and continuity between sales, advisory, and
              operations.
            </p>

            <div style={styles.bulletPanel}>
              <div style={styles.bulletItem}>
                • Organizes borrower inputs before human follow-up
              </div>
              <div style={styles.bulletItem}>
                • Supports professionals with structured intelligence
              </div>
              <div style={styles.bulletItem}>
                • Converts workflow into an operational command layer
              </div>
              <div style={styles.bulletItem}>
                • Prepares the platform for automated communication and scale
              </div>
            </div>

            <div style={styles.noteBox}>
              Finley Beyond Powered by Beyond Intelligence™ AI-Powered Mortgage
              Decision System Supervised by an Independent Certified Mortgage
              Advisor
            </div>
          </div>
        </section>

        <section style={sectionCardStyle()}>
          <div style={styles.sectionEyebrow}>SYSTEM MODULES</div>
          <h2 style={styles.sectionTitle}>Current core modules</h2>

          <div className="bf-module-grid" style={styles.moduleGrid}>
            <ModuleCard
              title="Borrower Intake"
              text="Captures borrower scenario direction, loan officer routing, and structured pre-conversation context."
            />
            <ModuleCard
              title="Finley Conversation Layer"
              text="Creates a guided interaction experience intended to gather useful qualification-oriented information without overpromising."
            />
            <ModuleCard
              title="Professional Access"
              text="Supports protected internal access for team users and future role-based intelligence functions."
            />
            <ModuleCard
              title="Workflow Command"
              text="Tracks file progress, urgency, milestone visibility, and operational handoff from pre-approval through closing."
            />
          </div>
        </section>

        <section style={styles.bottomCtaSection}>
          <div style={styles.bottomCtaCard}>
            <div style={styles.sectionEyebrowLight}>NEXT STEP</div>
            <h2 style={styles.bottomCtaTitle}>
              Enter the platform through the experience you need.
            </h2>
            <p style={styles.bottomCtaText}>
              Borrowers can begin with guided intake. Professionals can enter
              the protected intelligence environment. Internal execution can
              continue inside Workflow Intelligence.
            </p>

            <div style={styles.bottomCtaButtons}>
              <Link href="/borrower" style={ctaStyle("primary")}>
                Borrower Experience
              </Link>
              <Link href="/team" style={ctaStyle("secondary")}>
                Mortgage Intelligence
              </Link>
              <Link href="/workflow" style={ctaStyle("secondary")}>
                Workflow Intelligence
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function TopNav() {
  return (
    <div style={navStyles.topBar}>
      <Link href="/" style={navStyles.brand}>
        Beyond Intelligence™
      </Link>

      <div style={navStyles.topBarLinks}>
        <Link href="/" style={navStyles.topBarLinkActive}>
          Home
        </Link>
        <Link href="/borrower" style={navStyles.topBarLink}>
          Borrower Experience
        </Link>
        <Link href="/team" style={navStyles.topBarLink}>
          Mortgage Intelligence
        </Link>
        <Link href="/workflow" style={navStyles.topBarLink}>
          Workflow Intelligence
        </Link>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string;
  subtext: string;
}) {
  return (
    <div style={smallMetricCardStyle()}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricSubtext}>{subtext}</div>
    </div>
  );
}

function FeatureRow({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.featureRow}>
      <div style={styles.featureTitle}>{title}</div>
      <div style={styles.featureText}>{text}</div>
    </div>
  );
}

function ModuleCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.moduleCard}>
      <div style={styles.moduleTitle}>{title}</div>
      <div style={styles.moduleText}>{text}</div>
    </div>
  );
}

const responsiveCss = `
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  @media (max-width: 1180px) {
    .bf-hero-grid,
    .bf-module-grid,
    .bf-metric-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 980px) {
    .bf-hero-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 860px) {
    .bf-module-grid,
    .bf-metric-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .bf-wrap {
      padding: 18px 12px 36px !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F3F6FB",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 18px 40px",
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 28,
    color: "#FFFFFF",
    boxShadow: "0 16px 34px rgba(38, 51, 102, 0.16)",
    marginBottom: 20,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 24,
    alignItems: "start",
  },
  eyebrow: {
    display: "inline-block",
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: 800,
    opacity: 0.98,
    backgroundColor: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: "10px 14px",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontWeight: 900,
    fontSize: 58,
    lineHeight: 0.96,
  },
  heroText: {
    marginTop: 22,
    marginBottom: 0,
    fontSize: 17,
    lineHeight: 1.75,
    maxWidth: 860,
    color: "rgba(255,255,255,0.95)",
  },
  heroButtonRow: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 26,
  },
  heroSubActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
  },
  heroRightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  heroPanel: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 18,
  },
  heroPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  heroPanelText: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(255,255,255,0.95)",
  },
  heroPanelList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 15,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.95)",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 20,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0284C7",
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 10,
  },
  metricSubtext: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.6,
  },
  twoColumnSection: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 20,
  },
  sectionEyebrow: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  sectionEyebrowLight: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: 0,
    color: "#2D3B78",
    fontSize: 30,
    lineHeight: 1.12,
    fontWeight: 900,
  },
  sectionText: {
    color: "#64748B",
    lineHeight: 1.75,
    fontSize: 15,
    marginTop: 12,
    marginBottom: 0,
  },
  featureStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 20,
  },
  featureRow: {
    borderRadius: 18,
    border: "1px solid #D8E3F1",
    backgroundColor: "#F8FBFF",
    padding: 16,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 6,
  },
  featureText: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "#526581",
  },
  inlineCtaRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 20,
  },
  bulletPanel: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  bulletItem: {
    borderRadius: 16,
    border: "1px solid #D8E3F1",
    backgroundColor: "#F8FBFF",
    padding: "14px 16px",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#35507C",
    fontWeight: 700,
  },
  noteBox: {
    marginTop: 20,
    borderRadius: 18,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F9FBFE",
    padding: 16,
    color: "#2D3B78",
    fontSize: 15,
    lineHeight: 1.7,
    fontWeight: 700,
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginTop: 18,
  },
  moduleCard: {
    borderRadius: 22,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F9FBFE",
    padding: 18,
    minHeight: 190,
  },
  moduleTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 10,
    lineHeight: 1.2,
  },
  moduleText: {
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.75,
  },
  bottomCtaSection: {
    marginTop: 20,
  },
  bottomCtaCard: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 28,
    color: "#FFFFFF",
    boxShadow: "0 16px 34px rgba(38, 51, 102, 0.16)",
  },
  bottomCtaTitle: {
    margin: 0,
    fontWeight: 900,
    fontSize: 38,
    lineHeight: 1.06,
  },
  bottomCtaText: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.75,
    maxWidth: 840,
    color: "rgba(255,255,255,0.95)",
  },
  bottomCtaButtons: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 24,
  },
};

const navStyles: Record<string, CSSProperties> = {
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
    padding: "4px 2px",
    flexWrap: "wrap",
  },
  brand: {
    textDecoration: "none",
    color: "#263366",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  topBarLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  topBarLink: {
    textDecoration: "none",
    color: "#263366",
    background: "#F7F9FD",
    border: "1px solid #C9D5EA",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  },
  topBarLinkActive: {
    textDecoration: "none",
    color: "#FFFFFF",
    background: "#263366",
    border: "1px solid #263366",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  },
};
