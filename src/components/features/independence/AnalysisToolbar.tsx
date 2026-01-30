import React from "react"
import { QuickScenario } from "types/independence"

interface AnalysisToolbarProps {
  /** Available quick scenarios */
  quickScenarios: QuickScenario[]
  /** Currently selected scenario IDs */
  selectedScenarioIds: string[]
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean
  /** Callback when What-If button is clicked */
  onWhatIfClick: () => void
  /** Callback when a scenario is toggled */
  onScenarioToggle: (scenarioId: string) => void
  /** Callback to save the current scenario */
  onSave?: () => void
  /** Callback to reset all scenario changes */
  onReset?: () => void
}

/**
 * Global toolbar for What-If analysis and quick scenarios.
 * Available on all tabs.
 */
export default function AnalysisToolbar({
  quickScenarios,
  selectedScenarioIds,
  hasUnsavedChanges,
  onWhatIfClick,
  onScenarioToggle,
  onSave,
  onReset,
}: AnalysisToolbarProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <button
        onClick={onWhatIfClick}
        className="py-1.5 px-3 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center"
      >
        <i className="fas fa-sliders-h mr-2"></i>
        What-If
      </button>

      {/* Quick scenario toggles */}
      {quickScenarios.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickScenarios.map((scenario) => {
            const isSelected = selectedScenarioIds.includes(scenario.id)
            return (
              <button
                key={scenario.id}
                onClick={() => onScenarioToggle(scenario.id)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  isSelected
                    ? "bg-orange-500 text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
                title={scenario.description}
              >
                {isSelected && <i className="fas fa-check mr-1"></i>}
                {scenario.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Save/Reset and unsaved indicator */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-orange-600">
            <i className="fas fa-circle text-[6px] mr-1"></i>
            Unsaved
          </span>
          {onSave && (
            <button
              onClick={onSave}
              className="py-1 px-3 border border-orange-500 text-orange-500 rounded-lg text-xs font-medium hover:bg-orange-50 transition-colors"
            >
              <i className="fas fa-save mr-1"></i>
              Save
            </button>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className="py-1 px-2 text-gray-500 hover:text-gray-700 text-xs"
            >
              <i className="fas fa-undo mr-1"></i>
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
