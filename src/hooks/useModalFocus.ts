import { RefObject, useEffect, useRef } from "react"

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
 * Open modals, oldest first. Only the last one handles Tab and Escape, so a
 * confirm stacked on a dialog closes alone and the two traps never fight.
 */
const modalStack: HTMLElement[] = []

/**
 * Focus management for a modal surface:
 * - on open, focus moves to the first field in the body (`[data-modal-body]`);
 *   with no field there yet, to the container itself;
 * - Tab and Shift+Tab cycle inside the container;
 * - Escape calls `onEscape`, when given;
 * - on close, focus returns to whatever had it before the modal opened.
 *
 * The container should carry `tabIndex={-1}` so it can take focus when it
 * holds nothing focusable.
 */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  onEscape?: () => void,
): void {
  // Read through a ref so a fresh callback each render doesn't re-run the
  // effect (which would steal focus back to the first field).
  const escapeRef = useRef(onEscape)
  useEffect(() => {
    escapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    const container = ref.current
    if (!container) return undefined
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    // Effects run child-first, so a modal rendered inside this one may have
    // registered already. Slot beneath it and leave its focus alone.
    const nested = modalStack.findIndex((m) => container.contains(m))
    if (nested === -1) {
      modalStack.push(container)
      const body = container.querySelector<HTMLElement>("[data-modal-body]")
      // A body with nothing focusable yet (still loading, or plain text)
      // focuses the dialog itself: assistive tech announces the dialog by its
      // title, and an accidental Enter can't hit the header's Close button.
      const first = body
        ? (focusables(body)[0] ?? container)
        : (focusables(container)[0] ?? container)
      first.focus()
    } else {
      modalStack.splice(nested, 0, container)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (modalStack[modalStack.length - 1] !== container) return
      if (event.key === "Escape") {
        escapeRef.current?.()
        return
      }
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
      const index = modalStack.lastIndexOf(container)
      if (index !== -1) modalStack.splice(index, 1)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [ref])
}
