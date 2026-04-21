import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  createResetToken,
  hashResetToken,
  normalizeCredential,
} from "@/lib/team-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const credential = normalizeCredential(String(body?.credential || ""));

    if (!credential) {
      return NextResponse.json({ success: true });
    }

    const { data: users, error: userLookupError } = await supabaseAdmin
      .from("team_users")
      .select("id, full_name, email, is_active, credential")
      .or(`email.eq.${credential},credential.eq.${credential}`);

    if (userLookupError) {
      return NextResponse.json(
        { success: false, error: `User lookup failed: ${userLookupError.message}` },
        { status: 500 }
      );
    }

    const user = users?.[0];
    if (!user || !user.is_active) {
      return NextResponse.json({ success: true });
    }

    const rawToken = createResetToken();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("team_password_resets")
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      return NextResponse.json(
        { success: false, error: `Failed to create reset request: ${insertError.message}` },
        { status: 500 }
      );
    }

    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { success: false, error: "Missing APP_BASE_URL." },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const resetUrl = `${baseUrl}/team/reset-password?token=${rawToken}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
body: JSON.stringify({
  from: "Finley Beyond via Beyond Intelligence <finley@beyondfinancing.com>",
  to: [user.email],
  subject: "Reset your Beyond Intelligence™ Team Workspace Password",
  html: `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#263366;max-width:680px;margin:0 auto;padding:24px;">
            <h1 style="margin:0 0 18px 0;">Hello ${user.full_name},</h1>
            <p style="line-height:1.7;">We received a request to reset your team workspace password.</p>
            <p style="line-height:1.7;">This link expires in 30 minutes.</p>
            <p style="margin:24px 0;">
              <a href="${resetUrl}" style="display:inline-block;background:#263366;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">
                Reset Password
              </a>
            </p>
            <p style="line-height:1.7;">If you did not request this, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      return NextResponse.json(
        { success: false, error: `Resend failed: ${error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown reset error.",
      },
      { status: 500 }
    );
  }
}
