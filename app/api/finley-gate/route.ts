// =============================================================================
// app/api/finley-gate/route.ts — who is talking to Finley on the website (2026-10-26).
//
// Owner: "before taking questions, user must type name, phone number and email ... and choose either a call, a
// text, a whatsapp or email to receive a code to continue ... that code being enabled also gives her consent for
// communications further." "A dropdown ... Employee, Business Partner or Client ... if an employee, she can
// request DUO authentication at the spot." "A realtor can also confirm ... Finley will request sending in a
// verification to the Realtor information on file."
//
//   start      {role,name,email,phone,channel,lang,agree}  -> {id, sent_to} | {id, duo:{code}} | {pass}
//   verify     {id, code}                                   -> {pass, role, name}
//   duo_status {id}                                         -> {waiting} | {pass, role, name} | {error}
//
// Codes: 6 digits, 10 minutes, 5 tries, stored only as a hash. Partners get the code at the contact ON FILE
// (BRE|HQ), not the one typed. Employees: Duo push (number match) to their company login; if Duo can't be used
// from here, a code to their @beyondfinancing.com mailbox. Limits per IP and per email stop floods.
// Text and call codes are not wired yet (no SMS/voice sender in this app) — the screen says so.
// =============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from Supabase (untyped client) */
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { hashCode, issuePass, type GateRole } from "@/lib/finley-gate";
import { CONSENT } from "@/lib/finley-consent";

