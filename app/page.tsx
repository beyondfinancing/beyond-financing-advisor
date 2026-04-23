"use client";

import React, { useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import { SiteLanguage } from "@/app/components/site-header-translations";

const HOME_COPY: Record<
  SiteLanguage,
  {
    badge: string;
    heroTitle: React.ReactNode;
    heroText: string;
    structureTitle: string;
    structureText: string;
    structureBullets: string[];
    startHere: string;
    finleyTitle: string;
    finleyText: string;
    finleyButton: string;
    finleySubtext: string;
    borrowerEyebrow: string;
    borrowerTitle: React.ReactNode;
    borrowerText: string;
    borrowerBullets: string[];
    borrowerAction: string;
    teamEyebrow: string;
    teamTitle: React.ReactNode;
    teamText: string;
    teamBullets: string[];
    teamAction: string;
    workflowEyebrow: string;
    workflowTitle: React.ReactNode;
    workflowText: string;
    workflowBullets: string[];
    workflowAction: string;
    architectureEyebrow: string;
    architectureTitle: string;
    architectureText: string;
    architectureOneTitle: string;
    architectureOneText: string;
    architectureTwoTitle: string;
    architectureTwoText: string;
    architectureThreeTitle: string;
    architectureThreeText: string;
    footer: string;
    footerTag: string;
  }
> = {
  en: {
    badge: "BEYOND INTELLIGENCE™",
    heroTitle: (
      <>
        Mortgage intelligence
        <br />
        for borrower guidance,
        <br />
        professional analysis,
        <br />
        and workflow execution.
      </>
    ),
    heroText:
      "Beyond Intelligence™ is an AI-powered mortgage operating system supervised by an Independent Certified Mortgage Advisor. It is designed to separate borrower interaction, professional mortgage thinking, and team workflow execution into disciplined product layers that scale cleanly.",
    structureTitle: "PLATFORM STRUCTURE",
    structureText:
      "One system. Three environments. Each with a distinct role in the mortgage journey.",
    structureBullets: [
      "Borrower Intelligence for guided client interaction.",
      "Team Mortgage Intelligence for professional analysis.",
      "Team Workflow Intelligence for execution and file command.",
    ],
    startHere: "START HERE",
    finleyTitle: "Talk to Finley Beyond",
    finleyText:
      "Begin your borrower interaction here to review your mortgage scenario, answer qualification questions, and get routed toward the right next step.",
    finleyButton: "Start Borrower Conversation",
    finleySubtext:
      "Designed for borrowers who want to begin with guided mortgage intake and Finley Beyond interaction.",
    borrowerEyebrow: "BORROWER EXPERIENCE",
    borrowerTitle: (
      <>
        Borrower
        <br />
        Intelligence
      </>
    ),
    borrowerText:
      "Client-facing intake, mortgage guidance, routed loan officer matching, and Finley Beyond conversation flow with required disclaimer handling.",
    borrowerBullets: [
      "Guided mortgage intake",
      "Loan officer routing",
      "Scenario review and borrower chat",
      "Apply, schedule, and contact actions",
    ],
    borrowerAction: "Open Borrower Intelligence",
    teamEyebrow: "PROFESSIONAL THINKING LAYER",
    teamTitle: (
      <>
        Team Mortgage
        <br />
        Intelligence
      </>
    ),
    teamText:
      "Internal borrower analysis, directional program thinking, summary generation, and professional review support for licensed mortgage teams.",
    teamBullets: [
      "Borrower scenario review",
      "Directional program analysis",
      "Finley professional decision support",
      "Internal summary email generation",
    ],
    teamAction: "Enter Mortgage Intelligence",
    workflowEyebrow: "PROFESSIONAL EXECUTION LAYER",
    workflowTitle: (
      <>
        Team Workflow
        <br />
        Intelligence
      </>
    ),
    workflowText:
      "Command-center visibility for processing handoff, internal file coordination, milestone tracking, blockers, urgency, and close management.",
    workflowBullets: [
      "Processing handoff",
      "Active file queue and command panel",
      "Milestones, blockers, and urgency",
      "Internal file feed and execution tracking",
    ],
    workflowAction: "Enter Workflow Intelligence",
    architectureEyebrow: "PRODUCT ARCHITECTURE",
    architectureTitle: "A cleaner operating system for mortgage teams",
    architectureText:
      "The platform now separates interaction, analysis, and execution so each environment can become stronger without overcrowding the others. This gives Beyond Intelligence™ a more disciplined, premium, and scalable product structure.",
    architectureOneTitle: "Borrower Interaction",
    architectureOneText:
      "The borrower-facing environment captures the scenario, educates the client, and moves the conversation toward a licensed advisor.",
    architectureTwoTitle: "Mortgage Thinking",
    architectureTwoText:
      "The professional intelligence layer helps the team reason through structure, fit, missing items, and the next best action.",
    architectureThreeTitle: "Workflow Execution",
    architectureThreeText:
      "The command layer keeps handoff, processing, blockers, and closing visibility aligned from pre-approval through funding.",
    footer:
      "Beyond Intelligence™ helps organize borrower guidance, mortgage analysis, and professional workflow execution under one supervised system.",
    footerTag: "MultiLender Intelligence™",
  },
  pt: {
    badge: "BEYOND INTELLIGENCE™",
    heroTitle: (
      <>
        Inteligência hipotecária
        <br />
        para orientação ao cliente,
        <br />
        análise profissional,
        <br />
        e execução de workflow.
      </>
    ),
    heroText:
      "Beyond Intelligence™ é um sistema operacional hipotecário com IA supervisionado por um Independent Certified Mortgage Advisor. Ele foi projetado para separar a interação com o cliente, o raciocínio profissional hipotecário e a execução operacional da equipe em camadas de produto disciplinadas e escaláveis.",
    structureTitle: "ESTRUTURA DA PLATAFORMA",
    structureText:
      "Um sistema. Três ambientes. Cada um com um papel distinto na jornada hipotecária.",
    structureBullets: [
      "Borrower Intelligence para interação guiada com o cliente.",
      "Team Mortgage Intelligence para análise profissional.",
      "Team Workflow Intelligence para execução e comando do arquivo.",
    ],
    startHere: "COMECE AQUI",
    finleyTitle: "Fale com Finley Beyond",
    finleyText:
      "Inicie aqui sua interação para revisar seu cenário hipotecário, responder perguntas de qualificação e ser direcionado ao próximo passo adequado.",
    finleyButton: "Iniciar Conversa do Cliente",
    finleySubtext:
      "Desenvolvido para clientes que desejam começar com intake hipotecário guiado e interação com Finley Beyond.",
    borrowerEyebrow: "EXPERIÊNCIA DO CLIENTE",
    borrowerTitle: (
      <>
        Borrower
        <br />
        Intelligence
      </>
    ),
    borrowerText:
      "Intake voltado ao cliente, orientação hipotecária, direcionamento para loan officer e fluxo de conversa com Finley Beyond com aviso obrigatório.",
    borrowerBullets: [
      "Intake hipotecário guiado",
      "Direcionamento de loan officer",
      "Revisão de cenário e conversa com o cliente",
      "Ações de aplicar, agendar e contato",
    ],
    borrowerAction: "Abrir Borrower Intelligence",
    teamEyebrow: "CAMADA DE RACIOCÍNIO PROFISSIONAL",
    teamTitle: (
      <>
        Team Mortgage
        <br />
        Intelligence
      </>
    ),
    teamText:
      "Análise interna do cliente, raciocínio direcional de programas, geração de resumos e suporte de revisão profissional para equipes hipotecárias licenciadas.",
    teamBullets: [
      "Revisão do cenário do cliente",
      "Análise direcional de programas",
      "Suporte profissional de decisão com Finley",
      "Geração interna de email-resumo",
    ],
    teamAction: "Entrar em Mortgage Intelligence",
    workflowEyebrow: "CAMADA DE EXECUÇÃO PROFISSIONAL",
    workflowTitle: (
      <>
        Team Workflow
        <br />
        Intelligence
      </>
    ),
    workflowText:
      "Visibilidade em centro de comando para handoff ao processamento, coordenação interna do arquivo, marcos, bloqueios, urgência e gestão até o fechamento.",
    workflowBullets: [
      "Handoff para processamento",
      "Fila ativa de arquivos e painel de comando",
      "Marcos, bloqueios e urgência",
      "Feed interno do arquivo e execução",
    ],
    workflowAction: "Entrar em Workflow Intelligence",
    architectureEyebrow: "ARQUITETURA DO PRODUTO",
    architectureTitle: "Um sistema operacional mais limpo para equipes hipotecárias",
    architectureText:
      "A plataforma agora separa interação, análise e execução para que cada ambiente fique mais forte sem sobrecarregar os demais. Isso dá ao Beyond Intelligence™ uma estrutura mais disciplinada, premium e escalável.",
    architectureOneTitle: "Interação com o Cliente",
    architectureOneText:
      "O ambiente voltado ao cliente captura o cenário, educa o cliente e move a conversa em direção a um advisor licenciado.",
    architectureTwoTitle: "Raciocínio Hipotecário",
    architectureTwoText:
      "A camada profissional ajuda a equipe a raciocinar sobre estrutura, encaixe, itens faltantes e a melhor próxima ação.",
    architectureThreeTitle: "Execução de Workflow",
    architectureThreeText:
      "A camada de comando mantém handoff, processamento, bloqueios e visibilidade de fechamento alinhados do pré-aprovação ao funding.",
    footer:
      "Beyond Intelligence™ ajuda a organizar orientação ao cliente, análise hipotecária e execução profissional de workflow sob um único sistema supervisionado.",
    footerTag: "MultiLender Intelligence™",
  },
  es: {
    badge: "BEYOND INTELLIGENCE™",
    heroTitle: (
      <>
        Inteligencia hipotecaria
        <br />
        para orientación al cliente,
        <br />
        análisis profesional,
        <br />
        y ejecución de workflow.
      </>
    ),
    heroText:
      "Beyond Intelligence™ es un sistema operativo hipotecario impulsado por IA supervisado por un Independent Certified Mortgage Advisor. Está diseñado para separar la interacción con el cliente, el pensamiento hipotecario profesional y la ejecución operativa del equipo en capas disciplinadas y escalables.",
    structureTitle: "ESTRUCTURA DE LA PLATAFORMA",
    structureText:
      "Un sistema. Tres entornos. Cada uno con un papel distinto en la jornada hipotecaria.",
    structureBullets: [
      "Borrower Intelligence para interacción guiada con el cliente.",
      "Team Mortgage Intelligence para análisis profesional.",
      "Team Workflow Intelligence para ejecución y control del archivo.",
    ],
    startHere: "COMIENCE AQUÍ",
    finleyTitle: "Hable con Finley Beyond",
    finleyText:
      "Comience aquí su interacción para revisar su escenario hipotecario, responder preguntas de calificación y ser guiado hacia el siguiente paso adecuado.",
    finleyButton: "Iniciar Conversación del Cliente",
    finleySubtext:
      "Diseñado para clientes que desean comenzar con intake hipotecario guiado e interacción con Finley Beyond.",
    borrowerEyebrow: "EXPERIENCIA DEL CLIENTE",
    borrowerTitle: (
      <>
        Borrower
        <br />
        Intelligence
      </>
    ),
    borrowerText:
      "Intake orientado al cliente, orientación hipotecaria, asignación de loan officer y flujo conversacional con Finley Beyond con aviso obligatorio.",
    borrowerBullets: [
      "Intake hipotecario guiado",
      "Asignación de loan officer",
      "Revisión de escenario y conversación con el cliente",
      "Acciones para aplicar, agendar y contactar",
    ],
    borrowerAction: "Abrir Borrower Intelligence",
    teamEyebrow: "CAPA DE PENSAMIENTO PROFESIONAL",
    teamTitle: (
      <>
        Team Mortgage
        <br />
        Intelligence
      </>
    ),
    teamText:
      "Análisis interno del cliente, pensamiento direccional de programas, generación de resúmenes y apoyo de revisión profesional para equipos hipotecarios licenciados.",
    teamBullets: [
      "Revisión del escenario del cliente",
      "Análisis direccional de programas",
      "Soporte profesional de decisión con Finley",
      "Generación interna de email-resumen",
    ],
    teamAction: "Entrar en Mortgage Intelligence",
    workflowEyebrow: "CAPA DE EJECUCIÓN PROFESIONAL",
    workflowTitle: (
      <>
        Team Workflow
        <br />
        Intelligence
      </>
    ),
    workflowText:
      "Visibilidad tipo centro de mando para handoff a processing, coordinación interna del archivo, hitos, bloqueos, urgencia y gestión hacia el cierre.",
    workflowBullets: [
      "Handoff a processing",
      "Cola activa de archivos y panel de mando",
      "Hitos, bloqueos y urgencia",
      "Feed interno del archivo y seguimiento operativo",
    ],
    workflowAction: "Entrar en Workflow Intelligence",
    architectureEyebrow: "ARQUITECTURA DEL PRODUCTO",
    architectureTitle: "Un sistema operativo más limpio para equipos hipotecarios",
    architectureText:
      "La plataforma ahora separa interacción, análisis y ejecución para que cada entorno pueda fortalecerse sin sobrecargar a los demás. Esto le da a Beyond Intelligence™ una estructura más disciplinada, premium y escalable.",
    architectureOneTitle: "Interacción con el Cliente",
    architectureOneText:
      "El entorno orientado al cliente captura el escenario, educa al cliente y mueve la conversación hacia un advisor con licencia.",
    architectureTwoTitle: "Pensamiento Hipotecario",
    architectureTwoText:
      "La capa profesional ayuda al equipo a razonar sobre estructura, encaje, elementos faltantes y la mejor siguiente acción.",
    architectureThreeTitle: "Ejecución de Workflow",
    architectureThreeText:
      "La capa de comando mantiene handoff, processing, bloqueos y visibilidad de cierre alineados desde la preaprobación hasta el funding.",
    footer:
      "Beyond Intelligence™ ayuda a organizar la orientación al cliente, el análisis hipotecario y la ejecución profesional del workflow bajo un sistema supervisado.",
    footerTag: "MultiLender Intelligence™",
  },
};

export default function HomePage() {
  const [language, setLanguage] = useState<SiteLanguage>("en");
  const t = HOME_COPY[language];

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
              <div style={styles.badge}>{t.badge}</div>
              <h1 className="bf-hero-title" style={styles.heroTitle}>
                {t.heroTitle}
              </h1>
              <p style={styles.heroText}>{t.heroText}</p>
            </div>

            <div style={styles.heroRightColumn}>
              <div style={styles.heroPanel}>
                <div style={styles.heroPanelTitle}>{t.structureTitle}</div>
                <div style={styles.heroPanelText}>{t.structureText}</div>
                <div style={styles.heroPanelList}>
                  {t.structureBullets.map((item) => (
                    <div key={item}>• {item}</div>
                  ))}
                </div>
              </div>

              <div style={styles.finleyPanel}>
                <div style={styles.finleyEyebrow}>{t.startHere}</div>
                <h2 className="bf-finley-title" style={styles.finleyTitle}>
                  {t.finleyTitle}
                </h2>
                <p style={styles.finleyText}>{t.finleyText}</p>

                <a href="/borrower" style={styles.finleyButton}>
                  {t.finleyButton}
                </a>

                <div style={styles.finleySubtext}>{t.finleySubtext}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bf-main-grid" style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardEyebrow}>{t.borrowerEyebrow}</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              {t.borrowerTitle}
            </h2>
            <p style={styles.cardText}>{t.borrowerText}</p>

            <div style={styles.cardList}>
              {t.borrowerBullets.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>

            <div style={styles.cardActions}>
              <a href="/borrower" style={styles.primaryAction}>
                {t.borrowerAction}
              </a>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardEyebrow}>{t.teamEyebrow}</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              {t.teamTitle}
            </h2>
            <p style={styles.cardText}>{t.teamText}</p>

            <div style={styles.cardList}>
              {t.teamBullets.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>

            <div style={styles.cardActions}>
              <a href="/team" style={styles.secondaryAction}>
                {t.teamAction}
              </a>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardEyebrow}>{t.workflowEyebrow}</div>
            <h2 className="bf-card-title" style={styles.cardTitle}>
              {t.workflowTitle}
            </h2>
            <p style={styles.cardText}>{t.workflowText}</p>

            <div style={styles.cardList}>
              {t.workflowBullets.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>

            <div style={styles.cardActions}>
              <a href="/workflow" style={styles.outlineAction}>
                {t.workflowAction}
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
              <div style={styles.architectureItemTitle}>
                {t.architectureOneTitle}
              </div>
              <div style={styles.architectureItemText}>
                {t.architectureOneText}
              </div>
            </div>

            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>
                {t.architectureTwoTitle}
              </div>
              <div style={styles.architectureItemText}>
                {t.architectureTwoText}
              </div>
            </div>

            <div style={styles.architectureItem}>
              <div style={styles.architectureItemTitle}>
                {t.architectureThreeTitle}
              </div>
              <div style={styles.architectureItemText}>
                {t.architectureThreeText}
              </div>
            </div>
          </div>
        </section>

        <div style={styles.footer}>
          {t.footer}
          <div style={styles.footerTag}>{t.footerTag}</div>
        </div>
      </div>
    </main>
  );
}

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
  heroRightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
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
  finleyPanel: {
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  finleyEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.86)",
    marginBottom: 10,
  },
  finleyTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.08,
    fontWeight: 900,
    color: "#ffffff",
  },
  finleyText: {
    marginTop: 12,
    marginBottom: 18,
    color: "rgba(255,255,255,0.95)",
    fontSize: 15,
    lineHeight: 1.7,
  },
  finleyButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    width: "100%",
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    color: "#263366",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 16,
    boxShadow: "0 14px 24px rgba(15,23,42,0.14)",
  },
  finleySubtext: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.82)",
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

    .bf-finley-title {
      font-size: 24px !important;
    }
  }
`;
