import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type WorkflowUrgency = "Standard" | "Priority" | "Rush";

type UpdateWorkflowBody = {
  id?: string;
  processor?: string;
  targetClose?: string;
  urgency?: WorkflowUrgency;
  handoffNote?: string;
  actorName?: string;
  actorRole?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpdateWorkflowBody;

    const id = String(body.id || "").trim();
    const processor = String(body.processor || "").trim();
    const targetClose = String(body.targetClose || "").trim();
    const urgency = String(body.urgency || "").trim() as WorkflowUrgency;
    const handoffNote = String(body.handoffNote || "").trim();
    const actorName = String(body.actorName || "Team User").trim();
    const actorRole = String(body.actorRole || "Professional").trim();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing workflow file id." },
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

    const latestUpdate =
      handoffNote ||
      "Loan officer triggered processing handoff through Team Workflow Intelligence.";

    const nextInternalAction =
      "Processor to review handoff package and issue first checklist.";

    const updatePayload = {
      status: "sent_to_processing",
      processor: processor || existingFile.processor,
      target_close: targetClose || existingFile.target_close,
      urgency: urgency || existingFile.urgency,
      latest_update: latestUpdate,
      next_internal_action: nextInternalAction,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("workflow_files")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    const feedText =
      handoffNote ||
      `${existingFile.borrower_name} sent to processing with ${String(
        urgency || existingFile.urgency || "Priority"
      ).toLowerCase()} visibility.`;

    const { error: feedError } = await supabaseAdmin.from("workflow_feed").insert({
      workflow_file_id: id,
      author: actorName,
      role: actorRole,
      text: feedText,
      created_at: new Date().toISOString(),
    });

    if (feedError) {
      return NextResponse.json(
        {
          success: false,
          error: feedError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workflow file updated successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}
