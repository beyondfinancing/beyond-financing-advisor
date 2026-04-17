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
    .from("lenders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, lenders: data || [] });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!(await isAdminSignedIn())) {
    return unauthorized(req, isJson);
  }

  let name = "";
  let channel = "";
  let statesRaw = "";

  if (isJson) {
    const body = await req.json();
    name = String(body.name || "");
    channel = String(body.channel || "");
    statesRaw = String(body.states || "");
  } else {
    const formData = await req.formData();
    name = String(formData.get("name") || "");
    channel = String(formData.get("channel") || "");
    statesRaw = String(formData.get("states") || "");
  }

  const states = statesRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const { error } = await supabaseAdmin.from("lenders").insert([
    {
      name,
      channel,
      states,
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
      new URL(`/admin/lenders?error=${encodeURIComponent(error.message)}`, req.url),
      303
    );
  }

  if (isJson) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.redirect(
    new URL("/admin/lenders?success=created", req.url),
    303
  );
}
