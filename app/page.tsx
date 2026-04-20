import Link from "next/link";
import type { CSSProperties } from "react";

function buttonStyle(
  variant: "primary" | "secondary" | "ghost" = "primary"
): CSSProperties {
  if (variant === "secondary") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      padding: "16px 22px",
      borderRadius: 16,
      fontWeight: 800,
      fontSize: 16,
      background: "#0096C7",
      color: "#FFFFFF",
      boxShadow: "0 8px 18px rgba(0, 150, 199, 0.18)",
    };
  }

  if (variant === "ghost") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      padding: "16px 22px",
      borderRadius: 16,
      fontWeight: 800,
      fontSize: 16,
      background: "#FFFFFF",
      color: "#263366",
      border: "1px solid #D9E1EC",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "16px 22px",
    borderRadius: 16,
    fontWeight: 800,
    fontSize: 16,
    background: "#263366",
    color: "#FFFFFF",
    boxShadow: "0 8px 18px rgba(38, 51, 102, 0.18)",
  };
}

function cardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 24px rgba(38,51,102,0.05)",
    height: "100%",
  };
}

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F3F6FB",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
        }

        @media (max-width: 1120px) {
          .bi-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .bi-cards-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 760px) {
          .bi-page-wrap {
            padding: 18px !important;
          }

          .bi-hero-card {
            padding: 24px !important;
            border-radius: 20px !important;
          }

          .bi-cards-grid {
            grid-template-columns: 1fr !important;
          }

          .bi-hero-title {
            font-size: 44px !important;
            line-height: 0.96 !important;
          }

          .bi-right-panel {
            padding: 22px !important;
          }

          .bi-button-stack {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 520px) {
          .bi-hero-title {
            font-size: 34px !important;
          }
        }
      `}</style>

      <div
        className="bi-page-wrap"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "28px 20px 36px",
        }}
      >
        <section
          className="bi-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 18,
            alignItems: "stretch",
            marginBottom: 18,
          }}
        >
          <div
            className="bi-hero-card"
            style={{
              borderRadius: 26,
              padding: 28,
              background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
              color: "#FFFFFF",
              boxShadow: "0 16px 40px rgba(38,51,102,0.18)",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.3,
                marginBottom: 18,
              }}
            >
              BEYOND INTELLIGENCE™
            </div>

            <h1
              className="bi-hero-title"
              style={{
                margin: 0,
                fontSize: 62,
                lineHeight: 0.92,
                fontWeight: 900,
                letterSpacing: -1.8,
              }}
            >
              AI-Powered
              <br />
              Mortgage
              <br />
              Decision Support
              <br />
              <span style={{ color: "#B9E6FA" }}>
                for Borrowers and
                <br />
                Mortgage Professionals
              </span>
            </h1>

            <p
              style={{
                margin: "22px 0 0",
                maxWidth: 860,
                fontSize: 17,
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              Beyond Intelligence™ helps borrowers prepare for mortgage review
              and helps loan officers, loan officer assistants, and processors
              sharpen program direction, identify missing information, and move
              files forward with greater structure and speed.
            </p>

            <p
              style={{
                margin: "16px 0 0",
                maxWidth: 860,
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.84)",
              }}
            >
              MultiLender Intelligence™ is designed to organize borrower
              scenarios, improve early qualification flow, and connect each
              borrower with the appropriate licensed loan officer for personal
              review.
            </p>
          </div>

          <div
            className="bi-right-panel"
            style={{
              ...cardStyle(),
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "#DFF2FA",
                  color: "#0096C7",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  marginBottom: 14,
                }}
              >
                START HERE
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 28,
                  lineHeight: 1.05,
                }}
              >
                One cleaner screen. Faster entry.
              </h2>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#52627A",
                  fontSize: 16,
                  lineHeight: 1.55,
                }}
              >
                Borrowers can begin guided intake with Finley Beyond™. Mortgage
                professionals can test scenarios, discuss borrower structure,
                and move toward the next best program direction.
              </p>
            </div>

            <div style={{ marginTop: 24 }}>
              <div
                className="bi-button-stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 12,
                }}
              >
                <Link href="/borrower" style={buttonStyle("primary")}>
                  Start as Borrower
                </Link>

                <Link href="/team" style={buttonStyle("secondary")}>
                  Enter Team Workspace
                </Link>
              </div>

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: "1px solid #E3EAF3",
                  color: "#52627A",
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              >
                Beyond Intelligence™ provides preliminary decision support only.
                All scenarios remain subject to licensed loan officer review,
                investor and agency guidelines, documentation, verification,
                underwriting, appraisal, title, and program requirements.
              </div>
            </div>
          </div>
        </section>

        <section
          className="bi-cards-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          <div style={cardStyle()}>
            <div
              style={{
                color: "#0096C7",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 0.4,
                marginBottom: 12,
              }}
            >
              CLIENT / BORROWER
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.05,
              }}
            >
              Prepare before you speak with your loan officer
            </h3>

            <p
              style={{
                margin: "16px 0 0",
                color: "#52627A",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              Finley Beyond™ gathers intake details, target property scenario,
              loan purpose, state-to-state plans, and follow-up questions so the
              file starts with better structure.
            </p>
          </div>

          <div style={cardStyle()}>
            <div
              style={{
                color: "#0096C7",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 0.4,
                marginBottom: 12,
              }}
            >
              LOAN OFFICER TEAM
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.05,
              }}
            >
              Collaborate with Finley Beyond™ on program direction
            </h3>

            <p
              style={{
                margin: "16px 0 0",
                color: "#52627A",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              Loan officers, assistants, and processors can test scenarios,
              narrow likely paths, and generate cleaner internal decision
              support before borrower follow-up.
            </p>
          </div>

          <div style={cardStyle()}>
            <div
              style={{
                color: "#0096C7",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 0.4,
                marginBottom: 12,
              }}
            >
              GROWTH ENGINE
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.05,
              }}
            >
              Built for institutional-grade mortgage decision support
            </h3>

            <p
              style={{
                margin: "16px 0 0",
                color: "#52627A",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              As Beyond Intelligence™ expands through agency guidance, investor
              overlays, niche loan products, and workflow intelligence, it is
              designed to scale across real mortgage operations.
            </p>
          </div>

          <div style={cardStyle()}>
            <div
              style={{
                color: "#0096C7",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 0.4,
                marginBottom: 12,
              }}
            >
              AI-POWERED TEAM UPGRADE
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.05,
              }}
            >
              Equip your mortgage team with Beyond Intelligence™
            </h3>

            <p
              style={{
                margin: "16px 0 0",
                color: "#52627A",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              Contact Beyond Intelligence™ to help transform your mortgage
              operation with structured AI decision support, cleaner intake,
              and better internal coordination.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
