import React, { useState } from "react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
  CompositeYearlyProjection,
} from "types/independence"
import { useCompositeProjection } from "@hooks/useCompositeProjection"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import PhaseConfigList from "./PhaseConfigList"
import IndependenceSettingsModal from "./IndependenceSettingsModal"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"

const HIDDEN_VALUE = "****"

interface CompositeTabProps {
  plans: RetirementPlan[]
  settings: UserIndependenceSettings | undefined
}

function formatMoney(
  value: number,
  currency: string,
  hide: boolean,
): string {
  if (hide) return HIDDEN_VALUE
  return `${currency} ${Math.round(value).toLocaleString()}`
}

export default function CompositeTab({
  plans,
  settings,
}: CompositeTabProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const [showSettings, setShowSettings] = useState(false)
  const {
    phases,
    setPhases,
    displayCurrency,
    setDisplayCurrency,
    excludedPlanIds,
    toggleExclusion,
    projection,
    scenarios,
    isLoading,
    error,
  } = useCompositeProjection(plans, settings)

  // Collect unique currencies from plans
  const currencies = Array.from(
    new Set(plans.map((p) => p.expensesCurrency).filter(Boolean)),
  )

  // Sustainability indicator
  const sustainabilityText = projection
    ? projection.isSustainable
      ? `Sustainable to age ${projection.yearlyProjections[projection.yearlyProjections.length - 1]?.age ?? "?"}`
      : `Depletes at age ${projection.depletionAge ?? "?"}`
    : null

  return (
    <div className="space-y-6">
      {/* Settings Bar */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="composite-currency"
              className="text-sm font-medium text-gray-700"
            >
              Display Currency
            </label>
            <select
              id="composite-currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="text-sm text-independence-600 hover:text-independence-800 font-medium"
          >
            <i className="fas fa-cog mr-1"></i>
            Settings
          </button>

          {sustainabilityText && (
            <span
              className={`ml-auto text-sm font-medium px-3 py-1 rounded-full ${
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
        </div>
      </div>

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

      {/* Timeline Table */}
      {!isLoading && projection && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Year-by-Year Timeline
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-2">Age</th>
                  <th className="py-2 px-2">Phase</th>
                  <th className="py-2 px-2 text-right">Starting</th>
                  <th className="py-2 px-2 text-right">Income</th>
                  <th className="py-2 px-2 text-right">Expenses</th>
                  <th className="py-2 px-2 text-right">Ending</th>
                </tr>
              </thead>
              <tbody>
                {projection.yearlyProjections.map(
                  (row: CompositeYearlyProjection, idx: number) => {
                    const isPhaseStart =
                      idx === 0 ||
                      row.planId !==
                        projection.yearlyProjections[idx - 1]?.planId
                    return (
                      <tr
                        key={`${row.year}-${row.planId}`}
                        className={`border-b border-gray-50 ${
                          isPhaseStart ? "border-t-2 border-t-independence-200" : ""
                        } ${row.endingBalance <= 0 ? "bg-red-50" : ""}`}
                      >
                        <td className="py-1.5 px-2 text-gray-600">
                          {row.age}
                        </td>
                        <td className="py-1.5 px-2 text-gray-700">
                          {isPhaseStart ? (
                            <span className="font-medium">{row.planName}</span>
                          ) : (
                            <span className="text-gray-400">&mdash;</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {formatMoney(
                            row.startingBalance,
                            displayCurrency,
                            hideValues,
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right text-green-600">
                          {formatMoney(row.income, displayCurrency, hideValues)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-red-600">
                          {formatMoney(
                            row.expenses,
                            displayCurrency,
                            hideValues,
                          )}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right font-medium ${
                            row.endingBalance <= 0
                              ? "text-red-600"
                              : "text-gray-800"
                          }`}
                        >
                          {formatMoney(
                            row.endingBalance,
                            displayCurrency,
                            hideValues,
                          )}
                        </td>
                      </tr>
                    )
                  },
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <tr
                    key={s.name}
                    className="border-b border-gray-50"
                  >
                    <td className="py-1.5 px-2">
                      <div className="font-medium text-gray-800">
                        {s.name}
                      </div>
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
                        : s.projection.depletionAge ?? "Never"}
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

      {showSettings && (
        <IndependenceSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
