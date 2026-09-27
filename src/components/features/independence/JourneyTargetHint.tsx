import React from "react"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"

interface JourneyTargetHintProps {
  /** Journey-level target ending balance, in `currency` (svc-retire#282). */
  amount: number
  /**
   * The currency `amount` is actually denominated in — the phase plans'
   * currency, e.g. `plan.expensesCurrency` — NOT a display currency. The
   * two can differ (OCR #4113948860); rendering `amount` under the wrong
   * currency reads as a converted figure when none has happened.
   */
  currency: string
  hideValues: boolean
}

/**
 * Muted note beside a stage's own `targetBalance` field/row, shown when the
 * stage's journey has stated a target that overrides it
 * (`journey.targetBalance ?? stage.targetBalance`). Shared by
 * `DetailsTabContent` (a read-only row) and `EditPlanDetailsModal` (an
 * editable field) so the wording, rounding and currency labelling can't
 * drift between the two (OCR #4113948852).
 */
export default function JourneyTargetHint({
  amount,
  currency,
  hideValues,
}: JourneyTargetHintProps): React.ReactElement {
  return (
    <p className="text-xs italic text-gray-400">
      Overridden by the journey target (
      {hideValues
        ? HIDDEN_VALUE
        : `${Math.round(amount).toLocaleString()} ${currency}`}
      )
    </p>
  )
}
