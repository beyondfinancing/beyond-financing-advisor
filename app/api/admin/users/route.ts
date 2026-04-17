import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function redirectWithMessage(type: "success" | "error", message: string) {
  const encoded = encodeURIComponent(message);
  return NextResponse.redirect(
    new URL(`/admin/users?${type}=${encoded}`, process.env.NEXT_PUBLIC_APP_URL || "https://beyondintelligence.io")
  );
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const action = String(formData.get("action") || "").trim();
    const id = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const nmls = String(formData.get("nmls") || "").trim();
    const role = String(formData.get("role") || "").trim();

    if (action === "create") {
      if (!name || !email || !nmls || !role) {
        return redirectWithMessage("error", "All user fields are required.");
      }

      const { error } = await supabaseAdmin.from("users").insert({
        name,
        email,
        nmls,
        role,
      });

      if (error) {
        return redirectWithMessage("error", `User create failed: ${error.message}`);
      }

      return redirectWithMessage("success", "User created successfully.");
    }

    if (action === "update") {
      if (!id || !name || !email || !nmls || !role) {
        return redirectWithMessage("error", "All update fields are required.");
      }

      const { error } = await supabaseAdmin
        .from("users")
        .update({
          name,
          email,
          nmls,
          role,
        })
        .eq("id", id);

      if (error) {
        return redirectWithMessage("error", `User update failed: ${error.message}`);
      }

      return redirectWithMessage("success", "User updated successfully.");
    }

    if (action === "delete") {
      if (!id) {
        return redirectWithMessage("error", "User id is required for delete.");
      }

      const { error } = await supabaseAdmin.from("users").delete().eq("id", id);

      if (error) {
        return redirectWithMessage("error", `User delete failed: ${error.message}`);
      }

      return redirectWithMessage("success", "User deleted successfully.");
    }

    return redirectWithMessage("error", "Invalid user action.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return redirectWithMessage("error", message);
  }
}
