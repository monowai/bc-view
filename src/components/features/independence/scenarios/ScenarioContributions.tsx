import React, { useEffect, useMemo, useState, useCallback } from "react"
import useSWR from "swr"
import { PlanContribution } from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import PensionProjectionModal from "@components/features/independence/scenarios/PensionProjectionModal"

/**
 * Per-asset pension contribution editor for a Work Scenario.
 *
 * Lists the user's pension/policy assets and lets them set how much this
 * scenario contributes per asset. The backend (svc-retire) annualises the
 * stored monthlyAmount using the asset's contributionFrequency
 * (MONTHLY × 12, ANNUAL × 1) when feeding the Independence projection,
 * so the input label adapts to whichever cadence the asset is configured
 * for — entering "8000" against an ANNUAL-frequency asset means $8,000
 * per year, not per month.
 */

interface PensionAsset {
  assetId: string
  assetName: string
  contributionFrequency: "MONTHLY" | "ANNUAL"
  policyType?: string
  payoutAge?: number
  updatedDate?: string
  subAccounts?: { code: string; balance: number }[]
  monthlyPayoutAmount?: number
  expectedReturnRate?: number
  monthlyContribution?: number
  cpfLifePlan?: string
}

interface PrivateAssetConfig {
  assetId: string
  isPension?: boolean
  policyType?: string
  contributionFrequency?: "MONTHLY" | "ANNUAL"
  payoutAge?: number
  updatedDate?: string
  subAccounts?: { code: string; balance: number }[]
  monthlyPayoutAmount?: number
  expectedReturnRate?: number
  monthlyContribution?: number
  cpfLifePlan?: string
}

interface PrivateAssetConfigsResponse {
  data: PrivateAssetConfig[]
  assetNames?: Record<string, string>
}

interface ScenarioContributionsProps {
  scenarioId: string
  currency: string
  /**
   * The scenario's monthly working income. When >0 AND we know the user's
   * age, the row for any CPF asset shows a tooltip with the salary-derived
   * contribution figure the projection WOULD have applied — so the user
   * can see what they're overriding (employer + employee combined).
   */
  monthlySalary?: number
  currentAge?: number
}

interface CpfPreviewResponse {
  data: {
    annualContribution: number
    monthlyContribution: number
    annualOa: number
    annualSa: number
    annualMa: number
    employeeRate: number
    employerRate: number
    cappedSalary: number
    wageCeiling: number
  }
}

