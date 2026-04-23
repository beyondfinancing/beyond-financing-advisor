"use client";

import React, { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
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
  nmls?: string;
  role: TeamRole;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
};

const COPY: Record<
  SiteLanguage,
  {
    title: string;
    subtitle: string;
    protectedAccess: string;
    protectedText: string;
    loadingText: string;
    loginTitle: string;
    loginText: string;
    goHome: string;
    openBorrower: string;
    openWorkflow: string;
    signedInAs: string;
    roleLabel: string;
    commandPurpose: string;
    purposeItems: string[];
    moduleTitle: string;
    moduleOneTitle: string;
    moduleOneText: string;
    moduleTwoTitle: string;
    moduleTwoText: string;
    moduleThreeTitle: string;
    moduleThreeText: string;
    quickActions: string;
    signOut: string;
    accessStatus: string;
  }
> = {
  en: {
    title: "Beyond Intelligence™ Team Mortgage Intelligence",
    subtitle:
      "Protected professional workspace for internal mortgage analysis, team coordination, and platform command.",
    protectedAccess: "PROTECTED PROFESSIONAL ACCESS",
    protectedText:
      "This area is reserved for authenticated team users working inside Beyond Intelligence™.",
    loadingText: "Loading protected workspace...",
    loginTitle: "Professional Sign-In Required",
    loginText:
      "Please sign in through your protected team access to continue into Team Mortgage Intelligence.",
    goHome: "Back to Homepage",
    openBorrower: "Open Borrower Experience",
    openWorkflow: "Open Workflow Intelligence",
    signedInAs: "Signed in as",
    roleLabel: "Role",
    commandPurpose: "COMMAND PURPOSE",
    purposeItems: [
      "Review borrower direction before full file movement.",
      "Keep internal mortgage thinking structured and consistent.",
      "Bridge borrower interaction and workflow execution.",
      "Support cleaner loan officer and team decision-making.",
    ],
    moduleTitle: "Workspace modules",
    moduleOneTitle: "Borrower Intelligence Bridge",
    moduleOneText:
      "Move into the borrower experience when you need to view or reference the client-facing intake path and Finley interaction layer.",
    moduleTwoTitle: "Workflow Intelligence Bridge",
    moduleTwoText:
      "Move into workflow command when the file needs execution visibility, handoff, status control, or processing coordination.",
    moduleThreeTitle: "Professional Thinking Layer",
    moduleThreeText:
      "Use this environment as the protected intelligence layer between borrower interaction and operational workflow.",
    quickActions: "Quick actions",
    signOut: "Sign Out",
    accessStatus: "Protected access confirmed.",
  },
  pt: {
    title: "Beyond Intelligence™ Team Mortgage Intelligence",
    subtitle:
      "Área profissional protegida para análise hipotecária interna, coordenação da equipe e comando da plataforma.",
    protectedAccess: "ACESSO PROFISSIONAL PROTEGIDO",
    protectedText:
      "Esta área é reservada para usuários autenticados da equipe que trabalham dentro do Beyond Intelligence™.",
    loadingText: "Carregando área protegida...",
    loginTitle: "Login Profissional Necessário",
    loginText:
      "Faça login por meio do acesso protegido da equipe para continuar no Team Mortgage Intelligence.",
    goHome: "Voltar à Página Inicial",
    openBorrower: "Abrir Experiência do Cliente",
    openWorkflow: "Abrir Workflow Intelligence",
    signedInAs: "Conectado como",
    roleLabel: "Função",
    commandPurpose: "PROPÓSITO DO COMANDO",
    purposeItems: [
      "Revisar a direção do cliente antes do movimento completo do arquivo.",
      "Manter o raciocínio hipotecário interno estruturado e consistente.",
      "Conectar a interação com o cliente à execução do workflow.",
      "Apoiar decisões mais limpas do loan officer e da equipe.",
    ],
    moduleTitle: "Módulos da área",
    moduleOneTitle: "Ponte com Borrower Intelligence",
    moduleOneText:
      "Entre na experiência do cliente quando precisar visualizar ou referenciar o intake e a camada de interação com Finley.",
    moduleTwoTitle: "Ponte com Workflow Intelligence",
    moduleTwoText:
      "Entre no comando de workflow quando o arquivo precisar de visibilidade operacional, handoff, controle de status ou coordenação com processing.",
    moduleThreeTitle: "Camada de Raciocínio Profissional",
    moduleThreeText:
      "Use este ambiente como a camada protegida de inteligência entre a interação com o cliente e o workflow operacional.",
    quickActions: "Ações rápidas",
    signOut: "Sair",
    accessStatus: "Acesso protegido confirmado.",
  },
  es: {
    title: "Beyond Intelligence™ Team Mortgage Intelligence",
    subtitle:
      "Área profesional protegida para análisis hipotecario interno, coordinación del equipo y comando de la plataforma.",
    protectedAccess: "ACCESO PROFESIONAL PROTEGIDO",
    protectedText:
      "Esta área está reservada para usuarios autenticados del equipo que trabajan dentro de Beyond Intelligence™.",
    loadingText: "Cargando área protegida...",
    loginTitle: "Se Requiere Inicio de Sesión Profesional",
    loginText:
      "Inicie sesión a través del acceso protegido del equipo para continuar en Team Mortgage Intelligence.",
    goHome: "Volver al Inicio",
    openBorrower: "Abrir Experiencia del Cliente",
    openWorkflow: "Abrir Workflow Intelligence",
    signedInAs: "Conectado como",
    roleLabel: "Rol",
    commandPurpose: "PROPÓSITO DEL COMANDO",
    purposeItems: [
      "Revisar la dirección del cliente antes del movimiento completo del archivo.",
      "Mantener el pensamiento hipotecario interno estructurado y consistente.",
      "Conectar la interacción con el cliente con la ejecución del workflow.",
      "Apoyar decisiones más limpias del loan officer y del equipo.",
    ],
    moduleTitle: "Módulos del área",
    moduleOneTitle: "Puente con Borrower Intelligence",
    moduleOneText:
      "Entre en la experiencia del cliente cuando necesite ver o referenciar el intake y la capa de interacción con Finley.",
    moduleTwoTitle: "Puente con Workflow Intelligence",
    moduleTwoText:
      "Entre en el comando de workflow cuando el archivo necesite visibilidad operativa, handoff, control de estado o coordinación con processing.",
    moduleThreeTitle: "Capa de Pensamiento Profesional",
    moduleThreeText:
      "Utilice este entorno como la capa protegida de inteligencia entre la interacción con el cliente y el workflow operativo.",
    quickActions: "Acciones rápidas",
    signOut: "Cerrar sesión",
    accessStatus: "Acceso protegido confirmado.",
  },
};

