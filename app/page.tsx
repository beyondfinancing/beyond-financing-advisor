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
      letterSpacing: 0.1,
      color: "#FFFFFF",
      background:
        "linear-gradient(135deg, rgba(0,150,199,0.95) 0%, rgba(19,181,228,0.92) 100%)",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow:
        "0 14px 34px rgba(0,150,199,0.22), inset 0 1px 0 rgba(255,255,255,0.18)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    };
  }

  if (kind === "tertiary") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      minHeight: 52,
      padding: "14px 18px",
      borderRadius: 16,
      fontWeight: 700,
      fontSize: 15,
      color: "#263366",
      background: "rgba(255,255,255,0.7)",
      border: "1px solid rgba(38,51,102,0.1)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
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
    letterSpacing: 0.1,
    color: "#FFFFFF",
    background:
      "linear-gradient(135deg, rgba(38,51,102,0.98) 0%, rgba(53,70,140,0.96) 100%)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow:
      "0 14px 34px rgba(38,51,102,0.24), inset 0 1px 0 rgba(255,255,255,0.16)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };
}

function glassCardStyle(): CSSProperties {
  return {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(217,225,236,0.9)",
    borderRadius: 26,
    padding: 24,
    boxShadow:
      "0 18px 42px rgba(38,51,102,0.08), inset 0 1px 0 rgba(255,255,255,0.72)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    height: "100%",
  };
}

const metrics = [
  {
    label: "Multi-lender logic",
    value: "Agency, government, HELOC, second-lien, and non-QM direction in one structured engine.",
  },
  {
    label: "Operational clarity",
    value: "Cleaner intake, cleaner handoff, cleaner internal decision support.",
  },
  {
    label: "Built for real teams",
    value: "Borrowers, loan officers, assistants, processors, and leadership.",
  },
];

