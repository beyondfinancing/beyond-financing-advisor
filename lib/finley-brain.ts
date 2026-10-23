// Finley's brain, shared by the screens that talk to her (team chat at /api/finley/chat and the Omi watch route).
// One source for the rules she must never break, the live lender/program catalog, and the watch-length answer.

import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { memoryBlockForStaff } from "@/lib/finley-memory";

export const FINLEY_MODEL = "claude-sonnet-5-5";

/** Statutory rules the matching engine already enforces — Finley never overrides them. */
export const FINLEY_STATUTORY_RULES = [
  "  • FHA / VA / USDA / Fannie Mae / Freddie Mac all require a valid SSN — ITIN, DACA, and Foreign National borrowers are NOT eligible for any of these agencies. Only Non-QM ITIN / Foreign-National portfolio programs can serve those borrowers. Never recommend a Fannie/Freddie/FHA/VA/USDA program to an ITIN, DACA, or Foreign National borrower.",
  "  • FHA / VA / USDA / Fannie / Freddie require full-doc or express-doc income — bank statements, DSCR, P&L, 1099, asset utilization, and WVOE are not eligible for those programs.",
  "  • VA additionally requires a valid Certificate of Eligibility (veteran / active-duty / qualifying spouse).",
];

// The catalog changes rarely; a warm serverless instance reuses it for 10 minutes.
let catalogCache: { at: number; text: string } | null = null;

/** Active wholesale lenders and their active programs, one line per lender (agencies excluded, like the match engine). */
export async function lenderCatalog(maxChars = 7000): Promise<string> {
  if (catalogCache && Date.now() - catalogCache.at < 10 * 60_000) return catalogCache.text;
  try {
    const { data } = await supabaseAdmin
      .from("programs")
      .select("name, loan_category, lenders ( name, lender_type )")
      .eq("is_active", true)
      .limit(2000);
    const byLender = new Map<string, Set<string>>();
    for (const p of (data ?? []) as Array<Record<string, unknown>>) {
      const l = (Array.isArray(p.lenders) ? p.lenders[0] : p.lenders) as Record<string, unknown> | null;
      if (!l?.name || l.lender_type === "agency") continue;
      const key = String(l.name);
      if (!byLender.has(key)) byLender.set(key, new Set());
      byLender.get(key)!.add(String(p.name ?? p.loan_category ?? "").trim());
    }
    const lines = [...byLender.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([lender, progs]) => `- ${lender}: ${[...progs].filter(Boolean).slice(0, 12).join("; ")}`);
    let text = lines.join("\n");
    if (text.length > maxChars) text = text.slice(0, maxChars) + "\n- …(more in the catalog)";
    catalogCache = { at: Date.now(), text };
    return text;
  } catch {
    return "";
  }
}

/** Matches "send / text / email / call / message / WhatsApp" in EN, PT and ES — anything that would reach another person. */
export const OUTBOUND_REQUEST = /\b(send|text|e-?mail|call|message|whatsapp|mand[ae]r?|envi[ae]r?|ligar?|llamar?|escrev[ae]r?|escrib[ie]r?)\b/i;

/**
 * Finley answering Sandro on his watch: 1–3 sentences, his language (EN / PT-BR / ES), the same rules and catalog as the
 * team chat, plus what Finley's shared memory may tell the owner about people he names. Version 1 never contacts anyone:
 * an outbound request is only acknowledged as logged for his approval.
 */
export async function askFinleyWatch(command: string, isOutbound: boolean, ownerEmail: string): Promise<string> {
  const [catalog, memory] = await Promise.all([lenderCatalog(), memoryBlockForStaff(ownerEmail, command).catch(() => "")]);
  const stable = [
    "You are Finley Beyond — the AI assistant of Sandro Pansini Souza, President of Beyond Financing, Inc. (NMLS #2394496), and a senior, plain-spoken mortgage advisor.",
    "He is speaking to you through his Omi wearable / Apple Watch: reply in 1–3 short sentences that fit a watch notification. Plain text only — no markdown, no lists.",
    "Reply in the language he used: English, Brazilian Portuguese, or Spanish.",
    "In this version you only answer questions and log tasks for him. You never contact clients, realtors, or anyone else, and you never say something was sent, called, or emailed.",
    "Never repeat borrower personal data (SSN, date of birth, account numbers) in a reply.",
    "Cite lender and program names only from the catalog below — never invent them. If you are not sure of a rate, guideline, or program detail, say so and suggest he verify it with the lender's AE. Never quote rates as guaranteed.",
    "Statutory rules you must respect:",
    ...FINLEY_STATUTORY_RULES,
    "",
    "ACTIVE LENDERS AND PROGRAMS (Beyond Intelligence catalog):",
    catalog || "  (catalog unavailable right now — mention it only if he asks which lender or program to use)",
  ].join("\n");
  const dynamic = (isOutbound
    ? "This request involves contacting someone: do NOT do it. Say in one sentence that you logged it for his approval in the Beyond Intelligence console."
    : "") + (memory || "");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 18_000, maxRetries: 0 });
  try {
    const res = await anthropic.messages.create({
      model: FINLEY_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: stable, cache_control: { type: "ephemeral" } },
        ...(dynamic ? [{ type: "text" as const, text: dynamic }] : []),
      ],
      messages: [{ role: "user", content: command.slice(0, 1000) }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (text) return text.slice(0, 600);
  } catch {
    /* fall through to the safe line */
  }
  return isOutbound ? "Logged for your approval in the Beyond Intelligence console — nothing was sent." : "Finley couldn't answer right now — your request was logged.";
}
