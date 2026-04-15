import { NextResponse } from "next/server";

type ChatMessage = {
  role?: string;
  content?: string;
};

type LoanOfficerSelection = {
  id?: string;
  name?: string;
  nmls?: string;
  email?: string;
  assistantEmail?: string;
  mobile?: string;
  assistantMobile?: string;
};

type RoutingPayload = {
  loanOfficerQuery?: string;
  selectedOfficer?: LoanOfficerSelection;
  borrower?: {
    name?: string;
    email?: string;
    credit?: string;
    income?: string;
    debt?: string;
  };
  scenario?: {
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
  };
};

type RequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up";
  routing?: RoutingPayload;
  messages?: ChatMessage[];
};

type LoanOfficerRecord = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  mobile: string;
  assistantMobile: string;
};

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
  },
];

const DEFAULT_LOAN_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

function getLatestUserMessage(messages: ChatMessage[]) {
  const reversed = [...messages].reverse();
  return reversed.find((message) => message.role === "user")?.content ?? "";
}

function resolveLoanOfficer(routing?: RoutingPayload): LoanOfficerRecord {
  const selected = routing?.selectedOfficer;

  if (selected?.id) {
    const byId = LOAN_OFFICERS.find((officer) => officer.id === selected.id);
    if (byId) return byId;
  }

  if (selected?.nmls) {
    const byNmls = LOAN_OFFICERS.find(
      (officer) => officer.nmls.toLowerCase() === selected.nmls?.toLowerCase()
    );
    if (byNmls) return byNmls;
  }

  if (selected?.name) {
    const byName = LOAN_OFFICERS.find(
      (officer) => officer.name.toLowerCase() === selected.name?.toLowerCase()
    );
    if (byName) return byName;
  }

  const query = routing?.loanOfficerQuery?.trim().toLowerCase();

  if (query) {
    const exact = LOAN_OFFICERS.find(
      (officer) =>
        officer.name.toLowerCase() === query || officer.nmls.toLowerCase() === query
    );
    if (exact) return exact;

    const partial = LOAN_OFFICERS.find(
      (officer) =>
        officer.name.toLowerCase().includes(query) ||
        officer.nmls.toLowerCase().includes(query)
    );
    if (partial) return partial;
  }

  return DEFAULT_LOAN_OFFICER;
}

function buildInitialBorrowerReview(userMessage: string) {
  const lower = userMessage.toLowerCase();

  const hasIncome =
    lower.includes("gross monthly income:") &&
    !lower.includes("gross monthly income: not provided");

  const hasCredit =
    lower.includes("estimated credit score:") &&
    !lower.includes("estimated credit score: not provided");

  const hasDebt =
    lower.includes("monthly debt:") &&
    !lower.includes("monthly debt: not provided");

  const strengths: string[] = [];
  const attention: string[] = [];

  if (hasIncome) {
    strengths.push(
      "- Income information has been entered, which helps begin the preliminary review"
    );
  } else {
    attention.push(
      "- Income details still need to be entered clearly for a more useful review"
    );
  }

  if (hasCredit) {
    strengths.push(
      "- Estimated credit information has been provided for preliminary context"
    );
  } else {
    attention.push(
      "- Estimated credit information is still needed for better initial context"
    );
  }

  if (hasDebt) {
    strengths.push(
      "- Monthly debt has been included, which helps frame the payment discussion"
    );
  } else {
    attention.push(
      "- Monthly debt details should be included to better understand the overall picture"
    );
  }

  attention.push("- Final eligibility cannot be determined from intake alone");
  attention.push(
    "- Income, assets, credit, and occupancy must still be fully documented"
  );
  attention.push(
    "- Final payment structure and overall options depend on full review by a licensed loan officer"
  );

  return `
Finley Beyond Preliminary Review

General strengths in this scenario:
${strengths.length > 0 ? strengths.join("\n") : "- Basic information can now start the preliminary conversation"}

General areas that may need attention:
${attention.join("\n")}

Reasonable next steps:
- Review the basic borrower profile with a licensed loan officer
- Enter the target home price and estimated down payment next
- Prepare to discuss monthly payment comfort, available funds, and documentation
- Allow the licensed loan officer to review the full scenario under current requirements

Important reminder:
This is preliminary guidance only. Final direction must come from a licensed loan officer after full review of the scenario and current program requirements.
  `.trim();
}

