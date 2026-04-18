import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("lender_documents")
      .select(`
        id,
        lender_id,
        program_id,
        document_type,
        document_group,
        original_filename,
        effective_date,
        uploaded_at,
        is_active,
        notes,
        size_bytes,
        lenders!inner (
          name
        )
      `)
      .eq("is_active", true)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load active documents." },
        { status: 500 }
      );
    }

    const documents = Array.isArray(data)
      ? data.map((row) => ({
          id: row.id,
          lender_id: row.lender_id,
          lender_name:
            Array.isArray(row.lenders) && row.lenders.length > 0
              ? row.lenders[0]?.name || "Unknown Lender"
              : (row.lenders as { name?: string } | null)?.name || "Unknown Lender",
          document_type: row.document_type,
          document_group: row.document_group || "Master",
          program_id: row.program_id,
          original_filename: row.original_filename,
          effective_date: row.effective_date,
          uploaded_at: row.uploaded_at,
          is_active: row.is_active,
          notes: row.notes,
          size_bytes: row.size_bytes,
        }))
      : [];

    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
