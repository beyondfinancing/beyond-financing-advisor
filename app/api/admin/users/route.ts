import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();

  const { name, email, role, nmls } = body;

  const { error } = await supabase.from("users").insert([
    {
      name,
      email,
      role,
      nmls,
    },
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
