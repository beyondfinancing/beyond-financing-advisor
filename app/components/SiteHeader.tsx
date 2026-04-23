"use client";

import Link from "next/link";
import React from "react";
import {
  HeaderVariant,
  SITE_HEADER_COPY,
  SiteHeaderCopy,
  SiteLanguage,
} from "./site-header-translations";

type Props = {
  variant: HeaderVariant;
  language: SiteLanguage;
  onLanguageChange: (value: SiteLanguage) => void;
};

type NavItem = {
  href: string;
  label: string;
};

function getNavItems(variant: HeaderVariant, copy: SiteHeaderCopy): NavItem[] {
  switch (variant) {
    case "borrower":
      return [
        { href: "/", label: copy.home },
        { href: "/admin", label: copy.admin },
      ];

    case "team":
      return [
        { href: "/", label: copy.home },
        { href: "/borrower", label: copy.borrower },
        { href: "/workflow", label: copy.workflow },
        { href: "/admin", label: copy.admin },
      ];

    case "workflow":
      return [
        { href: "/", label: copy.home },
        { href: "/borrower", label: copy.borrower },
        { href: "/team", label: copy.team },
        { href: "/admin", label: copy.admin },
      ];

    case "admin":
      return [
        { href: "/", label: copy.home },
        { href: "/borrower", label: copy.borrower },
        { href: "/team", label: copy.team },
        { href: "/workflow", label: copy.workflow },
      ];

    case "home":
    default:
      return [
        { href: "/borrower", label: copy.borrower },
        { href: "/team", label: copy.team },
        { href: "/workflow", label: copy.workflow },
        { href: "/admin", label: copy.admin },
      ];
  }
}

export default function SiteHeader({
  variant,
  language,
  onLanguageChange,
}: Props) {
  const copy = SITE_HEADER_COPY[language];
  const navItems = getNavItems(variant, copy);

  return (
    <nav style={styles.nav}>
      <Link href="/" style={styles.brand}>
        {copy.brand}
      </Link>

      <div
        style={{
          ...styles.rightGroup,
          minWidth: variant === "borrower" ? 430 : 620,
        }}
      >
        <div style={styles.navLinks}>
          {navItems.map((item) => (
            <Link
              key={`${variant}-${item.href}`}
              href={item.href}
              style={styles.navLink}
            >
              {item.label}
            </Link>
          ))}

          <div style={styles.languageWrap}>
            <label htmlFor="site-language" style={styles.screenReaderOnly}>
              {copy.language}
            </label>

            <div style={styles.selectPill}>
              <select
                id="site-language"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as SiteLanguage)}
                style={styles.select}
                aria-label={copy.language}
              >
                <option value="en">{copy.english}</option>
                <option value="pt">{copy.portuguese}</option>
                <option value="es">{copy.spanish}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

const pillBase: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 999,
  border: "1px solid #C9D5EA",
  backgroundColor: "#F7F9FD",
  color: "#263366",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1,
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  brand: {
    textDecoration: "none",
    color: "#263366",
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 0.2,
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  navLink: {
    ...pillBase,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "0 14px",
    whiteSpace: "nowrap",
  },
  languageWrap: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  selectPill: {
    ...pillBase,
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 12,
    minWidth: 170,
  },
  select: {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "#263366",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
    width: "100%",
    height: 42,
    cursor: "pointer",
    paddingRight: 18,
  },
  screenReaderOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};
