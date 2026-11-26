import { useEffect } from "react"
import { highlightedTrnId } from "@lib/trns/trnLinks"

/** The flash holdings uses for a jumped-to row (styles/globals.css). */
const FLASH = "asset-target"

/**
 * Once the rows are on screen, scroll to the transaction the URL's `#trn-<id>`
 * names and flash it. Rows carry `data-trn-id`, and a row standing for several
 * transactions lists them all in `data-trn-ids`. A list drawn twice (cards on a
 * phone, a table on a wide screen) flashes both and scrolls to the one showing.
 */
export function useTrnHighlight(ready: boolean): void {
  useEffect(() => {
    if (!ready) return undefined
    const trnId = highlightedTrnId(window.location.hash)
    if (!trnId) return undefined
    const raf = requestAnimationFrame(() => {
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>("[data-trn-id]"),
      ).filter(
        (row) =>
          row.dataset.trnId === trnId ||
          (row.dataset.trnIds ?? "").split(" ").includes(trnId),
      )
      const showing = rows.find((row) => row.getClientRects().length > 0)
      ;(showing ?? rows[0])?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      rows.forEach((row) => {
        row.classList.remove(FLASH)
        // Reflow so the flash replays when the same row is jumped to again.
        void row.offsetWidth
        row.classList.add(FLASH)
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [ready])
}
