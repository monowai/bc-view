import { useCallback, useEffect, useState } from "react"

/** Page padding under the holdings grid, so the page itself does not scroll. */
export const HOLDINGS_GRID_BOTTOM_GAP_PX = 24

/** Below this a scrolling region is too short to use; the page scrolls instead. */
const MIN_HEIGHT_PX = 240

interface ViewportFill<T extends HTMLElement> {
  ref: (element: T | null) => void
  /** Undefined until measured in the browser; apply as `maxHeight`. */
  maxHeight: number | undefined
}

/**
 * Sizes a scrolling region to end `bottomGapPx` above the window bottom, however
 * much page sits above it. Remeasures when the window or the page layout changes.
 */
export function useViewportFillHeight<T extends HTMLElement>(
  bottomGapPx: number,
): ViewportFill<T> {
  const [element, setElement] = useState<T | null>(null)
  const [maxHeight, setMaxHeight] = useState<number>()
  const ref = useCallback((next: T | null) => setElement(next), [])

  useEffect(() => {
    if (!element) return undefined
    const measure = (): void => {
      const top = element.getBoundingClientRect().top + window.scrollY
      setMaxHeight(
        Math.max(MIN_HEIGHT_PX, window.innerHeight - top - bottomGapPx),
      )
    }
    measure()
    window.addEventListener("resize", measure)
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    observer?.observe(document.body)
    return () => {
      window.removeEventListener("resize", measure)
      observer?.disconnect()
    }
  }, [element, bottomGapPx])

  return { ref, maxHeight }
}
