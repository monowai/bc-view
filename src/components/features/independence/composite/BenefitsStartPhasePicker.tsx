import React, { useId, useState } from "react"
import { mutate } from "swr"
import type { RetirementPlan } from "types/independence"
import { toPlanRequestPayload } from "@utils/independence/planHelpers"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"
import LeverRow, { LEVER_SELECT_CLASS } from "./LeverRow"

/** Same SWR key the Independence page uses to list plans (src/pages/independence/index.tsx). */
const PLANS_KEY = "/api/independence/plans"

function getPlanName(plans: RetirementPlan[], planId: string): string {
  return plans.find((p) => p.id === planId)?.name ?? "Unknown Plan"
}

async function updateBenefitsStartAge(
  plan: RetirementPlan,
  benefitsStartAge: number,
): Promise<void> {
  // Full-plan echo: svc-retire's PATCH replaces every field it receives and
  // defaults the ones it doesn't, so a {benefitsStartAge}-only body 400s
  // (name/monthlyExpenses required) or clobbers settings.
  const response = await fetch(`/api/independence/plans/${plan.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...toPlanRequestPayload(plan), benefitsStartAge }),
  })
  if (!response.ok) {
    throw new Error("Failed to update benefits start age")
  }
}

/**
 * Second phase-boundary lever on the composite Phases tab (sibling of
 * {@link ResidencePhasePicker}): pick the retirement phase in which NZ
 * Super / government benefits start paying.
 *
 * Unlike the per-property residence picker, this writes
 * `benefitsStartAge = selected phase's fromAge` to EVERY distinct phase
 * plan — the composite engine gates social security per phase plan, not
 * per composite, so all phase plans must agree for the projection to
 * reflect the choice. The plan-level `benefitsStartAge` editable via
 * EditPlanDetailsModal remains the single-phase fallback and is untouched
 * outside of this control's "current state" derivation.
 *
 * There is no "clear" option: the backend PATCH null-coalesces
 * `benefitsStartAge` on update, so sending `null`/`undefined` would keep
 * the existing value rather than clearing it.
 */
export default function BenefitsStartPhasePicker(): React.ReactElement | null {
  const { plans, phases } = useCompositeProjectionContext()
  const [saving, setSaving] = useState(false)
  // Derived per instance so the label/select association stays unique even if
  // the picker is ever rendered more than once on a page.
  const selectId = useId()

  if (phases.length === 0) {
    return null
  }

  // Distinct phase plans, in first-occurrence phase order.
  const distinctPlanIds = Array.from(new Set(phases.map((p) => p.planId)))
  const phasePlans = distinctPlanIds
    .map((id) => plans.find((p) => p.id === id))
    .filter((p): p is RetirementPlan => p !== undefined)

  const values = phasePlans.map((p) => p.benefitsStartAge)
  const allNullish = values.every((v) => v === undefined || v === null)
  const allEqual = values.every((v) => v === values[0])

  const matchedPhase =
    !allNullish && allEqual
      ? phases.find((p) => p.fromAge === values[0])
      : undefined

  let selectedValue: string
  let disabledOptionValue: string | undefined
  let disabledOptionLabel: string | undefined

  if (matchedPhase) {
    selectedValue = String(matchedPhase.fromAge)
  } else if (allNullish) {
    selectedValue = "not-set"
    disabledOptionValue = "not-set"
    disabledOptionLabel = "Not set (starts at retirement)"
  } else if (allEqual) {
    selectedValue = `custom-${values[0]}`
    disabledOptionValue = `custom-${values[0]}`
    disabledOptionLabel = `From age ${values[0]}`
  } else {
    selectedValue = "mixed"
    disabledOptionValue = "mixed"
    disabledOptionLabel = "Mixed"
  }

  const handleChange = async (value: string): Promise<void> => {
    const fromAge = Number(value)
    setSaving(true)
    try {
      for (const phasePlan of phasePlans) {
        // Sequential updates are fine here — fan-out is small (one per phase plan).
        await updateBenefitsStartAge(phasePlan, fromAge)
      }
      await mutate(PLANS_KEY)
    } finally {
      setSaving(false)
    }
  }

  return (
    <LeverRow
      label={
        <label htmlFor={selectId}>NZ Super / government benefits start</label>
      }
      hint="Applied to every plan in the timeline, so the projection gates them the same way."
      control={
        <select
          id={selectId}
          aria-label="NZ Super / benefits start"
          value={selectedValue}
          disabled={saving}
          onChange={(e) => {
            void handleChange(e.target.value)
          }}
          className={LEVER_SELECT_CLASS}
        >
          {disabledOptionValue && (
            <option value={disabledOptionValue} disabled>
              {disabledOptionLabel}
            </option>
          )}
          {phases.map((phase) => (
            <option key={phase.planId} value={String(phase.fromAge)}>
              {getPlanName(plans, phase.planId)} — from age {phase.fromAge}
            </option>
          ))}
        </select>
      }
    />
  )
}