function buildScenarioReview(userMessage: string) {
  const lower = userMessage.toLowerCase();

  const hasHomePrice =
    lower.includes("estimated home price:") &&
    !lower.includes("estimated home price: not provided");

  const hasDownPayment =
    lower.includes("estimated down payment:") &&
    !lower.includes("estimated down payment: not provided");

  const mentionsHighLtv =
    lower.includes("estimated ltv: 9") ||
    lower.includes("94%") ||
    lower.includes("95%");

  const factors = [
    "- Overall monthly payment comfort",
    "- Documented income and monthly obligations",
    "- Available funds needed for closing and reserves",
    "- The complete review by a licensed loan officer under current requirements",
  ];

  if (mentionsHighLtv) {
    factors.push(
      "- A higher loan-to-value structure may reduce flexibility and increase payment sensitivity"
    );
  }

  return `
Finley Beyond Scenario Review

What this target scenario means at a high level:
${
  hasHomePrice && hasDownPayment
    ? "You have now provided a target purchase scenario, which helps frame a more realistic preliminary conversation around payment expectations, funds needed to close, and the overall structure of the file."
    : "The target purchase scenario still needs to be completed so the conversation can be tied to the actual numbers you are considering."
}

Items to be prepared to discuss with a licensed loan officer:
- The home price range you are truly targeting
- The down payment you expect to have available
- Your preferred monthly payment comfort range
- Whether you want to preserve additional cash after closing
- Any income, debt, or asset details that may affect the review

General factors that may influence whether this scenario is workable:
${factors.join("\n")}

Important reminder:
This remains preliminary guidance only. Final guidance must come from a licensed loan officer after complete review of the full scenario.
  `.trim();
}

function buildFollowUpReply(userMessage: string) {
  const lower = userMessage.toLowerCase();

  if (
    lower.includes("can i buy a house") ||
    lower.includes("can i purchase a house") ||
    lower.includes("can i buy home")
  ) {
    return `
Based on the information entered so far, you may be able to continue exploring homeownership, but that cannot be confirmed from a preliminary conversation alone.

What matters next is:
- the full review of your income,
- your monthly obligations,
- your funds available for closing,
- the target home price,
- and the payment range you are comfortable with.

The best next step is to complete the target scenario and then speak with a licensed loan officer for a full review.
    `.trim();
  }

  if (
    lower.includes("how can i apply") ||
    lower.includes("apply for mortgage") ||
    lower.includes("how do i apply")
  ) {
    return `
A practical next step is to complete your basic information and target purchase scenario first, then connect with a licensed loan officer to begin the formal mortgage review process.

In general, applying for a mortgage usually involves:
- providing your contact and financial information,
- sharing income and asset documentation,
- authorizing credit review when appropriate,
- and reviewing the full scenario with a licensed loan officer.

Your licensed loan officer can then guide you through the actual application steps for your situation.
    `.trim();
  }

  if (
    lower.includes("speak with a loan officer") ||
    lower.includes("talk to a loan officer") ||
    lower.includes("contact a loan officer")
  ) {
    return `
The best next step is to connect directly with the assigned licensed loan officer after completing the borrower information and target scenario.

When you speak with the loan officer, be ready to discuss:
- your income,
- your monthly debts,
- your estimated down payment,
- your target home price,
- and your preferred monthly payment comfort range.

That will allow the licensed loan officer to review the scenario in detail and guide you properly.
    `.trim();
  }

  if (
    lower.includes("document") ||
    lower.includes("documents") ||
    lower.includes("prepare next") ||
    lower.includes("collect first")
  ) {
    return `
A strong next step is to prepare the core documents early so your licensed loan officer can review the full picture more efficiently.

Helpful items to gather:
- Recent income documentation
- Recent asset statements
- Government-issued identification
- Any information related to current debts or obligations
- Any documentation tied to gift funds, large deposits, or other funds being used in the transaction

Your licensed loan officer can then tell you exactly what additional items may be needed for your specific situation.
    `.trim();
  }

  if (
    lower.includes("improve") ||
    lower.includes("strengthen") ||
    lower.includes("make my file stronger")
  ) {
    return `
To strengthen a file, it usually helps to focus on the core areas a licensed loan officer will review most closely:

Common ways to strengthen the overall scenario:
- Keep funds for closing and reserves well documented
- Reduce outstanding monthly debt where practical
- Avoid major credit changes during the review process
- Be ready to provide complete and consistent documentation
- Discuss payment comfort and cash-to-close expectations early

A licensed loan officer can then determine which factors matter most for your particular scenario.
    `.trim();
  }

  if (
    lower.includes("down payment") ||
    lower.includes("put more down") ||
    lower.includes("increase the down payment")
  ) {
    return `
Increasing the down payment may improve the overall structure of the scenario.

Possible benefits may include:
- Lower overall loan amount
- Lower loan-to-value
- Lower monthly payment impact
- Greater flexibility depending on the full scenario review

Your licensed loan officer can compare the updated numbers and explain how a larger down payment may affect the overall structure of the file.
    `.trim();
  }

  if (
    lower.includes("monthly payment") ||
    lower.includes("payment") ||
    lower.includes("afford")
  ) {
    return `
Monthly payment comfort should be reviewed carefully alongside income, debts, funds needed to close, and the total monthly housing expense.

A helpful next step is to discuss:
- your ideal monthly payment range,
- how much cash you want to keep available after closing,
- and what level of flexibility matters most to you.

Your licensed loan officer can then help you compare realistic payment scenarios based on current conditions and full documentation.
    `.trim();
  }

  if (
    lower.includes("self-employed") ||
    lower.includes("self employed") ||
    lower.includes("1099")
  ) {
    return `
If income is self-employed or non-salaried, the review process may require a different documentation path.

That usually means your licensed loan officer will want to review:
- how the income is earned,
- how long it has been received,
- how it is documented,
- and whether the income is stable and usable under current requirements.

The best next step is to provide a clear picture of the income source so the licensed loan officer can evaluate it properly.
    `.trim();
  }

  return `
That is a good question to review with the full scenario in mind.

The most practical next step is to continue refining the borrower profile, complete the target home price and down payment scenario, and discuss the full picture with a licensed loan officer.

If you want, you can ask a more specific follow-up question about:
- whether the scenario seems workable,
- how to apply,
- how to speak with a loan officer,
- documents,
- down payment strategy,
- payment comfort,
- or how to strengthen the file.
  `.trim();
}

