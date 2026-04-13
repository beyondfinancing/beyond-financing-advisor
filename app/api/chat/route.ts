import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { message } = await req.json()

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a Certified Mortgage Advisor at Beyond Financing.

Your role:
- Ask smart qualifying questions
- Guide borrowers step-by-step
- Speak confidently and professionally
- Be concise but insightful
- Think like a deal-structuring expert, not a chatbot`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
      }),
    })

    const data = await response.json()

    return NextResponse.json({
      reply:
        data?.choices?.[0]?.message?.content ??
        'I was unable to generate a response. Please try again.',
    })
  } catch (error) {
    return NextResponse.json({
      reply: 'Something went wrong. Please try again.',
    })
  }
}
