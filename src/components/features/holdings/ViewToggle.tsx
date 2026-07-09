export type ViewMode =
  "summary" | "table" | "cards" | "heatmap" | "income" | "chart"

/**
 * Canonical order of holdings view modes for toolbar display.
 * Single source — `HoldingActions` and the aggregated holdings toolbar both
 * consume this so tab ordering can't drift between renders.
 */
export const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "cards", label: "Cards" },
  { value: "table", label: "Table" },
  { value: "heatmap", label: "Heatmap" },
  { value: "income", label: "Income" },
  { value: "chart", label: "Growth" },
]
