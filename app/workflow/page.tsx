// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/workflow/page.tsx
//
// =============================================================================
//
// CHANGE FROM PRIOR VERSION
//
// The unauthenticated branch used to render a placeholder card telling the
// user to "please sign in through your protected team access first." That
// placeholder is replaced with the shared <TeamLoginCard /> component so
// mortgage professionals can log in directly on /workflow — no detour
// through /team needed.
//
// On a successful login, the page calls loadUser() to re-check /api/team-auth/me
// and switches to the authenticated dashboard view without a hard refresh.
//
// Everything else — pipeline, file list, urgent oversight, file creation
// form, agent fields, hero, all i18n — is byte-identical to the prior
// working version.
//
// =============================================================================

"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import TeamLoginCard from "@/app/components/TeamLoginCard";
import { SiteLanguage } from "@/app/components/site-header-translations";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Branch Manager"
  | "Real Estate Agent";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  role: TeamRole;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
};

type WorkflowStatus =
  | "new_scenario"
  | "pre_approval_review"
  | "sent_to_processing"
  | "processing_active"
  | "submitted_to_lender"
  | "conditional_approval"
  | "clear_to_close"
  | "closed";

type WorkflowUrgency = "Standard" | "Priority" | "Rush";

type ProcessorOption = {
  id: string;
  name: string;
  email: string;
};

type WorkflowFile = {
  id: string;
  loanNumber: string;
  borrowerName: string;
  purpose: string;
  amount: number;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  loanOfficer: string;
  processor: string;
  productionManager: string;
  requestedProcessorNote: string;
  targetClose: string;
  fileAgeDays: number;
  occupancy: string;
  blocker: string;
  nextInternalAction: string;
  nextBorrowerAction: string;
  latestUpdate: string;
  propertyAddress: string;
  listingAgentName: string;
  buyerAgentName: string;
};

type WorkflowApiFile = {
  id: string;
  file_number?: string | null;
  borrower_name: string;
  purpose: string;
  amount: number | string | null;
  status: WorkflowStatus;
  urgency: WorkflowUrgency;
  loan_officer: string;
  processor: string | null;
  production_manager?: string | null;
  requested_processor_note?: string | null;
  target_close: string | null;
  file_age_days: number | null;
  occupancy: string;
  blocker: string;
  next_internal_action: string;
  next_borrower_action: string;
  latest_update: string;
  property_address?: string | null;
  listing_agent_name?: string | null;
  buyer_agent_name?: string | null;
};

const COPY: Record<
  SiteLanguage,
  {
    title: string;
    subtitle: string;
    loginVariantLabel: string;
    loadingText: string;
    signedInAs: string;
    roleLabel: string;
    commandPurpose: string;
    purposeItems: string[];
    processingActive: string;
    processingActiveSub: string;
    nearingClose: string;
    nearingCloseSub: string;
    rushFiles: string;
    rushFilesSub: string;
    averageAge: string;
    averageAgeSub: string;
    pipeline: string;
    livePipeline: string;
    searchFiles: string;
    searchPlaceholder: string;
    activeFiles: string;
    processingQueue: string;
    loadingFiles: string;
    noFilesMatch: string;
    urgentOversight: string;
    urgentAttention: string;
    noUrgentItems: string;
    createFileEyebrow: string;
    createFileTitle: string;
    loanNumber: string;
    borrowerName: string;
    propertyAddress: string;
    loanPurpose: string;
    amount: string;
    loanOfficer: string;
    requestedProcessorNote: string;
    assignProcessor: string;
    targetCloseDate: string;
    urgency: string;
    occupancy: string;
    blocker: string;
    listingAgent: string;
    listingAgentName: string;
    listingAgentEmail: string;
    listingAgentPhone: string;
    buyerAgent: string;
    buyerAgentName: string;
    buyerAgentEmail: string;
    buyerAgentPhone: string;
    addToWorkflow: string;
    creatingFile: string;
    phaseTitle: string;
    phaseSubtitle: string;
    phaseOneTitle: string;
    phaseOneText: string;
    phaseTwoTitle: string;
    phaseTwoText: string;
    phaseThreeTitle: string;
    phaseThreeText: string;
    footerBrand: string;
    signOut: string;
    unassigned: string;
    noneCurrently: string;
    addressEntryInfo: string;
    processorInfo: string;
    createSuccess: string;
    createError: string;
    requiredError: string;
    goHome: string;
    openBorrower: string;
  }
