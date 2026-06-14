import React from "react"
import { RetirementProjection } from "types/independence"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface SpendableAtIndependenceCardProps {
  projection: RetirementProjection | null
  /** Spendable (liquid) assets in plan currency, before FX display conversion. */
  liquidAssets: number
  /** Present value of pensions excluded from the spendable pot (plan ccy). */
  excludedPensionFV: number
  /** FV differential of pensions included in the spendable pot (plan ccy). */
  includedPensionFvDifferential: number
  /** Plan-currency → display-currency rate. */
  effectiveFxRate: number
  currentAge: number | undefined
  retirementAge: number
  /** Display currency symbol/code prefix. */
  currency: string
  /** Render without the outer card chrome (for grouping in a shared section). */
  embedded?: boolean
}

/**
 * Spendable at Independence — projected liquid assets available to draw down
 * at the independence date. Paired with Sustainable Spending on My Plan so the
 * two headline outcome figures sit together. The figure prefers the backend's
 * pre-retirement accumulation (net of excluded pension FV) and falls back to
 * today's liquid plus the included-pension differential.
 */
export default function SpendableAtIndependenceCard({
  projection,
  liquidAssets,
  excludedPensionFV,
  includedPensionFvDifferential,
  effectiveFxRate,
  currentAge,
  retirementAge,
  currency,
  embedded = false,
}: SpendableAtIndependenceCardProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  const value = projection?.preRetirementAccumulation?.liquidAssetsAtRetirement
    ? projection.preRetirementAccumulation.liquidAssetsAtRetirement -
      excludedPensionFV * effectiveFxRate
    : (liquidAssets + includedPensionFvDifferential) * effectiveFxRate

  return (
    <div className={embedded ? "" : "bg-white rounded-xl shadow-md p-6"}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Spendable at Independence
      </h2>
      <div className="space-y-3">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Projected to independence
            {currentAge !== undefined && retirementAge && (
              <>
                {" "}
                · age {retirementAge}
                {retirementAge - currentAge > 0
                  ? `, ${retirementAge - currentAge}yr`
                  : ", now"}
              </>
            )}
          </span>
          <div
            className={`text-2xl font-bold ${hideValues ? "text-gray-400" : "text-independence-600"}`}
          >
            {hideValues
              ? HIDDEN_VALUE
              : `${currency}${Math.round(value).toLocaleString()}`}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Liquid (spendable) assets projected to be available at your
          independence age — the pot the rest of your plan draws down.
        </div>
      </div>
    </div>
  )
}
