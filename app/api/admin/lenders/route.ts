import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function buildRedirectUrl(type: "success" | "error", message: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beyondintelligence.io";
  const url = new URL("/admin/lenders", baseUrl);
  url.searchParams.set(type, message);
  return url;
}

function getMultiValues(formData: FormData, fieldName: string): string[] {
  return formData
    .getAll(fieldName)
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const action = String(formData.get("action") || "").trim();
    const id = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const channels = getMultiValues(formData, "channels");
    const states = getMultiValues(formData, "states");

    if (action === "create") {
      if (!name || channels.length === 0 || states.length === 0) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "Lender name, channels, and states are required.")
        );
      }

      const { error } = await supabaseAdmin.from("lenders").insert({
        name,
        channel: channels.join(", "),
        states,
      });

      if (error) {
        return NextResponse.redirect(
          buildRedirectUrl("error", `Lender create failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Lender created successfully.")
      );
    }

    if (action === "update") {
      if (!id || !name || channels.length === 0 || states.length === 0) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "All lender update fields are required.")
        );
      }

      const { error } = await supabaseAdmin
        .from("lenders")
        .update({
          name,
          channel: channels.join(", "),
          states,
        })
        .eq("id", id);

      if (error) {
        return NextResponse.redirect(
          buildRedirectUrl("error", `Lender update failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Lender updated successfully.")
      );
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "Lender id is required for delete.")
        );
      }

      const { error } = await supabaseAdmin.from("lenders").delete().eq("id", id);

      if (error) {
        return NextResponse.redirect(
          buildRedirectUrl("error", `Lender delete failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Lender deleted successfully.")
      );
    }

    return NextResponse.redirect(
      buildRedirectUrl("error", "Invalid lender action.")
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.redirect(buildRedirectUrl("error", message));
  }
}
