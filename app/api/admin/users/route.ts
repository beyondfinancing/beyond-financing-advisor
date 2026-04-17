import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.redirect(
      new URL("/admin/login?error=Admin%20session%20required.", request.url)
    );
  }

  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nmls = String(formData.get("nmls") || "").trim();
  const role = String(formData.get("role") || "").trim();

  if (!name || !email || !nmls || !role) {
    return NextResponse.redirect(
      new URL("/admin/users?error=All%20fields%20are%20required.", request.url)
    );
  }

  const { error } = await supabaseAdmin.from("users").insert([
    {
      name,
      email,
      nmls,
      role,
    },
  ]);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/users?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/admin/users?success=User%20created%20successfully.", request.url)
  );
}
