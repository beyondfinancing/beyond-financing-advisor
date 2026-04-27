// =============================================================================
// PASTE THIS FILE AT (this is a NEW file):
//
//     app/components/TeamLoginCard.tsx
//
// =============================================================================
//
// PURPOSE
//
// This is the shared login + forgot-password block extracted from the prior
// inline implementation that lived in app/team/page.tsx. Both /team and
// /workflow now import this component so there is exactly one source of
// truth for the professional authentication UI.
//
// BEHAVIOR
//
// - Calls /api/team-auth/login on submit
// - Calls /api/team-auth/me after successful login (the parent re-checks)
// - Calls /api/team-auth/request-reset on the forgot-password flow
// - Always shows a generic success message on reset request, regardless of
//   whether the email is on file (anti-enumeration)
//
// ON SUCCESSFUL LOGIN
//
// The component calls onLoginSuccess() so the parent page can re-fetch its
// auth state and re-render with the authenticated user.
//
// PROPS
//
// - language: SiteLanguage — for multilingual COPY
// - variantLabel: short string shown above the form ("Workflow" or "Team")
// - showQuickActions: optional, defaults to true; renders the 3 quick-link
//   buttons under the form. /workflow can hide them or override them.
// - onLoginSuccess: callback fired after a successful login round-trip
//
// =============================================================================

"use client";

import React, { useState } from "react";
import { SiteLanguage } from "@/app/components/site-header-translations";

type CopyShape = {
  loginTitle: string;
  loginText: string;
  emailOrNmls: string;
  password: string;
  signIn: string;
  signingIn: string;
  forgotPassword: string;
  forgotTitle: string;
  forgotText: string;
  resetEmail: string;
  sendResetLink: string;
  sending: string;
  backToSignIn: string;
  forgotSubmitted: string;
  invalidLogin: string;
  requestFailed: string;
  goHome: string;
  openBorrower: string;
  openTeam: string;
  openWorkflow: string;
};

const COPY: Record<SiteLanguage, CopyShape> = {
  en: {
    loginTitle: "Professional Sign-In Required",
    loginText:
      "Sign in with your team email or NMLS number and password to continue.",
    emailOrNmls: "Email or NMLS #",
    password: "Password",
    signIn: "Sign In",
    signingIn: "Signing in...",
    forgotPassword: "Forgot password?",
    forgotTitle: "Reset Your Password",
    forgotText:
      "Enter your team email below. If your account exists, you will receive a reset link.",
    resetEmail: "Email",
    sendResetLink: "Send Reset Link",
    sending: "Sending...",
    backToSignIn: "Back to sign-in",
    forgotSubmitted:
      "If your email is on file, you will receive a reset link within a few minutes. Check your inbox and spam folder.",
    invalidLogin: "Invalid credentials. Please try again.",
    requestFailed: "Request could not be completed. Please try again shortly.",
    goHome: "Back to Homepage",
    openBorrower: "Open Borrower Experience",
    openTeam: "Open Team Mortgage Intelligence",
    openWorkflow: "Open Workflow Intelligence",
  },
  pt: {
    loginTitle: "Login Profissional Necessário",
    loginText:
      "Entre com seu email da equipe ou número NMLS e senha para continuar.",
    emailOrNmls: "Email ou NMLS #",
    password: "Senha",
    signIn: "Entrar",
    signingIn: "Entrando...",
    forgotPassword: "Esqueceu a senha?",
    forgotTitle: "Redefinir Sua Senha",
    forgotText:
      "Insira seu email da equipe abaixo. Se sua conta existir, você receberá um link de redefinição.",
    resetEmail: "Email",
    sendResetLink: "Enviar Link de Redefinição",
    sending: "Enviando...",
    backToSignIn: "Voltar ao login",
    forgotSubmitted:
      "Se seu email estiver cadastrado, você receberá um link de redefinição em alguns minutos. Verifique sua caixa de entrada e spam.",
    invalidLogin: "Credenciais inválidas. Tente novamente.",
    requestFailed:
      "Não foi possível concluir a solicitação. Tente novamente em instantes.",
    goHome: "Voltar à Página Inicial",
    openBorrower: "Abrir Experiência do Cliente",
    openTeam: "Abrir Team Mortgage Intelligence",
    openWorkflow: "Abrir Workflow Intelligence",
  },
  es: {
    loginTitle: "Se Requiere Inicio de Sesión Profesional",
    loginText:
      "Inicie sesión con su correo del equipo o número NMLS y contraseña para continuar.",
    emailOrNmls: "Correo o NMLS #",
    password: "Contraseña",
    signIn: "Iniciar Sesión",
    signingIn: "Iniciando sesión...",
    forgotPassword: "¿Olvidó su contraseña?",
    forgotTitle: "Restablecer Contraseña",
    forgotText:
      "Ingrese su correo del equipo. Si su cuenta existe, recibirá un enlace para restablecer la contraseña.",
    resetEmail: "Correo Electrónico",
    sendResetLink: "Enviar Enlace de Restablecimiento",
    sending: "Enviando...",
    backToSignIn: "Volver al inicio de sesión",
    forgotSubmitted:
      "Si su correo está registrado, recibirá un enlace de restablecimiento en unos minutos. Revise su bandeja de entrada y spam.",
    invalidLogin: "Credenciales inválidas. Intente de nuevo.",
    requestFailed:
      "No se pudo completar la solicitud. Intente de nuevo en unos momentos.",
    goHome: "Volver al Inicio",
    openBorrower: "Abrir Experiencia del Cliente",
    openTeam: "Abrir Team Mortgage Intelligence",
    openWorkflow: "Abrir Workflow Intelligence",
  },
};