> = {
  en: {
    title: "Mortgage workflow intelligence from pre-approval handoff through closing.",
    subtitle:
      "Built for loan officers, processors, assistants, and leadership teams who need one disciplined operating layer to manage file handoff, milestone visibility, accountability, and internal communication from processing entry to clear-to-close.",
    loginVariantLabel: "Workflow Intelligence",
    loadingText: "Loading protected workflow command center...",
    signedInAs: "Logged in as",
    roleLabel: "Role",
    commandPurpose: "COMMAND PURPOSE",
    purposeItems: [
      "Open each file as a true operational record.",
      "Keep production assignment under Production Manager control.",
      "Keep agents informed that the file is progressing.",
      "Keep updates, visibility, and accountability in one place.",
    ],
    processingActive: "Processing Active",
    processingActiveSub: "Files currently in execution",
    nearingClose: "Nearing Close",
    nearingCloseSub: "Conditional approval or better",
    rushFiles: "Rush Files",
    rushFilesSub: "Priority oversight required",
    averageAge: "Average Age",
    averageAgeSub: "Average file age in command center",
    pipeline: "PIPELINE",
    livePipeline: "Live command pipeline",
    searchFiles: "Search files",
    searchPlaceholder:
      "Search loan #, borrower, address, agents, processor, status, or update",
    activeFiles: "ACTIVE FILES",
    processingQueue: "Processing and handoff queue",
    loadingFiles: "Loading workflow files...",
    noFilesMatch: "No files match the current search.",
    urgentOversight: "URGENT OVERSIGHT",
    urgentAttention: "Files needing attention",
    noUrgentItems: "No urgent items are currently flagged.",
    createFileEyebrow: "ADD LOAN APP",
    createFileTitle: "Create workflow file",
    loanNumber: "Loan number",
    borrowerName: "Borrower full name",
    propertyAddress: "Property address",
    loanPurpose: "Loan purpose",
    amount: "Amount",
    loanOfficer: "Loan officer",
    requestedProcessorNote: "Requested processor note to Production Manager",
    assignProcessor: "Assign processor",
    targetCloseDate: "Target close date",
    urgency: "Urgency",
    occupancy: "Occupancy",
    blocker: "Current blocker",
    listingAgent: "Listing Agent",
    listingAgentName: "Listing agent name",
    listingAgentEmail: "Listing agent email",
    listingAgentPhone: "Listing agent phone",
    buyerAgent: "Buyer Agent",
    buyerAgentName: "Buyer agent name",
    buyerAgentEmail: "Buyer agent email",
    buyerAgentPhone: "Buyer agent phone",
    addToWorkflow: "Add to Workflow",
    creatingFile: "Creating File...",
    phaseTitle: "FILE RECORDS",
    phaseSubtitle: "How Phase 4 works",
    phaseOneTitle: "Address and agent anchored",
    phaseOneText:
      "Each workflow file stores the property address, listing agent, and buyer agent so the system always knows who to notify.",
    phaseTwoTitle: "Milestone visibility",
    phaseTwoText:
      "Agents can receive automated notifications when the file is registered and when status moves through key milestones.",
    phaseThreeTitle: "Final close logic",
    phaseThreeText:
      "When a file reaches closed / funded, the system sends a final notification and then deactivates further automated agent alerts.",
    footerBrand: "Powered and Designed by Beyond Intelligence™ © 2026",
    signOut: "Sign Out",
    unassigned: "Unassigned",
    noneCurrently: "None currently.",
    addressEntryInfo:
      "Address entry is active with manual input. This version keeps deployment stable and operational.",
    processorInfo:
      "Processor assignment is controlled by the Production Manager. Loan Officers may leave a requested processor note above.",
    createSuccess:
      "Workflow file created successfully and notifications were triggered where agent contact data was provided.",
    createError: "Unable to create workflow file.",
    requiredError:
      "Loan number, borrower name, property address, and loan officer are required.",
    goHome: "Back to Homepage",
    openBorrower: "Open Borrower Experience",
  },
  pt: {
    title: "Inteligência de workflow hipotecário do handoff pré-aprovação até o fechamento.",
    subtitle:
      "Desenvolvido para loan officers, processors, assistentes e liderança que precisam de uma camada operacional disciplinada para handoff do arquivo, visibilidade de marcos, accountability e comunicação interna do início do processing até clear-to-close.",
    loginVariantLabel: "Workflow Intelligence",
    loadingText: "Carregando centro de comando protegido...",
    signedInAs: "Conectado como",
    roleLabel: "Função",
    commandPurpose: "PROPÓSITO DO COMANDO",
    purposeItems: [
      "Abrir cada arquivo como um verdadeiro registro operacional.",
      "Manter a atribuição de produção sob controle do Production Manager.",
      "Manter os agentes informados de que o arquivo está avançando.",
      "Manter atualizações, visibilidade e accountability em um só lugar.",
    ],
    processingActive: "Processing Active",
    processingActiveSub: "Arquivos atualmente em execução",
    nearingClose: "Próximos do Fechamento",
    nearingCloseSub: "Conditional approval ou melhor",
    rushFiles: "Arquivos Rush",
    rushFilesSub: "Supervisão prioritária necessária",
    averageAge: "Idade Média",
    averageAgeSub: "Idade média dos arquivos no comando",
    pipeline: "PIPELINE",
    livePipeline: "Pipeline de comando ao vivo",
    searchFiles: "Buscar arquivos",
    searchPlaceholder:
      "Buscar loan #, cliente, endereço, agentes, processor, status ou update",
    activeFiles: "ARQUIVOS ATIVOS",
    processingQueue: "Fila de processing e handoff",
    loadingFiles: "Carregando arquivos do workflow...",
    noFilesMatch: "Nenhum arquivo corresponde à busca atual.",
    urgentOversight: "SUPERVISÃO URGENTE",
    urgentAttention: "Arquivos que precisam de atenção",
    noUrgentItems: "Nenhum item urgente está sinalizado no momento.",
    createFileEyebrow: "ADICIONAR APP DE LOAN",
    createFileTitle: "Criar arquivo de workflow",
    loanNumber: "Número do loan",
    borrowerName: "Nome completo do cliente",
    propertyAddress: "Endereço do imóvel",
    loanPurpose: "Finalidade do loan",
    amount: "Valor",
    loanOfficer: "Loan officer",
    requestedProcessorNote: "Nota de processor solicitada ao Production Manager",
    assignProcessor: "Atribuir processor",
    targetCloseDate: "Data-alvo de fechamento",
    urgency: "Urgência",
    occupancy: "Ocupação",
    blocker: "Bloqueio atual",
    listingAgent: "Listing Agent",
    listingAgentName: "Nome do listing agent",
    listingAgentEmail: "Email do listing agent",
    listingAgentPhone: "Telefone do listing agent",
    buyerAgent: "Buyer Agent",
    buyerAgentName: "Nome do buyer agent",
    buyerAgentEmail: "Email do buyer agent",
    buyerAgentPhone: "Telefone do buyer agent",
    addToWorkflow: "Adicionar ao Workflow",
    creatingFile: "Criando Arquivo...",
    phaseTitle: "REGISTROS DO ARQUIVO",
    phaseSubtitle: "Como a Fase 4 funciona",
    phaseOneTitle: "Endereço e agentes ancorados",
    phaseOneText:
      "Cada arquivo de workflow armazena o endereço do imóvel, listing agent e buyer agent para que o sistema sempre saiba quem notificar.",
    phaseTwoTitle: "Visibilidade de marcos",
    phaseTwoText:
      "Os agentes podem receber notificações automáticas quando o arquivo é registrado e quando o status se move por marcos principais.",
    phaseThreeTitle: "Lógica final de fechamento",
    phaseThreeText:
      "Quando um arquivo chega a closed / funded, o sistema envia uma notificação final e então desativa alertas automáticos adicionais aos agentes.",
    footerBrand: "Powered and Designed by Beyond Intelligence™ © 2026",
    signOut: "Sair",
    unassigned: "Não Atribuído",
    noneCurrently: "Nenhum no momento.",
    addressEntryInfo:
      "O endereço está ativo com entrada manual. Esta versão mantém o deploy estável e operacional.",
    processorInfo:
      "A atribuição do processor é controlada pelo Production Manager. Loan Officers podem deixar uma nota de processor solicitada acima.",
    createSuccess:
      "Arquivo de workflow criado com sucesso e as notificações foram disparadas onde havia dados de contato dos agentes.",
    createError: "Não foi possível criar o arquivo de workflow.",
    requiredError:
      "Número do loan, nome do cliente, endereço do imóvel e loan officer são obrigatórios.",
    goHome: "Voltar à Página Inicial",
    openBorrower: "Abrir Experiência do Cliente",
  },
  es: {
    title: "Inteligencia de workflow hipotecario desde el handoff de preaprobación hasta el cierre.",
    subtitle:
      "Construido para loan officers, processors, asistentes y liderazgo que necesitan una capa operativa disciplinada para handoff del archivo, visibilidad de hitos, accountability y comunicación interna desde processing hasta clear-to-close.",
    loginVariantLabel: "Workflow Intelligence",
    loadingText: "Cargando centro de comando protegido...",
    signedInAs: "Conectado como",
    roleLabel: "Rol",
    commandPurpose: "PROPÓSITO DEL COMANDO",
    purposeItems: [
      "Abrir cada archivo como un verdadero registro operativo.",
      "Mantener la asignación de producción bajo control del Production Manager.",
      "Mantener a los agentes informados de que el archivo avanza.",
      "Mantener actualizaciones, visibilidad y accountability en un solo lugar.",
    ],
    processingActive: "Processing Active",
    processingActiveSub: "Archivos actualmente en ejecución",
    nearingClose: "Cerca del Cierre",
    nearingCloseSub: "Conditional approval o mejor",
    rushFiles: "Archivos Rush",
    rushFilesSub: "Se requiere supervisión prioritaria",
    averageAge: "Edad Promedio",
    averageAgeSub: "Edad promedio del archivo en el comando",
    pipeline: "PIPELINE",
    livePipeline: "Pipeline de comando en vivo",
    searchFiles: "Buscar archivos",
    searchPlaceholder:
      "Buscar loan #, cliente, dirección, agentes, processor, estado o update",
    activeFiles: "ARCHIVOS ACTIVOS",
    processingQueue: "Cola de processing y handoff",
    loadingFiles: "Cargando archivos de workflow...",
    noFilesMatch: "Ningún archivo coincide con la búsqueda actual.",
    urgentOversight: "SUPERVISIÓN URGENTE",
    urgentAttention: "Archivos que necesitan atención",
    noUrgentItems: "No hay elementos urgentes señalados en este momento.",
    createFileEyebrow: "AGREGAR APP DE LOAN",
    createFileTitle: "Crear archivo de workflow",
    loanNumber: "Número del loan",
    borrowerName: "Nombre completo del cliente",
    propertyAddress: "Dirección de la propiedad",
    loanPurpose: "Propósito del loan",
    amount: "Monto",
    loanOfficer: "Loan officer",
    requestedProcessorNote: "Nota de processor solicitada al Production Manager",
    assignProcessor: "Asignar processor",
    targetCloseDate: "Fecha objetivo de cierre",
    urgency: "Urgencia",
    occupancy: "Ocupación",
    blocker: "Bloqueo actual",
    listingAgent: "Listing Agent",
    listingAgentName: "Nombre del listing agent",
    listingAgentEmail: "Correo del listing agent",
    listingAgentPhone: "Teléfono del listing agent",
    buyerAgent: "Buyer Agent",
    buyerAgentName: "Nombre del buyer agent",
    buyerAgentEmail: "Correo del buyer agent",
    buyerAgentPhone: "Teléfono del buyer agent",
    addToWorkflow: "Agregar al Workflow",
    creatingFile: "Creando Archivo...",
    phaseTitle: "REGISTROS DEL ARCHIVO",
    phaseSubtitle: "Cómo funciona la Fase 4",
    phaseOneTitle: "Dirección y agentes anclados",
    phaseOneText:
      "Cada archivo de workflow almacena la dirección de la propiedad, listing agent y buyer agent para que el sistema siempre sepa a quién notificar.",
    phaseTwoTitle: "Visibilidad de hitos",
    phaseTwoText:
      "Los agentes pueden recibir notificaciones automáticas cuando el archivo se registra y cuando el estado avanza por hitos clave.",
    phaseThreeTitle: "Lógica final de cierre",
    phaseThreeText:
      "Cuando un archivo llega a closed / funded, el sistema envía una notificación final y luego desactiva alertas automáticas adicionales a los agentes.",
    footerBrand: "Powered and Designed by Beyond Intelligence™ © 2026",
    signOut: "Cerrar sesión",
    unassigned: "No Asignado",
    noneCurrently: "Ninguno por ahora.",
    addressEntryInfo:
      "La dirección está activa con ingreso manual. Esta versión mantiene el despliegue estable y operativo.",
    processorInfo:
      "La asignación del processor está controlada por el Production Manager. Los Loan Officers pueden dejar arriba una nota solicitando processor.",
    createSuccess:
      "Archivo de workflow creado con éxito y se activaron notificaciones donde se proporcionaron datos de contacto de agentes.",
    createError: "No fue posible crear el archivo de workflow.",
    requiredError:
      "Número del loan, nombre del cliente, dirección de la propiedad y loan officer son obligatorios.",
    goHome: "Volver al Inicio",
    openBorrower: "Abrir Experiencia del Cliente",
  },
};

