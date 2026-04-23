import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

type UpdateUserPayload = {
  name?: string;
  email?: string;
  nmls?: string;
  role?: string;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
  isActive?: boolean;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function ensureAdminApiAccess() {
  try {
    await signInAdminSession();
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const allowed = await ensureAdminApiAccess();

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await req.json()) as UpdateUserPayload;

  const updatePayload: Record<string, unknown> = {};

  if ("name" in body) {
    const name = clean(body.name);
    updatePayload.name = name;
    updatePayload.full_name = name;
  }

  if ("email" in body) updatePayload.email = clean(body.email).toLowerCase();
  if ("nmls" in body) updatePayload.nmls = clean(body.nmls);

  if ("role" in body) {
    const role = clean(body.role);
    updatePayload.role = role;
    updatePayload.credential = role;
  }

  if ("calendly" in body) updatePayload.calendly = clean(body.calendly);
  if ("assistantEmail" in body) {
    updatePayload.assistant_email = clean(body.assistantEmail).toLowerCase();
  }
  if ("phone" in body) updatePayload.phone = clean(body.phone);
  if ("isActive" in body) updatePayload.is_active = Boolean(body.isActive);

  const { data, error } = await supabaseAdmin
    .from("team_users")
    .update(updatePayload)
    .eq("id", clean(id))
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const allowed = await ensureAdminApiAccess();

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { error } = await supabaseAdmin
    .from("team_users")
    .delete()
    .eq("id", clean(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
