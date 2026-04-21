import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://beyondintelligence.io";

const TEAM_TABLE = "team_users"; // change only if your actual table uses a different name

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const credential = String(body?.credential || "").trim().toLowerCase();

    if (!credential) {
      return NextResponse.json(
        { error: "Credential is required." },
        { status: 400 }
      );
    }

    const isEmail = credential.includes("@");

    let email = "";

    if (isEmail) {
      email = credential;
    } else {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from(TEAM_TABLE)
        .select("email")
        .eq("credential", credential)
        .maybeSingle();

      if (profileError) {
        console.error("Team lookup error:", profileError);
      }

      email = profile?.email?.toLowerCase?.() || "";
    }

    if (!email) {
      return NextResponse.json({
        ok: true,
        message:
          "If the credential matches an active user, a reset link has been sent.",
      });
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${APP_URL}/team/reset-password`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Reset link generation error:", linkError);
      return NextResponse.json({
        ok: true,
        message:
          "If the credential matches an active user, a reset link has been sent.",
      });
    }

    const resetLink = linkData.properties.action_link;

    await resend.emails.send({
      from: "Beyond Intelligence <noreply@beyondfinancing.com>",
      to: email,
      subject: "Reset your Beyond Intelligence Team Workspace password",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #263366; line-height: 1.6;">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your Team Workspace password.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#1495C2;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
              Reset Password
            </a>
          </p>
          <p>If you did not request this, you may ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({
      ok: true,
      message:
        "If the credential matches an active user, a reset link has been sent.",
    });
  } catch (error) {
    console.error("team-reset route error:", error);

    return NextResponse.json({
      ok: true,
      message:
        "If the credential matches an active user, a reset link has been sent.",
    });
  }
}