const PROCESSORS: ProcessorOption[] = [
  {
    id: "amarilis-santos",
    name: "Amarilis Santos",
    email: "amarilis@beyondfinancing.com",
  },
  {
    id: "kyle-nicholson",
    name: "Kyle Nicholson",
    email: "kyle@beyondfinancing.com",
  },
  {
    id: "bia-marques",
    name: "Bia Marques",
    email: "bia@beyondfinancing.com",
  },
];

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

function normalizeCurrencyInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function getStatusLabel(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return "New Scenario";
    case "pre_approval_review":
      return "Pre-Approval Review";
    case "sent_to_processing":
      return "Sent to Processing";
    case "processing_active":
      return "Processing Active";
    case "submitted_to_lender":
      return "Submitted to Lender";
    case "conditional_approval":
      return "Conditional Approval";
    case "clear_to_close":
      return "Clear to Close";
    case "closed":
      return "Closed / Funded";
    default:
      return status;
  }
}

function getStatusTone(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return { bg: "#EEF2FF", border: "#C7D2FE", text: "#3755A5" };
    case "pre_approval_review":
      return { bg: "#F3F0FF", border: "#D8CCFF", text: "#5B3DB4" };
    case "sent_to_processing":
      return { bg: "#ECFEFF", border: "#A5F3FC", text: "#0E7490" };
    case "processing_active":
      return { bg: "#ECFDF3", border: "#BBF7D0", text: "#15803D" };
    case "submitted_to_lender":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    case "conditional_approval":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    case "clear_to_close":
      return { bg: "#ECFDF3", border: "#86EFAC", text: "#047857" };
    case "closed":
      return { bg: "#F3F4F6", border: "#D1D5DB", text: "#374151" };
    default:
      return { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" };
  }
}

