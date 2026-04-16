"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

type LanguageCode = "en" | "pt" | "es";
type LoanPurpose = "Purchase" | "Refinance" | "Investment";

type IntakeFormState = {
  name: string;
  email: string;
  phone: string;
  credit: string;
  income: string;
  debt: string;
  currentState: string;
  targetState: string;
  realtorStatus: "yes" | "no" | "not-sure";
  realtorName: string;
  realtorPhone: string;
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

type LoanOfficerRecord = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  applyUrl: string;
  scheduleUrl: string;
};

type RoutingPayload = {
  language?: LanguageCode;
  loanOfficerQuery?: string;
  selectedOfficer?: LoanOfficerRecord;
  borrower?: {
    name?: string;
    email?: string;
    phone?: string;
    credit?: string;
    income?: string;
    debt?: string;
    currentState?: string;
    targetState?: string;
    realtorName?: string;
    realtorPhone?: string;
  };
  scenario?: {
    transactionType?: string;
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
    occupancy?: string;
    timeline?: string;
    fundsSource?: string;
    communicationPreference?: string;
  };
  conversation?: ChatMessage[];
};

const APPLY_NOW_URL = "https://www.beyondfinancing.com/apply-now";

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://calendly.com/sandropansini",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    applyUrl: APPLY_NOW_URL,
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const DEFAULT_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

