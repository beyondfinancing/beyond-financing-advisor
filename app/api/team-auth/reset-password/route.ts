import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashPassword, hashResetToken } from "@/lib/team-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "").trim();

    if (!token || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Invalid token or password too short." },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);

    const { data: rows, error } = await supabaseAdmin
      .from("team_password_resets")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !rows?.length) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset token." },
        { status: 400 }
      );
    }

    const resetRow = rows[0];
    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset token." },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);

    const { error: updateUserError } = await supabaseAdmin
      .from("team_users")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", resetRow.user_id);

    if (updateUserError) {
      return NextResponse.json(
        { success: false, error: "Failed to update password." },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("team_password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetRow.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
