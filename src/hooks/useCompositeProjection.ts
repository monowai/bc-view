import { useState, useEffect, useCallback, useRef } from "react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
  CompositePhase,
  CompositeProjectionRequest,
  CompositeProjectionResult,
  CompositeScenarioComparison,
} from "types/independence"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"

const COMPOSITE_PROJECTION_URL = "/api/independence/composite/projection"
const COMPOSITE_SCENARIOS_URL = "/api/independence/composite/scenarios"
const DEBOUNCE_MS = 500
const SAVE_DEBOUNCE_MS = 1000

export interface UseCompositeProjectionResult {
  phases: CompositePhase[]
  setPhases: (phases: CompositePhase[]) => void
  displayCurrency: string
  setDisplayCurrency: (currency: string) => void
  excludedPlanIds: Set<string>
  toggleExclusion: (planId: string) => void
  /** Free-form narrative describing the overarching composite-plan goal. */
  compositeNarrative: string
  setCompositeNarrative: (narrative: string) => void
  projection: CompositeProjectionResult | undefined
  scenarios: CompositeScenarioComparison | undefined
  isLoading: boolean
  error: string | null
}

/**
 * Build initial phases from plans, distributing ages evenly
 * from currentAge to lifeExpectancy across included plans.
 */
export function buildInitialPhases(
  plans: RetirementPlan[],
  excludedPlanIds: Set<string>,
  currentAge: number,
  lifeExpectancy: number,
): CompositePhase[] {
  const included = plans.filter((p) => !excludedPlanIds.has(p.id))
  if (included.length === 0) return []

  const totalYears = lifeExpectancy - currentAge
  const yearsPerPhase = Math.floor(totalYears / included.length)
  const remainder = totalYears - yearsPerPhase * included.length

  return included.map((plan, i) => {
    const fromAge = currentAge + i * yearsPerPhase + Math.min(i, remainder)
    const isLast = i === included.length - 1
    const toAge = isLast
      ? lifeExpectancy
      : currentAge + (i + 1) * yearsPerPhase + Math.min(i + 1, remainder)
    return {
      planId: plan.id,
      fromAge,
      toAge: isLast ? undefined : toAge,
    }
  })
}

function parseSavedPhases(json: string | undefined): CompositePhase[] | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // Invalid JSON
  }
  return null
}

function parseSavedExclusions(json: string | undefined): Set<string> | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return new Set(parsed)
  } catch {
    // Invalid JSON
  }
  return null
}

