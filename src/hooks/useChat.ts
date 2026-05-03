import { useState, useCallback } from "react"
import { ChatMessage } from "types/agent"

/**
 * Human-readable rendering of svc-agent's opaque SSE error codes. Codes are
 * stable contracts emitted by AgentController.classifyError; the message
 * text is UI copy and may evolve.
 */
function describeError(code: string): string {
  switch (code) {
    case "provider-quota":
      return "the AI provider has run out of credit. Please ask the site owner to top up the Anthropic billing balance."
    case "provider-rate":
      return "the AI provider is rate-limiting requests. Please wait a moment and try again."
    case "provider-timeout":
      return "the AI provider took too long to respond. Please try again — heavy queries may need a second attempt."
    case "agent-error":
      return "the agent failed to process your request. Please try again or simplify the question."
    default:
      return code
  }
}

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  /**
   * Send a query to svc-agent. `deepThink` (default `false`) escalates the
   * agent to its DEEP tier — see `AgentQuery.deepThink` in svc-agent. The
   * caller is responsible for collecting the toggle from the UI; the hook
   * forwards it verbatim and persists it on the user message via the
   * `deepThink` field on `ChatMessage` so chat history can render a badge.
   */
  sendMessage: (query: string, deepThink?: boolean) => Promise<void>
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
    async (query: string, deepThink: boolean = false) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        timestamp: new Date().toISOString(),
        deepThink: deepThink || undefined,
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
          body: JSON.stringify({ query, context, deepThink }),
        })
        if (!res.ok || !res.body) {
          const message = `HTTP ${res.status}`
          finalize(() => ({
            content: `Sorry, I encountered an error: ${message}`,
            error: message,
          }))
          return
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ""

        // SSE event blocks are delimited by a blank line. Inside each block
        // we look for `event: <type>` and `data: <body>` lines. We accept
        // multi-`data:` events by joining their bodies with newlines.
        //
        // We deliberately don't strip a leading space from `data:` lines.
        // The SSE spec lets a server write either `data:foo` or `data: foo`
        // for content `foo` — Spring's `ServerSentEvent` writer chooses the
        // first form, so any leading space on a `data:` line IS part of the
        // payload. Stripping it dropped spaces between adjacent token chunks
        // and produced run-on words like "Theplan", "fortwo".
        const flush = (block: string): void => {
          let event = "message"
          const dataLines: string[] = []
          for (const raw of block.split("\n")) {
            if (raw.startsWith(":")) continue
            if (raw.startsWith("event:")) {
              event = raw.slice(6).trim()
            } else if (raw.startsWith("data:")) {
              dataLines.push(raw.slice(5))
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
            const code = data || "stream-error"
            finalize((m) => ({
              content:
                m.content.length > 0
                  ? m.content
                  : `Sorry, I encountered an error: ${describeError(code)}`,
              error: code,
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
