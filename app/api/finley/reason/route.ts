import { NextResponse } from "next/server";

type MatchResult = {
  lender_name: string;
  program_name: string;
  program_slug: string;
  loan_category: string | null;
  notes: string[];
  missing_items: string[];
  blockers: string[];
  strengths: string[];
  concerns?: string[];
  explanation?: string;
  score: number;
};

type ReasonRequest = {
  intake: Record<string, unknown>;
  next_question?: string;
  strong_matches?: MatchResult[];
  conditional_matches?: MatchResult[];
  eliminated_paths?: MatchResult[];
  user_message?: string;
  mode?: "professional" | "borrower";
  conversation?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

function fallbackReply(body: ReasonRequest): string {
  const nextQuestion =
    body.next_question ||
    "Please provide the next missing qualification detail so I can narrow lender and program fit more precisely.";

  const strongCount = body.strong_matches?.length || 0;
  const conditionalCount = body.conditional_matches?.length || 0;

  if (strongCount > 0) {
    const top = body.strong_matches?.[0];
    return `I currently see ${strongCount} strong match${strongCount === 1 ? "" : "es"} and ${conditionalCount} conditional path${conditionalCount === 1 ? "" : "s"} still in play. The best current direction appears to be ${top?.program_name || "the top program option"} with ${top?.lender_name || "the current lender match"}. ${nextQuestion}`;
  }

  if (conditionalCount > 0) {
    return `I do not yet have a clean strong match, but I do see ${conditionalCount} conditional path${conditionalCount === 1 ? "" : "s"} that may still work depending on the missing details. ${nextQuestion}`;
  }

  return `I do not yet see a clear eligible program from the current facts. ${nextQuestion}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReasonRequest;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        reply: fallbackReply(body),
      });
    }

    const prompt = `
You are Finley Beyond, an AI-powered mortgage qualification strategist supervised by an Independent Certified Mortgage Advisor.

Your role in PROFESSIONAL mode:
- Think like an experienced mortgage loan officer, processor, and underwriting-minded advisor.
- Coach the professional user on how to strengthen the file.
- Use the guideline results as the main source of truth.
- Help compare strong and conditional paths.
- Point out compensating factors, risk areas, reserves, LTV, DTI, credit, occupancy, property type, borrower status, and documentation strategy.
- If the user asks which path is safer or cleaner, explain the tradeoffs practically.
- If the user asks how to make the file stronger, answer directly with file-improvement strategy.
- Do not repeat the same next question unless it is truly still the best one.
- Reference lender/program names in professional mode when helpful.
- Never promise approval.
- Never invent guideline facts not supported by the structured result set.

Your role in BORROWER mode:
- be simpler, high-level, and cautious
- do not reveal internal lender details unless clearly appropriate

Response rules:
- keep the reply practical and conversational
- 2 to 5 short paragraphs maximum
- if useful, include a short bullet-style set of 2 to 5 actions inside the prose
- end with one precise next question only when another question is actually needed
- if the user asked for analysis rather than another question, answer first and only then ask one next question if necessary

Return JSON only:
{
  "reply": "string"
}

Mode: ${body.mode || "professional"}

Current intake:
${JSON.stringify(body.intake || {}, null, 2)}

Engine next question:
${body.next_question || ""}

Strong matches:
${JSON.stringify(body.strong_matches || [], null, 2)}

Conditional matches:
${JSON.stringify(body.conditional_matches || [], null, 2)}

Eliminated paths:
${JSON.stringify(body.eliminated_paths || [], null, 2)}

Latest user message:
${body.user_message || ""}

Conversation:
${JSON.stringify(body.conversation || [], null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a careful mortgage qualification strategist that returns strict JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        reply: fallbackReply(body),
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({
        success: true,
        reply: fallbackReply(body),
      });
    }

    let parsed: { reply?: string } | null = null;

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }

    return NextResponse.json({
      success: true,
      reply: parsed?.reply || fallbackReply(body),
    });
  } catch {
    return NextResponse.json({
      success: true,
      reply:
        "Please continue by providing the next missing qualification detail so I can narrow lender and program fit more precisely.",
    });
  }
}
