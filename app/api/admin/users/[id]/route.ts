// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/admin/users/[id]/route.ts
//
// =============================================================================
//
// PHASE 5-prep-C — Admin user PATCH/DELETE with dual-write
//
// What this does:
//
// PATCH /api/admin/users/{id}
//   1. Updates the legacy team_users row (preserves existing behavior).
//   2. ALSO syncs to the proper matrix table based on role:
//        - role = 'Real Estate Agent' → upserts realtors row by email
//        - role = 'Loan Officer'      → upserts employees row by email
//        - other roles                → only legacy team_users (no matrix sync
//                                       needed; non-borrower-facing roles)
//   3. licensed_states is included in the matrix sync. Empty array if role
//      doesn't have state licenses.
//
// DELETE /api/admin/users/{id}
//   Unchanged from before. Only deletes from team_users.
//
// =============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

const DEFAULT_TENANT_SUBDOMAIN = "bf";

type UpdateUserPayload = {
  name?: string;
  email?: string;
  nmls?: string;
  role?: string;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
  isActive?: boolean;
  licensedStates?: string[];
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStateCode(value: string): string {
  return clean(value).toUpperCase().slice(0, 2);
}

async function ensureAdminApiAccess() {
  try {
    await signInAdminSession();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

async function syncRealtor(args: {
  fullName: string;
  email: string;
  phone: string;
  mlsId: string;
  isActive: boolean;
  licensedStates: string[];
}) {
  const { fullName, email, phone, mlsId, isActive, licensedStates } = args;

  if (!email) return { ok: false, error: "Missing realtor email." };

  // Check existence
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from("realtors")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) {
    return { ok: false, error: `realtors lookup failed: ${lookupErr.message}` };
  }

  if (existing) {
    const { error: updErr } = await supabaseAdmin
      .from("realtors")
      .update({
        full_name: fullName,
        phone: phone || null,
        mls_id: mlsId || null,
        is_active: isActive,
        licensed_states: licensedStates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updErr) {
      return { ok: false, error: `realtors update failed: ${updErr.message}` };
    }
    return { ok: true };
  }

  // INSERT new realtor row
  const { error: insErr } = await supabaseAdmin.from("realtors").insert({
    full_name: fullName,
    email,
    phone: phone || null,
    mls_id: mlsId || null,
    is_active: isActive,
    licensed_states: licensedStates,
  });

  if (insErr) {
    return { ok: false, error: `realtors insert failed: ${insErr.message}` };
  }
  return { ok: true };
}

async function syncEmployee(args: {
  fullName: string;
  email: string;
  phone: string;
  nmls: string;
  role: string;
  calendly: string;
  isActive: boolean;
  licensedStates: string[];
}) {
  const {
    fullName,
    email,
    phone,
    nmls,
    role,
    calendly,
    isActive,
    licensedStates,
  } = args;

  if (!email) return { ok: false, error: "Missing employee email." };

  // Check existence
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) {
    return { ok: false, error: `employees lookup failed: ${lookupErr.message}` };
  }

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      phone: phone || null,
      nmls: nmls || null,
      role,
      is_active: isActive,
      licensed_states: licensedStates,
      updated_at: new Date().toISOString(),
    };
    if (calendly) updatePayload.calendly_url = calendly;

    const { error: updErr } = await supabaseAdmin
      .from("employees")
      .update(updatePayload)
      .eq("id", existing.id);

    if (updErr) {
      return { ok: false, error: `employees update failed: ${updErr.message}` };
    }
    return { ok: true };
  }

  // INSERT — need tenant_id (NOT NULL). Look up BF tenant.
  const { data: tenantRow, error: tenantErr } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("subdomain", DEFAULT_TENANT_SUBDOMAIN)
    .eq("is_active", true)
    .maybeSingle();

  if (tenantErr || !tenantRow) {
    return {
      ok: false,
      error: `tenant lookup failed: ${tenantErr?.message || "BF tenant not found"}`,
    };
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantRow.id,
    full_name: fullName,
    email,
    phone: phone || null,
    nmls: nmls || null,
    role,
    is_active: isActive,
    licensed_states: licensedStates,
  };
  if (calendly) insertPayload.calendly_url = calendly;

  const { error: insErr } = await supabaseAdmin
    .from("employees")
    .insert(insertPayload);

  if (insErr) {
    return { ok: false, error: `employees insert failed: ${insErr.message}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// PATCH handler
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, context: RouteContext) {
  const allowed = await ensureAdminApiAccess();
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await req.json()) as UpdateUserPayload;

  const updatePayload: Record<string, unknown> = {};

  // Build legacy team_users payload (no licensed_states column there)
  if ("name" in body) {
    const name = clean(body.name);
    updatePayload.name = name;
    updatePayload.full_name = name;
  }
  if ("email" in body) {
    updatePayload.email = clean(body.email).toLowerCase();
  }
  if ("nmls" in body) {
    updatePayload.nmls = clean(body.nmls);
  }
  if ("role" in body) {
    const role = clean(body.role);
    updatePayload.role = role;
    updatePayload.credential = role;
  }
  if ("calendly" in body) {
    updatePayload.calendly = clean(body.calendly);
  }
  if ("assistantEmail" in body) {
    updatePayload.assistant_email = clean(body.assistantEmail).toLowerCase();
  }
  if ("phone" in body) {
    updatePayload.phone = clean(body.phone);
  }
  if ("isActive" in body) {
    updatePayload.is_active = Boolean(body.isActive);
  }

  const { data: legacy, error: legacyErr } = await supabaseAdmin
    .from("team_users")
    .update(updatePayload)
    .eq("id", clean(id))
    .select("*")
    .single();

  if (legacyErr) {
    return NextResponse.json({ error: legacyErr.message }, { status: 500 });
  }

  // -------------------------------------------------------------------------
  // Phase 5-prep-C: dual-write to matrix tables based on role
  // -------------------------------------------------------------------------

  const finalRole = clean(body.role || legacy.role || "");
  const finalEmail = clean(body.email || legacy.email || "").toLowerCase();
  const finalName = clean(body.name || legacy.full_name || legacy.name || "");
  const finalPhone = clean(body.phone || legacy.phone || "");
  const finalNmls = clean(body.nmls || legacy.nmls || "");
  const finalCalendly = clean(body.calendly || legacy.calendly || "");
  const finalIsActive = "isActive" in body
    ? Boolean(body.isActive)
    : Boolean(legacy.is_active ?? true);

  const rawLicensedStates = Array.isArray(body.licensedStates)
    ? body.licensedStates
    : [];
  const normalizedLicensedStates = Array.from(
    new Set(
      rawLicensedStates
        .map((s) => normalizeStateCode(String(s)))
        .filter((s) => s.length === 2)
    )
  ).sort();

  let syncWarning: string | null = null;

  if (finalRole === "Real Estate Agent" && finalEmail) {
    const result = await syncRealtor({
      fullName: finalName,
      email: finalEmail,
      phone: finalPhone,
      mlsId: finalNmls,
      isActive: finalIsActive,
      licensedStates: normalizedLicensedStates,
    });

    if (!result.ok) {
      console.error("admin/users PATCH: realtor sync failed.", result.error);
      syncWarning = result.error || "Realtor sync failed.";
    }
  } else if (finalRole === "Loan Officer" && finalEmail) {
    const result = await syncEmployee({
      fullName: finalName,
      email: finalEmail,
      phone: finalPhone,
      nmls: finalNmls,
      role: finalRole,
      calendly: finalCalendly,
      isActive: finalIsActive,
      licensedStates: normalizedLicensedStates,
    });

    if (!result.ok) {
      console.error("admin/users PATCH: employee sync failed.", result.error);
      syncWarning = result.error || "Employee sync failed.";
    }
  } else if (
    finalRole === "Loan Officer Assistant" ||
    finalRole === "Processor" ||
    finalRole === "Production Manager" ||
    finalRole === "Branch Manager"
  ) {
    // Sync these to employees too (no licensed_states needed)
    const result = await syncEmployee({
      fullName: finalName,
      email: finalEmail,
      phone: finalPhone,
      nmls: finalNmls,
      role: finalRole,
      calendly: finalCalendly,
      isActive: finalIsActive,
      licensedStates: [],
    });

    if (!result.ok) {
      console.error(
        "admin/users PATCH: non-LO employee sync failed.",
        result.error
      );
      syncWarning = result.error || "Employee sync failed.";
    }
  }

  const responseBody: Record<string, unknown> = {
    success: true,
    user: legacy,
  };
  if (syncWarning) responseBody.syncWarning = syncWarning;

  return NextResponse.json(responseBody);
}

// ---------------------------------------------------------------------------
// DELETE handler — unchanged behavior
// ---------------------------------------------------------------------------

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