type Props = {
  language: SiteLanguage;
  variantLabel?: string;
  showQuickActions?: boolean;
  quickActionsTarget?: "team" | "workflow";
  onLoginSuccess?: () => void | Promise<void>;
};

export default function TeamLoginCard({
  language,
  variantLabel,
  showQuickActions = true,
  quickActionsTarget = "team",
  onLoginSuccess,
}: Props) {
  const t = COPY[language];

  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const handleSignIn = async () => {
    if (!credential.trim() || !password) return;
    setSigningIn(true);
    setSignInError("");

    try {
      const res = await fetch("/api/team-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credential.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setSignInError(data?.error || t.invalidLogin);
        return;
      }

      setPassword("");
      setCredential("");

      if (onLoginSuccess) {
        await onLoginSuccess();
      }
    } catch {
      setSignInError(t.invalidLogin);
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) return;
    setForgotLoading(true);
    setForgotMessage("");

    try {
      const res = await fetch("/api/team-auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      // Always show the generic success message regardless of whether the
      // email actually exists. Anti-enumeration.
      if (res.ok) {
        setForgotMessage(t.forgotSubmitted);
      } else {
        setForgotMessage(t.requestFailed);
      }
    } catch {
      setForgotMessage(t.requestFailed);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={styles.loginCard}>
      {variantLabel ? (
        <div style={styles.variantLabel}>{variantLabel}</div>
      ) : null}

      {!showForgot ? (
        <>
          <h2 style={styles.sectionTitle}>{t.loginTitle}</h2>
          <p style={styles.sectionText}>{t.loginText}</p>

          <div style={styles.formColumn}>
            <label style={styles.label}>{t.emailOrNmls}</label>
            <input
              type="text"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              style={styles.input}
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSignIn();
              }}
            />

            <label style={{ ...styles.label, marginTop: 14 }}>
              {t.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSignIn();
              }}
            />

            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              style={{
                ...styles.primaryButton,
                opacity: signingIn ? 0.7 : 1,
                cursor: signingIn ? "not-allowed" : "pointer",
                marginTop: 18,
              }}
            >
              {signingIn ? t.signingIn : t.signIn}
            </button>

            {signInError ? (
              <div style={styles.errorBox}>{signInError}</div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setShowForgot(true);
                setSignInError("");
                setForgotMessage("");
                setForgotEmail("");
              }}
              style={styles.linkButton}
            >
              {t.forgotPassword}
            </button>
          </div>

          {showQuickActions ? (
            <>
              <div style={styles.dividerRow} />

              <div style={styles.quickActionRow}>
                <a href="/" style={styles.secondaryLinkButton}>
                  {t.goHome}
                </a>
                <a href="/borrower" style={styles.secondaryLinkButton}>
                  {t.openBorrower}
                </a>
                {quickActionsTarget === "workflow" ? (
                  <a href="/team" style={styles.secondaryLinkButton}>
                    {t.openTeam}
                  </a>
                ) : (
                  <a href="/workflow" style={styles.secondaryLinkButton}>
                    {t.openWorkflow}
                  </a>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <h2 style={styles.sectionTitle}>{t.forgotTitle}</h2>
          <p style={styles.sectionText}>{t.forgotText}</p>

          <div style={styles.formColumn}>
            <label style={styles.label}>{t.resetEmail}</label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              style={styles.input}
              autoComplete="email"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleForgotSubmit();
              }}
            />

            <button
              type="button"
              onClick={handleForgotSubmit}
              disabled={forgotLoading}
              style={{
                ...styles.primaryButton,
                opacity: forgotLoading ? 0.7 : 1,
                cursor: forgotLoading ? "not-allowed" : "pointer",
                marginTop: 18,
              }}
            >
              {forgotLoading ? t.sending : t.sendResetLink}
            </button>

            {forgotMessage ? (
              <div style={styles.successBox}>{forgotMessage}</div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setShowForgot(false);
                setForgotEmail("");
                setForgotMessage("");
              }}
              style={styles.linkButton}
            >
              {t.backToSignIn}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loginCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
    maxWidth: 760,
    margin: "0 auto",
  },
  variantLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    color: "#2D3B78",
    fontWeight: 900,
  },
  sectionText: {
    marginTop: 12,
    marginBottom: 12,
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.7,
    maxWidth: 920,
  },
  formColumn: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    marginBottom: 6,
    letterSpacing: 0.3,
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
  primaryButton: {
    border: "none",
    borderRadius: 14,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "0 10px 20px rgba(38,51,102,0.18)",
  },
  linkButton: {
    marginTop: 14,
    background: "transparent",
    border: "none",
    color: "#0284C7",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    padding: "6px 0",
    textAlign: "left",
    width: "fit-content",
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#991B1B",
    borderRadius: 14,
    padding: 12,
    lineHeight: 1.5,
    fontSize: 14,
  },
  successBox: {
    marginTop: 14,
    backgroundColor: "#ECFDF3",
    border: "1px solid #BBF7D0",
    color: "#166534",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  dividerRow: {
    height: 1,
    backgroundColor: "#E5ECF5",
    margin: "26px 0 18px",
  },
  quickActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
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

