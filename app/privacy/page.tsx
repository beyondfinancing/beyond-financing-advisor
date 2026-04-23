export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Privacy Policy</h1>

        <p style={styles.text}>
          Beyond Intelligence™ is committed to protecting your privacy. This
          policy explains how we collect, use, and safeguard your information
          when you interact with our educational platform.
        </p>

        <h2 style={styles.heading}>Information We Collect</h2>
        <p style={styles.text}>
          We collect information you voluntarily provide, including:
        </p>
        <ul style={styles.list}>
          <li>Name, email address, and phone number</li>
          <li>Financial and mortgage-related information</li>
          <li>Property and transaction details</li>
        </ul>

        <h2 style={styles.heading}>How We Use Information</h2>
        <p style={styles.text}>
          Your information is used strictly for:
        </p>
        <ul style={styles.list}>
          <li>Mortgage scenario evaluation</li>
          <li>Communication with a licensed loan officer</li>
          <li>Application and consultation follow-up</li>
          <li>Internal workflow and processing coordination</li>
        </ul>

        <h2 style={styles.heading}>SMS Communication</h2>
        <p style={styles.text}>
          By submitting your phone number, you consent to receive transactional
          SMS messages related to your mortgage inquiry, including application
          updates, scheduling confirmations, and loan officer communication.
        </p>
        <p style={styles.text}>
          Message frequency varies. Message and data rates may apply.
        </p>
        <p style={styles.text}>
          You may opt out at any time by replying <strong>STOP</strong>, or get
          assistance by replying <strong>HELP</strong>.
        </p>

        <h2 style={styles.heading}>Data Sharing</h2>
        <p style={styles.text}>
          We do not sell or share your personal information with third parties
          for marketing purposes. Your information is only shared with licensed
          mortgage professionals and necessary service providers involved in
          your loan process.
        </p>

        <h2 style={styles.heading}>Data Security</h2>
        <p style={styles.text}>
          We implement industry-standard security measures to protect your
          information. However, no system can guarantee absolute security.
        </p>

        <h2 style={styles.heading}>Contact</h2>
        <p style={styles.text}>
          For questions regarding this policy, please contact:
          <br />
          Beyond Intelligence, LLC.
          <br />
          support@beyondintelligence.io
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
