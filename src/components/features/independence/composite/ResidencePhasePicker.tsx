import React, { useState } from "react"
import type { PropertyIncomeRequest, RetirementPlan } from "types/independence"
import { usePropertyIncomes } from "@utils/independence/usePropertyIncomes"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"
import LeverRow, { LEVER_SELECT_CLASS } from "./LeverRow"

/** `<select>` value representing "no owner-occupy phase selected". */
const RENTED_THROUGHOUT = ""

function getPlanName(plans: RetirementPlan[], planId: string): string {
  return plans.find((p) => p.id === planId)?.name ?? "Unknown Plan"
}

/**
 * Per-rental-property residence phase picker on the composite Phases tab.
 *
 * For each rental property (private asset config with isPrimaryResidence
 * false), the user chooses either "Rented throughout" or the retirement
 * phase in which they will move in and owner-occupy. Picking a phase
 * persists `occupiedFromAge = phase.fromAge` via the plan-scoped properties
 * endpoint (svc-retire #166); the backend suppresses rental income in
 * projections from that age onward. Picking "Rented throughout" deletes any
 * existing property-income row for that asset.
 *
 * The canonical plan for property rows is `phases[0].planId` — svc-retire
 * merges owner-occupancy across all phase plans, and the first phase's plan
 * is the canonical store for it.
 */
export default function ResidencePhasePicker(): React.ReactElement | null {
  const { plans, phases } = useCompositeProjectionContext()
  const canonicalPlanId = phases[0]?.planId

  const {
    configs,
    assetNames,
    isLoading: configsLoading,
  } = usePrivateAssetConfigs()
  const {
    isLoading: incomesLoading,
    savePropertyIncome,
    deletePropertyIncome,
    getPropertyIncomeForAsset,
  } = usePropertyIncomes(canonicalPlanId)

  const [savingAssetIds, setSavingAssetIds] = useState<Set<string>>(new Set())

  // Rental properties only: pensions/policies (e.g. CPF) also live in
  // PrivateAssetConfig, and a zero-rent property has no income to suppress.
  const rentalProperties = configs.filter(
    (c) => !c.isPrimaryResidence && !c.isPension && c.monthlyRentalIncome > 0,
  )

  if (phases.length === 0 || rentalProperties.length === 0) {
    return null
  }

  const setSaving = (assetId: string, saving: boolean): void => {
    setSavingAssetIds((prev) => {
      const next = new Set(prev)
      if (saving) {
        next.add(assetId)
      } else {
        next.delete(assetId)
      }
      return next
    })
  }

  const handleChange = async (
    assetId: string,
    value: string,
  ): Promise<void> => {
    setSaving(assetId, true)
    try {
      if (value === RENTED_THROUGHOUT) {
        if (getPropertyIncomeForAsset(assetId)) {
          await deletePropertyIncome(assetId)
        }
        return
      }

      const config = configs.find((c) => c.assetId === assetId)
      if (!config) return

      const fromAge = Number(value)
      const request: PropertyIncomeRequest = {
        assetId,
        assetName: assetNames[assetId],
        monthlyRentalIncome: config.monthlyRentalIncome,
        rentalCurrency: config.rentalCurrency,
        liquidationPriority: config.liquidationPriority,
        isPrimaryResidence: false,
        occupiedFromAge: fromAge,
      }
      await savePropertyIncome(request)
    } finally {
      setSaving(assetId, false)
    }
  }

  const isLoading = configsLoading || incomesLoading

  return (
    <>
      {rentalProperties.map((config) => {
        const row = getPropertyIncomeForAsset(config.assetId)
        const occupiedFromAge = row?.occupiedFromAge
        const hasOccupiedFromAge =
          occupiedFromAge !== undefined && occupiedFromAge !== null
        const matchedPhase = hasOccupiedFromAge
          ? phases.find((p) => p.fromAge === occupiedFromAge)
          : undefined
        const selectedValue = !hasOccupiedFromAge
          ? RENTED_THROUGHOUT
          : matchedPhase
            ? String(occupiedFromAge)
            : `custom-${occupiedFromAge}`

        const assetLabel = assetNames[config.assetId] || config.assetId
        const saving = savingAssetIds.has(config.assetId)

        return (
          <LeverRow
            key={config.assetId}
            label={`Move into ${assetLabel}`}
            hint={
              <>
                Earning{" "}
                <span className="font-mono tabular-nums">
                  {config.rentalCurrency}{" "}
                  {config.monthlyRentalIncome.toLocaleString()}
                </span>
                /mo until you do
              </>
            }
            control={
              <select
                aria-label={`${assetLabel} residence phase`}
                value={selectedValue}
                disabled={isLoading || saving}
                onChange={(e) => {
                  void handleChange(config.assetId, e.target.value)
                }}
                className={LEVER_SELECT_CLASS}
              >
                <option value={RENTED_THROUGHOUT}>Rented throughout</option>
                {phases.map((phase) => (
                  <option key={phase.planId} value={String(phase.fromAge)}>
                    {getPlanName(plans, phase.planId)} — from age{" "}
                    {phase.fromAge}
                  </option>
                ))}
                {hasOccupiedFromAge && !matchedPhase && (
                  <option value={`custom-${occupiedFromAge}`} disabled>
                    From age {occupiedFromAge}
                  </option>
                )}
              </select>
            }
          />
        )
      })}
    </>
  )
}
