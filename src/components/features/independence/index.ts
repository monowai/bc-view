// Types and constants
export * from "./types"

// Asset Breakdown Hook (single source of truth for asset categorization)
export {
  useAssetBreakdown,
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  INCOME_STREAM_CATEGORIES,
  type AssetBreakdown,
} from "./useAssetBreakdown"

// Unified Projection Hook (preferred - always pass assets from frontend)
export {
  useUnifiedProjection,
  useFiProjectionSimple,
  type RentalIncomeData,
} from "./useUnifiedProjection"

// Components
export { default as FiMetrics } from "./FiMetrics"
export { default as PlanViewHeader } from "./PlanViewHeader"
export { default as PlanTabNavigation } from "./PlanTabNavigation"
export { default as SaveScenarioDialog } from "./SaveScenarioDialog"
export { default as EditPlanDetailsModal } from "./EditPlanDetailsModal"
export { default as IncomeBreakdownTable } from "./IncomeBreakdownTable"
export { default as MonteCarloTab } from "./MonteCarloTab"
export { default as DetailsTabContent } from "./DetailsTabContent"
export { default as AssetsTabContent } from "./AssetsTabContent"
export { default as AssetsBreakdown } from "./AssetsBreakdown"
export { default as SetDateOfBirthNotice } from "./SetDateOfBirthNotice"
export { default as PlanFindingsCard } from "./PlanFindingsCard"
export { default as ScenarioBar } from "./ScenarioBar"
export { default as TimelineTabContent } from "./TimelineTabContent"
export { default as PlanFiOverviewTab } from "./PlanFiOverviewTab"
