import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  nmls: string | null;
  mobile: string | null;
  assistantemail: string | null;
  assistantmobile: string | null;
  apply_url: string | null;
  schedule_url: string | null;
  company_name: string | null;
  created_at: string | null;
};

const PUBLIC_SELECTABLE_ROLES = ["Loan Officer", "Loan Officer Assistant"];

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function isSelectableBorrowerRole(role: unknown): boolean {
  const normalized = normalizeString(role).toLowerCase();
  return PUBLIC_SELECTABLE_ROLES.some(
    (allowed) => allowed.toLowerCase() === normalized
  );
}

function sanitizePublicUser(row: UserRow) {
  return {
    id: normalizeString(row.id),
    name: normalizeString(row.name),
    email: normalizeString(row.email),
    role: normalizeString(row.role),
    nmls: normalizeString(row.nmls),
    mobile: normalizeString(row.mobile),
    assistantemail: normalizeString(row.assistantemail),
    assistantmobile: normalizeString(row.assistantmobile),
    apply_url: normalizeString(row.apply_url),
    schedule_url: normalizeString(row.schedule_url),
    company_name: normalizeString(row.company_name),
  };
}

function sanitizeAdminUser(row: UserRow) {
  return {
    id: normalizeString(row.id),
    name: normalizeString(row.name),
    email: normalizeString(row.email),
    role: normalizeString(row.role),
    nmls: normalizeString(row.nmls),
    mobile: normalizeString(row.mobile),
    assistantemail: normalizeString(row.assistantemail),
    assistantmobile: normalizeString(row.assistantmobile),
    apply_url: normalizeString(row.apply_url),
    schedule_url: normalizeString(row.schedule_url),
    company_name: normalizeString(row.company_name),
    created_at: row.created_at,
  };
}

async function ensureAdminAccess() {
  try {
    await signInAdminSession();
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public";

    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, name, email, role, nmls, mobile, assistantemail, assistantmobile, apply_url, schedule_url, company_name, created_at"
      )
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as UserRow[];

    if (scope === "all") {
      const isAdmin = await ensureAdminAccess();

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        users: rows.map(sanitizeAdminUser),
      });
    }

    const publicUsers = rows
      .filter((row) => {
        const hasName = !!normalizeString(row.name);
        const hasEmail = !!normalizeString(row.email);
        return hasName && hasEmail && isSelectableBorrowerRole(row.role);
      })
      .map(sanitizePublicUser);

    return NextResponse.json(publicUsers);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Server error while loading users.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const payload = {
      name: normalizeString(body?.name),
      email: normalizeString(body?.email),
      role: normalizeString(body?.role),
      nmls: normalizeString(body?.nmls),
      mobile: normalizeString(body?.mobile),
      assistantemail: normalizeString(body?.assistantemail),
      assistantmobile: normalizeString(body?.assistantmobile),
      apply_url: normalizeString(body?.apply_url),
      schedule_url: normalizeString(body?.schedule_url),
      company_name: normalizeString(body?.company_name),
    };

    if (!payload.name || !payload.email || !payload.role) {
      return NextResponse.json(
        { success: false, error: "Name, email, and role are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert([payload])
      .select(
        "id, name, email, role, nmls, mobile, assistantemail, assistantmobile, apply_url, schedule_url, company_name, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: sanitizeAdminUser(data as UserRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Server error while creating user.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const id = normalizeString(body?.id);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User id is required." },
        { status: 400 }
      );
    }

    const updates = {
      name: normalizeString(body?.name),
      email: normalizeString(body?.email),
      role: normalizeString(body?.role),
      nmls: normalizeString(body?.nmls),
      mobile: normalizeString(body?.mobile),
      assistantemail: normalizeString(body?.assistantemail),
      assistantmobile: normalizeString(body?.assistantmobile),
      apply_url: normalizeString(body?.apply_url),
      schedule_url: normalizeString(body?.schedule_url),
      company_name: normalizeString(body?.company_name),
    };

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", id)
      .select(
        "id, name, email, role, nmls, mobile, assistantemail, assistantmobile, apply_url, schedule_url, company_name, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: sanitizeAdminUser(data as UserRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Server error while updating user.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const id = req.nextUrl.searchParams.get("id")?.trim() || "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User id is required." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Server error while deleting user.",
      },
      { status: 500 }
    );
  }
}
