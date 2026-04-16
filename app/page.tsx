import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #F1F3F8 0%, #FFFFFF 45%, #F7FAFC 100%)",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "40px 20px 24px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: 999,
            background: "#E8EEF8",
            color: "#263366",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.3,
            marginBottom: 18,
          }}
        >
          BEYOND INTELLIGENCE™
        </div>

        <h1
          style={{
            fontSize: "clamp(34px, 7vw, 62px)",
            lineHeight: 1.05,
            margin: "0 0 16px",
            fontWeight: 800,
            maxWidth: 980,
          }}
        >
          AI-Powered Mortgage Decision Support
          <span style={{ display: "block", color: "#0096C7", marginTop: 10 }}>
            for Borrowers and Mortgage Professionals
          </span>
        </h1>

        <p
          style={{
            maxWidth: 960,
            fontSize: "clamp(18px, 2.5vw, 20px)",
            lineHeight: 1.65,
            margin: "0 0 24px",
            color: "#41536F",
          }}
        >
          Beyond Intelligence helps borrowers prepare for mortgage review and
          helps loan officers, loan officer assistants, and processors sharpen
          program direction, identify missing information, and move files
          forward with greater structure and speed.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <Link
            href="/borrower"
            style={{
              background: "#263366",
              color: "#fff",
              textDecoration: "none",
              padding: "14px 22px",
              borderRadius: 14,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(38, 51, 102, 0.18)",
            }}
          >
            Start as Borrower
          </Link>

          <Link
            href="/team"
            style={{
              background: "#0096C7",
              color: "#fff",
              textDecoration: "none",
              padding: "14px 22px",
              borderRadius: 14,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0, 150, 199, 0.18)",
            }}
          >
            Enter Team Workspace
          </Link>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "#66758C",
            maxWidth: 980,
            lineHeight: 1.6,
          }}
        >
          Beyond Intelligence provides preliminary decision support only. All
          scenarios remain subject to licensed loan officer review, investor and
          agency guidelines, full documentation, verification, underwriting,
          appraisal, title, and program requirements.
        </p>
      </section>

      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "12px 20px 44px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #D9E1EC",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 10px 28px rgba(38, 51, 102, 0.06)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              CLIENT / BORROWER
            </div>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 30px)",
                lineHeight: 1.3,
              }}
            >
              Prepare before you speak with your loan officer
            </h2>
            <p style={{ margin: 0, lineHeight: 1.75, color: "#4B5C78" }}>
              Finley Beyond gathers intake details, target property scenario,
              loan purpose, current state, move-to state, optional Realtor
              information, and follow-up questions so the loan officer begins
              with a stronger picture of the file.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #D9E1EC",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 10px 28px rgba(38, 51, 102, 0.06)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              LOAN OFFICER TEAM
            </div>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 30px)",
                lineHeight: 1.3,
              }}
            >
              Collaborate with Finley Beyond on program direction
            </h2>
            <p style={{ margin: 0, lineHeight: 1.75, color: "#4B5C78" }}>
              Loan officers, assistants, and processors can test scenarios,
              narrow possible program paths, discuss borrower structure with
              Finley Beyond, and receive an emailed summary of the professional
              conversation.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #D9E1EC",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 10px 28px rgba(38, 51, 102, 0.06)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#0096C7",
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              GROWTH ENGINE
            </div>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 30px)",
                lineHeight: 1.3,
              }}
            >
              Built for Institutional-Grade Mortgage Decision Support
            </h2>
            <p style={{ margin: 0, lineHeight: 1.75, color: "#4B5C78" }}>
              As Beyond Intelligence expands through agency guidance, investor
              overlays, niche loan products, and real-world workflow
              intelligence, it evolves into a more powerful decision-support
              platform for borrowers, loan officers, assistants, processors, and
              scalable mortgage operations.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
