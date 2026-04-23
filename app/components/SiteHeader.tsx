"use client";

import Link from "next/link";
import React from "react";
import {
  HeaderVariant,
  SITE_HEADER_COPY,
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
  active?: boolean;
};

function getNavItems(
  variant: HeaderVariant,
  copy: (typeof SITE_HEADER_COPY)["en"]
): NavItem[] {
  switch (variant) {
    case "borrower":
      return [{ href: "/", label: copy.home }];
    case "team":
      return [
        { href: "/", label: copy.home },
        { href: "/borrower", label: copy.borrower },
        { href: "/workflow", label: copy.workflow },
      ];
    case "workflow":
      return [
        { href: "/", label: copy.home },
        { href: "/borrower", label: copy.borrower },
        { href: "/team", label: copy.team },
      ];
    case "home":
    default:
      return [
        { href: "/borrower", label: copy.borrower },
        { href: "/team", label: copy.team },
        { href: "/workflow", label: copy.workflow },
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

      <div style={styles.rightGroup}>
        <div style={styles.languageWrap}>
          <label htmlFor="site-language" style={styles.languageLabel}>
            {copy.language}
          </label>
          <select
            id="site-language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as SiteLanguage)}
            style={styles.select}
          >
            <option value="en">{copy.english}</option>
            <option value="pt">{copy.portuguese}</option>
            <option value="es">{copy.spanish}</option>
          </select>
        </div>

        <div style={styles.navLinks}>
          {navItems.map((item) => (
            <Link key={`${variant}-${item.href}`} href={item.href} style={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

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
  languageWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  languageLabel: {
    color: "#526581",
    fontSize: 13,
    fontWeight: 800,
  },
  select: {
    borderRadius: 999,
    border: "1px solid #C9D5EA",
    backgroundColor: "#F7F9FD",
    color: "#263366",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 800,
    outline: "none",
  },
  navLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  navLink: {
    textDecoration: "none",
    color: "#263366",
    backgroundColor: "#F7F9FD",
    border: "1px solid #C9D5EA",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
  },
};
