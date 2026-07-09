import { RetirementProjection } from "types/independence"
import {
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  INCOME_STREAM_CATEGORIES,
} from "./useAssetBreakdown"

// Re-export for backwards compatibility
export { DEFAULT_NON_SPENDABLE_CATEGORIES, INCOME_STREAM_CATEGORIES }

// Tab identifiers for plan view
export type TabId =
  "fi" | "details" | "assets" | "breakdown" | "timeline" | "simulation"

// Tab configuration
export interface TabConfig {
  id: TabId
  label: string
  icon: string
  byline: string
}

export const TABS: TabConfig[] = [
  {
    id: "details",
    label: "Summary",
    icon: "fa-clipboard-list",
    byline:
      "Where you stand at a glance — verdict, key numbers, and your plan inputs.",
  },
  {
    id: "breakdown",
    label: "Assets",
    icon: "fa-layer-group",
    byline:
      "Your holdings by category — choose which are spendable in retirement.",
  },
  {
    id: "fi",
    label: "FI Overview",
    icon: "fa-bullseye",
    byline: "Your FI target, trajectory, and Monte Carlo confidence bands.",
  },
  {
    id: "assets",
    label: "Metrics",
    icon: "fa-wallet",
    byline:
      "What you have today, what it could become, and what it means for independence.",
  },
  {
    id: "timeline",
    label: "My Path",
    icon: "fa-chart-line",
    byline:
      "How your wealth grows, sustains, and evolves across your lifetime.",
  },
  {
    id: "simulation",
    label: "Stress Test",
    icon: "fa-dice",
    byline: "How does your plan hold up when markets don't follow the script?",
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
