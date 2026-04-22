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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: file, error: fileError } = await supabaseAdmin
      .from("workflow_files")
      .select("*")
      .eq("id", id)
      .single();

    if (fileError) {
      return NextResponse.json(
        { success: false, error: fileError.message },
        { status: 404 }
      );
    }

    const { data: feed, error: feedError } = await supabaseAdmin
      .from("workflow_feed")
      .select("*")
      .eq("workflow_file_id", id)
      .order("created_at", { ascending: false });

    if (feedError) {
      return NextResponse.json(
        { success: false, error: feedError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file,
      feed: feed ?? [],
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const author = String(body?.author ?? "Team User").trim();
    const role = String(body?.role ?? "Professional").trim();

    const borrowerName = String(body?.borrowerName ?? "").trim();
    const loanNumber = String(body?.loanNumber ?? "").trim();
    const purpose = String(body?.purpose ?? "Purchase").trim();
    const amount = Number(body?.amount ?? 0);
    const loanOfficer = String(body?.loanOfficer ?? "").trim();
    const occupancy = String(body?.occupancy ?? "Primary Residence").trim();
    const blocker = String(body?.blocker ?? "").trim();
    const nextInternalAction = String(body?.nextInternalAction ?? "").trim();
    const nextBorrowerAction = String(body?.nextBorrowerAction ?? "").trim();
    const latestUpdate = String(body?.latestUpdate ?? "").trim();
    const targetClose = String(body?.targetClose ?? "").trim() || null;
    const requestedProcessorNote = String(
      body?.requestedProcessorNote ?? ""
    ).trim();

    const status = normalizeStatus(body?.status);
    const urgency = normalizeUrgency(body?.urgency);

    const isProductionManager =
      role === "Production Manager" || author === "Amarilis Santos";

    const { data: existingFile, error: existingFileError } = await supabaseAdmin
      .from("workflow_files")
      .select("*")
      .eq("id", id)
      .single();

    if (existingFileError || !existingFile) {
      return NextResponse.json(
        { success: false, error: "Workflow file not found." },
        { status: 404 }
      );
    }

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

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a valid number." },
        { status: 400 }
      );
    }

    const { data: duplicateLoan, error: duplicateLoanError } = await supabaseAdmin
      .from("workflow_files")
      .select("id")
      .eq("file_number", loanNumber)
      .neq("id", id)
      .maybeSingle();

    if (duplicateLoanError) {
      return NextResponse.json(
        { success: false, error: duplicateLoanError.message },
        { status: 500 }
      );
    }

    if (duplicateLoan) {
      return NextResponse.json(
        {
          success: false,
          error: "Another workflow file already uses this loan number.",
        },
        { status: 409 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      file_number: loanNumber,
      borrower_name: borrowerName,
      purpose,
      amount,
      loan_officer: loanOfficer,
      status,
      urgency,
      target_close: targetClose,
      occupancy,
      blocker,
      next_internal_action: nextInternalAction,
      next_borrower_action: nextBorrowerAction,
      latest_update: latestUpdate,
      requested_processor_note: requestedProcessorNote || null,
    };

    if (isProductionManager) {
      updatePayload.processor = String(body?.processor ?? "Unassigned").trim();
      updatePayload.production_manager = author;
    }

    const { data: updatedFile, error: updateError } = await supabaseAdmin
      .from("workflow_files")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file: updatedFile,
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const action = String(body?.action ?? "");

    if (action !== "add_feed_entry") {
      return NextResponse.json(
        { success: false, error: "Unsupported action." },
        { status: 400 }
      );
    }

    const author = String(body?.author ?? "Team User").trim();
    const role = String(body?.role ?? "Professional").trim();
    const text = String(body?.text ?? "").trim();

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Feed text is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("workflow_feed")
      .insert({
        workflow_file_id: id,
        author,
        role,
        text,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedItem: data,
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const author = String(body?.author ?? "").trim();
    const role = String(body?.role ?? "").trim();

    const canDelete =
      role === "Branch Manager" || author === "Sandro Pansini Souza";

    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: "Only the Branch Manager can delete a file." },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("workflow_files")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
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
