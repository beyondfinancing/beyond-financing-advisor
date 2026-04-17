import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();

  const { name, channel, states } = body;

  const { error } = await supabase.from("lenders").insert([
    {
      name,
      channel,
      states,
    },
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
