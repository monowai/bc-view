/**
 * Corner placement for the floating chat FAB and its slide-out panel.
 *
 * Default is BR (bottom-right). Persisted in localStorage so the user's
 * choice survives reloads — the FAB occasionally covers data in the
 * lower-right of a page (e.g. action menus on the holdings cards), and
 * being able to move it out of the way is the cheapest fix.
 */
export type ChatCorner = "BR" | "BL" | "TR" | "TL"

const STORAGE_KEY = "bc-chat-corner"

export function isChatCorner(value: unknown): value is ChatCorner {
  return value === "BR" || value === "BL" || value === "TR" || value === "TL"
}

export function loadChatCorner(): ChatCorner {
  if (typeof window === "undefined") return "BR"
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isChatCorner(stored) ? stored : "BR"
  } catch {
    return "BR"
  }
}

export function saveChatCorner(corner: ChatCorner): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, corner)
  } catch {
    // Quota exceeded / private mode — silently ignore; the corner just
    // won't persist across reloads, which is harmless.
  }
}

interface CornerLayout {
  /** Tailwind classes positioning the FAB within the viewport. */
  fab: string
  /** Tailwind classes positioning the (collapsed) panel container. */
  panel: string
  /** Tailwind classes positioning the expanded panel container. */
  panelExpanded: string
  /**
   * Translate-on-close direction. The offset accounts for the per-corner
   * inset so no sliver of the panel leaks past the viewport edge.
   */
  hiddenTransform: string
}

/**
 * Per-corner layout. The FAB lives in the chosen corner; the panel slides
 * in from that corner's edge. Insets and translate distances stay in sync
 * so the hidden panel fully clears the viewport (see ChatFab sliver fix).
 */
export const CORNER_LAYOUT: Record<ChatCorner, CornerLayout> = {
  BR: {
    fab: "bottom-6 right-6",
    panel: "bottom-24 right-6",
    panelExpanded: "bottom-6 right-6",
    hiddenTransform: "translate-x-[calc(100%+1.5rem)]",
  },
  BL: {
    fab: "bottom-6 left-6",
    panel: "bottom-24 left-6",
    panelExpanded: "bottom-6 left-6",
    hiddenTransform: "-translate-x-[calc(100%+1.5rem)]",
  },
  TR: {
    fab: "top-6 right-6",
    panel: "top-24 right-6",
    panelExpanded: "top-6 right-6",
    hiddenTransform: "translate-x-[calc(100%+1.5rem)]",
  },
  TL: {
    fab: "top-6 left-6",
    panel: "top-24 left-6",
    panelExpanded: "top-6 left-6",
    hiddenTransform: "-translate-x-[calc(100%+1.5rem)]",
  },
}
