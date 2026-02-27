/**
 * Milestone system types for Beancounter.
 * Nature metaphors: Seed → Growth → Canopy
 */

export type MilestoneMode = "ACTIVE" | "SILENT" | "OFF"

export type MilestoneTier = 1 | 2 | 3

export type MilestoneCategory =
  | "foundation"
  | "consistency"
  | "diversification"
  | "independence"
  | "patience"
  | "netWorth"
  | "explorer"

/** A milestone definition (static, never changes) */
export interface MilestoneDefinition {
  id: string
  category: MilestoneCategory
  title: string
  tiers: TierDefinition[]
  icon: string // FontAwesome class
}

/** A tier within a milestone */
export interface TierDefinition {
  tier: MilestoneTier
  label: string // e.g., "Seed", "Growth", "Canopy"
  description: string // What the user needs to do
  icon: string // fa-seedling, fa-leaf, fa-tree
}

/** The current state of a milestone for a user */
export interface MilestoneState {
  definition: MilestoneDefinition
  earnedTier: MilestoneTier | null
  earnedAt: string | null
  nextTier: TierDefinition | null
}

/** Backend response for milestones API */
export interface MilestonesApiResponse {
  earned: EarnedMilestone[]
  explorerActions: string[]
  mode: MilestoneMode
}

/** A single earned milestone from the backend */
export interface EarnedMilestone {
  id: string
  milestoneId: string
  tier: number
  earnedAt: string
}

/** Data bag for evaluating milestones from page data */
export interface MilestoneEvalData {
  portfolioCount?: number
  positionCount?: number
  marketCodes?: string[]
  assetCategoryNames?: string[]
  hasIndependencePlan?: boolean
  hasRebalanceModel?: boolean
  consecutiveInvestmentMonths?: number
  dividendQuarters?: number
  hasAnyDividend?: boolean
  maxPositionWeight?: number
  dividendPositionCount?: number
  fiProgress?: number
  coastFiProgress?: number
  savingsRate?: number
  oldestPositionYears?: number
  accountAgeYears?: number
  totalGainPercent?: number
  netWorthUsd?: number
}

/** Tier label constants */
export const TIER_LABELS: Record<MilestoneTier, string> = {
  1: "Seed",
  2: "Growth",
  3: "Canopy",
}

/** Tier icon constants */
export const TIER_ICONS: Record<MilestoneTier, string> = {
  1: "fa-seedling",
  2: "fa-leaf",
  3: "fa-tree",
}

/** Tier color scheme */
export const TIER_COLORS: Record<
  MilestoneTier,
  { bg: string; text: string; bgLight: string; border: string }
> = {
  1: {
    bg: "bg-amber-500",
    text: "text-amber-600",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
  },
  2: {
    bg: "bg-emerald-500",
    text: "text-emerald-600",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
  },
  3: {
    bg: "bg-green-600",
    text: "text-green-700",
    bgLight: "bg-green-50",
    border: "border-green-200",
  },
}
