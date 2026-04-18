import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type MatchPayload = {
  strong_matches?: Array<{
    lender_name: string;
    program_name: string;
    guideline_summary?: string | null;
    overlay_notes?: string | null;
    missing_items?: string[];
    soft_flags?: string[];
  }>;
  conditional_matches?: Array<{
    lender_name: string;
    program_name: string;
    guideline_summary?: string | null;
    overlay_notes?: string | null;
    missing_items?: string[];
    soft_flags?: string[];
  }>;
  eliminated_matches?: Array<{
    lender_name: string;
    program_name: string;
    hard_fails?: string[];
  }>;
  missing_items?: string[];
};

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const messages = Array.isArray(body?.messages)
      ? (body.messages as ChatMessage[])
      : [];

    const match = (body?.match || {}) as MatchPayload;
    const nextQuestion =
      typeof body?.nextQuestion === "string" ? body.nextQuestion : null;
    const mode = typeof body?.mode === "string" ? body.mode : "borrower";

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content || "";

    const strong = Array.isArray(match.strong_matches)
      ? match.strong_matches
      : [];
    const conditional = Array.isArray(match.conditional_matches)
      ? match.conditional_matches
      : [];
    const eliminated = Array.isArray(match.eliminated_matches)
      ? match.eliminated_matches
      : [];

    const globalMissing = Array.isArray(match.missing_items)
      ? uniqueStrings(match.missing_items)
      : [];

    let reply = "";

    if (strong.length > 0) {
      const top = strong.slice(0, 3);

      reply +=
        mode === "professional"
          ? `Based on the information provided so far, I see ${strong.length} strong program match${
              strong.length > 1 ? "es" : ""
            } still in play.\n\n`
          : `Based on the information shared so far, I see financing paths that may fit this scenario, subject to licensed loan officer review.\n\n`;

      for (const item of top) {
        reply += `• ${item.lender_name} — ${item.program_name}`;
        if (item.guideline_summary) {
          reply += `: ${item.guideline_summary}`;
        }
        reply += `\n`;
      }

      reply += `\n`;
    }

    if (strong.length === 0 && conditional.length > 0) {
      const top = conditional.slice(0, 3);

      reply +=
        mode === "professional"
          ? `I do not yet have enough confirmed information for a clean program recommendation, but I do see conditional paths that may work once the missing items are confirmed.\n\n`
          : `I still need a few more details before narrowing the most likely financing path.\n\n`;

      for (const item of top) {
        reply += `• ${item.lender_name} — ${item.program_name}`;
        if (item.soft_flags?.length) {
          reply += ` (needs confirmation of ${item.soft_flags.join(", ")})`;
        }
        reply += `\n`;
      }

      reply += `\n`;
    }

    if (eliminated.length > 0 && mode === "professional") {
      const examples = eliminated.slice(0, 2);
      reply += `Programs already eliminated based on current facts:\n`;
      for (const item of examples) {
        reply += `• ${item.lender_name} — ${item.program_name}: ${
          item.hard_fails?.join(" / ") || "Not eligible"
        }\n`;
      }
      reply += `\n`;
    }

    if (globalMissing.length > 0) {
      reply +=
        mode === "professional"
          ? `The decisive missing items are: ${globalMissing.join(", ")}.\n\n`
          : `There are still a few important details I need before narrowing the right financing path.\n\n`;
    }

    if (nextQuestion) {
      reply += nextQuestion;
    } else {
      reply +=
        mode === "professional"
          ? `Please continue by providing the next missing qualification detail so I can narrow lender and program fit more precisely.`
          : `Please continue by sharing the next missing detail so I can better organize this scenario for review.`;
    }

    if (!lastUserMessage && !reply.trim()) {
      reply =
        "Please begin by sharing the borrower’s citizenship or residency status, occupancy type, transaction type, income type, property type, estimated credit score, loan amount, and approximate LTV.";
    }

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
