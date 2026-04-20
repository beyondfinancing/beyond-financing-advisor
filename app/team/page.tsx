"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LanguageCode = "en" | "pt" | "es";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Real Estate Agent";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  role: TeamRole;
  password: string;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
};

type PreferredLanguage = "English" | "Português" | "Español";
type SummaryTrigger = "ai" | "apply" | "schedule" | "contact";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TeamLeadForm = {
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: PreferredLanguage;
  notes: string;
};

type BorrowerSnapshot = {
  creditScore: string;
  monthlyIncome: string;
  monthlyDebt: string;
  homePrice: string;
  downPayment: string;
  occupancy: string;
  propertyType: string;
  transactionType: string;
  citizenshipStatus: string;
  incomeType: string;
};

type ProgramMatch = {
  category: string;
  label: string;
  fit: "Strong" | "Possible" | "Caution";
  reason: string;
};

const APP_URL = "https://www.beyondfinancing.com/apply-now";
const CONTACT_URL = "https://www.beyondfinancing.com/contact-us";

const TEAM_USERS: TeamUser[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    email: "pansini@beyondfinancing.com",
    nmls: "1625542",
    role: "Loan Officer",
    password: "1625542",
    calendly: "https://calendly.com/sandropansini",
    assistantEmail: "myloan@beyondfinancing.com",
    phone: "857-615-0836",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    email: "warren@beyondfinancing.com",
    nmls: "18959",
    role: "Loan Officer",
    password: "18959",
    calendly: "https://www.beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    phone: "978-821-2250",
  },
  {
    id: "amarilis-santos",
    name: "Amarilis Santos",
    email: "amarilis@beyondfinancing.com",
    nmls: "2394496AS",
    role: "Processor",
    password: "2394496AS",
    assistantEmail: "myloan@beyondfinancing.com",
  },
  {
    id: "kyle-nicholson",
    name: "Kyle Nicholson",
    email: "kyle@beyondfinancing.com",
    nmls: "2394496",
    role: "Processor",
    password: "2394496",
    assistantEmail: "myloan@beyondfinancing.com",
  },
  {
    id: "nate-hubley",
    name: "Nate Hubley",
    email: "nate@beyondfinancing.com",
    nmls: "2749644",
    role: "Loan Officer",
    password: "2749644",
    calendly: "https://www.beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
  },
  {
    id: "bia-marques",
    name: "Bia Marques",
    email: "bia@beyondfinancing.com",
    nmls: "2394496BM",
    role: "Loan Officer Assistant",
    password: "2394496BM",
    assistantEmail: "myloan@beyondfinancing.com",
  },
];

