"use client";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.topRow}>
          <div style={styles.brandBlock}>
            <div style={styles.brand}>Beyond Intelligence™</div>
            <div style={styles.tagline}>
              AI-Powered Mortgage Decision System
            </div>
            <div style={styles.subTagline}>
              Supervised by Independent Certified Mortgage Advisors
            </div>
          </div>

          <div style={styles.linksBlock}>
            <a href="/privacy" style={styles.link}>
              Privacy Policy
            </a>
            <a href="/terms" style={styles.link}>
              Terms & Conditions
            </a>
            <a href="mailto:support@beyondfinancing.com" style={styles.link}>
              Contact
            </a>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.bottomRow}>
          <div style={styles.disclaimer}>
            Beyond Intelligence™ provides preliminary mortgage guidance only.
            All scenarios are subject to review by a licensed Mortgage Loan
            Originator, underwriting, and investor guidelines.
          </div>

          <div style={styles.copy}>
            © {year} Beyond Financing, Inc. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    marginTop: 40,
    background: "#F7F9FD",
    borderTop: "1px solid #C9D5EA",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "30px 20px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 20,
  },
  brandBlock: {
    maxWidth: 420,
  },
  brand: {
    fontSize: 16,
    fontWeight: 800,
    color: "#263366",
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontWeight: 600,
    color: "#4B5E85",
  },
  subTagline: {
    fontSize: 12,
    color: "#7A8DB3",
    marginTop: 4,
  },
  linksBlock: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  link: {
    textDecoration: "none",
    color: "#263366",
    fontWeight: 600,
    fontSize: 13,
  },
  divider: {
    height: 1,
    background: "#D6E0F2",
    margin: "20px 0",
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  disclaimer: {
    fontSize: 12,
    color: "#7A8DB3",
    maxWidth: 700,
    lineHeight: 1.6,
  },
  copy: {
    fontSize: 12,
    color: "#7A8DB3",
  },
};
