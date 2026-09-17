import React from "react"
import KpiCard from "@components/ui/KpiCard"
import Spinner from "@components/ui/Spinner"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { compositeOutlook } from "@lib/independence/compositeOutlook"
import { compositeAnswers } from "@lib/independence/compositeAnswers"
import { formatCompact } from "@lib/formatters"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"

const HIDDEN_VALUE = "****"

/**
 * The answer, at the top of the page.
 *
 * This surface used to open on a list of phase spending boards, with the
 * verdict four tabs away under "FI Overview". Someone who is still learning to
 * read their own plan should not have to go looking for whether it works: the
 * sentence comes first, the four numbers that support it come second, and
 * everything else on the page is evidence for this claim.
 *
 * Status is never carried by colour alone — each state pairs its hue with a
 * word and an icon, so the verdict survives a red/green colour deficiency.
 */
export default function PlanVerdict(): React.ReactElement | null {
  const { projection, isLoading, currentAge, displayCurrency, mc } =
    useCompositeProjectionContext()
  const { hideValues } = usePrivacyMode()

  if (isLoading && !projection) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Working out where you stand…" size="lg" />
      </div>
    )
  }

  // Projection failures are reported once, by the page — not here and again
  // on the chart, which reads the same `error`.
  const outlook = compositeOutlook(projection)
  const answers = compositeAnswers(projection, currentAge)
  if (!outlook || !answers || !projection) return null

  const money = (v: number): string =>
    hideValues ? HIDDEN_VALUE : formatCompact(v, displayCurrency)

  const successRate = mc.result?.successRate

  return (
    <section
      aria-labelledby="plan-verdict-headline"
      className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2
            id="plan-verdict-headline"
            className="text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100"
          >
            {hideValues ? "Your plan is hidden." : outlook.headline}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm text-gray-600 dark:text-gray-400">
            {outlook.statement}
            {answers.dipsBelow &&
              " Your balance does dip back below the target later on."}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
            outlook.sustainable
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          <i
            aria-hidden="true"
            className={`fas ${
              outlook.sustainable
                ? "fa-check-circle"
                : "fa-exclamation-triangle"
            }`}
          />
          {outlook.sustainable ? "Holds up" : "Needs a look"}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-gray-100 pt-5 sm:grid-cols-4 dark:border-gray-800">
        <KpiCard
          label="Target to retire on"
          value={money(answers.fiNumber)}
          sub="25× your yearly spending"
        />
        <KpiCard
          label={answers.isAchieved ? "You're over by" : "Still to save"}
          value={money(Math.abs(answers.gap))}
          tone={answers.isAchieved ? "positive" : "default"}
          sub={answers.isAchieved ? "past the target" : "to reach the target"}
        />
        <KpiCard
          label={answers.fiCrossingAge ? "You get there at" : "Money lasts"}
          value={
            answers.fiCrossingAge
              ? `age ${answers.fiCrossingAge}`
              : projection.runwayYears > 50
                ? "50+ yrs"
                : `${projection.runwayYears} yrs`
          }
          sub={
            answers.fiCrossingAge
              ? answers.yearsToFi != null && answers.yearsToFi > 0
                ? `${answers.yearsToFi} year${answers.yearsToFi === 1 ? "" : "s"} from now`
                : "already there"
              : "at this rate of spending"
          }
        />
        <KpiCard
          label="Survives bad markets"
          value={successRate != null ? `${successRate.toFixed(0)}%` : "—"}
          tone={
            successRate == null
              ? "default"
              : successRate >= 80
                ? "positive"
                : successRate >= 60
                  ? "warning"
                  : "negative"
          }
          sub={
            successRate != null
              ? "of simulated markets"
              : "test it on the chart below"
          }
        />
      </div>
    </section>
  )
}
