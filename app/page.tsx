"use client";

import React, { useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import { SiteLanguage } from "@/app/components/site-header-translations";

type LanguageCode = "en" | "pt" | "es";

const COPY: Record<
  LanguageCode,
  {
    heroBadge: string;
    heroTitle1: string;
    heroTitle2: string;
    heroTitle3: string;
    heroTitle4: string;
    heroText: string;
    structureTitle: string;
    structureText: string;
    structureLine1: string;
    structureLine2: string;
    structureLine3: string;
    startHereTitle: string;
    startHereHeadline: string;
    startHereText: string;
    startHereButton: string;
    startHereFootnote: string;
    borrowerEyebrow: string;
    borrowerTitle1: string;
    borrowerTitle2: string;
    borrowerText: string;
    borrowerBullet1: string;
    borrowerBullet2: string;
    borrowerBullet3: string;
    borrowerBullet4: string;
    borrowerButton: string;
    teamEyebrow: string;
    teamTitle1: string;
    teamTitle2: string;
    teamText: string;
    teamBullet1: string;
    teamBullet2: string;
    teamBullet3: string;
    teamBullet4: string;
    teamButton: string;
    workflowEyebrow: string;
    workflowTitle1: string;
    workflowTitle2: string;
    workflowText: string;
    workflowBullet1: string;
    workflowBullet2: string;
    workflowBullet3: string;
    workflowBullet4: string;
    workflowButton: string;
    architectureEyebrow: string;
    architectureTitle: string;
    architectureText: string;
    archCard1Title: string;
    archCard1Text: string;
    archCard2Title: string;
    archCard2Text: string;
    archCard3Title: string;
    archCard3Text: string;
    footerText: string;
    footerTag: string;
  }
> = {
  en: {
    heroBadge: "BEYOND INTELLIGENCE™",
    heroTitle1: "Mortgage intelligence",
    heroTitle2: "for borrower guidance,",
    heroTitle3: "professional analysis,",
    heroTitle4: "and workflow execution.",
    heroText:
      "Beyond Intelligence™ is an AI-powered mortgage operating system supervised by an Independent Certified Mortgage Advisor. It is designed to separate borrower interaction, professional mortgage thinking, and team workflow execution into disciplined product layers that scale cleanly.",
    structureTitle: "PLATFORM STRUCTURE",
    structureText:
      "One system. Three environments. Each with a distinct role in the mortgage journey.",
    structureLine1: "• Borrower Intelligence for guided client interaction.",
    structureLine2:
      "• Team Workspace for protected professional research, Finley chat, product direction, lender and investor knowledge, and internal analysis.",
    structureLine3:
      "• Workflow Intelligence for protected file execution, milestone visibility, and production coordination.",
    startHereTitle: "START HERE",
    startHereHeadline: "Talk to Finley Beyond",
    startHereText:
      "Begin your borrower interaction here to review your mortgage scenario, answer qualification questions, and get routed toward the right next step.",
    startHereButton: "Start Borrower Conversation",
    startHereFootnote:
      "Designed for borrowers who want to begin with guided mortgage intake and Finley Beyond interaction.",
    borrowerEyebrow: "BORROWER EXPERIENCE",
    borrowerTitle1: "Borrower",
    borrowerTitle2: "Intelligence",
    borrowerText:
      "Client-facing intake, mortgage guidance, routed loan officer matching, and Finley Beyond conversation flow with required disclaimer handling.",
    borrowerBullet1: "• Guided mortgage intake",
    borrowerBullet2: "• Loan officer routing",
    borrowerBullet3: "• Scenario review and borrower chat",
    borrowerBullet4: "• Apply, schedule, and contact actions",
    borrowerButton: "Open Borrower Intelligence",
    teamEyebrow: "PROTECTED PROFESSIONAL RESEARCH",
    teamTitle1: "Team Workspace",
    teamTitle2: "& Mortgage Intelligence",
    teamText:
      "Password-protected professional access for mortgage teams to chat with Finley, research products, review lender and investor direction, and strengthen internal mortgage analysis.",
    teamBullet1: "• Finley professional knowledge chat",
    teamBullet2: "• Product, lender, and investor research",
    teamBullet3: "• Borrower scenario review",
    teamBullet4: "• Internal summary and advisory support",
    teamButton: "Enter Team Workspace",
    workflowEyebrow: "PROTECTED EXECUTION LAYER",
    workflowTitle1: "Workflow",
    workflowTitle2: "Intelligence",
    workflowText:
      "Password-protected command-center visibility for processing handoff, internal file coordination, milestone tracking, blockers, urgency, and close management.",
    workflowBullet1: "• Processing handoff",
    workflowBullet2: "• Active file queue and command panel",
    workflowBullet3: "• Milestones, blockers, and urgency",
    workflowBullet4: "• Internal file feed and execution tracking",
    workflowButton: "Enter Workflow Intelligence",
    architectureEyebrow: "PRODUCT ARCHITECTURE",
    architectureTitle: "A cleaner operating system for mortgage teams",
    architectureText:
      "The platform separates borrower interaction, protected professional intelligence, and workflow execution so each environment can grow stronger without overcrowding the others. Administrative control remains separate from professional access.",
    archCard1Title: "Borrower Interaction",
    archCard1Text:
      "The borrower-facing environment captures the scenario, educates the client, and moves the conversation toward a licensed advisor.",
    archCard2Title: "Protected Professional Intelligence",
    archCard2Text:
      "The professional workspace helps mortgage teams research products, compare direction, ask Finley structured questions, and think through next-best actions.",
    archCard3Title: "Workflow Execution",
    archCard3Text:
      "The command layer keeps handoff, processing, blockers, and closing visibility aligned from pre-approval through funding.",
    footerText:
      "Beyond Intelligence™ organizes borrower guidance, protected professional mortgage intelligence, and workflow execution under one supervised system.",
    footerTag: "MultiLender Intelligence™",
  },
  pt: {
    heroBadge: "BEYOND INTELLIGENCE™",
    heroTitle1: "Inteligência hipotecária",
    heroTitle2: "para orientação do cliente,",
    heroTitle3: "análise profissional,",
    heroTitle4: "e execução operacional.",
    heroText:
      "Beyond Intelligence™ é um sistema operacional hipotecário com IA, supervisionado por um Independent Certified Mortgage Advisor. Ele foi projetado para separar a interação com o cliente, o raciocínio hipotecário profissional e a execução operacional da equipe em camadas de produto disciplinadas e escaláveis.",
    structureTitle: "ESTRUTURA DA PLATAFORMA",
    structureText:
      "Um sistema. Três ambientes. Cada um com uma função distinta na jornada hipotecária.",
    structureLine1: "• Borrower Intelligence para interação guiada com o cliente.",
    structureLine2:
      "• Team Workspace para pesquisa profissional protegida, chat com Finley, direção de produtos, conhecimento sobre lenders e investidores, e análise interna.",
    structureLine3:
      "• Workflow Intelligence para execução protegida de arquivos, visibilidade de marcos e coordenação de produção.",
    startHereTitle: "COMECE AQUI",
    startHereHeadline: "Fale com Finley Beyond",
    startHereText:
      "Inicie aqui sua interação como cliente para revisar seu cenário hipotecário, responder perguntas de qualificação e ser direcionado ao próximo passo apropriado.",
    startHereButton: "Iniciar Conversa do Cliente",
    startHereFootnote:
      "Desenvolvido para clientes que desejam começar com intake guiado e interação com Finley Beyond.",
    borrowerEyebrow: "EXPERIÊNCIA DO CLIENTE",
    borrowerTitle1: "Borrower",
    borrowerTitle2: "Intelligence",
    borrowerText:
      "Intake voltado ao cliente, orientação hipotecária, roteamento de loan officer e fluxo de conversa com Finley Beyond com aviso obrigatório.",
    borrowerBullet1: "• Intake guiado",
    borrowerBullet2: "• Roteamento de loan officer",
    borrowerBullet3: "• Revisão de cenário e chat com o cliente",
    borrowerBullet4: "• Ações de aplicar, agendar e contato",
    borrowerButton: "Abrir Borrower Intelligence",
    teamEyebrow: "PESQUISA PROFISSIONAL PROTEGIDA",
    teamTitle1: "Team Workspace",
    teamTitle2: "& Mortgage Intelligence",
    teamText:
      "Acesso profissional protegido por senha para equipes hipotecárias conversarem com Finley, pesquisarem produtos, revisarem direção de lenders e investidores e fortalecerem sua análise interna.",
    teamBullet1: "• Chat profissional de conhecimento com Finley",
    teamBullet2: "• Pesquisa de produtos, lenders e investidores",
    teamBullet3: "• Revisão de cenário do cliente",
    teamBullet4: "• Resumos internos e suporte consultivo",
    teamButton: "Entrar na Área da Equipe",
    workflowEyebrow: "CAMADA DE EXECUÇÃO PROTEGIDA",
    workflowTitle1: "Workflow",
    workflowTitle2: "Intelligence",
    workflowText:
      "Visibilidade protegida por senha em estilo command center para handoff ao processing, coordenação interna de arquivos, marcos, bloqueios, urgência e gestão de fechamento.",
    workflowBullet1: "• Handoff ao processing",
    workflowBullet2: "• Fila ativa de arquivos e painel de comando",
    workflowBullet3: "• Marcos, bloqueios e urgência",
    workflowBullet4: "• Feed interno de arquivos e acompanhamento de execução",
    workflowButton: "Entrar no Workflow Intelligence",
    architectureEyebrow: "ARQUITETURA DO PRODUTO",
    architectureTitle: "Um sistema operacional mais limpo para equipes hipotecárias",
    architectureText:
      "A plataforma separa interação com o cliente, inteligência profissional protegida e execução operacional para que cada ambiente evolua sem sobrecarregar os demais. O controle administrativo permanece separado do acesso profissional.",
    archCard1Title: "Interação com o Cliente",
    archCard1Text:
      "O ambiente voltado ao cliente captura o cenário, educa o cliente e move a conversa em direção a um advisor licenciado.",
    archCard2Title: "Inteligência Profissional Protegida",
    archCard2Text:
      "A área profissional ajuda equipes hipotecárias a pesquisar produtos, comparar direções, fazer perguntas estruturadas ao Finley e pensar no próximo melhor passo.",
    archCard3Title: "Execução Operacional",
    archCard3Text:
      "A camada de comando mantém handoff, processing, bloqueios e visibilidade de fechamento alinhados do pre-approval ao funding.",
    footerText:
      "Beyond Intelligence™ organiza orientação ao cliente, inteligência hipotecária profissional protegida e execução operacional sob um sistema supervisionado.",
    footerTag: "MultiLender Intelligence™",
  },
  es: {
    heroBadge: "BEYOND INTELLIGENCE™",
    heroTitle1: "Inteligencia hipotecaria",
    heroTitle2: "para orientación del cliente,",
    heroTitle3: "análisis profesional,",
    heroTitle4: "y ejecución operativa.",
    heroText:
      "Beyond Intelligence™ es un sistema operativo hipotecario impulsado por IA y supervisado por un Independent Certified Mortgage Advisor. Está diseñado para separar la interacción con el cliente, el pensamiento hipotecario profesional y la ejecución operativa del equipo en capas disciplinadas y escalables.",
    structureTitle: "ESTRUCTURA DE LA PLATAFORMA",
    structureText:
      "Un sistema. Tres entornos. Cada uno con una función distinta en la trayectoria hipotecaria.",
    structureLine1: "• Borrower Intelligence para interacción guiada con el cliente.",
    structureLine2:
      "• Team Workspace para investigación profesional protegida, chat con Finley, dirección de productos, conocimiento sobre lenders e inversionistas y análisis interno.",
    structureLine3:
      "• Workflow Intelligence para ejecución protegida de archivos, visibilidad de hitos y coordinación de producción.",
    startHereTitle: "COMIENCE AQUÍ",
    startHereHeadline: "Hable con Finley Beyond",
    startHereText:
      "Comience aquí su interacción como cliente para revisar su escenario hipotecario, responder preguntas de calificación y ser dirigido al siguiente paso correcto.",
    startHereButton: "Iniciar Conversación del Cliente",
    startHereFootnote:
      "Diseñado para clientes que desean comenzar con intake guiado e interacción con Finley Beyond.",
    borrowerEyebrow: "EXPERIENCIA DEL CLIENTE",
    borrowerTitle1: "Borrower",
    borrowerTitle2: "Intelligence",
    borrowerText:
      "Intake orientado al cliente, orientación hipotecaria, asignación de loan officer y flujo de conversación con Finley Beyond con aviso obligatorio.",
    borrowerBullet1: "• Intake guiado",
    borrowerBullet2: "• Asignación de loan officer",
    borrowerBullet3: "• Revisión de escenario y chat con el cliente",
    borrowerBullet4: "• Acciones de aplicar, agendar y contacto",
    borrowerButton: "Abrir Borrower Intelligence",
    teamEyebrow: "INVESTIGACIÓN PROFESIONAL PROTEGIDA",
    teamTitle1: "Team Workspace",
    teamTitle2: "& Mortgage Intelligence",
    teamText:
      "Acceso profesional protegido por contraseña para que los equipos hipotecarios conversen con Finley, investiguen productos, revisen dirección de lenders e inversionistas y fortalezcan su análisis interno.",
    teamBullet1: "• Chat profesional de conocimiento con Finley",
    teamBullet2: "• Investigación de productos, lenders e inversionistas",
    teamBullet3: "• Revisión de escenario del cliente",
    teamBullet4: "• Resúmenes internos y apoyo consultivo",
    teamButton: "Entrar al Team Workspace",
    workflowEyebrow: "CAPA DE EJECUCIÓN PROTEGIDA",
    workflowTitle1: "Workflow",
    workflowTitle2: "Intelligence",
    workflowText:
      "Visibilidad protegida por contraseña tipo command center para handoff a processing, coordinación interna de archivos, hitos, bloqueos, urgencia y gestión del cierre.",
    workflowBullet1: "• Handoff a processing",
    workflowBullet2: "• Cola activa de archivos y panel de comando",
    workflowBullet3: "• Hitos, bloqueos y urgencia",
    workflowBullet4: "• Flujo interno de archivos y seguimiento operativo",
    workflowButton: "Entrar a Workflow Intelligence",
    architectureEyebrow: "ARQUITECTURA DEL PRODUCTO",
    architectureTitle: "Un sistema operativo más limpio para equipos hipotecarios",
    architectureText:
      "La plataforma separa interacción con el cliente, inteligencia profesional protegida y ejecución operativa para que cada entorno crezca sin sobrecargar a los demás. El control administrativo permanece separado del acceso profesional.",
    archCard1Title: "Interacción con el Cliente",
    archCard1Text:
      "El entorno orientado al cliente captura el escenario, educa al cliente y mueve la conversación hacia un advisor licenciado.",
    archCard2Title: "Inteligencia Profesional Protegida",
    archCard2Text:
      "El espacio profesional ayuda a los equipos hipotecarios a investigar productos, comparar dirección, hacer preguntas estructuradas a Finley y pensar en el siguiente mejor paso.",
    archCard3Title: "Ejecución Operativa",
    archCard3Text:
      "La capa de comando mantiene alineados handoff, processing, bloqueos y visibilidad de cierre desde pre-approval hasta funding.",
    footerText:
      "Beyond Intelligence™ organiza orientación al cliente, inteligencia hipotecaria profesional protegida y ejecución operativa bajo un sistema supervisado.",
    footerTag: "MultiLender Intelligence™",
  },
};

export default function HomePage() {
  const [language, setLanguage] = useState<SiteLanguage>("en");
  const t = COPY[language];

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <SiteHeader
          variant="home"
          language={language}
          onLanguageChange={setLanguage}
        />

        <section style={styles.hero}>
          <div className="bf-hero-grid" style={styles.heroGrid}>
            <div>
              <div style={styles.badge}>{t.heroBadge}</div>

              <h1 className="bf-hero-title" style={styles.heroTitle}>
                {t.heroTitle1}
                <br />
                {t.heroTitle2}
                <br />
                {t.heroTitle3}
                <br />
                {t.heroTitle4}
              </h1>

              <p style={styles.heroText}>{t.heroText}</p>
            </div>

            <div style={styles.heroStack}>
              <div style={styles.heroPanel}>
                <div style={styles.heroPanelTitle}>{t.structureTitle}</div>

                <div style={styles.heroPanelText}>{t.structureText}</div>

                <div style={styles.heroPanelList}>
                  <div>{t.structureLine1}</div>
                  <div>{t.structureLine2}</div>
                  <div>{t.structureLine3}</div>
                </div>
              </div>

              <div style={styles.heroPanel}>
                <div style={styles.heroPanelTitle}>{t.startHereTitle}</div>

                <div style={styles.startHereHeadline}>{t.startHereHeadline}</div>

                <div style={styles.heroPanelText}>{t.startHereText}</div>

                <a href="/borrower" style={styles.startHereButton}>
                  {t.startHereButton}
                </a>

                <div style={styles.startHereFootnote}>{t.startHereFootnote}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bf-main-grid" style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardEyebrow}>{t.borrowerEyebrow}</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              {t.borrowerTitle1}
              <br />
              {t.borrowerTitle2}
            </h2>

            <p style={styles.cardText}>{t.borrowerText}</p>

            <div style={styles.cardList}>
              <div>{t.borrowerBullet1}</div>
              <div>{t.borrowerBullet2}</div>
              <div>{t.borrowerBullet3}</div>
              <div>{t.borrowerBullet4}</div>
            </div>

            <div style={styles.cardActions}>
              <a href="/borrower" style={styles.primaryAction}>
                {t.borrowerButton}
              </a>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardEyebrow}>{t.teamEyebrow}</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              {t.teamTitle1}
              <br />
              {t.teamTitle2}
            </h2>

            <p style={styles.cardText}>{t.teamText}</p>

            <div style={styles.cardList}>
              <div>{t.teamBullet1}</div>
              <div>{t.teamBullet2}</div>
              <div>{t.teamBullet3}</div>
              <div>{t.teamBullet4}</div>
            </div>

            <div style={styles.cardActions}>
              <a href="/team" style={styles.secondaryAction}>
                {t.teamButton}
              </a>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardEyebrow}>{t.workflowEyebrow}</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              {t.workflowTitle1}
              <br />
              {t.workflowTitle2}
            </h2>

            <p style={styles.cardText}>{t.workflowText}</p>

            <div style={styles.cardList}>
              <div>{t.workflowBullet1}</div>
              <div>{t.workflowBullet2}</div>
              <div>{t.workflowBullet3}</div>
              <div>{t.workflowBullet4}</div>
            </div>

            <div style={styles.cardActions}>
              <a href="/workflow" style={styles.outlineAction}>
                {t.workflowButton}
              </a>
            </div>
          </div>
        </section>

        <section style={styles.architectureCard}>
          <div style={styles.architectureHeader}>
            <div style={styles.sectionEyebrow}>{t.architectureEyebrow}</div>
            <h2 className="bf-section-title" style={styles.sectionTitle}>
              {t.architectureTitle}
            </h2>
            <p style={styles.sectionText}>{t.architectureText}</p>
          </div>

          <div className="bf-arch-grid" style={styles.architectureGrid}>
            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>{t.archCard1Title}</div>
              <div style={styles.architectureItemText}>{t.archCard1Text}</div>
            </div>

            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>{t.archCard2Title}</div>
              <div style={styles.architectureItemText}>{t.archCard2Text}</div>
            </div>

            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>{t.archCard3Title}</div>
              <div style={styles.architectureItemText}>{t.archCard3Text}</div>
            </div>
          </div>
        </section>

        <div style={styles.footer}>
          {t.footerText}
          <div style={styles.footerTag}>{t.footerTag}</div>
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

  @media (max-width: 1160px) {
    .bf-hero-grid,
    .bf-main-grid,
    .bf-arch-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .bf-wrap {
      padding: 18px 12px 32px !important;
    }

    .bf-hero-title {
      font-size: 38px !important;
      line-height: 1.02 !important;
    }

    .bf-card-title {
      font-size: 28px !important;
    }

    .bf-section-title {
      font-size: 28px !important;
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
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 30,
    color: "#ffffff",
    boxShadow: "0 18px 40px rgba(38,51,102,0.18)",
    marginBottom: 22,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 22,
    alignItems: "start",
  },
  heroStack: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  badge: {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: 58,
    lineHeight: 0.96,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 22,
    marginBottom: 0,
    maxWidth: 840,
    fontSize: 17,
    lineHeight: 1.75,
    color: "rgba(255,255,255,0.94)",
  },
  heroPanel: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 20,
  },
  heroPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  heroPanelText: {
    color: "rgba(255,255,255,0.94)",
    lineHeight: 1.7,
    fontSize: 15,
    marginBottom: 16,
  },
  heroPanelList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    color: "rgba(255,255,255,0.96)",
    fontSize: 15,
    lineHeight: 1.6,
  },
  startHereHeadline: {
    fontSize: 24,
    lineHeight: 1.08,
    fontWeight: 900,
    color: "#ffffff",
    marginBottom: 12,
  },
  startHereButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 52,
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    color: "#243F7C",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 10px 20px rgba(20,35,80,0.14)",
  },
  startHereFootnote: {
    marginTop: 14,
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 18,
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
    display: "flex",
    flexDirection: "column",
    minHeight: 100,
  },
  cardEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    color: "#2D3B78",
    fontWeight: 900,
    marginBottom: 14,
  },
  cardText: {
    margin: 0,
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.75,
  },
  cardList: {
    marginTop: 18,
    marginBottom: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    color: "#526581",
    fontSize: 14,
    lineHeight: 1.6,
  },
  cardActions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: "auto",
  },
  primaryAction: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "0 10px 20px rgba(38,51,102,0.14)",
  },
  secondaryAction: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  outlineAction: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    border: "1px solid #263366",
    backgroundColor: "#ffffff",
    color: "#263366",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  architectureCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
  },
  architectureHeader: {
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    color: "#2D3B78",
    fontWeight: 900,
  },
  sectionText: {
    marginTop: 12,
    marginBottom: 0,
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.75,
    maxWidth: 920,
  },
  architectureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  architectureItem: {
    borderRadius: 22,
    border: "1px solid #D9E4F1",
    backgroundColor: "#F9FBFE",
    padding: 18,
  },
  architectureItemTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 8,
  },
  architectureItemText: {
    color: "#526581",
    fontSize: 14,
    lineHeight: 1.7,
  },
  footer: {
    marginTop: 22,
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.6,
  },
  footerTag: {
    display: "inline-block",
    marginTop: 12,
    padding: "8px 12px",
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    color: "#1D4ED8",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.4,
  },
};