export function useCompositeProjection(
  plans: RetirementPlan[],
  settings: UserIndependenceSettings | undefined,
): UseCompositeProjectionResult {
  const currentYear = new Date().getFullYear()
  const primaryPlan = plans.find((p) => p.isPrimary) || plans[0]
  const defaultCurrency = primaryPlan?.expensesCurrency || "USD"
  const yearOfBirth = settings?.yearOfBirth ?? primaryPlan?.yearOfBirth
  const currentAge = yearOfBirth ? currentYear - yearOfBirth : 60
  const lifeExpectancy = settings?.lifeExpectancy ?? 90

  const { updateSettings } = useIndependenceSettings()

  const [excludedPlanIds, setExcludedPlanIds] = useState<Set<string>>(new Set())
  const [phases, setPhases] = useState<CompositePhase[]>([])
  const [displayCurrency, setDisplayCurrency] = useState(defaultCurrency)
  const [compositeNarrative, setCompositeNarrative] = useState<string>("")
  const [initialized, setInitialized] = useState(false)
  const [projection, setProjection] = useState<
    CompositeProjectionResult | undefined
  >()
  const [scenarios, setScenarios] = useState<
    CompositeScenarioComparison | undefined
  >()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize from saved settings or build defaults
  useEffect(() => {
    if (plans.length === 0 || !settings || initialized) return

    const savedExclusions = parseSavedExclusions(
      settings.compositeExcludedPlanIds,
    )
    const savedPhases = parseSavedPhases(settings.compositePhases)
    const savedCurrency = settings.compositeDisplayCurrency
    const savedNarrative = settings.compositeNarrative

    if (savedExclusions) setExcludedPlanIds(savedExclusions)
    if (savedCurrency) setDisplayCurrency(savedCurrency)
    if (savedNarrative != null) setCompositeNarrative(savedNarrative)

    // Validate saved phases — all planIds must still exist
    const planIds = new Set(plans.map((p) => p.id))
    if (
      savedPhases &&
      savedPhases.every((phase) => planIds.has(phase.planId))
    ) {
      setPhases(savedPhases)
    } else {
      const exclusions = savedExclusions ?? new Set<string>()
      const initial = buildInitialPhases(
        plans,
        exclusions,
        currentAge,
        lifeExpectancy,
      )
      setPhases(initial)
    }

    setInitialized(true)
  }, [plans, settings, currentAge, lifeExpectancy, initialized])

  // Save composite config to settings (debounced)
  useEffect(() => {
    if (!initialized || phases.length === 0) return undefined

    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      updateSettings({
        compositeDisplayCurrency: displayCurrency,
        compositePhases: JSON.stringify(phases),
        compositeExcludedPlanIds: JSON.stringify(Array.from(excludedPlanIds)),
        compositeNarrative: compositeNarrative,
      }).catch(() => {
        // Silent save failure — not critical
      })
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phases,
    displayCurrency,
    excludedPlanIds,
    compositeNarrative,
    initialized,
  ])

  const toggleExclusion = useCallback(
    (planId: string) => {
      setExcludedPlanIds((prev) => {
        const next = new Set(prev)
        if (next.has(planId)) {
          next.delete(planId)
        } else {
          next.add(planId)
        }
        // Rebuild phases with new exclusions
        const rebuilt = buildInitialPhases(
          plans,
          next,
          currentAge,
          lifeExpectancy,
        )
        setPhases(rebuilt)
        return next
      })
    },
    [plans, currentAge, lifeExpectancy],
  )

  // Fetch projection when phases or currency change (debounced)
  useEffect(() => {
    if (phases.length === 0) {
      return undefined
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      const request: CompositeProjectionRequest = {
        displayCurrency,
        phases,
      }

      // Reset result state to an error with the given message. Used for
      // both expected HTTP-non-OK responses and unexpected network errors
      // so we don't duplicate setter calls in two branches.
      const reportError = (message: string): void => {
        setError(message)
        setProjection(undefined)
        setScenarios(undefined)
      }

      try {
        const [projRes, scenRes] = await Promise.all([
          fetch(COMPOSITE_PROJECTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          }),
          fetch(COMPOSITE_SCENARIOS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          }),
        ])

        // Expected-failure path: the projection endpoint returned non-2xx.
        // Handle it inline instead of throwing-and-catching-locally, which
        // is an anti-pattern (sonarjs S3696 / similar).
        if (!projRes.ok) {
          const errData = await projRes.json().catch(() => ({}))
          reportError(
            errData.message || `Projection failed (${projRes.status})`,
          )
          return
        }

        const projData = await projRes.json()
        setProjection(projData.data)

        if (scenRes.ok) {
          const scenData = await scenRes.json()
          setScenarios(scenData.data)
        }
      } catch (err) {
        // Only genuinely unexpected errors reach here — fetch rejection
        // (network down, DNS failure, CORS), response.json() parse errors
        // on a body that claimed to be JSON but wasn't, etc.
        const message =
          err instanceof Error ? err.message : "Failed to fetch projection"
        reportError(message)
      } finally {
        setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [phases, displayCurrency])

  return {
    phases,
    setPhases,
    displayCurrency,
    setDisplayCurrency,
    excludedPlanIds,
    toggleExclusion,
    compositeNarrative,
    setCompositeNarrative,
    projection,
    scenarios,
    isLoading,
    error,
  }
}
