'use client'

import { useEffect, useRef, useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type LeadForm = {
  firstName: string
  email: string
  phone: string
  preferredLanguage: string
}

export default function Home() {
  const [input, setInput] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [leadSaved, setLeadSaved] = useState<boolean>(false)
  const [leadForm, setLeadForm] = useState<LeadForm>({
    firstName: '',
    email: '',
    phone: '',
    preferredLanguage: 'English',
  })

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || loading) return

    const currentInput = input.trim()
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: currentInput },
    ]

    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          messages: updatedMessages,
          lead: leadForm,
        }),
      })

      const data: { reply?: string } = await res.json()

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content:
          data?.reply || 'I was unable to generate a response. Please try again.',
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error connecting to AI.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleLeadChange = (
    field: keyof LeadForm,
    value: string
  ): void => {
    setLeadForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleLeadSave = (): void => {
    setLeadSaved(true)
  }

  return (
    <main className="min-h-screen bg-[#F1F3F8] text-[#263366] px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 text-center sm:mb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Connect With a Mortgage Advisor — Instantly
          </h1>
          <p className="mt-2 text-sm text-[#263366]/75 sm:mt-3 sm:text-base">
            Clear guidance. Real scenarios. One step at a time.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#263366]/20 bg-white shadow-sm">
          <div className="border-b border-[#263366]/10 px-4 py-4 sm:px-5">
            <div className="text-sm font-semibold text-[#263366] sm:text-base">
              Beyond Financing Advisor
            </div>
            <div className="mt-1 text-xs text-[#263366]/65 sm:text-sm">
              Ask a mortgage question and get guided step by step.
            </div>
          </div>

          <div className="h-[360px] overflow-y-auto px-3 py-3 sm:h-[430px] sm:px-4 sm:py-4 lg:h-[500px] lg:px-5">
            <div className="space-y-3 sm:space-y-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#263366]/20 bg-[#F8FAFC] p-4 text-sm text-[#263366]/70 sm:p-5">
                  <div className="font-medium">Try asking something like:</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInput("I'm self-employed. Can I qualify for a home loan?")
                      }
                      className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-xs hover:bg-[#F1F3F8] sm:text-sm"
                    >
                      I&apos;m self-employed. Can I qualify?
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInput('I had a recent credit issue. What are my options?')
                      }
                      className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-xs hover:bg-[#F1F3F8] sm:text-sm"
                    >
                      I had a recent credit issue
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInput('I want to buy with 10% down. Where should I start?')
                      }
                      className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-xs hover:bg-[#F1F3F8] sm:text-sm"
                    >
                      I want to buy with 10% down
                    </button>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-[15px] sm:leading-7 ${
                      msg.role === 'user'
                        ? 'bg-[#DCEAFE] text-right text-[#263366]'
                        : 'bg-[#F3F4F6] text-left text-[#263366]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl bg-[#F3F4F6] px-3 py-2.5 text-sm leading-6 text-[#263366] shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-[15px] sm:leading-7">
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-[#263366]/10 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="Describe your situation..."
                rows={3}
                className="min-h-[88px] w-full resize-none rounded-xl border border-[#263366]/20 px-4 py-3 text-sm text-[#263366] outline-none placeholder:text-[#263366]/45 focus:border-[#263366]/40 sm:flex-1 sm:text-[15px]"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={loading}
                className="w-full rounded-xl bg-[#263366] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#263366]/15 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#263366] sm:text-xl">
              Stay Connected
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#263366]/70">
              Leave your details so Beyond Financing can help you move forward faster.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="First Name"
              value={leadForm.firstName}
              onChange={(e) => handleLeadChange('firstName', e.target.value)}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            />

            <input
              type="email"
              placeholder="Email"
              value={leadForm.email}
              onChange={(e) => handleLeadChange('email', e.target.value)}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            />

            <input
              type="text"
              placeholder="Phone Number"
              value={leadForm.phone}
              onChange={(e) => handleLeadChange('phone', e.target.value)}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            />

            <select
              value={leadForm.preferredLanguage}
              onChange={(e) =>
                handleLeadChange('preferredLanguage', e.target.value)
              }
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            >
              <option>English</option>
              <option>Português</option>
              <option>Español</option>
            </select>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleLeadSave}
              className="w-full rounded-xl bg-[#263366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto"
            >
              Save My Contact Details
            </button>
          </div>

          {leadSaved && (
            <div className="mt-3 rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm text-[#263366]/75">
              Your contact details have been added to this session.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-[#263366]/15 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#263366] sm:text-xl">
              Ready to Move Forward?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#263366]/70">
              Take the next step with Beyond Financing.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="https://www.beyondfinancing.com/apply-now"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[#263366] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Start Application
            </a>

            <a
              href="https://calendly.com/sandropansini"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[#263366]/20 bg-[#F8FAFC] px-4 py-3 text-center text-sm font-semibold text-[#263366] transition hover:bg-[#EEF2F7]"
            >
              Schedule Consultation
            </a>

            <a
              href="mailto:pansini@beyondfinancing.com"
              className="rounded-xl border border-[#263366]/20 bg-[#F8FAFC] px-4 py-3 text-center text-sm font-semibold text-[#263366] transition hover:bg-[#EEF2F7] sm:col-span-2 lg:col-span-1"
            >
              Talk to Beyond Financing
            </a>
          </div>

          <div className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-[#263366]/75">
            A pre-approval review typically starts with income, asset, and credit
            evaluation. If you are self-employed, tax returns and supporting
            documentation may be required.
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-5 text-[#263366]/60 sm:text-xs sm:leading-6">
          This tool provides general information and does not constitute a loan
          approval or commitment to lend. All mortgage applications are subject to
          review by a licensed Mortgage Loan Originator.
        </p>
      </div>
    </main>
  )
}