const featureCards = [
  {
    eyebrow: "CLIENT / BORROWER",
    title: "Prepare the file before the conversation begins.",
    body:
      "Finley Beyond™ organizes intake details, target property scenario, borrower structure, and follow-up questions so the file begins with stronger context and less friction.",
  },
  {
    eyebrow: "LOAN OFFICER TEAM",
    title: "Turn product complexity into disciplined direction.",
    body:
      "Loan officers, assistants, and processors can evaluate borrower structure faster, narrow likely paths sooner, and move into next-step strategy with greater confidence.",
  },
  {
    eyebrow: "MULTILENDER INTELLIGENCE™",
    title: "A cleaner way to think across a fragmented market.",
    body:
      "When guidelines, overlays, and product categories keep multiplying, Beyond Intelligence™ helps teams regain structure, continuity, and strategic control.",
  },
  {
    eyebrow: "PLATFORM VALUE",
    title: "Luxury-grade presentation. Operational-grade substance.",
    body:
      "Designed to feel refined, precise, and modern while serving a serious purpose: reducing noise, improving decision quality, and helping mortgage teams operate at a higher level.",
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,150,199,0.08) 0%, rgba(0,150,199,0) 30%), radial-gradient(circle at top right, rgba(38,51,102,0.1) 0%, rgba(38,51,102,0) 28%), linear-gradient(180deg, #F5F7FB 0%, #EEF2F8 100%)",
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

        @media (max-width: 1180px) {
          .bi-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .bi-feature-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 780px) {
          .bi-page-wrap {
            padding: 18px !important;
          }

          .bi-feature-grid {
            grid-template-columns: 1fr !important;
          }

          .bi-hero-card,
          .bi-right-panel,
          .bi-bottom-card {
            padding: 22px !important;
            border-radius: 22px !important;
          }

          .bi-hero-title {
            font-size: 42px !important;
            line-height: 0.98 !important;
            letter-spacing: -1.5px !important;
          }

          .bi-button-stack {
            grid-template-columns: 1fr !important;
          }

          .bi-stat-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 520px) {
          .bi-hero-title {
            font-size: 34px !important;
            line-height: 1.02 !important;
          }

          .bi-hero-copy {
            font-size: 15px !important;
          }
        }
      `}</style>

      <div
        className="bi-page-wrap"
        style={{
          maxWidth: 1220,
          margin: "0 auto",
          padding: "26px 20px 40px",
        }}
      >
        <section
          className="bi-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.65fr 0.95fr",
            gap: 18,
            alignItems: "stretch",
            marginBottom: 18,
          }}
        >
          <div
            className="bi-hero-card"
            style={{
              borderRadius: 30,
              padding: 30,
              color: "#FFFFFF",
              background:
                "linear-gradient(135deg, #263366 0%, #1A5F95 48%, #0096C7 100%)",
              boxShadow:
                "0 20px 46px rgba(38,51,102,0.18), inset 0 1px 0 rgba(255,255,255,0.14)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 22%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 20%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 40%)",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  marginBottom: 18,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                BEYOND INTELLIGENCE™
              </div>

              <h1
                className="bi-hero-title"
                style={{
                  margin: 0,
                  maxWidth: 920,
                  fontSize: 58,
                  lineHeight: 0.93,
                  fontWeight: 900,
                  letterSpacing: -1.9,
                }}
              >
                AI-Powered
                <br />
                Mortgage
                <br />
                Decision Support
                <br />
                <span style={{ color: "#BEEBFF" }}>
                  for Borrowers and
                  <br />
                  Mortgage Professionals
                </span>
              </h1>

              <p
                className="bi-hero-copy"
                style={{
                  margin: "24px 0 0",
                  maxWidth: 860,
                  fontSize: 18,
                  lineHeight: 1.58,
                  color: "rgba(255,255,255,0.96)",
                }}
              >
                Beyond Intelligence™ was built for one of the hardest realities
                in mortgage: too many products, too many overlays, too many
                moving parts, and not enough clean structure to think clearly at
                speed.
              </p>

              <p
                className="bi-hero-copy"
                style={{
                  margin: "16px 0 0",
                  maxWidth: 860,
                  fontSize: 15,
                  lineHeight: 1.72,
                  color: "rgba(255,255,255,0.84)",
                }}
              >
                MultiLender Intelligence™ helps organize borrower scenarios,
                sharpen early qualification flow, and give mortgage teams a more
                elegant path from intake to internal direction to licensed loan
                officer review.
              </p>

              <div
                className="bi-stat-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                  marginTop: 24,
                }}
              >
                {metrics.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#D8F4FF",
                        letterSpacing: 0.25,
                        marginBottom: 8,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "rgba(255,255,255,0.88)",
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="bi-right-panel"
            style={{
              ...glassCardStyle(),
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
                  background: "rgba(0,150,199,0.12)",
                  color: "#0096C7",
                  border: "1px solid rgba(0,150,199,0.12)",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.35,
                  marginBottom: 14,
                }}
              >
                PLATFORM INTRODUCTION
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 30,
                  lineHeight: 1.02,
                  letterSpacing: -0.6,
                }}
              >
                MultiLender Intelligence™,
                <br />
                designed for serious
                <br />
                mortgage teams.
              </h2>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#52627A",
                  fontSize: 16,
                  lineHeight: 1.62,
                }}
              >
                A cleaner operating layer for borrower intake, loan officer
                routing, product awareness, and internal scenario direction.
                Built to respect the complexity of real mortgage work while
                presenting it with unusual clarity.
              </p>
            </div>

<div style={{ marginTop: 26 }}>
  {/* Qualification / Positioning Block */}
  <div
    style={{
      borderRadius: 18,
      padding: 18,
      marginBottom: 18,
      background: "rgba(255,255,255,0.6)",
      border: "1px solid rgba(38,51,102,0.08)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    }}
  >
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: 0.4,
        color: "#0096C7",
        marginBottom: 10,
      }}
    >
      ACCESS & COLLABORATION
    </div>

    <div
      style={{
        fontSize: 15,
        lineHeight: 1.6,
        color: "#34445E",
        marginBottom: 14,
      }}
    >
      Designed for established mortgage companies and licensed professionals
      seeking a more structured and intelligent approach to borrower
      qualification and program direction.
    </div>

    <div
      style={{
        fontSize: 14,
        lineHeight: 1.6,
        color: "#52627A",
        marginBottom: 14,
      }}
    >
      Access is currently extended on a selective basis. Company profile and/or
      Mortgage Loan Originator NMLS identification is required for
      consideration.
    </div>

    <a
      href="mailto:mtgpro@beyondintelligence.io?subject=Beyond%20Intelligence%20Platform%20Inquiry&body=Hello%2C%0A%0AI%20would%20like%20to%20inquire%20about%20Beyond%20Intelligence.%0A%0ACompany%20Name%3A%0ANMLS%20%23%3A%0A%0AThank%20you."
      style={{
        display: "inline-block",
        fontWeight: 800,
        fontSize: 14,
        color: "#0096C7",
        textDecoration: "none",
      }}
    >
      Inquire about platform access →
    </a>
  </div>

  {/* CTAs */}
  <div
    className="bi-button-stack"
    style={{
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 12,
    }}
  >
    <Link href="/borrower" style={ctaStyle("primary")}>
      Start as Borrower
    </Link>

    <Link href="/team" style={ctaStyle("secondary")}>
      Enter Team Workspace
    </Link>
  </div>

  <div
    style={{
      marginTop: 18,
      paddingTop: 18,
      borderTop: "1px solid rgba(38,51,102,0.08)",
      color: "#52627A",
      fontSize: 15,
      lineHeight: 1.65,
    }}
  >
    Beyond Intelligence™ provides preliminary decision support only. All
    scenarios remain subject to licensed loan officer review, investor and
    agency guidelines, documentation, verification, underwriting, appraisal,
    title, and program requirements.
  </div>
</div>
          </div>
        </section>

        <section
          className="bi-feature-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 18,
            marginBottom: 18,
          }}
        >
          {featureCards.map((card) => (
            <div key={card.title} style={glassCardStyle()}>
              <div
                style={{
                  color: "#0096C7",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: 0.38,
                  marginBottom: 12,
                }}
              >
                {card.eyebrow}
              </div>

              <h3
                style={{
                  margin: 0,
                  fontSize: 22,
                  lineHeight: 1.06,
                  letterSpacing: -0.3,
                }}
              >
                {card.title}
              </h3>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#52627A",
                  fontSize: 15,
                  lineHeight: 1.68,
                }}
              >
                {card.body}
              </p>
            </div>
          ))}
        </section>

        <section
          className="bi-bottom-card"
          style={{
            ...glassCardStyle(),
            padding: 26,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.15fr 0.85fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  color: "#0096C7",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: 0.38,
                  marginBottom: 12,
                }}
              >
                WHY IT MATTERS
              </div>

              <h3
                style={{
                  margin: 0,
                  fontSize: 30,
                  lineHeight: 1.04,
                  letterSpacing: -0.7,
                }}
              >
                Finally, an engine that understands the struggle behind modern
                mortgage origination.
              </h3>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#52627A",
                  fontSize: 16,
                  lineHeight: 1.72,
                  maxWidth: 860,
                }}
              >
                Loan officers are expected to move quickly while keeping pace
                with an expanding universe of agency paths, government products,
                HELOC and second-lien structures, non-QM options, lender
                overlays, and documentation strategy. Beyond Intelligence™ was
                designed to make that landscape feel more disciplined, more
                navigable, and more elegant.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              <Link href="/team" style={ctaStyle("tertiary")}>
                Explore the team experience
              </Link>

              <Link href="/borrower" style={ctaStyle("tertiary")}>
                Explore the borrower experience
              </Link>
            </div>
          </div>
        </section>
      </div>
      <footer
  style={{
    marginTop: 40,
    paddingTop: 24,
    borderTop: "1px solid rgba(38,51,102,0.08)",
    textAlign: "center",
    fontSize: 13,
    color: "#6A7A94",
    letterSpacing: 0.2,
  }}
>
  Powered and Designed by Beyond Intelligence™ © 2026
</footer>
    </main>
  );
}
