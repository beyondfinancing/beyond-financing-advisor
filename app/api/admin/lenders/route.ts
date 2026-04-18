import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("lenders")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load lenders." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lenders: Array.isArray(data) ? data : [],
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
