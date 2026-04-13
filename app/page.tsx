'use client'

import { useEffect, useRef, useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [input, setInput] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(false)
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

  return (
    <main className="min-h-screen bg-[#F1F3F8] text-[#263366] px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Connect With a Mortgage Advisor — Instantly
          </h1>
          <p className="mt-3 text-base text-[#263366]/75">
            Clear guidance. Real scenarios. One step at a time.
          </p>
        </div>

        <div className="rounded-2xl border border-[#263366]/20 bg-white shadow-sm">
          <div className="border-b border-[#263366]/10 px-5 py-4">
            <div className="text-sm font-semibold text-[#263366]">
              Beyond Financing Advisor
            </div>
            <div className="mt-1 text-sm text-[#263366]/65">
              Ask a mortgage question and get guided step by step.
            </div>
          </div>

          <div className="h-[460px] overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#263366]/20 bg-[#F8FAFC] p-5 text-sm text-[#263366]/70">
                  Examples:
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInput("I'm self-employed. Can I qualify for a home loan?")
                      }
                      className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-sm hover:bg-[#F1F3F8]"
                    >
                      I&apos;m self-employed. Can I qualify?
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInput('I had a recent credit issue. What are my options?')
                      }
                      className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-sm hover:bg-[#F1F3F8]"
                    >
                      I had a recent credit issue
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInput('I want to buy with 10% down. Where should I start?')
                      }
                      className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-sm hover:bg-[#F1F3F8]"
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
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-7 whitespace-pre-wrap shadow-sm ${
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
                  <div className="max-w-[85%] rounded-2xl bg-[#F3F4F6] px-4 py-3 text-[15px] leading-7 text-[#263366] shadow-sm">
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-[#263366]/10 px-4 py-4 sm:px-5">
            <div className="flex items-end gap-3">
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
                className="min-h-[88px] flex-1 resize-none rounded-xl border border-[#263366]/20 px-4 py-3 text-[15px] text-[#263366] outline-none placeholder:text-[#263366]/45 focus:border-[#263366]/40"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={loading}
                className="rounded-xl bg-[#263366] px-5 py-3 text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-6 text-[#263366]/60">
          This tool provides general information and does not constitute a loan
          approval or commitment to lend. All mortgage applications are subject to
          review by a licensed Mortgage Loan Originator.
        </p>
      </div>
    </main>
  )
}