const COPY = {
  en: {
    title: "Beyond Intelligence™ Team Workspace",
    subtitle:
      "Professional review center for loan officers, assistants, processors, and real estate partners.",
    loginTitle: "Professional Login",
    loginText:
      "Use your NMLS or company credential and password to access the internal workspace.",
    credentialLabel: "NMLS # or Company Credential",
    passwordLabel: "Password",
    signIn: "Enter Workspace",
    signingIn: "Signing in...",
    forgotPassword: "Forgot password?",
    forgotPasswordText:
      "Use your NMLS or email in the credential field, then click Reset Password Help to display your current credential reminder for internal testing.",
    resetPasswordHelp: "Reset Password Help",
    signOut: "Sign Out",
    language: "Language",
    welcome: "Welcome",
    role: "Role",
    summaryEngine: "Internal Summary Email Engine",
    summaryEngineText:
      "This workspace reuses the borrower-side summary route so professionals can generate internal lead briefings directly from the team dashboard.",
    leadTitle: "Lead Details",
    borrowerTitle: "Scenario Snapshot",
    conversationTitle: "Finley Professional Review",
    recommendationsTitle: "Directional Program Review",
    actionsTitle: "Next Actions",
    fullName: "Borrower Full Name",
    email: "Borrower Email",
    phone: "Borrower Phone",
    preferredLanguage: "Preferred Language",
    notes: "Professional Notes",
    creditScore: "Estimated Credit Score",
    monthlyIncome: "Gross Monthly Income",
    monthlyDebt: "Monthly Debt",
    homePrice: "Target Home Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    propertyType: "Property Type",
    transactionType: "Transaction Type",
    citizenshipStatus: "Citizenship / Residency",
    incomeType: "Income Type",
    startReview: "Start Professional Review",
    reviewing: "Reviewing...",
    continueReview: "Continue Review",
    sendMessage: "Send Message",
    sending: "Sending...",
    generateEmailSummary: "Generate Internal Summary Email",
    sendingSummary: "Sending Summary...",
    triggerApply: "Log Apply Intent + Email Summary",
    triggerSchedule: "Log Schedule Intent + Email Summary",
    triggerContact: "Log Contact Intent + Email Summary",
    clearSession: "Reset Session",
    noConversationYet:
      "Complete the lead details and start the professional review to begin the Finley Beyond internal conversation.",
    professionalPrompt:
      "Type your follow-up question, underwriting thought, borrower update, or missing-item note.",
    loginError: "Invalid credential or password.",
    missingLead:
      "Please complete borrower full name, email, phone, preferred language, and start the review first.",
    resetHintPrefix: "Credential reminder:",
    loggedInAs: "Logged in as",
    routeTo: "Summary emails route to",
    applyNow: "Open Application",
    scheduleCall: "Open Scheduling",
    contactPage: "Open Contact Page",
    estimatedLoanAmount: "Estimated Loan Amount",
    estimatedLtv: "Estimated LTV",
    noRecommendations:
      "Enter the borrower scenario to generate directional program guidance.",
    footerNote:
      "Beyond Intelligence™ helps organize professional analysis. Final qualification and program eligibility remain subject to full licensed review and investor guidelines.",
  },
  pt: {
    title: "Workspace da Equipe Beyond Intelligence™",
    subtitle:
      "Centro profissional de análise para loan officers, assistentes, processadores e parceiros imobiliários.",
    loginTitle: "Login Profissional",
    loginText:
      "Use seu NMLS ou credencial da empresa e senha para acessar o workspace interno.",
    credentialLabel: "NMLS # ou Credencial da Empresa",
    passwordLabel: "Senha",
    signIn: "Entrar no Workspace",
    signingIn: "Entrando...",
    forgotPassword: "Esqueceu a senha?",
    forgotPasswordText:
      "Use seu NMLS ou email no campo de credencial e clique em Ajuda de Senha para exibir o lembrete atual apenas para testes internos.",
    resetPasswordHelp: "Ajuda de Senha",
    signOut: "Sair",
    language: "Idioma",
    welcome: "Bem-vindo",
    role: "Função",
    summaryEngine: "Motor Interno de Email Resumo",
    summaryEngineText:
      "Este workspace reutiliza a rota de resumo do lado do borrower para que os profissionais gerem briefings internos diretamente do painel.",
    leadTitle: "Dados do Lead",
    borrowerTitle: "Resumo do Cenário",
    conversationTitle: "Análise Profissional Finley",
    recommendationsTitle: "Análise Direcional de Programas",
    actionsTitle: "Próximos Passos",
    fullName: "Nome Completo do Cliente",
    email: "Email do Cliente",
    phone: "Telefone do Cliente",
    preferredLanguage: "Idioma Preferido",
    notes: "Notas Profissionais",
    creditScore: "Pontuação de Crédito Estimada",
    monthlyIncome: "Renda Bruta Mensal",
    monthlyDebt: "Dívida Mensal",
    homePrice: "Valor Alvo do Imóvel",
    downPayment: "Entrada Estimada",
    occupancy: "Ocupação",
    propertyType: "Tipo de Imóvel",
    transactionType: "Tipo de Transação",
    citizenshipStatus: "Cidadania / Residência",
    incomeType: "Tipo de Renda",
    startReview: "Iniciar Análise Profissional",
    reviewing: "Analisando...",
    continueReview: "Continuar Análise",
    sendMessage: "Enviar Mensagem",
    sending: "Enviando...",
    generateEmailSummary: "Gerar Email Resumo Interno",
    sendingSummary: "Enviando Resumo...",
    triggerApply: "Registrar Interesse em Aplicar + Email Resumo",
    triggerSchedule: "Registrar Interesse em Agendar + Email Resumo",
    triggerContact: "Registrar Interesse em Contato + Email Resumo",
    clearSession: "Reiniciar Sessão",
    noConversationYet:
      "Complete os dados do lead e inicie a análise profissional para começar a conversa interna com o Finley Beyond.",
    professionalPrompt:
      "Digite sua pergunta de acompanhamento, pensamento de underwriting, atualização do cliente ou item pendente.",
    loginError: "Credencial ou senha inválida.",
    missingLead:
      "Preencha nome completo, email, telefone, idioma preferido e inicie a análise primeiro.",
    resetHintPrefix: "Lembrete da credencial:",
    loggedInAs: "Logado como",
    routeTo: "Os emails resumo serão enviados para",
    applyNow: "Abrir Aplicação",
    scheduleCall: "Abrir Agendamento",
    contactPage: "Abrir Página de Contato",
    estimatedLoanAmount: "Valor Estimado do Empréstimo",
    estimatedLtv: "LTV Estimado",
    noRecommendations:
      "Informe o cenário do cliente para gerar orientação direcional de programas.",
    footerNote:
      "Beyond Intelligence™ ajuda a organizar a análise profissional. A qualificação final e a elegibilidade de programa continuam sujeitas à revisão licenciada completa e às diretrizes do investidor.",
  },
  es: {
    title: "Workspace del Equipo Beyond Intelligence™",
    subtitle:
      "Centro profesional de revisión para loan officers, asistentes, procesadores y socios inmobiliarios.",
    loginTitle: "Ingreso Profesional",
    loginText:
      "Use su NMLS o credencial de la empresa y contraseña para acceder al workspace interno.",
    credentialLabel: "NMLS # o Credencial de la Empresa",
    passwordLabel: "Contraseña",
    signIn: "Entrar al Workspace",
    signingIn: "Ingresando...",
    forgotPassword: "¿Olvidó su contraseña?",
    forgotPasswordText:
      "Use su NMLS o correo en el campo de credencial y haga clic en Ayuda de Contraseña para mostrar su recordatorio actual solo para pruebas internas.",
    resetPasswordHelp: "Ayuda de Contraseña",
    signOut: "Cerrar Sesión",
    language: "Idioma",
    welcome: "Bienvenido",
    role: "Rol",
    summaryEngine: "Motor Interno de Resumen por Email",
    summaryEngineText:
      "Este workspace reutiliza la ruta de resumen del lado del borrower para que los profesionales generen briefings internos directamente desde el panel.",
    leadTitle: "Datos del Lead",
    borrowerTitle: "Resumen del Escenario",
    conversationTitle: "Revisión Profesional con Finley",
    recommendationsTitle: "Revisión Direccional de Programas",
    actionsTitle: "Próximas Acciones",
    fullName: "Nombre Completo del Cliente",
    email: "Correo del Cliente",
    phone: "Teléfono del Cliente",
    preferredLanguage: "Idioma Preferido",
    notes: "Notas Profesionales",
    creditScore: "Puntaje de Crédito Estimado",
    monthlyIncome: "Ingreso Bruto Mensual",
    monthlyDebt: "Deuda Mensual",
    homePrice: "Precio Objetivo de la Vivienda",
    downPayment: "Pago Inicial Estimado",
    occupancy: "Ocupación",
    propertyType: "Tipo de Propiedad",
    transactionType: "Tipo de Transacción",
    citizenshipStatus: "Ciudadanía / Residencia",
    incomeType: "Tipo de Ingreso",
    startReview: "Iniciar Revisión Profesional",
    reviewing: "Revisando...",
    continueReview: "Continuar Revisión",
    sendMessage: "Enviar Mensaje",
    sending: "Enviando...",
    generateEmailSummary: "Generar Resumen Interno por Email",
    sendingSummary: "Enviando Resumen...",
    triggerApply: "Registrar Intención de Aplicar + Resumen",
    triggerSchedule: "Registrar Intención de Agendar + Resumen",
    triggerContact: "Registrar Intención de Contacto + Resumen",
    clearSession: "Reiniciar Sesión",
    noConversationYet:
      "Complete los datos del lead e inicie la revisión profesional para comenzar la conversación interna con Finley Beyond.",
    professionalPrompt:
      "Escriba su pregunta de seguimiento, pensamiento de underwriting, actualización del cliente o nota pendiente.",
    loginError: "Credencial o contraseña inválida.",
    missingLead:
      "Complete nombre, correo, teléfono, idioma preferido e inicie la revisión primero.",
    resetHintPrefix: "Recordatorio de credencial:",
    loggedInAs: "Conectado como",
    routeTo: "Los emails resumen se enviarán a",
    applyNow: "Abrir Aplicación",
    scheduleCall: "Abrir Agenda",
    contactPage: "Abrir Página de Contacto",
    estimatedLoanAmount: "Monto Estimado del Préstamo",
    estimatedLtv: "LTV Estimado",
    noRecommendations:
      "Ingrese el escenario del cliente para generar orientación direccional de programas.",
    footerNote:
      "Beyond Intelligence™ ayuda a organizar el análisis profesional. La calificación final y la elegibilidad del programa siguen sujetas a revisión licenciada completa y a las guías del inversionista.",
  },
} as const;

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function extractAiText(data: unknown): string {
  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null) {
    const obj = data as {
      choices?: Array<{ message?: { content?: string } }>;
      reply?: string;
      message?: string;
      response?: string;
      content?: string;
      text?: string;
    };

    return (
      obj.choices?.[0]?.message?.content ||
      obj.reply ||
      obj.message ||
      obj.response ||
      obj.content ||
      obj.text ||
      ""
    );
  }

  return "";
}

