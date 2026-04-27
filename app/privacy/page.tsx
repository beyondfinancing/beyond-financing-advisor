export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#eef2f8",
        padding: "48px 20px",
        fontFamily: "Inter, Arial, Helvetica, sans-serif",
        color: "#263366",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", lineHeight: 1.7 }}>
        <h1 style={{ color: "#263366", fontSize: 32, marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#475569", marginTop: 0, marginBottom: 28 }}>
          Last updated: April 27, 2026
        </p>

        <p>
          Beyond Intelligence™, operated by Beyond Financing, Inc.
          (&ldquo;Beyond Intelligence,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
          is committed to protecting your privacy. This policy explains how we
          collect, use, store, and safeguard your information when you interact
          with our mortgage intelligence platform at beyondintelligence.io.
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>Information We Collect</h2>
        <p>We collect information you voluntarily provide, including:</p>
        <ul>
          <li>Name, email address, and mobile phone number</li>
          <li>Financial and mortgage-related information you submit</li>
          <li>Property and transaction details</li>
          <li>
            Conversation transcripts between you and the Beyond Intelligence™
            assistant
          </li>
        </ul>

        <h2 style={{ color: "#263366", marginTop: 32 }}>How We Use Information</h2>
        <p>Your information is used strictly for:</p>
        <ul>
          <li>Mortgage scenario evaluation</li>
          <li>Communication with the licensed loan officer you select</li>
          <li>Application and consultation follow-up</li>
          <li>Internal workflow and processing coordination</li>
          <li>Sending transactional SMS notifications you have consented to</li>
        </ul>

        <h2 style={{ color: "#263366", marginTop: 32 }}>SMS Communications</h2>
        <p>
          By submitting your mobile phone number through the Beyond
          Intelligence™ intake form, you consent to receive transactional SMS
          messages from Beyond Intelligence™ regarding your mortgage inquiry,
          including application activity, consultation scheduling, and
          follow-up from your assigned loan officer.
        </p>
        <p>Message frequency varies based on your account activity. Message and data rates may apply.</p>
        <p>
          You may opt out at any time by replying <strong>STOP</strong> to any
          message. For assistance, reply <strong>HELP</strong> or contact{" "}
          <a
            href="mailto:support@beyondintelligence.io"
            style={{ color: "#0096C7" }}
          >
            support@beyondintelligence.io
          </a>
          .
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>
          Mobile Information &amp; SMS Opt-In Data — No Third-Party Sharing
        </h2>
        <p style={{ fontWeight: 600 }}>
          Mobile information, mobile opt-in data, and SMS consent collected by
          Beyond Intelligence™ will not be shared, sold, rented, or otherwise
          disclosed to any third parties or affiliates for any purpose. This
          includes, but is not limited to, marketing, promotional, or
          lead-generation purposes. This restriction also applies to any
          information about your participation in our SMS program.
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>How We Share Other Information</h2>
        <p>
          We do not sell, rent, or share your personal information with third
          parties for marketing or promotional purposes. Information you submit
          (other than mobile opt-in data described above) may be shared only
          with:
        </p>
        <ul>
          <li>
            The specific licensed mortgage professional you have selected to
            assist with your loan inquiry
          </li>
          <li>
            Internal Beyond Financing, Inc. team members directly involved in
            servicing your inquiry (such as a processor or assistant assigned
            to your file)
          </li>
          <li>
            Service providers strictly necessary to operate the platform (such
            as our hosting, email, and SMS delivery infrastructure), each bound
            by confidentiality obligations and prohibited from using your data
            for their own marketing
          </li>
        </ul>
        <p>
          We do not share your information with affiliates, lead aggregators,
          marketing partners, or any third party for promotional purposes.
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>Data Security</h2>
        <p>
          We implement industry-standard technical and organizational measures
          to protect your information. However, no system can guarantee
          absolute security.
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your
          personal information at any time by contacting us at the address
          below. You may also opt out of SMS communications at any time as
          described above.
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The most current
          version will always be available at this URL with the &ldquo;Last
          updated&rdquo; date above.
        </p>

        <h2 style={{ color: "#263366", marginTop: 32 }}>Contact</h2>
        <p>For questions regarding this policy, please contact:</p>
        <p>
          Beyond Intelligence, LLC.
          <br />
          <a
            href="mailto:support@beyondintelligence.io"
            style={{ color: "#0096C7" }}
          >
            support@beyondintelligence.io
          </a>
        </p>
      </div>
    </main>
  );
}
