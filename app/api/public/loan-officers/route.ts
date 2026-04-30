// Place this file at: app/api/public/loan-officers/route.ts
//
// Returns the list of loan officers from public.users for the borrower-facing
// intake picker. This endpoint is PUBLIC (no auth) and only returns fields
// that are safe to expose to an unauthenticated borrower: name, NMLS, contact
// email, phone, apply/schedule URLs.
//
// Step 8.1: Switched from the anon Supabase client to supabaseAdmin so this
// route is unaffected when RLS is enabled on the underlying table during
// Step 8.2+. The data exposed here is intentionally public (same info on the
// company website), and access control lives in this route's own field
// projection — not in RLS. Switching to the service-role client lets us
// turn on "service-role only" RLS policies without breaking the borrower
// intake flow.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type RawUser = {
  id: string;
  name: string | null;
  nmls: string | null;
  email: string | null;
  assistantemail: string | null;
  mobile: string | null;
  assistantmobile: string | null;
  apply_url: string | null;
  schedule_url: string | null;
  role: string | null;
};

const APPLY_FALLBACK = "https://www.beyondfinancing.com/apply-now";
const SCHEDULE_FALLBACK = "https://www.beyondfinancing.com";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, name, nmls, email, assistantemail, mobile, assistantmobile, apply_url, schedule_url, role"
      )
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          officers: [],
        },
        { status: 500 }
      );
    }

    const officers = ((data as RawUser[]) || [])
      .filter((u) => u.name && u.email)
      .map((u) => ({
        id: u.id,
        name: u.name as string,
        nmls: u.nmls || "",
        email: u.email as string,
        assistantEmail: u.assistantemail || "",
        mobile: u.mobile || "",
        assistantMobile: u.assistantmobile || "",
        applyUrl: u.apply_url || APPLY_FALLBACK,
        scheduleUrl: u.schedule_url || SCHEDULE_FALLBACK,
        role: u.role || "",
      }));

    return NextResponse.json({ success: true, officers });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error fetching loan officers.",
        officers: [],
      },
      { status: 500 }
    );
  }
}
