// app/handoff/[token]/route.ts
//
// Step 3 of the Professional Handoff workstream.
// The receiver for the magic link embedded in the LO summary emails.
//
// Flow:
//   GET /handoff/<token>
//     1. Validate token format / lookup row
//     2. Check token state (revoked / expired)
//     3. Read team-auth cookie; if absent → redirect to /team?next=<deep link>
//     4. Verify the team_user is active and has a /finley-eligible role
//        (Real Estate Agents are explicitly excluded — see /finley page)
//     5. Append an audit entry to the token's accesses JSONB
//        (best-effort — does NOT block the redirect on DB hiccup)
//     6. 302 to /finley?session=<intake_session_id>
//
// Step 4 will make /finley consume the ?session= param and hydrate. For now,
// the LO lands on the existing /finley page with the param sitting in the URL.

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { isUuid } from "@/lib/handoff";
import { verifySessionToken } from "@/lib/team-auth";

// Roles allowed in the Professional Thinking Layer. Mirrors the ALLOWED_ROLES
// list in app/finley/page.tsx. Real Estate Agents are explicitly excluded.
const PROFESSIONAL_ROLES = new Set([
  "Loan Officer",
  "Loan Officer Assistant",
  "Branch Manager",
  "Production Manager",
  "Processor",
]);

// Same cookie name as defined in lib/team-auth.ts. Keeping a local copy here
// because team-auth's read helper wants a NextRequest, but the App Router
// route handler signature gives us params, not req. We read directly with
// next/headers cookies() instead.
const SESSION_COOKIE = "bf_team_session";

type TokenRow = {
  id: string;
  intake_session_id: string;
  expires_at: string;
  revoked_at: string | null;
  accesses: unknown;
};

function clientIpFrom(forwarded: string | null): string | null {
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim();
  return first || null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  // Next 15: dynamic route params come back as a Promise.
  const { token } = await context.params;

  // ---------------------------------------------------------------------
  // 1. Validate token format. UUID-shaped values only — anything else
  //    is either someone hand-typing the URL or someone fishing.
  //    404 (not 400) — don't leak that we have a token table at all.
  // ---------------------------------------------------------------------
  if (!isUuid(token)) {
    return NextResponse.redirect(new URL("/handoff/forbidden", _req.url));
  }

  // ---------------------------------------------------------------------
  // 2. Look up the token. Service-role client — bypasses RLS.
  // ---------------------------------------------------------------------
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("professional_handoff_tokens")
    .select("id, intake_session_id, expires_at, revoked_at, accesses")
    .eq("id", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.redirect(new URL("/handoff/forbidden", _req.url));
  }

  const row = tokenRow as TokenRow;

  // ---------------------------------------------------------------------
  // 3. Token state checks. Order matters: revoked is more "final" than
  //    expired, so we surface revocation first if both happen to be true.
  // ---------------------------------------------------------------------
  if (row.revoked_at) {
    return NextResponse.redirect(new URL("/handoff/revoked", _req.url));
  }

  const now = Date.now();
  const expiresAtMs = new Date(row.expires_at).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
    return NextResponse.redirect(new URL("/handoff/expired", _req.url));
  }

  // ---------------------------------------------------------------------
  // 4. Team auth check. Read the signed cookie via next/headers (the
  //    helper in lib/team-auth.ts wants a NextRequest, which we don't
  //    have in this signature). If absent or invalid, kick to /team
  //    with a ?next= back to this same handoff URL — the team page
  //    auto-redirects after successful login.
  // ---------------------------------------------------------------------
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

  if (!session) {
    const handoffPath = `/handoff/${token}`;
    const teamUrl = new URL("/team", _req.url);
    teamUrl.searchParams.set("next", handoffPath);
    return NextResponse.redirect(teamUrl);
  }

  // ---------------------------------------------------------------------
  // 5. Role check. Confirm the team user is active and has a role that
  //    is permitted on /finley. Real Estate Agents fall through to the
  //    forbidden page with a clear "this link is for licensed mortgage
  //    professionals only" message.
  // ---------------------------------------------------------------------
  const { data: teamUser, error: teamUserError } = await supabaseAdmin
    .from("team_users")
    .select("id, role, is_active")
    .eq("id", session.userId)
    .maybeSingle();

  if (teamUserError || !teamUser || !teamUser.is_active) {
    return NextResponse.redirect(new URL("/handoff/forbidden", _req.url));
  }
  if (!PROFESSIONAL_ROLES.has(teamUser.role as string)) {
    return NextResponse.redirect(new URL("/handoff/forbidden", _req.url));
  }

  // ---------------------------------------------------------------------
  // 6. Audit log — append { team_user_id, opened_at, ip, user_agent } to
  //    the token's accesses JSONB. Best-effort: any DB hiccup here is
  //    swallowed so the redirect still completes. Audit gaps are far
  //    less painful than blocking a real LO from doing their work.
  // ---------------------------------------------------------------------
  try {
    const headerStore = await headers();
    const ip = clientIpFrom(headerStore.get("x-forwarded-for"));
    const userAgent = headerStore.get("user-agent") || null;

    const existing = Array.isArray(row.accesses) ? row.accesses : [];
    const next = [
      ...existing,
      {
        team_user_id: session.userId,
        opened_at: new Date().toISOString(),
        ip,
        user_agent: userAgent,
      },
    ];

    await supabaseAdmin
      .from("professional_handoff_tokens")
      .update({ accesses: next })
      .eq("id", row.id);
  } catch (err) {
    console.error("[handoff] access log update failed", err);
    // intentional fall-through — the redirect must still happen.
  }

  // ---------------------------------------------------------------------
  // 7. Redirect into /finley with the session id. Step 4 will make /finley
  //    consume this param and hydrate the transcript + intake.
  // ---------------------------------------------------------------------
  const finleyUrl = new URL("/finley", _req.url);
  finleyUrl.searchParams.set("session", row.intake_session_id);
  return NextResponse.redirect(finleyUrl);
}
