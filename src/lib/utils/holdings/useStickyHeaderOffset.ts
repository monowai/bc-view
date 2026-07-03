import { useEffect, useState } from "react"

/**
 * Measures a sticky element's height so a second sticky element can pin
 * directly beneath it (two-tier sticky). Used by the holdings table to offset
 * the per-group bars below the shared ColumnHeader.
 *
 * Returns a callback ref to attach to the top sticky element and its measured
 * height. A callback ref (not a RefObject) is used so the measurement re-runs
 * whenever the element mounts — e.g. when the user switches into table view.
 */
export function useStickyHeaderOffset<T extends HTMLElement>(): {
  ref: (node: T | null) => void
  offset: number
} {
  const [node, setNode] = useState<T | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!node) return undefined
    const measure = (): void => {
      setOffset(node.offsetHeight)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return { ref: setNode, offset }
}
