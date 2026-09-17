import { RetirementProjection } from "types/independence"
import {
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  INCOME_STREAM_CATEGORIES,
} from "./useAssetBreakdown"

// Re-export for backwards compatibility
export { DEFAULT_NON_SPENDABLE_CATEGORIES, INCOME_STREAM_CATEGORIES }

/**
 * Sections of a single stage's drill-down.
 *
 * This was six tabs — Summary, Assets, FI Overview, Metrics, My Path, Stress
 * Test — three of whose names ("Summary", "FI Overview", "Stress Test") also
 * named tabs one level up on the composite plan, meaning different things in
 * each place. One of the six ("Assets") was a settings screen wearing an
 * output tab's clothes.
 *
 * Now: two sections that read the stage, and everything that changes it lives
 * behind Set up. Names are deliberately plain and deliberately unlike the
 * parent surface's, because they are not the same thing.
 */
export type TabId = "standing" | "path" | "setup"

export interface TabConfig {
  id: TabId
  label: string
  icon: string
  byline: string
}

export const TABS: TabConfig[] = [
  {
    id: "standing",
    label: "Where you stand",
    icon: "fa-bullseye",
    byline: "What this stage is worth today, and what it needs to be.",
  },
  {
    id: "path",
    label: "Your path",
    icon: "fa-chart-line",
    byline:
      "How your wealth moves across your lifetime — and how it copes when markets don't co-operate.",
  },
  {
    id: "setup",
    label: "Set up",
    icon: "fa-sliders-h",
    byline: "Which of your holdings this stage can actually spend.",
  },
]

// Alias for backwards compatibility (prefer DEFAULT_NON_SPENDABLE_CATEGORIES)
export const DEFAULT_NON_SPENDABLE = DEFAULT_NON_SPENDABLE_CATEGORIES

// Map category to default return rate type
export const getCategoryReturnType = (
  category: string,
): "equity" | "cash" | "housing" => {
  const lowerCategory = category.toLowerCase()
  if (lowerCategory === "cash") return "cash"
  if (lowerCategory === "property") return "housing"
  // Equity, ETF, Mutual Fund, etc. use equity return rate
  return "equity"
}

// Extended projection with additional scenario-specific fields
export interface DisplayProjection extends RetirementProjection {
  liquidBalanceAtLiquidation?: number
  liquidationThresholdPercent?: number
}
