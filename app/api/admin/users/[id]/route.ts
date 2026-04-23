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

type SessionUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: TeamRole;
};

const APPROVED_ADMIN_EMAIL = "pansini@beyondfinancing.com";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

async function ensureApprovedAdminAccess() {
  try {
    const session = (await signInAdminSession()) as SessionUser | undefined;
    const email = normalizeString(session?.email).toLowerCase();

    if (email !== APPROVED_ADMIN_EMAIL) {
      return { ok: false as const, user: null };
    }

    return { ok: true as const, user: session ?? null };
  } catch {
    return { ok: false as const, user: null };
  }
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await ensureApprovedAdminAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const normalizedId = normalizeString(id);

  if (!normalizedId) {
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
  if ("email" in body) {
    updatePayload.email = normalizeString(body.email).toLowerCase();
  }
  if ("nmls" in body) updatePayload.nmls = normalizeString(body.nmls);
  if ("role" in body) updatePayload.role = normalizeString(body.role);
  if ("calendly" in body) {
    updatePayload.calendly = normalizeString(body.calendly);
  }
  if ("assistantEmail" in body) {
    updatePayload.assistant_email = normalizeString(
      body.assistantEmail
    ).toLowerCase();
  }
  if ("phone" in body) updatePayload.phone = normalizeString(body.phone);
  if ("isActive" in body) updatePayload.is_active = Boolean(body.isActive);

  const { data, error } = await supabaseAdmin
    .from("team_users")
    .update(updatePayload)
    .eq("id", normalizedId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await ensureApprovedAdminAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const normalizedId = normalizeString(id);

  if (!normalizedId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("team_users")
    .delete()
    .eq("id", normalizedId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
