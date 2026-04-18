"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { evaluateFannieMaeSingleFamily } from "@/lib/lender-guidelines/fannie-mae/single-family/data";
import { evaluateFannieMaeMultifamily } from "@/lib/lender-guidelines/fannie-mae/multi-family/data";
import { evaluateFreddieMacSingleFamily } from "@/lib/lender-guidelines/freddie-mac/single-family/data";
import { evaluateFreddieMacMultifamily } from "@/lib/lender-guidelines/freddie-mac/multi-family/data";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Real Estate Agent";

type LoanPurpose = "Purchase" | "Refinance" | "Investment";

type TeamChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TeamScenario = {
  borrowerName: string;
  professionalName: string;
  professionalEmail: string;
  role: TeamRole;
  borrowerCurrentState: string;
  borrowerTargetState: string;
  loanPurpose: LoanPurpose;
  credit: string;
  income: string;
  debt: string;
  homePrice: string;
  downPayment: string;
  occupancy: string;
  incomeType: string;
  units: string;
  dscr: string;
};

type AccessCredential = {
  loginId: string;
  password: string;
  role: TeamRole;
  displayName: string;
  email?: string;
};

type ProgramSuggestion = {
  program: string;
  strength: string;
  notes: string[];
  lenderName?: string;
  source?: "database" | "agency";
};

type LiveMatch = {
  id: string;
  lender_id: string;
  name: string;
  min_credit: number;
  max_ltv: number;
  max_dti: number;
  occupancy: string;
  notes?: string;
  created_at?: string;
  lenders?: {
    name?: string;
  } | null;
};

type LiveMatchResponse = {
  matches?: LiveMatch[];
};

type PasswordOverrideMap = Record<string, string>;

type ProfessionalSession = {
  isAuthenticated: boolean;
  loginId: string;
  role: TeamRole;
  name: string;
  email?: string;
};

const PROFESSIONAL_SESSION_KEY = "beyond_professional_session";
const TEAM_PASSWORD_OVERRIDES_KEY = "beyond_team_password_overrides";

const ACCESS_CREDENTIALS: AccessCredential[] = [
  {
    loginId: "1625542",
    password: "ChangeMeSandro1!",
    role: "Loan Officer",
    displayName: "Sandro Pansini Souza",
    email: "pansini@beyondfinancing.com",
  },
  {
    loginId: "2394496FB",
    password: "ChangeMeFinley1!",
    role: "Loan Officer Assistant",
    displayName: "Finley Beyond",
    email: "finley@beyondfinancing.com",
  },
  {
    loginId: "2394496AS",
    password: "AmarilisAS!2394",
    role: "Processor",
    displayName: "Amarilis Santos",
    email: "amarilis@beyondfinancing.com",
  },
  {
    loginId: "18959",
    password: "Warren18959!BI",
    role: "Loan Officer",
    displayName: "Warren Wendt",
    email: "warren@beyondfinancing.com",
  },
  {
    loginId: "2394496KN",
    password: "KyleKN!2394",
    role: "Processor",
    displayName: "Kyle Nicholson",
    email: "kyle@beyondfinancing.com",
  },
  {
    loginId: "2749644",
    password: "Nate2749644!BI",
    role: "Loan Officer",
    displayName: "Nate Hubley",
    email: "nate@beyondfinancing.com",
  },
  {
    loginId: "2394496BM",
    password: "BiaBM!2394",
    role: "Loan Officer Assistant",
    displayName: "Bia Marques",
    email: "bia@beyondfinancing.com",
  },
  {
    loginId: "REA001",
    password: "ChangeMeAgent1!",
    role: "Real Estate Agent",
    displayName: "Sample Real Estate Agent",
  },
];

function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    minWidth: 0,
    boxSizing: "border-box",
  };
}

