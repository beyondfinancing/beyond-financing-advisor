// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     app/components/AdminNav.tsx
//
// =============================================================================
//
// Reusable header dropdown for navigating between admin pages. Drop it into
// any admin page right after <SiteHeader />:
//
//     import AdminNav from "@/app/components/AdminNav";
//     ...
//     <SiteHeader variant="admin" language={language} onLanguageChange={setLanguage} />
//     <AdminNav language={language} />
//     <section style={styles.hero}>...</section>
//
// The dropdown auto-detects the current page via usePathname() and highlights
// the matching item. To add more admin pages, append to ADMIN_ROUTES below
// and add the labels to COPY.
// =============================================================================

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteLanguage } from "@/app/components/site-header-translations";

type AdminRouteKey =
  | "manageUsers"
  | "manageLenders"
  | "managePrograms"
  | "manageAgencyGuidelines"
  | "manageFiles";

type AdminRoute = {
  path: string;
  labelKey: AdminRouteKey;
};

// Add new admin pages here. Path must match the actual Next.js route.
const ADMIN_ROUTES: AdminRoute[] = [
  { path: "/admin", labelKey: "manageUsers" },
  { path: "/admin/lenders", labelKey: "manageLenders" },
  { path: "/admin/programs", labelKey: "managePrograms" },
  { path: "/admin/agency-guidelines", labelKey: "manageAgencyGuidelines" },
  { path: "/admin/files", labelKey: "manageFiles" },
];

type RouteCopy = {
  pickerLabel: string;
  manageUsers: string;
  manageLenders: string;
  managePrograms: string;
  manageAgencyGuidelines: string;
  manageFiles: string;
};

const COPY: Record<SiteLanguage, RouteCopy> = {
  en: {
    pickerLabel: "Admin Pages",
    manageUsers: "Manage Users",
    manageLenders: "Manage Lenders",
    managePrograms: "Manage Programs",
    manageAgencyGuidelines: "Manage Agency Guidelines",
    manageFiles: "Manage Files",
  },
  pt: {
    pickerLabel: "Páginas de Administração",
    manageUsers: "Gerenciar Usuários",
    manageLenders: "Gerenciar Credores",
    managePrograms: "Gerenciar Programas",
    manageAgencyGuidelines: "Gerenciar Diretrizes da Agência",
    manageFiles: "Gerenciar Arquivos",
  },
  es: {
    pickerLabel: "Páginas de Administración",
    manageUsers: "Administrar Usuarios",
    manageLenders: "Administrar Prestamistas",
    managePrograms: "Administrar Programas",
    manageAgencyGuidelines: "Administrar Directrices de la Agencia",
    manageFiles: "Administrar Archivos",
  },
};

type Props = {
  language?: SiteLanguage;
};

export default function AdminNav({ language = "en" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const t = COPY[language] || COPY.en;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Resolve the label for the current page
  const currentMatch = ADMIN_ROUTES.find((r) => r.path === pathname);
  const currentLabel = currentMatch ? t[currentMatch.labelKey] : t.pickerLabel;

  return (
    <div style={styles.bar}>
      <style>{responsiveCss}</style>
      <div className="bf-admin-nav" style={styles.barInner}>
        <div ref={wrapRef} style={styles.dropdownWrap}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              ...styles.button,
              ...(open ? styles.buttonOpen : {}),
            }}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <span style={styles.buttonEyebrow}>{t.pickerLabel}</span>
            <span style={styles.buttonLabel}>{currentLabel}</span>
            <span
              style={{
                ...styles.chevron,
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-hidden
            >
              ▼
            </span>
          </button>

          {open && (
            <div style={styles.menu} role="menu">
              {ADMIN_ROUTES.map((r) => {
                const isActive = r.path === pathname;
                return (
                  <Link
                    key={r.path}
                    href={r.path}
                    onClick={() => setOpen(false)}
                    style={{
                      ...styles.menuItem,
                      ...(isActive ? styles.menuItemActive : {}),
                    }}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span>{t[r.labelKey]}</span>
                    {isActive && <span style={styles.activeMark}>●</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  bar: {
    width: "100%",
    background: "linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%)",
    border: "1px solid #d6e2ed",
    borderRadius: 14,
    padding: "10px 14px",
    marginBottom: 16,
    boxShadow: "0 2px 6px rgba(36,63,124,0.04)",
  },
  barInner: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  dropdownWrap: {
    position: "relative",
    display: "inline-block",
  },
  button: {
    background: "#ffffff",
    color: "#243F7C",
    border: "1.5px solid #c5d1de",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    minWidth: 280,
    justifyContent: "flex-start",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
  },
  buttonOpen: {
    borderColor: "#0096C7",
    boxShadow: "0 0 0 3px rgba(0,150,199,0.12)",
  },
  buttonEyebrow: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#5CB2D8",
  },
  buttonLabel: {
    flex: 1,
    color: "#243F7C",
  },
  chevron: {
    fontSize: 9,
    color: "#5CB2D8",
    transition: "transform 0.15s ease",
  },
  menu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 320,
    background: "#ffffff",
    border: "1px solid #c5d1de",
    borderRadius: 10,
    boxShadow: "0 10px 28px rgba(36,63,124,0.15)",
    overflow: "hidden",
    zIndex: 30,
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 16px",
    fontSize: 14,
    color: "#243F7C",
    textDecoration: "none",
    background: "transparent",
    cursor: "pointer",
    borderBottom: "1px solid #eef2f7",
    transition: "background 0.1s ease",
    fontWeight: 500,
  },
  menuItemActive: {
    background: "#243F7C",
    color: "#ffffff",
    fontWeight: 700,
  },
  activeMark: {
    fontSize: 8,
    color: "#5CB2D8",
  },
};

// -----------------------------------------------------------------------------
// Responsive CSS — handles :hover and small screens since inline styles can't.
// -----------------------------------------------------------------------------

const responsiveCss = `
  .bf-admin-nav button:hover {
    background: #f0f7fc;
    border-color: #5CB2D8;
  }
  .bf-admin-nav [role="menuitem"]:not([aria-current="page"]):hover {
    background: #f0f7fc;
  }
  .bf-admin-nav [role="menuitem"]:last-child {
    border-bottom: none;
  }
  @media (max-width: 600px) {
    .bf-admin-nav {
      justify-content: stretch !important;
    }
    .bf-admin-nav button {
      min-width: 0;
      width: 100%;
    }
    .bf-admin-nav [role="menu"] {
      left: 0;
      right: 0;
      min-width: 0;
    }
  }
`;
