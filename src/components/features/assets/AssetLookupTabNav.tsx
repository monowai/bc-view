import React from "react"

export type AssetLookupTabId = "portfolios" | "brokers" | "models"

interface TabConfig {
  id: AssetLookupTabId
  label: string
  icon: string
}

const TABS: TabConfig[] = [
  { id: "portfolios", label: "Portfolios", icon: "fa-briefcase" },
  { id: "brokers", label: "Brokers", icon: "fa-building-columns" },
  { id: "models", label: "Models", icon: "fa-sitemap" },
]

interface AssetLookupTabNavProps {
  activeTab: AssetLookupTabId
  onTabChange: (tabId: AssetLookupTabId) => void
}

/**
 * Tab navigation for the asset lookup results screen — mirrors the
 * underline-style tab bar used by PlanTabNavigation.
 */
export default function AssetLookupTabNav({
  activeTab,
  onTabChange,
}: AssetLookupTabNavProps): React.ReactElement {
  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="flex space-x-6 overflow-x-auto" aria-label="Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap ${
              activeTab === tab.id
                ? "border-invest-500 text-invest-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <i className={`fas ${tab.icon} mr-1.5 text-xs`}></i>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