const FN = (name: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`;
const s = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
const ten = (v: unknown) => { const d = String(v ?? "").replace(/\D/g, ""); return d.length === 11 && d.startsWith("1") ? d.slice(1) : d; };
const mask = (v: string) => v.includes("@") ? v.replace(/^(.).*(@.*)$/, "$1•••$2") : "•••-•••-" + v.slice(-4);
const json = (o: unknown, status = 200) => NextResponse.json(o, { status, headers: { "cache-control": "no-store" } });

async function send(channel: string, to: string, code: string, lang: string) {
  const r = await fetch(FN("finley-gate-send"), {
    method: "POST",
    headers: { authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ channel, to, code, lang }),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; why?: string };
  return !!j.ok;
}

async function mfa(body: Record<string, unknown>) {
  const r = await fetch(FN("bis-mfa"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, app: "FINLEY-WEB" }) });
  return (await r.json().catch(() => ({}))) as Record<string, unknown>;
}

/** On success: the visitor's consent goes into the same records every Finley channel reads. */
async function recordConsent(row: Record<string, any>) {
  const phone10 = ten(row.phone);
  if (row.role === "employee" || phone10.length !== 10) return;
  const key = row.role === "partner" && String(row.matched || "").startsWith("brehq_partner:")
    ? "realtor:" + String(row.matched).split(":")[1] : (row.role === "partner" ? "partner:" : "client:") + phone10;
  const now = new Date().toISOString();
  const wording = CONSENT[row.lang] || CONSENT.en;
  await supabaseAdmin.from("bf_contact_prefs").upsert({
    person_key: key, party: row.role === "partner" ? "realtor" : "borrower", email: row.email, phone: "+1" + phone10,
    calls_finley: true, whatsapp: true, sms: true, reminders: true, updated_at: now,
  });
  await supabaseAdmin.from("bf_contact_consent_log").insert(["calls_finley", "whatsapp", "sms", "reminders"].map((channel) => ({
    person_key: key, channel, granted: true, phone: "+1" + phone10, wording, source: "website_gate:" + row.id,
    ip: row.ip ?? null, user_agent: row.user_agent ?? null,
  })));
}

function passFor(row: Record<string, any>) {
  return issuePass({ gid: row.id, role: row.role as GateRole, name: row.name, email: row.email, listed: !!row.matched });
}

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = s(b.action, 20);
  const ip = s((req.headers.get("x-forwarded-for") || "").split(",")[0], 60);
  const ua = s(req.headers.get("user-agent"), 300);

  if (action === "start") {
    const role = s(b.role, 20) as GateRole, name = s(b.name, 80), email = s(b.email, 120).toLowerCase(), phone = ten(b.phone);
    const lang = ["en", "pt", "es"].includes(s(b.lang)) ? s(b.lang) : "en";
    let channel = s(b.channel, 20);
    if (!["client", "partner", "employee"].includes(role)) return json({ error: "role" }, 400);
    if (name.length < 2) return json({ error: "name" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email" }, 400);
    if (role !== "employee" && phone.length !== 10) return json({ error: "phone" }, 400);
    if (role !== "employee" && b.agree !== true) return json({ error: "agree" }, 400);
    if (role !== "employee" && !["email", "whatsapp"].includes(channel)) return json({ error: "channel" }, 400);

    // Flood guard: 6 attempts an hour per address, 4 per email.
    const hour = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: byIp }, { count: byEmail }] = await Promise.all([
      supabaseAdmin.from("finley_web_gate").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", hour),
      supabaseAdmin.from("finley_web_gate").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", hour),
    ]);
    if ((byIp ?? 0) >= 6 || (byEmail ?? 0) >= 4) return json({ error: "limit" }, 429);

    let sentTo = channel === "email" ? email : "+1" + phone, matched: string | null = null;
    let serial = "";
    if (role === "partner") {
      // Verify against what we have on file: the code goes to the partner's OWN contact, not the typed one.
      const { data: ps } = await supabaseAdmin.from("brc_realtor_partner").select("realtor_id, email, phone_e164, partner_status").eq("partner_status", "ACTIVE");
      const hit = (ps ?? []).find((p: any) => String(p.email || "").toLowerCase() === email || ten(p.phone_e164) === phone);
      if (hit) {
        matched = "brehq_partner:" + hit.realtor_id;
        if (channel === "email" && hit.email) sentTo = String(hit.email).toLowerCase();
        if (channel === "whatsapp" && ten(hit.phone_e164).length === 10) sentTo = "+1" + ten(hit.phone_e164);
      }
    }
    if (role === "employee") {
      if (!email.endsWith("@beyondfinancing.com")) return json({ error: "employee_email" }, 400);
      const { data: lic } = await supabaseAdmin.from("bf_licenses").select("serial, disabled").eq("email", email);
      const live = (lic ?? []).find((l: any) => !l.disabled);
      if (!live) return json({ error: "employee_unknown" }, 403);
      serial = String(live.serial);
      matched = "license:" + serial;
      channel = "duo"; sentTo = email;
    }

    const id = crypto.randomUUID();
    const row: Record<string, unknown> = {
      id, role, name, email, phone: phone ? "+1" + phone : null, channel, sent_to: sentTo, matched, lang,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), consent_wording: role === "employee" ? null : CONSENT[lang], ip, user_agent: ua,
    };

    if (role === "employee") {
      const pre = await mfa({ serial, email, action: "preauth", ipaddr: ip });
      if (pre.mode === "push" && pre.txid !== undefined) {
        const pushed = await mfa({ serial, email, action: "push", txid: pre.txid, ipaddr: ip });
        row.duo_txid = String(pushed.txid || pre.txid);
        await supabaseAdmin.from("finley_web_gate").insert(row);
        return json({ id, duo: { code: String(pre.verification_code || "") } });
      }
      if (pre.mode === "allow") {
        row.verified_at = new Date().toISOString();
        await supabaseAdmin.from("finley_web_gate").insert(row);
        return json({ pass: passFor(row), role, name });
      }
      // Duo can't be used from here (not enrolled, denied, or unavailable): a code to the company mailbox instead.
      row.channel = "email";
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    row.code_hash = hashCode(id, code);
    await supabaseAdmin.from("finley_web_gate").insert(row);
    const ok = await send(String(row.channel), sentTo, code, lang);
    if (!ok) return json({ error: "send" }, 502);
    return json({ id, sent_to: mask(sentTo), on_file: !!matched && role === "partner" });
  }

  if (action === "verify" || action === "duo_status") {
    const id = s(b.id, 40);
    const { data: row } = await supabaseAdmin.from("finley_web_gate").select("*").eq("id", id).maybeSingle();
    if (!row) return json({ error: "expired" }, 400);
    if (row.verified_at) return json({ pass: passFor(row), role: row.role, name: row.name });
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 400);

    if (action === "duo_status") {
      if (!row.duo_txid) return json({ error: "expired" }, 400);
      const st = await mfa({ serial: String(row.matched).split(":")[1], email: row.email, action: "status", txid: row.duo_txid, ipaddr: ip });
      if (st.result === "allow") {
        await supabaseAdmin.from("finley_web_gate").update({ verified_at: new Date().toISOString() }).eq("id", id);
        return json({ pass: passFor(row), role: row.role, name: row.name });
      }
      return st.result === "deny" ? json({ error: "denied" }, 403) : json({ waiting: true });
    }

    if (row.tries >= 5) return json({ error: "tries" }, 429);
    await supabaseAdmin.from("finley_web_gate").update({ tries: row.tries + 1 }).eq("id", id);
    if (hashCode(id, s(b.code, 10).replace(/\D/g, "")) !== row.code_hash) return json({ error: "code" }, 400);
    await supabaseAdmin.from("finley_web_gate").update({ verified_at: new Date().toISOString() }).eq("id", id);
    try { await recordConsent(row); } catch (e) { console.error("finley-gate consent", e); }
    return json({ pass: passFor(row), role: row.role, name: row.name });
  }

  return json({ error: "unknown action" }, 400);
}
