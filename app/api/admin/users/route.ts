import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
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
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const nmls = String(formData.get("nmls") || "").trim();
    const role = String(formData.get("role") || "").trim();

    if (!name || !email || !nmls || !role) {
      return NextResponse.redirect(
        new URL(
          "/admin/users?error=Name,%20email,%20login%20ID,%20and%20role%20are%20required.",
          request.url
        )
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
      new URL(
        "/admin/users?success=User%20created%20successfully.",
        request.url
      )
    );
  }

  if (action === "update") {
    const id = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const nmls = String(formData.get("nmls") || "").trim();
    const role = String(formData.get("role") || "").trim();

    if (!id || !name || !email || !nmls || !role) {
      return NextResponse.redirect(
        new URL(
          "/admin/users?error=All%20user%20fields%20are%20required%20to%20update.",
          request.url
        )
      );
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
      return NextResponse.redirect(
        new URL(
          `/admin/users?error=${encodeURIComponent(error.message)}`,
          request.url
        )
      );
    }

    return NextResponse.redirect(
      new URL(
        "/admin/users?success=User%20updated%20successfully.",
        request.url
      )
    );
  }

  if (action === "delete") {
    const id = String(formData.get("id") || "").trim();

    if (!id) {
      return NextResponse.redirect(
        new URL("/admin/users?error=User%20ID%20is%20required.", request.url)
      );
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", id);

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/admin/users?error=${encodeURIComponent(error.message)}`,
          request.url
        )
      );
    }

    return NextResponse.redirect(
      new URL(
        "/admin/users?success=User%20deleted%20successfully.",
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/admin/users?error=Unsupported%20action.", request.url)
  );
}
