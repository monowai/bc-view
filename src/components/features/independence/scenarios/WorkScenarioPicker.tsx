import React from "react"
import useSwr from "swr"
import type { WorkScenariosResponse } from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { useCompositeProjectionContext } from "../composite/CompositeProjectionContext"

const WORK_SCENARIOS_URL = "/api/independence/work-scenarios"

/**
 * Which work scenario this plan's accumulation runs on.
 *
 * Reads and writes through the composite projection context rather than
 * touching the journey itself. That context is already the single writer of
 * `journey.workScenarioId` — it seeds once per journey and saves on a debounce
 * — so a second component PATCHing the row directly would be overwritten by
 * its stale copy on the next save.
 *
 * The control this replaces wrote `settings.compositeWorkScenarioId`, which
 * nothing has read since the composite moved onto the journey: it had been
 * inert, not merely misplaced.
 */
export default function WorkScenarioPicker(): React.ReactElement | null {
  const { compositeWorkScenarioId, setCompositeWorkScenarioId } =
    useCompositeProjectionContext()
  const { data } = useSwr<WorkScenariosResponse>(
    WORK_SCENARIOS_URL,
    simpleFetcher(WORK_SCENARIOS_URL),
  )
  const scenarios = data?.data ?? []
  if (scenarios.length === 0) return null

  // A named scenario that no longer resolves reads as "whichever is current",
  // which is what svc-retire actually projects. Relying on the browser to show
  // the first option for an unmatched value would look the same today and stop
  // being true the moment a placeholder moves.
  const selected = scenarios.some((s) => s.id === compositeWorkScenarioId)
    ? (compositeWorkScenarioId ?? "")
    : ""

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <label
          htmlFor="journey-work-scenario"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Scenario this plan runs on
        </label>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Its income and spending drive the years before you stop working.
        </p>
      </div>
      <select
        id="journey-work-scenario"
        value={selected}
        onChange={(e) =>
          setCompositeWorkScenarioId(e.target.value || undefined)
        }
        className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-independence-500 focus:ring-2 focus:ring-independence-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {/* Naming none is a real choice, not an empty state: it follows
            whichever scenario is current, so the plan tracks the default. */}
        <option value="">Whichever is current</option>
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.name}
            {scenario.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>
    </div>
  )
}
