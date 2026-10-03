import { useEffect, useRef, useState } from "react"
import { useChat, UseChatReturn } from "@hooks/useChat"
import { ChatMessage } from "types/agent"

/**
 * One Quick Analysis (Asset Review, News & Sentiment, portfolio briefing,
 * rebalance asset insight): a canned opening prompt the reader never types,
 * then free-text follow-ups on the answer.
 */
export interface AnalysisRequest {
  /** Unique per analysis kind and subject, e.g. `asset-review|AAPL|US`. */
  cacheKey: string
  /** Canned prompt sent as the opening turn. */
  query: string
  /** Shown in place of `query` wherever the thread is displayed. */
  label: string
  /** Agent context for the opening turn and every follow-up. */
  context: Record<string, unknown>
  /** How long a completed thread is reused when the popup is reopened. */
  ttlMs: number
}

interface CachedThread {
  messages: ChatMessage[]
  startedAt: number
  /** Chat-history conversation the thread is saved as; absent if unsaved. */
  conversationId: string | null
}

// Module-level so a thread survives closing and reopening its popup; a page
// reload starts fresh. Only threads whose opening analysis succeeded land
// here — a failed or cancelled run is retried on the next open.
const threads = new Map<string, CachedThread>()

export function clearAnalysisCache(): void {
  threads.clear()
}

function readThread(cacheKey: string, ttlMs: number): CachedThread | null {
  const cached = threads.get(cacheKey)
  if (cached && Date.now() - cached.startedAt < ttlMs) return cached
  return null
}

/** True once the opening turn has produced an answer — not an error or a cancel. */
export function analysisSucceeded(messages: ChatMessage[]): boolean {
  const report = messages[1]
  return !!report && report.content.length > 0 && !report.error
}

/**
 * `useChat` for a Quick Analysis: resumes a cached thread, otherwise sends
 * the canned prompt once on mount. The TTL runs from when the analysis was
 * first requested, so follow-ups don't keep a stale report alive.
 *
 * Every run is saved to chat history as its own conversation, titled by its
 * label, without becoming the app's current chat; a reopened thread keeps
 * appending to it. If it can't be saved the analysis still runs, statelessly.
 */
export function useAnalysisChat(request: AnalysisRequest): UseChatReturn {
  const { cacheKey, query, label, context, ttlMs } = request
  const [cached] = useState(() => readThread(cacheKey, ttlMs))
  const chat = useChat(context, {
    initialMessages: cached?.messages,
    persist: true,
    remember: false,
    initialConversationId: cached?.conversationId ?? undefined,
  })
  const { messages, isLoading, sendMessage, conversationId } = chat

  // A ref, not state: StrictMode re-runs the mount effect with refs intact,
  // so the opening prompt is sent exactly once.
  const startedAt = useRef<number | null>(cached?.startedAt ?? null)
  useEffect(() => {
    if (startedAt.current !== null) return
    startedAt.current = Date.now()
    void sendMessage(query, false, false, label)
  }, [sendMessage, query, label])

  useEffect(() => {
    if (isLoading || startedAt.current === null) return
    if (!analysisSucceeded(messages)) return
    threads.set(cacheKey, {
      messages,
      startedAt: startedAt.current,
      conversationId,
    })
  }, [cacheKey, messages, isLoading, conversationId])

  return chat
}
