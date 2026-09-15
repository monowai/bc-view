import { useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/router"
import useSwr from "swr"
import type { KeyedMutator } from "swr"
import type {
  IndependencePlan,
  IndependencePlanCopyRequest,
  IndependencePlanRequest,
  IndependencePlanResponse,
  IndependencePlansResponse,
} from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { primaryJourney } from "@lib/independence/journeyPhases"

/** SWR key for the user's journeys. Every mutator revalidates it. */
export const independencePlansKey = "/api/independence/independence-plans"

/** Query-string parameter carrying the selected journey on /independence. */
export const ACTIVE_PLAN_QUERY_PARAM = "plan"

export interface UseIndependencePlansResult {
  plans: IndependencePlan[]
  error: Error | undefined
  isLoading: boolean
  mutate: KeyedMutator<IndependencePlansResponse>
  create: (request: IndependencePlanRequest) => Promise<IndependencePlan>
  update: (
    id: string,
    request: IndependencePlanRequest,
  ) => Promise<IndependencePlan>
  setPrimary: (id: string) => Promise<void>
  duplicate: (
    id: string,
    request: IndependencePlanCopyRequest,
  ) => Promise<IndependencePlan>
  remove: (id: string) => Promise<void>
}

/**
 * The BFF forwards a backend rejection as `{ error, message, code }` (see
 * responseWriter). Validation failures — a `liquidationCostsPercent` outside
 * [0, 1), say — only mean something if that message reaches the user, so the
 * generic text is a fallback rather than the answer.
 *
 * Every mutator below goes through this, including the two that return no
 * body: "Failed to delete plan" tells the user nothing, while the backend's
 * own reason ("plan is shared with 2 people") tells them what to do next.
 */
async function throwIfFailed(
  response: Response,
  failure: string,
): Promise<void> {
  if (response.ok) return
  const body = await response.json().catch(() => undefined)
  const detail =
    body && typeof body === "object"
      ? ((body as { message?: string; error?: string }).message ??
        (body as { error?: string }).error)
      : undefined
  throw new Error(detail || failure)
}

/** As {@link throwIfFailed}, for the mutators that return the updated plan. */
async function readPlan(
  response: Response,
  failure: string,
): Promise<IndependencePlan> {
  await throwIfFailed(response, failure)
  const body: IndependencePlanResponse = await response.json()
  return body.data
}

/**
 * The user's independence plans — "journeys". Each owns its composite
 * timeline, display currency, work scenario and wealth definition; the
 * `RetirementPlan` rows are the phases within one.
 */
export function useIndependencePlans(): UseIndependencePlansResult {
  const { data, error, mutate } = useSwr<IndependencePlansResponse>(
    independencePlansKey,
    simpleFetcher(independencePlansKey),
  )

  const create = useCallback(
    async (request: IndependencePlanRequest): Promise<IndependencePlan> => {
      const response = await fetch(independencePlansKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
      const created = await readPlan(response, "Failed to create plan")
      await mutate()
      return created
    },
    [mutate],
  )

  // Stable identity so consumers can list `update` in effect deps without
  // re-firing every render (mutate from SWR is itself stable).
  const update = useCallback(
    async (
      id: string,
      request: IndependencePlanRequest,
    ): Promise<IndependencePlan> => {
      const response = await fetch(`${independencePlansKey}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
      const updated = await readPlan(response, "Failed to update plan")
      await mutate()
      return updated
    },
    [mutate],
  )

  const setPrimary = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`${independencePlansKey}/${id}/primary`, {
        method: "POST",
      })
      await throwIfFailed(response, "Failed to set default plan")
      await mutate()
    },
    [mutate],
  )

  const duplicate = useCallback(
    async (
      id: string,
      request: IndependencePlanCopyRequest,
    ): Promise<IndependencePlan> => {
      const response = await fetch(`${independencePlansKey}/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
      const copy = await readPlan(response, "Failed to duplicate plan")
      await mutate()
      return copy
    },
    [mutate],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`${independencePlansKey}/${id}`, {
        method: "DELETE",
      })
      await throwIfFailed(response, "Failed to delete plan")
      await mutate()
    },
    [mutate],
  )

  return {
    plans: data?.data ?? [],
    error,
    isLoading: !data && !error,
    mutate,
    create,
    update,
    setPrimary,
    duplicate,
    remove,
  }
}

/**
 * Resolution order for the active journey:
 *   1. `?plan=<id>` when it names a journey the user owns
 *   2. the journey flagged `isPrimary`
 *   3. the first journey by name
 *   4. none
 *
 * Steps 2-4 are {@link primaryJourney} — "the journey that stands for the
 * user" is one rule, defined once, so /wealth and /independence can't drift.
 * `?plan=` is the only thing this adds.
 */
function resolveActivePlan(
  plans: IndependencePlan[],
  requestedId: string | undefined,
): IndependencePlan | undefined {
  const requested = requestedId
    ? plans.find((plan) => plan.id === requestedId)
    : undefined
  return requested ?? primaryJourney(plans)
}

export interface UseActiveIndependencePlanResult extends UseIndependencePlansResult {
  /** The journey currently being viewed, or undefined when there are none. */
  activePlan: IndependencePlan | undefined
  activePlanId: string | undefined
  /** Select a journey — a shallow route update, not a navigation. */
  setActivePlan: (id: string) => void
}

/**
 * The journeys plus whichever one the page is currently showing. The
 * selection lives in the URL (`?plan=<id>`) so it survives a reload and can
 * be linked to, the same way `?view=` carries the tab.
 */
export function useActiveIndependencePlan(): UseActiveIndependencePlanResult {
  const router = useRouter()
  const plansResult = useIndependencePlans()
  const { plans, isLoading } = plansResult

  const requestedId = Array.isArray(router.query?.[ACTIVE_PLAN_QUERY_PARAM])
    ? (router.query[ACTIVE_PLAN_QUERY_PARAM] as string[])[0]
    : (router.query?.[ACTIVE_PLAN_QUERY_PARAM] as string | undefined)

  const activePlan = useMemo(
    () => resolveActivePlan(plans, requestedId),
    [plans, requestedId],
  )

  // A `?plan=` naming a journey the user no longer owns — deleted in another
  // tab, or a stale bookmark — resolves silently to the default, leaving the
  // URL and the switcher disagreeing and the dead id surviving every reload.
  // Write the resolution back: to the journey actually being shown, or drop
  // the parameter when nothing resolves at all.
  //
  // `correctedFor` latches per requested id so the replace fires once and
  // never loops, and so a user who navigates to another dead id still gets
  // corrected. Nothing happens while the journeys request is in flight —
  // "not loaded yet" is not "not owned".
  const correctedFor = useRef<string | null>(null)
  useEffect(() => {
    if (isLoading || !requestedId) {
      correctedFor.current = null
      return
    }
    if (activePlan?.id === requestedId) {
      correctedFor.current = null
      return
    }
    if (correctedFor.current === requestedId) return
    correctedFor.current = requestedId

    const query = { ...router.query }
    delete query[ACTIVE_PLAN_QUERY_PARAM]
    if (activePlan) query[ACTIVE_PLAN_QUERY_PARAM] = activePlan.id
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    })
  }, [isLoading, requestedId, activePlan, router])

  const setActivePlan = useCallback(
    (id: string): void => {
      router.push(
        {
          pathname: router.pathname,
          query: { ...router.query, [ACTIVE_PLAN_QUERY_PARAM]: id },
        },
        undefined,
        { shallow: true },
      )
    },
    [router],
  )

  return {
    ...plansResult,
    activePlan,
    activePlanId: activePlan?.id,
    setActivePlan,
  }
}
