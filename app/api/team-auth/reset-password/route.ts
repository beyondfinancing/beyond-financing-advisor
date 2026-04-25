// =============================================================================
// PASTE THIS FILE AT (this is a NEW file — create the folder if needed):
//
//     app/api/team-auth/reset-password/route.ts
//
// =============================================================================
//
// PHASE 5-PREP — RESET PASSWORD (token redemption)
//
// Flow:
//
//   1. Caller POSTs { token, password } from the /team/reset-password page.
//   2. Hash the token via hashResetToken() to compare against
//      team_password_resets.token_hash.
//   3. Validate: row exists, expires_at > now(), used_at IS NULL.
//   4. If valid:
//      - hashPassword(newPassword) and update team_users.password_hash
//      - mark team_password_resets.used_at = now()
//   5. Return success.
//
// Security notes:
//
//   - Token is single-use. Once used_at is set, the token cannot be
//     redeemed again.
//   - Tokens expire 60 minutes after issuance.
//   - We never reveal whether a token was invalid because of expiry,
//     wrong format, or already-used. All bad-token cases return the
//     same generic error.
//
// =============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashPassword, hashResetToken } from "@/lib/team-auth";

type ResetBody = {
  token?: string;
  password?: string;
};

const GENERIC_INVALID =
  "This reset link is invalid or has expired. Please request a new one.";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResetBody;
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: GENERIC_INVALID },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);

    // -------------------------------------------------------------------------
    // Step 1 — Look up the reset record by token_hash.
    // -------------------------------------------------------------------------

    const { data: resetRow, error: resetError } = await supabaseAdmin
      .from("team_password_resets")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (resetError) {
      console.error("reset-password: token lookup failed.", resetError);
      return NextResponse.json(
        { success: false, error: "Server error." },
        { status: 500 }
      );
    }

    if (!resetRow) {
      console.log("reset-password: invalid token (no row).");
      return NextResponse.json(
        { success: false, error: GENERIC_INVALID },
        { status: 400 }
      );
    }

    if (resetRow.used_at) {
      console.log(`reset-password: token already used (id=${resetRow.id}).`);
      return NextResponse.json(
        { success: false, error: GENERIC_INVALID },
        { status: 400 }
      );
    }

    if (new Date(resetRow.expires_at) <= new Date()) {
      console.log(`reset-password: token expired (id=${resetRow.id}).`);
      return NextResponse.json(
        { success: false, error: GENERIC_INVALID },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // Step 2 — Hash and write the new password.
    // -------------------------------------------------------------------------

    const newHash = hashPassword(password);

    const { error: updateError } = await supabaseAdmin
      .from("team_users")
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resetRow.user_id);

    if (updateError) {
      console.error("reset-password: team_users update failed.", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update password." },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // Step 3 — Mark the reset token as used so it can't be reused.
    // -------------------------------------------------------------------------

    const { error: markError } = await supabaseAdmin
      .from("team_password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetRow.id);

    if (markError) {
      // Password was already updated successfully. Just log and move on.
      console.error("reset-password: failed to mark token used.", markError);
    }

    console.log(
      `reset-password: password successfully reset for user_id=${resetRow.user_id}.`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("reset-password: unhandled error.", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