function buttonPrimaryStyle(disabled = false): React.CSSProperties {
  return {
    background: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function buttonSecondaryStyle(active = false): React.CSSProperties {
  return {
    background: active ? "#0096C7" : "#fff",
    color: active ? "#fff" : "#263366",
    border: "1px solid #263366",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function normalizeOccupancy(
  value: string
): "primary" | "second" | "investment" | "mixed-use" | "other" {
  const lower = value.toLowerCase();
  if (lower.includes("primary")) return "primary";
  if (lower.includes("second")) return "second";
  if (lower.includes("investment")) return "investment";
  if (lower.includes("mixed")) return "mixed-use";
  return "other";
}

function formatOccupancyForApi(value: string): string {
  const normalized = normalizeOccupancy(value);
  switch (normalized) {
    case "primary":
      return "Primary residence";
    case "second":
      return "Second home";
    case "investment":
      return "Investment";
    case "mixed-use":
      return "Mixed-use";
    default:
      return value || "";
  }
}

function getRoleObjective(role: TeamRole): string {
  switch (role) {
    case "Loan Officer":
      return "Focus on qualification direction, program fit, borrower strength, risk flags, and next underwriting questions.";
    case "Loan Officer Assistant":
      return "Focus on intake completeness, borrower follow-up, unanswered questions, missing details, and communication preparation for the loan officer.";
    case "Processor":
      return "Focus on documentation readiness, missing items, verifications, timeline blockers, and what the file still needs before clean review.";
    case "Real Estate Agent":
      return "Focus on deal viability, borrower readiness, likely financing path, timing strength, and what needs to happen next to move toward contract confidence.";
    default:
      return "Focus on structured mortgage scenario analysis.";
  }
}

function getRolePrompt(role: TeamRole, scenario: TeamScenario): string {
  const borrowerName = scenario.borrowerName || "the borrower";

  switch (role) {
    case "Loan Officer":
      return `Act as Finley Beyond supporting a Loan Officer. Analyze ${borrowerName}'s scenario from a loan structuring perspective. First prioritize Beyond Intelligence live lender-program matches, then use general agency logic only as fallback. Emphasize likely program direction, qualification alignment, material risk flags, compensating factors, and the next 3-5 underwriting-focused questions the loan officer should ask.`;
    case "Loan Officer Assistant":
      return `Act as Finley Beyond supporting a Loan Officer Assistant. Analyze ${borrowerName}'s scenario from an intake and borrower-preparation perspective. First prioritize Beyond Intelligence live lender-program matches, then use general agency logic only as fallback. Emphasize unanswered intake questions, missing borrower facts, likely documents to request next, and what should be organized before handing the file to the loan officer.`;
    case "Processor":
      return `Act as Finley Beyond supporting a Processor. Analyze ${borrowerName}'s scenario from a file-readiness perspective. First prioritize Beyond Intelligence live lender-program matches, then use general agency logic only as fallback. Emphasize missing documentation, expected verifications, timeline blockers, underwriting support items, and what should be cleaned up before the file progresses.`;
    case "Real Estate Agent":
      return `Act as Finley Beyond supporting a Real Estate Agent. Analyze ${borrowerName}'s scenario from a transaction-readiness perspective. First prioritize Beyond Intelligence live lender-program matches, then use general agency logic only as fallback. Emphasize borrower strength, likely financing direction, timing readiness, possible pressure points that could affect contract strategy, and the next actions the agent and loan team should coordinate.`;
    default:
      return `Act as Finley Beyond supporting a mortgage professional reviewing ${borrowerName}'s scenario.`;
  }
}

function getRoleStarterMessage(role: TeamRole): string {
  switch (role) {
    case "Loan Officer":
      return "I am ready to review this borrower scenario from a loan officer perspective. Help me narrow program direction, qualification alignment, and risk.";
    case "Loan Officer Assistant":
      return "I am ready to review this borrower scenario from a loan officer assistant perspective. Help me identify missing questions, borrower follow-up items, and likely documents to request.";
    case "Processor":
      return "I am ready to review this borrower scenario from a processor perspective. Help me identify missing documentation, verification items, and file-readiness issues.";
    case "Real Estate Agent":
      return "I am ready to review this borrower scenario from a real estate agent perspective. Help me understand buyer readiness, likely financing direction, and next coordination steps.";
    default:
      return "I am ready to review this borrower scenario.";
  }
}

function buildRoleNotes(role: TeamRole): string[] {
  switch (role) {
    case "Loan Officer":
      return [
        "Finley Beyond will speak in loan-structuring language.",
        "Expect focus on qualification, program fit, compensating factors, and risk flags.",
        "Live Beyond Intelligence lender matches are prioritized before fallback agency logic.",
      ];
    case "Loan Officer Assistant":
      return [
        "Finley Beyond will emphasize intake completion and follow-up preparation.",
        "Expect focus on missing answers, missing borrower facts, and next document requests.",
        "Live Beyond Intelligence lender matches are prioritized before fallback agency logic.",
      ];
    case "Processor":
      return [
        "Finley Beyond will emphasize file-readiness and documentation discipline.",
        "Expect focus on missing documents, verifications, conditions, and timeline blockers.",
        "Live Beyond Intelligence lender matches are prioritized before fallback agency logic.",
      ];
    case "Real Estate Agent":
      return [
        "Finley Beyond will emphasize deal readiness and transaction clarity.",
        "Expect focus on timing, borrower strength, likely financing path, and coordination points.",
        "Live Beyond Intelligence lender matches are prioritized before fallback agency logic.",
      ];
    default:
      return ["Role notes unavailable."];
  }
}

function buildMissingDocumentChecklist(
  role: TeamRole,
  scenario: TeamScenario
): string[] {
  const docs: string[] = [];

  if (!scenario.borrowerName.trim()) docs.push("Borrower full name");
  if (!scenario.professionalEmail.trim())
    docs.push("Professional email for summary routing");
  if (!scenario.credit.trim()) docs.push("Credit score or credit estimate");
  if (!scenario.income.trim()) docs.push("Gross monthly income");
  if (!scenario.homePrice.trim()) docs.push("Estimated home price");
  if (!scenario.downPayment.trim()) docs.push("Estimated down payment or equity");
  if (!scenario.occupancy.trim()) docs.push("Occupancy intent");
  if (!scenario.borrowerCurrentState.trim())
    docs.push("Borrower current state");
  if (!scenario.borrowerTargetState.trim())
    docs.push("Borrower target state");

  if (
    role === "Loan Officer Assistant" ||
    role === "Processor" ||
    role === "Loan Officer"
  ) {
    docs.push("Government-issued ID");
    docs.push("Recent pay stubs or income support");
    docs.push("Last 2 months bank statements");
    docs.push("Authorization to pull credit if applicable");
  }

  if (role === "Processor") {
    docs.push("Asset sourcing review");
    docs.push("Employment / income verification plan");
    docs.push("Purchase contract if already under agreement");
    docs.push("Real estate owned schedule if applicable");
  }

  if (role === "Loan Officer") {
    docs.push("Income type clarification");
    docs.push("Employment history / self-employment history");
    docs.push("Existing real estate owned details");
  }

  if (role === "Real Estate Agent") {
    docs.push("Loan officer confirmation");
    docs.push("Timeline to apply / pre-approval");
    docs.push("Funds-to-close discussion");
  }

  return Array.from(new Set(docs));
}

function extractReply(data: unknown): string {
  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null) {
    const obj = data as {
      reply?: string;
      message?: string;
      content?: string;
      response?: string;
      error?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

    return (
      obj.reply ||
      obj.message ||
      obj.content ||
      obj.response ||
      obj.choices?.[0]?.message?.content ||
      ""
    );
  }

  return "";
}

function loadPasswordOverrides(): PasswordOverrideMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(TEAM_PASSWORD_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PasswordOverrideMap;
  } catch {
    return {};
  }
}

function savePasswordOverrides(value: PasswordOverrideMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_PASSWORD_OVERRIDES_KEY, JSON.stringify(value));
}

function storeProfessionalSession(user: AccessCredential) {
  if (typeof window === "undefined") return;

  const session: ProfessionalSession = {
    isAuthenticated: true,
    loginId: user.loginId,
    role: user.role,
    name: user.displayName,
    email: user.email,
  };

  window.localStorage.setItem(PROFESSIONAL_SESSION_KEY, JSON.stringify(session));
}

function clearProfessionalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFESSIONAL_SESSION_KEY);
}

