import React, { useState } from "react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { useCompositeProjection } from "@hooks/useCompositeProjection"
import {
  CompositeProjectionProvider,
  CompositeProjectionValue,
} from "./composite/CompositeProjectionContext"
import CompositeSettingsBar from "./composite/CompositeSettingsBar"
import PlansTab from "./composite/tabs/PlansTab"
import WealthJourneyTab from "./composite/tabs/WealthJourneyTab"
import StressTestTab from "./composite/tabs/StressTestTab"
import YearByYearTab from "./composite/tabs/YearByYearTab"

interface CompositeTabProps {
  plans: RetirementPlan[]
  settings: UserIndependenceSettings | undefined
}

type CompositeSubTabId = "plans" | "wealth" | "stress" | "timeline"

interface CompositeSubTabConfig {
  id: CompositeSubTabId
  label: string
  icon: string
}

const COMPOSITE_SUB_TABS: CompositeSubTabConfig[] = [
  { id: "plans", label: "Plans", icon: "fa-clipboard-list" },
  { id: "wealth", label: "Wealth Journey", icon: "fa-chart-line" },
  { id: "stress", label: "Stress Test", icon: "fa-dice" },
  { id: "timeline", label: "Year-by-Year", icon: "fa-table" },
]

interface CompositeSubTabNavigationProps {
  activeTab: CompositeSubTabId
  onTabChange: (tabId: CompositeSubTabId) => void
}

/**
 * Sub-tab navigation for the Composite view. Visual style mirrors
 * `PlanTabNavigation` for consistency across the independence section.
 */
function CompositeSubTabNavigation({
  activeTab,
  onTabChange,
}: CompositeSubTabNavigationProps): React.ReactElement {
  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="flex space-x-6 overflow-x-auto" role="tablist">
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
      </nav>
    </div>
  )
}

/**
 * Composite view across multiple retirement plans.
 *
 * Acts as a tab container: owns the {@link CompositeProjectionProvider},
 * renders the always-visible settings bar, and switches between
 * {@link PlansTab}, {@link WealthJourneyTab}, {@link StressTestTab}, and
 * {@link YearByYearTab} sub-tabs. Sub-tabs read all data from the context.
 */
export default function CompositeTab({
  plans,
  settings,
}: CompositeTabProps): React.ReactElement {
  const projectionState = useCompositeProjection(plans, settings)
  const [activeTab, setActiveTab] = useState<CompositeSubTabId>("plans")

  const contextValue: CompositeProjectionValue = {
    plans,
    ...projectionState,
  }

  return (
    <CompositeProjectionProvider value={contextValue}>
      <div className="space-y-6">
        <CompositeSettingsBar />
        <div>
          <CompositeSubTabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          {activeTab === "plans" && <PlansTab />}
          {activeTab === "wealth" && <WealthJourneyTab />}
          {activeTab === "stress" && <StressTestTab />}
          {activeTab === "timeline" && <YearByYearTab />}
        </div>
      </div>
    </CompositeProjectionProvider>
  )
}
