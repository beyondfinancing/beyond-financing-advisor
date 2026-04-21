"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type LanguageCode = "en" | "pt" | "es";

const COPY = {
  en: {
    title: "Reset Team Password",
    subtitle:
      "Create a new secure password for your Beyond Intelligence™ team workspace.",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    updatePassword: "Update Password",
    updating: "Updating...",
    loading: "Loading reset form...",
    missingToken: "Missing reset token.",
    passwordTooShort: "Password must be at least 8 characters.",
    passwordMismatch: "Passwords do not match.",
    resetFailed: "Password reset failed.",
    success: "Password updated successfully. Return to /team and sign in.",
  },
  pt: {
    title: "Redefinir Senha da Equipe",
    subtitle:
      "Crie uma nova senha segura para seu workspace da equipe Beyond Intelligence™.",
    newPassword: "Nova Senha",
    confirmPassword: "Confirmar Senha",
    updatePassword: "Atualizar Senha",
    updating: "Atualizando...",
    loading: "Carregando formulário de redefinição...",
    missingToken: "Token de redefinição ausente.",
    passwordTooShort: "A senha deve ter pelo menos 8 caracteres.",
    passwordMismatch: "As senhas não coincidem.",
    resetFailed: "Falha ao redefinir a senha.",
    success: "Senha atualizada com sucesso. Volte para /team e faça login.",
  },
  es: {
    title: "Restablecer Contraseña del Equipo",
    subtitle:
      "Cree una nueva contraseña segura para su workspace del equipo Beyond Intelligence™.",
    newPassword: "Nueva Contraseña",
    confirmPassword: "Confirmar Contraseña",
    updatePassword: "Actualizar Contraseña",
    updating: "Actualizando...",
    loading: "Cargando formulario de restablecimiento...",
    missingToken: "Falta el token de restablecimiento.",
    passwordTooShort: "La contraseña debe tener al menos 8 caracteres.",
    passwordMismatch: "Las contraseñas no coinciden.",
    resetFailed: "No se pudo restablecer la contraseña.",
    success: "Contraseña actualizada con éxito. Regrese a /team e inicie sesión.",
  },
} as const;

function detectLanguageFromBrowser(): LanguageCode {
  if (typeof window === "undefined") return "en";

  const raw = (window.navigator.language || "en").toLowerCase();

  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("es")) return "es";
  return "en";
}

function TeamResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [language] = useState<LanguageCode>(detectLanguageFromBrowser());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const t = COPY[language];

  const passwordStrength = useMemo(() => {
    if (!password) return "";

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return "Weak";
    if (score <= 4) return "Moderate";
    return "Strong";
  }, [password]);

  const handleSubmit = async () => {
    if (!token) {
      setStatus(t.missingToken);
      return;
    }

    if (password.length < 8) {
      setStatus(t.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setStatus(t.passwordMismatch);
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/team-auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data?.error || t.resetFailed);
        return;
      }

      setStatus(t.success);
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        window.location.href = "/team";
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>Beyond Intelligence™</div>
          <h1 style={styles.heroTitle}>{t.title}</h1>
          <p style={styles.heroText}>{t.subtitle}</p>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>{t.newPassword}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          {passwordStrength ? (
            <div style={styles.strengthText}>Password strength: {passwordStrength}</div>
          ) : null}

          <label style={{ ...styles.label, marginTop: 16 }}>{t.confirmPassword}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? t.updating : t.updatePassword}
          </button>

          {status ? (
            <div
              style={
                status === t.success ? styles.successBox : styles.infoBox
              }
            >
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function TeamResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.page}>
          <div style={styles.wrap}>
            <div style={styles.hero}>
              <div style={styles.eyebrow}>Beyond Intelligence™</div>
              <h1 style={styles.heroTitle}>Reset Team Password</h1>
              <p style={styles.heroText}>Loading reset form...</p>
            </div>
          </div>
        </main>
      }
    >
      <TeamResetPasswordInner />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F3F6FB",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
    padding: 24,
  },
  wrap: {
    maxWidth: 680,
    margin: "0 auto",
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
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
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
  primaryButton: {
    marginTop: 20,
    border: "none",
    borderRadius: 14,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 800,
    fontSize: 14,
    boxShadow: "0 10px 20px rgba(38,51,102,0.15)",
  },
  infoBox: {
    marginTop: 16,
    backgroundColor: "#F8FBFF",
    border: "1px solid #DBEAFE",
    color: "#1E3A8A",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  successBox: {
    marginTop: 16,
    backgroundColor: "#ECFDF3",
    border: "1px solid #BBF7D0",
    color: "#166534",
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.6,
    fontSize: 14,
  },
  strengthText: {
    marginTop: 8,
    fontSize: 13,
    color: "#475569",
  },
};