function getUrgencyTone(urgency: WorkflowUrgency) {
  switch (urgency) {
    case "Rush":
      return { bg: "#FDF2F8", border: "#F9A8D4", text: "#BE185D" };
    case "Priority":
      return { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" };
    default:
      return { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" };
  }
}

function getUrgencyRank(urgency: WorkflowUrgency) {
  switch (urgency) {
    case "Rush":
      return 3;
    case "Priority":
      return 2;
    default:
      return 1;
  }
}

function getStatusRank(status: WorkflowStatus) {
  switch (status) {
    case "conditional_approval":
      return 8;
    case "submitted_to_lender":
      return 7;
    case "processing_active":
      return 6;
    case "sent_to_processing":
      return 5;
    case "pre_approval_review":
      return 4;
    case "new_scenario":
      return 3;
    case "clear_to_close":
      return 2;
    case "closed":
      return 1;
    default:
      return 0;
  }
}

function compareWorkflowFiles(a: WorkflowFile, b: WorkflowFile) {
  const urgencyDiff = getUrgencyRank(b.urgency) - getUrgencyRank(a.urgency);
  if (urgencyDiff !== 0) return urgencyDiff;

  const statusDiff = getStatusRank(b.status) - getStatusRank(a.status);
  if (statusDiff !== 0) return statusDiff;

  const ageDiff = b.fileAgeDays - a.fileAgeDays;
  if (ageDiff !== 0) return ageDiff;

  return a.borrowerName.localeCompare(b.borrowerName);
}

export default function WorkflowPage() {
  const [language, setLanguage] = useState<SiteLanguage>("en");
  const [activeUser, setActiveUser] = useState<TeamUser | null>(null);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [createLoanNumber, setCreateLoanNumber] = useState("");
  const [createBorrowerName, setCreateBorrowerName] = useState("");
  const [createPurpose, setCreatePurpose] = useState("Purchase");
  const [createAmount, setCreateAmount] = useState("");
  const [createLoanOfficer, setCreateLoanOfficer] = useState("");
  const [createProcessor, setCreateProcessor] = useState("Unassigned");
  const [createTargetClose, setCreateTargetClose] = useState("");
  const [createUrgency, setCreateUrgency] =
    useState<WorkflowUrgency>("Priority");
  const [createOccupancy, setCreateOccupancy] = useState("Primary Residence");
  const [createBlocker, setCreateBlocker] = useState("None currently.");
  const [createRequestedProcessorNote, setCreateRequestedProcessorNote] =
    useState("");

  const [createPropertyAddress, setCreatePropertyAddress] = useState("");
  const [createListingAgentName, setCreateListingAgentName] = useState("");
  const [createListingAgentEmail, setCreateListingAgentEmail] = useState("");
  const [createListingAgentPhone, setCreateListingAgentPhone] = useState("");
  const [createBuyerAgentName, setCreateBuyerAgentName] = useState("");
  const [createBuyerAgentEmail, setCreateBuyerAgentEmail] = useState("");
  const [createBuyerAgentPhone, setCreateBuyerAgentPhone] = useState("");

  const [createStatusMessage, setCreateStatusMessage] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);

  const t = COPY[language];

  const canManageProcessing =
    activeUser?.role === "Production Manager" ||
    activeUser?.name === "Amarilis Santos";

  const handleSignOut = async () => {
    await fetch("/api/team-auth/logout", { method: "POST" });
    setActiveUser(null);
    window.location.href = "/team";
  };

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch("/api/team-auth/me");

      if (response.ok) {
        const data = await response.json();

        if (data?.authenticated && data?.user) {
          setActiveUser(data.user);
          setCreateLoanOfficer(data.user.name || "");
        }
      }
    } catch {
      // no-op
    } finally {
      setAuthCheckLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      setFilesLoading(true);

      const res = await fetch("/api/workflow", { cache: "no-store" });
      const data = await res.json();

      const mappedFiles: WorkflowFile[] = Array.isArray(data?.files)
        ? (data.files as WorkflowApiFile[]).map((f) => ({
            id: String(f.id ?? ""),
            loanNumber: String(f.file_number ?? ""),
            borrowerName: String(f.borrower_name ?? ""),
            purpose: String(f.purpose ?? ""),
            amount: Number(f.amount ?? 0),
            status: f.status,
            urgency: f.urgency,
            loanOfficer: String(f.loan_officer ?? ""),
            processor: String(f.processor ?? "Unassigned"),
            productionManager: String(
              f.production_manager ?? "Pending Assignment"
            ),
            requestedProcessorNote: String(f.requested_processor_note ?? ""),
            targetClose: String(f.target_close ?? ""),
            fileAgeDays: Number(f.file_age_days ?? 0),
            occupancy: String(f.occupancy ?? ""),
            blocker: String(f.blocker ?? ""),
            nextInternalAction: String(f.next_internal_action ?? ""),
            nextBorrowerAction: String(f.next_borrower_action ?? ""),
            latestUpdate: String(f.latest_update ?? ""),
            propertyAddress: String(f.property_address ?? ""),
            listingAgentName: String(f.listing_agent_name ?? ""),
            buyerAgentName: String(f.buyer_agent_name ?? ""),
          }))
        : [];

      setFiles(mappedFiles);
    } catch (err) {
      console.error("Failed to load workflow files", err);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const sortedFiles = useMemo(() => {
    return [...files].sort(compareWorkflowFiles);
  }, [files]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedFiles;

    return sortedFiles.filter((file) => {
      const haystack = [
        file.loanNumber,
        file.borrowerName,
        file.loanOfficer,
        file.processor,
        file.productionManager,
        file.purpose,
        file.propertyAddress,
        file.listingAgentName,
        file.buyerAgentName,
        getStatusLabel(file.status),
        file.latestUpdate,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [sortedFiles, searchQuery]);

  const pipelineCounts = useMemo(() => {
    return {
      newScenario: files.filter((f) => f.status === "new_scenario").length,
      preApprovalReview: files.filter(
        (f) => f.status === "pre_approval_review"
      ).length,
      sentToProcessing: files.filter((f) => f.status === "sent_to_processing")
        .length,
      processingActive: files.filter((f) => f.status === "processing_active")
        .length,
      submittedToLender: files.filter((f) => f.status === "submitted_to_lender")
        .length,
      conditionalApproval: files.filter(
        (f) => f.status === "conditional_approval"
      ).length,
      clearToClose: files.filter((f) => f.status === "clear_to_close").length,
      closed: files.filter((f) => f.status === "closed").length,
    };
  }, [files]);

  const processingActiveCount = files.filter(
    (f) =>
      f.status === "sent_to_processing" ||
      f.status === "processing_active" ||
      f.status === "submitted_to_lender" ||
      f.status === "conditional_approval"
  ).length;

  const nearingCloseCount = files.filter(
    (f) => f.status === "conditional_approval" || f.status === "clear_to_close"
  ).length;

  const rushFilesCount = files.filter((f) => f.urgency === "Rush").length;

  const averageAge = files.length
    ? Math.round(
        files.reduce((sum, file) => sum + file.fileAgeDays, 0) / files.length
      )
    : 0;

  const urgentItems = useMemo(() => {
    return [...files]
      .filter(
        (file) =>
          file.urgency !== "Standard" ||
          file.blocker.toLowerCase() !== "none currently."
      )
      .sort(compareWorkflowFiles);
  }, [files]);

  const createWorkflowFile = async () => {
    const borrowerName = createBorrowerName.trim();
    const loanOfficer = createLoanOfficer.trim() || activeUser?.name || "";
    const loanNumber = createLoanNumber.trim();
    const propertyAddress = createPropertyAddress.trim();

    if (!borrowerName || !loanOfficer || !loanNumber || !propertyAddress) {
      setCreateStatusMessage(t.requiredError);
      return;
    }

    try {
      setIsCreatingFile(true);
      setCreateStatusMessage("");

      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_file",
          loanNumber,
          borrowerName,
          purpose: createPurpose,
          amount: Number(createAmount || 0),
          loanOfficer,
          processor: createProcessor,
          targetClose: createTargetClose,
          urgency: createUrgency,
          occupancy: createOccupancy,
          blocker: createBlocker,
          requestedProcessorNote: createRequestedProcessorNote,
          propertyAddress,
          listingAgentName: createListingAgentName,
          listingAgentEmail: createListingAgentEmail,
          listingAgentPhone: createListingAgentPhone,
          buyerAgentName: createBuyerAgentName,
          buyerAgentEmail: createBuyerAgentEmail,
          buyerAgentPhone: createBuyerAgentPhone,
          author: activeUser?.name || "Team User",
          role: activeUser?.role || "Professional",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setCreateStatusMessage(data?.error || t.createError);
        return;
      }

      setCreateLoanNumber("");
      setCreateBorrowerName("");
      setCreatePurpose("Purchase");
      setCreateAmount("");
      setCreateProcessor("Unassigned");
      setCreateTargetClose("");
      setCreateUrgency("Priority");
      setCreateOccupancy("Primary Residence");
      setCreateBlocker("None currently.");
      setCreateRequestedProcessorNote("");
      setCreatePropertyAddress("");
      setCreateListingAgentName("");
      setCreateListingAgentEmail("");
      setCreateListingAgentPhone("");
      setCreateBuyerAgentName("");
      setCreateBuyerAgentEmail("");
      setCreateBuyerAgentPhone("");
      setCreateStatusMessage(t.createSuccess);

      await loadFiles();
    } catch (err) {
      console.error(err);
      setCreateStatusMessage(t.createError);
    } finally {
      setIsCreatingFile(false);
    }
  };

  if (authCheckLoading) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="bf-wrap" style={styles.wrap}>
          <SiteHeader
            variant="workflow"
            language={language}
            onLanguageChange={setLanguage}
          />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>TEAM WORKFLOW INTELLIGENCE</div>
            <h1 style={styles.heroTitle}>{t.title}</h1>
            <p style={styles.heroText}>{t.loadingText}</p>
          </section>
        </div>
      </main>
    );
  }

  if (!activeUser) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="bf-wrap" style={styles.wrap}>
          <SiteHeader
            variant="workflow"
            language={language}
            onLanguageChange={setLanguage}
          />

          <section style={styles.hero}>
            <div style={styles.heroBadge}>TEAM WORKFLOW INTELLIGENCE</div>
            <h1 style={styles.heroTitle}>{t.title}</h1>
            <p style={styles.heroText}>{t.subtitle}</p>
          </section>

          <TeamLoginCard
            language={language}
            variantLabel={t.loginVariantLabel}
            quickActionsTarget="workflow"
            onLoginSuccess={async () => {
              setAuthCheckLoading(true);
              await loadUser();
              await loadFiles();
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <SiteHeader
          variant="workflow"
          language={language}
          onLanguageChange={setLanguage}
        />

        <section style={styles.hero}>
          <div className="bf-workflow-hero-top" style={styles.workflowHeroTopBar}>
            <div style={styles.workflowHeroLeft}>
              <div style={styles.heroBadge}>TEAM COMMAND CENTER</div>
              <h1 style={styles.heroTitle}>{t.title}</h1>
              <p style={styles.heroText}>{t.subtitle}</p>
            </div>

            <div style={styles.workflowHeroRight}>
              <div style={styles.userBadge}>
                <div style={styles.userBadgeTitle}>
                  {t.signedInAs}: {activeUser.name}
                </div>
                <div style={styles.userBadgeSubtext}>
                  {t.roleLabel}: {activeUser.role} · {activeUser.email}
                </div>
              </div>

              <div style={styles.heroPurposeCard}>
                <div style={styles.heroPurposeTitle}>{t.commandPurpose}</div>
                <div style={styles.heroPurposeList}>
                  {t.purposeItems.map((item) => (
                    <div key={item}>• {item}</div>
                  ))}
                </div>

                <div style={styles.heroActionRow}>
                  <a href="/" style={styles.heroActionOutline}>
                    {t.goHome}
                  </a>
                  <a href="/borrower" style={styles.heroActionGhost}>
                    {t.openBorrower}
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                style={styles.signOutButton}
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </section>

        <div className="bf-stat-grid" style={styles.statGrid}>
          <StatCard
            title={t.processingActive}
            value={String(processingActiveCount)}
            subtext={t.processingActiveSub}
          />
          <StatCard
            title={t.nearingClose}
            value={String(nearingCloseCount)}
            subtext={t.nearingCloseSub}
          />
          <StatCard
            title={t.rushFiles}
            value={String(rushFilesCount)}
            subtext={t.rushFilesSub}
          />
          <StatCard
            title={t.averageAge}
            value={`${averageAge}d`}
            subtext={t.averageAgeSub}
          />
        </div>

        <section style={styles.card}>
          <div style={styles.pipelineHeader}>
            <div>
              <div style={styles.sectionEyebrow}>{t.pipeline}</div>
              <h2 style={styles.sectionTitle}>{t.livePipeline}</h2>
            </div>

            <div style={styles.searchWrap}>
              <label style={styles.searchLabel}>{t.searchFiles}</label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                style={styles.searchInput}
              />
            </div>
          </div>

          <div className="bf-pipeline-grid" style={styles.pipelineGrid}>
            <PipelineCard
              label="New Scenario"
              value={pipelineCounts.newScenario}
              status="new_scenario"
            />
            <PipelineCard
              label="Pre-Approval Review"
              value={pipelineCounts.preApprovalReview}
              status="pre_approval_review"
            />
            <PipelineCard
              label="Sent to Processing"
              value={pipelineCounts.sentToProcessing}
              status="sent_to_processing"
            />
            <PipelineCard
              label="Processing Active"
              value={pipelineCounts.processingActive}
              status="processing_active"
            />
            <PipelineCard
              label="Submitted to Lender"
              value={pipelineCounts.submittedToLender}
              status="submitted_to_lender"
            />
            <PipelineCard
              label="Conditional Approval"
              value={pipelineCounts.conditionalApproval}
              status="conditional_approval"
            />
            <PipelineCard
              label="Clear to Close"
              value={pipelineCounts.clearToClose}
              status="clear_to_close"
            />
            <PipelineCard label="Closed" value={pipelineCounts.closed} status="closed" />
          </div>
        </section>

        <div className="bf-main-grid" style={styles.mainGrid}>
          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>{t.activeFiles}</div>
              <h2 style={styles.sectionTitle}>{t.processingQueue}</h2>

              {filesLoading ? (
                <div style={styles.placeholderBox}>{t.loadingFiles}</div>
              ) : (
                <div style={styles.slimList}>
                  {filteredFiles.map((file) => {
                    const statusTone = getStatusTone(file.status);
                    const urgencyTone = getUrgencyTone(file.urgency);

                    return (
                      <Link
                        key={file.id}
                        href={`/workflow/${file.id}`}
                        style={styles.slimFileLink}
                      >
                        <div style={styles.slimFileCard}>
                          <div style={styles.slimFileLeft}>
                            <div style={styles.slimBorrower}>{file.borrowerName}</div>
                            <div style={styles.slimMeta}>
                              Loan # {file.loanNumber || "Not Assigned"} · {file.purpose} ·{" "}
                              {formatCurrency(file.amount)}
                            </div>
                            <div style={styles.slimMetaSecondary}>
                              {file.propertyAddress || "No property address entered"}
                            </div>
                            <div style={styles.slimMetaSecondary}>
                              Last update: {file.latestUpdate || "No update yet."}
                            </div>
                          </div>

                          <div style={styles.slimFileRight}>
                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: statusTone.bg,
                                borderColor: statusTone.border,
                                color: statusTone.text,
                              }}
                            >
                              {getStatusLabel(file.status)}
                            </span>

                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: urgencyTone.bg,
                                borderColor: urgencyTone.border,
                                color: urgencyTone.text,
                              }}
                            >
                              {file.urgency}
                            </span>

                            <div style={styles.slimOpenText}>Open record</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {filteredFiles.length === 0 ? (
                    <div style={styles.placeholderBox}>{t.noFilesMatch}</div>
                  ) : null}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>{t.urgentOversight}</div>
              <h2 style={styles.sectionTitle}>{t.urgentAttention}</h2>

              <div style={styles.attentionList}>
                {urgentItems.length === 0 ? (
                  <div style={styles.placeholderBox}>{t.noUrgentItems}</div>
                ) : (
                  urgentItems.map((item) => (
                    <Link
                      key={`urgent-${item.id}`}
                      href={`/workflow/${item.id}`}
                      style={styles.attentionLink}
                    >
                      <div style={styles.attentionCard}>
                        <div>
                          <div style={styles.attentionName}>{item.borrowerName}</div>
                          <div style={styles.attentionMeta}>
                            Loan # {item.loanNumber || "Not Assigned"} ·{" "}
                            {getStatusLabel(item.status)} · {item.fileAgeDays} days in workflow
                          </div>
                          <div style={styles.attentionMeta}>
                            {item.propertyAddress || "No property address entered"}
                          </div>
                        </div>
                        <div style={styles.attentionIssue}>{item.blocker}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside style={styles.column}>
            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>{t.createFileEyebrow}</div>
              <h2 style={styles.sectionTitle}>{t.createFileTitle}</h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void createWorkflowFile();
                }}
              >
                <label style={styles.label}>{t.loanNumber}</label>
                <input
                  value={createLoanNumber}
                  onChange={(e) => setCreateLoanNumber(e.target.value)}
                  style={styles.input}
                  placeholder="Example: 2026-00124 or ARIVE loan number"
                />

                <label style={styles.label}>{t.borrowerName}</label>
                <input
                  value={createBorrowerName}
                  onChange={(e) => setCreateBorrowerName(e.target.value)}
                  style={styles.input}
                  placeholder={t.borrowerName}
                />

                <label style={styles.label}>{t.propertyAddress}</label>
                <input
                  value={createPropertyAddress}
                  onChange={(e) => setCreatePropertyAddress(e.target.value)}
                  style={styles.input}
                  placeholder="123 Main St, City, ST ZIP"
                  autoComplete="street-address"
                />

                <div style={styles.infoBox}>{t.addressEntryInfo}</div>

                <label style={styles.label}>{t.loanPurpose}</label>
                <select
                  value={createPurpose}
                  onChange={(e) => setCreatePurpose(e.target.value)}
                  style={styles.input}
                >
                  <option value="Purchase">Purchase</option>
                  <option value="Rate/Term Refinance">Rate/Term Refinance</option>
                  <option value="Cash-Out Refinance">Cash-Out Refinance</option>
                  <option value="HELOC">HELOC</option>
                  <option value="DSCR">DSCR</option>
                </select>

                <label style={styles.label}>{t.amount}</label>
                <input
                  value={createAmount}
                  onChange={(e) => setCreateAmount(normalizeCurrencyInput(e.target.value))}
                  style={styles.input}
                  placeholder="612000"
                  inputMode="numeric"
                />
                {createAmount ? (
                  <div style={styles.inlineHelperText}>
                    Display amount: {formatCurrency(Number(createAmount || 0))}
                  </div>
                ) : null}

                <label style={styles.label}>{t.loanOfficer}</label>
                <input
                  value={createLoanOfficer}
                  onChange={(e) => setCreateLoanOfficer(e.target.value)}
                  style={styles.input}
                  placeholder={t.loanOfficer}
                />

                <label style={styles.label}>{t.requestedProcessorNote}</label>
                <textarea
                  value={createRequestedProcessorNote}
                  onChange={(e) => setCreateRequestedProcessorNote(e.target.value)}
                  rows={3}
                  style={styles.textarea}
                  placeholder="Example: If possible, I would like Bia Marques on this file because of borrower language needs."
                />

                <label style={styles.label}>{t.assignProcessor}</label>
                <select
                  value={createProcessor}
                  onChange={(e) => setCreateProcessor(e.target.value)}
                  style={styles.input}
                  disabled={!canManageProcessing}
                >
                  <option value="Unassigned">{t.unassigned}</option>
                  {PROCESSORS.map((processor) => (
                    <option key={processor.id} value={processor.name}>
                      {processor.name}
                    </option>
                  ))}
                </select>

                {!canManageProcessing ? <div style={styles.infoBox}>{t.processorInfo}</div> : null}

                <label style={styles.label}>{t.targetCloseDate}</label>
                <input
                  type="date"
                  value={createTargetClose}
                  onChange={(e) => setCreateTargetClose(e.target.value)}
                  style={styles.input}
                />

                <label style={styles.label}>{t.urgency}</label>
                <select
                  value={createUrgency}
                  onChange={(e) => setCreateUrgency(e.target.value as WorkflowUrgency)}
                  style={styles.input}
                >
                  <option value="Standard">Standard</option>
                  <option value="Priority">Priority</option>
                  <option value="Rush">Rush</option>
                </select>

                <label style={styles.label}>{t.occupancy}</label>
                <input
                  value={createOccupancy}
                  onChange={(e) => setCreateOccupancy(e.target.value)}
                  style={styles.input}
                  placeholder="Primary Residence"
                />

                <label style={styles.label}>{t.blocker}</label>
                <textarea
                  value={createBlocker}
                  onChange={(e) => setCreateBlocker(e.target.value)}
                  rows={3}
                  style={styles.textarea}
                />

                <div style={styles.agentSectionCard}>
                  <div style={styles.agentSectionTitle}>{t.listingAgent}</div>

                  <label style={styles.label}>{t.listingAgentName}</label>
                  <input
                    value={createListingAgentName}
                    onChange={(e) => setCreateListingAgentName(e.target.value)}
                    style={styles.input}
                    placeholder={t.listingAgentName}
                  />

                  <label style={styles.label}>{t.listingAgentEmail}</label>
                  <input
                    value={createListingAgentEmail}
                    onChange={(e) => setCreateListingAgentEmail(e.target.value)}
                    style={styles.input}
                    placeholder="listing.agent@email.com"
                    type="email"
                  />

                  <label style={styles.label}>{t.listingAgentPhone}</label>
                  <input
                    value={createListingAgentPhone}
                    onChange={(e) =>
                      setCreateListingAgentPhone(formatPhoneDisplay(e.target.value))
                    }
                    style={styles.input}
                    placeholder="617.555.1212"
                    inputMode="numeric"
                  />
                </div>

                <div style={styles.agentSectionCard}>
                  <div style={styles.agentSectionTitle}>{t.buyerAgent}</div>

                  <label style={styles.label}>{t.buyerAgentName}</label>
                  <input
                    value={createBuyerAgentName}
                    onChange={(e) => setCreateBuyerAgentName(e.target.value)}
                    style={styles.input}
                    placeholder={t.buyerAgentName}
                  />

                  <label style={styles.label}>{t.buyerAgentEmail}</label>
                  <input
                    value={createBuyerAgentEmail}
                    onChange={(e) => setCreateBuyerAgentEmail(e.target.value)}
                    style={styles.input}
                    placeholder="buyer.agent@email.com"
                    type="email"
                  />

                  <label style={styles.label}>{t.buyerAgentPhone}</label>
                  <input
                    value={createBuyerAgentPhone}
                    onChange={(e) =>
                      setCreateBuyerAgentPhone(formatPhoneDisplay(e.target.value))
                    }
                    style={styles.input}
                    placeholder="617.555.1212"
                    inputMode="numeric"
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    ...styles.commandButton,
                    opacity: isCreatingFile ? 0.75 : 1,
                    cursor: isCreatingFile ? "not-allowed" : "pointer",
                  }}
                  disabled={isCreatingFile}
                >
                  {isCreatingFile ? t.creatingFile : t.addToWorkflow}
                </button>
              </form>

              {createStatusMessage ? <div style={styles.infoBox}>{createStatusMessage}</div> : null}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionEyebrow}>{t.phaseTitle}</div>
              <h2 style={styles.sectionTitle}>{t.phaseSubtitle}</h2>

              <div style={styles.moduleStack}>
                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>{t.phaseOneTitle}</div>
                  <div style={styles.moduleText}>{t.phaseOneText}</div>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>{t.phaseTwoTitle}</div>
                  <div style={styles.moduleText}>{t.phaseTwoText}</div>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>{t.phaseThreeTitle}</div>
                  <div style={styles.moduleText}>{t.phaseThreeText}</div>
                </div>
              </div>

              <div style={styles.footerBrand}>{t.footerBrand}</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string;
  subtext: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSubtext}>{subtext}</div>
    </div>
  );
}

function PipelineCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: WorkflowStatus;
}) {
  const tone = getStatusTone(status);

  return (
    <div
      style={{
        ...styles.pipelineCard,
        backgroundColor: tone.bg,
        borderColor: tone.border,
      }}
    >
      <div style={{ ...styles.pipelineLabel, color: tone.text }}>{label}</div>
      <div style={{ ...styles.pipelineValue, color: tone.text }}>{value}</div>
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

  @media (max-width: 1160px) {
    .bf-main-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 1080px) {
    .bf-workflow-hero-top {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 920px) {
    .bf-stat-grid,
    .bf-pipeline-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 680px) {
    .bf-wrap {
      padding: 18px 12px 32px !important;
    }

    .bf-stat-grid,
    .bf-pipeline-grid {
      grid-template-columns: 1fr !important;
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
    borderRadius: 30,
    padding: 28,
    color: "#ffffff",
    boxShadow: "0 16px 34px rgba(38,51,102,0.16)",
    marginBottom: 20,
  },
  workflowHeroTopBar: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 22,
    alignItems: "start",
  },
  workflowHeroLeft: {
    minWidth: 0,
  },
  workflowHeroRight: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 320,
  },
  userBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 20,
    padding: 16,
  },
  userBadgeTitle: {
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 4,
    color: "#ffffff",
  },
  userBadgeSubtext: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.92)",
  },
  signOutButton: {
    border: "1px solid rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    borderRadius: 16,
    padding: "14px 16px",
    fontWeight: 800,
    fontSize: 15,
  },
  heroBadge: {
    display: "inline-block",
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: 800,
    opacity: 0.98,
    backgroundColor: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: "10px 14px",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontWeight: 900,
    fontSize: 56,
    lineHeight: 0.95,
  },
  heroText: {
    marginTop: 22,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 820,
    color: "rgba(255,255,255,0.94)",
  },
  heroPurposeCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 18,
  },
  heroPurposeTitle: {
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  heroPurposeList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.95)",
    marginBottom: 18,
  },
  heroActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  heroActionOutline: {
    textDecoration: "none",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
  },
  heroActionGhost: {
    textDecoration: "none",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
  },
  statTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0284C7",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 10,
  },
  statSubtext: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.5,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
    marginBottom: 20,
  },
  sectionEyebrow: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: 0,
    color: "#2D3B78",
    fontSize: 28,
    lineHeight: 1.15,
    fontWeight: 900,
  },
  pipelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  searchWrap: {
    minWidth: 320,
    flex: "0 1 420px",
  },
  searchLabel: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    color: "#2D3B78",
    marginBottom: 8,
  },
  searchInput: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #B6C6E1",
    padding: "13px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0F172A",
    backgroundColor: "#ffffff",
  },
  pipelineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gap: 10,
  },
  pipelineCard: {
    borderRadius: 18,
    border: "1px solid",
    padding: 14,
    minHeight: 108,
  },
  pipelineLabel: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.4,
    marginBottom: 12,
  },
  pipelineValue: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 0.95fr",
    gap: 20,
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
  },
  slimList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },
  slimFileLink: {
    textDecoration: "none",
    color: "inherit",
  },
  slimFileCard: {
    borderRadius: 22,
    border: "1px solid #D7E2F0",
    backgroundColor: "#ffffff",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  slimFileLeft: {
    minWidth: 0,
    flex: 1,
  },
  slimBorrower: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 6,
  },
  slimMeta: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  slimMetaSecondary: {
    color: "#526581",
    fontSize: 14,
    lineHeight: 1.5,
    marginTop: 4,
    wordBreak: "break-word",
  },
  slimFileRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  slimOpenText: {
    fontSize: 14,
    fontWeight: 800,
    color: "#263366",
  },
  badge: {
    borderRadius: 999,
    border: "1px solid",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    color: "#2D3B78",
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #B6C6E1",
    padding: "13px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0F172A",
    backgroundColor: "#ffffff",
  },
  textarea: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #B6C6E1",
    padding: "13px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0F172A",
    backgroundColor: "#ffffff",
    resize: "vertical",
  },
  commandButton: {
    width: "100%",
    marginTop: 18,
    border: "none",
    borderRadius: 20,
    backgroundColor: "#3E4E93",
    color: "#ffffff",
    padding: "16px 20px",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 10px 20px rgba(38,51,102,0.16)",
  },
  infoBox: {
    marginTop: 14,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    color: "#1E3A8A",
    borderRadius: 16,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  inlineHelperText: {
    marginTop: 8,
    color: "#526581",
    fontSize: 13,
    lineHeight: 1.5,
  },
  attentionList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },
  attentionLink: {
    textDecoration: "none",
    color: "inherit",
  },
  attentionCard: {
    borderRadius: 20,
    border: "1px solid #F2C086",
    backgroundColor: "#FFF9F2",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  attentionName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 4,
  },
  attentionMeta: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.5,
  },
  attentionIssue: {
    color: "#9A3412",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.5,
  },
  moduleStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },
  moduleCard: {
    borderRadius: 20,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F9FBFE",
    padding: 16,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 8,
  },
  moduleText: {
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.7,
  },
  footerBrand: {
    textAlign: "center",
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid #E2E8F0",
    color: "#64748B",
    fontSize: 14,
  },
  placeholderBox: {
    borderRadius: 18,
    border: "1px dashed #CBD5E1",
    backgroundColor: "#F8FAFC",
    color: "#475569",
    padding: 16,
    lineHeight: 1.7,
    fontSize: 14,
    marginTop: 10,
  },
  agentSectionCard: {
    marginTop: 18,
    borderRadius: 20,
    border: "1px solid #D7E2F0",
    backgroundColor: "#F9FBFE",
    padding: 16,
  },
  agentSectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 4,
  },
};