export default function TeamPage() {
  const [language, setLanguage] = useState<SiteLanguage>("en");
  const [activeUser, setActiveUser] = useState<TeamUser | null>(null);
  const [loading, setLoading] = useState(true);

  const t = COPY[language];

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/team-auth/me");

        if (response.ok) {
          const data = await response.json();
          if (data?.authenticated && data?.user) {
            setActiveUser(data.user);
          }
        }
      } catch {
        // no-op
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/team-auth/logout", { method: "POST" });
    setActiveUser(null);
    window.location.href = "/team";
  };

  const initials = useMemo(() => {
    if (!activeUser?.name) return "BI";
    return activeUser.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [activeUser]);

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <SiteHeader
          variant="team"
          language={language}
          onLanguageChange={setLanguage}
        />

        {loading ? (
          <section style={styles.hero}>
            <div style={styles.heroBadge}>{t.protectedAccess}</div>
            <h1 style={styles.heroTitle}>{t.title}</h1>
            <p style={styles.heroText}>{t.loadingText}</p>
          </section>
        ) : !activeUser ? (
          <>
            <section style={styles.hero}>
              <div style={styles.heroBadge}>{t.protectedAccess}</div>
              <h1 style={styles.heroTitle}>{t.title}</h1>
              <p style={styles.heroText}>{t.subtitle}</p>
            </section>

            <div style={styles.loginCard}>
              <h2 style={styles.sectionTitle}>{t.loginTitle}</h2>
              <p style={styles.sectionText}>{t.loginText}</p>

              <div style={styles.quickActionRow}>
                <a href="/" style={styles.primaryLinkButton}>
                  {t.goHome}
                </a>
                <a href="/borrower" style={styles.secondaryLinkButton}>
                  {t.openBorrower}
                </a>
                <a href="/workflow" style={styles.secondaryLinkButton}>
                  {t.openWorkflow}
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <section style={styles.hero}>
              <div className="bf-team-hero-grid" style={styles.heroGrid}>
                <div>
                  <div style={styles.heroBadge}>{t.protectedAccess}</div>
                  <h1 style={styles.heroTitle}>{t.title}</h1>
                  <p style={styles.heroText}>{t.subtitle}</p>
                </div>

                <div style={styles.heroRightColumn}>
                  <div style={styles.userBadge}>
                    <div style={styles.userIdentityRow}>
                      <div style={styles.userInitials}>{initials}</div>
                      <div>
                        <div style={styles.userBadgeTitle}>
                          {t.signedInAs}: {activeUser.name}
                        </div>
                        <div style={styles.userBadgeSubtext}>
                          {t.roleLabel}: {activeUser.role} · {activeUser.email}
                        </div>
                      </div>
                    </div>

                    <div style={styles.statusPill}>{t.accessStatus}</div>
                  </div>

                  <div style={styles.heroPanel}>
                    <div style={styles.heroPanelTitle}>{t.commandPurpose}</div>
                    <div style={styles.heroPanelList}>
                      {t.purposeItems.map((item) => (
                        <div key={item}>• {item}</div>
                      ))}
                    </div>
                  </div>

                  <button type="button" onClick={handleSignOut} style={styles.signOutButton}>
                    {t.signOut}
                  </button>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionEyebrow}>{t.moduleTitle}</div>

              <div className="bf-module-grid" style={styles.moduleGrid}>
                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>{t.moduleOneTitle}</div>
                  <div style={styles.moduleText}>{t.moduleOneText}</div>
                  <a href="/borrower" style={styles.moduleAction}>
                    {t.openBorrower}
                  </a>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>{t.moduleTwoTitle}</div>
                  <div style={styles.moduleText}>{t.moduleTwoText}</div>
                  <a href="/workflow" style={styles.moduleActionAlt}>
                    {t.openWorkflow}
                  </a>
                </div>

                <div style={styles.moduleCard}>
                  <div style={styles.moduleTitle}>{t.moduleThreeTitle}</div>
                  <div style={styles.moduleText}>{t.moduleThreeText}</div>
                  <div style={styles.moduleStaticTag}>Beyond Intelligence™</div>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionEyebrow}>{t.quickActions}</div>
              <div style={styles.quickActionRow}>
                <a href="/" style={styles.secondaryLinkButton}>
                  {t.goHome}
                </a>
                <a href="/borrower" style={styles.primaryLinkButton}>
                  {t.openBorrower}
                </a>
                <a href="/workflow" style={styles.secondaryLinkButton}>
                  {t.openWorkflow}
                </a>
              </div>
            </section>
          </>
        )}
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

  @media (max-width: 1080px) {
    .bf-team-hero-grid,
    .bf-module-grid {
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
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 28,
    color: "#ffffff",
    boxShadow: "0 18px 40px rgba(38,51,102,0.18)",
    marginBottom: 20,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 22,
    alignItems: "start",
  },
  heroRightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  heroBadge: {
    display: "inline-block",
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: 900,
    backgroundColor: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: "10px 14px",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontWeight: 900,
    fontSize: 52,
    lineHeight: 0.98,
  },
  heroText: {
    marginTop: 18,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.75,
    color: "rgba(255,255,255,0.95)",
    maxWidth: 840,
  },
  userBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 24,
    padding: 18,
  },
  userIdentityRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  userInitials: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 18,
  },
  userBadgeTitle: {
    fontWeight: 900,
    fontSize: 15,
    marginBottom: 4,
    color: "#ffffff",
  },
  userBadgeSubtext: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.92)",
  },
  statusPill: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.2)",
    fontWeight: 800,
    fontSize: 12,
    color: "#ffffff",
  },
  heroPanel: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 18,
  },
  heroPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  heroPanelList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.95)",
  },
  signOutButton: {
    border: "1px solid rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    borderRadius: 16,
    padding: "14px 16px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 15,
  },
  loginCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 30,
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
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  moduleCard: {
    borderRadius: 24,
    border: "1px solid #D9E4F1",
    backgroundColor: "#F9FBFE",
    padding: 20,
    display: "flex",
    flexDirection: "column",
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 10,
    lineHeight: 1.1,
  },
  moduleText: {
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.7,
    marginBottom: 18,
  },
  moduleAction: {
    marginTop: "auto",
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  moduleActionAlt: {
    marginTop: "auto",
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#0096C7",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  moduleStaticTag: {
    marginTop: "auto",
    display: "inline-block",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    color: "#1D4ED8",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  quickActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryLinkButton: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  secondaryLinkButton: {
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
};
