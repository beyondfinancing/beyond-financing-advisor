import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("programs")
    .select("*, lenders(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ programs: data || [] });
}

export async function POST(request: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.redirect(
      new URL("/admin/login?error=Admin%20session%20required.", request.url)
    );
  }

  const formData = await request.formData();

  const lender_id = String(formData.get("lender_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const min_credit = Number(formData.get("min_credit") || 0);
  const max_ltv = Number(formData.get("max_ltv") || 0);
  const max_dti = Number(formData.get("max_dti") || 0);
  const occupancy = String(formData.get("occupancy") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (
    !lender_id ||
    !name ||
    !min_credit ||
    !max_ltv ||
    !max_dti ||
    !occupancy
  ) {
    return NextResponse.redirect(
      new URL(
        "/admin/programs?error=Lender,%20program,%20credit,%20LTV,%20DTI,%20and%20occupancy%20are%20required.",
        request.url
      )
    );
  }

  const { error } = await supabaseAdmin.from("programs").insert([
    {
      lender_id,
      name,
      min_credit,
      max_ltv,
      max_dti,
      occupancy,
      notes,
    },
  ]);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/programs?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      "/admin/programs?success=Program%20created%20successfully.",
      request.url
    )
  );
}
