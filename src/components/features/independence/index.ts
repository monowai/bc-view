// Types and constants
export * from "./types"

// Asset Breakdown Hook (single source of truth for asset categorization)
export {
  useAssetBreakdown,
  calculateAssetBreakdown,
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  type AssetBreakdown,
} from "./useAssetBreakdown"

// Unified Projection Hook (preferred - always pass assets from frontend)
export {
  useUnifiedProjection,
  useFiProjectionSimple,
  createWhatIfChecksum,
  createPlanChecksum,
  type RentalIncomeData,
} from "./useUnifiedProjection"

// Legacy hooks (kept for backwards compatibility)
export { useRetirementProjection } from "./useRetirementProjection"
export { useFiProjection } from "./useFiProjection"

// Components
export { default as FiMetrics } from "./FiMetrics"
export { default as FiSummaryBar } from "./FiSummaryBar"
export { default as FiAgeExplorer } from "./FiAgeExplorer"
export { default as PlanViewHeader } from "./PlanViewHeader"
export { default as PlanTabNavigation } from "./PlanTabNavigation"
export { default as AnalysisToolbar } from "./AnalysisToolbar"
export { default as WhatIfSlider } from "./WhatIfSlider"
export { default as ScenarioImpact } from "./ScenarioImpact"
export { default as ScenarioSliders } from "./ScenarioSliders"
export { default as WhatIfModal } from "./WhatIfModal"
export { default as SaveScenarioDialog } from "./SaveScenarioDialog"
export { default as EditPlanDetailsModal } from "./EditPlanDetailsModal"
export { default as IncomeBreakdownTable } from "./IncomeBreakdownTable"
export { default as MonteCarloTab } from "./MonteCarloTab"
export { default as DetailsTabContent } from "./DetailsTabContent"
export { default as AssetsTabContent } from "./AssetsTabContent"
export { default as TimelineTabContent } from "./TimelineTabContent"

// Monte Carlo Hook
export { useMonteCarloSimulation } from "./useMonteCarloSimulation"
