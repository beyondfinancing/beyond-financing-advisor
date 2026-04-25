// =============================================================================
// PASTE THIS FILE AT (this is a NEW file — create the folder if needed):
//
//     app/api/team-auth/request-reset/route.ts
//
// =============================================================================
//
// PHASE 5-PREP — REQUEST PASSWORD RESET
//
// Flow:
//
//   1. Caller POSTs { email } from the /team page's Forgot Password form.
//   2. We look up team_users by email (case-insensitive).
//   3. If found AND active:
//      - Generate a fresh plaintext token via createResetToken()
//      - Store hashResetToken(token) in team_password_resets with 60-min expiry
//      - Send a Resend email containing the link
//        https://beyondintelligence.io/team/reset-password?token=<plaintext>
//   4. ALWAYS return success regardless of whether the email exists.
//      This is anti-enumeration: never tell callers which emails are real.
//
// =============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createResetToken, hashResetToken } from "@/lib/team-auth";

const FROM_ADDRESS = "Finley Beyond <finley@beyondfinancing.com>";
const RESET_TOKEN_TTL_MINUTES = 60;
const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://beyondintelligence.io";

type RequestResetBody = {
  email?: string;
};

function buildResetEmailHtml(displayName: string, resetUrl: string): string {
  // Plain, professional reset email. Keep the HTML simple — many email
  // clients render only a subset of CSS.
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 14px 0;font-size:22px;color:#263366;">Reset your team password</h1>
      <p style="line-height:1.7;margin:0 0 14px 0;">Hello ${displayName || "there"},</p>
      <p style="line-height:1.7;margin:0 0 14px 0;">
        We received a request to reset the password on your Beyond Intelligence&trade; team account.
        Click the button below to choose a new password. This link is valid for ${RESET_TOKEN_TTL_MINUTES} minutes.
      </p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 22px;background-color:#263366;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:700;">
          Reset password
        </a>
      </p>
      <p style="line-height:1.6;margin:0 0 14px 0;color:#52607a;font-size:13px;">
        If the button doesn't work, copy and paste this link into your browser:<br />
        <a href="${resetUrl}" style="color:#0284C7;word-break:break-all;">${resetUrl}</a>
      </p>
      <p style="line-height:1.6;margin:0 0 14px 0;color:#52607a;font-size:13px;">
        If you did not request a password reset, you can safely ignore this email. Your account is unchanged.
      </p>
      <p style="line-height:1.6;margin:24px 0 0 0;color:#52607a;font-size:12px;">
        Beyond Intelligence&trade; &middot; Team Mortgage Intelligence
      </p>
    </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestResetBody;
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email is required." },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("request-reset: RESEND_API_KEY is not configured.");
      // Still return success so the caller experience is identical to
      // the no-account case. We just can't actually send.
      return NextResponse.json({ success: true });
    }

    // -------------------------------------------------------------------------
    // Step 1 — Look up the team_users row.
    // -------------------------------------------------------------------------

    const { data: user, error: userError } = await supabaseAdmin
      .from("team_users")
      .select("id, full_name, email, role, is_active")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.error("request-reset: team_users lookup failed.", userError);
      return NextResponse.json({ success: true });
    }

    // Anti-enumeration: if no row OR user inactive, return success without
    // sending. The caller experience is the same either way.
    if (!user || !user.is_active) {
      console.log(
        `request-reset: ignored (no active user for email='${email}').`
      );
      return NextResponse.json({ success: true });
    }

    // -------------------------------------------------------------------------
    // Step 2 — Generate token, store its hash, send the email.
    // -------------------------------------------------------------------------

    const plaintextToken = createResetToken();
    const tokenHash = hashResetToken(plaintextToken);
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("team_password_resets")
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("request-reset: token insert failed.", insertError);
      return NextResponse.json({ success: true });
    }

    const resetUrl = `${APP_BASE_URL}/team/reset-password?token=${plaintextToken}`;
    const html = buildResetEmailHtml(user.full_name || "", resetUrl);

    const sendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [user.email],
        subject: "Reset your Beyond Intelligence team password",
        html,
      }),
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text();
      console.error("request-reset: Resend send failed.", {
        email: user.email,
        statusCode: sendResp.status,
        body: errText,
      });
      // Still return success — same response shape to avoid leaking state.
      return NextResponse.json({ success: true });
    }

    console.log(`request-reset: reset email sent to ${user.email}.`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("request-reset: unhandled error.", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
