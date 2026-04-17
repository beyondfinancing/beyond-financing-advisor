import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("lenders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lenders: data || [] });
}

export async function POST(request: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.redirect(
      new URL("/admin/login?error=Admin%20session%20required.", request.url)
    );
  }

  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const statesRaw = String(formData.get("states") || "").trim();
  const selectedChannels = formData
    .getAll("channel")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const channel = selectedChannels.join(", ");
  const states = statesRaw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (!name || !channel || states.length === 0) {
    return NextResponse.redirect(
      new URL(
        "/admin/lenders?error=Name,%20channel,%20and%20states%20are%20required.",
        request.url
      )
    );
  }

  const { error } = await supabaseAdmin.from("lenders").insert([
    {
      name,
      channel,
      states,
    },
  ]);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/lenders?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      "/admin/lenders?success=Lender%20created%20successfully.",
      request.url
    )
  );
}
