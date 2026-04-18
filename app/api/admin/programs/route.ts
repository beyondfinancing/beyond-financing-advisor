import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("programs")
      .select("id, lender_id, name, slug, loan_category, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load programs." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      programs: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
