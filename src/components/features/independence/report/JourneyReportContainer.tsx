import React, { useEffect, useRef } from "react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { useCompositeProjection } from "@hooks/useCompositeProjection"
import { useCompositeMonteCarloSimulation } from "@hooks/useCompositeMonteCarloSimulation"
import { reportSeed } from "@lib/independence/report/reportSeed"
import { stableStringify } from "@lib/independence/report/inputKey"
import type { AssetBreakdown } from "../useAssetBreakdown"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../composite/CompositeProjectionContext"
import JourneyReport from "./JourneyReport"

/**
 * Wires the journey report to live data: the same composite projection the
 * journey page reads, one seeded composite Monte Carlo run, and the composite
 * context the wealth chart needs.
 */
export interface JourneyReportContainerProps {
  /** The journey (IndependencePlan) id; seeds the stress test. */
  journeyId: string
  journeyName: string
  /** The journey's stage plans. */
  plans: RetirementPlan[]
  settings: UserIndependenceSettings | undefined
  assets: AssetBreakdown
  hideValues: boolean
}

export default function JourneyReportContainer({
  journeyId,
  journeyName,
  plans,
  settings,
  assets,
  hideValues,
}: JourneyReportContainerProps): React.ReactElement {
  const projectionState = useCompositeProjection(plans, settings, journeyId)
  const { result, isRunning, error, runSimulation } =
    useCompositeMonteCarloSimulation()
  const { projection, phases, displayCurrency, isSettled } = projectionState

  const seed = projection ? reportSeed(journeyId, projection.asOfDate) : null
  // One seeded run per distinct set of inputs; equal inputs never re-post.
  const inputKey =
    seed === null ? null : stableStringify({ seed, phases, displayCurrency })
  const lastRunKey = useRef<string | null>(null)
  useEffect(() => {
    if (inputKey === null || seed === null) return
    if (lastRunKey.current === inputKey) return
    lastRunKey.current = inputKey
    void runSimulation({ iterations: 1000, phases, displayCurrency, seed })
  }, [inputKey, seed, phases, displayCurrency, runSimulation])

  if (!isSettled || (!projection && !projectionState.error)) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Preparing report..." size="lg" />
      </div>
    )
  }
  if (!projection) {
    return (
      <Alert>The journey could not be projected: {projectionState.error}</Alert>
    )
  }

  const contextValue: CompositeProjectionValue = {
    plans,
    ...projectionState,
    mc: { result, isRunning, error, run: runSimulation },
  }
  const stagePlans = projection.phases
    .map((ph) => plans.find((p) => p.id === ph.planId))
    .filter((p): p is RetirementPlan => p !== undefined)

  return (
    <CompositeProjectionProvider value={contextValue}>
      <JourneyReport
        journeyName={journeyName}
        projection={projection}
        mc={result}
        seed={seed ?? undefined}
        mcError={error?.message ?? null}
        hideValues={hideValues}
        stagePlans={stagePlans}
        assets={assets}
        backHref={`/independence?plan=${encodeURIComponent(journeyId)}`}
      />
    </CompositeProjectionProvider>
  )
}
