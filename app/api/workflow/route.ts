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

type WorkflowUrgency = "Standard" | "Priority" | "Rush";

function normalizeStatus(value: unknown): WorkflowStatus {
  const allowed: WorkflowStatus[] = [
    "new_scenario",
    "pre_approval_review",
    "sent_to_processing",
    "processing_active",
    "submitted_to_lender",
    "conditional_approval",
    "clear_to_close",
    "closed",
  ];

  return allowed.includes(value as WorkflowStatus)
    ? (value as WorkflowStatus)
    : "new_scenario";
}

function normalizeUrgency(value: unknown): WorkflowUrgency {
  const allowed: WorkflowUrgency[] = ["Standard", "Priority", "Rush"];
  return allowed.includes(value as WorkflowUrgency)
    ? (value as WorkflowUrgency)
    : "Priority";
}

async function triggerNotification(origin: string, workflowFileId: string, eventType: "created" | "status_change") {
  try {
    const response = await fetch(`${origin}/api/workflow-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflowFileId,
        eventType,
      }),
    });

    return response.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflow_files")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      files: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action ?? "");

    if (action !== "create_file") {
      return NextResponse.json(
        { success: false, error: "Unsupported action." },
        { status: 400 }
      );
    }

    const borrowerName = String(body?.borrowerName ?? "").trim();
    const loanNumber = String(body?.loanNumber ?? "").trim();
    const purpose = String(body?.purpose ?? "Purchase").trim();
    const amount = Number(body?.amount ?? 0);
    const loanOfficer = String(body?.loanOfficer ?? "").trim();
    const occupancy = String(body?.occupancy ?? "Primary Residence").trim();
    const blocker = String(body?.blocker ?? "None currently.").trim();
    const targetClose = String(body?.targetClose ?? "").trim() || null;
    const requestedProcessorNote = String(
      body?.requestedProcessorNote ?? ""
    ).trim();
    const author = String(body?.author ?? "Team User").trim();
    const role = String(body?.role ?? "Professional").trim();

    const propertyAddress = String(body?.propertyAddress ?? "").trim();
    const listingAgentName = String(body?.listingAgentName ?? "").trim();
    const listingAgentEmail = String(body?.listingAgentEmail ?? "").trim();
    const listingAgentPhone = String(body?.listingAgentPhone ?? "").trim();
    const buyerAgentName = String(body?.buyerAgentName ?? "").trim();
    const buyerAgentEmail = String(body?.buyerAgentEmail ?? "").trim();
    const buyerAgentPhone = String(body?.buyerAgentPhone ?? "").trim();

    const status = normalizeStatus(body?.status ?? "new_scenario");
    const urgency = normalizeUrgency(body?.urgency ?? "Priority");

    let processor = String(body?.processor ?? "Unassigned").trim();
    let productionManager = String(body?.productionManager ?? "").trim();

    const isProductionManager =
      role === "Production Manager" || author === "Amarilis Santos";

    if (!borrowerName) {
      return NextResponse.json(
        { success: false, error: "Borrower name is required." },
        { status: 400 }
      );
    }

    if (!loanNumber) {
      return NextResponse.json(
        { success: false, error: "Loan number is required." },
        { status: 400 }
      );
    }

    if (!loanOfficer) {
      return NextResponse.json(
        { success: false, error: "Loan officer is required." },
        { status: 400 }
      );
    }

    if (!propertyAddress) {
      return NextResponse.json(
        { success: false, error: "Property address is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a valid number." },
        { status: 400 }
      );
    }

    if (!isProductionManager) {
      processor = "Unassigned";
      productionManager = "";
    } else if (!productionManager) {
      productionManager = author;
    }

    const { data: existingLoanNumber, error: loanNumberCheckError } =
      await supabaseAdmin
        .from("workflow_files")
        .select("id")
        .eq("file_number", loanNumber)
        .maybeSingle();

    if (loanNumberCheckError) {
      return NextResponse.json(
        { success: false, error: loanNumberCheckError.message },
        { status: 500 }
      );
    }

    if (existingLoanNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "This loan number already exists in Workflow Intelligence.",
        },
        { status: 409 }
      );
    }

    const insertPayload = {
      file_number: loanNumber,
      borrower_name: borrowerName,
      purpose,
      amount,
      status,
      urgency,
      loan_officer: loanOfficer,
      processor,
      production_manager: productionManager || null,
      requested_processor_note: requestedProcessorNote || null,
      target_close: targetClose,
      occupancy,
      blocker,
      property_address: propertyAddress,
      listing_agent_name: listingAgentName || null,
      listing_agent_email: listingAgentEmail || null,
      listing_agent_phone: listingAgentPhone || null,
      buyer_agent_name: buyerAgentName || null,
      buyer_agent_email: buyerAgentEmail || null,
      buyer_agent_phone: buyerAgentPhone || null,
      notification_active: true,
      final_notification_sent: false,
      next_internal_action:
        processor && processor !== "Unassigned"
          ? "Processor to review file and issue initial checklist."
          : "Production Manager to assign processor and review intake.",
      next_borrower_action: "Stand by for document checklist.",
      latest_update: "Workflow file created.",
    };

    const { data: insertedFile, error: insertError } = await supabaseAdmin
      .from("workflow_files")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    const { error: feedError } = await supabaseAdmin.from("workflow_feed").insert({
      workflow_file_id: insertedFile.id,
      author,
      role,
      text: `${borrowerName} added to Workflow Intelligence for ${propertyAddress}.`,
    });

    if (feedError) {
      return NextResponse.json(
        {
          success: false,
          error: `File created, but feed entry failed: ${feedError.message}`,
        },
        { status: 500 }
      );
    }

    const notifyResult = await triggerNotification(
      request.nextUrl.origin,
      insertedFile.id,
      "created"
    );

    return NextResponse.json({
      success: true,
      file: insertedFile,
      notifyResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}
