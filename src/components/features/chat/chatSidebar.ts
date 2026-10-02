/**
 * Collapsed/expanded preference for the /chat conversation sidebar.
 *
 * Stored per viewer in localStorage. Unset (null) means the viewer has not
 * chosen, so the page falls back to its viewport default: expanded on
 * desktop, collapsed below the md breakpoint.
 */
export const SIDEBAR_COLLAPSED_KEY = "bc.chat.sidebarCollapsed"

const DESKTOP_QUERY = "(min-width: 768px)"

export function loadSidebarCollapsed(): boolean | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === "true") return true
    if (stored === "false") return false
    return null
  } catch {
    return null
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  } catch {
    // Private mode / quota — the choice just won't survive a reload.
  }
}

/**
 * True below the md breakpoint, where the expanded sidebar overlays the
 * chat panel. Without matchMedia (SSR, tests) assume a desktop viewport.
 */
export function isNarrowViewport(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  try {
    return !window.matchMedia(DESKTOP_QUERY).matches
  } catch {
    return false
  }
}
