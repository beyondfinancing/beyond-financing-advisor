import { NextResponse } from "next/server";
import {
  signInAdminSession,
  validateAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!validateAdminCredentials(email, password)) {
    return NextResponse.redirect(
      new URL("/admin/login?error=Invalid%20admin%20credentials.", request.url)
    );
  }

  await signInAdminSession();

  return NextResponse.redirect(new URL("/admin", request.url));
}
