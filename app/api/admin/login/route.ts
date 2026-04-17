import { NextResponse } from "next/server";
import {
  signInAdminSession,
  validateAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  let email = "";
  let password = "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    email = String(body.email || "");
    password = String(body.password || "");
  } else {
    const formData = await req.formData();
    email = String(formData.get("email") || "");
    password = String(formData.get("password") || "");
  }

  const valid = validateAdminCredentials(email, password);

  if (!valid) {
    if (contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Invalid admin credentials." },
        { status: 401 }
      );
    }

    return NextResponse.redirect(
      new URL("/admin/login?error=invalid", req.url),
      303
    );
  }

  await signInAdminSession();

  if (contentType.includes("application/json")) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.redirect(new URL("/admin", req.url), 303);
}
