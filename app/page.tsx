'use client'

import { useState } from 'react'

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Temporary fake AI response (next step we connect OpenAI)
    setTimeout(() => {
      const aiMessage = {
        role: 'assistant',
        content: 'Thanks for sharing. Let me ask you a couple quick questions so I can guide you properly.',
      }
      setMessages((prev) => [...prev, aiMessage])
    }, 500)
  }

  return (
    <main className="min-h-screen bg-white text-[#263366] flex flex-col items-center px-4 py-10">
      <h1 className="text-3xl font-bold text-center">
        Connect With a Mortgage Advisor — Instantly
      </h1>

      <div className="mt-6 w-full max-w-2xl border rounded-xl p-4 bg-gray-50">
        <div className="h-64 overflow-y-auto mb-4 space-y-2">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-2 rounded ${
                msg.role === 'user'
                  ? 'bg-blue-100 text-right'
                  : 'bg-gray-200 text-left'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your situation..."
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            onClick={handleSend}
            className="bg-[#263366] text-white px-4 py-2 rounded"
          >
            Send
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-center text-gray-500 max-w-xl">
        This tool provides general information and does not constitute a loan approval or commitment to lend. All mortgage applications are subject to review by a licensed Mortgage Loan Originator.
      </p>
    </main>
  )
}
