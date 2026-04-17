import { NextResponse } from "next/server";
import { signInAdminSession, validateAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!validateAdminCredentials(email, password)) {
      return NextResponse.redirect(
        new URL(
          "/admin/login?error=Invalid%20admin%20email%20or%20password.",
          request.url
        )
      );
    }

    await signInAdminSession();

    return NextResponse.redirect(new URL("/admin", request.url));
  } catch {
    return NextResponse.redirect(
      new URL("/admin/login?error=Unable%20to%20sign%20in.", request.url)
    );
  }
}
