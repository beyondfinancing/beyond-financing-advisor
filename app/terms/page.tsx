export default function TermsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Terms and Conditions</h1>

        <p style={styles.text}>
          These Terms govern your use of Beyond Intelligence™, an AI-powered mortgage intelligence and educational platform operated by Beyond Intelligence, LLC.
Beyond Intelligence™ provides general information and scenario-based insights to help you better understand mortgage options. It does not provide mortgage advice or lending decisions. All guidance is subject to review and confirmation by a licensed Mortgage Loan Originator.
Use of this system does not create a client, advisory, or fiduciary relationship.
AI-powered mortgage intelligence supervised by licensed professionals

        </p>

        <h2 style={styles.heading}>Service Description</h2>
        <p style={styles.text}>
          Beyond Intelligence™ provides preliminary mortgage guidance and
          connects users with licensed mortgage professionals. It does not
          provide loan approvals, underwriting decisions, or legal advice.
        </p>

        <h2 style={styles.heading}>No Guarantee of Approval</h2>
        <p style={styles.text}>
          All mortgage scenarios are subject to review, documentation,
          underwriting, and investor guidelines. Use of this system does not
          guarantee loan approval.
        </p>

        <h2 style={styles.heading}>SMS Terms of Service</h2>
        <p style={styles.text}>
          By providing your phone number, you consent to receive transactional
          SMS messages related to your mortgage inquiry.
        </p>

        <ul style={styles.list}>
          <li>Message frequency varies</li>
          <li>Message and data rates may apply</li>
          <li>Reply STOP to unsubscribe</li>
          <li>Reply HELP for assistance</li>
        </ul>

        <h2 style={styles.heading}>User Responsibilities</h2>
        <p style={styles.text}>
          You agree to provide accurate and complete information and not to use
          the system for unlawful purposes.
        </p>

        <h2 style={styles.heading}>Limitation of Liability</h2>
        <p style={styles.text}>
          Beyond Financing, Inc. is not liable for decisions made based on
          preliminary guidance provided by the system.
        </p>

        <h2 style={styles.heading}>Contact</h2>
        <p style={styles.text}>
          Beyond Financing, Inc.
          <br />
          support@beyondfinancing.com
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#EEF2F8",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#263366",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "40px 20px",
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    marginTop: 30,
    marginBottom: 10,
  },
  text: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "#4B5E85",
  },
  list: {
    paddingLeft: 20,
    color: "#4B5E85",
  },
};
