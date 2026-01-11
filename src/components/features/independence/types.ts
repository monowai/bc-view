import { RetirementProjection } from "types/independence"

// What-if adjustments for scenario planning
export interface WhatIfAdjustments {
  retirementAgeOffset: number
  expensesPercent: number
  returnRateOffset: number
  inflationOffset: number
  contributionPercent: number // % of base monthly investment (100 = no change)
  equityPercent: number | null // % of liquid assets in equities (null = use plan default)
  liquidationThreshold: number // % of initial liquid assets at which to sell illiquid (default 10)
}

// Scenario overrides - holds edited values until user decides to save
// All plan values that can be modified in-memory before saving
export interface ScenarioOverrides {
  // Income sources
  pensionMonthly?: number
  socialSecurityMonthly?: number
  otherIncomeMonthly?: number
  // Expenses
  monthlyExpenses?: number
  // Return rates (as decimals, e.g., 0.07 for 7%)
  equityReturnRate?: number
  cashReturnRate?: number
  housingReturnRate?: number
  // Other
  inflationRate?: number
  targetBalance?: number
}

// Tab identifiers for plan view
export type TabId = "details" | "assets" | "fire" | "timeline" | "scenarios"

// Tab configuration
export interface TabConfig {
  id: TabId
  label: string
  icon: string
}

export const TABS: TabConfig[] = [
  { id: "details", label: "Details", icon: "fa-clipboard-list" },
  { id: "assets", label: "Assets", icon: "fa-wallet" },
  { id: "fire", label: "FIRE", icon: "fa-fire" },
  { id: "timeline", label: "Timeline", icon: "fa-chart-line" },
  { id: "scenarios", label: "Scenarios", icon: "fa-sliders-h" },
]

// Default non-spendable categories (property typically can't be easily liquidated)
export const DEFAULT_NON_SPENDABLE = ["Property"]

// Default what-if adjustment values
export const DEFAULT_WHAT_IF_ADJUSTMENTS: WhatIfAdjustments = {
  retirementAgeOffset: 0,
  expensesPercent: 100,
  returnRateOffset: 0,
  inflationOffset: 0,
  contributionPercent: 100,
  equityPercent: null,
  liquidationThreshold: 10,
}

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

// Check if scenario has changes from default
export const hasScenarioChanges = (adjustments: WhatIfAdjustments): boolean =>
  adjustments.retirementAgeOffset !== 0 ||
  adjustments.expensesPercent !== 100 ||
  adjustments.returnRateOffset !== 0 ||
  adjustments.inflationOffset !== 0 ||
  adjustments.contributionPercent !== 100 ||
  adjustments.equityPercent !== null ||
  adjustments.liquidationThreshold !== 10

// Extended projection with additional scenario-specific fields
export interface DisplayProjection extends RetirementProjection {
  liquidBalanceAtLiquidation?: number
  liquidationThresholdPercent?: number
}
