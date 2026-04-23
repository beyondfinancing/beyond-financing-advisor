export type SiteLanguage = "en" | "pt" | "es";
export type HeaderVariant = "home" | "borrower" | "team" | "workflow";

export const SITE_HEADER_COPY: Record<
  SiteLanguage,
  {
    brand: string;
    home: string;
    borrower: string;
    team: string;
    workflow: string;
    language: string;
    english: string;
    portuguese: string;
    spanish: string;
  }
> = {
  en: {
    brand: "Beyond Intelligence™",
    home: "Home",
    borrower: "Start as Borrower",
    team: "Team Workspace",
    workflow: "Workflow Intelligence",
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
    workflow: "Inteligência de Workflow",
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
    workflow: "Inteligencia de Workflow",
    language: "Idioma",
    english: "English",
    portuguese: "Português",
    spanish: "Español",
  },
};
