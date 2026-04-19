"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type BorrowerStatus =
  | ""
  | "citizen"
  | "permanent_resident"
  | "non_permanent_resident"
  | "itin_borrower"
  | "daca"
  | "foreign_national";

type OccupancyType =
  | ""
  | "primary_residence"
  | "second_home"
  | "investment_property";

type TransactionType =
  | ""
  | "purchase"
  | "rate_term_refinance"
  | "cash_out_refinance"
  | "second_lien";

type IncomeType =
  | ""
  | "full_doc"
  | "express_doc"
  | "bank_statements"
  | "1099"
  | "pnl"
  | "asset_utilization"
  | "dscr"
  | "no_ratio"
  | "wvoe";

type PropertyType =
  | ""
  | "single_family"
  | "condo"
  | "townhouse"
  | "2_unit"
  | "3_unit"
  | "4_unit"
  | "mixed_use"
  | "5_to_8_units";

type QualificationInput = {
  subject_state: string;
  borrower_status: BorrowerStatus;
  occupancy_type: OccupancyType;
  transaction_type: TransactionType;
  income_type: IncomeType;
  property_type: PropertyType;
  credit_score: string;
  ltv: string;
  dti: string;
  loan_amount: string;
  units: string;
  first_time_homebuyer: "" | "yes" | "no";
  available_reserves_months: string;
};

type MatchBucket = {
  lender_name?: string;
  lender_id?: string;
  program_name?: string;
  program_slug?: string;
  loan_category?: string | null;
  guideline_id?: string;
  notes?: string[] | null;
  missing_items?: string[] | null;
  blockers?: string[] | null;
  strengths?: string[] | null;
  concerns?: string[] | null;
  explanation?: string;
  score?: number;
  reserves_required_months?: number | null;
  required_reserves_months?: number | null;
};

type OpenAiEnhancement = {
  topRecommendation?: string;
  whyItMatches?: string[] | null;
  cautionItems?: string[] | null;
  nextBestQuestion?: string;
} | null;

type MatchResponse = {
  success: boolean;
  error?: string;
  next_question?: string;
  top_recommendation?: string;
  openai_enhancement?: OpenAiEnhancement;
  strong_matches?: MatchBucket[] | null;
  conditional_matches?: MatchBucket[] | null;
  eliminated_paths?: MatchBucket[] | null;
  lender_summary?: {
    active_lender_count?: number;
    active_lenders_checked?: string[];
    matched_lenders_in_results?: string[];
  } | null;
  summary?: {
    total_guidelines_checked?: number;
    strong_count?: number;
    conditional_count?: number;
    eliminated_count?: number;
  };
};

type ProfessionalSession = {
  isAuthenticated?: boolean;
  role?: string;
  name?: string;
  email?: string;
  nmls?: string;
  companyName?: string;
} | null;

type FinleyReasonResponse = {
  success?: boolean;
  reply?: string;
};

const PROFESSIONAL_LOGIN_PATH = "/team";
const BORROWER_MODE_PATH = "/borrower";
const PROFESSIONAL_SESSION_KEY = "beyond_professional_session";
const PROFESSIONAL_SUMMARY_API = "/api/chat-summary";

const initialForm: QualificationInput = {
  subject_state: "",
  borrower_status: "",
  occupancy_type: "",
  transaction_type: "",
  income_type: "",
  property_type: "",
  credit_score: "",
  ltv: "",
  dti: "",
  loan_amount: "",
  units: "",
  first_time_homebuyer: "",
  available_reserves_months: "",
};

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function labelize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseProfessionalSession(): ProfessionalSession {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PROFESSIONAL_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as
