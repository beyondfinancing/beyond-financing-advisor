import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const documentId = String(body?.documentId || "").trim();

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId." }, { status: 400 });
    }

    const { error } = await supabase
      .from("lender_documents")
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to archive document." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