function resolveUserByCredential(credential: string) {
  const query = normalizeText(credential);

  return (
    TEAM_USERS.find((user) => normalizeText(user.nmls) === query) ||
    TEAM_USERS.find((user) => normalizeText(user.email) === query) ||
    TEAM_USERS.find((user) => normalizeText(user.name) === query) ||
    TEAM_USERS.find((user) => normalizeText(user.name).includes(query))
  );
}

function estimateDirectionalPrograms(snapshot: BorrowerSnapshot): ProgramMatch[] {
  const credit = Number(snapshot.creditScore) || 0;
  const income = Number(snapshot.monthlyIncome) || 0;
  const debt = Number(snapshot.monthlyDebt) || 0;
  const homePrice = Number(snapshot.homePrice) || 0;
  const downPayment = Number(snapshot.downPayment) || 0;
  const loanAmount = Math.max(homePrice - downPayment, 0);
  const ltv = homePrice > 0 ? loanAmount / homePrice : 0;
  const dtiProxy = income > 0 ? debt / income : 0;

  const matches: ProgramMatch[] = [];

  if (homePrice > 0 && income > 0) {
    if (
      credit >= 680 &&
      ltv <= 0.97 &&
      snapshot.incomeType === "full_doc" &&
      snapshot.citizenshipStatus !== "foreign_national"
    ) {
      matches.push({
        category: "Agency",
        label: "Conventional Review",
        fit: "Strong",
        reason:
          "Credit profile, leverage, and documentation profile suggest a strong preliminary fit for conventional-style analysis.",
      });
    }

    if (
      credit >= 620 &&
      ltv <= 0.965 &&
      ["full_doc", "express_doc"].includes(snapshot.incomeType)
    ) {
      matches.push({
        category: "Agency",
        label: "FHA Review",
        fit: "Possible",
        reason:
          "Scenario may support FHA-style fallback analysis depending on AUS findings, liabilities, and full file review.",
      });
    }

    if (
      ["bank_statements", "1099", "p_and_l", "asset_utilization"].includes(
        snapshot.incomeType
      )
    ) {
      matches.push({
        category: "Non-QM",
        label: "Alternative Income Review",
        fit: "Strong",
        reason:
          "Income structure appears aligned with self-employed or alternative documentation review.",
      });
    }

    if (
      snapshot.occupancy === "investment_property" &&
      dtiProxy <= 0.55 &&
      credit >= 660
    ) {
      matches.push({
        category: "Investor",
        label: "DSCR / Investor Review",
        fit: "Possible",
        reason:
          "Investment-property intent suggests possible DSCR or investor-oriented review depending on property cash flow and reserve profile.",
      });
    }

    if (
      ["itin_borrower", "foreign_national", "daca", "non_permanent_resident"].includes(
        snapshot.citizenshipStatus
      )
    ) {
      matches.push({
        category: "Specialty",
        label: "Residency-Sensitive Review",
        fit: "Possible",
        reason:
          "Citizenship or residency profile indicates the file may require targeted investor and overlay review beyond standard agency paths.",
      });
    }

    if (credit > 0 && credit < 620) {
      matches.push({
        category: "Caution",
        label: "Credit Improvement / Layered Review",
        fit: "Caution",
        reason:
          "Current credit profile suggests the file may require additional structure, compensating factors, or timing strategy.",
      });
    }

    if (ltv > 0.97) {
      matches.push({
        category: "Caution",
        label: "High-Leverage Review",
        fit: "Caution",
        reason:
          "Estimated leverage appears high and may require revised structure, additional funds, or narrower program options.",
      });
    }
  }

  return matches.slice(0, 6);
}

