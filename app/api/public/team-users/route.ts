// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/public/team-users/route.ts
//
// =============================================================================
//
// PHASE 3.1 — UPDATE AFTER SECONDARY-ROLE-FLAG PATCH
//
// What this version changes vs. the prior Phase 3 version:
//
//   1. Removed the unaliasEmail() helper. There are no more "+lo" aliases
//      in the database — Sandro is one row with role='Loan Officer' and
//      is_branch_manager=true. Real emails everywhere.
//
//   2. The borrower picker now shows each loan officer ONCE, never twice.
//
//   3. Added is_branch_manager to the employee SELECT so future endpoints
//      that need to check Branch Manager privileges have the data already
//      in flight. The borrower-facing response shape does NOT expose this
//      flag — borrowers don't need to know who is a Branch Manager.
//
// What this version preserves:
//
//   1. Same response shape: { success: boolean, users: [...] }
//   2. Same item fields: id, name, email, nmls, role, calendly,
//                        assistantEmail, phone
//   3. Same query parameters: ?role= and ?q=
//   4. Tenant filtering defaults to Beyond Financing ('bf').
//
// =============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Type definitions matching the existing public contract
// -----------------------------------------------------------------------------

type TeamUserRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Branch Manager"
  | "Real Estate Agent";

type PublicTeamUser = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  role: TeamUserRole;
  calendly?: string;
  assistantEmail?: string;
  phone?: string;
};

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Default tenant for any request that doesn't specify one. In Phase 7 we
// will derive this from the request subdomain instead of hardcoding it.
const DEFAULT_TENANT_SUBDOMAIN = "bf";

