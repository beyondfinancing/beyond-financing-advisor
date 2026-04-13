import { NextResponse } from 'next/server'

const loanOfficerMap: Record<string, string> = {
  finley: 'finley@beyondfinancing.com',
  sandro: 'pansini@beyondfinancing.com',
  warren: 'warren@beyondfinancing.com',
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { fullName, email, phone, preferredLanguage, loanOfficer } = body

    if (!fullName || !email || !phone || !preferredLanguage || !loanOfficer) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields.' },
        { status: 400 }
      )
    }

    const selectedEmail =
      loanOfficerMap[loanOfficer] || 'finley@beyondfinancing.com'

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Missing RESEND_API_KEY' },
        { status: 500 }
      )
    }

    const html = `
      <h2>New Lead - Finley Beyond Advisor</h2>
      <p><strong>Full Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Language:</strong> ${preferredLanguage}</p>
      <p><strong>Selected Loan Officer:</strong> ${loanOfficer}</p>
      <p><strong>Assigned Email:</strong> ${selectedEmail}</p>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Finley Beyond <finley@beyondfinancing.com>',
        to: [selectedEmail],
        reply_to: email,
        subject: `New Lead: ${fullName}`,
        html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ success: false, error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
