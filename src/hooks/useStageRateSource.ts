import { useCallback, useState } from "react"
import { mutate } from "swr"
import type { RetirementPlan } from "types/independence"
import { toPlanRequestPayload } from "@utils/independence/planHelpers"
import { toErrorMessage } from "@lib/formatters"

/** SWR key the composite page reads its phase plans from. */
const PLANS_KEY = "/api/independence/plans"

const FAILED = "Failed to change which rates this stage uses"

function withoutError(
  errors: Record<string, string>,
  planId: string,
): Record<string, string> {
  if (!(planId in errors)) return errors
  const next = { ...errors }
  delete next[planId]
  return next
}

async function writeAssumptionSource(
  plan: RetirementPlan,
  assumptionsInherited: boolean,
): Promise<void> {
  // Full-plan echo: svc-retire's PATCH replaces every field it receives and
  // defaults the ones it doesn't, so a {assumptionsInherited}-only body
  // 400s or clobbers the stage's other settings.
  const response = await fetch(`/api/independence/plans/${plan.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...toPlanRequestPayload(plan),
      assumptionsInherited,
    }),
  })
  if (!response.ok) throw new Error(FAILED)
}

export interface StageRateSource {
  /** Write the flag, refresh the plans, then queue a projection re-run. */
  setInherits: (plan: RetirementPlan, inherits: boolean) => Promise<void>
  /** True while this plan's write is out. */
  isSaving: (planId: string) => boolean
  /** The last failure for this plan; cleared once a write succeeds or retries. */
  errorFor: (planId: string) => string | undefined
}

/**
 * The one way a stage's `assumptionsInherited` flag is flipped from the
 * composite page, shared by the Assumptions tab and the stage drawer so the
 * two surfaces cannot drift in what they write or what they refresh after.
 *
 * In-flight writes are tracked per plan: two stages switched in quick
 * succession are two writes, and tracking only the latest would re-enable
 * the first stage's control while its PATCH is still out.
 */
export function useStageRateSource(
  refreshProjection: () => void,
): StageRateSource {
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setInherits = useCallback(
    async (plan: RetirementPlan, inherits: boolean): Promise<void> => {
      setSavingIds((prev) => new Set(prev).add(plan.id))
      setErrors((prev) => withoutError(prev, plan.id))
      try {
        await writeAssumptionSource(plan, inherits)
        await mutate(PLANS_KEY)
        // The request the projection keys off has not changed — only the
        // plan behind one of its phases has — so ask for it. The ask goes
        // through the projection's own debounce, not around it.
        refreshProjection()
      } catch (e) {
        setErrors((prev) => ({ ...prev, [plan.id]: toErrorMessage(e, FAILED) }))
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev)
          next.delete(plan.id)
          return next
        })
      }
    },
    [refreshProjection],
  )

  const isSaving = useCallback(
    (planId: string) => savingIds.has(planId),
    [savingIds],
  )
  const errorFor = useCallback((planId: string) => errors[planId], [errors])

  return { setInherits, isSaving, errorFor }
}
