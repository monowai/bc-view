/**
 * Tiny window-event bus to let any component pop open the global ChatFab
 * with a pre-seeded prompt and (optionally) the expanded layout — without
 * having to lift ChatFab's open/expanded/messages state into a context
 * shared by every page.
 *
 * ChatFab subscribes via `useEffect`; callers fire `requestChatOpen({...})`.
 */
const EVENT = "bc:chat-open"

export interface ChatOpenDetail {
  /** If set, immediately submitted as a user message after opening. */
  prompt?: string
  /** Open in the wider expanded layout instead of the default panel. */
  expanded?: boolean
}

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
