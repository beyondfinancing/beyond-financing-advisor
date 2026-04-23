import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Branch Manager"
  | "Real Estate Agent";

type UpdateUserPayload = {
  name?: string;
  email?: string;
  nmls?: string;
  role?: TeamRole;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
  isActive?: boolean;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

async function ensureAdminAccess() {
  try {
    await signInAdminSession();
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = normalizeString(params.id);

  if (!id) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  let body: UpdateUserPayload;

  try {
    body = (await req.json()) as UpdateUserPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};

  if ("name" in body) updatePayload.name = normalizeString(body.name);
  if ("email" in body)
    updatePayload.email = normalizeString(body.email).toLowerCase();
  if ("nmls" in body) updatePayload.nmls = normalizeString(body.nmls);
  if ("role" in body) updatePayload.role = normalizeString(body.role);
  if ("calendly" in body) updatePayload.calendly = normalizeString(body.calendly);
  if ("assistantEmail" in body) {
    updatePayload.assistant_email = normalizeString(body.assistantEmail).toLowerCase();
  }
  if ("phone" in body) updatePayload.phone = normalizeString(body.phone);
  if ("isActive" in body) updatePayload.is_active = Boolean(body.isActive);

  const { data, error } = await supabaseAdmin
    .from("team_users")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = normalizeString(params.id);

  if (!id) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("team_users")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
