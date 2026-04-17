import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

function unauthorized(req: Request, isJson: boolean) {
  if (isJson) {
    return NextResponse.json(
      { success: false, error: "Admin authorization required." },
      { status: 401 }
    );
  }

  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}

export async function GET(req: Request) {
  const isJson = true;

  if (!(await isAdminSignedIn())) {
    return unauthorized(req, isJson);
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, users: data || [] });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!(await isAdminSignedIn())) {
    return unauthorized(req, isJson);
  }

  let name = "";
  let email = "";
  let nmls = "";
  let role = "";

  if (isJson) {
    const body = await req.json();
    name = String(body.name || "");
    email = String(body.email || "");
    nmls = String(body.nmls || "");
    role = String(body.role || "");
  } else {
    const formData = await req.formData();
    name = String(formData.get("name") || "");
    email = String(formData.get("email") || "");
    nmls = String(formData.get("nmls") || "");
    role = String(formData.get("role") || "");
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
    if (isJson) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/admin/users?error=${encodeURIComponent(error.message)}`, req.url),
      303
    );
  }

  if (isJson) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.redirect(new URL("/admin/users?success=created", req.url), 303);
}
