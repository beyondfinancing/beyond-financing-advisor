// =============================================================================
// app/api/finley-staff-poll/route.ts — Finley's late answer for a Duo-verified colleague (2026-10-26).
// When staff Finley takes longer than /api/chat waits, the Ask page keeps asking here and shows her answer in the
// chat (a WhatsApp copy can't arrive when WhatsApp's 24-hour window is closed). Employee pass only.
// =============================================================================
import { NextResponse } from "next/server";
import { readPass } from "@/lib/finley-gate";

export async function POST(req: Request) {
  const gate = readPass(req.headers.get("x-finley-pass"));
  if (!gate || gate.role !== "employee") return NextResponse.json({ error: "gate" }, { status: 401 });
  let b: { since?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/finley-gate-send`, {
    method: "POST",
    headers: { authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ channel: "staff_poll", email: gate.email, since: String(b.since || "") }),
  });
  const j = await r.json().catch(() => ({}));
  return NextResponse.json(j, { status: r.ok ? 200 : 502, headers: { "cache-control": "no-store" } });
}
