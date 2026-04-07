import React from "react"
import PhaseConfigList from "../../PhaseConfigList"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

const HIDDEN_VALUE = "****"

/**
 * Plans tab — combines phase configuration and the scenario comparison table.
 * Reads all state from {@link useCompositeProjectionContext}.
 */
export default function PlansTab(): React.ReactElement {
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
  } = useCompositeProjectionContext()

  return (
    <div className="space-y-6">
      {/* Phase Configuration */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <PhaseConfigList
          plans={plans}
          phases={phases}
          onPhaseChange={setPhases}
          onExclude={toggleExclusion}
          excludedPlanIds={excludedPlanIds}
        />
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
