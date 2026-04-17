import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

function unauthorized(req: Request, isJson: boolean) {
  if (isJson) {
    return NextResponse.json(
      { success: false, error: "Admin authorization required." },
      { status: 401 }
    );
  }

  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}

export async function GET(req: Request) {
  const isJson = true;

  if (!(await isAdminSignedIn())) {
    return unauthorized(req, isJson);
  }

  const { data, error } = await supabaseAdmin
    .from("programs")
    .select("*, lenders(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, programs: data || [] });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!(await isAdminSignedIn())) {
    return unauthorized(req, isJson);
  }

  let lender_id = "";
  let name = "";
  let min_credit = 0;
  let max_ltv = 0;
  let max_dti = 0;
  let occupancy = "";
  let notes = "";

  if (isJson) {
    const body = await req.json();
    lender_id = String(body.lender_id || "");
    name = String(body.name || "");
    min_credit = Number(body.min_credit || 0);
    max_ltv = Number(body.max_ltv || 0);
    max_dti = Number(body.max_dti || 0);
    occupancy = String(body.occupancy || "");
    notes = String(body.notes || "");
  } else {
    const formData = await req.formData();
    lender_id = String(formData.get("lender_id") || "");
    name = String(formData.get("name") || "");
    min_credit = Number(formData.get("min_credit") || 0);
    max_ltv = Number(formData.get("max_ltv") || 0);
    max_dti = Number(formData.get("max_dti") || 0);
    occupancy = String(formData.get("occupancy") || "");
    notes = String(formData.get("notes") || "");
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
    if (isJson) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/admin/programs?error=${encodeURIComponent(error.message)}`, req.url),
      303
    );
  }

  if (isJson) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.redirect(
    new URL("/admin/programs?success=created", req.url),
    303
  );
}
