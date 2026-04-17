import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();

  const { credit, ltv, dti, occupancy } = body;

  const { data, error } = await supabase
    .from("programs")
    .select("*, lenders(name)");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const matches = data.filter((p: any) => {
    return (
      credit >= p.min_credit &&
      ltv <= p.max_ltv &&
      dti <= p.max_dti &&
      (!p.occupancy ||
        p.occupancy.toLowerCase() === occupancy.toLowerCase())
    );
  });

  return Response.json({ matches });
}
