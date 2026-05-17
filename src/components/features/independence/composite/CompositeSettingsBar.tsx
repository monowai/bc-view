import React from "react"
import useSwr from "swr"
import type { WorkScenariosResponse } from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"

const WORK_SCENARIOS_URL = "/api/independence/work-scenarios"

/**
 * Settings bar for the composite projection view.
 *
 * Renders the display-currency selector, a sustainability indicator pill,
 * and a free-form narrative field that describes the overarching goal of
 * the composite plan. The narrative is persisted in
 * `UserIndependenceSettings.compositeNarrative` and surfaced to the AI
 * agent as shared cross-plan context.
 */
export default function CompositeSettingsBar(): React.ReactElement {
  const {
    plans,
    displayCurrency,
    setDisplayCurrency,
    projection,
    compositeNarrative,
    setCompositeNarrative,
    compositeWorkScenarioId,
    setCompositeWorkScenarioId,
  } = useCompositeProjectionContext()

  const { data: scenariosData } = useSwr<WorkScenariosResponse>(
    WORK_SCENARIOS_URL,
    simpleFetcher(WORK_SCENARIOS_URL),
  )
  const workScenarios = scenariosData?.data ?? []

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
    <div className="bg-white rounded-xl shadow-md p-4">
      {/* Two-column layout: existing controls on the left, narrative on the right. */}
      <div className="flex flex-col md:flex-row md:items-start md:gap-6">
        {/* Existing controls: currency selector + sustainability pill */}
        <div className="flex flex-wrap items-center gap-4 md:flex-1">
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

          {workScenarios.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="composite-work-scenario"
                className="text-sm font-medium text-gray-700"
              >
                Work Scenario
              </label>
              <select
                id="composite-work-scenario"
                value={compositeWorkScenarioId ?? ""}
                onChange={(e) =>
                  setCompositeWorkScenarioId(e.target.value || undefined)
                }
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              >
                <option value="">Current scenario</option>
                {workScenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isCurrent ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {sustainabilityText && (
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
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

        {/* Narrative field — placed to the right of the existing controls on
            wider viewports, stacks below on small screens. */}
        <div className="mt-4 md:mt-0 md:w-1/2 md:max-w-md">
          <label
            htmlFor="composite-narrative"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Composite plan narrative
            <span className="ml-1 text-xs font-normal text-gray-500">
              (optional)
            </span>
          </label>
          <textarea
            id="composite-narrative"
            value={compositeNarrative ?? ""}
            onChange={(e) => setCompositeNarrative(e.target.value)}
            rows={4}
            placeholder="Tell us about the overarching goal of your plans. This serves as a prompt to AI tools to understand your strategy, goals and asperations."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Applies across all phases. The AI assistant reads this for
            cross-plan context.
          </p>
        </div>
      </div>
    </div>
  )
}
