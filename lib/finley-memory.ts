// FINLEY ONE MEMORY — the website's door into the memory every Finley shares (WhatsApp, phone, website,
// Beyond AI). Owner, 2026-10-20: "make it one Finley that knows her guardrails depending on who she is
// speaking to". Plan: BIS/docs/FINLEY-ONE-MEMORY-PLAN-2026-10-20.md.
//
// ⚠️ The boundary lives in the database (finley_context gate), never in a prompt. Reads go only through it.
// ⚠️ A website BORROWER is not identity-verified (anyone can type any email), so the borrower chat only
//    WRITES — it never reads memory back. Staff on /finley read, as themselves, through the gate.
// ⚠️ Memory never blocks or breaks a chat: every call here swallows its own errors.
import { supabaseAdmin } from "@/lib/supabase";

const OWNER = "pansini@beyondfinancing.com";

export function personKey(phone?: string | null, email?: string | null): string | null {
  const ten = String(phone ?? "").replace(/\D/g, "").slice(-10);
  if (ten.length === 10) return "+1" + ten;
  const em = String(email ?? "").trim().toLowerCase();
  return em ? "email:" + em : null;
}

export async function remember(e: {
  key: string | null; kind?: string; name?: string; channel: "web_borrower" | "web_pro";
  persona: "client" | "team"; direction: "in" | "out"; text: string;
  visibility?: "subject" | "team" | "owner"; sourceTable: string; sourceId: string;
}): Promise<void> {
  if (!e.key || !e.text.trim()) return;
  try {
    const { error } = await supabaseAdmin.rpc("finley_remember", {
      p_key: e.key, p_kind: e.kind ?? "unknown", p_name: e.name ?? null, p_channel: e.channel, p_persona: e.persona,
      p_direction: e.direction, p_text: e.text.slice(0, 1000), p_loan: null, p_visibility: e.visibility ?? "subject",
      p_source_table: e.sourceTable, p_source_id: e.sourceId, p_actor: null,
    });
    if (error) console.error("finley_remember", error.message);
  } catch (err) {
    console.error("finley_remember", err);
  }
}

type Viewer = { kind: "owner" | "team"; key: string };
export function staffViewer(email: string): Viewer | null {
  const em = String(email ?? "").trim().toLowerCase();
  if (!em) return null;
  return { kind: em === OWNER ? "owner" : "team", key: em };
}

async function recall(viewer: Viewer, subjectKey: string, limit = 6) {
  try {
    const { data, error } = await supabaseAdmin.rpc("finley_context", {
      p_viewer_kind: viewer.kind, p_viewer_key: viewer.key, p_subject_key: subjectKey, p_limit: limit,
    });
    if (error || !data?.allowed) return null;
    const tl = (data.timeline ?? []) as Array<Record<string, unknown>>;
    const pr = (data.open_promises ?? []) as Array<Record<string, unknown>>;
    return {
      person: data.person as Record<string, unknown>,
      history: tl.slice().reverse().map((t) =>
        `${new Date(String(t.at)).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${t.channel} · ${t.direction === "in" ? "they said" : t.direction === "out" ? "Finley said" : "note"}: ${t.summary}`),
      open_promises: pr.map((x) => `${x.what}${x.who ? ` (owner: ${x.who})` : ""}`),
    };
  } catch {
    return null;
  }
}

/** People a staff member names in their message, with what THEY may know about each (max 3), as a prompt block. */
export async function memoryBlockForStaff(email: string, text: string): Promise<string> {
  const viewer = staffViewer(email);
  if (!viewer) return "";
  const words = (String(text).match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\b/g) ?? []).slice(0, 12);
  const seen = new Set<string>(), lines: string[] = [];
  for (const w of words) {
    if (lines.length >= 3) break;
    try {
      const { data } = await supabaseAdmin.rpc("finley_find", { p_name: w, p_limit: 2 });
      for (const p of (data ?? []) as Array<Record<string, string>>) {
        if (seen.has(p.person_key) || lines.length >= 3) continue;
        seen.add(p.person_key);
        const r = await recall(viewer, p.person_key);
        if (!r) continue;
        lines.push(`- ${p.name}${p.company ? ` (${p.company})` : ""}, ${p.kind}: ${r.history.slice(-4).join(" | ") || "no history yet"}${r.open_promises.length ? ` | OPEN PROMISES: ${r.open_promises.join("; ")}` : ""}`);
      }
    } catch { /* memory never breaks the chat */ }
  }
  if (!lines.length) return "";
  return `\n\nSHARED FINLEY MEMORY (what Finley on WhatsApp, phone or this site already knows about people named in this message — only what this colleague may see). Use it naturally if relevant; never invent anything beyond it:\n${lines.join("\n")}`;
}
