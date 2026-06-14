// Types and constants
export * from "./types"

// Asset Breakdown Hook (single source of truth for asset categorization)
export {
  useAssetBreakdown,
  calculateAssetBreakdown,
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  INCOME_STREAM_CATEGORIES,
  type AssetBreakdown,
} from "./useAssetBreakdown"

// Unified Projection Hook (preferred - always pass assets from frontend)
export {
  useUnifiedProjection,
  useFiProjectionSimple,
  createScenarioChecksum,
  createPlanChecksum,
  type RentalIncomeData,
} from "./useUnifiedProjection"

// Legacy hooks (kept for backwards compatibility)
export { useFiProjection } from "./useFiProjection"

// Components
export { default as FiMetrics } from "./FiMetrics"
export { default as FiAgeExplorer } from "./FiAgeExplorer"
export { default as PlanViewHeader } from "./PlanViewHeader"
export { default as PlanTabNavigation } from "./PlanTabNavigation"
export { default as WhatIfSlider } from "./WhatIfSlider"
export { default as SaveScenarioDialog } from "./SaveScenarioDialog"
export { default as EditPlanDetailsModal } from "./EditPlanDetailsModal"
export { default as IndependenceSettingsModal } from "./IndependenceSettingsModal"
export { default as IncomeBreakdownTable } from "./IncomeBreakdownTable"
export { default as MonteCarloTab } from "./MonteCarloTab"
export { default as DetailsTabContent } from "./DetailsTabContent"
export { default as AssetsTabContent } from "./AssetsTabContent"
export { default as AssetsBreakdown } from "./AssetsBreakdown"
export { default as SustainableSpendingCard } from "./SustainableSpendingCard"
export { default as SpendableAtIndependenceCard } from "./SpendableAtIndependenceCard"
export { default as SetDateOfBirthNotice } from "./SetDateOfBirthNotice"
export { default as PlanFindingsCard } from "./PlanFindingsCard"
export { default as ScenarioBar } from "./ScenarioBar"
export { default as StrategyGaugesStrip } from "./StrategyGaugesStrip"
export { default as PensionGauge } from "./PensionGauge"
export { default as TimelineTabContent } from "./TimelineTabContent"
export { default as PlanFiOverviewTab } from "./PlanFiOverviewTab"
export { default as CompositeTab } from "./CompositeTab"
export { default as PhaseConfigList } from "./PhaseConfigList"

// Monte Carlo Hook
export { useMonteCarloSimulation } from "./useMonteCarloSimulation"
