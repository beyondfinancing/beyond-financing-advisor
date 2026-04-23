import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  console.log("NEW INQUIRY:", body);

  // Next step later:
  // send email via Resend / store in DB

  return NextResponse.json({ success: true });
}
