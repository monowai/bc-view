/**
 * Tiny window-event bus to let any component pop open the global ChatFab
 * with a pre-seeded prompt and (optionally) the expanded layout — without
 * having to lift ChatFab's open/expanded/messages state into a context
 * shared by every page.
 *
 * ChatFab subscribes via `useEffect`; callers fire `requestChatOpen({...})`.
 */
import { ChatMessage } from "types/agent"

const EVENT = "bc:chat-open"

interface ChatOpenBase {
  /** Open in the wider expanded layout instead of the default panel. */
  expanded?: boolean
}

/** Open the FAB, optionally submitting `prompt` as a new user message. */
interface ChatOpenPrompt extends ChatOpenBase {
  prompt?: string
  transcript?: never
  context?: never
  conversationId?: never
}

/**
 * Continue an existing thread (a Quick Analysis popup handing over to the
 * FAB). Replaces the FAB's conversation; `context` is the agent context the
 * thread was started with, used instead of the route's context until the
 * conversation is cleared. `conversationId` is the chat-history
 * conversation the thread is saved as; the FAB continues it as its current
 * chat, and without one the thread continues unsaved. Never combined with
 * `prompt`: a prompt sent in the same tick would read the pre-handover
 * history and context.
 */
interface ChatOpenThread extends ChatOpenBase {
  transcript: ChatMessage[]
  context?: Record<string, unknown>
  conversationId?: string
  prompt?: never
}

export type ChatOpenDetail = ChatOpenPrompt | ChatOpenThread

export function requestChatOpen(detail: ChatOpenDetail = {}): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<ChatOpenDetail>(EVENT, { detail }))
}

export function onChatOpen(
  handler: (detail: ChatOpenDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {}
  const listener = (e: Event): void => {
    handler((e as CustomEvent<ChatOpenDetail>).detail ?? {})
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
