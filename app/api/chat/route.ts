import { NextResponse } from "next/server";

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incomingMessages = Array.isArray(body?.messages)
      ? (body.messages as IncomingMessage[])
      : [];

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    if (incomingMessages.length === 0) {
      return NextResponse.json(
        { error: "No messages were provided." },
        { status: 400 }
      );
    }

    const messages: IncomingMessage[] = [
      {
        role: "system",
        content:
          "You are Finley Beyond, a professional mortgage loan officer assistant. You provide preliminary borrower-facing guidance only. You do not promise approval, exact loan terms, exact rates, or final eligibility. You encourage the borrower to apply and to speak with the assigned licensed loan officer. Keep responses practical, professional, clear, and concise.",
      },
      ...incomingMessages,
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "The OpenAI request did not complete successfully.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply:
        data?.choices?.[0]?.message?.content || "No AI response returned.",
    });
  } catch {
    return NextResponse.json(
      { error: "Server error." },
      { status: 500 }
    );
  }
}
