// Finley x Omi — Sandro's real-time voice commands from the Omi app / Apple Watch (owner 2026-10-23).
//
// Omi posts each live transcript chunk here (Settings → Developer Mode → Developer Settings → "Real-Time Transcript
// Webhook" = https://beyondintelligence.io/api/omi/realtime?key=<OMI_WEBHOOK_KEY>; Omi appends uid and session_id).
// When Sandro himself (is_user: true) says "Finley, …", Finley answers in 1–3 sentences and Omi shows the reply as a
// notification on his phone / watch. Version 1 answers questions and logs tasks only: anything that would reach
// another person is logged as pending_approval and never sent (no unsolicited contact).
//
// Env: OMI_WEBHOOK_KEY (secret in the URL), OMI_OWNER_UID (Sandro's Omi uid — copy it from the first call's log),
//      SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL (lib/supabase), ANTHROPIC_API_KEY.
// Table: public.omi_commands (supabase/migrations/20261023000000_omi_commands.sql).

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { askFinleyWatch, OUTBOUND_REQUEST } from "@/lib/finley-brain";

export const runtime = "nodejs";
export const maxDuration = 25; // Omi treats a reply slower than 30 s as failed

const OWNER_EMAIL = "pansini@beyondfinancing.com";

type Seg = { text?: string; is_user?: boolean; start?: number; speaker?: string };

// Wake word, tolerant of common mis-transcriptions; the command is whatever follows it in the same segment.
const WAKE = /\b(finley|finlay|finly|finli|findley|finlee|finleigh)\b[,.:!]?\s*(.*)$/i;
// Omi heard "Finley, what is…" as "Feeling, what is…" (2026-10-23). Looser sound-alikes count only as the first word of
// the segment and followed by a pause mark, so "I'm feeling good" never wakes her.
const WAKE_LOOSE = /^\s*(?:hey|hi|ok|okay|oi|ei)?[,\s]*(feeling|filling|finn? lee|fin ley|findlay)[,.:!?]\s*(.+)$/i;

function keyOk(given: string | null): boolean {
  const want = process.env.OMI_WEBHOOK_KEY ?? "";
  if (!want || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  // 1) Lock the door: the secret key, and only Sandro's Omi account once OMI_OWNER_UID is set.
  if (!keyOk(q.get("key"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = q.get("uid") ?? "";
  if (!process.env.OMI_OWNER_UID) console.log("[omi] first call — set OMI_OWNER_UID to this uid:", uid);
  else if (uid !== process.env.OMI_OWNER_UID) return NextResponse.json({ ok: true });

  // 2) Omi sends either an array of segments or { session_id, segments }.
  const body = await req.json().catch(() => null);
  const segments: Seg[] = Array.isArray(body) ? body : Array.isArray(body?.segments) ? body.segments : [];
  const sessionId = q.get("session_id") ?? (typeof body?.session_id === "string" ? body.session_id : "") ?? "";

  // 3) Only Sandro's own voice — never what a client says near him.
  for (const seg of segments) {
    if (seg?.is_user !== true || !seg.text) continue;
    const m = seg.text.match(WAKE) ?? seg.text.match(WAKE_LOOSE);
    const command = (m?.[2] ?? "").trim();
    if (command.length < 3) continue;

    const isOutbound = OUTBOUND_REQUEST.test(command);
    const segStart = typeof seg.start === "number" ? seg.start : 0;

    // 4) Dedupe: the unique (session_id, seg_start) insert fails if this segment was already handled.
    const { error } = await supabaseAdmin.from("omi_commands").insert({
      session_id: sessionId || "no-session",
      seg_start: segStart,
      command: command.slice(0, 1000),
      status: isOutbound ? "pending_approval" : "logged",
    });
    if (error) continue;

    const reply = await askFinleyWatch(command, isOutbound, OWNER_EMAIL);
    await supabaseAdmin.from("omi_commands").update({ reply }).eq("session_id", sessionId || "no-session").eq("seg_start", segStart);

    // 5) Omi shows `message` (over 5 characters) as a notification on the phone / watch.
    return NextResponse.json({ message: reply });
  }

  return NextResponse.json({ ok: true });
}
