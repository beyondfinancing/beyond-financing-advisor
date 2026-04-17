import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-auth";

export async function POST(req: Request) {
  await clearAdminSession();

  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
