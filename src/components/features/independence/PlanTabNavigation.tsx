import React from "react"
import { TabId, TABS } from "./types"

interface PlanTabNavigationProps {
  /** Currently active section */
  activeTab: TabId
  /** Callback when the section is changed */
  onTabChange: (tabId: TabId) => void
  /** Whether the plan has assets loaded (some sections need them) */
  hasAssets: boolean
}

/** Sections that need assets before they can say anything true. */
const TABS_REQUIRING_ASSETS: TabId[] = ["path"]

/**
 * Section navigation for one stage of a plan.
 *
 * Two reading sections and a Set up destination, matching the shape of the
 * composite plan page — the reader crosses between the two surfaces
 * constantly, and until now each taught a different vocabulary for the same
 * ideas.
 */
export default function PlanTabNavigation({
  activeTab,
  onTabChange,
  hasAssets,
}: PlanTabNavigationProps): React.ReactElement {
  const active = TABS.find((t) => t.id === activeTab)

  return (
    <div className="mb-5">
      <div className="flex w-full gap-1 rounded-lg bg-gray-100 p-1 sm:w-fit dark:bg-gray-800">
        {TABS.map((tab) => {
          const isDisabled =
            TABS_REQUIRING_ASSETS.includes(tab.id) && !hasAssets
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => !isDisabled && onTabChange(tab.id)}
              disabled={isDisabled}
              aria-current={isActive ? "page" : undefined}
              title={
                isDisabled
                  ? "Add some holdings and this will have something to chart"
                  : undefined
              }
              className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-2 py-2 text-sm sm:flex-none sm:px-4 font-medium transition-colors duration-150 motion-reduce:transition-none ${
                isDisabled
                  ? "cursor-not-allowed text-gray-500 dark:text-gray-600"
                  : isActive
                    ? "bg-white text-independence-700 shadow-sm dark:bg-gray-900 dark:text-independence-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              {/* Icons drop below sm so three tabs fit a 390px screen. The
                  wrapper carries the display rule; FontAwesome's own .fas
                  display would beat a utility on the <i>. */}
              <span className="hidden sm:inline" aria-hidden="true">
                <i className={`fas ${tab.icon} mr-2 text-xs`} />
              </span>
              {tab.label}
            </button>
          )
        })}
      </div>
      {active && (
        <p className="mt-2 max-w-prose text-sm text-gray-600 dark:text-gray-400">
          {active.byline}
        </p>
      )}
    </div>
  )
}
