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

type RequestBody = {
  id?: string;
  status?: WorkflowStatus;
  note?: string;
  actorName?: string;
  actorRole?: string;
};

function isValidStatus(value: string): value is WorkflowStatus {
  return [
    "new_scenario",
    "pre_approval_review",
    "sent_to_processing",
    "processing_active",
    "submitted_to_lender",
    "conditional_approval",
    "clear_to_close",
    "closed",
  ].includes(value);
}

function getDefaultLatestUpdate(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return "Workflow file registered.";
    case "pre_approval_review":
      return "File moved into pre-approval review.";
    case "sent_to_processing":
      return "File sent to processing.";
    case "processing_active":
      return "Processing is active on this file.";
    case "submitted_to_lender":
      return "File submitted to lender.";
    case "conditional_approval":
      return "Conditional approval issued.";
    case "clear_to_close":
      return "File reached clear to close.";
    case "closed":
      return "Loan funded and closed.";
    default:
      return "Workflow status updated.";
  }
}

function getNextInternalAction(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return "Review intake and determine next production step.";
    case "pre_approval_review":
      return "Complete pre-approval analysis and issue guidance.";
    case "sent_to_processing":
      return "Processor to review handoff package and issue first checklist.";
    case "processing_active":
      return "Advance file conditions and maintain milestone communication.";
    case "submitted_to_lender":
      return "Monitor underwriting decision and respond to lender requests.";
    case "conditional_approval":
      return "Clear conditions and coordinate closing readiness.";
    case "clear_to_close":
      return "Coordinate closing and final funding timeline.";
    case "closed":
      return "File complete. Archive and finalize post-close items.";
    default:
      return "Review workflow record.";
  }
}

function getNextBorrowerAction(status: WorkflowStatus) {
  switch (status) {
    case "new_scenario":
      return "Await next instructions.";
    case "pre_approval_review":
      return "Provide requested documents if needed.";
    case "sent_to_processing":
    case "processing_active":
      return "Complete pending checklist items promptly.";
    case "submitted_to_lender":
      return "Stand by for underwriting updates.";
    case "conditional_approval":
      return "Satisfy outstanding conditions.";
    case "clear_to_close":
      return "Prepare for final closing coordination.";
    case "closed":
      return "No further borrower action required.";
    default:
      return "Await next instructions.";
  }
}

async function triggerNotification(origin: string, workflowFileId: string) {
  try {
    const response = await fetch(`${origin}/api/workflow-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflowFileId,
        eventType: "status_change",
      }),
    });

    return response.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();
    const actorName = String(body.actorName || "Team User").trim();
    const actorRole = String(body.actorRole || "Professional").trim();
    const note = String(body.note || "").trim();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing workflow file id." },
        { status: 400 }
      );
    }

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid workflow status." },
        { status: 400 }
      );
    }

    const { data: existingFile, error: existingError } = await supabaseAdmin
      .from("workflow_files")
      .select("*")
      .eq("id", id)
      .single();

    if (existingError || !existingFile) {
      return NextResponse.json(
        { success: false, error: "Workflow file not found." },
        { status: 404 }
      );
    }

    const latestUpdate = note || getDefaultLatestUpdate(status as WorkflowStatus);
    const nextInternalAction = getNextInternalAction(status as WorkflowStatus);
    const nextBorrowerAction = getNextBorrowerAction(status as WorkflowStatus);

    const { error: updateError } = await supabaseAdmin
      .from("workflow_files")
      .update({
        status,
        latest_update: latestUpdate,
        next_internal_action: nextInternalAction,
        next_borrower_action: nextBorrowerAction,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("workflow_updates").insert({
      workflow_file_id: id,
      previous_status: existingFile.status,
      new_status: status,
      actor_name: actorName,
      actor_role: actorRole,
      note: latestUpdate,
      created_at: new Date().toISOString(),
    });

    await supabaseAdmin.from("workflow_feed").insert({
      workflow_file_id: id,
      author: actorName,
      role: actorRole,
      text: latestUpdate,
      created_at: new Date().toISOString(),
    });

    const notifyResult = await triggerNotification(req.nextUrl.origin, id);

    return NextResponse.json({
      success: true,
      message: "Workflow status updated successfully.",
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
