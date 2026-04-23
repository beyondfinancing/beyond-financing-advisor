import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

function normalizeRole(value: string | null): TeamUserRole | null {
  const role = String(value || "").trim();

  if (
    role === "Loan Officer" ||
    role === "Loan Officer Assistant" ||
    role === "Processor" ||
    role === "Production Manager" ||
    role === "Branch Manager" ||
    role === "Real Estate Agent"
  ) {
    return role;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role");
    const query = String(url.searchParams.get("q") || "")
      .trim()
      .toLowerCase();

    let request = supabaseAdmin
      .from("team_users")
      .select(
        "id,name,full_name,email,nmls,role,calendly,assistant_email,phone,is_active"
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (roleParam) {
      request = request.eq("role", roleParam);
    }

    const { data, error } = await request;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const users: PublicTeamUser[] = (data || [])
      .map((user: any) => {
        const role = normalizeRole(user.role);
        if (!role) return null;

        const name = String(user.name || user.full_name || "").trim();
        const email = String(user.email || "").trim();

        if (!name || !email) return null;

        return {
          id: String(user.id),
          name,
          email,
          nmls: String(user.nmls || ""),
          role,
          calendly: String(user.calendly || ""),
          assistantEmail: String(user.assistant_email || ""),
          phone: String(user.phone || ""),
        };
      })
      .filter(Boolean) as PublicTeamUser[];

    const filtered = query
      ? users.filter((user) =>
          [
            user.name,
            user.email,
            user.nmls,
            user.role,
            user.phone,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : users;

    return NextResponse.json({ success: true, users: filtered });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load team users.",
      },
      { status: 500 }
    );
  }
}
