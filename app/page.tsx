import Link from "next/link";

export default function Page() {
  return (
    <main style={styles.page}>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #F1F3F8;
          color: #263366;
          font-family: Inter, Arial, Helvetica, sans-serif;
        }

        a {
          text-decoration: none;
        }

        .bi-wrap {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 22px 36px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 18px;
        }

        .bi-hero {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
          align-items: stretch;
        }

        .bi-main-card,
        .bi-side-card,
        .bi-mini-card {
          background: #ffffff;
          border: 1px solid rgba(38, 51, 102, 0.10);
          border-radius: 24px;
          box-shadow: 0 12px 28px rgba(38, 51, 102, 0.08);
        }

        .bi-main-card {
          padding: 26px 28px;
          background: linear-gradient(135deg, #263366 0%, #0096C7 100%);
          color: #ffffff;
        }

        .bi-side-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .bi-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .bi-mini-card {
          padding: 20px;
          min-height: 190px;
        }

        .bi-eyebrow {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          color: #ffffff;
          margin-bottom: 14px;
        }

        .bi-side-eyebrow {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(0, 150, 199, 0.10);
          color: #0096C7;
          margin-bottom: 12px;
        }

        .bi-title {
          margin: 0;
          font-size: 66px;
          line-height: 0.96;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .bi-title-accent {
          color: #BFEFFF;
        }

        .bi-subtitle {
          margin: 16px 0 0;
          font-size: 18px;
          line-height: 1.55;
          max-width: 900px;
          color: rgba(255,255,255,0.94);
        }

        .bi-side-title {
          margin: 0 0 10px;
          font-size: 28px;
          line-height: 1.1;
          font-weight: 800;
          color: #263366;
        }

        .bi-side-text,
        .bi-mini-text,
        .bi-disclaimer {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: rgba(38, 51, 102, 0.88);
        }

        .bi-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .bi-button-primary,
        .bi-button-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          padding: 0 22px;
          border-radius: 16px;
          font-weight: 700;
          font-size: 16px;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .bi-button-primary:hover,
        .bi-button-secondary:hover {
          transform: translateY(-1px);
        }

        .bi-button-primary {
          background: #263366;
          color: #ffffff;
          box-shadow: 0 10px 20px rgba(38, 51, 102, 0.18);
        }

        .bi-button-secondary {
          background: #0096C7;
          color: #ffffff;
          box-shadow: 0 10px 20px rgba(0, 150, 199, 0.18);
        }

        .bi-divider {
          height: 1px;
          background: rgba(38, 51, 102, 0.10);
          margin: 16px 0;
        }

        .bi-mini-title {
          margin: 0 0 10px;
          font-size: 16px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #0096C7;
        }

        .bi-mini-headline {
          margin: 0 0 10px;
          font-size: 22px;
          line-height: 1.15;
          font-weight: 700;
          color: #263366;
        }

        .bi-footer-note {
          margin-top: 2px;
          font-size: 14px;
          line-height: 1.55;
          color: rgba(38, 51, 102, 0.78);
          text-align: center;
          font-weight: 600;
        }

        @media (max-width: 1080px) {
          .bi-wrap {
            max-width: 980px;
          }

          .bi-title {
            font-size: 54px;
          }

          .bi-cards {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .bi-wrap {
            padding: 18px 14px 28px;
            justify-content: flex-start;
            min-height: auto;
          }

          .bi-hero {
            grid-template-columns: 1fr;
          }

          .bi-main-card,
          .bi-side-card,
          .bi-mini-card {
            border-radius: 20px;
          }

          .bi-main-card,
          .bi-side-card,
          .bi-mini-card {
            padding: 20px;
          }

          .bi-title {
            font-size: 42px;
            line-height: 1.02;
          }

          .bi-subtitle {
            font-size: 16px;
          }

          .bi-side-title {
            font-size: 24px;
          }

          .bi-actions {
            flex-direction: column;
          }

          .bi-button-primary,
          .bi-button-secondary {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .bi-title {
            font-size: 34px;
          }

          .bi-subtitle,
          .bi-side-text,
          .bi-mini-text,
          .bi-disclaimer,
          .bi-footer-note {
            font-size: 14px;
          }

          .bi-mini-headline {
            font-size: 20px;
          }
        }
      `}</style>

      <div className="bi-wrap">
        <section className="bi-hero">
          <div className="bi-main-card">
            <div className="bi-eyebrow">Beyond Intelligence™</div>

            <h1 className="bi-title">
              AI-Powered Mortgage
              <br />
              Decision Support
              <br />
              <span className="bi-title-accent">for Borrowers and Mortgage Professionals</span>
            </h1>

            <p className="bi-subtitle">
              Beyond Intelligence™ helps borrowers prepare for mortgage review and helps
              loan officers, loan officer assistants, and processors sharpen program
              direction, identify missing information, and move files forward with
              greater structure and speed.
            </p>
          </div>

          <div className="bi-side-card">
            <div>
              <div className="bi-side-eyebrow">Start Here</div>
              <h2 className="bi-side-title">One cleaner screen. Faster entry.</h2>
              <p className="bi-side-text">
                Borrowers can begin guided intake with Finley Beyond™. Mortgage
                professionals can test scenarios, discuss borrower structure, and
                move toward the next best program direction.
              </p>
            </div>

            <div>
              <div className="bi-actions">
                <Link href="/borrower" className="bi-button-primary">
                  Start as Borrower
                </Link>
                <Link href="/finley?mode=team" className="bi-button-secondary">
                  Enter Team Workspace
                </Link>
              </div>

              <div className="bi-divider" />

              <p className="bi-disclaimer">
                Beyond Intelligence™ provides preliminary decision support only. All
                scenarios remain subject to licensed loan officer review, investor and
                agency guidelines, documentation, verification, underwriting,
                appraisal, title, and program requirements.
              </p>
            </div>
          </div>
        </section>

        <section className="bi-cards">
          <article className="bi-mini-card">
            <div className="bi-mini-title">Client / Borrower</div>
            <h3 className="bi-mini-headline">Prepare before you speak with your loan officer</h3>
            <p className="bi-mini-text">
              Finley Beyond™ gathers intake details, target property scenario, loan
              purpose, state-to-state plans, and follow-up questions so the file
              starts with stronger clarity.
            </p>
          </article>

          <article className="bi-mini-card">
            <div className="bi-mini-title">Loan Officer Team</div>
            <h3 className="bi-mini-headline">Collaborate with Finley Beyond™ on program direction</h3>
            <p className="bi-mini-text">
              Loan officers, assistants, and processors can test scenarios, narrow
              likely paths, and generate cleaner internal decision support before
              borrower handoff and follow-up.
            </p>
          </article>

          <article className="bi-mini-card">
            <div className="bi-mini-title">Growth Engine</div>
            <h3 className="bi-mini-headline">Built for institutional-grade mortgage decision support</h3>
            <p className="bi-mini-text">
              As Beyond Intelligence™ expands through agency guidance, investor
              overlays, niche loan products, and workflow intelligence, it becomes a
              stronger platform for borrowers and mortgage operations.
            </p>
          </article>

          <article className="bi-mini-card">
            <div className="bi-mini-title">AI-Powered Team Upgrade</div>
            <h3 className="bi-mini-headline">Equip your mortgage team with Beyond Intelligence™</h3>
            <p className="bi-mini-text">
              Contact Beyond Intelligence™ to help transform your mortgage operation
              with structured AI decision support, cleaner intake, stronger internal
              guidance, and faster team execution.
              <br />
              <br />
              Contact: <a href="mailto:mtgpro@beyondintelligence.io">mtgpro@beyondintelligence.io</a>
            </p>
          </article>
        </section>

        <p className="bi-footer-note">
          Powered by: Beyond Intelligence™ @2026
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F1F3F8",
  },
};