export default function ScenarioContributions({
  scenarioId,
  currency,
  monthlySalary,
  currentAge,
}: ScenarioContributionsProps): React.ReactElement | null {
  const configsKey = "/api/assets/config"
  const contributionsKey = `/api/independence/work-scenarios/${scenarioId}/contributions`
  // Skip the preview fetch if we don't have both salary and age — there's
  // nothing useful to show. Reuse one preview for all CPF rows; salary
  // is at the scenario level, so the figure is the same for each asset.
  const previewKey =
    monthlySalary && monthlySalary > 0 && currentAge && currentAge > 0
      ? `/api/independence/cpf/contribution-preview?monthlySalary=${monthlySalary}&age=${currentAge}`
      : null
  const { data: previewResp } = useSWR<CpfPreviewResponse>(
    previewKey,
    simpleFetcher,
  )
  const salaryAnnual = previewResp?.data?.annualContribution

  const { data: configsResp } = useSWR<PrivateAssetConfigsResponse>(
    configsKey,
    simpleFetcher,
  )
  const { data: contribsResp, mutate: refreshContribs } = useSWR<{
    data: PlanContribution[]
  }>(contributionsKey, simpleFetcher)

  const pensionAssets: PensionAsset[] = (configsResp?.data || [])
    .filter((c) => c.isPension)
    .map((c) => ({
      assetId: c.assetId,
      assetName: configsResp?.assetNames?.[c.assetId] || c.assetId,
      contributionFrequency: c.contributionFrequency || "MONTHLY",
      policyType: c.policyType,
      payoutAge: c.payoutAge,
      updatedDate: c.updatedDate,
      subAccounts: c.subAccounts,
      monthlyPayoutAmount: c.monthlyPayoutAmount,
      expectedReturnRate: c.expectedReturnRate,
      monthlyContribution: c.monthlyContribution,
      cpfLifePlan: c.cpfLifePlan,
    }))

  const [projectionAsset, setProjectionAsset] = useState<PensionAsset | null>(
    null,
  )

  const contribsByAssetId = useMemo(() => {
    const map: Record<string, PlanContribution> = {}
    for (const c of contribsResp?.data || []) {
      map[c.assetId] = c
    }
    return map
  }, [contribsResp])

  // Local edits keyed by assetId. String to preserve typing UX.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Seed edits from server when contributions land. Key the effect on a
  // stringified snapshot so identical SWR refreshes don't reset local
  // edits the user is mid-typing — and don't cause an infinite render
  // loop when the SWR cache returns a fresh object on every poll.
  const contribsSignature = (contribsResp?.data || [])
    .map((c) => `${c.assetId}=${c.monthlyAmount}`)
    .sort()
    .join("|")
  useEffect(() => {
    if (!contribsResp?.data) return
    const seed: Record<string, string> = {}
    for (const c of contribsResp.data) {
      seed[c.assetId] = String(c.monthlyAmount)
    }
    setEdits(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contribsSignature])

  const saveOne = useCallback(
    async (asset: PensionAsset) => {
      const raw = edits[asset.assetId] ?? ""
      const amount = parseFloat(raw) || 0
      const existing = contribsByAssetId[asset.assetId]
      // If the user clears the input and no contribution existed, do nothing.
      if (amount === 0 && !existing) return
      setSavingAssetId(asset.assetId)
      setError(null)
      try {
        const res = await fetch(
          `/api/independence/work-scenarios/${scenarioId}/contributions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: asset.assetId,
              assetName: asset.assetName,
              monthlyAmount: amount,
              currency,
              contributionType: "PENSION",
            }),
          },
        )
        if (!res.ok) throw new Error(`Save failed: ${res.status}`)
        await refreshContribs()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSavingAssetId(null)
      }
    },
    [edits, contribsByAssetId, scenarioId, currency, refreshContribs],
  )

  if (!configsResp) return null
  if (pensionAssets.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No pension or policy assets configured. Mark an asset as a pension in
        Edit Asset to allocate contributions here.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <div
          role="alert"
          className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-2 py-1"
        >
          {error}
        </div>
      )}
      <ul className="divide-y divide-gray-200">
        {pensionAssets.map((asset) => {
          const value = edits[asset.assetId] ?? ""
          const isSaving = savingAssetId === asset.assetId
          const frequencyLabel =
            asset.contributionFrequency === "ANNUAL" ? "per year" : "per month"
          return (
            <li key={asset.assetId} className="py-2 flex items-center gap-3">
              <span className="flex-1 text-sm text-gray-700">
                {asset.assetName}
                {asset.policyType && (
                  <span className="ml-2 text-xs text-gray-400">
                    {asset.policyType}
                  </span>
                )}
                {asset.policyType === "CPF" && salaryAnnual != null && (
                  <span
                    className="ml-2 text-xs text-gray-500 cursor-help"
                    title={`Your salary-based CPF contribution would be ${currency} ${salaryAnnual.toLocaleString()}/yr (employer + employee combined at the age-${currentAge} band). Entering an amount here overrides that figure for the projection.`}
                  >
                    {" "}
                    ⓘ salary-based: {currency}{" "}
                    {Math.round(salaryAnnual).toLocaleString()}/yr
                  </span>
                )}
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={value}
                aria-label={`Contribution for ${asset.assetName}`}
                onChange={(e) =>
                  setEdits((prev) => ({
                    ...prev,
                    [asset.assetId]: e.target.value,
                  }))
                }
                onBlur={() => saveOne(asset)}
                disabled={isSaving}
                className="w-32 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              />
              <span className="text-xs text-gray-500 w-20">
                {currency} {frequencyLabel}
              </span>
              <button
                type="button"
                onClick={() => setProjectionAsset(asset)}
                disabled={!asset.payoutAge || !currentAge}
                title={
                  !asset.payoutAge
                    ? "Set a payout age on the asset to view projection"
                    : !currentAge
                      ? "Set year of birth on your plan to view projection"
                      : "Year-by-year balance projection until payout"
                }
                className="text-xs text-independence-600 hover:text-independence-800 disabled:text-gray-300 disabled:cursor-not-allowed underline"
              >
                Projection
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-gray-400">
        Contributions are saved when you leave the field. Frequency comes from
        the asset itself (Edit Asset → Contribution).
      </p>
      {projectionAsset && currentAge && (
        <PensionProjectionModal
          asset={projectionAsset}
          currency={currency}
          currentAge={currentAge}
          scenarioMonthlySalary={monthlySalary}
          scenarioAnnualOverride={
            (parseFloat(edits[projectionAsset.assetId] || "0") || 0) *
            (projectionAsset.contributionFrequency === "ANNUAL" ? 1 : 12)
          }
          onClose={() => setProjectionAsset(null)}
        />
      )}
    </div>
  )
}
