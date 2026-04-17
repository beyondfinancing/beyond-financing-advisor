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
  const action = String(formData.get("_action") || "create");

  if (action === "create") {
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

  if (action === "update") {
    const id = String(formData.get("id") || "").trim();
    const lender_id = String(formData.get("lender_id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const min_credit = Number(formData.get("min_credit") || 0);
    const max_ltv = Number(formData.get("max_ltv") || 0);
    const max_dti = Number(formData.get("max_dti") || 0);
    const occupancy = String(formData.get("occupancy") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (
      !id ||
      !lender_id ||
      !name ||
      !min_credit ||
      !max_ltv ||
      !max_dti ||
      !occupancy
    ) {
      return NextResponse.redirect(
        new URL(
          "/admin/programs?error=All%20program%20fields%20are%20required%20to%20update.",
          request.url
        )
      );
    }

    const { error } = await supabaseAdmin
      .from("programs")
      .update({
        lender_id,
        name,
        min_credit,
        max_ltv,
        max_dti,
        occupancy,
        notes,
      })
      .eq("id", id);

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
        "/admin/programs?success=Program%20updated%20successfully.",
        request.url
      )
    );
  }

  if (action === "delete") {
    const id = String(formData.get("id") || "").trim();

    if (!id) {
      return NextResponse.redirect(
        new URL("/admin/programs?error=Program%20ID%20is%20required.", request.url)
      );
    }

    const { error } = await supabaseAdmin.from("programs").delete().eq("id", id);

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
        "/admin/programs?success=Program%20deleted%20successfully.",
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/admin/programs?error=Unsupported%20action.", request.url)
  );
}