const COPY = {
  en: {
    title: "Borrower / Client Workspace",
    subtitle:
      "Start your guided mortgage conversation with Finley Beyond.",
    disclaimerTitle: "Required Disclaimer",
    disclaimer:
      "This system provides preliminary guidance only. It is not a loan approval, underwriting decision, commitment to lend, legal advice, tax advice, or final program determination. All scenarios remain subject to licensed loan officer review, documentation, verification, underwriting, appraisal, title, and current investor or agency guidelines.",
    accept: "I acknowledge and accept this disclaimer.",
    backHome: "Back to Beyond Intelligence",
    language: "Language",
    purpose: "Loan Purpose",
    borrowerName: "Borrower Name",
    email: "Email",
    phone: "Phone Number",
    credit: "Estimated Credit Score",
    income: "Gross Monthly Income",
    debt: "Monthly Debt",
    currentState: "State You Live In Now",
    targetState: "State You Are Looking to Move Into",
    realtorQuestion: "Are you working with a Realtor?",
    realtorName: "Realtor Name",
    realtorPhone: "Realtor Phone Number",
    loanOfficer: "Loan Officer Name or NMLS #",
    loanOfficerPlaceholder: "Type loan officer name or NMLS #",
    confirmOfficer: "Confirm Loan Officer",
    unknownOfficer: "I Do Not Know My Loan Officer",
    assigned: "Assigned Routing",
    review: "Run Preliminary Review",
    scenarioTitle: "Property Scenario",
    homePrice: "Estimated Home Price",
    downPayment: "Estimated Down Payment",
    occupancy: "Occupancy",
    continueScenario: "Continue with This Scenario",
    conversation: "Conversation with Finley Beyond",
    send: "Send Message",
    applyNow: "Apply Now",
    schedule: "Schedule with Loan Officer",
    emailOfficer: "Email Loan Officer",
    chatPlaceholder:
      "Ask a question or answer Finley Beyond’s next mortgage question.",
  },
  pt: {
    title: "Área do Cliente / Borrower",
    subtitle:
      "Inicie sua conversa guiada sobre mortgage com Finley Beyond.",
    disclaimerTitle: "Aviso Obrigatório",
    disclaimer:
      "Este sistema fornece apenas orientação preliminar. Não representa aprovação de empréstimo, decisão de underwriting, compromisso de concessão de crédito, aconselhamento jurídico, aconselhamento fiscal ou determinação final de programa. Todos os cenários permanecem sujeitos à revisão de um loan officer licenciado, documentação, verificação, underwriting, appraisal, title e diretrizes atuais de investidores ou agências.",
    accept: "Reconheço e aceito este aviso.",
    backHome: "Voltar para Beyond Intelligence",
    language: "Idioma",
    purpose: "Objetivo do Empréstimo",
    borrowerName: "Nome do Cliente",
    email: "Email",
    phone: "Telefone",
    credit: "Pontuação de Crédito Estimada",
    income: "Renda Bruta Mensal",
    debt: "Dívida Mensal",
    currentState: "Estado Onde Mora Atualmente",
    targetState: "Estado Para Onde Deseja se Mudar",
    realtorQuestion: "Você está trabalhando com um Realtor?",
    realtorName: "Nome do Realtor",
    realtorPhone: "Telefone do Realtor",
    loanOfficer: "Nome do Loan Officer ou NMLS #",
    loanOfficerPlaceholder: "Digite o nome do loan officer ou o NMLS #",
    confirmOfficer: "Confirmar Loan Officer",
    unknownOfficer: "Não Sei Meu Loan Officer",
    assigned: "Roteamento Definido",
    review: "Executar Revisão Preliminar",
    scenarioTitle: "Cenário do Imóvel",
    homePrice: "Valor Estimado do Imóvel",
    downPayment: "Entrada Estimada",
    occupancy: "Ocupação",
    continueScenario: "Continuar com Este Cenário",
    conversation: "Conversa com Finley Beyond",
    send: "Enviar Mensagem",
    applyNow: "Aplicar Agora",
    schedule: "Agendar com o Loan Officer",
    emailOfficer: "Enviar Email ao Loan Officer",
    chatPlaceholder:
      "Faça uma pergunta ou responda à próxima pergunta do Finley Beyond.",
  },
  es: {
    title: "Espacio del Cliente / Borrower",
    subtitle:
      "Comience su conversación guiada sobre hipoteca con Finley Beyond.",
    disclaimerTitle: "Aviso Requerido",
    disclaimer:
      "Este sistema proporciona únicamente orientación preliminar. No representa aprobación de préstamo, decisión de underwriting, compromiso de prestar, asesoría legal, asesoría fiscal ni determinación final de programa. Todos los escenarios permanecen sujetos a revisión por un loan officer con licencia, documentación, verificación, underwriting, appraisal, title y guías actuales de inversionistas o agencias.",
    accept: "Reconozco y acepto este aviso.",
    backHome: "Volver a Beyond Intelligence",
    language: "Idioma",
    purpose: "Objetivo del Préstamo",
    borrowerName: "Nombre del Cliente",
    email: "Correo Electrónico",
    phone: "Teléfono",
    credit: "Puntaje de Crédito Estimado",
    income: "Ingreso Bruto Mensual",
    debt: "Deuda Mensual",
    currentState: "Estado Donde Vive Actualmente",
    targetState: "Estado al Que Desea Mudarse",
    realtorQuestion: "¿Está trabajando con un Realtor?",
    realtorName: "Nombre del Realtor",
    realtorPhone: "Teléfono del Realtor",
    loanOfficer: "Nombre del Loan Officer o NMLS #",
    loanOfficerPlaceholder: "Escriba el nombre del loan officer o el NMLS #",
    confirmOfficer: "Confirmar Loan Officer",
    unknownOfficer: "No Conozco Mi Loan Officer",
    assigned: "Asignación Definida",
    review: "Ejecutar Revisión Preliminar",
    scenarioTitle: "Escenario de la Propiedad",
    homePrice: "Precio Estimado de la Vivienda",
    downPayment: "Pago Inicial Estimado",
    occupancy: "Ocupación",
    continueScenario: "Continuar con Este Escenario",
    conversation: "Conversación con Finley Beyond",
    send: "Enviar Mensaje",
    applyNow: "Aplicar Ahora",
    schedule: "Agendar con el Loan Officer",
    emailOfficer: "Enviar Correo al Loan Officer",
    chatPlaceholder:
      "Haga una pregunta o responda la siguiente pregunta de Finley Beyond.",
  },
};

function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
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
  };
}

function buttonPrimaryStyle(): React.CSSProperties {
  return {
    background: "#263366",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
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

export default function BorrowerPage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = COPY[language];

  const [accepted, setAccepted] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState<LoanPurpose>("Purchase");
  const [loanOfficerQuery, setLoanOfficerQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] =
    useState<LoanOfficerRecord>(DEFAULT_OFFICER);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const [intake, setIntake] = useState<IntakeFormState>({
    name: "",
    email: "",
    phone: "",
    credit: "",
    income: "",
    debt: "",
    currentState: "",
    targetState: "",
    realtorStatus: "not-sure",
    realtorName: "",
    realtorPhone: "",
  });

  const [scenario, setScenario] = useState<ScenarioFormState>({
    homePrice: "",
    downPayment: "",
    occupancy: "",
  });

  const [chat
