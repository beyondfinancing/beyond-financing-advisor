import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type CreateFeedBody = {
  workflowFileId?: string;
  author?: string;
  role?: string;
  text?: string;
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflow_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feed: data || [],
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateFeedBody;

    const workflowFileId = String(body.workflowFileId || "").trim();
    const author = String(body.author || "Team User").trim();
    const role = String(body.role || "Professional").trim();
    const text = String(body.text || "").trim();

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Feed text is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("workflow_feed")
      .insert({
        workflow_file_id: workflowFileId || null,
        author,
        role,
        text,
        created_at: new Date().toISOString(),
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
      item: data,
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
