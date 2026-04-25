// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/borrower/page.tsx
//
// =============================================================================
//
// PHASE 5-prep-B — State dropdowns and state-filtered autocomplete.
//
// Deploy ALL THREE Phase 5-prep-B files together in one commit:
//   1. app/api/public/team-users/route.ts
//   2. lib/us-states.ts
//   3. app/borrower/page.tsx
//
// =============================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
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

// Shape of items returned by /api/public/team-users (Phase 5-prep-B)
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
  }
> = {
  en: {
    title: "Finley Beyond Powered by Beyond Intelligence™",
    subtitle: "Start your guided mortgage conversation with Finley Beyond.",
    disclaimerTitle: "Required Disclaimer",
    disclaimerText:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, title, appraisal, and current investor or agency guidelines.",
    disclaimerAccept: "I acknowledge and accept this disclaimer.",
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

  // Phase 5-prep-B: split arrays from filtered API
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
  // No state selected → fetch nothing (empty arrays + helpful hints).
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

    // If state selected and Finley is among returned bots, do nothing extra.
    // If no state selected (empty array) OR no Finley returned, inject default
    // Finley as a fallback so the "I Don't Know My LO" button always works.
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

  // Special handler: when target state changes, clear LO/realtor selections
  // because the previously-selected entities may not be licensed in new state.
  const setTargetState = (newCode: string) => {
    setIntakeForm((prev) => ({
      ...prev,
      targetState: newCode,
      // Clear realtor inputs when state changes since we'll re-filter realtors
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
    // If we got an empty list AND no fallback Finley, show "no LOs in state".
    // Otherwise show the standard hint.
    if (loanOfficersFromApi.length === 0 && !directoryLoading) {
      return t.loanOfficerNoneInState;
    }
    return t.loanOfficerSearchHint;
  })();

  const resolveOfficerFromQuery = (query: string): LoanOfficerRecord | null => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return null;

    const exact = dynamicLoanOfficers.find(
      (officer) =>
        officer.name.toLowerCase() === trimmed ||
        officer.nmls.toLowerCase() === trimmed
    );

    if (exact) return exact;

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
      assignedEmail: activeOfficer.email,
      assistantEmail: activeOfficer.assistantEmail,
      realtorName: realtorStatus === "yes" ? intakeForm.realtorN
