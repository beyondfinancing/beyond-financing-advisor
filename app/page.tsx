'use client'

import { useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const currentInput = input.trim()
    const userMessage: ChatMessage = {
      role: 'user',
      content: currentInput,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentInput }),
      })

      const data = await res.json()

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content:
          data?.reply || 'I was unable to generate a response. Please try again.',
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
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

          {loading && (
            <div className="p-2 rounded bg-gray-200 text-left">
              Thinking...
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSend()
              }
            }}
            placeholder="Describe your situation..."
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-[#263366] text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-center text-gray-500 max-w-xl">
        This tool provides general information and does not constitute a loan
        approval or commitment to lend. All mortgage applications are subject to
        review by a licensed Mortgage Loan Originator.
      </p>
    </main>
  )
}
