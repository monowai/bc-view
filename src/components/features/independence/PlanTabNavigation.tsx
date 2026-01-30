import React from "react"
import { TabId, TABS } from "./types"

interface PlanTabNavigationProps {
  /** Currently active tab */
  activeTab: TabId
  /** Callback when tab is changed */
  onTabChange: (tabId: TabId) => void
  /** Whether the plan has assets loaded (some tabs require assets) */
  hasAssets: boolean
}

/** Tabs that require assets to show meaningful data */
const TABS_REQUIRING_ASSETS: TabId[] = ["fire", "timeline", "simulation"]

/**
 * Tab navigation for plan view.
 * Some tabs are disabled when no assets are loaded.
 */
export default function PlanTabNavigation({
  activeTab,
  onTabChange,
  hasAssets,
}: PlanTabNavigationProps): React.ReactElement {
  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="flex space-x-6 overflow-x-auto">
        {TABS.map((tab) => {
          const requiresAssets = TABS_REQUIRING_ASSETS.includes(tab.id)
          const isDisabled = requiresAssets && !hasAssets

          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onTabChange(tab.id)}
              disabled={isDisabled}
              title={
                isDisabled
                  ? "Assets must be loaded to view this tab"
                  : undefined
              }
              className={`
                py-2 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap
                ${
                  isDisabled
                    ? "border-transparent text-gray-300 cursor-not-allowed"
                    : activeTab === tab.id
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <i className={`fas ${tab.icon} mr-1.5 text-xs`}></i>
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