// Roles that the borrower-facing endpoint considers part of the mortgage
// company team. Note that "Branch Manager" is intentionally absent from
// this list because Branch Manager is now a flag (is_branch_manager) on
// a person who is ALSO a Loan Officer or holds another primary role.
const BORROWER_FACING_ROLES: TeamUserRole[] = [
  "Loan Officer",
  "Loan Officer Assistant",
  "Processor",
  "Production Manager",
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeRole(value: string | null | undefined): TeamUserRole | null {
  const role = String(value || "").trim();
  if (
    role === "Loan Officer" ||
    role === "Loan Officer Assistant" ||
    role === "Processor" ||
    role === "Production Manager" ||
    role === "Branch Manager" ||
    role === "Real Estate Agent"
  ) {
    return role as TeamUserRole;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role");
    const query = String(url.searchParams.get("q") || "")
      .trim()
      .toLowerCase();

    // -------------------------------------------------------------------------
    // Resolve the tenant. For now hardcoded to 'bf' (Beyond Financing).
    // -------------------------------------------------------------------------

    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, subdomain")
      .eq("subdomain", DEFAULT_TENANT_SUBDOMAIN)
      .eq("is_active", true)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json(
        { success: false, error: `Tenant lookup failed: ${tenantError.message}` },
        { status: 500 }
      );
    }

    if (!tenantData) {
      return NextResponse.json(
        {
          success: false,
          error: `No active tenant found for subdomain '${DEFAULT_TENANT_SUBDOMAIN}'.`,
        },
        { status: 500 }
      );
    }

    const tenantId = tenantData.id as string;

    // -------------------------------------------------------------------------
    // Pull employees for the tenant
    // -------------------------------------------------------------------------

    let employeeRequest = supabaseAdmin
      .from("employees")
      .select(
        "id, full_name, email, nmls, role, calendly_url, phone, is_active, is_branch_manager"
      )
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("role", BORROWER_FACING_ROLES)
      .order("full_name", { ascending: true });

    if (roleParam) {
      const normalized = normalizeRole(roleParam);
      if (!normalized) {
        return NextResponse.json(
          { success: false, error: `Unknown role: ${roleParam}` },
          { status: 400 }
        );
      }
      // Special case: if a caller asks for role='Branch Manager', we
      // return employees with is_branch_manager=true regardless of their
      // primary role. This preserves the legacy behavior of the old
      // endpoint where "Branch Manager" was a queryable role.
      if (normalized === "Branch Manager") {
        employeeRequest = supabaseAdmin
          .from("employees")
          .select(
            "id, full_name, email, nmls, role, calendly_url, phone, is_active, is_branch_manager"
          )
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .eq("is_branch_manager", true)
          .order("full_name", { ascending: true });
      } else if (normalized !== "Real Estate Agent") {
        employeeRequest = employeeRequest.eq("role", normalized);
      }
    }

    const { data: employeeRows, error: employeeError } =
      roleParam === "Real Estate Agent"
        ? { data: [], error: null }
        : await employeeRequest;

    if (employeeError) {
      return NextResponse.json(
        { success: false, error: `Employee lookup failed: ${employeeError.message}` },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // Build a map of LO -> first-active-assistant email so we can populate
    // assistantEmail on each Loan Officer row.
    // -------------------------------------------------------------------------

    const employeeIdSet = new Set<string>(
      (employeeRows || []).map((e) => String(e.id))
    );

    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("lo_assistant_assignments")
      .select("loan_officer_id, assistant_id, is_active")
      .eq("is_active", true);

    if (assignmentError) {
      return NextResponse.json(
        {
          success: false,
          error: `LO assignment lookup failed: ${assignmentError.message}`,
        },
        { status: 500 }
      );
    }

    // We need to know each assistant's email. Build a separate lookup of
    // ALL active assistants in the tenant (not just the ones returned by
    // the role filter above) so we can resolve assistant emails even if
    // the caller is filtering for ?role=Loan%20Officer only.
    const { data: assistantRows, error: assistantError } = await supabaseAdmin
      .from("employees")
      .select("id, email")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("role", "Loan Officer Assistant");

    if (assistantError) {
      return NextResponse.json(
        {
          success: false,
          error: `Assistant lookup failed: ${assistantError.message}`,
        },
        { status: 500 }
      );
    }

    const emailById: Record<string, string> = {};
    for (const a of assistantRows || []) {
      emailById[String(a.id)] = String(a.email || "");
    }

    const firstAssistantEmailByLo: Record<string, string> = {};
    for (const a of assignments || []) {
      const loId = String(a.loan_officer_id);
      const asstId = String(a.assistant_id);
      if (firstAssistantEmailByLo[loId]) continue;
      const email = emailById[asstId];
      if (email) firstAssistantEmailByLo[loId] = email;
    }

    // -------------------------------------------------------------------------
    // Pull realtors (separate entity, no tenant filter — realtors are global)
    // -------------------------------------------------------------------------

    const { data: realtorRows, error: realtorError } = await supabaseAdmin
      .from("realtors")
      .select("id, full_name, email, phone, mls_id, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (realtorError) {
      return NextResponse.json(
        { success: false, error: `Realtor lookup failed: ${realtorError.message}` },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // Shape the unified response in the LEGACY format expected by /borrower
    // -------------------------------------------------------------------------

    const employeeUsers: PublicTeamUser[] = (employeeRows || [])
      .map((row) => {
        const role = normalizeRole(row.role);
        if (!role) return null;
        const name = String(row.full_name || "").trim();
        const email = String(row.email || "").trim();
        if (!name || !email) return null;

        // For loan officers we want to surface the assigned assistant.
        // For Branch Manager flag carriers we surface their primary role
        // (Loan Officer in Sandro's case) so the borrower picker sees
        // them in the LO group.
        const surfaceRole: TeamUserRole = role;

        return {
          id: String(row.id),
          name,
          email,
          nmls: String(row.nmls || ""),
          role: surfaceRole,
          calendly: String(row.calendly_url || ""),
          assistantEmail:
            surfaceRole === "Loan Officer"
              ? firstAssistantEmailByLo[String(row.id)] || ""
              : "",
          phone: String(row.phone || ""),
        };
      })
      .filter(Boolean) as PublicTeamUser[];

    const realtorUsers: PublicTeamUser[] = (realtorRows || []).map((row) => ({
      id: String(row.id),
      name: String(row.full_name || "").trim(),
      email: String(row.email || "").trim(),
      nmls: String(row.mls_id || ""),
      role: "Real Estate Agent" as const,
      calendly: "",
      assistantEmail: "",
      phone: String(row.phone || ""),
    }));

    let combined: PublicTeamUser[];
    if (roleParam === "Real Estate Agent") {
      combined = realtorUsers;
    } else if (roleParam) {
      combined = employeeUsers;
    } else {
      combined = [...employeeUsers, ...realtorUsers];
    }

    // -------------------------------------------------------------------------
    // Free-text search filter
    // -------------------------------------------------------------------------

    const filtered = query
      ? combined.filter((user) =>
          [user.name, user.email, user.nmls, user.role, user.phone || ""]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : combined;

    return NextResponse.json({ success: true, users: filtered });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to load team users.",
      },
      { status: 500 }
    );
  }
}
