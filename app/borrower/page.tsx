// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/borrower/page.tsx
//
// =============================================================================
//
// PHASE 6 — Borrower intake notification + validation
//
// What's new vs. Phase 5-prep-D:
//   1. runPreliminaryReview now fires /api/borrower-intake exactly once per
//      session, after the chat call succeeds. That endpoint sends:
//        - "[New Lead]" email to the assigned LO (CC: assistant if available)
//        - Privacy-conservative courtesy email to the realtor (only when
//          realtorStatus === "yes" and realtor fields are filled). The
//          realtor email contains NO borrower financial info.
//        - One row in borrower_action_logs for audit.
//   2. Intake-level validation: name, email, phone always required;
//      realtor name/email/phone required when realtorStatus === "yes".
//      Missing fields disable Run Preliminary Review and show a hint.
//   3. buildSummaryPayload now includes loanOfficerId + loanOfficerQuery so
//      chat-summary's resolve_loan_officer RPC takes the FK path (faster +
//      doesn't depend on text name matching).
//   4. resetForm clears the new intakeSubmitted flag so the next borrower
//      gets a fresh notification cycle.
//
// Everything else from Phase 5-prep-D is unchanged: disclaimer gating,
// three-way realtor toggle, state-driven /api/public/team-users directory,
// autocomplete, confirmOfficerSelection bug fix, chat scrolling, action
// buttons + 3-second reset, all styles, all copy.
//
// =============================================================================

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import { SiteLanguage } from "@/app/components/site-header-translations";
import { US_STATES, STATE_NAMES_BY_CODE } from "@/lib/us-states";

type PreferredLanguage = "English" | "Português" | "Español";
type LanguageCode = "en" | "pt" | "es";

type BorrowerPath = "Purchase" | "Refinance" | "Investment";
type RealtorStatus = "yes" | "no" | "not_sure";

type IntakeFormState = {
  name: string;
  email: string;
  phone: string;
  credit: string;
  income: string;
  debt: string;
  currentState: string;
  targetState: string;
  realtorName: string;
  realtorPhone: string;
  realtorEmail: string;
  realtorMls: string;
};

type ScenarioFormState = {
  homePrice: string;
  downPayment: string;
  occupancy: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type LoanOfficerOut = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  phone: string;
  calendly: string;
  assistantEmail: string;
  isBot: boolean;
  licensedStates: string[];
};

type RealtorOut = {
  id: string;
  name: string;
  email: string;
  phone: string;
  mls: string;
  licensedStates: string[];
};

type LoanOfficerRecord = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  mobile: string;
  assistantMobile: string;
  applyUrl: string;
  scheduleUrl: string;
};

const APPLY_NOW_URL = "https://www.beyondfinancing.com/apply-now";

const FALLBACK_LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "amarilis@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://calendly.com/sandropansini",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "amarilis@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "2394496FB",
    email: "finley@beyondintelligence.io",
    assistantEmail: "",
    mobile: "8576150836",
    assistantMobile: "",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const FALLBACK_DEFAULT_LOAN_OFFICER =
  FALLBACK_LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  FALLBACK_LOAN_OFFICERS[0];

const COPY: Record<
  LanguageCode,
  {
    title: string;
    subtitle: string;
    disclaimerTitle: string;
    disclaimerText: string;
    disclaimerAccept: string;
    scenarioDirectionTitle: string;
    scenarioDirectionText: string;
    conversationTitle: string;
    conversationPlaceholder: string;
    chatPlaceholder: string;
    sendMessage: string;
    sending: string;
    nextActions: string;
    applyNow: string;
    scheduleLoanOfficer: string;
    emailLoanOfficer: string;
    callLoanOfficer: string;
    purchase: string;
    refinance: string;
    investment: string;
    borrowerName: string;
    email: string;
    phone: string;
    estimatedCreditScore: string;
    grossMonthlyIncome: string;
    monthlyDebt: string;
    currentState: string;
    targetState: string;
    selectStateOption: string;
    workingWithRealtor: string;
    yes: string;
    no: string;
    notSure: string;
    realtorName: string;
    realtorPhone: string;
    realtorEmail: string;
    realtorMls: string;
    realtorSearchHint: string;
    realtorPickStateFirst: string;
    realtorNoneInState: string;
    realtorPrivacyNotice: string;
    loanOfficerSearch: string;
    loanOfficerSearchHint: string;
    loanOfficerPickStateFirst: string;
    loanOfficerNoneInState: string;
    confirmLoanOfficer: string;
    unknownLoanOfficer: string;
    assignedRouting: string;
    routingText: string;
    runReview: string;
    reviewing: string;
    reviewCompleted: string;
    propertyScenario: string;
    homePrice: string;
    downPayment: string;
    occupancyPrimary: string;
    occupancySecond: string;
    occupancyInvestment: string;
    estimatedLoanAmount: string;
    estimatedLtv: string;
    continueScenario: string;
    updatingScenario: string;
    startConversationHint: string;
    summarySent: string;
    actionError: string;
    selectedRealtor: string;
    formLockedNotice: string;
    runReviewFirstHint: string;
    formResetNotice: string;
    intakeIncompleteHint: string;
  }
