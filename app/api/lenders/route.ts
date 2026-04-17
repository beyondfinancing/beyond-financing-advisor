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
  const action = String(formData.get("_action") || "create");

  if (action === "create") {
    const name = String(formData.get("name") || "").trim();
    const selectedChannels = formData
      .getAll("channel")
      .map((value) => String(value).trim())
      .filter(Boolean);

    const selectedStates = formData
      .getAll("states")
      .map((value) => String(value).trim().toUpperCase())
      .filter(Boolean);

    const channel = selectedChannels.join(", ");

    if (!name || !channel || selectedStates.length === 0) {
      return NextResponse.redirect(
        new URL(
          "/admin/lenders?error=Name,%20at%20least%20one%20channel,%20and%20at%20least%20one%20state%20are%20required.",
          request.url
        )
      );
    }

    const { error } = await supabaseAdmin.from("lenders").insert([
      {
        name,
        channel,
        states: selectedStates,
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

  if (action === "update") {
    const id = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();

    const selectedChannels = formData
      .getAll("channel")
      .map((value) => String(value).trim())
      .filter(Boolean);

    const selectedStates = formData
      .getAll("states")
      .map((value) => String(value).trim().toUpperCase())
      .filter(Boolean);

    const channel = selectedChannels.join(", ");

    if (!id || !name || !channel || selectedStates.length === 0) {
      return NextResponse.redirect(
        new URL(
          "/admin/lenders?error=All%20lender%20fields%20are%20required%20to%20update.",
          request.url
        )
      );
    }

    const { error } = await supabaseAdmin
      .from("lenders")
      .update({
        name,
        channel,
        states: selectedStates,
      })
      .eq("id", id);

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
        "/admin/lenders?success=Lender%20updated%20successfully.",
        request.url
      )
    );
  }

  if (action === "delete") {
    const id = String(formData.get("id") || "").trim();

    if (!id) {
      return NextResponse.redirect(
        new URL("/admin/lenders?error=Lender%20ID%20is%20required.", request.url)
      );
    }

    const { error } = await supabaseAdmin.from("lenders").delete().eq("id", id);

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
        "/admin/lenders?success=Lender%20deleted%20successfully.",
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/admin/lenders?error=Unsupported%20action.", request.url)
  );
}
