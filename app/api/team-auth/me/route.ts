import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCurrentTenantId, getSessionFromRequest } from "@/lib/team-auth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from("team_users")
      .select(
        "id, full_name, email, credential, role, calendly, assistant_email, phone, is_active"
      )
      .eq("id", session.userId)
      .single();

    if (error || !user || !user.is_active) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      tenantId: getCurrentTenantId(req),
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
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
