import { useState, useCallback } from "react"
import { ChatMessage, AgentResponse } from "types/agent"

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (query: string) => Promise<void>
  clearMessages: () => void
}

export function useChat(context?: Record<string, unknown>): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(
    async (query: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      const appendError = (message: string): void => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: `Sorry, I encountered an error: ${message}`,
            timestamp: new Date().toISOString(),
            error: message,
          },
        ])
      }

      try {
        const res = await fetch("/api/agent/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, context }),
        })
        if (!res.ok) {
          const err = await res.json()
          appendError(err.message || `HTTP ${res.status}`)
          return
        }
        const data: AgentResponse = await res.json()
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.response,
            timestamp: data.timestamp,
            error: data.error,
          },
        ])
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        appendError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [context],
  )

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearMessages }
}
