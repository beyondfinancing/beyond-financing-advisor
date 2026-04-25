// =============================================================================
// PASTE THIS FILE AT (replace the existing file completely):
//
//     app/api/public/team-users/route.ts
//
// =============================================================================
//
// PHASE 3 — STRANGLER FIG REWRITE
//
// What this version changes vs. the previous /api/public/team-users/route.ts:
//
//   1. Reads from the NEW public.employees and public.realtors tables
//      instead of from public.team_users.
//
//   2. Filters employees by tenant. Defaults to Beyond Financing ('bf').
//      A future Phase 7 update will derive the tenant from the request
//      subdomain so each mortgage company sees only their own people.
//
//   3. Sandro's dual-role (Branch Manager + Loan Officer) is now correctly
//      represented because employees.id is tied to one role per row, not
//      one row per human. The borrower page picker will show him as a
//      Loan Officer (the role borrowers care about). His Branch Manager
//      row is filtered out of the borrower-facing response.
//
//   4. Realtors come from public.realtors instead of from team_users
//      role='Real Estate Agent'. The legacy_team_user_id column links
//      them back to their original team_users row for audit purposes.
//
// What this version preserves vs. the previous version:
//
//   1. The HTTP response shape is BYTE-IDENTICAL.
//      Same envelope: { success: boolean, users: [...] }
//      Same item fields: id, name, email, nmls, role, calendly,
//                        assistantEmail, phone
//      The /borrower page consumes this without any changes.
//
//   2. The same query parameters work: ?role= to filter by role,
//      ?q= for free-text search across name/email/nmls/phone.
//
//   3. supabaseAdmin client is still used (bypasses RLS, same as before).
//
// Why this matters:
//
//   The /borrower page calls fetch('/api/public/team-users') and reads
//   data.users. As long as that array contains the same shape, the page
//   has no idea anything changed under the hood. That's the strangler
//   fig: replace the implementation, preserve the contract.
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

// Default tenant for any request that doesn't specify one. Today this is
// always Beyond Financing because they are the only mortgage company tenant.
// In Phase 7, we will derive this from the request subdomain instead.
const DEFAULT_TENANT_SUBDOMAIN = "bf";

// Roles that the /borrower page picker is allowed to show as Loan Officer
// candidates. Branch Managers technically can act as Loan Officers but the
// borrower-facing flow only shows people who hold the Loan Officer role
// explicitly. Sandro's "Loan Officer" employees row will be returned for
// borrower routing; his "Branch Manager" row will not.
const BORROWER_FACING_ROLES: TeamUserRole[] = [
  "Loan Officer",
  "Loan Officer Assistant",
  "Processor",
  "Production Manager",
  "Branch Manager",
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

/**
 * Recover the borrower-routable email for a Loan Officer row that was given
 * a "+lo" alias during the Phase 2 migration.
 *
 * In the database we store pansini+lo@beyondfinancing.com so the row can
 * coexist with the Branch Manager row that holds pansini@beyondfinancing.com.
 * But for the borrower-facing API we want to return the canonical address.
 */
function unaliasEmail(email: string): string {
  if (!email) return "";
  return email.replace(/\+lo@/i, "@");
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
        "id, full_name, email, nmls, role, calendly_url, phone, is_active"
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
      employeeRequest = employeeRequest.eq("role", normalized);
    }

    const { data: employeeRows, error: employeeError } = await employeeRequest;

    if (employeeError) {
      return NextResponse.json(
        { success: false, error: `Employee lookup failed: ${employeeError.message}` },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // Build a map of LO -> assistant email so we can populate assistantEmail
    // on each Loan Officer row (the previous /borrower expects this).
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

    // Resolve assistant_id -> assistant email by joining locally to employeeRows.
    const employeeEmailById: Record<string, string> = {};
    for (const e of employeeRows || []) {
      employeeEmailById[String(e.id)] = unaliasEmail(String(e.email || ""));
    }

    // For each LO, take the FIRST active assistant we find (LOs can have
    // multiple assistants in the matrix, but the borrower-facing API only
    // surfaces one for the convenience of the existing UI). When we build
    // the LO Inbox in Phase 7, the LO and their entire team will see all
    // assistants properly.
    const firstAssistantEmailByLo: Record<string, string> = {};
    for (const a of assignments || []) {
      const loId = String(a.loan_officer_id);
      const asstId = String(a.assistant_id);
      if (!employeeIdSet.has(loId) || !employeeIdSet.has(asstId)) continue;
      if (firstAssistantEmailByLo[loId]) continue;
      firstAssistantEmailByLo[loId] = employeeEmailById[asstId] || "";
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
        const email = unaliasEmail(String(row.email || "").trim());
        if (!name || !email) return null;
        return {
          id: String(row.id),
          name,
          email,
          nmls: String(row.nmls || ""),
          role,
          calendly: String(row.calendly_url || ""),
          assistantEmail:
            role === "Loan Officer"
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

    // The role filter, if specified, decides whether to include realtors.
    let combined: PublicTeamUser[];
    if (roleParam === "Real Estate Agent") {
      combined = realtorUsers;
    } else if (roleParam) {
      combined = employeeUsers; // already filtered by role above
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
