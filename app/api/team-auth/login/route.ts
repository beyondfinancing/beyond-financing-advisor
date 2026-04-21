import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  normalizeCredential,
  setTeamSessionCookie,
  verifyPassword,
} from "@/lib/team-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const credential = normalizeCredential(String(body?.credential || ""));
    const password = String(body?.password || "").trim();

    if (!credential || !password) {
      return NextResponse.json(
        { success: false, error: "Missing credential or password." },
        { status: 400 }
      );
    }

    const { data: users, error } = await supabaseAdmin
      .from("team_users")
      .select(
        "id, full_name, email, credential, role, password_hash, calendly, assistant_email, phone, is_active"
      )
      .or(`credential.eq.${credential},email.eq.${credential}`);

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to query user." },
        { status: 500 }
      );
    }

    const user = users?.[0];

    if (!user || !user.is_active) {
      return NextResponse.json(
        { success: false, error: "Invalid credential or password." },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { success: false, error: "Invalid credential or password." },
        { status: 401 }
      );
    }

    await setTeamSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        nmls: user.credential,
        role: user.role,
        calendly: user.calendly,
        assistantEmail: user.assistant_email,
        phone: user.phone,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
