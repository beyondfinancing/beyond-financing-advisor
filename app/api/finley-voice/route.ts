// =============================================================================
// app/api/finley-voice/route.ts — Finley's natural voice on the website (2026-10-26).
// Owner: website Finley was "talking like a robot, not the same experience we have with Finley on the phone and on
// BIS". The browser's built-in voice is replaced by the same warm voice as the Beyond iPhone/Watch app
// (beyond-speak, Gemini TTS). Only for a visitor holding a verified Finley pass; nothing is stored.
// =============================================================================
import { NextResponse } from "next/server";
import { readPass } from "@/lib/finley-gate";

export async function POST(req: Request) {
  if (!readPass(req.headers.get("x-finley-pass"))) return NextResponse.json({ error: "gate" }, { status: 401 });
  let b: { text?: string; lang?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const text = String(b.text || "").trim().slice(0, 1500);
  if (!text) return NextResponse.json({ error: "text" }, { status: 400 });
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/beyond-speak`, {
    method: "POST",
    headers: { authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, lang: String(b.lang || "en") }),
  });
  if (!r.ok || !(r.headers.get("content-type") || "").includes("audio")) return NextResponse.json({ error: "voice" }, { status: 502 });
  return new Response(await r.arrayBuffer(), { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
}
