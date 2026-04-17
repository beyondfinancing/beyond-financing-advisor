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

  const lenderId = String(formData.get("lender_id") || "").trim();
  const globalGuidelineId = String(formData.get("global_guideline_id") || "").trim();

  const payload = {
    lender_id: lenderId,
    global_guideline_id: globalGuidelineId || null,
    overlay_name: String(formData.get("overlay_name") || "").trim(),
    document_type: String(formData.get("document_type") || "overlay").trim(),
    occupancy: normalizeMultiValue(String(formData.get("occupancy") || "")),
    income_types: normalizeMultiValue(String(formData.get("income_types") || "")),
    states: normalizeMultiValue(String(formData.get("states") || "")),
    min_credit: toNumberOrNull(String(formData.get("min_credit") || "")),
    max_ltv: toNumberOrNull(String(formData.get("max_ltv") || "")),
    max_dti: toNumberOrNull(String(formData.get("max_dti") || "")),
    max_units: toNumberOrNull(String(formData.get("max_units") || "")),
    notes: String(formData.get("notes") || "").trim() || null,
    source_name: String(formData.get("source_name") || "").trim() || null,
    effective_date: String(formData.get("effective_date") || "").trim() || null,
    is_active: true,
  };

  if (!payload.lender_id || !payload.overlay_name) {
    return NextResponse.redirect(
      new URL(
        "/admin/overlays?error=Lender%20and%20Overlay%20Name%20are%20required.",
        req.url
      )
    );
  }

  const { error } = await supabaseAdmin.from("lender_overlays").insert(payload);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/overlays?error=${encodeURIComponent(error.message)}`,
        req.url
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      "/admin/overlays?success=Lender%20overlay%20created%20successfully.",
      req.url
    )
  );
}
