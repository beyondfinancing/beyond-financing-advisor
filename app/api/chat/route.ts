import { NextResponse } from "next/server";

type IncomingMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type RequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up";
  routing?: unknown;
  messages?: IncomingMessage[];
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeMessages(messages: unknown): IncomingMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      if (!msg || typeof msg !== "object") return null;

      const role =
        (msg as { role?: string }).role === "assistant"
          ? "assistant"
          : (msg as { role?: string }).role === "system"
          ? "system"
          : "user";

      const content = safeString((msg as { content?: unknown }).content).trim();

      if (!content) return null;

      return {
        role,
        content,
      } as IncomingMessage;
    })
    .filter(Boolean) as IncomingMessage[];
}

function getStageInstruction(stage?: string) {
  switch (stage) {
    case "initial_review":
      return `
You are handling the initial borrower intake review.
Acknowledge the information entered.
Be professional, warm, and concise.
Do not provide loan approval, underwriting decisions, exact loan programs, exact rates, or guaranteed terms.
Encourage the borrower to complete Apply Now when appropriate.
If helpful, end with the next qualification-style question.
      `.trim();

    case "scenario_review":
      return `
You are handling the borrower property scenario update.
Acknowledge the target home price and down payment information.
Do not provide loan approval, underwriting decisions, exact loan programs, exact rates, or guaranteed terms.
Encourage the borrower to complete Apply Now when appropriate.
If helpful, end with the next qualification-style question.
      `.trim();

    case "follow_up":
    default:
      return `
Continue the borrower-facing mortgage conversation naturally.
Be professional, clear, and concise.
You may answer general mortgage process questions.
Do not provide loan approval, underwriting decisions, exact loan programs, exact rates, or guaranteed terms.
Direct personalized qualification and program determination back to the licensed loan officer.
Encourage the borrower to complete Apply Now when appropriate.
Ask the next useful qualification-style question when appropriate.
      `.trim();
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const stage = body?.stage;
    const incomingMessages = normalizeMessages(body?.messages);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing OPENAI_API_KEY. Add it in Vercel Project Settings > Environment Variables.",
        },
        { status: 500 }
      );
    }

    if (!incomingMessages.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No chat messages were provided.",
        },
        { status: 400 }
      );
    }

    const systemMessage: IncomingMessage = {
      role: "system",
      content: `
You are Finley Beyond, an AI-powered mortgage assistant for Beyond Financing.

Core rules:
- Be borrower-friendly, professional, and clear.
- Never promise approval.
- Never issue a final underwriting decision.
- Never quote personalized rates.
- Never guarantee eligibility for any specific lender or program.
- You may discuss the general mortgage process and explain that final guidance must be reviewed by a licensed loan officer.
- When useful, encourage the borrower to complete the application and speak with the assigned loan officer.
- Keep answers practical and conversational.
- Do not mention internal policies unless needed.
- Follow the user's language when clear from the conversation.
- Use short paragraphs for readability.

Stage instruction:
${getStageInstruction(stage)}
      `.trim(),
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [systemMessage, ...incomingMessages],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data?.error?.message ||
        data?.message ||
        "OpenAI request failed while generating chat response.";

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Thank you for sharing that. Your assigned loan officer will review your scenario and advise the next steps.";

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error in /api/chat.",
      },
      { status: 500 }
    );
  }
}
