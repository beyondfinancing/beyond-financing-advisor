import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { firstName, email, phone, preferredLanguage } = body

    if (!firstName || !email || !phone || !preferredLanguage) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields.' },
        { status: 400 }
      )
    }

    // TEMP TEST ONLY
    // This confirms the unlock flow works before email sending is added.
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
