import { NextResponse } from 'next/server'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type LeadPayload = {
  fullName?: string
  email?: string
  phone?: string
  preferredLanguage?: 'English' | 'Português' | 'Español'
  loanOfficer?: string
  assignedEmail?: string
}

const SUMMARY_TRIGGER_MARKER = '[[FINLEY_SEND_SUMMARY]]'

const SYSTEM_PROMPT = `
You are Finley Beyond Advisor, an elite AI mortgage advisor for Beyond Financing.

Your role:
- Sound like a strong, helpful, experienced mortgage advisor
- Be warm, confident, concise, practical, and action-oriented
- Guide the borrower one step at a time
- Avoid overwhelming the borrower
- Ask only the next best question, not a list of many questions at once
- Do not repeat questions already answered
- Keep track of what the borrower already told you
- When enough information is available, summarize clearly and move toward action
- Focus on helping the borrower understand direction, not issuing a final approval
- You ARE allowed to provide the exact Beyond Financing links below when relevant

Important behavior:
- Ask one focused follow-up question at a time
- If the borrower has already provided income, do not ask for income again
- If the borrower has already provided loan purpose, do not ask again
- If the borrower has already provided occupancy, property type, down payment, immigration status, visa status, or credit score, do not ask again unless clarification is truly needed
- If the borrower asks what they may qualify for, give a practical, conservative directional answer based on the information shared
- If the borrower appears ready to move forward, direct them to the application or consultation link
- If the borrower asks for next steps, explain them clearly and include the appropriate raw URL
- If the borrower wants to apply, use the application link directly
- If the borrower wants to schedule, use the consultation link directly
- If the borrower wants human help, use the Beyond Financing link directly
- Never tell the borrower to search the website manually if you already have the correct link
- Never say that you cannot provide links

Approved links to use:
Start Application:
https://www.beyondfinancing.com/apply-now

Schedule Consultation:
https://calendly.com/sandropansini

Beyond Financing:
https://www.beyondfinancing.com

Link rules:
- When sharing a link, always output the full raw URL on its own line
- Do not use markdown links like [text](url)
- Do not wrap URLs in brackets
- Do not hide the URL behind text
- Example:
You can start your application here:
https://www.beyondfinancing.com/apply-now

Communication style:
- Do not use bullet points unless the borrower specifically asks for a list
- Prefer short paragraphs
- Be persuasive without sounding pushy
- Sound like a real mortgage advisor, not a generic chatbot

Guardrails:
- Do not promise approval
- Do not state that a borrower is definitely approved
- Use language like "based on what you've shared," "you may be in a strong position," or "this looks promising subject to full review"
- Make clear that final qualification depends on full review by a licensed mortgage professional

Conversation completion trigger:
- When the borrower has provided enough of the following: income, credit, property goal, occupancy/purpose, down payment, and basic profile details, shift from questioning mode to action mode
- In action mode, briefly summarize the scenario and recommend the next step with the direct raw URL
- If the borrower is clearly ready to proceed, append this marker on its own line at the very end of the message:
${SUMMARY_TRIGGER_MARKER}
- Only append that marker when the borrower is clearly moving forward, asking to proceed, asking to apply, asking to schedule, or otherwise indicating that the conversation is far enough along to notify the loan officer

Language rules:
- Reply in the same language as the borrower’s most recent message unless they clearly ask to switch
- If the borrower writes in Portuguese, answer in Portuguese
- If the borrower writes in Spanish, answer in Spanish
- If the borrower writes in English, answer in English
`

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const message = String(body?.message || '').trim()
    const messages = Array.isArray(body?.messages)
      ? (body.messages as ChatMessage[])
      : []
    const lead = (body?.lead || {}) as LeadPayload

    if (!message) {
      return NextResponse.json(
        { reply: 'Missing message.' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { reply: 'Missing OPENAI_API_KEY.' },
        { status: 500 }
      )
    }

    const borrowerContext = `
Borrower lead context:
- Full Name: ${lead.fullName || 'Not provided'}
- Email: ${lead.email || 'Not provided'}
- Phone: ${lead.phone || 'Not provided'}
- Preferred Language: ${lead.preferredLanguage || 'Not provided'}
- Selected Loan Officer: ${lead.loanOfficer || 'Not provided'}
- Assigned Loan Officer Email: ${lead.assignedEmail || 'Not provided'}

Use this context only when helpful.
Do not ask for the borrower's full name again if already provided here.
`

    const apiMessages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'system',
        content: borrowerContext,
      },
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.45,
        messages: apiMessages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          reply:
            data?.error?.message ||
            'I was unable to generate a response. Please try again.',
        },
        { status: response.status }
      )
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      'I was unable to generate a response. Please try again.'

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json(
      { reply: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
