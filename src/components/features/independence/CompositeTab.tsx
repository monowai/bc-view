import React from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { useCompositeProjection } from "@hooks/useCompositeProjection"
import { useCompositeMonteCarloSimulation } from "@hooks/useCompositeMonteCarloSimulation"
import {
  CompositeProjectionProvider,
  CompositeProjectionValue,
  useCompositeProjectionContext,
} from "./composite/CompositeProjectionContext"
import PlanVerdict from "./composite/PlanVerdict"
import WealthOverTime from "./composite/WealthOverTime"
import PhaseSpendList from "./composite/PhaseSpendList"
import YearByYearTable from "./composite/YearByYearTable"
import PhasesTab from "./composite/tabs/PhasesTab"
import WorkingYearsSection from "./scenarios/WorkingYearsSection"
import NetWorthTab from "./composite/tabs/NetWorthTab"

/**
 * `plan` reads the projection; `stages` and `wealth` change it. The page keeps
 * the two kinds apart — settings live behind Set up, never in the same row as
 * the charts — but both need this provider, so both are rendered from here.
 */
export type CompositeMode = "plan" | "stages" | "wealth" | "work"

interface CompositeTabProps {
  plans: RetirementPlan[]
  settings: UserIndependenceSettings | undefined
  /**
   * Active independence plan ("journey") — the row that owns this composite.
   * Resolved by the page from `?plan=`; see useActiveIndependencePlan.
   */
  activePlanId?: string
  mode?: CompositeMode
}

/**
 * A phased independence plan, as one page.
 *
 * This used to be seven sub-tabs — Summary, Phases, Net Worth, FI Overview,
 * Wealth Journey, Stress Test, Year-by-Year — sitting under another five at
 * page level. Two of the seven were settings, three drew wealth against age,
 * and two ran the same Monte Carlo behind separate controls, so the reader had
 * to visit four of them to assemble an answer the tool already had.
 *
 * It now reads top to bottom as one argument: here is whether your plan works,
 * here is the picture it comes from, here is what it buys you — with the
 * ledger and the settings a deliberate step away rather than a peer of the
 * verdict.
 */
export default function CompositeTab({
  plans,
  settings,
  activePlanId,
  mode = "plan",
}: CompositeTabProps): React.ReactElement {
  const projectionState = useCompositeProjection(plans, settings, activePlanId)
  const { result, isRunning, error, runSimulation } =
    useCompositeMonteCarloSimulation()

  const contextValue: CompositeProjectionValue = {
    plans,
    ...projectionState,
    mc: { result, isRunning, error, run: runSimulation },
  }

  return (
    <CompositeProjectionProvider value={contextValue}>
      {mode === "stages" && <PhasesTab />}
      {mode === "wealth" && <NetWorthTab />}
      {mode === "work" && <WorkingYearsSection />}
      {mode === "plan" && <PlanNarrative />}
    </CompositeProjectionProvider>
  )
}

function PlanNarrative(): React.ReactElement {
  const { projection, phases, isLoading, error } =
    useCompositeProjectionContext()
  const hasRows = (projection?.yearlyProjections?.length ?? 0) > 0

  // Without stages there is no projection to run, and useCompositeProjection
  // returns early without setting an error — so every section below renders
  // null and the page goes silent. Say what's missing instead: this is the
  // state a new plan starts in, and an empty page teaches nobody anything.
  if (!isLoading && !error && phases.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Nothing to project yet
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-600 dark:text-gray-400">
          Your plan needs at least one stage — a stretch of years with its own
          spending — before we can work out whether the money lasts.
        </p>
        <Link
          href="/independence?view=phases"
          className="mt-5 inline-flex items-center rounded-lg bg-independence-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-independence-700 motion-reduce:transition-none"
        >
          <i aria-hidden="true" className="fas fa-sliders-h mr-2" />
          Set up your stages
        </Link>
      </div>
    )
  }

  // One projection, so one failure message. Reported here rather than inside
  // each section: the verdict and the chart both read the same `error`, so
  // letting each render it printed the same sentence twice.
  if (error) return <Alert>{error}</Alert>

  // Stages exist but nothing came back and nothing is in flight — the
  // projection service is unreachable or refused the request. Previously this
  // also rendered as an empty page.
  if (!isLoading && !projection) {
    return (
      <Alert>
        We couldn&apos;t work out your projection just now. Refresh to try again
        — your plan and its stages are safe.
      </Alert>
    )
  }

  return (
    <div className="space-y-8">
      <PlanVerdict />
      <WealthOverTime />

      {hasRows && (
        <details className="group rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 sm:px-6 dark:text-gray-300 dark:hover:text-gray-100">
            <i
              aria-hidden="true"
              className="fas fa-chevron-right text-xs text-gray-400 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
            />
            Show the year-by-year numbers
          </summary>
          <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-gray-800">
            <YearByYearTable />
          </div>
        </details>
      )}

      <PhaseSpendList />
    </div>
  )
}