function buildTeamSystemPrompt(params: {
  user: TeamUser;
  lead: TeamLeadForm;
  snapshot: BorrowerSnapshot;
  language: LanguageCode;
}) {
  const { user, lead, snapshot, language } = params;

  const estimatedHomePrice = Number(snapshot.homePrice) || 0;
  const estimatedDownPayment = Number(snapshot.downPayment) || 0;
  const estimatedLoanAmount = Math.max(estimatedHomePrice - estimatedDownPayment, 0);
  const estimatedLtv =
    estimatedHomePrice > 0
      ? `${Math.round((estimatedLoanAmount / estimatedHomePrice) * 100)}%`
      : "Not provided";

  return `
You are Finley Beyond Powered by Beyond Intelligence™ operating in an INTERNAL PROFESSIONAL TEAM WORKSPACE.

Audience:
- Licensed loan officers
- Loan officer assistants
- Processors
- Real estate agents working with Beyond Financing

Rules:
- Respond as an internal mortgage decision-support assistant
- You may discuss directional program thinking, likely next steps, missing documentation, and risk flags
- Do not make definitive approval claims
- Do not present anything as final underwriting approval
- Keep guidance practical, concise, and action-oriented
- If facts are missing, identify the gaps directly
- Prefer structured reasoning useful to a mortgage professional
- Respond in ${
    language === "pt" ? "Portuguese" : language === "es" ? "Spanish" : "English"
  }

Current professional user:
- Name: ${user.name}
- Role: ${user.role}
- Email: ${user.email}
- NMLS/Credential: ${user.nmls}

Lead details:
- Borrower Name: ${lead.fullName || "Not provided"}
- Borrower Email: ${lead.email || "Not provided"}
- Borrower Phone: ${lead.phone || "Not provided"}
- Preferred Language: ${lead.preferredLanguage || "Not provided"}
- Professional Notes: ${lead.notes || "Not provided"}

Scenario snapshot:
- Credit Score: ${snapshot.creditScore || "Not provided"}
- Monthly Income: ${snapshot.monthlyIncome || "Not provided"}
- Monthly Debt: ${snapshot.monthlyDebt || "Not provided"}
- Home Price: ${snapshot.homePrice || "Not provided"}
- Down Payment: ${snapshot.downPayment || "Not provided"}
- Estimated Loan Amount: ${
    estimatedLoanAmount > 0 ? String(Math.round(estimatedLoanAmount)) : "Not provided"
  }
- Estimated LTV: ${estimatedLtv}
- Occupancy: ${snapshot.occupancy || "Not provided"}
- Property Type: ${snapshot.propertyType || "Not provided"}
- Transaction Type: ${snapshot.transactionType || "Not provided"}
- Citizenship / Residency: ${snapshot.citizenshipStatus || "Not provided"}
- Income Type: ${snapshot.incomeType || "Not provided"}
`.trim();
}

