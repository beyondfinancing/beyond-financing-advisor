export type SiteLanguage = "en" | "pt" | "es";
export type HeaderVariant = "home" | "borrower" | "team" | "workflow" | "admin";

export type SiteHeaderCopy = {
  brand: string;
  home: string;
  borrower: string;
  team: string;
  workflow: string;
  admin: string;
  language: string;
  english: string;
  portuguese: string;
  spanish: string;
};

export const SITE_HEADER_COPY: Record<SiteLanguage, SiteHeaderCopy> = {
  en: {
    brand: "Beyond Intelligence™",
    home: "Home",
    borrower: "Start as Borrower",
    team: "Team Workspace",
    workflow: "Workflow Intelligence",
    admin: "Admin Command",
    language: "Language",
    english: "English",
    portuguese: "Português",
    spanish: "Español",
  },
  pt: {
    brand: "Beyond Intelligence™",
    home: "Início",
    borrower: "Começar como Cliente",
    team: "Área da Equipe",
    workflow: "Workflow Intelligence",
    admin: "Comando Admin",
    language: "Idioma",
    english: "English",
    portuguese: "Português",
    spanish: "Español",
  },
  es: {
    brand: "Beyond Intelligence™",
    home: "Inicio",
    borrower: "Comenzar como Cliente",
    team: "Área del Equipo",
    workflow: "Workflow Intelligence",
    admin: "Comando Admin",
    language: "Idioma",
    english: "English",
    portuguese: "Português",
    spanish: "Español",
  },
};
