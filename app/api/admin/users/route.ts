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

type CreateUserPayload = {
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

export async function GET() {
  const auth = await ensureApprovedAdminAccess();

  if (!auth.ok) {
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
  const auth = await ensureApprovedAdminAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateUserPayload;

  try {
    body = (await req.json()) as CreateUserPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = normalizeString(body.name);
  const email = normalizeString(body.email).toLowerCase();
  const nmls = normalizeString(body.nmls);
  const role = normalizeString(body.role) as TeamRole;
  const calendly = normalizeString(body.calendly);
  const assistantEmail = normalizeString(body.assistantEmail).toLowerCase();
  const phone = normalizeString(body.phone);
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
      name,
      email,
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