function findCredentialByLoginOrEmail(value: string): AccessCredential | undefined {
  const normalized = value.trim().toLowerCase();

  return ACCESS_CREDENTIALS.find((item) => {
    const loginMatch = item.loginId.trim().toLowerCase() === normalized;
    const emailMatch = (item.email || "").trim().toLowerCase() === normalized;
    return loginMatch || emailMatch;
  });
}

export default function TeamPage() {
  const [accessLoginId, setAccessLoginId] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);
  const [authorizedUser, setAuthorizedUser] = useState<AccessCredential | null>(
    null
  );

  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetLoginIdOrEmail, setResetLoginIdOrEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const [scenario, setScenario] = useState<TeamScenario>({
    borrowerName: "",
    professionalName: "",
    professionalEmail: "",
    role: "Loan Officer",
    borrowerCurrentState: "",
    borrowerTargetState: "",
    loanPurpose: "Purchase",
    credit: "",
    income: "",
    debt: "",
    homePrice: "",
    downPayment: "",
    occupancy: "",
    incomeType: "",
    units: "",
    dscr: "",
  });

  const [messages, setMessages] = useState<TeamChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to the Beyond Intelligence team workspace. Enter the borrower scenario name and key details, then collaborate with Finley Beyond to narrow likely program direction.",
    },
  ]);

  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [chatError, setChatError] = useState("");
  const [emailError, setEmailError] = useState("");

  const [liveProgramSuggestions, setLiveProgramSuggestions] = useState<
    ProgramSuggestion[]
  >([]);
  const [liveMatchError, setLiveMatchError] = useState("");
  const [loadingLiveMatches, setLoadingLiveMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(PROFESSIONAL_SESSION_KEY);
      if (!raw) return;

      const session = JSON.parse(raw) as ProfessionalSession;
      if (!session?.isAuthenticated || !session.loginId) return;

      const credential = ACCESS_CREDENTIALS.find(
        (item) => item.loginId === session.loginId
      );

      if (!credential) return;

      setAuthorizedUser(credential);
      setAccessGranted(true);
      setAccessLoginId(credential.loginId);
      setScenario((prev) => ({
        ...prev,
        professionalName: credential.displayName,
        professionalEmail: credential.email || prev.professionalEmail,
        role: credential.role,
      }));
      setMessages([
        {
          role: "assistant",
          content: `Welcome ${credential.displayName}. ${getRoleObjective(
            credential.role
          )}`,
        },
      ]);
    } catch {
      // ignore bad session
    }
  }, []);

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(scenario.homePrice || 0);
    const downPayment = Number(scenario.downPayment || 0);
    const value = Math.max(homePrice - downPayment, 0);
    return value > 0 ? value : 0;
  }, [scenario.homePrice, scenario.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenario.homePrice || 0);
    const downPayment = Number(scenario.downPayment || 0);
    if (!homePrice) return 0;
    return Math.max(0, Math.round(((homePrice - downPayment) / homePrice) * 100));
  }, [scenario.homePrice, scenario.downPayment]);

  const estimatedDti = useMemo(() => {
    const income = Number(scenario.income || 0);
    const debt = Number(scenario.debt || 0);
    if (!income) return 0;
    return Math.max(0, Math.round((debt / income) * 100));
  }, [scenario.income, scenario.debt]);

  useEffect(() => {
    const credit = Number(scenario.credit || 0);
    const ltv = estimatedLtv;
    const dti = estimatedDti;
    const occupancy = formatOccupancyForApi(scenario.occupancy);

    if (!credit || !ltv || !occupancy) {
      setLiveProgramSuggestions([]);
      setLiveMatchError("");
      return;
    }

    let cancelled = false;

    async function loadLiveMatches() {
      setLoadingLiveMatches(true);
      setLiveMatchError("");

      try {
        const response = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credit,
            ltv,
            dti,
            occupancy,
          }),
        });

        const data: LiveMatchResponse = await response.json();

        if (!response.ok) {
          throw new Error(`Live match request failed with status ${response.status}.`);
        }

        if (cancelled) return;

        const suggestions: ProgramSuggestion[] = Array.isArray(data.matches)
          ? data.matches.map((match) => ({
              program: match.name,
              lenderName: match.lenders?.name || "Unknown lender",
              strength: "strong",
              source: "database",
              notes: [
                `Minimum credit: ${match.min_credit}`,
                `Maximum LTV: ${match.max_ltv}%`,
                `Maximum DTI: ${match.max_dti}%`,
                `Occupancy: ${match.occupancy}`,
                ...(match.notes ? [match.notes] : []),
              ],
            }))
          : [];

        setLiveProgramSuggestions(suggestions);
      } catch (error) {
        if (cancelled) return;

        setLiveProgramSuggestions([]);
        setLiveMatchError(
          error instanceof Error
            ? error.message
            : "Unable to load live lender-program matches."
        );
      } finally {
        if (!cancelled) {
          setLoadingLiveMatches(false);
        }
      }
    }

    loadLiveMatches();

    return () => {
      cancelled = true;
    };
  }, [scenario.credit, scenario.occupancy, estimatedLtv, estimatedDti]);

  const fallbackAgencySuggestions: ProgramSuggestion[] = useMemo(() => {
    const credit = Number(scenario.credit || 0);
    const ltv = estimatedLtv;
    const occupancy = normalizeOccupancy(scenario.occupancy);
    const dti =
      Number(scenario.income || 0) > 0
        ? (Number(scenario.debt || 0) / Number(scenario.income || 0)) * 100
        : undefined;

    const units = Number(scenario.units || 0) || undefined;
    const dscr = Number(scenario.dscr || 0) || undefined;
    const isMulti = (units || 0) >= 5;

    if (!credit || !ltv) return [];

    if (!isMulti) {
      const fannie = evaluateFannieMaeSingleFamily({
        creditScore: credit,
        ltv,
        dti,
        occupancy:
          occupancy === "primary" ||
          occupancy === "second" ||
          occupancy === "investment"
            ? occupancy
            : "primary",
        firstTimeBuyer: false,
      }).filter((x) => x.eligible);

      const freddie = evaluateFreddieMacSingleFamily({
        creditScore: credit,
        ltv,
        dti,
        occupancy:
          occupancy === "primary" ||
          occupancy === "second" ||
          occupancy === "investment"
            ? occupancy
            : "primary",
        firstTimeBuyer: false,
      }).filter((x) => x.eligible);

      return [...fannie, ...freddie].slice(0, 5).map((item) => ({
        program: item.program,
        strength: item.strength,
        notes: item.notes,
        source: "agency",
      }));
    }

    const fannieMf = evaluateFannieMaeMultifamily({
      creditScore: credit || undefined,
      ltv,
      dscr,
      occupancy: occupancy === "mixed-use" ? "mixed-use" : "investment",
      units,
      experienceLevel: "experienced-investor",
    }).filter((x) => x.eligible);

    const freddieMf = evaluateFreddieMacMultifamily({
      creditScore: credit || undefined,
      ltv,
      dscr,
      occupancy: occupancy === "mixed-use" ? "mixed-use" : "investment",
      units,
      experienceLevel: "experienced-investor",
    }).filter((x) => x.eligible);

    return [...fannieMf, ...freddieMf].slice(0, 5).map((item) => ({
      program: item.program,
      strength: item.strength,
      notes: item.notes,
      source: "agency",
    }));
  }, [
    scenario.credit,
    scenario.occupancy,
    scenario.income,
    scenario.debt,
    scenario.units,
    scenario.dscr,
    estimatedLtv,
  ]);

  const onScreenSuggestions = useMemo(() => {
    if (liveProgramSuggestions.length > 0) {
      return liveProgramSuggestions;
    }

    return fallbackAgencySuggestions;
  }, [liveProgramSuggestions, fallbackAgencySuggestions]);

  const roleNotes = useMemo(
    () => buildRoleNotes(scenario.role),
    [scenario.role]
  );

  const documentChecklist = useMemo(
    () => buildMissingDocumentChecklist(scenario.role, scenario),
    [scenario.role, scenario]
  );

  const handleAccessLogin = () => {
    const credential = findCredentialByLoginOrEmail(accessLoginId);

    if (!credential) {
      setAccessError("Invalid login credentials. Please try again.");
      setAccessGranted(false);
      setAuthorizedUser(null);
      clearProfessionalSession();
      return;
    }

    const overrides = loadPasswordOverrides();
    const effectivePassword = overrides[credential.loginId] || credential.password;

    if (effectivePassword !== accessPassword) {
      setAccessError("Invalid login credentials. Please try again.");
      setAccessGranted(false);
      setAuthorizedUser(null);
      clearProfessionalSession();
      return;
    }

    setAccessError("");
    setAuthorizedUser(credential);
    setAccessGranted(true);
    setChatError("");
    setEmailError("");
    setResetError("");
    setResetSuccess("");
    storeProfessionalSession(credential);

    setScenario((prev) => ({
      ...prev,
      professionalName: credential.displayName,
      professionalEmail: credential.email || prev.professionalEmail,
      role: credential.role,
    }));

    setMessages([
      {
        role: "assistant",
        content: `Welcome ${credential.displayName}. ${getRoleObjective(
          credential.role
        )}`,
      },
    ]);
  };

  const handlePasswordReset = () => {
    setResetError("");
    setResetSuccess("");

    const credential = findCredentialByLoginOrEmail(resetLoginIdOrEmail);

    if (!credential) {
      setResetError("No matching professional account was found for that Login ID or email.");
      return;
    }

    if (!resetNewPassword.trim()) {
      setResetError("Please enter a new password.");
      return;
    }

    if (resetNewPassword.trim().length < 10) {
      setResetError("The new password must contain at least 10 characters.");
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("The new password and confirmation do not match.");
      return;
    }

    const overrides = loadPasswordOverrides();
    overrides[credential.loginId] = resetNewPassword;
    savePasswordOverrides(overrides);

    setResetSuccess(
      `Password reset completed for ${credential.displayName}. You can now sign in with ${credential.email || credential.loginId}.`
    );
    setResetLoginIdOrEmail("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setAccessError("");
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    if (!scenario.borrowerName.trim()) {
      alert("Please enter a Borrower Scenario Name first.");
      return;
    }

    setSending(true);
    setChatError("");

    const nextMessages: TeamChatMessage[] = [
      ...messages,
      { role: "user", content: chatInput.trim() },
    ];

    try {
      const response = await fetch("/api/teamchat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          scenario,
          messages: nextMessages,
          suggestions: onScreenSuggestions,
          authorizedUser: authorizedUser?.displayName || "",
          authorizedRole: authorizedUser?.role || "",
          rolePrompt: getRolePrompt(scenario.role, scenario),
          roleObjective: getRoleObjective(scenario.role),
          roleDocumentChecklist: documentChecklist,
        }),
      });

      const rawData: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          extractReply(rawData) ||
          (typeof rawData === "object" &&
          rawData !== null &&
          "error" in rawData &&
          typeof (rawData as { error?: unknown }).error === "string"
            ? (rawData as { error: string }).error
            : "") ||
          `Request failed with status ${response.status}.`;
        throw new Error(message);
      }

      const fallbackReply = `${getRoleObjective(
        scenario.role
      )} Based on the current scenario, continue by clarifying income structure, occupancy, timeline, and documentation readiness.`;

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: extractReply(rawData) || fallbackReply,
        },
      ]);

      setChatInput("");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send the message to Finley Beyond.";
      setChatError(message);
    } finally {
      setSending(false);
    }
  };

  const emailSummary = async () => {
    if (!scenario.borrowerName.trim()) {
      alert("Borrower Scenario Name is required.");
      return;
    }

    if (!scenario.professionalEmail.trim()) {
      alert("Professional Email is required.");
      return;
    }

    setEmailing(true);
    setEmailError("");

    try {
      const response = await fetch("/api/teamchat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          scenario,
          messages,
          suggestions: onScreenSuggestions,
          authorizedUser: authorizedUser?.displayName || "",
          authorizedRole: authorizedUser?.role || "",
          accessLoginId,
          rolePrompt: getRolePrompt(scenario.role, scenario),
          roleObjective: getRoleObjective(scenario.role),
          roleDocumentChecklist: documentChecklist,
        }),
      });

      const rawData: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          extractReply(rawData) ||
          (typeof rawData === "object" &&
          rawData !== null &&
          "error" in rawData &&
          typeof (rawData as { error?: unknown }).error === "string"
            ? (rawData as { error: string }).error
            : "") ||
          `Summary request failed with status ${response.status}.`;
        throw new Error(message);
      }

      if (
        typeof rawData === "object" &&
        rawData !== null &&
        "success" in rawData &&
        (rawData as { success?: boolean }).success
      ) {
        alert("Summary emailed successfully.");
      } else {
        throw new Error(
          (typeof rawData === "object" &&
          rawData !== null &&
          "error" in rawData &&
          typeof (rawData as { error?: unknown }).error === "string"
            ? (rawData as { error: string }).error
            : "") || "Summary email could not be sent."
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to email the summary.";
      setEmailError(message);
      alert(message);
    } finally {
      setEmailing(false);
    }
  };

  const startRoleReview = () => {
    if (!scenario.borrowerName.trim()) {
      alert("Please enter a Borrower Scenario Name first.");
      return;
    }

    const starter = getRoleStarterMessage(scenario.role);
    setMessages([
      ...messages,
      { role: "user", content: starter },
      {
        role: "assistant",
        content: `${getRoleObjective(
          scenario.role
        )} I am ready to help review this scenario for ${scenario.borrowerName}.`,
      },
    ]);
    setChatError("");
    setEmailError("");
  };

  const handleSignOut = () => {
    setAccessGranted(false);
    setAuthorizedUser(null);
    setAccessLoginId("");
    setAccessPassword("");
    setChatError("");
    setEmailError("");
    clearProfessionalSession();
  };

  if (!accessGranted) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#F1F3F8",
          color: "#263366",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "28px 20px 48px",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: 999,
              background: "#E8EEF8",
              color: "#263366",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            PROFESSIONAL ACCESS
          </div>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "clamp(34px, 6vw, 54px)",
              lineHeight: 1.15,
            }}
          >
            Team Workspace Login
          </h1>

          <p
            style={{
              margin: "0 0 22px",
              color: "#5A6A84",
              lineHeight: 1.7,
              fontSize: "clamp(16px, 2.3vw, 18px)",
            }}
          >
            Loan officers, loan officer assistants, processors, and real estate
            agents must enter valid credentials before accessing Beyond
            Intelligence professional tools.
          </p>

          <div style={cardStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Access Gate</h2>

            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #D9E1EC",
                borderRadius: 16,
                padding: 16,
                lineHeight: 1.8,
                marginBottom: 18,
                color: "#4B5C78",
              }}
            >
              <div>
                <strong>Loan Officer Login ID:</strong> NMLS # or company email
              </div>
              <div>
                <strong>Loan Officer Assistant / Processor Login ID:</strong>{" "}
                Company NMLS # + initials or company email
              </div>
              <div>
                <strong>Example:</strong> Finley Beyond = 2394496FB
              </div>
              <div>
                <strong>Borrowers:</strong> no login required
              </div>
              <div>
                <strong>Current Sandro test login:</strong> 1625542 or pansini@beyondfinancing.com
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 14,
              }}
            >
              <input
                placeholder="Login ID or Email"
                value={accessLoginId}
                onChange={(e) => setAccessLoginId(e.target.value)}
                style={inputStyle()}
              />
              <input
                type="password"
                placeholder="Password"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                style={inputStyle()}
              />
            </div>

            {accessError && (
              <div
                style={{
                  marginTop: 14,
                  background: "#FFF4F2",
                  border: "1px solid #F3C5BC",
                  color: "#8A3B2F",
                  borderRadius: 14,
                  padding: 14,
                  lineHeight: 1.6,
                }}
              >
                {accessError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 18,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={handleAccessLogin}
                style={buttonPrimaryStyle(false)}
              >
                Access Team Workspace
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowResetPanel((prev) => !prev);
                  setResetError("");
                  setResetSuccess("");
                }}
                style={buttonSecondaryStyle(false)}
              >
                {showResetPanel ? "Hide Reset Password" : "Forgot / Reset Password"}
              </button>

              <Link
                href="/"
                style={{
                  ...buttonSecondaryStyle(false),
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Back to Beyond Intelligence
              </Link>
            </div>

            {showResetPanel && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: "1px solid #E0E7F0",
                }}
              >
                <h3 style={{ margin: "0 0 12px 0", fontSize: 18 }}>
                  Reset Password
                </h3>

                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 16,
                    lineHeight: 1.7,
                    marginBottom: 16,
                    color: "#4B5C78",
                  }}
                >
                  This reset works for the current browser/device as a testing recovery tool. It is not yet the final production-grade password reset system.
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 14,
                  }}
                >
                  <input
                    placeholder="Enter Login ID or Email"
                    value={resetLoginIdOrEmail}
                    onChange={(e) => setResetLoginIdOrEmail(e.target.value)}
                    style={inputStyle()}
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    style={inputStyle()}
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    style={inputStyle()}
                  />
                </div>

                {resetError && (
                  <div
                    style={{
                      marginTop: 14,
                      background: "#FFF4F2",
                      border: "1px solid #F3C5BC",
                      color: "#8A3B2F",
                      borderRadius: 14,
                      padding: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {resetError}
                  </div>
                )}

                {resetSuccess && (
                  <div
                    style={{
                      marginTop: 14,
                      background: "#EEF9F1",
                      border: "1px solid #B7E0C1",
                      color: "#206A3A",
                      borderRadius: 14,
                      padding: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {resetSuccess}
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    style={buttonPrimaryStyle(false)}
                  >
                    Save New Password
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: "1px solid #E0E7F0",
                color: "#6A7890",
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              Bot prevention such as reCAPTCHA, Turnstile, or hCaptcha will be
              added later as a separate stop block for production use.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: 20 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                background: "#E8EEF8",
                color: "#263366",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              TEAM WORKSPACE
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(34px, 6vw, 54px)",
                lineHeight: 1.15,
              }}
            >
              Finley Beyond for Professionals
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: "clamp(16px, 2.5vw, 18px)",
              }}
            >
              Loan officers, loan officer assistants, processors, and real
              estate agents can discuss borrower scenarios with Finley Beyond
              and receive a professional summary by email when the review is
              complete.
            </p>

            <div
              style={{
                marginTop: 14,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              Signed in as <strong>{authorizedUser?.displayName}</strong> —{" "}
              {authorizedUser?.role} ({authorizedUser?.loginId})
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSignOut}
              style={buttonSecondaryStyle(false)}
            >
              Sign Out
            </button>

            <Link
              href="/"
              style={{
                textDecoration: "none",
                color: "#263366",
                fontWeight: 700,
                alignSelf: "center",
              }}
            >
              Back to Beyond Intelligence
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Scenario Setup</h2>

              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 18,
                  lineHeight: 1.8,
                  color: "#4B5C78",
                }}
              >
                <strong>Role Objective:</strong> {getRoleObjective(scenario.role)}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <input
                  placeholder="Borrower Scenario Name"
                  value={scenario.borrowerName}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      borrowerName: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Professional Name"
                  value={scenario.professionalName}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      professionalName: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Professional Email"
                  value={scenario.professionalEmail}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      professionalEmail: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <select
                  value={scenario.role}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      role: e.target.value as TeamRole,
                    }))
                  }
                  style={inputStyle()}
                >
                  <option>Loan Officer</option>
                  <option>Loan Officer Assistant</option>
                  <option>Processor</option>
                  <option>Real Estate Agent</option>
                </select>
                <input
                  placeholder="Borrower Current State"
                  value={scenario.borrowerCurrentState}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      borrowerCurrentState: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Borrower Target State"
                  value={scenario.borrowerTargetState}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      borrowerTargetState: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  Loan Purpose
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {(["Purchase", "Refinance", "Investment"] as LoanPurpose[]).map(
                    (purpose) => (
                      <button
                        key={purpose}
                        type="button"
                        onClick={() =>
                          setScenario((prev) => ({ ...prev, loanPurpose: purpose }))
                        }
                        style={buttonSecondaryStyle(scenario.loanPurpose === purpose)}
                      >
                        {purpose}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <input
                  placeholder="Estimated Credit Score"
                  value={scenario.credit}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, credit: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Gross Monthly Income"
                  value={scenario.income}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, income: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Monthly Debt"
                  value={scenario.debt}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, debt: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Estimated Home Price"
                  value={scenario.homePrice}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, homePrice: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Estimated Down Payment"
                  value={scenario.downPayment}
                  onChange={(e) =>
                    setScenario((prev) => ({
                      ...prev,
                      downPayment: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
                <select
                  value={scenario.occupancy}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, occupancy: e.target.value }))
                  }
                  style={inputStyle()}
                >
                  <option value="">Occupancy</option>
                  <option value="Primary residence">Primary residence</option>
                  <option value="Second home">Second home</option>
                  <option value="Investment">Investment</option>
                  <option value="Mixed-use">Mixed-use</option>
                </select>
                <input
                  placeholder="Income Type"
                  value={scenario.incomeType}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, incomeType: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="Units"
                  value={scenario.units}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, units: e.target.value }))
                  }
                  style={inputStyle()}
                />
                <input
                  placeholder="DSCR"
                  value={scenario.dscr}
                  onChange={(e) =>
                    setScenario((prev) => ({ ...prev, dscr: e.target.value }))
                  }
                  style={inputStyle()}
                />
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 16,
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div>
                  <strong>Estimated Loan Amount:</strong> {estimatedLoanAmount || 0}
                </div>
                <div>
                  <strong>Estimated LTV:</strong> {estimatedLtv || 0}%
                </div>
                <div>
                  <strong>Estimated DTI:</strong> {estimatedDti || 0}%
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  onClick={startRoleReview}
                  style={buttonPrimaryStyle(false)}
                >
                  Start Role-Based Review
                </button>
              </div>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                Conversation with Finley Beyond
              </h2>

              <div
                style={{
                  minHeight: 320,
                  maxHeight: 560,
                  overflowY: "auto",
                  padding: 14,
                  borderRadius: 16,
                  background: "#F8FAFC",
                  border: "1px solid #D9E1EC",
                }}
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    style={{
                      marginBottom: 14,
                      padding: 14,
                      borderRadius: 14,
                      background: message.role === "assistant" ? "#FFFFFF" : "#DBEAFE",
                      border: "1px solid #D9E1EC",
                      lineHeight: 1.7,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        marginBottom: 8,
                        color: "#263366",
                      }}
                    >
                      {message.role === "assistant"
                        ? "Finley Beyond"
                        : scenario.professionalName || "Professional"}
                    </div>
                    <div>{message.content}</div>
                  </div>
                ))}
              </div>

              {chatError && (
                <div
                  style={{
                    marginTop: 14,
                    background: "#FFF4F2",
                    border: "1px solid #F3C5BC",
                    color: "#8A3B2F",
                    borderRadius: 14,
                    padding: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {chatError}
                </div>
              )}

              {emailError && (
                <div
                  style={{
                    marginTop: 14,
                    background: "#FFF9EC",
                    border: "1px solid #E9D4A7",
                    color: "#8A6A1F",
                    borderRadius: 14,
                    padding: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {emailError}
                </div>
              )}

              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Discuss the scenario with Finley Beyond. Example: Can this borrower qualify?"
                  rows={5}
                  style={{
                    ...inputStyle(),
                    resize: "vertical",
                    minHeight: 120,
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending}
                    style={buttonPrimaryStyle(sending)}
                  >
                    {sending ? "Sending..." : "Send to Finley Beyond"}
                  </button>

                  <button
                    type="button"
                    onClick={emailSummary}
                    disabled={emailing}
                    style={buttonSecondaryStyle(true)}
                  >
                    {emailing
                      ? "Emailing Summary..."
                      : "Complete Review & Email Summary"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                On-Screen Program Direction
              </h2>

              <div style={{ color: "#70819A", lineHeight: 1.7, marginBottom: 14 }}>
                Enter credit score, income, debt, price, down payment, and occupancy to begin displaying live lender-program direction on screen.
              </div>

              {loadingLiveMatches && (
                <div
                  style={{
                    marginBottom: 14,
                    background: "#EEF6FF",
                    border: "1px solid #C8DDF7",
                    color: "#205493",
                    borderRadius: 14,
                    padding: 14,
                    lineHeight: 1.6,
                  }}
                >
                  Checking live Beyond Intelligence lender-program matches...
                </div>
              )}

              {liveMatchError && (
                <div
                  style={{
                    marginBottom: 14,
                    background: "#FFF4F2",
                    border: "1px solid #F3C5BC",
                    color: "#8A3B2F",
                    borderRadius: 14,
                    padding: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {liveMatchError}
                </div>
              )}

              {liveProgramSuggestions.length > 0 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {liveProgramSuggestions.map((item, index) => (
                    <div
                      key={`${item.program}-${item.lenderName || "lender"}-${index}`}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        background: "#F8FAFC",
                        padding: 16,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {item.program}
                        {item.lenderName ? ` — ${item.lenderName}` : ""}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          color: "#0096C7",
                          fontWeight: 700,
                        }}
                      >
                        LIVE LENDER MATCH
                      </div>
                      <ul
                        style={{
                          margin: "10px 0 0 18px",
                          padding: 0,
                          lineHeight: 1.7,
                        }}
                      >
                        {item.notes.map((note, noteIndex) => (
                          <li key={noteIndex}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : fallbackAgencySuggestions.length > 0 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      background: "#FFF9EC",
                      border: "1px solid #E9D4A7",
                      color: "#8A6A1F",
                      borderRadius: 14,
                      padding: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    No database-driven lender program currently matches the scenario entered. Showing fallback agency guidance below.
                  </div>

                  {fallbackAgencySuggestions.map((item, index) => (
                    <div
                      key={`${item.program}-${index}`}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        background: "#F8FAFC",
                        padding: 16,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{item.program}</div>
                      <div
                        style={{
                          marginTop: 6,
                          color: "#0096C7",
                          fontWeight: 700,
                        }}
                      >
                        {String(item.strength).toUpperCase()} fallback alignment
                      </div>
                      <ul
                        style={{
                          margin: "10px 0 0 18px",
                          padding: 0,
                          lineHeight: 1.7,
                        }}
                      >
                        {item.notes.map((note, noteIndex) => (
                          <li key={noteIndex}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "#FFF9EC",
                    border: "1px solid #E9D4A7",
                    color: "#8A6A1F",
                    borderRadius: 14,
                    padding: 14,
                    lineHeight: 1.6,
                  }}
                >
                  No database-driven lender program currently matches the scenario entered. Add more lender programs and overlays in the admin area to expand the engine.
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                Role-Based Guidance
              </h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                {roleNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                Suggested Checklist / Missing Items
              </h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                {documentChecklist.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>
                Professional Testing Notes
              </h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                <li>Borrower Scenario Name is required before starting.</li>
                <li>
                  Loan Purpose is selected upfront so Finley Beyond does not need
                  to re-ask it.
                </li>
                <li>
                  Current borrower state and target state are included from the
                  beginning.
                </li>
                <li>
                  Role-based behavior now changes Finley Beyond’s focus depending
                  on who is using the system.
                </li>
                <li>
                  On-screen program direction now checks live lender-program data from the Beyond Intelligence database.
                </li>
                <li>
                  When the review is complete, the summary is emailed to the professional who interacted with the system.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
