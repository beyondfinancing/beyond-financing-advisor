// =============================================================================
// app/api/finley/chat/route.ts
// =============================================================================
//
// Finley free-form conversation endpoint.
//
// The /finley page previously had a 100% client-side, deterministic
// sendToFinley() handler that returned a single canned string regardless of
// what the user typed. This endpoint replaces that with a real LLM-backed
// conversation that is grounded in:
//
//   - The current QualificationInput (state, status, occupancy, income, etc.)
//   - The latest /api/match output (strong/conditional/eliminated buckets +
//     lender_summary so Finley can cite real program and lender names).
//   - The full prior chat history so multi-turn reasoning works.
//
// Provider: OpenAI gpt-4o-mini for speed + cost (same pattern as
// app/api/chat/route.ts). Temperature 0.3 for grounded, precise answers.
//
// Auth: bf_team_session cookie required (LO/team only).
//
// Body shape:
//   {
//     messages: { role: "user" | "assistant"; content: string }[],
//     form?: Record<string, unknown>,
//     strong_matches?: unknown[],
//     conditional_matches?: unknown[],
//     eliminated_paths?: unknown[],
//     top_recommendation?: string | null,
//     next_question?: string | null,
//     lender_summary?: Record<string, unknown> | null
//   }
//
// Response 200: { success: true, reply: string }
// Response 400/401/500: { success: false, error: string }
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/team-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ChatMessage = { role: "user" | "assistant"; content: string };

// -----------------------------------------------------------------------------
// Defensive helpers — trim oversized arrays so the LLM context stays tight.
// -----------------------------------------------------------------------------

function clamp<T>(arr: unknown, max: number): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, max) as T[];
}

function safeStr(v: unknown, max = 4000): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.substring(0, max) + "…[truncated]" : s;
}

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(ctx: {
  form: Record<string, unknown>;
  strong: unknown[];
  conditional: unknown[];
  eliminated: unknown[];
  topRecommendation: string;
  nextQuestion: string;
  lenderSummary: Record<string, unknown>;
}): string {
  const formLines = Object.entries(ctx.form)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `  - ${k}: ${safeStr(v, 200)}`)
    .join("\n");

  // Strong + Conditional get more detail; Eliminated is summarized.
  const strongLines = clamp<Record<string, unknown>>(ctx.strong, 10)
    .map((m, i) => {
      const blockers = clamp<string>(m.blockers, 4).join("; ");
      const concerns = clamp<string>(m.concerns, 4).join("; ");
      const missing = clamp<string>(m.missing_items, 4).join("; ");
      return `  ${i + 1}. ${m.program_name || "?"} via ${m.lender_name || "?"} (score ${m.score ?? "?"}). Concerns: ${concerns || "none"}. Missing: ${missing || "none"}. Blockers: ${blockers || "none"}.`;
    })
    .join("\n");

  const conditionalLines = clamp<Record<string, unknown>>(ctx.conditional, 10)
    .map((m, i) => {
      const blockers = clamp<string>(m.blockers, 4).join("; ");
      const concerns = clamp<string>(m.concerns, 4).join("; ");
      const missing = clamp<string>(m.missing_items, 4).join("; ");
      return `  ${i + 1}. ${m.program_name || "?"} via ${m.lender_name || "?"} (score ${m.score ?? "?"}). Concerns: ${concerns || "none"}. Missing: ${missing || "none"}. Blockers: ${blockers || "none"}.`;
    })
    .join("\n");

  // Eliminated — group by reason, surface top 12 distinct reasons.
  const eliminatedReasons = new Map<string, number>();
  for (const m of clamp<Record<string, unknown>>(ctx.eliminated, 200)) {
    const blockers = Array.isArray(m.blockers) ? (m.blockers as string[]) : [];
    const reason = blockers[0] || (m.explanation as string) || "Unknown blocker";
    eliminatedReasons.set(reason, (eliminatedReasons.get(reason) || 0) + 1);
  }
  const eliminatedLines = Array.from(eliminatedReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([reason, count]) => `  - (${count}×) ${reason}`)
    .join("\n");

  const activeLenders = Array.isArray(ctx.lenderSummary?.active_lenders_checked)
    ? (ctx.lenderSummary.active_lenders_checked as string[]).join(", ")
    : "";

  return [
    "You are Finley Beyond — a senior, plain-spoken mortgage advisor working inside the Beyond Intelligence platform.",
    "",
    "BEHAVIOR:",
    "- Answer the user's specific question directly. Do NOT repeat canned summaries.",
    "- Reason like a real loan officer. Cite specific program names and lender names from the loaded context below — never invent lenders or programs that are not listed.",
    "- When the scenario has no strong match, propose concrete next moves: which scenario field to adjust (LTV, credit, reserves, doc type), which compensating factor to gather, or which lender/program category to load if the current catalog is missing it.",
    "- Statutory rules you must respect (already enforced by the matching engine, never override):",
    "  • FHA / VA / USDA require an SSN — ITIN, DACA, and Foreign National are not eligible.",
    "  • FHA / VA / USDA / Fannie / Freddie require full-doc or express-doc income — bank statements, DSCR, P&L, 1099, asset utilization, and WVOE are not eligible for those programs.",
    "  • VA additionally requires a valid Certificate of Eligibility (veteran / active-duty / qualifying spouse).",
    "- Keep responses tight: 2-5 short paragraphs or a compact bulleted list. No filler. No restating the scenario back to the user unless they asked.",
    "- If the user asks something off-topic (not mortgage / not this file), gently steer back.",
    "- If the loaded context is insufficient to answer with confidence, say so and ask the one most decisive clarifying question.",
    "",
    "CURRENT QUALIFICATION INPUT:",
    formLines || "  (no fields populated yet)",
    "",
    `TOP RECOMMENDATION FROM MATCH ENGINE: ${ctx.topRecommendation || "(none)"}`,
    `NEXT QUESTION SUGGESTED BY ENGINE: ${ctx.nextQuestion || "(none)"}`,
    "",
    `ACTIVE LENDERS IN ENGINE: ${activeLenders || "(none)"}`,
    "",
    `STRONG MATCHES (${ctx.strong.length}):`,
    strongLines || "  (none)",
    "",
    `CONDITIONAL MATCHES (${ctx.conditional.length}):`,
    conditionalLines || "  (none)",
    "",
    `ELIMINATED PATHS — top reasons (${ctx.eliminated.length} total programs):`,
    eliminatedLines || "  (none)",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// OpenAI caller
// -----------------------------------------------------------------------------

async function callOpenAI(systemPrompt: string, history: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const data: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
    message?: string;
  } = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "OpenAI request failed.");
  }

  const reply = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!reply) {
    throw new Error("OpenAI returned an empty reply.");
  }
  return reply;
}

