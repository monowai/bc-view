import { RefObject, useEffect } from "react"

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/**
 * Focus management for a modal surface:
 * - on open, focus moves to the first field in the body (or, failing that,
 *   the first focusable element, or the container itself);
 * - Tab and Shift+Tab cycle inside the container;
 * - on close, focus returns to whatever had it before the modal opened.
 *
 * The container should carry `tabIndex={-1}` so it can take focus when it
 * holds nothing focusable.
 */
export function useModalFocus(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return undefined
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const body = container.querySelector<HTMLElement>("[data-modal-body]")
    const first =
      (body && focusables(body)[0]) || focusables(container)[0] || container
    first.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return
      const items = focusables(container)
      if (items.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === firstItem || active === container)) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [ref])
}
