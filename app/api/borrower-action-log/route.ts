import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type BorrowerActionLogPayload = {
  borrowerName?: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  preferredLanguage?: string;

  loanOfficerName?: string;
  loanOfficerEmail?: string;
  assistantEmail?: string;

  realtorName?: string;
  realtorEmail?: string;
  realtorPhone?: string;

  trigger?: "apply" | "schedule" | "contact" | "call" | "review" | "scenario";
  eventType?:
    | "borrower_action_clicked"
    | "borrower_action_completed"
    | "borrower_action_failed"
    | "summary_requested"
    | "summary_completed"
    | "summary_failed";
  status?: "logged" | "success" | "failed";
  sourcePage?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BorrowerActionLogPayload;

    const trigger = normalizeString(body.trigger);
    const eventType = normalizeString(body.eventType);
    const status = normalizeString(body.status) || "logged";

    if (!trigger || !eventType) {
      return NextResponse.json(
        { success: false, error: "Missing trigger or eventType." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("borrower_action_logs").insert({
      borrower_name: normalizeString(body.borrowerName),
      borrower_email: normalizeString(body.borrowerEmail),
      borrower_phone: normalizeString(body.borrowerPhone),
      preferred_language: normalizeString(body.preferredLanguage),

      loan_officer_name: normalizeString(body.loanOfficerName),
      loan_officer_email: normalizeString(body.loanOfficerEmail),
      assistant_email: normalizeString(body.assistantEmail),

      realtor_name: normalizeString(body.realtorName),
      realtor_email: normalizeString(body.realtorEmail),
      realtor_phone: normalizeString(body.realtorPhone),

      trigger,
      event_type: eventType,
      status,
      source_page: normalizeString(body.sourcePage) || "/borrower",
      notes: normalizeString(body.notes),
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