function buildInternalSummary(
  stage: string,
  assignedOfficer: LoanOfficerRecord,
  routing?: RoutingPayload
) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};

  return `
Beyond Intelligence Internal Summary

Stage:
${stage}

Assigned Loan Officer:
${assignedOfficer.name} — NMLS ${assignedOfficer.nmls}

Borrower:
- Name: ${borrower.name || "Not provided"}
- Email: ${borrower.email || "Not provided"}
- Estimated Credit Score: ${borrower.credit || "Not provided"}
- Gross Monthly Income: ${borrower.income || "Not provided"}
- Monthly Debt: ${borrower.debt || "Not provided"}

Target Scenario:
- Estimated Home Price: ${scenario.homePrice || "Not provided"}
- Estimated Down Payment: ${scenario.downPayment || "Not provided"}
- Estimated Loan Amount: ${scenario.estimatedLoanAmount || "Not provided"}
- Estimated LTV: ${scenario.estimatedLtv || "Not provided"}

Internal Follow-Up Direction:
- Review borrower contact information promptly
- Review conversation summary and scenario inputs
- Evaluate likely program directions internally
- Determine documentation needs and next borrower contact steps
- Confirm guidance under current investor guidelines and overlays
  `.trim();
}

async function queueInternalNotifications(args: {
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  summary: string;
  routing?: RoutingPayload;
}) {
  const borrowerName = args.routing?.borrower?.name || "Unknown Borrower";

  const emailPayload = {
    to: args.assignedOfficer.email,
    cc: args.assignedOfficer.assistantEmail,
    subject: `Beyond Intelligence Interaction — ${borrowerName}`,
    body: args.summary,
  };

  const smsPayload = [
    {
      to: args.assignedOfficer.mobile,
      message: `New Beyond Intelligence interaction received for ${borrowerName}. Review your email summary and follow up promptly.`,
    },
    {
      to: args.assignedOfficer.assistantMobile,
      message: `New Beyond Intelligence interaction received for ${borrowerName}. Review the assigned loan officer email summary.`,
    },
  ];

  console.log("EMAIL_NOTIFICATION_READY", emailPayload);
  console.log("SMS_NOTIFICATION_READY", smsPayload);

  /**
   * Future activation point:
   * - SendGrid / Resend / SMTP for email
   * - Twilio for SMS
   *
   * Example flow:
   * 1. send email to assignedOfficer.email
   * 2. cc assignedOfficer.assistantEmail
   * 3. send SMS to assignedOfficer.mobile
   * 4. send SMS to assignedOfficer.assistantMobile
   */
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const messages = body?.messages;
    const routing = body?.routing;
    const stage = body?.stage || "follow_up";

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { reply: "Missing or invalid messages array." },
        { status: 400 }
      );
    }

    const latestUserMessage = getLatestUserMessage(messages);

    if (!latestUserMessage.trim()) {
      return NextResponse.json(
        { reply: "The latest message content is empty." },
        { status: 400 }
      );
    }

    const lower = latestUserMessage.toLowerCase();

    const isInitialAnalysisRequest =
      lower.includes(
        "general strengths based on the borrower information currently entered"
      ) ||
      lower.includes("general areas that may need attention") ||
      lower.includes("clear next steps for the borrower");

    const isScenarioReviewRequest =
      lower.includes("the borrower has now entered the target property scenario") ||
      lower.includes("what this target scenario means at a high level") ||
      lower.includes(
        "general factors that may influence whether this target scenario is workable"
      );

    const assignedOfficer = resolveLoanOfficer(routing);

    const reply = isInitialAnalysisRequest
      ? buildInitialBorrowerReview(latestUserMessage)
      : isScenarioReviewRequest
      ? buildScenarioReview(latestUserMessage)
      : buildFollowUpReply(latestUserMessage);

    const internalSummary = buildInternalSummary(stage, assignedOfficer, routing);

    await queueInternalNotifications({
      stage,
      assignedOfficer,
      summary: internalSummary,
      routing,
    });

    return NextResponse.json({
      reply,
      assignedOfficer: {
        name: assignedOfficer.name,
        nmls: assignedOfficer.nmls,
        email: assignedOfficer.email,
        assistantEmail: assignedOfficer.assistantEmail,
      },
      internalSummaryPrepared: true,
    });
  } catch {
    return NextResponse.json(
      { reply: "Server error processing request." },
      { status: 500 }
    );
  }
}
