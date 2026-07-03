import React, { useState } from "react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { useCompositeProjection } from "@hooks/useCompositeProjection"
import {
  CompositeProjectionProvider,
  CompositeProjectionValue,
  useCompositeProjectionContext,
} from "./composite/CompositeProjectionContext"
import PhasesTab from "./composite/tabs/PhasesTab"
import WealthJourneyTab from "./composite/tabs/WealthJourneyTab"
import StressTestTab from "./composite/tabs/StressTestTab"
import YearByYearTab from "./composite/tabs/YearByYearTab"
import FiOverviewTab from "./composite/tabs/FiOverviewTab"
import NetWorthTab from "./composite/tabs/NetWorthTab"

interface CompositeTabProps {
  plans: RetirementPlan[]
  settings: UserIndependenceSettings | undefined
}

type CompositeSubTabId =
  | "overview"
  | "phases"
  | "wealth"
  | "networth"
  | "stress"
  | "timeline"

interface CompositeSubTabConfig {
  id: CompositeSubTabId
  label: string
  icon: string
}

const COMPOSITE_SUB_TABS: CompositeSubTabConfig[] = [
  { id: "phases", label: "Phases", icon: "fa-clipboard-list" },
  { id: "networth", label: "Net Worth", icon: "fa-wallet" },
  { id: "overview", label: "FI Overview", icon: "fa-bullseye" },
  { id: "wealth", label: "Wealth Journey", icon: "fa-chart-line" },
  { id: "stress", label: "Stress Test", icon: "fa-dice" },
  { id: "timeline", label: "Year-by-Year", icon: "fa-table" },
]

interface CompositeSubTabNavigationProps {
  activeTab: CompositeSubTabId
  onTabChange: (tabId: CompositeSubTabId) => void
}

/**
 * Sub-tab navigation for the Composite view. Shows the sustainability badge
 * right-aligned in the tab bar. Reads projection from context.
 */
function CompositeSubTabNavigation({
  activeTab,
  onTabChange,
}: CompositeSubTabNavigationProps): React.ReactElement {
  const { projection } = useCompositeProjectionContext()

  const sustainabilityText = projection
    ? projection.isSustainable
      ? `Sustainable to age ${projection.yearlyProjections[projection.yearlyProjections.length - 1]?.age ?? "?"}`
      : `Savings deplete at age ${projection.depletionAge ?? "?"}`
    : null

  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="flex items-center" role="tablist">
        <div className="flex space-x-6 overflow-x-auto flex-1">
          {COMPOSITE_SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap
                ${
                  activeTab === tab.id
                    ? "border-independence-500 text-independence-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <i className={`fas ${tab.icon} mr-1.5 text-xs`}></i>
              {tab.label}
            </button>
          ))}
        </div>
        {sustainabilityText && (
          <span
            className={`ml-4 shrink-0 text-sm font-medium px-3 py-1 rounded-full ${
              projection?.isSustainable
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            <i
              className={`fas ${projection?.isSustainable ? "fa-check-circle" : "fa-exclamation-triangle"} mr-1`}
            ></i>
            {sustainabilityText}
          </span>
        )}
      </nav>
    </div>
  )
}

/**
 * Composite view across multiple retirement plans.
 *
 * Acts as a tab container: owns the {@link CompositeProjectionProvider},
 * and switches between sub-tabs. Sub-tabs read all data from the context.
 */
export default function CompositeTab({
  plans,
  settings,
}: CompositeTabProps): React.ReactElement {
  const projectionState = useCompositeProjection(plans, settings)
  const [activeTab, setActiveTab] = useState<CompositeSubTabId>("phases")

  const contextValue: CompositeProjectionValue = {
    plans,
    ...projectionState,
  }

  return (
    <CompositeProjectionProvider value={contextValue}>
      <div>
        <CompositeSubTabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        {activeTab === "overview" && <FiOverviewTab />}
        {activeTab === "phases" && <PhasesTab />}
        {activeTab === "wealth" && <WealthJourneyTab />}
        {activeTab === "networth" && <NetWorthTab />}
        {activeTab === "stress" && <StressTestTab />}
        {activeTab === "timeline" && <YearByYearTab />}
      </div>
    </CompositeProjectionProvider>
  )
}
