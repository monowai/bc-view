/**
 * Tiny window-event bus that lets the currently-mounted page publish a live
 * text summary of its own client-side state (e.g. an in-progress draft
 * rebalance) so the global ChatFab can fold it into outgoing agent queries
 * — without lifting page state into a context provider shared by the whole
 * app. Mirrors `chatBus.ts`'s pub/sub idiom, which already solves the same
 * "talk to the FAB without prop-drilling through _app" problem for
 * open-with-prompt requests.
 *
 * Unlike chatBus's fire-and-forget events, this retains the last-published
 * value (`current`) and delivers it synchronously to a new subscriber. That
 * matters here because `<Component>` (the page) mounts — and its effects
 * run — before `<ChatFab>` in `_app.tsx`'s render tree, so a plain
 * dispatch-only event fired from the page's mount effect would be missed by
 * ChatFab's own mount effect subscribing a tick later.
 *
 * Any page can publish; ChatFab treats it generically. A page MUST clear
 * its context (call with `null`) on unmount — ChatFab is mounted once in
 * `_app` and persists across navigation, so a page that forgets to clear
 * leaks its context into whatever page the user lands on next.
 */
const EVENT = "bc:page-context"

let current: string | null = null

export function setPageContext(text: string | null): void {
  current = text
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<string | null>(EVENT, { detail: text }))
}

export function getPageContext(): string | null {
  return current
}

/** Subscribes to page-context changes, immediately delivering the current
 * value (see module doc for why). Returns an unsubscribe function. */
export function onPageContextChange(
  handler: (text: string | null) => void,
): () => void {
  handler(current)
  if (typeof window === "undefined") return () => {}
  const listener = (e: Event): void => {
    handler((e as CustomEvent<string | null>).detail ?? null)
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
