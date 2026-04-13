const handleSend = async () => {
  if (!input.trim() || loading) return

  const currentInput = input.trim()
  const updatedMessages = [
    ...messages,
    { role: 'user' as const, content: currentInput },
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

    const data = await res.json()

    const aiMessage = {
      role: 'assistant' as const,
      content:
        data?.reply || 'I was unable to generate a response. Please try again.',
    }

    setMessages((prev) => [...prev, aiMessage])
  } catch (error) {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant' as const,
        content: 'Error connecting to AI.',
      },
    ])
  } finally {
    setLoading(false)
  }
}