// -----------------------------------------------------------------------------
// POST handler
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ---- Auth gate -----------------------------------------------------------
    const cookieStore = await cookies();
    const token = cookieStore.get("bf_team_session")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
    const session = await verifySessionToken(token);
    if (!session || !session.tenantId) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    // ---- Body parsing --------------------------------------------------------
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
    }

    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? (body.messages as ChatMessage[])
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0
          )
          .map((m) => ({ role: m.role, content: m.content.trim().substring(0, 4000) }))
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "messages_required" },
        { status: 400 }
      );
    }
    if (messages[messages.length - 1].role !== "user") {
      return NextResponse.json(
        { success: false, error: "last_message_must_be_user" },
        { status: 400 }
      );
    }

    const ctx = {
      form: (body.form as Record<string, unknown>) || {},
      strong: Array.isArray(body.strong_matches) ? (body.strong_matches as unknown[]) : [],
      conditional: Array.isArray(body.conditional_matches)
        ? (body.conditional_matches as unknown[])
        : [],
      eliminated: Array.isArray(body.eliminated_paths)
        ? (body.eliminated_paths as unknown[])
        : [],
      topRecommendation: typeof body.top_recommendation === "string" ? body.top_recommendation : "",
      nextQuestion: typeof body.next_question === "string" ? body.next_question : "",
      lenderSummary: (body.lender_summary as Record<string, unknown>) || {},
    };

    const systemPrompt = buildSystemPrompt(ctx);

    let reply: string;
    try {
      reply = await callOpenAI(systemPrompt, messages);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[finley/chat] OpenAI call failed:", errMsg);
      return NextResponse.json(
        {
          success: false,
          error: "llm_unavailable",
          detail: errMsg,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, reply });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[finley/chat] unexpected error:", errMsg);
    return NextResponse.json(
      { success: false, error: "internal_error", detail: errMsg },
      { status: 500 }
    );
  }
}
