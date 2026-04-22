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

function normalizeDate(value?: string | null) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFileNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const stamp = String(now.getTime()).slice(-6);
  return `WF-${year}-${stamp}`;
}

function isProductionManager(actorName?: string, actorRole?: string) {
  return (
    actorRole === "Production Manager" ||
    actorName === "Amarilis Santos"
  );
}

function isBranchManager(actorName?: string, actorRole?: string) {
  return (
    actorRole === "Branch Manager" ||
    actorName === "Sandro Pansini Souza"
  );
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const fileId = url.searchParams.get("fileId");

    const { data: files, error: filesError } = await supabaseAdmin
      .from("workflow_files")
      .select("*");

    if (filesError) {
      return NextResponse.json(
        { success: false, error: filesError.message },
        { status: 500 }
      );
    }

    let feed: unknown[] = [];

    if (fileId) {
      const { data: feedRows, error: feedError } = await supabaseAdmin
        .from("workflow_feed")
        .select("*")
        .eq("workflow_file_id", fileId)
        .order("created_at", { ascending: false });

      if (feedError) {
        return NextResponse.json(
          { success: false, error: feedError.message },
          { status: 500 }
        );
      }

      feed = feedRows ?? [];
    }

    return NextResponse.json({
      success: true,
      files: files ?? [],
      feed,
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

    if (action === "create_file") {
      const borrowerName = String(body?.borrowerName ?? "").trim();
      const purpose = String(body?.purpose ?? "").trim() || "Purchase";
      const loanOfficer = String(body?.loanOfficer ?? "").trim();
      const processor = String(body?.processor ?? "").trim() || "";
      const occupancy =
        String(body?.occupancy ?? "").trim() || "Primary Residence";
      const blocker = String(body?.blocker ?? "").trim() || "None currently.";
      const urgency = (String(body?.urgency ?? "Priority").trim() ||
        "Priority") as WorkflowUrgency;
      const targetClose = normalizeDate(body?.targetClose);
      const amount = Number(body?.amount ?? 0);
      const nextInternalAction =
        String(body?.nextInternalAction ?? "").trim() ||
        "Processor to review file and issue initial checklist.";
      const nextBorrowerAction =
        String(body?.nextBorrowerAction ?? "").trim() ||
        "Stand by for document checklist.";
      const latestUpdate =
        String(body?.latestUpdate ?? "").trim() || "Workflow file created.";
      const author = String(body?.author ?? "").trim() || "Team User";
      const role = String(body?.role ?? "").trim() || "Professional";
      const requestedProcessorNote = String(
        body?.requestedProcessorNote ?? ""
      ).trim();

      if (!borrowerName || !loanOfficer) {
        return NextResponse.json(
          {
            success: false,
            error: "Borrower name and loan officer are required.",
          },
          { status: 400 }
        );
      }

      const canAssignProcessor = isProductionManager(author, role);

      const insertPayload = {
        file_number: buildFileNumber(),
        borrower_name: borrowerName,
        purpose,
        amount: Number.isFinite(amount) ? amount : 0,
        status: "new_scenario" as WorkflowStatus,
        urgency,
        loan_officer: loanOfficer,
        processor: canAssignProcessor ? processor || "Unassigned" : "Unassigned",
        production_manager: canAssignProcessor ? author : "Pending Assignment",
        target_close: targetClose,
        file_age_days: 0,
        occupancy,
        blocker,
        next_internal_action: nextInternalAction,
        next_borrower_action: nextBorrowerAction,
        latest_update: latestUpdate,
        requested_processor_note: requestedProcessorNote || null,
      };

      const { data: createdFile, error: createError } = await supabaseAdmin
        .from("workflow_files")
        .insert(insertPayload)
        .select("*")
        .single();

      if (createError) {
        return NextResponse.json(
          { success: false, error: createError.message },
          { status: 500 }
        );
      }

      const feedEntries = [
        {
          workflow_file_id: createdFile.id,
          author,
          role,
          text: `${borrowerName} added to Workflow Intelligence.`,
        },
      ];

      if (requestedProcessorNote) {
        feedEntries.push({
          workflow_file_id: createdFile.id,
          author,
          role,
          text: `Loan Officer note to Production Manager: ${requestedProcessorNote}`,
        });
      }

      const { error: feedError } = await supabaseAdmin
        .from("workflow_feed")
        .insert(feedEntries);

      if (feedError) {
        return NextResponse.json(
          { success: false, error: feedError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        file: createdFile,
      });
    }

    if (action === "add_feed") {
      const workflowFileId = String(body?.workflowFileId ?? "").trim();
      const author = String(body?.author ?? "").trim() || "Team User";
      const role = String(body?.role ?? "").trim() || "Professional";
      const text = String(body?.text ?? "").trim();

      if (!workflowFileId || !text) {
        return NextResponse.json(
          {
            success: false,
            error: "workflowFileId and text are required.",
          },
          { status: 400 }
        );
      }

      const { data: createdFeed, error: feedError } = await supabaseAdmin
        .from("workflow_feed")
        .insert({
          workflow_file_id: workflowFileId,
          author,
          role,
          text,
        })
        .select("*")
        .single();

      if (feedError) {
        return NextResponse.json(
          { success: false, error: feedError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        feed: createdFeed,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported action." },
      { status: 400 }
    );
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action ?? "");
    const actorName = String(body?.author ?? "").trim() || "Team User";
    const actorRole = String(body?.role ?? "").trim() || "Professional";

    if (action === "handoff") {
      const workflowFileId = String(body?.workflowFileId ?? "").trim();
      const processor = String(body?.processor ?? "").trim();
      const targetClose = normalizeDate(body?.targetClose);
      const urgency = (String(body?.urgency ?? "Priority").trim() ||
        "Priority") as WorkflowUrgency;
      const handoffNote = String(body?.handoffNote ?? "").trim();

      if (!workflowFileId) {
        return NextResponse.json(
          { success: false, error: "workflowFileId is required." },
          { status: 400 }
        );
      }

      const { data: existingFile, error: existingError } = await supabaseAdmin
        .from("workflow_files")
        .select("*")
        .eq("id", workflowFileId)
        .single();

      if (existingError || !existingFile) {
        return NextResponse.json(
          { success: false, error: "Workflow file not found." },
          { status: 404 }
        );
      }

      const canAssignProcessor = isProductionManager(actorName, actorRole);

      const updatePayload: Record<string, unknown> = {
        status: "sent_to_processing" as WorkflowStatus,
        target_close: targetClose || existingFile.target_close,
        urgency,
        latest_update:
          handoffNote || "File moved to processing workflow.",
        next_internal_action:
          "Processor to review handoff package and issue first checklist.",
      };

      if (canAssignProcessor) {
        updatePayload.processor = processor || existingFile.processor || "Unassigned";
        updatePayload.production_manager = actorName;
      }

      const { data: updatedFile, error: updateError } = await supabaseAdmin
        .from("workflow_files")
        .update(updatePayload)
        .eq("id", workflowFileId)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      const feedText = canAssignProcessor
        ? handoffNote ||
          `${existingFile.borrower_name} assigned to ${processor || existingFile.processor || "Unassigned"} by Production Manager.`
        : handoffNote ||
          `${existingFile.borrower_name} sent a processing note. Processor assignment remains under Production Manager control.`;

      const { data: feedEntry, error: feedError } = await supabaseAdmin
        .from("workflow_feed")
        .insert({
          workflow_file_id: workflowFileId,
          author: actorName,
          role: actorRole,
          text: feedText,
        })
        .select("*")
        .single();

      if (feedError) {
        return NextResponse.json(
          { success: false, error: feedError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        file: updatedFile,
        feed: feedEntry,
      });
    }

    if (action === "update_file") {
      const workflowFileId = String(body?.workflowFileId ?? "").trim();

      if (!workflowFileId) {
        return NextResponse.json(
          { success: false, error: "workflowFileId is required." },
          { status: 400 }
        );
      }

      const { data: existingFile, error: existingError } = await supabaseAdmin
        .from("workflow_files")
        .select("*")
        .eq("id", workflowFileId)
        .single();

      if (existingError || !existingFile) {
        return NextResponse.json(
          { success: false, error: "Workflow file not found." },
          { status: 404 }
        );
      }

      const canAssignProcessor = isProductionManager(actorName, actorRole);

      const updatePayload: Record<string, unknown> = {
        borrower_name: String(body?.borrowerName ?? existingFile.borrower_name).trim(),
        purpose: String(body?.purpose ?? existingFile.purpose).trim(),
        amount: Number(body?.amount ?? existingFile.amount ?? 0),
        loan_officer: String(body?.loanOfficer ?? existingFile.loan_officer).trim(),
        target_close:
          normalizeDate(body?.targetClose) || existingFile.target_close,
        urgency: (String(body?.urgency ?? existingFile.urgency).trim() ||
          existingFile.urgency) as WorkflowUrgency,
        occupancy: String(body?.occupancy ?? existingFile.occupancy).trim(),
        blocker: String(body?.blocker ?? existingFile.blocker).trim(),
        status: (String(body?.status ?? existingFile.status).trim() ||
          existingFile.status) as WorkflowStatus,
        next_internal_action: String(
          body?.nextInternalAction ?? existingFile.next_internal_action
        ).trim(),
        next_borrower_action: String(
          body?.nextBorrowerAction ?? existingFile.next_borrower_action
        ).trim(),
        latest_update: String(
          body?.latestUpdate ?? existingFile.latest_update
        ).trim(),
        requested_processor_note: String(
          body?.requestedProcessorNote ?? existingFile.requested_processor_note ?? ""
        ).trim(),
      };

      if (canAssignProcessor) {
        updatePayload.processor = String(
          body?.processor ?? existingFile.processor ?? "Unassigned"
        ).trim();
        updatePayload.production_manager = actorName;
      }

      const { data: updatedFile, error: updateError } = await supabaseAdmin
        .from("workflow_files")
        .update(updatePayload)
        .eq("id", workflowFileId)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      const feedLines: string[] = ["File details updated."];
      if (!canAssignProcessor && String(body?.requestedProcessorNote ?? "").trim()) {
        feedLines.push(
          `Loan Officer note to Production Manager: ${String(
            body.requestedProcessorNote
          ).trim()}`
        );
      }
      if (canAssignProcessor) {
        feedLines.push(
          `Production Manager assignment: ${String(
            body?.processor ?? existingFile.processor ?? "Unassigned"
          ).trim()}`
        );
      }

      const { error: feedError } = await supabaseAdmin.from("workflow_feed").insert({
        workflow_file_id: workflowFileId,
        author: actorName,
        role: actorRole,
        text: feedLines.join(" "),
      });

      if (feedError) {
        return NextResponse.json(
          { success: false, error: feedError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        file: updatedFile,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported action." },
      { status: 400 }
    );
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

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const workflowFileId = String(body?.workflowFileId ?? "").trim();
    const actorName = String(body?.author ?? "").trim() || "Team User";
    const actorRole = String(body?.role ?? "").trim() || "Professional";

    if (!workflowFileId) {
      return NextResponse.json(
        { success: false, error: "workflowFileId is required." },
        { status: 400 }
      );
    }

    if (!isBranchManager(actorName, actorRole)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the Branch Manager can delete a workflow file.",
        },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("workflow_files")
      .delete()
      .eq("id", workflowFileId);

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
