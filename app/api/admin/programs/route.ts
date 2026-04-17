import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function buildRedirectUrl(type: "success" | "error", message: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beyondintelligence.io";
  const url = new URL("/admin/programs", baseUrl);
  url.searchParams.set(type, message);
  return url;
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const action = String(formData.get("action") || "").trim();
    const id = String(formData.get("id") || "").trim();
    const lender_id = String(formData.get("lender_id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const occupancy = String(formData.get("occupancy") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    const min_credit = toNullableNumber(String(formData.get("min_credit") || ""));
    const max_ltv = toNullableNumber(String(formData.get("max_ltv") || ""));
    const max_dti = toNullableNumber(String(formData.get("max_dti") || ""));

    if (action === "create") {
      if (!lender_id || !name || min_credit === null || max_ltv === null || max_dti === null || !occupancy) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "All required program fields must be completed.")
        );
      }

      const { error } = await supabaseAdmin.from("programs").insert({
        lender_id,
        name,
        min_credit,
        max_ltv,
        max_dti,
        occupancy,
        notes,
      });

      if (error) {
        return NextResponse.redirect(
          buildRedirectUrl("error", `Program create failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Program created successfully.")
      );
    }

    if (action === "update") {
      if (!id || !lender_id || !name || min_credit === null || max_ltv === null || max_dti === null || !occupancy) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "All required program update fields must be completed.")
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
          buildRedirectUrl("error", `Program update failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Program updated successfully.")
      );
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "Program id is required for delete.")
        );
      }

      const { error } = await supabaseAdmin.from("programs").delete().eq("id", id);

      if (error) {
        return NextResponse.redirect(
          buildRedirectUrl("error", `Program delete failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Program deleted successfully.")
      );
    }

    return NextResponse.redirect(
      buildRedirectUrl("error", "Invalid program action.")
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.redirect(buildRedirectUrl("error", message));
  }
}
