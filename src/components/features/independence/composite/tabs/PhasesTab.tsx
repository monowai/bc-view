import React from "react"
import PhaseConfigList from "../../PhaseConfigList"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

const HIDDEN_VALUE = "****"

/**
 * Phases tab — phase configuration (left) + narrative (right) in a two-column
 * layout, followed by the scenario comparison table.
 */
export default function PhasesTab(): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const {
    plans,
    phases,
    setPhases,
    excludedPlanIds,
    toggleExclusion,
    scenarios,
    isLoading,
    error,
    compositeNarrative,
    setCompositeNarrative,
  } = useCompositeProjectionContext()

  return (
    <div className="space-y-6">
      {/* Phase Configuration + Narrative */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <PhaseConfigList
              plans={plans}
              phases={phases}
              onPhaseChange={setPhases}
              onExclude={toggleExclusion}
              excludedPlanIds={excludedPlanIds}
            />
          </div>
          <div className="w-72 shrink-0">
            <label
              htmlFor="composite-narrative"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Plan narrative
              <span className="ml-1 text-xs font-normal text-gray-500">
                (optional)
              </span>
            </label>
            <textarea
              id="composite-narrative"
              value={compositeNarrative ?? ""}
              onChange={(e) => setCompositeNarrative(e.target.value)}
              rows={7}
              placeholder="Overarching goal across all phases. Used as context by AI tools."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="text-center py-8">
          <Spinner label="Calculating composite projection..." size="lg" />
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {/* Scenario Comparison */}
      {!isLoading && scenarios && scenarios.scenarios.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Scenario Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-2">Scenario</th>
                  <th className="py-2 px-2 text-right">Runway (years)</th>
                  <th className="py-2 px-2 text-right">Depletion Age</th>
                  <th className="py-2 px-2 text-center">Sustainable</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.scenarios.map((s) => (
                  <tr key={s.name} className="border-b border-gray-50">
                    <td className="py-1.5 px-2">
                      <div className="font-medium text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-500">
                        {s.description}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">
                      {hideValues
                        ? HIDDEN_VALUE
                        : s.projection.runwayYears.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">
                      {hideValues
                        ? HIDDEN_VALUE
                        : (s.projection.depletionAge ?? "Never")}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {s.projection.isSustainable ? (
                        <span className="text-green-600">
                          <i className="fas fa-check"></i>
                        </span>
                      ) : (
                        <span className="text-red-600">
                          <i className="fas fa-times"></i>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
