import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

type CreateUserPayload = {
  name?: string;
  email?: string;
  nmls?: string;
  role?: string;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
  isActive?: boolean;
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

export async function GET() {
  const allowed = await ensureAdminApiAccess();

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("team_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, users: data ?? [] });
}

export async function POST(req: Request) {
  const allowed = await ensureAdminApiAccess();

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateUserPayload;

  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const nmls = clean(body.nmls);
  const role = clean(body.role);
  const calendly = clean(body.calendly);
  const assistantEmail = clean(body.assistantEmail).toLowerCase();
  const phone = clean(body.phone);
  const isActive = Boolean(body.isActive ?? true);

  if (!name || !email || !role) {
    return NextResponse.json(
      { error: "Name, email, and role are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("team_users")
    .insert({
      full_name: name,
      name,
      email,
      credential: role,
      password_hash: "",
      nmls,
      role,
      calendly,
      assistant_email: assistantEmail,
      phone,
      is_active: isActive,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data });
}
