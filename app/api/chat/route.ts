import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages || [];

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        reply: "Missing OpenAI API Key",
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      reply:
        data?.choices?.[0]?.message?.content ||
        "No AI response returned",
    });
  } catch (error) {
    return NextResponse.json({
      reply: "Server error",
    });
  }
}
