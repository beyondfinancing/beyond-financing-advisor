import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

function normalizeMultiValue(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumberOrNull(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function POST(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const formData = await req.formData();

  const payload = {
    agency: String(formData.get("agency") || "").trim(),
    product_family: String(formData.get("product_family") || "").trim(),
    program_name: String(formData.get("program_name") || "").trim(),
    document_type: String(formData.get("document_type") || "selling_guide").trim(),
    occupancy: normalizeMultiValue(String(formData.get("occupancy") || "")),
    income_types: normalizeMultiValue(String(formData.get("income_types") || "")),
    min_credit: toNumberOrNull(String(formData.get("min_credit") || "")),
    max_ltv: toNumberOrNull(String(formData.get("max_ltv") || "")),
    max_dti: toNumberOrNull(String(formData.get("max_dti") || "")),
    max_units: toNumberOrNull(String(formData.get("max_units") || "")),
    notes: String(formData.get("notes") || "").trim() || null,
    source_name: String(formData.get("source_name") || "").trim() || null,
    effective_date: String(formData.get("effective_date") || "").trim() || null,
    is_active: true,
  };

  if (!payload.agency || !payload.product_family || !payload.program_name) {
    return NextResponse.redirect(
      new URL(
        "/admin/guidelines?error=Agency%2C%20Product%20Family%2C%20and%20Program%20Name%20are%20required.",
        req.url
      )
    );
  }

  const { error } = await supabaseAdmin.from("global_guidelines").insert(payload);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/guidelines?error=${encodeURIComponent(error.message)}`,
        req.url
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      "/admin/guidelines?success=Global%20guideline%20created%20successfully.",
      req.url
    )
  );
}
