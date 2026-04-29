// app/api/handoff-chat/[proSessionId]/route.ts
//
// Step 4 (Drop 1) of the Professional Handoff workstream.
// POST endpoint for the LO's pro-mode chat with Finley.
//
// Request shape:
//   POST /api/handoff-chat/<proSessionId>
//   Body: { message: string, mode?: "professional" }
//
// Flow:
//   1. Auth-gate: bf_team_session cookie → team_users row → role check
//   2. Load the professional_chat_sessions row by [proSessionId]
//   3. Verify the row's team_user_id matches the logged-in user
//      (defense in depth — service-role bypasses RLS, so we enforce here)
//   4. Append the LO's message to messages JSONB
//   5. Call OpenAI with conversation history (Drop 1: minimal placeholder
//      system prompt; Step 5 will swap in the proper Pro Mode prompt with
//      borrower transcript + scenario context + catalog awareness)
//   6. Append assistant reply, persist updated messages
//   7. Return the assistant reply
//
// Drop 1 limitation: the system prompt is intentionally simple. Finley will
// reply but won't yet have access to the borrower's transcript or scenario
// when answering. That's Step 5. Drop 1 just proves the wire works.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { isUuid } from "@/lib/handoff";
import { verifySessionToken } from "@/lib/team-auth";

const SESSION_COOKIE = "bf_team_session";

const PROFESSIONAL_ROLES = new Set([
  "Loan Officer",
  "Loan Officer Assistant",
  "Branch Manager",
  "Production Manager",
  "Processor",
]);

const MAX_MESSAGE_LENGTH = 8000;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

type ProSessionRow = {
  id: string;
  intake_session_id: string;
  team_user_id: string;
  language: string;
  messages: unknown;
};

// Minimal placeholder system prompt for Drop 1. Step 5 replaces this with
// the full Pro Mode prompt (borrower transcript context, scenario summary,
// catalog awareness, license to suggest specific programs).
function buildSystemPrompt(language: string): string {
  const langLabel =
    language === "pt"
      ? "Portuguese"
      : language === "es"
        ? "Spanish"
        : "English";
  return [
    "You are Finley Beyond, an AI assistant supporting a licensed mortgage professional in Professional Mode.",
    `Respond in ${langLabel}.`,
    "You are talking to a Loan Officer or LO Assistant about a real borrower scenario they are working on.",
    "Keep replies focused, practical, and concise. Do not give legal advice.",
    "Do not promise loan approval. Frame guidance as direction-setting, not commitments.",
  ].join(" ");
}

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned empty content.");
  }
  return content.trim();
}

export async function POST(
  req: Request,
  context: { params: Promise<{ proSessionId: string }> }
) {
  const { proSessionId } = await context.params;

  // -------------------------------------------------------------------------
  // 1. Auth gate
  // -------------------------------------------------------------------------
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { data: teamUser, error: teamUserError } = await supabaseAdmin
    .from("team_users")
    .select("id, role, is_active")
    .eq("id", session.userId)
    .maybeSingle();

  if (teamUserError || !teamUser || !teamUser.is_active) {
    return NextResponse.json(
      { error: "Account not active." },
      { status: 403 }
    );
  }
  if (!PROFESSIONAL_ROLES.has(teamUser.role as string)) {
    return NextResponse.json(
      { error: "This chat is for licensed mortgage professionals." },
      { status: 403 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Validate route param + load pro session
  // -------------------------------------------------------------------------
  if (!isUuid(proSessionId)) {
    return NextResponse.json(
      { error: "Invalid pro session id." },
      { status: 400 }
    );
  }

  const { data: proRow, error: proError } = await supabaseAdmin
    .from("professional_chat_sessions")
    .select("id, intake_session_id, team_user_id, language, messages")
    .eq("id", proSessionId)
    .maybeSingle();

  if (proError || !proRow) {
    return NextResponse.json(
      { error: "Pro session not found." },
      { status: 404 }
    );
  }

  // TS Gotcha #2: double-cast through unknown when the .select() column
  // list is even slightly complex enough to confuse Supabase inference.
  const pro = proRow as unknown as ProSessionRow;

  // -------------------------------------------------------------------------
  // 3. Defense in depth: ensure this LO owns this thread.
  //    LO can't read or write to another LO's pro chat session, even on
  //    the same intake.
  // -------------------------------------------------------------------------
  if (pro.team_user_id !== session.userId) {
    return NextResponse.json(
      { error: "This pro session belongs to a different team member." },
      { status: 403 }
    );
  }

  // -------------------------------------------------------------------------
  // 4. Parse + validate the LO's message
  // -------------------------------------------------------------------------
  let body: { message?: unknown; mode?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const userMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return NextResponse.json(
      { error: "Message is required." },
      { status: 400 }
    );
  }
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars).` },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 5. Build conversation history + call OpenAI
  // -------------------------------------------------------------------------
  const ts = new Date().toISOString();
  const existingMessages: ChatMessage[] = Array.isArray(pro.messages)
    ? (pro.messages as ChatMessage[]).filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          (m.role === "user" || m.role === "assistant")
      )
    : [];

  const userTurn: ChatMessage = { role: "user", content: userMessage, ts };
  const historyForOpenAi: ChatMessage[] = [...existingMessages, userTurn];

  let assistantReply: string;
  try {
    assistantReply = await callOpenAI(
      buildSystemPrompt(pro.language || "en"),
      historyForOpenAi
    );
  } catch (err) {
    console.error("[handoff-chat] OpenAI call failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "AI provider error.",
      },
      { status: 502 }
    );
  }

  // -------------------------------------------------------------------------
  // 6. Persist updated messages JSONB
  // -------------------------------------------------------------------------
  const assistantTurn: ChatMessage = {
    role: "assistant",
    content: assistantReply,
    ts: new Date().toISOString(),
  };
  const updatedMessages = [...existingMessages, userTurn, assistantTurn];

  const { error: updateError } = await supabaseAdmin
    .from("professional_chat_sessions")
    .update({ messages: updatedMessages })
    .eq("id", pro.id);

  if (updateError) {
    console.error("[handoff-chat] persist failed", updateError);
    // Reply still flows back to the user — persistence failure is server-side
    // visible via logs but shouldn't strand the LO mid-thought.
  }

  // -------------------------------------------------------------------------
  // 7. Return the assistant reply
  // -------------------------------------------------------------------------
  return NextResponse.json({
    success: true,
    reply: assistantReply,
    proSessionId: pro.id,
    messageCount: updatedMessages.length,
  });
}
