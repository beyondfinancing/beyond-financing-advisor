import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type WorkflowStatus =
  | "new_scenario"
  | "pre_approval_review"
  | "sent_to_processing"
  | "processing_active"
  | "submitted_to_lender"
  | "conditional_approval"
  | "clear_to_close"
  | "closed";

type BorrowerPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  credit?: string;
  income?: string;
  debt?: string;
  currentState?: string;
  targetState?: string;
  transactionType?: string;
  realtorStatus?: string;
  realtorName?: string;
  realtorPhone?: string;
};

type ScenarioPayload = {
  homePrice?: string;
  downPayment?: string;
  estimatedLoanAmount?: string;
  estimatedLtv?: string;
  occupancy?: string;
};

type OfficerPayload = {
  id?: string;
  name?: string;
  nmls?: string;
  email?: string;
  assistantEmail?: string;
  mobile?: string;
  assistantMobile?: string;
  applyUrl?: string;
  scheduleUrl?: string;
  role?: string;
  companyName?: string;
};

type RequestBody = {
  borrower?: BorrowerPayload;
  scenario?: ScenarioPayload;
  selectedOfficer?: OfficerPayload | null;
  source?: string;
  status?: WorkflowStatus;
  notes?: string;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function safeJsonObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => {
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return v.trim().length > 0;
      return true;
    })
  );
}

function buildBorrowerDisplayName(borrower: BorrowerPayload) {
  return normalizeString(borrower.fullName) || "Unknown Borrower";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const borrower = body.borrower || {};
    const scenario = body.scenario || {};
    const selectedOfficer = body.selectedOfficer || null;

    const borrowerName = buildBorrowerDisplayName(borrower);
    const borrowerEmail = normalizeEmail(borrower.email);
    const source = normalizeString(body.source) || "borrower_intake";
    const status: WorkflowStatus = body.status || "new_scenario";
    const notes = normalizeString(body.notes);

    if (!borrowerName || !borrowerEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Borrower full name and email are required.",
        },
        { status: 400 }
      );
    }

    const officerEmail = normalizeEmail(selectedOfficer?.email);
    const officerName = normalizeString(selectedOfficer?.name);
    const officerId = normalizeString(selectedOfficer?.id);

    const borrowerSnapshot = safeJsonObject({
      fullName: normalizeString(borrower.fullName),
      email: borrowerEmail,
      phone: normalizeString(borrower.phone),
      credit: normalizeString(borrower.credit),
      income: normalizeString(borrower.income),
      debt: normalizeString(borrower.debt),
      currentState: normalizeString(borrower.currentState),
      targetState: normalizeString(borrower.targetState),
      transactionType: normalizeString(borrower.transactionType),
      realtorStatus: normalizeString(borrower.realtorStatus),
      realtorName: normalizeString(borrower.realtorName),
      realtorPhone: normalizeString(borrower.realtorPhone),
    });

    const scenarioSnapshot = safeJsonObject({
      homePrice: normalizeString(scenario.homePrice),
      downPayment: normalizeString(scenario.downPayment),
      estimatedLoanAmount: normalizeString(scenario.estimatedLoanAmount),
      estimatedLtv: normalizeString(scenario.estimatedLtv),
      occupancy: normalizeString(scenario.occupancy),
    });

    const officerSnapshot = selectedOfficer
      ? safeJsonObject({
          id: officerId,
          name: officerName,
          nmls: normalizeString(selectedOfficer.nmls),
          email: officerEmail,
          assistantEmail: normalizeString(selectedOfficer.assistantEmail),
          mobile: normalizeString(selectedOfficer.mobile),
          assistantMobile: normalizeString(selectedOfficer.assistantMobile),
          applyUrl: normalizeString(selectedOfficer.applyUrl),
          scheduleUrl: normalizeString(selectedOfficer.scheduleUrl),
          role: normalizeString(selectedOfficer.role),
          companyName: normalizeString(selectedOfficer.companyName),
        })
      : {};

    const duplicateSearch = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("borrower_email", borrowerEmail)
      .order("last_updated", { ascending: false })
      .limit(5);

    if (duplicateSearch.error) {
      return NextResponse.json(
        {
          success: false,
          error: duplicateSearch.error.message,
        },
        { status: 500 }
      );
    }

    const existingMatch = (duplicateSearch.data || []).find((row: any) => {
      const existingOfficerEmail = normalizeEmail(row?.officer_email);
      const existingStatus = normalizeString(row?.status);
      return (
        existingOfficerEmail === officerEmail &&
        existingStatus !== "closed"
      );
    });

    if (existingMatch) {
      const mergedScenario = {
        ...(existingMatch.scenario || {}),
        borrower: {
          ...(existingMatch.scenario?.borrower || {}),
          ...borrowerSnapshot,
        },
        property: {
          ...(existingMatch.scenario?.property || {}),
          ...scenarioSnapshot,
        },
        officer: {
          ...(existingMatch.scenario?.officer || {}),
          ...officerSnapshot,
        },
        source,
      };

      const updatePayload: Record<string, unknown> = {
        borrower_name: borrowerName,
        scenario: mergedScenario,
        last_updated: new Date().toISOString(),
      };

      if (!normalizeString(existingMatch.status)) {
        updatePayload.status = status;
      }

      if (notes) {
        updatePayload.internal_notes = notes;
      }

      const updated = await supabaseAdmin
        .from("files")
        .update(updatePayload)
        .eq("id", existingMatch.id)
        .select("*")
        .single();

      if (updated.error) {
        return NextResponse.json(
          {
            success: false,
            error: updated.error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        created: false,
        file: updated.data,
      });
    }

    const insertPayload = {
      borrower_name: borrowerName,
      borrower_email: borrowerEmail,
      loan_officer_id: officerId || null,
      officer_name: officerName || null,
      officer_email: officerEmail || null,
      status,
      source,
      scenario: {
        borrower: borrowerSnapshot,
        property: scenarioSnapshot,
        officer: officerSnapshot,
        source,
      },
      internal_notes: notes || null,
      last_updated: new Date().toISOString(),
      last_opened: null,
    };

    const inserted = await supabaseAdmin
      .from("files")
      .insert([insertPayload])
      .select("*")
      .single();

    if (inserted.error) {
      return NextResponse.json(
        {
          success: false,
          error: inserted.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: true,
      file: inserted.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error while creating borrower workflow.",
      },
      { status: 500 }
    );
  }
}
