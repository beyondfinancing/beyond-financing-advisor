// lib/handoff.ts
//
// Shared helpers for the Professional Handoff workstream.
// Used by /api/borrower-intake, /api/chat-summary, and (in Step 3)
// /api/handoff/[token] to manage handoff tokens consistently.
//
// Design:
//   - One active token per borrower_intake_session at any given time. If a
//     valid (non-revoked, non-expired) token already exists, reuse it. Else
//     create a new one. This means both LO emails (intake + summary) embed
//     the same link, and audit history accumulates on a single row.
//   - All operations are best-effort. On DB hiccup we return null and the
//     caller proceeds without a link rather than failing the email.
//   - Service-role only (RLS bypass). Never call from client code.
//
// IMPORTANT: We accept a SupabaseClient rather than constructing one. The
// existing routes both inline createClient() to dodge a TypeScript inference
// gotcha around RPC overloads (see TYPESCRIPT GOTCHAS in the project notes).
// Importing supabaseAdmin from "@/lib/supabase" would also work but reusing
// the caller's client keeps things consistent.

import type { SupabaseClient } from "@supabase/supabase-js";
import { BF_TENANT_UUID_FALLBACK } from "./team-auth";

// UUID v4 (and v1/v3/v5) shape check. Cheap defense against malformed values
// that would otherwise throw at the Postgres uuid column.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Build the public-facing handoff URL.
 *
 * Falls back to https://beyondintelligence.io if APP_BASE_URL is missing
 * (which it shouldn't be — set in Vercel env). The trailing slash on
 * APP_BASE_URL is tolerated.
 */
export function buildHandoffLink(tokenId: string): string {
  const raw =
    process.env.APP_BASE_URL?.trim() || "https://beyondintelligence.io";
  const base = raw.replace(/\/+$/, "");
  return `${base}/handoff/${tokenId}`;
}

/**
 * Look up an active token for this intake session, or create one.
 *
 * "Active" = revoked_at IS NULL AND expires_at > now(). If multiple match
 * (shouldn't happen but defending), we take the most recently created.
 *
 * Returns the token id (uuid) on success, null on any failure. Best-effort
 * by design — emails should still go out if this fails.
 */
export async function getOrCreateHandoffToken(
  supabase: SupabaseClient,
  intakeSessionId: string,
  tenantId?: string
): Promise<string | null> {
  if (!isUuid(intakeSessionId)) return null;

  try {
    // Try to reuse an active token first.
    const nowIso = new Date().toISOString();
    const { data: existing, error: lookupError } = await supabase
      .from("professional_handoff_tokens")
      .select("id")
      .eq("intake_session_id", intakeSessionId)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lookupError && existing) {
      return (existing as { id: string }).id;
    }

    // None active — create a new one. expires_at default (now + 14 days)
    // and accesses default ([]) come from the table schema.
    const { data: created, error: insertError } = await supabase
      .from("professional_handoff_tokens")
      .insert({ intake_session_id: intakeSessionId, tenant_id: tenantId ?? BF_TENANT_UUID_FALLBACK })
      .select("id")
      .single();

    if (insertError || !created) {
      console.error(
        "[handoff] getOrCreateHandoffToken: INSERT failed",
        insertError
      );
      return null;
    }

    return (created as { id: string }).id;
  } catch (err) {
    console.error("[handoff] getOrCreateHandoffToken: unexpected error", err);
    return null;
  }
}
