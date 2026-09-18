import React from "react"
import ScenarioList from "./ScenarioList"
import WorkScenarioPicker from "./WorkScenarioPicker"
import { useCompositeProjectionContext } from "../composite/CompositeProjectionContext"
import { landingPlan } from "@lib/independence/journeyPhases"

/**
 * Working years: which scenario this plan runs on, and the scenarios to choose
 * from.
 *
 * Rendered inside the composite provider so the picker writes through the one
 * component that owns `journey.workScenarioId`, and so the list can mark the
 * scenario actually in use rather than the account-wide default.
 */
export default function WorkingYearsSection(): React.ReactElement {
  const { plans, compositeWorkScenarioId } = useCompositeProjectionContext()

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <WorkScenarioPicker />
      </section>
      <ScenarioList
        // Journey-scoped: with a primary per journey (svc-retire#248),
        // searching every owned row defaults the currency to whichever
        // journey happens to sort first.
        defaultCurrency={landingPlan(plans)?.expensesCurrency}
        usedScenarioId={compositeWorkScenarioId}
      />
    </div>
  )
}
