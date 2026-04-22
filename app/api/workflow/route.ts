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
      const processor = String(body?.processor ?? "").trim() || "Amarilis Santos";
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

      if (!borrowerName || !loanOfficer) {
        return NextResponse.json(
          {
            success: false,
            error: "Borrower name and loan officer are required.",
          },
          { status: 400 }
        );
      }

      const insertPayload = {
        file_number: buildFileNumber(),
        borrower_name: borrowerName,
        purpose,
        amount: Number.isFinite(amount) ? amount : 0,
        status: "new_scenario" as WorkflowStatus,
        urgency,
        loan_officer: loanOfficer,
        processor,
        target_close: targetClose,
        file_age_days: 0,
        occupancy,
        blocker,
        next_internal_action: nextInternalAction,
        next_borrower_action: nextBorrowerAction,
        latest_update: latestUpdate,
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

      const { error: feedError } = await supabaseAdmin.from("workflow_feed").insert({
        workflow_file_id: createdFile.id,
        author,
        role,
        text: `${borrowerName} added to Workflow Intelligence.`,
      });

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

    if (action !== "handoff") {
      return NextResponse.json(
        { success: false, error: "Unsupported action." },
        { status: 400 }
      );
    }

    const workflowFileId = String(body?.workflowFileId ?? "").trim();
    const processor = String(body?.processor ?? "").trim();
    const targetClose = normalizeDate(body?.targetClose);
    const urgency = (String(body?.urgency ?? "Priority").trim() ||
      "Priority") as WorkflowUrgency;
    const handoffNote = String(body?.handoffNote ?? "").trim();
    const author = String(body?.author ?? "").trim() || "Team User";
    const role = String(body?.role ?? "").trim() || "Professional";

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

    const nextInternalAction =
      "Processor to review handoff package and issue first checklist.";
    const latestUpdate =
      handoffNote || "Loan officer triggered processing handoff.";

    const updatePayload = {
      status: "sent_to_processing" as WorkflowStatus,
      processor: processor || existingFile.processor,
      target_close: targetClose || existingFile.target_close,
      urgency,
      latest_update: latestUpdate,
      next_internal_action: nextInternalAction,
    };

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

    const feedText =
      handoffNote ||
      `${existingFile.borrower_name} sent to processing with ${urgency.toLowerCase()} visibility.`;

    const { data: feedEntry, error: feedError } = await supabaseAdmin
      .from("workflow_feed")
      .insert({
        workflow_file_id: workflowFileId,
        author,
        role,
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