export default function TeamPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [passwordHint, setPasswordHint] = useState("");
  const [activeUser, setActiveUser] = useState<TeamUser | null>(null);

  const [leadForm, setLeadForm] = useState<TeamLeadForm>({
    fullName: "",
    email: "",
    phone: "",
    preferredLanguage: "English",
    notes: "",
  });

  const [snapshot, setSnapshot] = useState<BorrowerSnapshot>({
    creditScore: "",
    monthlyIncome: "",
    monthlyDebt: "",
    homePrice: "",
    downPayment: "",
    occupancy: "",
    propertyType: "",
    transactionType: "",
    citizenshipStatus: "",
    incomeType: "",
  });

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [reviewStarted, setReviewStarted] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [summaryStatus, setSummaryStatus] = useState("");

  const t = COPY[language];

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem("bf-team-user") : null;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as TeamUser;
      const matched = TEAM_USERS.find((user) => user.id === parsed.id);
      if (matched) setActiveUser(matched);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activeUser) {
      window.sessionStorage.setItem("bf-team-user", JSON.stringify(activeUser));
    } else {
      window.sessionStorage.removeItem("bf-team-user");
    }
  }, [activeUser]);

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(snapshot.homePrice) || 0;
    const downPayment = Number(snapshot.downPayment) || 0;
    return Math.max(homePrice - downPayment, 0);
  }, [snapshot.homePrice, snapshot.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(snapshot.homePrice) || 0;
    if (homePrice <= 0) return 0;
    return estimatedLoanAmount / homePrice;
  }, [estimatedLoanAmount, snapshot.homePrice]);

  const directionalPrograms = useMemo(
    () => estimateDirectionalPrograms(snapshot),
    [snapshot]
  );

  const assistantEmail =
    activeUser?.assistantEmail || "myloan@beyondfinancing.com";

  const scheduleUrl = activeUser?.calendly || "https://www.beyondfinancing.com";

  const isLeadReady =
    Boolean(leadForm.fullName.trim()) &&
    Boolean(leadForm.email.trim()) &&
    Boolean(leadForm.phone.trim()) &&
    Boolean(leadForm.preferredLanguage);

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    setPasswordHint("");

    try {
      const matched = resolveUserByCredential(credential);

      if (!matched || matched.password !== password.trim()) {
        setAuthError(t.loginError);
        return;
      }

      setActiveUser(matched);
      setCredential("");
      setPassword("");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordHelp = () => {
    setAuthError("");
    const matched = resolveUserByCredential(credential);

    if (!matched) {
      setPasswordHint(`${t.resetHintPrefix} Please enter your email, NMLS, or full name first.`);
      return;
    }

    setPasswordHint(`${t.resetHintPrefix} ${matched.password}`);
  };

  const handleSignOut = () => {
    setActiveUser(null);
    setConversation([]);
    setReviewStarted(false);
    setChatInput("");
    setChatError("");
    setSummaryStatus("");
    setPasswordHint("");
  };

  const setLeadField = (key: keyof TeamLeadForm, value: string) => {
    setLeadForm((prev) => ({ ...prev, [key]: value }));
  };

  const setSnapshotField = (key: keyof BorrowerSnapshot, value: string) => {
    setSnapshot((prev) => ({ ...prev, [key]: value }));
  };

  const startProfessionalReview = async () => {
    if (!activeUser || !isLeadReady) {
      setChatError(t.missingLead);
      return;
    }

    setReviewLoading(true);
    setChatError("");
    setSummaryStatus("");
    setConversation([]);

    try {
      const systemContext = buildTeamSystemPrompt({
        user: activeUser,
        lead: leadForm,
        snapshot,
        language,
      });

      const prompt = `
${systemContext}

Please begin the internal professional review.
1. Summarize the borrower scenario briefly
2. Identify 3 to 5 likely next underwriting or qualification questions
3. Mention directional program thinking only if supported by the file
4. Recommend the next best action for the professional user
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "team_initial_review",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(extractAiText(data) || "Professional review failed.");
      }

      const finalText =
        extractAiText(data) ||
        "No response was returned from Finley Beyond for the professional workspace.";

      setConversation([{ role: "assistant", content: finalText }]);
      setReviewStarted(true);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "There was an error starting the professional review."
      );
      setReviewStarted(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const sendProfessionalMessage = async () => {
    if (!activeUser || !reviewStarted || !chatInput.trim()) return;

    const trimmed = chatInput.trim();
    const nextConversation: ChatMessage[] = [
      ...conversation,
      { role: "user", content: trimmed },
    ];

    setConversation(nextConversation);
    setChatInput("");
    setReviewLoading(true);
    setChatError("");

    try {
      const systemContext = buildTeamSystemPrompt({
        user: activeUser,
        lead: leadForm,
        snapshot,
        language,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "team_follow_up",
          messages: [
            {
              role: "user",
              content: `${systemContext}

Continue the internal professional review. Be practical, concise, and action-oriented.`,
            },
            ...nextConversation.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(extractAiText(data) || "Follow-up review failed.");
      }

      const finalText =
        extractAiText(data) ||
        "No additional response was returned from Finley Beyond.";

      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: finalText },
      ]);
    } catch (error) {
      setConversation((prev) => prev.slice(0, -1));
      setChatError(
        error instanceof Error
          ? error.message
          : "There was an error continuing the review."
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const sendSummaryEmail = async (trigger: SummaryTrigger) => {
    if (!activeUser || !reviewStarted || !isLeadReady) {
      setSummaryStatus(t.missingLead);
      return;
    }

    setSummaryLoading(true);
    setSummaryStatus("");

    try {
      const response = await fetch("/api/chat-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead: {
            fullName: leadForm.fullName,
            email: leadForm.email,
            phone: leadForm.phone,
            preferredLanguage: leadForm.preferredLanguage,
            loanOfficer: activeUser.id.includes("sandro")
              ? "sandro"
              : activeUser.id.includes("warren")
              ? "warren"
              : "finley",
            assignedEmail: activeUser.email,
          },
          trigger,
          messages: [
            ...conversation,
            {
              role: "user",
              content: `Professional notes: ${leadForm.notes || "None provided."}`,
            },
            {
              role: "user",
              content: `Scenario snapshot:
Credit Score: ${snapshot.creditScore || "Not provided"}
Monthly Income: ${snapshot.monthlyIncome || "Not provided"}
Monthly Debt: ${snapshot.monthlyDebt || "Not provided"}
Home Price: ${snapshot.homePrice || "Not provided"}
Down Payment: ${snapshot.downPayment || "Not provided"}
Occupancy: ${snapshot.occupancy || "Not provided"}
Property Type: ${snapshot.propertyType || "Not provided"}
Transaction Type: ${snapshot.transactionType || "Not provided"}
Citizenship Status: ${snapshot.citizenshipStatus || "Not provided"}
Income Type: ${snapshot.incomeType || "Not provided"}
Estimated Loan Amount: ${estimatedLoanAmount > 0 ? String(Math.round(estimatedLoanAmount)) : "Not provided"}
Estimated LTV: ${snapshot.homePrice ? `${Math.round(estimatedLtv * 100)}%` : "Not provided"}`,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Summary email failed."
        );
      }

      setSummaryStatus("Summary email sent successfully.");
    } catch (error) {
      setSummaryStatus(
        error instanceof Error
          ? error.message
          : "There was an error sending the summary email."
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const resetSession = () => {
    setLeadForm({
      fullName: "",
      email: "",
      phone: "",
      preferredLanguage: "English",
      notes: "",
    });
    setSnapshot({
      creditScore: "",
      monthlyIncome: "",
      monthlyDebt: "",
      homePrice: "",
      downPayment: "",
      occupancy: "",
      propertyType: "",
      transactionType: "",
      citizenshipStatus: "",
      incomeType: "",
    });
    setConversation([]);
    setChatInput("");
    setReviewStarted(false);
    setReviewLoading(false);
    setSummaryLoading(false);
    setChatError("");
    setSummaryStatus("");
  };

  if (!activeUser) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>

        <div className="bf-team-wrap" style={styles.wrap}>
          <div style={styles.hero}>
            <div style={styles.eyebrow}>Beyond Intelligence™</div>
            <h1 style={styles.heroTitle}>{t.title}</h1>
            <p style={styles.heroText}>{t.subtitle}</p>
          </div>

          <div style={styles.loginCard}>
            <div style={styles.languageRow}>
              <div>
                <h2 style={styles.sectionTitle}>{t.loginTitle}</h2>
                <p style={styles.sectionText}>{t.loginText}</p>
              </div>

              <div style={styles.languageBox}>
                <label style={styles.label}>{t.language}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  style={styles.select}
                >
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>

            <div style={styles.formGridSingle}>
              <div>
                <label style={styles.label}>{t.credentialLabel}</label>
                <input
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder={t.credentialLabel}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>{t.passwordLabel}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordLabel}
                  style={styles.input}
                />
              </div>
            </div>

            {authError ? <div style={styles.errorBox}>{authError}</div> : null}
            {passwordHint ? <div style={styles.infoBox}>{passwordHint}</div> : null}

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={handleLogin}
                disabled={authLoading}
                style={{
                  ...styles.primaryButton,
                  opacity: authLoading ? 0.7 : 1,
                  cursor: authLoading ? "not-allowed" : "pointer",
                }}
              >
                {authLoading ? t.signingIn : t.signIn}
              </button>

              <button
                type="button"
                onClick={handleForgotPasswordHelp}
                style={styles.secondaryButton}
              >
                {t.resetPasswordHelp}
              </button>
            </div>

            <div style={styles.mutedHelpTitle}>{t.forgotPassword}</div>
            <div style={styles.mutedHelpText}>{t.forgotPasswordText}</div>

            <div style={styles.loginHintBox}>
              <div style={styles.loginHintTitle}>Internal Testing Credentials</div>
              <div style={styles.loginHintText}>
                For the currently seeded users, the password matches the NMLS/company
                credential. Replace this with a secure auth system when ready.
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-team-wrap" style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.topBar}>
            <div>
              <div style={styles.eyebrow}>Beyond Intelligence™</div>
              <h1 style={styles.heroTitle}>{t.title}</h1>
              <p style={styles.heroText}>{t.subtitle}</p>
            </div>

            <div style={styles.topBarActions}>
              <div style={styles.userBadge}>
                <div style={styles.userBadgeTitle}>
                  {t.loggedInAs}: {activeUser.name}
                </div>
                <div style={styles.userBadgeSubtext}>
                  {t.role}: {activeUser.role} · {activeUser.email}
                </div>
              </div>

              <button type="button" onClick={handleSignOut} style={styles.signOutButton}>
                {t.signOut}
              </button>
            </div>
          </div>
        </div>

        <div className="bf-main-grid" style={styles.mainGrid}>
          <section style={styles.leftColumn}>
            <div style={styles.card}>
              <div style={styles.languageRow}>
                <div>
                  <h2 style={styles.sectionTitle}>{t.summaryEngine}</h2>
                  <p style={styles.sectionText}>{t.summaryEngineText}</p>
                </div>

                <div style={styles.languageBox}>
                  <label style={styles.label}>{t.language}</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                    style={styles.select}
                  >
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              <div style={styles.routeBox}>
                <div style={styles.routeTitle}>{t.routeTo}</div>
                <div style={styles.routeText}>
                  {activeUser.email}
                  {assistantEmail ? ` and ${assistantEmail}` : ""}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.leadTitle}</h2>

              <div className="bf-form-grid" style={styles.formGridTwo}>
                <div>
                  <label style={styles.label}>{t.fullName}</label>
                  <input
                    style={styles.input}
                    value={leadForm.fullName}
                    onChange={(e) => setLeadField("fullName", e.target.value)}
                    placeholder={t.fullName}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.email}</label>
                  <input
                    style={styles.input}
                    value={leadForm.email}
                    onChange={(e) => setLeadField("email", e.target.value)}
                    placeholder={t.email}
                    type="email"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.phone}</label>
                  <input
                    style={styles.input}
                    value={leadForm.phone}
                    onChange={(e) => setLeadField("phone", e.target.value)}
                    placeholder={t.phone}
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.preferredLanguage}</label>
                  <select
                    style={styles.selectFull}
                    value={leadForm.preferredLanguage}
                    onChange={(e) =>
                      setLeadField(
                        "preferredLanguage",
                        e.target.value as PreferredLanguage
                      )
                    }
                  >
                    <option value="English">English</option>
                    <option value="Português">Português</option>
                    <option value="Español">Español</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={styles.label}>{t.notes}</label>
                <textarea
                  style={styles.textarea}
                  rows={4}
                  value={leadForm.notes}
                  onChange={(e) => setLeadField("notes", e.target.value)}
                  placeholder={t.notes}
                />
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.borrowerTitle}</h2>

              <div className="bf-form-grid" style={styles.formGridTwo}>
                <div>
                  <label style={styles.label}>{t.creditScore}</label>
                  <input
                    style={styles.input}
                    value={snapshot.creditScore}
                    onChange={(e) => setSnapshotField("creditScore", e.target.value)}
                    placeholder={t.creditScore}
                    type="number"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.monthlyIncome}</label>
                  <input
                    style={styles.input}
                    value={snapshot.monthlyIncome}
                    onChange={(e) =>
                      setSnapshotField("monthlyIncome", e.target.value)
                    }
                    placeholder={t.monthlyIncome}
                    type="number"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.monthlyDebt}</label>
                  <input
                    style={styles.input}
                    value={snapshot.monthlyDebt}
                    onChange={(e) =>
                      setSnapshotField("monthlyDebt", e.target.value)
                    }
                    placeholder={t.monthlyDebt}
                    type="number"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.homePrice}</label>
                  <input
                    style={styles.input}
                    value={snapshot.homePrice}
                    onChange={(e) => setSnapshotField("homePrice", e.target.value)}
                    placeholder={t.homePrice}
                    type="number"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.downPayment}</label>
                  <input
                    style={styles.input}
                    value={snapshot.downPayment}
                    onChange={(e) =>
                      setSnapshotField("downPayment", e.target.value)
                    }
                    placeholder={t.downPayment}
                    type="number"
                  />
                </div>

                <div>
                  <label style={styles.label}>{t.occupancy}</label>
                  <select
                    style={styles.selectFull}
                    value={snapshot.occupancy}
                    onChange={(e) => setSnapshotField("occupancy", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="primary_residence">Primary Residence</option>
                    <option value="second_home">Second Home</option>
                    <option value="investment_property">Investment Property</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.propertyType}</label>
                  <select
                    style={styles.selectFull}
                    value={snapshot.propertyType}
                    onChange={(e) => setSnapshotField("propertyType", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="single_family">Single Family</option>
                    <option value="condo">Condo</option>
                    <option value="two_to_four_unit">2-4 Unit</option>
                    <option value="manufactured">Manufactured</option>
                    <option value="mixed_use">Mixed Use</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.transactionType}</label>
                  <select
                    style={styles.selectFull}
                    value={snapshot.transactionType}
                    onChange={(e) =>
                      setSnapshotField("transactionType", e.target.value)
                    }
                  >
                    <option value="">Select</option>
                    <option value="purchase">Purchase</option>
                    <option value="rate_term_refinance">Rate/Term Refinance</option>
                    <option value="cash_out_refinance">Cash-Out Refinance</option>
                    <option value="second_lien">Second Lien</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.citizenshipStatus}</label>
                  <select
                    style={styles.selectFull}
                    value={snapshot.citizenshipStatus}
                    onChange={(e) =>
                      setSnapshotField("citizenshipStatus", e.target.value)
                    }
                  >
                    <option value="">Select</option>
                    <option value="citizen">Citizen</option>
                    <option value="permanent_resident">Permanent Resident</option>
                    <option value="non_permanent_resident">
                      Non-Permanent Resident
                    </option>
                    <option value="itin_borrower">ITIN Borrower</option>
                    <option value="daca">DACA</option>
                    <option value="foreign_national">Foreign National</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>{t.incomeType}</label>
                  <select
                    style={styles.selectFull}
                    value={snapshot.incomeType}
                    onChange={(e) => setSnapshotField("incomeType", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="full_doc">Full Doc / W2</option>
                    <option value="express_doc">Express Doc</option>
                    <option value="bank_statements">Bank Statements</option>
                    <option value="1099">1099</option>
                    <option value="p_and_l">P&L Only</option>
                    <option value="asset_utilization">Asset Utilization</option>
                  </select>
                </div>
              </div>

              <div style={styles.metricsGrid}>
                <MetricCard
                  title={t.estimatedLoanAmount}
                  value={formatCurrency(estimatedLoanAmount)}
                />
                <MetricCard
                  title={t.estimatedLtv}
                  value={snapshot.homePrice ? `${Math.round(estimatedLtv * 100)}%` : "0%"}
                />
              </div>

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={startProfessionalReview}
                  disabled={reviewLoading}
                  style={{
                    ...styles.primaryButton,
                    opacity: reviewLoading ? 0.7 : 1,
                    cursor: reviewLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {reviewLoading ? t.reviewing : t.startReview}
                </button>

                <button type="button" onClick={resetSession} style={styles.secondaryButton}>
                  {t.clearSession}
                </button>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.conversationTitle}</h2>

              {!reviewStarted ? (
                <div style={styles.placeholderBox}>{t.noConversationYet}</div>
              ) : (
                <>
                  <div style={styles.chatScroll}>
                    {conversation.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        style={{
                          ...styles.chatBubble,
                          backgroundColor:
                            message.role === "user" ? "#263366" : "#F8FBFF",
                          color: message.role === "user" ? "#ffffff" : "#1F2937",
                          border:
                            message.role === "user"
                              ? "1px solid #263366"
                              : "1px solid #DBEAFE",
                          alignSelf:
                            message.role === "user" ? "flex-end" : "stretch",
                        }}
                      >
                        {message.content}
                      </div>
                    ))}

                    {reviewLoading ? (
                      <div
                        style={{
                          ...styles.chatBubble,
                          backgroundColor: "#F8FBFF",
                          color: "#1F2937",
                          border: "1px solid #DBEAFE",
                        }}
                      >
                        Finley Beyond is reviewing...
                      </div>
                    ) : null}
                  </div>

                  {chatError ? <div style={styles.errorBox}>{chatError}</div> : null}

                  <div style={styles.chatComposer}>
                    <label style={styles.label}>{t.continueReview}</label>
                    <textarea
                      style={styles.textarea}
                      rows={4}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={t.professionalPrompt}
                      disabled={reviewLoading}
                    />
                    <button
                      type="button"
                      onClick={sendProfessionalMessage}
                      disabled={reviewLoading || !chatInput.trim()}
                      style={{
                        ...styles.secondaryBlueButton,
                        opacity: reviewLoading || !chatInput.trim() ? 0.7 : 1,
                        cursor:
                          reviewLoading || !chatInput.trim()
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {reviewLoading ? t.sending : t.sendMessage}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <aside style={styles.rightColumn}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.recommendationsTitle}</h2>

              {directionalPrograms.length === 0 ? (
                <div style={styles.placeholderBox}>{t.noRecommendations}</div>
              ) : (
                <div style={styles.recommendationList}>
                  {directionalPrograms.map((item, index) => (
                    <div key={`${item.label}-${index}`} style={styles.recommendationCard}>
                      <div style={styles.recommendationTopRow}>
                        <div>
                          <div style={styles.recommendationCategory}>{item.category}</div>
                          <div style={styles.recommendationLabel}>{item.label}</div>
                        </div>
                        <span
                          style={{
                            ...styles.fitBadge,
                            backgroundColor:
                              item.fit === "Strong"
                                ? "#DCFCE7"
                                : item.fit === "Possible"
                                ? "#DBEAFE"
                                : "#FEF3C7",
                            color:
                              item.fit === "Strong"
                                ? "#166534"
                                : item.fit === "Possible"
                                ? "#1D4ED8"
                                : "#92400E",
                          }}
                        >
                          {item.fit}
                        </span>
                      </div>
                      <div style={styles.recommendationReason}>{item.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.actionsTitle}</h2>

              <div style={styles.actionButtonColumn}>
                <button
                  type="button"
                  onClick={() => sendSummaryEmail("ai")}
                  disabled={summaryLoading}
                  style={styles.primaryButton}
                >
                  {summaryLoading ? t.sendingSummary : t.generateEmailSummary}
                </button>

                <button
                  type="button"
                  onClick={() => sendSummaryEmail("apply")}
                  disabled={summaryLoading}
                  style={styles.secondaryBlueButton}
                >
                  {t.triggerApply}
                </button>

                <button
                  type="button"
                  onClick={() => sendSummaryEmail("schedule")}
                  disabled={summaryLoading}
                  style={styles.secondaryBlueButton}
                >
                  {t.triggerSchedule}
                </button>

                <button
                  type="button"
                  onClick={() => sendSummaryEmail("contact")}
                  disabled={summaryLoading}
                  style={styles.secondaryBlueButton}
                >
                  {t.triggerContact}
                </button>

                <a href={APP_URL} target="_blank" rel="noreferrer" style={styles.linkActionPrimary}>
                  {t.applyNow}
                </a>

                <a
                  href={scheduleUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.linkActionSecondary}
                >
                  {t.scheduleCall}
                </a>

                <a
                  href={CONTACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.linkActionOutline}
                >
                  {t.contactPage}
                </a>

                {summaryStatus ? <div style={styles.infoBox}>{summaryStatus}</div> : null}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.footerNote}>{t.footerNote}</div>
              <div style={styles.brandTag}>MultiLender Intelligence™</div>
              <div style={styles.homeLinkRow}>
                <Link href="/" style={styles.inlineLink}>
                  Return to main page
                </Link>
                <Link href="/borrower" style={styles.inlineLink}>
                  Open borrower page
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const responsiveCss = `
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  @media (max-width: 1080px) {
    .bf-main-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .bf-form-grid {
      grid-template-columns: 1fr !important;
    }

    .bf-team-wrap {
      padding: 18px 12px 32px !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F3F6FB",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 18px 40px",
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 22,
    padding: 26,
    color: "#ffffff",
    boxShadow: "0 12px 32px rgba(38,51,102,0.16)",
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.92,
    marginBottom: 8,
    fontWeight: 700,
  },
  heroTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.15,
    fontWeight: 800,
  },
  heroText: {
    marginTop: 10,
    marginBottom: 0,
    maxWidth: 860,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  topBarActions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 300,
  },
  userBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 16,
    padding: 14,
  },
  userBadgeTitle: {
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 4,
  },
  userBadgeSubtext: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.9)",
  },
  signOutButton: {
    border: "1px solid rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  loginCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
    maxWidth: 780,
    margin: "0 auto",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 22,
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    margin: 0,
    marginBottom: 10,
    color: "#263366",
    fontSize: 24,
    fontWeight: 800,
  },
  sectionText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 14,
  },
  languageRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  languageBox: {
    minWidth: 180,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #CBD5E1",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #CBD5E1",
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    color: "#111827",
    backgroundColor: "#ffffff",
    resize: "vertical",
  },
  select: {
    width: "100%",
    minWidth: 160,
    borderRadius: 14,
    border: "1px solid #CBD5E1",
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  selectFull: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #CBD5E1",
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  formGridSingle: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
    marginTop: 10,
  },
  formGridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryButton: {
    border: "none",
    borderRadius: 14,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
    boxShadow: "0 10px 20px rgba(38,51,102,0.15)",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #263366",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    color: "#263366",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  secondaryBlueButton: {
    border: "none",
    borderRadius: 14,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  infoBox: {
    marginTop: 14,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    color: "#1E3A8A",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#991B1B",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  mutedHelpTitle: {
    marginTop: 16,
    fontWeight: 800,
    color: "#263366",
    fontSize: 14,
  },
  mutedHelpText: {
    marginTop: 6,
    color: "#64748B",
    lineHeight: 1.6,
    fontSize: 14,
  },
  loginHintBox: {
    marginTop: 18,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
  },
  loginHintTitle: {
    fontWeight: 800,
    color: "#263366",
    marginBottom: 6,
    fontSize: 14,
  },
  loginHintText: {
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 14,
  },
  routeBox: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    padding: 16,
  },
  routeTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
    marginBottom: 6,
    fontWeight: 700,
  },
  routeText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 18,
  },
  metricCard: {
    borderRadius: 16,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    padding: 16,
  },
  metricTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: 700,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 800,
    color: "#111827",
  },
  placeholderBox: {
    borderRadius: 16,
    border: "1px dashed #CBD5E1",
    backgroundColor: "#F8FAFC",
    color: "#475569",
    padding: 16,
    lineHeight: 1.7,
    fontSize: 14,
  },
  chatScroll: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxHeight: 500,
    overflowY: "auto",
    paddingRight: 4,
    marginBottom: 16,
  },
  chatBubble: {
    borderRadius: 16,
    padding: 15,
    whiteSpace: "pre-wrap",
    fontSize: 14,
    lineHeight: 1.7,
  },
  chatComposer: {
    borderTop: "1px solid #E2E8F0",
    paddingTop: 16,
  },
  recommendationList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  recommendationCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    border: "1px solid #E2E8F0",
    padding: 16,
  },
  recommendationTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  recommendationCategory: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
    marginBottom: 4,
    fontWeight: 700,
  },
  recommendationLabel: {
    fontSize: 17,
    fontWeight: 800,
    color: "#111827",
  },
  recommendationReason: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#475569",
  },
  fitBadge: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  actionButtonColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  linkActionPrimary: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 14,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  linkActionSecondary: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 14,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  linkActionOutline: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    border: "1px solid #263366",
    color: "#263366",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
  },
  footerNote: {
    color: "#475569",
    lineHeight: 1.7,
    fontSize: 14,
  },
  brandTag: {
    marginTop: 14,
    display: "inline-block",
    backgroundColor: "#EFF6FF",
    color: "#1D4ED8",
    border: "1px solid #BFDBFE",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  homeLinkRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 16,
  },
  inlineLink: {
    color: "#263366",
    fontWeight: 700,
    textDecoration: "none",
  },
};
