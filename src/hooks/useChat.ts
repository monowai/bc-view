import { useState, useCallback } from "react"
import { ChatMessage } from "types/agent"

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (query: string) => Promise<void>
  clearMessages: () => void
}

/**
 * Streams the agent response via Server-Sent Events.
 *
 * The browser sees a first byte within ~1–2s as svc-agent emits `event: token`
 * chunks. Without streaming the heavy Independence / Rebalance domains
 * routinely exceed mobile-Safari's ~30s idle-timeout and surface as a generic
 * "Load failed" — see `pages/api/agent/query/stream.ts` for the proxy.
 */
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

      // Reserve a placeholder assistant message that we mutate as chunks
      // arrive. The empty string is fine — ChatPanel renders the
      // `Thinking...` indicator from `isLoading` until tokens land.
      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ])

      const finalize = (
        update: (msg: ChatMessage) => Partial<ChatMessage>,
      ): void => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...update(m) } : m)),
        )
      }

      try {
        const res = await fetch("/api/agent/query/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ query, context }),
        })
        if (!res.ok || !res.body) {
          const message = `HTTP ${res.status}`
          finalize(() => ({
            content: `Sorry, I encountered an error: ${message}`,
            error: message,
          }))
          return
        }

        const reader = res.body
          .pipeThrough(new TextDecoderStream())
          .getReader()
        let buffer = ""

        // SSE event blocks are delimited by a blank line. Inside each block
        // we look for `event: <type>` and `data: <body>` lines. We accept
        // multi-`data:` events by joining their bodies with newlines.
        const flush = (block: string): void => {
          let event = "message"
          const dataLines: string[] = []
          for (const raw of block.split("\n")) {
            if (raw.startsWith(":")) continue
            if (raw.startsWith("event:")) {
              event = raw.slice(6).trim()
            } else if (raw.startsWith("data:")) {
              dataLines.push(raw.slice(5).replace(/^ /, ""))
            }
          }
          const data = dataLines.join("\n")
          if (event === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + data } : m,
              ),
            )
          } else if (event === "error") {
            finalize((m) => ({
              content:
                m.content.length > 0
                  ? m.content
                  : `Sorry, I encountered an error: ${data || "stream error"}`,
              error: data || "stream-error",
            }))
          }
          // `done` carries metadata only; nothing to render right now.
        }

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          let sep = buffer.indexOf("\n\n")
          while (sep !== -1) {
            const block = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            if (block.length > 0) flush(block)
            sep = buffer.indexOf("\n\n")
          }
        }
        if (buffer.trim().length > 0) flush(buffer)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        finalize(() => ({
          content: `Sorry, I encountered an error: ${message}`,
          error: message,
        }))
      } finally {
        setIsLoading(false)
      }
    },
    [context],
  )

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearMessages }
}