> = {
  en: {
    title: "Finley Beyond Powered by Beyond Intelligence™",
    subtitle: "Start your guided mortgage conversation with Finley Beyond.",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, title, appraisal, and current investor or agency guidelines.",
    disclaimerAccept: "I acknowledge and accept this disclaimer.",
    formLockedNotice:
      "Please acknowledge the disclaimer above to begin filling out this form.",
    runReviewFirstHint:
      "Click Run Preliminary Review above before continuing with the property scenario.",
    formResetNotice:
      "This form will reset shortly so the next borrower starts fresh.",
    intakeIncompleteHint:
      "Please fill in your name, email, phone, and (if working with a realtor) the realtor's name, phone, and email before running the preliminary review.",
    scenarioDirectionTitle: "Internal Scenario Direction",
    scenarioDirectionText:
      "This section reflects Finley Beyond’s internal matching direction and is used to guide the conversation and routing.",
    conversationTitle: "Conversation with Finley Beyond",
    conversationPlaceholder:
      "Complete the intake, confirm the loan officer, and confirm the property scenario to begin the conversation.",
    chatPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
    sendMessage: "Send Message",
    sending: "Sending...",
    nextActions: "Next Actions",
    applyNow: "Apply Now",
    scheduleLoanOfficer: "Schedule with Loan Officer",
    emailLoanOfficer: "Email Loan Officer",
    callLoanOfficer: "Call Loan Officer",
    purchase: "Purchase",
    refinance: "Refinance",
    investment: "Investment",
    borrowerName: "Borrower Name",
    email: "Email",
    phone: "Phone",
    estimatedCreditScore: "Estimated Credit Score",
    grossMonthlyIncome: "Gross Monthly Income",
    monthlyDebt: "Monthly Debt",
    currentState: "Current State",
    targetState: "Target State",
    selectStateOption: "— Select a state —",
    workingWithRealtor: "Are you working with a Realtor?",
    yes: "Yes",
    no: "No",
    notSure: "Not Sure",
    realtorName: "Realtor Name",
    realtorPhone: "Realtor Phone",
    realtorEmail: "Realtor Email",
    realtorMls: "Realtor MLS #",
    realtorSearchHint: "Start typing to see registered Realtors in your Target State.",
    realtorPickStateFirst: "Select a Target State above to see registered Realtors in that state.",
    realtorNoneInState: "No registered Realtors in this state yet. You can still type your Realtor's details manually below.",
    realtorPrivacyNotice:
      "Your realtor will receive a courtesy notice that you started a mortgage review. No financial details are shared with them.",
    loanOfficerSearch: "Start typing to see matching loan officers.",
    loanOfficerSearchHint: "Loan officers shown are licensed in your Target State.",
    loanOfficerPickStateFirst: "Select a Target State above to see loan officers licensed in that state.",
    loanOfficerNoneInState: "No loan officers are licensed in this state yet.",
    confirmLoanOfficer: "Confirm Loan Officer",
    unknownLoanOfficer: "I Do Not Know My Loan Officer",
    assignedRouting: "ASSIGNED ROUTING",
    routingText:
      "Internal summary will route to the assigned loan officer and team support.",
    runReview: "Run Preliminary Review",
    reviewing: "Reviewing...",
    reviewCompleted: "Preliminary Review Completed ✓",
    propertyScenario: "Property Scenario",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    occupancyPrimary: "Primary Residence",
    occupancySecond: "Second Home",
    occupancyInvestment: "Investment Property",
    estimatedLoanAmount: "Estimated Loan Amount",
    estimatedLtv: "Estimated LTV",
    continueScenario: "Continue with This Scenario",
    updatingScenario: "Updating Scenario...",
    startConversationHint:
      "Complete the intake, confirm the loan officer, and confirm the property scenario to begin the conversation.",
    summarySent:
      "Your action was acknowledged and the appropriate notifications were triggered.",
    actionError:
      "There was an issue triggering the notification flow. The page action still opened.",
    selectedRealtor: "SELECTED REALTOR",
  },
  pt: {
    title: "Finley Beyond com tecnologia Beyond Intelligence™",
    subtitle: "Inicie sua conversa hipotecária guiada com Finley Beyond.",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimerText:
      "Este sistema fornece apenas orientação preliminar. Não constitui aprovação de empréstimo, decisão de underwriting, compromisso de concessão de crédito, aconselhamento jurídico, aconselhamento fiscal ou determinação final de programa. Todos os cenários permanecem sujeitos à revisão de um loan officer licenciado, documentação, verificação, underwriting, title, appraisal e diretrizes atuais do investidor ou agência.",
    disclaimerAccept: "Reconheço e aceito este aviso.",
    formLockedNotice:
      "Por favor, aceite o aviso acima para começar a preencher o formulário.",
    runReviewFirstHint:
      "Clique em Executar Revisão Preliminar antes de continuar com o cenário do imóvel.",
    formResetNotice:
      "Este formulário será reiniciado em instantes para o próximo cliente.",
    intakeIncompleteHint:
      "Por favor, preencha seu nome, email, telefone e (se estiver trabalhando com um corretor) o nome, telefone e email do corretor antes de executar a revisão preliminar.",
    scenarioDirectionTitle: "Direção Interna do Cenário",
    scenarioDirectionText:
      "Esta seção reflete a direção interna de matching do Finley Beyond e é usada para orientar a conversa e o roteamento.",
    conversationTitle: "Conversa com Finley Beyond",
    conversationPlaceholder:
      "Complete o intake, confirme o loan officer e confirme o cenário do imóvel para iniciar a conversa.",
    chatPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta hipotecária do Finley Beyond.",
    sendMessage: "Enviar Mensagem",
    sending: "Enviando...",
    nextActions: "Próximos Passos",
    applyNow: "Aplicar Agora",
    scheduleLoanOfficer: "Agendar com Loan Officer",
    emailLoanOfficer: "Enviar Email ao Loan Officer",
    callLoanOfficer: "Ligar para Loan Officer",
    purchase: "Compra",
    refinance: "Refinanciamento",
    investment: "Investimento",
    borrowerName: "Nome do Cliente",
    email: "Email",
    phone: "Telefone",
    estimatedCreditScore: "Pontuação de Crédito Estimada",
    grossMonthlyIncome: "Renda Bruta Mensal",
    monthlyDebt: "Dívida Mensal",
    currentState: "Estado Atual",
    targetState: "Estado Desejado",
    selectStateOption: "— Selecione um estado —",
    workingWithRealtor: "Você está trabalhando com um Realtor?",
    yes: "Sim",
    no: "Não",
    notSure: "Não Tenho Certeza",
    realtorName: "Nome do Realtor",
    realtorPhone: "Telefone do Realtor",
    realtorEmail: "Email do Realtor",
    realtorMls: "MLS # do Realtor",
    realtorSearchHint: "Comece a digitar para ver Realtors cadastrados no Estado Desejado.",
    realtorPickStateFirst: "Selecione um Estado Desejado acima para ver Realtors cadastrados nesse estado.",
    realtorNoneInState: "Ainda não há Realtors cadastrados neste estado. Você pode digitar os dados do seu Realtor manualmente abaixo.",
    realtorPrivacyNotice:
      "Seu corretor receberá um aviso de cortesia informando que você iniciou uma revisão hipotecária. Nenhum dado financeiro é compartilhado.",
    loanOfficerSearch: "Comece a digitar para ver loan officers correspondentes.",
    loanOfficerSearchHint: "Os loan officers exibidos estão licenciados no seu Estado Desejado.",
    loanOfficerPickStateFirst: "Selecione um Estado Desejado acima para ver loan officers licenciados nesse estado.",
    loanOfficerNoneInState: "Ainda não há loan officers licenciados neste estado.",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "Não Sei Meu Loan Officer",
    assignedRouting: "ROTEAMENTO DEFINIDO",
    routingText:
      "O resumo interno será enviado ao loan officer definido e ao suporte da equipe.",
    runReview: "Executar Revisão Preliminar",
    reviewing: "Analisando...",
    reviewCompleted: "Revisão Preliminar Concluída ✓",
    propertyScenario: "Cenário do Imóvel",
    homePrice: "Preço Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    occupancyPrimary: "Residência Principal",
    occupancySecond: "Segunda Residência",
    occupancyInvestment: "Imóvel de Investimento",
    estimatedLoanAmount: "Valor Estimado do Empréstimo",
    estimatedLtv: "LTV Estimado",
    continueScenario: "Continuar com Este Cenário",
    updatingScenario: "Atualizando Cenário...",
    startConversationHint:
      "Complete o intake, confirme o loan officer e confirme o cenário do imóvel para iniciar a conversa.",
    summarySent:
      "Sua ação foi registrada e as notificações apropriadas foram disparadas.",
    actionError:
      "Houve um problema ao acionar o fluxo de notificação. A ação da página ainda foi aberta.",
    selectedRealtor: "REALTOR SELECIONADO",
  },
  es: {
    title: "Finley Beyond impulsado por Beyond Intelligence™",
    subtitle: "Comience su conversación hipotecaria guiada con Finley Beyond.",
    disclaimerTitle: "Aviso Requerido",
    disclaimerText:
      "Este sistema proporciona únicamente orientación preliminar. No constituye aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, asesoría fiscal ni determinación final del programa. Todos los escenarios permanecen sujetos a revisión por un loan officer con licencia, documentación, verificación, underwriting, title, appraisal y lineamientos actuales del inversionista o la agencia.",
    disclaimerAccept: "Reconozco y acepto este aviso.",
    formLockedNotice:
      "Por favor, acepte el aviso de arriba para comenzar a llenar el formulario.",
    runReviewFirstHint:
      "Haga clic en Ejecutar Revisión Preliminar antes de continuar con el escenario de la propiedad.",
    formResetNotice:
      "Este formulario se reiniciará en breve para que el próximo cliente comience desde cero.",
    intakeIncompleteHint:
      "Por favor, complete su nombre, correo, teléfono y (si trabaja con un Realtor) el nombre, teléfono y correo del Realtor antes de ejecutar la revisión preliminar.",
    scenarioDirectionTitle: "Dirección Interna del Escenario",
    scenarioDirectionText:
      "Esta sección refleja la dirección interna de matching de Finley Beyond y se utiliza para guiar la conversación y el enrutamiento.",
    conversationTitle: "Conversación con Finley Beyond",
    conversationPlaceholder:
      "Complete el intake, confirme el loan officer y confirme el escenario de la propiedad para comenzar la conversación.",
    chatPlaceholder:
      "Haga una pregunta o responda la siguiente pregunta hipotecaria de Finley Beyond.",
    sendMessage: "Enviar Mensaje",
    sending: "Enviando...",
    nextActions: "Próximos Pasos",
    applyNow: "Aplicar Ahora",
    scheduleLoanOfficer: "Agendar con Loan Officer",
    emailLoanOfficer: "Enviar Correo al Loan Officer",
    callLoanOfficer: "Llamar al Loan Officer",
    purchase: "Compra",
    refinance: "Refinanciamiento",
    investment: "Inversión",
    borrowerName: "Nombre del Cliente",
    email: "Correo Electrónico",
    phone: "Teléfono",
    estimatedCreditScore: "Puntaje de Crédito Estimado",
    grossMonthlyIncome: "Ingreso Bruto Mensual",
    monthlyDebt: "Deuda Mensual",
    currentState: "Estado Actual",
    targetState: "Estado Objetivo",
    selectStateOption: "— Seleccione un estado —",
    workingWithRealtor: "¿Está trabajando con un Realtor?",
    yes: "Sí",
    no: "No",
    notSure: "No Estoy Seguro",
    realtorName: "Nombre del Realtor",
    realtorPhone: "Teléfono del Realtor",
    realtorEmail: "Correo del Realtor",
    realtorMls: "MLS # del Realtor",
    realtorSearchHint: "Comience a escribir para ver Realtors registrados en su Estado Objetivo.",
    realtorPickStateFirst: "Seleccione un Estado Objetivo arriba para ver Realtors registrados en ese estado.",
    realtorNoneInState: "Aún no hay Realtors registrados en este estado. Puede escribir los datos de su Realtor manualmente abajo.",
    realtorPrivacyNotice:
      "Su Realtor recibirá un aviso de cortesía indicando que inició una revisión hipotecaria. No se comparten detalles financieros.",
    loanOfficerSearch: "Comience a escribir para ver loan officers coincidentes.",
    loanOfficerSearchHint: "Los loan officers mostrados están licenciados en su Estado Objetivo.",
    loanOfficerPickStateFirst: "Seleccione un Estado Objetivo arriba para ver loan officers licenciados en ese estado.",
    loanOfficerNoneInState: "Aún no hay loan officers licenciados en este estado.",
    confirmLoanOfficer: "Confirmar Loan Officer",
    unknownLoanOfficer: "No Conozco Mi Loan Officer",
    assignedRouting: "ASIGNACIÓN DEFINIDA",
    routingText:
      "El resumen interno se enviará al loan officer asignado y al soporte del equipo.",
    runReview: "Ejecutar Revisión Preliminar",
    reviewing: "Revisando...",
    reviewCompleted: "Revisión Preliminar Completada ✓",
    propertyScenario: "Escenario de la Propiedad",
    homePrice: "Precio Estimado de la Propiedad",
    downPayment: "Pago Inicial Estimado",
    occupancyPrimary: "Residencia Principal",
    occupancySecond: "Segunda Vivienda",
    occupancyInvestment: "Propiedad de Inversión",
    estimatedLoanAmount: "Monto Estimado del Préstamo",
    estimatedLtv: "LTV Estimado",
    continueScenario: "Continuar con Este Escenario",
    updatingScenario: "Actualizando Escenario...",
    startConversationHint:
      "Complete el intake, confirme el loan officer y confirme el escenario de la propiedad para comenzar la conversación.",
    summarySent:
      "Su acción fue registrada y se activaron las notificaciones correspondientes.",
    actionError:
      "Hubo un problema al activar el flujo de notificación. La acción de la página igualmente se abrió.",
    selectedRealtor: "REALTOR SELECCIONADO",
  },
};

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 10)}`;
}

function formatNumberDisplay(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
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
      JSON.stringify(obj, null, 2)
    );
  }

  return "";
}

// Pulls the persisted intake session id out of /api/chat's response meta.
// Returns null if not present (e.g. server-side persistence hiccup — chat
// reply still flows through, we just don't get a session id back this turn).
function extractIntakeSessionId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const meta = (data as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;
  const id = (meta as { intakeSessionId?: unknown }).intakeSessionId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function toOfficerRecordFromAPI(lo: LoanOfficerOut): LoanOfficerRecord {
  return {
    id: lo.id,
    name: lo.name,
    nmls: lo.nmls || "",
    email: lo.isBot ? "finley@beyondintelligence.io" : lo.email,
    assistantEmail: lo.isBot ? "" : lo.assistantEmail || "",
    mobile: lo.phone || "",
    assistantMobile: "",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: lo.calendly || "https://www.beyondfinancing.com",
  };
}

function toPreferredLanguage(code: LanguageCode): PreferredLanguage {
  if (code === "pt") return "Português";
  if (code === "es") return "Español";
  return "English";
}

export default function BorrowerPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [accepted, setAccepted] = useState(false);
  const [borrowerPath, setBorrowerPath] = useState<BorrowerPath>("Purchase");
  const [realtorStatus, setRealtorStatus] = useState<RealtorStatus>("no");
  const [submitted, setSubmitted] = useState(false);
  const [scenarioUnlocked, setScenarioUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"" | "apply" | "schedule" | "email" | "call">("");
  const [errorMessage, setErrorMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [intakeSessionId, setIntakeSessionId] = useState<string | null>(null);

  // Phase 6: track whether the intake notification (LO + realtor + audit log)
  // has fired this session so re-running preliminary review doesn't re-spam.
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversation.length, chatLoading]);

  const [loanOfficersFromApi, setLoanOfficersFromApi] = useState<LoanOfficerOut[]>([]);
  const [realtorsFromApi, setRealtorsFromApi] = useState<RealtorOut[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [loanOfficerQuery, setLoanOfficerQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] =
    useState<LoanOfficerRecord | null>(null);

  const [selectedRealtor, setSelectedRealtor] =
    useState<RealtorOut | null>(null);

  const [intakeForm, setIntakeForm] = useState<IntakeFormState>({
    name: "",
    email: "",
    phone: "",
    credit: "",
    income: "",
    debt: "",
    currentState: "",
    targetState: "",
    realtorName: "",
    realtorPhone: "",
    realtorEmail: "",
    realtorMls: "",
  });

  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>({
    homePrice: "",
    downPayment: "",
    occupancy: "primary_residence",
  });

  const t = COPY[language];

  // ---------------------------------------------------------------------------
  // Phase 5-prep-B: Re-fetch directory whenever target state changes.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const stateCode = (intakeForm.targetState || "").trim().toUpperCase();

    if (!stateCode) {
      setLoanOfficersFromApi([]);
      setRealtorsFromApi([]);
      return;
    }

    let cancelled = false;

    const loadDirectory = async () => {
      try {
        setDirectoryLoading(true);

        const response = await fetch(
          `/api/public/team-users?state=${encodeURIComponent(stateCode)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (cancelled) return;

        if (response.ok && data?.success) {
          setLoanOfficersFromApi(
            Array.isArray(data.loanOfficers) ? data.loanOfficers : []
          );
          setRealtorsFromApi(Array.isArray(data.realtors) ? data.realtors : []);
        } else {
          setLoanOfficersFromApi([]);
          setRealtorsFromApi([]);
        }
      } catch {
        if (!cancelled) {
          setLoanOfficersFromApi([]);
          setRealtorsFromApi([]);
        }
      } finally {
        if (!cancelled) setDirectoryLoading(false);
      }
    };

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, [intakeForm.targetState]);

  const dynamicLoanOfficers = useMemo(() => {
    const mapped = loanOfficersFromApi.map(toOfficerRecordFromAPI);

    const hasFinley = loanOfficersFromApi.some((u) => u.isBot);

    if (mapped.length === 0) {
      return [FALLBACK_DEFAULT_LOAN_OFFICER];
    }

    if (!hasFinley) {
      mapped.push(FALLBACK_DEFAULT_LOAN_OFFICER);
    }

    return mapped;
  }, [loanOfficersFromApi]);

  const defaultLoanOfficer = useMemo(() => {
    return (
      dynamicLoanOfficers.find(
        (officer) => officer.name.toLowerCase() === "finley beyond"
      ) || FALLBACK_DEFAULT_LOAN_OFFICER
    );
  }, [dynamicLoanOfficers]);

  const activeOfficer = selectedOfficer || defaultLoanOfficer;

  const officerSuggestions = useMemo(() => {
    const query = loanOfficerQuery.trim().toLowerCase();
    if (!query || selectedOfficer) return [];

    return dynamicLoanOfficers
      .filter(
        (officer) =>
          officer.name.toLowerCase().includes(query) ||
          officer.nmls.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [loanOfficerQuery, selectedOfficer, dynamicLoanOfficers]);

  const realtorSuggestions = useMemo(() => {
    const query = intakeForm.realtorName.trim().toLowerCase();
    if (!query || selectedRealtor || realtorStatus !== "yes") return [];

    return realtorsFromApi
      .filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          (r.email || "").toLowerCase().includes(query) ||
          (r.phone || "").toLowerCase().includes(query) ||
          (r.mls || "").toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [realtorsFromApi, intakeForm.realtorName, selectedRealtor, realtorStatus]);

  // ---------------------------------------------------------------------------
  // Field setters
  // ---------------------------------------------------------------------------

  const setIntakeField = (key: keyof IntakeFormState, value: string) => {
    setIntakeForm((prev) => ({ ...prev, [key]: value }));

    if (key === "realtorName") {
      setSelectedRealtor(null);
    }
  };

  const setTargetState = (newCode: string) => {
    setIntakeForm((prev) => ({
      ...prev,
      targetState: newCode,
      realtorName: "",
      realtorPhone: "",
      realtorEmail: "",
      realtorMls: "",
    }));
    setSelectedRealtor(null);
    setSelectedOfficer(null);
    setLoanOfficerQuery("");
  };

  const setScenarioField = (key: keyof ScenarioFormState, value: string) => {
    setScenarioForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectRealtor = (realtor: RealtorOut) => {
    setSelectedRealtor(realtor);
    setIntakeForm((prev) => ({
      ...prev,
      realtorName: realtor.name,
      realtorPhone: formatPhoneDisplay(realtor.phone || ""),
      realtorEmail: realtor.email || "",
      realtorMls: realtor.mls || "",
    }));
  };

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const estimatedLoanAmount = useMemo(() => {
    const homePrice = Number(scenarioForm.homePrice) || 0;
    const downPayment = Number(scenarioForm.downPayment) || 0;
    return Math.max(homePrice - downPayment, 0);
  }, [scenarioForm.homePrice, scenarioForm.downPayment]);

  const estimatedLtv = useMemo(() => {
    const homePrice = Number(scenarioForm.homePrice) || 0;
    if (homePrice <= 0) return 0;
    return estimatedLoanAmount / homePrice;
  }, [scenarioForm.homePrice, estimatedLoanAmount]);

  const targetStateName = intakeForm.targetState
    ? STATE_NAMES_BY_CODE[intakeForm.targetState] || intakeForm.targetState
    : "";

  const realtorMessage = (() => {
    if (realtorStatus !== "yes") return "";
    if (!intakeForm.targetState) return t.realtorPickStateFirst;
    if (realtorsFromApi.length === 0 && !directoryLoading) {
      return t.realtorNoneInState.replace("{state}", targetStateName);
    }
    return t.realtorSearchHint;
  })();

  const loanOfficerMessage = (() => {
    if (!intakeForm.targetState) return t.loanOfficerPickStateFirst;
    if (loanOfficersFromApi.length === 0 && !directoryLoading) {
      return t.loanOfficerNoneInState;
    }
    return t.loanOfficerSearchHint;
  })();

  // Phase 6: intake validation. Runs before /api/borrower-intake fires.
  const intakeIsValid = (): boolean => {
    if (!intakeForm.name.trim()) return false;
    if (!intakeForm.email.trim()) return false;
    if (!intakeForm.phone.trim()) return false;

    if (realtorStatus === "yes") {
      if (!intakeForm.realtorName.trim()) return false;
      if (!intakeForm.realtorPhone.trim()) return false;
      if (!intakeForm.realtorEmail.trim()) return false;
    }

    return true;
  };

  const resolveOfficerFromQuery = (query: string): LoanOfficerRecord | null => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return null;

    const exact = dynamicLoanOfficers.find(
      (officer) =>
        officer.name.toLowerCase() === trimmed ||
        officer.nmls.toLowerCase() === trimmed
    );

    if (exact) return exact;

    const containedInQuery = dynamicLoanOfficers.find(
      (officer) =>
        trimmed.includes(officer.name.toLowerCase()) ||
        (officer.nmls && trimmed.includes(officer.nmls.toLowerCase()))
    );

    if (containedInQuery) return containedInQuery;

    const partial = dynamicLoanOfficers.find(
      (officer) =>
        officer.name.toLowerCase().includes(trimmed) ||
        officer.nmls.toLowerCase().includes(trimmed)
    );

    return partial || null;
  };

  const buildBorrowerContext = () => {
    return `
Borrower profile for context:
- Preferred language: ${language}
- Borrower path: ${borrowerPath}
- Name: ${intakeForm.name || "Not provided"}
- Email: ${intakeForm.email || "Not provided"}
- Phone: ${intakeForm.phone || "Not provided"}
- Estimated Credit Score: ${intakeForm.credit || "Not provided"}
- Gross Monthly Income: ${intakeForm.income || "Not provided"}
- Monthly Debt: ${intakeForm.debt || "Not provided"}
- Current State: ${intakeForm.currentState || "Not provided"}
- Target State: ${intakeForm.targetState || "Not provided"}
- Working with Realtor: ${realtorStatus}
- Realtor Name: ${intakeForm.realtorName || "Not provided"}
- Realtor Phone: ${intakeForm.realtorPhone || "Not provided"}
- Realtor Email: ${intakeForm.realtorEmail || "Not provided"}
- Realtor MLS: ${intakeForm.realtorMls || "Not provided"}
- Assigned Loan Officer: ${activeOfficer.name}
- Assigned Loan Officer NMLS: ${activeOfficer.nmls}
- Assigned Loan Officer Email: ${activeOfficer.email}
- Estimated Home Price: ${scenarioForm.homePrice || "Not provided"}
- Estimated Down Payment: ${scenarioForm.downPayment || "Not provided"}
- Occupancy: ${scenarioForm.occupancy || "Not provided"}
- Estimated Loan Amount: ${
      estimatedLoanAmount > 0 ? Math.round(estimatedLoanAmount) : "Not provided"
    }
- Estimated LTV: ${
      Number(scenarioForm.homePrice) > 0
        ? `${Math.round(estimatedLtv * 100)}%`
        : "Not provided"
    }

Conversation role:
You are Finley Beyond acting like a professional mortgage loan officer assistant.
Your job is to gather qualification-oriented information, answer appropriate borrower questions, and help move the borrower toward the assigned loan officer.
You must never disclose specific loan programs, specific loan terms, personalized interest rates, or definitive qualification determinations to the borrower.
You should encourage the borrower to start the application when appropriate.
Respond in ${
      language === "pt"
        ? "Portuguese"
        : language === "es"
        ? "Spanish"
        : "English"
    }.
    `.trim();
  };

  const buildSummaryPayload = () => ({
    lead: {
      fullName: intakeForm.name,
      email: intakeForm.email,
      phone: intakeForm.phone,
      preferredLanguage: toPreferredLanguage(language),
      loanOfficer: activeOfficer.name,
      // Phase 6: pass FK + raw query so chat-summary's resolve_loan_officer
      // RPC takes the FK path instead of falling back to text name match.
      loanOfficerId: activeOfficer.id,
      loanOfficerQuery: loanOfficerQuery,
      assignedEmail: activeOfficer.email,
      assistantEmail: activeOfficer.assistantEmail,
      realtorName: realtorStatus === "yes" ? intakeForm.realtorName : "",
      realtorEmail: realtorStatus === "yes" ? intakeForm.realtorEmail : "",
      realtorPhone: realtorStatus === "yes" ? intakeForm.realtorPhone : "",
      realtorMls: realtorStatus === "yes" ? intakeForm.realtorMls : "",
      borrowerPath,
      currentState: intakeForm.currentState,
      targetState: intakeForm.targetState,
      homePrice: scenarioForm.homePrice,
      downPayment: scenarioForm.downPayment,
      estimatedCreditScore: intakeForm.credit,
      monthlyIncome: intakeForm.income,
      monthlyDebt: intakeForm.debt,
    },
    selectedOfficer: activeOfficer,
    selectedRealtor:
      realtorStatus === "yes"
        ? {
            id: selectedRealtor?.id || "",
            name: intakeForm.realtorName,
            email: intakeForm.realtorEmail,
            phone: intakeForm.realtorPhone,
            mls: intakeForm.realtorMls,
          }
        : null,
    messages: conversation,
  });

  // Phase 6: payload for /api/borrower-intake (different shape than chat-summary)
  const buildIntakePayload = () => ({
    borrower: {
      fullName: intakeForm.name.trim(),
      email: intakeForm.email.trim(),
      phone: intakeForm.phone.trim(),
      preferredLanguage: toPreferredLanguage(language),
    },
    loanOfficerId: activeOfficer.id,
    loanOfficerQuery: loanOfficerQuery,
    realtor:
      realtorStatus === "yes"
        ? {
            hasRealtor: true,
            name: intakeForm.realtorName.trim(),
            email: intakeForm.realtorEmail.trim(),
            phone: intakeForm.realtorPhone.trim(),
          }
        : { hasRealtor: false },
    scenario: {
      homePrice: scenarioForm.homePrice,
      downPayment: scenarioForm.downPayment,
      estimatedLoanAmount:
        estimatedLoanAmount > 0 ? String(Math.round(estimatedLoanAmount)) : "",
      estimatedLtv:
        Number(scenarioForm.homePrice) > 0
          ? `${Math.round(estimatedLtv * 100)}%`
          : "",
    },
  });

  const confirmOfficerSelection = () => {
    if (selectedOfficer) {
      setLoanOfficerQuery(
        `${selectedOfficer.name} — NMLS ${selectedOfficer.nmls}`
      );
      return;
    }

    const matched = resolveOfficerFromQuery(loanOfficerQuery);
    if (matched) {
      setSelectedOfficer(matched);
      setLoanOfficerQuery(`${matched.name} — NMLS ${matched.nmls}`);
    } else {
      setSelectedOfficer(defaultLoanOfficer);
      setLoanOfficerQuery(
        `${defaultLoanOfficer.name} — NMLS ${defaultLoanOfficer.nmls}`
      );
    }
  };

  const useDefaultFinley = () => {
    setSelectedOfficer(defaultLoanOfficer);
    setLoanOfficerQuery(
      `${defaultLoanOfficer.name} — NMLS ${defaultLoanOfficer.nmls}`
    );
  };

  const runPreliminaryReview = async () => {
    // Phase 6: gate on intake validity. The button is disabled when invalid,
    // but defend in depth in case state goes stale.
    if (!intakeIsValid()) {
      setErrorMessage(t.intakeIncompleteHint);
      return;
    }

    setSubmitted(true);
    setLoading(true);
    setErrorMessage("");
    setChatError("");
    setConversation([]);

    const resolvedOfficer =
      selectedOfficer ||
      resolveOfficerFromQuery(loanOfficerQuery) ||
      defaultLoanOfficer;

    if (!selectedOfficer || selectedOfficer.id !== resolvedOfficer.id) {
      setSelectedOfficer(resolvedOfficer);
      setLoanOfficerQuery(`${resolvedOfficer.name} — NMLS ${resolvedOfficer.nmls}`);
    }

    try {
      const prompt = `
${buildBorrowerContext()}

Start the borrower conversation as a loan officer assistant.
Briefly acknowledge the borrower information already entered.
Do not disclose loan programs, rates, terms, or approval status.
Tell the borrower that the assigned loan officer will review the information personally.
Then ask the next logical qualification-style question.
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "initial_review",
          routing: {
            selectedOfficer: resolvedOfficer,
            selectedRealtor,
            borrower: intakeForm,
            scenario: {
              ...scenarioForm,
              estimatedLoanAmount: String(estimatedLoanAmount || ""),
              estimatedLtv:
                Number(scenarioForm.homePrice) > 0
                  ? `${Math.round(estimatedLtv * 100)}%`
                  : "",
            },
            conversation,
            language,
            borrowerPath,
            realtorStatus,
            intakeSessionId,
          },
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          extractAiText(data) || "The AI request did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) || "No response was returned from the AI system.";

      const newSessionId = extractIntakeSessionId(data);
      if (newSessionId) setIntakeSessionId(newSessionId);

      setConversation([{ role: "assistant", content: finalText }]);
      setScenarioUnlocked(true);

      // Phase 6: fire intake notification once per session, after the AI
      // confirms the conversation started. Non-blocking — the borrower keeps
      // chatting even if Resend hiccups.
      if (!intakeSubmitted) {
        void fetch("/api/borrower-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildIntakePayload()),
        })
          .then((res) => {
            if (res.ok) setIntakeSubmitted(true);
          })
          .catch(() => {
            // Server-side log captures the failure; UI doesn't surface it
            // because the borrower's chat session is already underway.
          });
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "There was an error connecting to the AI system."
      );
      setConversation([]);
      setScenarioUnlocked(false);
    } finally {
      setLoading(false);
    }
  };

  const updateScenarioAndContinue = async () => {
    if (!submitted || !scenarioUnlocked) return;

    setChatLoading(true);
    setChatError("");

    try {
      const prompt = `
${buildBorrowerContext()}

The borrower has now entered the target property scenario.
Acknowledge it briefly.
Do not disclose loan programs, rates, terms, or approval status.
Tell the borrower this scenario will be shared with the assigned loan officer for analysis.
Then ask the next logical qualification-style question.
      `.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "scenario_review",
          routing: {
            selectedOfficer: activeOfficer,
            selectedRealtor,
            borrower: intakeForm,
            scenario: {
              ...scenarioForm,
              estimatedLoanAmount: String(estimatedLoanAmount || ""),
              estimatedLtv:
                Number(scenarioForm.homePrice) > 0
                  ? `${Math.round(estimatedLtv * 100)}%`
                  : "",
            },
            conversation,
            language,
            borrowerPath,
            realtorStatus,
            intakeSessionId,
          },
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          extractAiText(data) || "The scenario update did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) || "No response was returned from the AI system.";

      const newSessionId = extractIntakeSessionId(data);
      if (newSessionId) setIntakeSessionId(newSessionId);

      setConversation((prev) => [...prev, { role: "assistant", content: finalText }]);
    } catch (error: unknown) {
      setChatError(
        error instanceof Error
          ? error.message
          : "There was an error updating the scenario."
      );
    } finally {
      setChatLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !submitted) return;

    setChatLoading(true);
    setChatError("");

    const nextConversation: ChatMessage[] = [
      ...conversation,
      { role: "user", content: trimmed },
    ];

    setConversation(nextConversation);
    setChatInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "follow_up",
          routing: {
            selectedOfficer: activeOfficer,
            selectedRealtor,
            borrower: intakeForm,
            scenario: {
              ...scenarioForm,
              estimatedLoanAmount: String(estimatedLoanAmount || ""),
              estimatedLtv:
                Number(scenarioForm.homePrice) > 0
                  ? `${Math.round(estimatedLtv * 100)}%`
                  : "",
            },
            conversation: nextConversation,
            language,
            borrowerPath,
            realtorStatus,
            intakeSessionId,
          },
          messages: [
            {
              role: "user",
              content: `${buildBorrowerContext()}

Continue the borrower-facing conversation naturally.
Never disclose exact loan programs, specific terms, or personalized rates.
Encourage the borrower to start the application when appropriate.
Advise that the assigned loan officer will personally review the scenario and advise next steps.`,
            },
            ...nextConversation,
          ],
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          extractAiText(data) || "The chat request did not complete successfully."
        );
      }

      const finalText =
        extractAiText(data) || "No response was returned from the AI system.";

      const newSessionId = extractIntakeSessionId(data);
      if (newSessionId) setIntakeSessionId(newSessionId);

      setConversation((prev) => [...prev, { role: "assistant", content: finalText }]);
    } catch (error: unknown) {
      setChatError(
        error instanceof Error
          ? error.message
          : "There was an error connecting to Finley Beyond."
      );
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  };

  const resetForm = () => {
    setAccepted(false);
    setBorrowerPath("Purchase");
    setRealtorStatus("no");
    setSubmitted(false);
    setScenarioUnlocked(false);
    setConversation([]);
    setIntakeSessionId(null);
    setChatInput("");
    setSelectedOfficer(null);
    setSelectedRealtor(null);
    setLoanOfficerQuery("");
    setErrorMessage("");
    setChatError("");
    setActionMessage("");
    setLoanOfficersFromApi([]);
    setRealtorsFromApi([]);
    setIntakeSubmitted(false); // Phase 6
    setIntakeForm({
      name: "",
      email: "",
      phone: "",
      credit: "",
      income: "",
      debt: "",
      currentState: "",
      targetState: "",
      realtorName: "",
      realtorPhone: "",
      realtorEmail: "",
      realtorMls: "",
    });
    setScenarioForm({
      homePrice: "",
      downPayment: "",
      occupancy: "primary_residence",
    });
  };

  async function notifyAndOpen(
    trigger: "apply" | "schedule" | "contact" | "call",
    action: () => void
  ) {
    setActionLoading(trigger === "contact" ? "email" : (trigger as "apply" | "schedule" | "call"));
    setActionMessage("");

    try {
      await fetch("/api/chat-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildSummaryPayload(),
          trigger,
        }),
      });

      setActionMessage(`${t.summarySent} ${t.formResetNotice}`);
    } catch {
      setActionMessage(t.actionError);
    } finally {
      action();
      setActionLoading("");
    }

    setTimeout(() => {
      resetForm();
    }, 3000);
  }

  const mailtoHref = `mailto:${activeOfficer.email}?subject=${encodeURIComponent(
    `Borrower inquiry from ${intakeForm.name || "Beyond Intelligence"}`
  )}&body=${encodeURIComponent(
    language === "pt"
      ? `Olá ${activeOfficer.name}, gostaria de falar sobre meu cenário de financiamento.`
      : language === "es"
      ? `Hola ${activeOfficer.name}, me gustaría hablar sobre mi escenario de financiamiento.`
      : `Hello ${activeOfficer.name}, I would like to discuss my financing scenario.`
  )}`;

  const assignedEmailLine = activeOfficer.assistantEmail
    ? `${activeOfficer.email} and ${activeOfficer.assistantEmail}.`
    : `${activeOfficer.email}.`;

  // Phase 6: precompute disabled/hint state for the Run button so it stays
  // readable below.
  const reviewDisabled =
    !accepted || loading || scenarioUnlocked || !intakeIsValid();

  const showIntakeHint =
    accepted && !scenarioUnlocked && !loading && !intakeIsValid();

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <SiteHeader
          variant="borrower"
          language={language as SiteLanguage}
          onLanguageChange={(next) => setLanguage(next as LanguageCode)}
        />

        <h1 style={styles.pageTitle}>{t.title}</h1>
        <p style={styles.pageSubtitle}>{t.subtitle}</p>

        <div className="bf-borrower-grid" style={styles.topGrid}>
          <div style={styles.box}>
            <h2 style={styles.boxTitle}>{t.disclaimerTitle}</h2>
            <p style={styles.boxText}>{t.disclaimerText}</p>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>{t.disclaimerAccept}</span>
            </label>
          </div>

          <div style={styles.box}>
            <h2 style={styles.boxTitle}>{t.scenarioDirectionTitle}</h2>
            <p style={styles.boxText}>{t.scenarioDirectionText}</p>
          </div>
        </div>

        <div style={styles.formSection}>
          <div style={styles.formCard}>
            {!accepted && (
              <div style={styles.lockNotice}>🔒 {t.formLockedNotice}</div>
            )}

            <div style={styles.pathRow}>
              {(["Purchase", "Refinance", "Investment"] as BorrowerPath[]).map((path) => (
                <button
                  key={path}
                  type="button"
                  disabled={!accepted}
                  style={{
                    ...styles.pathButton,
                    backgroundColor: borrowerPath === path ? "#5CB2D8" : "#FFFFFF",
                    color: borrowerPath === path ? "#FFFFFF" : "#60749B",
                    opacity: accepted ? 1 : 0.55,
                    cursor: accepted ? "pointer" : "not-allowed",
                  }}
                  onClick={() => accepted && setBorrowerPath(path)}
                >
                  {path === "Purchase"
                    ? t.purchase
                    : path === "Refinance"
                    ? t.refinance
                    : t.investment}
                </button>
              ))}
            </div>

            <div className="bf-form-grid" style={styles.formGrid}>
              <input
                style={styles.input}
                placeholder={t.borrowerName}
                value={intakeForm.name}
                onChange={(e) => setIntakeField("name", e.target.value)}
                disabled={!accepted}
              />
              <input
                style={styles.input}
                placeholder={t.email}
                value={intakeForm.email}
                onChange={(e) => setIntakeField("email", e.target.value)}
                disabled={!accepted}
              />
              <input
                style={styles.input}
                placeholder={t.phone}
                value={intakeForm.phone}
                onChange={(e) => setIntakeField("phone", formatPhoneDisplay(e.target.value))}
                disabled={!accepted}
              />
              <input
                style={styles.input}
                placeholder={t.estimatedCreditScore}
                value={intakeForm.credit}
                onChange={(e) => setIntakeField("credit", e.target.value)}
                disabled={!accepted}
              />
              <input
                style={styles.input}
                placeholder={t.grossMonthlyIncome}
                value={formatNumberDisplay(intakeForm.income)}
                onChange={(e) => setIntakeField("income", digitsOnly(e.target.value))}
                disabled={!accepted}
                inputMode="numeric"
              />
              <input
                style={styles.input}
                placeholder={t.monthlyDebt}
                value={formatNumberDisplay(intakeForm.debt)}
                onChange={(e) => setIntakeField("debt", digitsOnly(e.target.value))}
                disabled={!accepted}
                inputMode="numeric"
              />

              <select
                style={styles.input}
                value={intakeForm.currentState}
                onChange={(e) => setIntakeField("currentState", e.target.value)}
                aria-label={t.currentState}
                disabled={!accepted}
              >
                <option value="">
                  {t.currentState} — {t.selectStateOption}
                </option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              <select
                style={styles.input}
                value={intakeForm.targetState}
                onChange={(e) => setTargetState(e.target.value)}
                aria-label={t.targetState}
                disabled={!accepted}
              >
                <option value="">
                  {t.targetState} — {t.selectStateOption}
                </option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.realtorLabel}>{t.workingWithRealtor}</div>
            <div style={styles.realtorButtonRow}>
              {(["yes", "no", "not_sure"] as RealtorStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={!accepted}
                  style={{
                    ...styles.realtorButton,
                    backgroundColor: realtorStatus === status ? "#5CB2D8" : "#FFFFFF",
                    color: realtorStatus === status ? "#FFFFFF" : "#60749B",
                    opacity: accepted ? 1 : 0.55,
                    cursor: accepted ? "pointer" : "not-allowed",
                  }}
                  onClick={() => {
                    if (!accepted) return;
                    setRealtorStatus(status);
                    if (status !== "yes") {
                      setSelectedRealtor(null);
                      setIntakeForm((prev) => ({
                        ...prev,
                        realtorName: "",
                        realtorPhone: "",
                        realtorEmail: "",
                        realtorMls: "",
                      }));
                    }
                  }}
                >
                  {status === "yes" ? t.yes : status === "no" ? t.no : t.notSure}
                </button>
              ))}
            </div>

            {realtorStatus === "yes" && (
              <>
                {/* Phase 6: privacy notice surfaced to borrower so they know
                    what (and what not) the realtor will see. */}
                <div style={{ ...styles.statusBox, marginTop: 12 }}>
                  {t.realtorPrivacyNotice}
                </div>

                <div className="bf-form-grid" style={{ ...styles.formGrid, marginTop: 14 }}>
                  <div style={styles.autocompleteWrap}>
                    <input
                      style={styles.input}
                      placeholder={t.realtorName}
                      value={intakeForm.realtorName}
                      onChange={(e) => setIntakeField("realtorName", e.target.value)}
                      disabled={!accepted || !intakeForm.targetState}
                    />

                    {realtorSuggestions.length > 0 && (
                      <div style={styles.suggestionBox}>
                        {realtorSuggestions.map((realtor) => (
                          <button
                            key={realtor.id}
                            type="button"
                            onClick={() => selectRealtor(realtor)}
                            style={styles.suggestionItem}
                          >
                            {realtor.name} — MLS {realtor.mls || "—"} · {realtor.phone || "No phone"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    style={styles.input}
                    placeholder={t.realtorPhone}
                    value={intakeForm.realtorPhone}
                    onChange={(e) =>
                      setIntakeField("realtorPhone", formatPhoneDisplay(e.target.value))
                    }
                    disabled={!accepted}
                  />
                  <input
                    style={styles.input}
                    placeholder={t.realtorEmail}
                    value={intakeForm.realtorEmail}
                    onChange={(e) => setIntakeField("realtorEmail", e.target.value)}
                    disabled={!accepted}
                  />
                  <input
                    style={styles.input}
                    placeholder={t.realtorMls}
                    value={intakeForm.realtorMls}
                    onChange={(e) => setIntakeField("realtorMls", e.target.value)}
                    disabled={!accepted}
                  />
                </div>

                <div style={styles.hintText}>{realtorMessage}</div>

                {selectedRealtor ? (
                  <div style={styles.assignedCard}>
                    <div style={styles.assignedTitle}>{t.selectedRealtor}</div>
                    <div style={styles.assignedName}>
                      {selectedRealtor.name} — MLS {selectedRealtor.mls || "—"}
                    </div>
                    <div style={styles.assignedText}>
                      {selectedRealtor.email}
                      <br />
                      {selectedRealtor.phone || "No phone on file"}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            <input
              style={{ ...styles.input, marginTop: 14 }}
              placeholder={t.loanOfficerSearch}
              value={loanOfficerQuery}
              onChange={(e) => {
                setLoanOfficerQuery(e.target.value);
                setSelectedOfficer(null);
              }}
              disabled={!accepted || !intakeForm.targetState}
            />

            {officerSuggestions.length > 0 && (
              <div style={styles.suggestionBox}>
                {officerSuggestions.map((officer) => (
                  <button
                    key={officer.id}
                    type="button"
                    onClick={() => {
                      setSelectedOfficer(officer);
                      setLoanOfficerQuery(`${officer.name} — NMLS ${officer.nmls}`);
                    }}
                    style={styles.suggestionItem}
                  >
                    {officer.name} — NMLS {officer.nmls}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.hintText}>{loanOfficerMessage}</div>

            <div style={styles.confirmRow}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={confirmOfficerSelection}
                disabled={!accepted || !intakeForm.targetState}
              >
                {t.confirmLoanOfficer}
              </button>
              <button
                type="button"
                style={styles.outlineButton}
                onClick={useDefaultFinley}
                disabled={!accepted}
              >
                {t.unknownLoanOfficer}
              </button>
            </div>

            <div style={styles.assignedCard}>
              <div style={styles.assignedTitle}>{t.assignedRouting}</div>
              <div style={styles.assignedName}>
                {activeOfficer.name} — NMLS {activeOfficer.nmls}
              </div>
              <div style={styles.assignedText}>
                {t.routingText}
                <br />
                {assignedEmailLine}
              </div>
            </div>

            <div style={styles.propertyCard}>
              <h2 style={styles.boxTitle}>{t.propertyScenario}</h2>

              <div className="bf-form-grid" style={styles.formGrid}>
                <input
                  style={styles.input}
                  placeholder={t.homePrice}
                  value={formatNumberDisplay(scenarioForm.homePrice)}
                  onChange={(e) => setScenarioField("homePrice", digitsOnly(e.target.value))}
                  inputMode="numeric"
                />
                <input
                  style={styles.input}
                  placeholder={t.downPayment}
                  value={formatNumberDisplay(scenarioForm.downPayment)}
                  onChange={(e) => setScenarioField("downPayment", digitsOnly(e.target.value))}
                  inputMode="numeric"
                />
              </div>

              <select
                value={scenarioForm.occupancy}
                onChange={(e) => setScenarioField("occupancy", e.target.value)}
                style={{ ...styles.input, marginTop: 14 }}
              >
                <option value="primary_residence">{t.occupancyPrimary}</option>
                <option value="second_home">{t.occupancySecond}</option>
                <option value="investment_property">{t.occupancyInvestment}</option>
              </select>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>{t.estimatedLoanAmount}</div>
                <div style={styles.metricValue}>{formatCurrency(estimatedLoanAmount)}</div>
                <div style={styles.metricSubtext}>
                  {t.estimatedLtv}: {Math.round(estimatedLtv * 100)}%
                </div>
              </div>

              <button
                type="button"
                style={reviewDisabled ? styles.disabledButton : styles.primaryButtonWide}
                onClick={runPreliminaryReview}
                disabled={reviewDisabled}
              >
                {loading
                  ? t.reviewing
                  : scenarioUnlocked
                  ? t.reviewCompleted
                  : t.runReview}
              </button>

              {/* Phase 6: explain why the Run button is disabled when intake
                  is incomplete, so the borrower knows what to fix. */}
              {showIntakeHint && (
                <div style={styles.hintText}>{t.intakeIncompleteHint}</div>
              )}

              <button
                type="button"
                style={
                  !scenarioUnlocked ||
                  chatLoading ||
                  !scenarioForm.homePrice ||
                  !scenarioForm.downPayment
                    ? styles.disabledButton
                    : styles.primaryButtonWide
                }
                onClick={updateScenarioAndContinue}
                disabled={
                  !scenarioUnlocked ||
                  chatLoading ||
                  !scenarioForm.homePrice ||
                  !scenarioForm.downPayment
                }
              >
                {chatLoading ? t.updatingScenario : t.continueScenario}
              </button>
              {!scenarioUnlocked && (
                <div style={styles.hintText}>{t.runReviewFirstHint}</div>
              )}
            </div>
          </div>
        </div>

        <div className="bf-borrower-grid" style={styles.bottomGrid}>
          <div style={styles.box}>
            <h2 style={styles.boxTitle}>{t.conversationTitle}</h2>

            {!submitted ? (
              <div style={styles.placeholderBox}>{t.conversationPlaceholder}</div>
            ) : (
              <div style={styles.chatThread}>
                {conversation.length === 0 ? (
                  <div style={styles.placeholderBox}>{t.startConversationHint}</div>
                ) : (
                  conversation.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        ...styles.chatBubble,
                        backgroundColor:
                          message.role === "user" ? "#5CB2D8" : "#F4F7FC",
                        color: message.role === "user" ? "#ffffff" : "#243F7C",
                        border:
                          message.role === "user"
                            ? "1px solid #5CB2D8"
                            : "1px solid #E2E8F2",
                        alignSelf:
                          message.role === "user" ? "flex-end" : "flex-start",
                        width: "auto",
                        maxWidth: "88%",
                      }}
                    >
                      {message.content}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t.chatPlaceholder}
              rows={4}
              style={styles.textarea}
              disabled={!submitted || chatLoading}
            />

            <button
              type="button"
              style={
                !submitted || chatLoading || !chatInput.trim()
                  ? styles.disabledButton
                  : styles.primaryButtonWide
              }
              onClick={sendChatMessage}
              disabled={!submitted || chatLoading || !chatInput.trim()}
            >
              {chatLoading ? t.sending : t.sendMessage}
            </button>
          </div>

          <div style={styles.actionsCard}>
            <h2 style={styles.boxTitle}>{t.nextActions}</h2>

            <button
              type="button"
              style={styles.actionBlue}
              onClick={() =>
                void notifyAndOpen("apply", () => {
                  window.open(activeOfficer.applyUrl, "_blank", "noopener,noreferrer");
                })
              }
              disabled={actionLoading !== ""}
            >
              {actionLoading === "apply" ? t.sending : t.applyNow}
            </button>

            <button
              type="button"
              style={styles.actionBlue}
              onClick={() =>
                void notifyAndOpen("schedule", () => {
                  window.open(activeOfficer.scheduleUrl, "_blank", "noopener,noreferrer");
                })
              }
              disabled={actionLoading !== ""}
            >
              {actionLoading === "schedule" ? t.sending : t.scheduleLoanOfficer}
            </button>

            <button
              type="button"
              style={styles.actionOutline}
              onClick={() =>
                void notifyAndOpen("contact", () => {
                  window.location.href = mailtoHref;
                })
              }
              disabled={actionLoading !== ""}
            >
              {actionLoading === "email" ? t.sending : t.emailLoanOfficer}
            </button>

            <button
              type="button"
              style={styles.actionOutline}
              onClick={() =>
                void notifyAndOpen("call", () => {
                  window.location.href = `tel:${activeOfficer.mobile}`;
                })
              }
              disabled={actionLoading !== ""}
            >
              {actionLoading === "call" ? t.sending : t.callLoanOfficer}
            </button>

            {actionMessage ? <div style={styles.statusBox}>{actionMessage}</div> : null}
            {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}
            {chatError ? <div style={styles.errorBox}>{chatError}</div> : null}
          </div>
        </div>
      </div>
    </main>
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

  @media (max-width: 1200px) {
    .bf-borrower-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 900px) {
    .bf-form-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .bf-wrap {
      padding: 18px 12px 32px !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, #f8fbff 0%, #f3f6fb 45%, #eef2f7 100%)",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 18px 48px",
  },
  pageTitle: {
    margin: 0,
    color: "#243F7C",
    fontWeight: 900,
    fontSize: 34,
    lineHeight: 1.1,
  },
  pageSubtitle: {
    marginTop: 8,
    marginBottom: 18,
    color: "#526581",
    fontSize: 15,
    fontWeight: 700,
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    alignItems: "start",
    marginBottom: 18,
  },
  formSection: {
    marginBottom: 18,
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.85fr",
    gap: 18,
    alignItems: "start",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.95fr",
    gap: 18,
    alignItems: "start",
  },
  box: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 18,
    border: "1px solid #C8D6EC",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
  },
  boxTitle: {
    margin: 0,
    color: "#243F7C",
    fontWeight: 900,
    fontSize: 22,
    lineHeight: 1.15,
    marginBottom: 14,
  },
  boxText: {
    color: "#61759A",
    fontSize: 14,
    lineHeight: 1.8,
    fontWeight: 700,
    margin: 0,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    color: "#243F7C",
    fontWeight: 900,
  },
  placeholderBox: {
    borderRadius: 18,
    border: "1px solid #D5E0F1",
    backgroundColor: "#F8FAFE",
    color: "#8A99B9",
    padding: 16,
    lineHeight: 1.7,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 14,
  },
  textarea: {
    width: "100%",
    borderRadius: 20,
    border: "1px solid #C8D6EC",
    backgroundColor: "#ffffff",
    padding: "16px 16px",
    outline: "none",
    resize: "vertical",
    fontSize: 14,
    color: "#243F7C",
    fontWeight: 700,
    marginBottom: 14,
  },
  chatThread: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
    maxHeight: 360,
    overflowY: "auto",
    overflowX: "hidden",
    width: "100%",
    boxSizing: "border-box",
  },
  chatBubble: {
    borderRadius: 16,
    padding: 14,
    color: "#243F7C",
    lineHeight: 1.7,
    fontSize: 14,
    fontWeight: 700,
    border: "1px solid #D5E0F1",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 18,
    border: "1px solid #C8D6EC",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
  },
  pathRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 18,
  },
  pathButton: {
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #BFD0EA",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  autocompleteWrap: {
    position: "relative",
  },
  input: {
    width: "100%",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #BFD0EA",
    backgroundColor: "#ffffff",
    padding: "12px 14px",
    outline: "none",
    color: "#243F7C",
    fontSize: 14,
    fontWeight: 700,
  },
  realtorLabel: {
    marginTop: 16,
    marginBottom: 10,
    color: "#60749B",
    fontWeight: 900,
    fontSize: 14,
  },
  realtorButtonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  realtorButton: {
    minHeight: 46,
    padding: "10px 18px",
    borderRadius: 18,
    border: "1px solid #BFD0EA",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  hintText: {
    marginTop: 10,
    color: "#8A99B9",
    fontSize: 13,
    fontWeight: 800,
  },
  lockNotice: {
    padding: "12px 16px",
    borderRadius: 14,
    backgroundColor: "#FFF8E6",
    border: "1px solid #F4DDA1",
    color: "#7C5A0F",
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 14,
  },
  confirmRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  },
  assignedCard: {
    marginTop: 14,
    borderRadius: 22,
    border: "1px solid #C8D6EC",
    backgroundColor: "#F8FAFE",
    padding: 18,
  },
  assignedTitle: {
    color: "#8A99B9",
    fontWeight: 900,
    fontSize: 13,
    marginBottom: 8,
  },
  assignedName: {
    color: "#4E6799",
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 8,
  },
  assignedText: {
    color: "#7083A6",
    fontWeight: 700,
    lineHeight: 1.7,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 46,
    padding: "10px 18px",
    borderRadius: 18,
    backgroundColor: "#5CB2D8",
    border: "1px solid #5CB2D8",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  outlineButton: {
    minHeight: 46,
    padding: "10px 18px",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    border: "1px solid #AFC5E4",
    color: "#60749B",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  primaryButtonWide: {
    marginTop: 16,
    minHeight: 46,
    padding: "10px 18px",
    borderRadius: 18,
    backgroundColor: "#1EA6E0",
    border: "1px solid #1EA6E0",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  propertyCard: {
    marginTop: 18,
    borderTop: "1px solid #DCE6F3",
    paddingTop: 18,
  },
  metricCard: {
    marginTop: 14,
    borderRadius: 22,
    border: "1px solid #C8D6EC",
    backgroundColor: "#F8FAFE",
    padding: 18,
  },
  metricLabel: {
    color: "#8A99B9",
    fontWeight: 900,
    fontSize: 13,
    marginBottom: 8,
  },
  metricValue: {
    color: "#4E6799",
    fontWeight: 900,
    fontSize: 34,
    marginBottom: 8,
  },
  metricSubtext: {
    color: "#5B77AB",
    fontWeight: 800,
    fontSize: 14,
  },
  disabledButton: {
    marginTop: 16,
    width: "100%",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #AFB9D1",
    backgroundColor: "#AEB8D1",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  actionsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 18,
    border: "1px solid #C8D6EC",
    boxShadow: "0 12px 28px rgba(15,23,42,0.04)",
  },
  actionBlue: {
    width: "100%",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #5CB2D8",
    backgroundColor: "#5CB2D8",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 12,
  },
  actionOutline: {
    width: "100%",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #889DC5",
    backgroundColor: "#ffffff",
    color: "#5A71A0",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 12,
  },
  statusBox: {
    marginTop: 8,
    borderRadius: 16,
    border: "1px solid #D5E0F1",
    backgroundColor: "#F8FAFE",
    color: "#5A71A0",
    padding: 14,
    lineHeight: 1.6,
    fontSize: 13,
    fontWeight: 800,
  },
  errorBox: {
    marginTop: 8,
    borderRadius: 16,
    border: "1px solid #F6C8C8",
    backgroundColor: "#FFF6F6",
    color: "#B24D4D",
    padding: 14,
    lineHeight: 1.6,
    fontSize: 13,
    fontWeight: 800,
  },
  suggestionBox: {
    marginTop: 8,
    borderRadius: 18,
    border: "1px solid #C8D6EC",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
    zIndex: 20,
    boxShadow: "0 14px 26px rgba(15,23,42,0.08)",
  },
  suggestionItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    border: "none",
    backgroundColor: "#ffffff",
    color: "#243F7C",
    fontWeight: 800,
    cursor: "pointer",
  },
};
