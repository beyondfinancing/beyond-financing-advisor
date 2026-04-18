import { NextResponse } from "next/server";

type MatchResult = {
  lender_name: string;
  program_name: string;
  program_slug: string;
  loan_category: string | null;
  notes: string[];
  missing_items: string[];
  blockers: string[];
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
You are Finley Beyond, an AI-powered mortgage qualification and program matching assistant supervised by an Independent Certified Mortgage Advisor.

Your job:
- Think like a real mortgage professional.
- Use the match engine output as the primary eligibility guide.
- Never promise approval.
- Never invent lender guidelines.
- Ask the next smartest qualification question needed to narrow the best mortgage path.
- Speak clearly, professionally, and practically.
- If strong matches exist, mention that there appear to be viable directions.
- If only conditional matches exist, explain that more qualification facts are needed.
- If paths were eliminated, do not sound discouraging; guide the user toward what may still work.
- Keep the reply concise and conversational.
- If the user asks "what programs are available", summarize high-level direction only.
- Always end with one precise next question unless the scenario is already sufficiently complete.

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
              "You are a careful mortgage qualification assistant that returns strict JSON only.",
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
  } catch (error) {
    return NextResponse.json({
      success: true,
      reply:
        "Please continue by providing the next missing qualification detail so I can narrow lender and program fit more precisely.",
    });
  }
}
